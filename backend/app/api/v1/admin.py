from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ADMIN_ONLY, require_roles
from app.models.enums import DocumentStatus, LandStatus
from app.models.user import User
from app.schemas.admin import (
    AdminDocumentList,
    AdminLandRecordList,
    AdminUser,
    AdminUserCreate,
    AdminUserList,
    AdminUserPatch,
    RoleCode,
)
from app.schemas.ledger import LedgerVerify
from app.services import admin as svc
from app.services import ledger as ledger_svc

router = APIRouter(prefix="/admin", tags=["admin"])
Order = Literal["asc", "desc"]
Admin = Depends(require_roles(*ADMIN_ONLY))


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/users", response_model=AdminUserList)
def users(
    q: str | None = Query(default=None, max_length=100),
    role: RoleCode | None = None,
    is_active: bool | None = None,
    sort: Literal["name", "email", "role", "created_at"] = "created_at",
    order: Order = "desc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Admin,
    db: Session = Depends(get_db),
) -> AdminUserList:
    return svc.list_users(db, q, role, is_active, sort, order, limit, offset)


@router.post("/users", response_model=AdminUser, status_code=201)
def create_user(
    body: AdminUserCreate, request: Request, admin: User = Admin, db: Session = Depends(get_db)
) -> AdminUser:
    return AdminUser.model_validate(svc.create_user(db, admin, body, _ip(request)))


@router.patch("/users/{user_id}", response_model=AdminUser)
def patch_user(
    user_id: str, body: AdminUserPatch, request: Request,
    admin: User = Admin, db: Session = Depends(get_db),
) -> AdminUser:  # fmt: skip
    return AdminUser.model_validate(svc.update_user(db, admin, user_id, body, _ip(request)))


@router.get("/land-records", response_model=AdminLandRecordList)
def land_records(
    q: str | None = Query(default=None, max_length=100),
    status: LandStatus | None = None,
    sort: Literal["land_id", "district", "mouza", "area", "status", "updated_at"] = "land_id",
    order: Order = "asc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Admin,
    db: Session = Depends(get_db),
) -> AdminLandRecordList:
    return svc.list_land_records(db, q, status, sort, order, limit, offset)


@router.get("/documents", response_model=AdminDocumentList)
def documents(
    q: str | None = Query(default=None, max_length=100),
    status: DocumentStatus | None = None,
    sort: Literal[
        "created_at", "document_type", "processing_status", "ocr_confidence", "land_id"
    ] = "created_at",
    order: Order = "desc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Admin,
    db: Session = Depends(get_db),
) -> AdminDocumentList:
    return svc.list_documents(db, q, status, sort, order, limit, offset)


@router.get("/ledger/verify", response_model=LedgerVerify)
def verify_ledger(_: User = Admin, db: Session = Depends(get_db)) -> LedgerVerify:
    return LedgerVerify(**ledger_svc.verify(db))
