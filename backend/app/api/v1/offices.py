from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.db import get_db
from app.core.ratelimit import check_rate
from app.core.rbac import ADMIN_ONLY, require_roles
from app.models.user import User
from app.schemas.offices import (
    AdminOfficerRequest,
    AdminOfficerRequestList,
    OfficeList,
    OfficerRequestIn,
    OfficerRequestOut,
    Place,
    RejectIn,
)
from app.services import audit
from app.services import offices as svc

router = APIRouter(prefix="/offices", tags=["offices"])
admin_router = APIRouter(prefix="/admin/officer-requests", tags=["admin"])
Admin = Depends(require_roles(*ADMIN_ONLY))
Name = Query(min_length=1, max_length=100)


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/divisions", response_model=list[Place])
def divisions(db: Session = Depends(get_db)) -> list[Place]:
    return svc.divisions(db)


@router.get("/districts", response_model=list[Place])
def districts(division: str = Name, db: Session = Depends(get_db)) -> list[Place]:
    return svc.districts(db, division)


@router.get("/upazilas", response_model=list[Place])
def upazilas(
    division: str = Name, district: str = Name, db: Session = Depends(get_db)
) -> list[Place]:
    return svc.upazilas(db, division, district)


@router.get("", response_model=OfficeList)
def offices(
    division: str = Name,
    district: str = Name,
    upazila: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
) -> OfficeList:
    return svc.offices(db, division, district, upazila)


@router.post("/officer-requests", response_model=OfficerRequestOut, status_code=201)
def create_request(
    data: OfficerRequestIn, request: Request, db: Session = Depends(get_db)
) -> OfficerRequestOut:
    settings: Settings = request.app.state.settings
    check_rate("register", _ip(request) or "unknown", settings.auth_rate_limit_per_min)
    req = svc.create_request(db, data)
    audit.log(db, req.user_id, "OFFICER_REQUEST", "user", req.user_id, ip=_ip(request))
    db.commit()
    office = svc.OfficeOut.model_validate(db.get(svc.LandOffice, req.office_id))
    return OfficerRequestOut(
        id=req.id, status=req.status, created_at=req.created_at, office=office
    )


@admin_router.get("", response_model=AdminOfficerRequestList)
def list_requests(
    status: Literal["PENDING", "APPROVED", "REJECTED"] | None = None,
    division: str | None = Query(default=None, max_length=100),
    district: str | None = Query(default=None, max_length=100),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Admin,
    db: Session = Depends(get_db),
) -> AdminOfficerRequestList:
    return svc.list_requests(db, status, division, district, q, limit, offset)


@admin_router.post("/{request_id}/approve", response_model=AdminOfficerRequest)
def approve(
    request_id: str, request: Request, admin: User = Admin, db: Session = Depends(get_db)
) -> AdminOfficerRequest:
    return svc.decide(db, admin, request_id, True, None, _ip(request))


@admin_router.post("/{request_id}/reject", response_model=AdminOfficerRequest)
def reject(
    request_id: str, body: RejectIn, request: Request,
    admin: User = Admin, db: Session = Depends(get_db),
) -> AdminOfficerRequest:  # fmt: skip
    return svc.decide(db, admin, request_id, False, body.reason.strip(), _ip(request))
