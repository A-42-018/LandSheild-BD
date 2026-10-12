"""Auth service. Refresh-token revocation is in-memory (no extra table; resets on restart)."""
import threading
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.passwords import hash_password, verify_password
from app.core.ratelimit import check_rate, reset_rate_limits
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import RegisterIn

_revoked: dict[str, int] = {}  # jti -> exp (epoch)
_lock = threading.Lock()


def revoke(jti: str, exp: int) -> None:
    with _lock:
        now = int(time.time())
        for k in [k for k, v in _revoked.items() if v < now]:
            del _revoked[k]
        _revoked[jti] = exp


def is_revoked(jti: str) -> bool:
    with _lock:
        return jti in _revoked


def check_login_rate(key: str, limit: int) -> None:
    """R4: auth 10/min/IP. Shared in-memory limiter (core/ratelimit.py, P51)."""
    check_rate("login", key, limit)


def reset_login_limits() -> None:
    reset_rate_limits()


def find_user(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def clear_revoked() -> None:
    with _lock:
        _revoked.clear()


def register_user(db: Session, data: RegisterIn) -> User:
    if db.scalar(select(User).where(User.email == data.email)):
        raise AppError("EMAIL_TAKEN", "Email already registered", 409)
    user = User(
        name=data.name.strip(),
        email=data.email,
        password_hash=hash_password(data.password),
        role=Role.CITIZEN.value,  # forced, never client-controlled
        preferred_language=data.preferred_language,
    )
    db.add(user)
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    ok = verify_password(password, user.password_hash if user else "x$0$0$0$00$00")
    if not user or not ok:
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    if not user.is_active:
        from app.services import offices  # local: offices imports models that import this module

        raise offices.login_block(db, user) or AppError(
            "INVALID_CREDENTIALS", "Invalid email or password", 401
        )
    return user
