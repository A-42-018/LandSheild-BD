from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ANY_AUTH, require_roles
from app.models.user import User
from app.schemas.report import VerificationCreate, VerificationOut, VerificationReport
from app.services import verification as svc

router = APIRouter(tags=["verification"])


@router.post("/verification", response_model=VerificationOut, status_code=201)
def create_verification(
    body: VerificationCreate,
    request: Request,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> VerificationOut:
    ip = request.client.host if request.client else None
    return svc.create_verification(db, body.land_id, user, ip)


@router.get("/verification/{verification_id}", response_model=VerificationOut)
def get_verification(
    verification_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> VerificationOut:
    return svc.get_verification(db, verification_id, user)


@router.get("/verification/{verification_id}/report", response_model=VerificationReport)
def get_verification_report(
    verification_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> VerificationReport:
    return svc.get_report(db, verification_id, user)
