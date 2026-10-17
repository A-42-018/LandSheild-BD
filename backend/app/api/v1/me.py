"""Citizen area `/me/*` (U3.2): everything here is scoped to the signed-in user."""

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ANY_AUTH, require_roles
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.me import (
    MeSummary,
    MyLands,
    NidRegister,
    NidStatus,
    NotificationList,
    NotificationsRead,
    PasswordChange,
    ProfileUpdate,
    ReportList,
    SearchList,
    WatchCreate,
    WatchItem,
    WatchList,
)
from app.services import me as svc
from app.services import my_lands as lands_svc

router = APIRouter(prefix="/me", tags=["me"])


class UnreadCount(BaseModel):
    unread: int


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/summary", response_model=MeSummary)
def get_summary(
    user: User = Depends(require_roles(*ANY_AUTH)), db: Session = Depends(get_db)
) -> MeSummary:
    return svc.summary(db, user)


@router.get("/searches", response_model=SearchList)
def list_searches(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> SearchList:
    return svc.list_searches(db, user, limit, offset)


@router.delete("/searches", status_code=204)
def clear_searches(
    request: Request,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> Response:
    svc.clear_searches(db, user, _ip(request))
    return Response(status_code=204)


@router.get("/watchlist", response_model=WatchList)
def list_watchlist(
    user: User = Depends(require_roles(*ANY_AUTH)), db: Session = Depends(get_db)
) -> WatchList:
    return svc.list_watchlist(db, user)


@router.post("/watchlist", response_model=WatchItem, status_code=201)
def add_watch(
    body: WatchCreate,
    request: Request,
    response: Response,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> WatchItem:
    item, created = svc.add_watch(db, user, body, _ip(request))
    if not created:
        response.status_code = 200
    return item


@router.delete("/watchlist/{land_id}", status_code=204)
def remove_watch(
    land_id: str,
    request: Request,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> Response:
    svc.remove_watch(db, user, land_id, _ip(request))
    return Response(status_code=204)


@router.get("/reports", response_model=ReportList)
def list_reports(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> ReportList:
    return svc.list_reports(db, user, limit, offset)


@router.get("/notifications", response_model=NotificationList)
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> NotificationList:
    return svc.list_notifications(db, user, unread_only, limit, offset)


@router.post("/notifications/read", response_model=UnreadCount)
def mark_notifications_read(
    body: NotificationsRead,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> UnreadCount:
    return UnreadCount(unread=svc.mark_read(db, user, body.ids))


@router.patch("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdate,
    request: Request,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> User:
    return svc.update_profile(db, user, body, _ip(request))


@router.post("/password", status_code=204)
def change_password(
    body: PasswordChange,
    request: Request,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> Response:
    svc.change_password(db, user, body, _ip(request))
    return Response(status_code=204)


# ---- NID-linked land (citizens only: staff accounts have no "my land" here) -----------------
@router.get("/nid", response_model=NidStatus)
def get_nid(user: User = Depends(require_roles(Role.CITIZEN))) -> NidStatus:
    return lands_svc.nid_status(user)


@router.post("/nid", response_model=NidStatus)
def register_nid(
    body: NidRegister,
    request: Request,
    user: User = Depends(require_roles(Role.CITIZEN)),
    db: Session = Depends(get_db),
) -> NidStatus:
    return lands_svc.register_nid(db, user, body, _ip(request))


@router.delete("/nid", status_code=204)
def unregister_nid(
    request: Request,
    user: User = Depends(require_roles(Role.CITIZEN)),
    db: Session = Depends(get_db),
) -> Response:
    lands_svc.unregister_nid(db, user, _ip(request))
    return Response(status_code=204)


@router.get("/lands", response_model=MyLands)
def get_my_lands(
    request: Request,
    user: User = Depends(require_roles(Role.CITIZEN)),
    db: Session = Depends(get_db),
) -> MyLands:
    return lands_svc.my_lands(db, user, _ip(request))
