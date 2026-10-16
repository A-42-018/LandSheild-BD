from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import REVIEW_UP, require_roles
from app.models.document import Document
from app.models.enums import Role
from app.models.user import User
from app.schemas.officer import (
    ActivityList,
    DecisionList,
    OfficerStats,
    QueueFilter,
    QueueList,
    QueueSort,
    SortOrder,
)
from app.services import officer as svc
from app.services.offices import area_filter, doc_scope

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
    division: str | None = Query(default=None, max_length=100),
    district: str | None = Query(default=None, max_length=100),
    upazila: str | None = Query(default=None, max_length=100),
    office_id: str | None = Query(default=None, max_length=36),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> QueueList:
    threshold = request.app.state.settings.review_conf_threshold
    return svc.get_queue(
        db, threshold, filter, q, sort, order, limit, offset,
        scope=doc_scope(user),
        area=area_filter(Document.office_id, division, district, upazila, office_id),
    )


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


@router.get("/my-decisions", response_model=DecisionList)
def my_decisions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DecisionList:
    return svc.get_my_decisions(db, user, limit, offset)
