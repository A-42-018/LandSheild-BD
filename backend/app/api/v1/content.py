from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ADMIN_ONLY, require_roles
from app.models.user import User
from app.schemas.content import (
    AdminContent,
    AdminContentList,
    ContentIn,
    ContentPatch,
    Kind,
    PublicContentList,
)
from app.services import content as svc

router = APIRouter(prefix="/content", tags=["content"])
admin_router = APIRouter(prefix="/admin/content", tags=["admin"])
Admin = Depends(require_roles(*ADMIN_ONLY))


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PublicContentList)
def public_content(
    response: Response, kind: Kind = Query(), db: Session = Depends(get_db)
) -> PublicContentList:
    response.headers["Cache-Control"] = "public, max-age=60"
    return svc.public_list(db, kind)


@admin_router.get("", response_model=AdminContentList)
def list_content(
    kind: Kind | None = None,
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Admin,
    db: Session = Depends(get_db),
) -> AdminContentList:
    return svc.list_items(db, kind, q, limit, offset)


@admin_router.post("", response_model=AdminContent, status_code=201)
def create_content(
    data: ContentIn, request: Request, admin: User = Admin, db: Session = Depends(get_db)
) -> AdminContent:
    row = svc.create(db, admin, data, _ip(request))
    return AdminContent.model_validate(row, from_attributes=True)


@admin_router.patch("/{item_id}", response_model=AdminContent)
def update_content(
    item_id: str, data: ContentPatch, request: Request,
    admin: User = Admin, db: Session = Depends(get_db),
) -> AdminContent:  # fmt: skip
    row = svc.update(db, admin, item_id, data, _ip(request))
    return AdminContent.model_validate(row, from_attributes=True)


@admin_router.delete("/{item_id}", status_code=204)
def delete_content(
    item_id: str, request: Request, admin: User = Admin, db: Session = Depends(get_db)
) -> Response:
    svc.delete(db, admin, item_id, _ip(request))
    return Response(status_code=204)
