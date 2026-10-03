"""RBAC (R4). Wraps get_current_user; role is read from the DB, never the token."""
from collections.abc import Callable

from fastapi import Depends

from app.api.v1.auth import get_current_user
from app.core.errors import AppError
from app.models.enums import Role
from app.models.user import User

ANY_AUTH = (Role.CITIZEN, Role.REVIEWER, Role.OFFICER, Role.ADMIN)
REVIEW_UP = (Role.REVIEWER, Role.OFFICER, Role.ADMIN)
OFFICER_UP = (Role.OFFICER, Role.ADMIN)
ADMIN_ONLY = (Role.ADMIN,)


def require_roles(*roles: Role | str) -> Callable[..., User]:
    allowed = {Role(r).value for r in roles}

    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise AppError("FORBIDDEN", "Insufficient permissions", 403)
        return user

    return dep
