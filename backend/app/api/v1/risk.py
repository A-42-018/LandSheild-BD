from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ANY_AUTH, REVIEW_UP, require_roles
from app.models.enums import AlertStatus
from app.models.user import User
from app.schemas.risk import LandRisk, RiskAlertList, RiskAlertOut, RiskAlertPatch
from app.services import risk as svc

router = APIRouter(tags=["risk"])


@router.get("/lands/{land_id}/risk", response_model=LandRisk)
def get_land_risk(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> LandRisk:
    return svc.get_land_risk(db, land_id)


@router.get("/risk-alerts", response_model=RiskAlertList)
def list_risk_alerts(
    status: AlertStatus | None = None,
    severity: str | None = Query(default=None, max_length=20),
    land_id: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RiskAlertList:
    return svc.list_alerts(db, status.value if status else None, severity, land_id, limit, offset)


@router.patch("/risk-alerts/{alert_id}", response_model=RiskAlertOut)
def patch_risk_alert(
    alert_id: str,
    body: RiskAlertPatch,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RiskAlertOut:
    ip = request.client.host if request.client else None
    return svc.update_alert(db, alert_id, body.status, user, ip)
