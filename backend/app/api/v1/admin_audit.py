from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import OFFICER_UP, require_roles
from app.models.user import User
from app.schemas.audit_log import AuditLogList
from app.services import audit_logs as svc

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-logs", response_model=AuditLogList)
def audit_logs(
    actor: str | None = Query(default=None, max_length=100),
    action: str | None = Query(default=None, max_length=100),
    entity_type: str | None = Query(default=None, max_length=50),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> AuditLogList:
    return svc.list_audit_logs(db, actor, action, entity_type, date_from, date_to, limit, offset)
