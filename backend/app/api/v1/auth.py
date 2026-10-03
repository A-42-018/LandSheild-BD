from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import check_rate
from app.core.security import (
    ACCESS,
    REFRESH,
    REFRESH_COOKIE,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut
from app.services import audit
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> User:
    if creds is None:
        raise AppError("UNAUTHORIZED", "Not authenticated", 401)
    payload = decode_token(settings, creds.credentials, ACCESS)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise AppError("UNAUTHORIZED", "User not found or inactive", 401)
    return user


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _samesite(settings: Settings) -> str:
    value = settings.cookie_samesite.lower()
    return value if value in ("lax", "strict", "none") else "lax"


def _set_cookie(resp: Response, settings: Settings, token: str) -> None:
    resp.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.jwt_refresh_days * 86400,
        httponly=True,
        samesite=_samesite(settings),
        secure=settings.cookie_secure,
        path="/api/v1/auth",
    )


def _issue(resp: Response, settings: Settings, user: User) -> TokenOut:
    _set_cookie(resp, settings, create_refresh_token(settings, user.id))
    return TokenOut(
        access_token=create_access_token(settings, user.id, user.role),
        expires_in=settings.jwt_access_minutes * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    data: RegisterIn,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> User:
    check_rate("register", _client_ip(request) or "unknown", settings.auth_rate_limit_per_min)
    user = svc.register_user(db, data)
    audit.log(db, user, "REGISTER", "user", user.id, ip=_client_ip(request))
    db.commit()
    return user


@router.post("/login", response_model=TokenOut)
def login(
    data: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    ip = _client_ip(request)
    svc.check_login_rate(ip or "unknown", settings.auth_rate_limit_per_min)
    try:
        user = svc.authenticate(db, data.email, data.password)
    except AppError as exc:
        if exc.code == "INVALID_CREDENTIALS":
            known = svc.find_user(db, data.email)
            audit.log(
                db,
                known,
                "FAILED_LOGIN",
                "user",
                known.id if known else None,
                new={"reason": exc.code},
                ip=ip,
            )
            db.commit()
        raise
    audit.log(db, user, "LOGIN", "user", user.id, ip=ip)
    db.commit()
    return _issue(response, settings, user)


@router.post("/refresh", response_model=TokenOut)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> TokenOut:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise AppError("UNAUTHORIZED", "Missing refresh token", 401)
    payload = decode_token(settings, token, REFRESH)
    if svc.is_revoked(payload["jti"]):
        raise AppError("TOKEN_INVALID", "Refresh token revoked", 401)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise AppError("UNAUTHORIZED", "User not found or inactive", 401)
    svc.revoke(payload["jti"], payload["exp"])  # rotation
    return _issue(response, settings, user)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> Response:
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            p = decode_token(settings, token, REFRESH)
            svc.revoke(p["jti"], p["exp"])
            audit.log(db, p["sub"], "LOGOUT", "user", p["sub"], ip=_client_ip(request))
            db.commit()
        except AppError:
            pass
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
