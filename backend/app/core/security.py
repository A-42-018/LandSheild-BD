"""JWT helpers (D5): access (Bearer, short) + refresh (httpOnly cookie, 7 d)."""
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import jwt

from app.core.config import Settings
from app.core.errors import AppError

ALGORITHM = "HS256"
ACCESS = "access"
REFRESH = "refresh"
REFRESH_COOKIE = "ls_refresh"


@lru_cache
def _dev_secret() -> str:
    return secrets.token_urlsafe(32)


def get_secret(settings: Settings) -> str:
    """Fail fast when JWT_SECRET is missing outside dev; ephemeral random secret in dev."""
    if settings.jwt_secret:
        return settings.jwt_secret
    if settings.app_env.lower() == "dev":
        return _dev_secret()
    raise RuntimeError("JWT_SECRET must be set when APP_ENV is not 'dev'")


def _encode(settings: Settings, sub: str, kind: str, ttl: timedelta, extra: dict | None = None):
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": kind,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
        **(extra or {}),
    }
    return jwt.encode(payload, get_secret(settings), algorithm=ALGORITHM)


def create_access_token(settings: Settings, user_id: str, role: str) -> str:
    return _encode(
        settings, user_id, ACCESS, timedelta(minutes=settings.jwt_access_minutes), {"role": role}
    )


def create_refresh_token(settings: Settings, user_id: str) -> str:
    return _encode(settings, user_id, REFRESH, timedelta(days=settings.jwt_refresh_days))


def decode_token(settings: Settings, token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, get_secret(settings), algorithms=[ALGORITHM], options={"require": ["exp", "sub"]}
        )
    except jwt.ExpiredSignatureError as e:
        raise AppError("TOKEN_EXPIRED", "Token expired", 401) from e
    except jwt.InvalidTokenError as e:
        raise AppError("TOKEN_INVALID", "Invalid token", 401) from e
    if payload.get("type") != expected_type:
        raise AppError("TOKEN_INVALID", "Wrong token type", 401)
    return payload
