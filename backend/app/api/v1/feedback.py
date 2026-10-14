from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import OFFICER_UP, require_roles
from app.models.user import User
from app.schemas.feedback import FeedbackItem, FeedbackList, FeedbackUpdate
from app.services import audit
from app.services import feedback as svc

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("", response_model=FeedbackList)
def list_feedback(
    status: Literal["RECEIVED", "IN_REVIEW", "RESOLVED", "CLOSED"] | None = None,
    kind: Literal["GRIEVANCE", "FEEDBACK", "SUGGESTION"] | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> FeedbackList:
    return svc.list_items(db, status, kind, limit, offset)


@router.patch("/{feedback_id}", response_model=FeedbackItem)
def update_feedback(
    feedback_id: str,
    data: FeedbackUpdate,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> FeedbackItem:
    row, old = svc.update(db, feedback_id, data, user)
    audit.log(
        db, user, "FEEDBACK_UPDATE", "feedback", row.id, old=old,
        new={"status": row.status, "response": row.response},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return FeedbackItem.model_validate(row)
