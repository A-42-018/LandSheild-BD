"""Public feedback / grievance intake, status lookup and officer handling."""
import re
import secrets
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import (
    FeedbackIn,
    FeedbackItem,
    FeedbackList,
    FeedbackUpdate,
    PageRatingIn,
    PublicFeedbackStatus,
)

RATING = "PAGE_RATING"
_REF = re.compile(r"^FB-\d{4}-\d{5}$")


def _new_ref(db: Session) -> str:
    year = datetime.now(UTC).year
    while True:
        ref = f"FB-{year}-{secrets.randbelow(100000):05d}"
        if db.scalar(select(Feedback.id).where(Feedback.reference_no == ref)) is None:
            return ref


def create(db: Session, data: FeedbackIn) -> Feedback:
    row = Feedback(
        reference_no=_new_ref(db),
        kind=data.kind,
        subject=data.subject,
        message=data.message,
        contact_email=data.contact_email,
        related_ref=data.related_ref,
    )
    db.add(row)
    db.flush()
    return row


def rate_page(db: Session, data: PageRatingIn) -> None:
    db.add(
        Feedback(
            reference_no=_new_ref(db),
            kind=RATING,
            subject=data.page,
            message="helpful" if data.helpful else "not helpful",
            status="CLOSED",
        )
    )
    db.commit()


def public_status(db: Session, reference_no: str) -> PublicFeedbackStatus:
    ref = reference_no.strip().upper()
    row = None
    if _REF.match(ref):
        row = db.scalar(select(Feedback).where(Feedback.reference_no == ref))
    if row is None or row.kind == RATING:
        raise AppError("FEEDBACK_NOT_FOUND", "Reference number not found", 404)
    return PublicFeedbackStatus(
        reference_no=row.reference_no,
        kind=row.kind,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        response=row.response,
    )


def list_items(
    db: Session, status: str | None, kind: str | None, limit: int, offset: int
) -> FeedbackList:
    base = select(Feedback).where(Feedback.kind != RATING)
    if status:
        base = base.where(Feedback.status == status)
    if kind:
        base = base.where(Feedback.kind == kind)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(base.order_by(Feedback.created_at.desc()).limit(limit).offset(offset)).all()
    open_n = db.scalar(
        select(func.count())
        .select_from(Feedback)
        .where(Feedback.kind != RATING, Feedback.status.in_(("RECEIVED", "IN_REVIEW")))
    )
    rated = dict(
        db.execute(
            select(Feedback.message, func.count())
            .where(Feedback.kind == RATING)
            .group_by(Feedback.message)
        ).all()
    )
    return FeedbackList(
        items=[FeedbackItem.model_validate(r) for r in rows],
        total=total,
        open=open_n or 0,
        helpful=rated.get("helpful", 0),
        not_helpful=rated.get("not helpful", 0),
        limit=limit,
        offset=offset,
    )


def update(
    db: Session, feedback_id: str, data: FeedbackUpdate, user: User
) -> tuple[Feedback, dict]:
    row = db.get(Feedback, feedback_id)
    if row is None or row.kind == RATING:
        raise AppError("FEEDBACK_NOT_FOUND", "Feedback item not found", 404)
    old = {"status": row.status, "response": row.response}
    row.status = data.status
    if data.response is not None:
        row.response = data.response.strip() or None
    row.responded_by = user.id
    db.flush()
    return row, old
