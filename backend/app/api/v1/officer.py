from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import REVIEW_UP, require_roles
from app.models.enums import Role
from app.models.user import User
from app.schemas.officer import (
    ActivityList,
    OfficerStats,
    QueueFilter,
    QueueList,
    QueueSort,
    SortOrder,
)
from app.services import officer as svc

router = APIRouter(prefix="/officer", tags=["officer"])


@router.get("/stats", response_model=OfficerStats)
def stats(
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> OfficerStats:
    return svc.get_stats(db)


@router.get("/queue", response_model=QueueList)
def queue(
    request: Request,
    filter: QueueFilter | None = None,
    q: str | None = Query(default=None, max_length=100),
    sort: QueueSort = QueueSort.CREATED_AT,
    order: SortOrder = SortOrder.DESC,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> QueueList:
    threshold = request.app.state.settings.review_conf_threshold
    return svc.get_queue(db, threshold, filter, q, sort, order, limit, offset)


@router.get("/activity", response_model=ActivityList)
def activity(
    action: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ActivityList:
    scope = svc.REVIEWER_ACTIVITY_ENTITIES if user.role == Role.REVIEWER.value else None
    return svc.get_activity(db, action, limit, offset, scope)
