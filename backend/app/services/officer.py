"""Officer dashboard queries (P33). Read-only; no internal hashes/paths/ids beyond document id."""
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.alert import FraudAlert
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import AlertStatus, DocumentStatus, LandStatus
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.officer import (
    ActivityActor,
    ActivityItem,
    ActivityList,
    OfficerStats,
    QueueFilter,
    QueueItem,
    QueueList,
    QueueSort,
    SortOrder,
)

PENDING_STATUSES = (DocumentStatus.REVIEW_REQUIRED.value, DocumentStatus.EXTRACTED.value)
ACTIVE_ALERT_STATUSES = (
    AlertStatus.OPEN.value,
    AlertStatus.UNDER_REVIEW.value,
    AlertStatus.ESCALATED.value,
)
RECENT_DAYS = 7


def _high_risk_land_ids():
    """Lands with a HIGH alert that is not dismissed (subquery of land ids)."""
    return select(FraudAlert.land_id).where(
        FraudAlert.severity == "HIGH", FraudAlert.status.in_(ACTIVE_ALERT_STATUSES)
    )


def _active_alert_land_ids():
    return select(FraudAlert.land_id).where(FraudAlert.status.in_(ACTIVE_ALERT_STATUSES))


def get_stats(db: Session) -> OfficerStats:
    total = db.scalar(select(func.count()).select_from(LandParcel)) or 0
    pending = (
        db.scalar(
            select(func.count())
            .select_from(Document)
            .where(Document.processing_status.in_(PENDING_STATUSES))
        )
        or 0
    )
    high = (
        db.scalar(select(func.count(func.distinct(FraudAlert.land_id))).where(
            FraudAlert.severity == "HIGH", FraudAlert.status.in_(ACTIVE_ALERT_STATUSES)
        ))
        or 0
    )
    verified = (
        db.scalar(
            select(func.count())
            .select_from(LandParcel)
            .where(
                LandParcel.status == LandStatus.ACTIVE.value,
                LandParcel.id.not_in(_active_alert_land_ids()),
            )
        )
        or 0
    )
    return OfficerStats(
        total_records=total, pending_review=pending, high_risk=high, verified=verified
    )


def _min_conf(doc: Document, threshold: float) -> tuple[float | None, bool]:
    """(lowest field confidence, any non-edited field below threshold); absent field = 0."""
    fields = (doc.extraction_json or {}).get("fields") or []
    if not fields:
        return None, False
    confs = [float(f.get("confidence") or 0.0) for f in fields]
    low = any(
        float(f.get("confidence") or 0.0) < threshold and not f.get("edited_by_human")
        for f in fields
    )
    return min(confs), low


def _low_conf_ids(db: Session, threshold: float) -> list[str]:
    rows = db.scalars(
        select(Document).where(
            Document.processing_status.in_(PENDING_STATUSES),
            Document.extraction_json.is_not(None),
        )
    ).all()
    return [d.id for d in rows if _min_conf(d, threshold)[1]]


def get_queue(
    db: Session,
    threshold: float,
    flt: QueueFilter | None,
    q: str | None,
    sort: QueueSort,
    order: SortOrder,
    limit: int,
    offset: int,
) -> QueueList:
    cond = []
    if flt == QueueFilter.PENDING:
        cond.append(Document.processing_status.in_(PENDING_STATUSES))
    elif flt == QueueFilter.LOW_CONFIDENCE:
        cond.append(Document.id.in_(_low_conf_ids(db, threshold)))
    elif flt == QueueFilter.HIGH_RISK:
        cond.append(Document.land_id.in_(_high_risk_land_ids()))
    elif flt == QueueFilter.RECENT:
        since = datetime.now(UTC) - timedelta(days=RECENT_DAYS)
        cond.append(Document.created_at >= since)
    if q:
        term = f"%{q.strip().lower()}%"
        cond.append(
            or_(
                func.lower(LandParcel.land_id).like(term),
                func.lower(Document.document_type).like(term),
                func.lower(Document.processing_status).like(term),
                func.lower(LandParcel.mouza).like(term),
            )
        )
    sort_col = {
        QueueSort.CREATED_AT: Document.created_at,
        QueueSort.STATUS: Document.processing_status,
        QueueSort.LAND_ID: LandParcel.land_id,
    }[sort]
    primary = sort_col.asc() if order == SortOrder.ASC else sort_col.desc()
    joined = Document.land_id == LandParcel.id
    total = (
        db.scalar(
            select(func.count())
            .select_from(Document)
            .outerjoin(LandParcel, joined)
            .where(*cond)
        )
        or 0
    )
    rows = db.execute(
        select(Document, LandParcel.land_id)
        .outerjoin(LandParcel, joined)
        .where(*cond)
        .order_by(primary, Document.id)
        .limit(limit)
        .offset(offset)
    ).all()
    land_pks = {d.land_id for d, _ in rows if d.land_id}
    risky = (
        set(
            db.scalars(
                select(FraudAlert.land_id).where(
                    FraudAlert.land_id.in_(land_pks),
                    FraudAlert.severity == "HIGH",
                    FraudAlert.status.in_(ACTIVE_ALERT_STATUSES),
                )
            )
        )
        if land_pks
        else set()
    )
    items = []
    for doc, code in rows:
        mn, low = _min_conf(doc, threshold)
        items.append(
            QueueItem(
                id=doc.id,
                land_id=code,
                document_type=doc.document_type,
                processing_status=doc.processing_status,
                min_confidence=mn,
                low_confidence=low and doc.processing_status in PENDING_STATUSES,
                high_risk=doc.land_id in risky,
                created_at=doc.created_at,
            )
        )
    return QueueList(items=items, total=total, limit=limit, offset=offset)


def get_activity(db: Session, action: str | None, limit: int, offset: int) -> ActivityList:
    cond = [AuditLog.action == action] if action else []
    total = db.scalar(select(func.count()).select_from(AuditLog).where(*cond)) or 0
    rows = db.execute(
        select(AuditLog, User.name, User.role)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .where(*cond)
        .order_by(AuditLog.created_at.desc(), AuditLog.id)
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        ActivityItem(
            id=a.id,
            action=a.action,
            entity_type=a.entity_type,
            actor=ActivityActor(name=name, role=role) if name is not None else None,
            created_at=a.created_at,
        )
        for a, name, role in rows
    ]
    return ActivityList(items=items, total=total, limit=limit, offset=offset)
