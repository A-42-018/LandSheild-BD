"""Stub protected routes, one per access tier (R4). Replaced by real routes in later phases."""
from fastapi import APIRouter, Depends

from app.core.rbac import ADMIN_ONLY, ANY_AUTH, OFFICER_UP, REVIEW_UP, require_roles
from app.models.user import User

router = APIRouter(prefix="/rbac", tags=["rbac-stub"])


def _ok(user: User) -> dict[str, str]:
    return {"ok": "true", "role": user.role}


@router.get("/citizen")
def citizen_tier(user: User = Depends(require_roles(*ANY_AUTH))) -> dict[str, str]:
    return _ok(user)


@router.get("/reviewer")
def reviewer_tier(user: User = Depends(require_roles(*REVIEW_UP))) -> dict[str, str]:
    return _ok(user)


@router.get("/officer")
def officer_tier(user: User = Depends(require_roles(*OFFICER_UP))) -> dict[str, str]:
    return _ok(user)


@router.get("/admin")
def admin_tier(user: User = Depends(require_roles(*ADMIN_ONLY))) -> dict[str, str]:
    return _ok(user)
