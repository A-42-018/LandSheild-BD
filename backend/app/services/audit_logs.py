"""Audit log reader (P36). Read-only; old/new values and full ip_hash are never exposed."""
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogItem, AuditLogList
from app.schemas.officer import ActivityActor

IP_HASH_SHOWN = 8


def _like(value: str) -> str:
    esc = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc.lower()}%"


def list_audit_logs(
    db: Session,
    actor: str | None,
    action: str | None,
    entity_type: str | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> AuditLogList:
    if date_from and date_to and date_from > date_to:
        raise AppError("INVALID_DATE_RANGE", "date_from is after date_to", 422)
    cond = []
    actor = (actor or "").strip()
    if actor:
        cond.append(func.lower(User.name).like(_like(actor), escape="\\"))
    if action:
        cond.append(AuditLog.action == action)
    if entity_type:
        cond.append(AuditLog.entity_type == entity_type)
    if date_from:
        cond.append(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        cond.append(AuditLog.created_at < end)

    role_then = func.coalesce(AuditLog.actor_role, User.role)  # role at the time of the action
    base = select(AuditLog, User.name, role_then).outerjoin(User, User.id == AuditLog.actor_id)
    count = select(func.count()).select_from(AuditLog).outerjoin(User, User.id == AuditLog.actor_id)
    total = db.scalar(count.where(*cond)) or 0
    ordered = base.where(*cond).order_by(AuditLog.created_at.desc(), AuditLog.id)
    rows = db.execute(ordered.limit(limit).offset(offset)).all()
    items = [
        AuditLogItem(
            id=a.id,
            action=a.action,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            actor=ActivityActor(name=name, role=role) if name is not None else None,
            ip_hash=a.ip_hash[:IP_HASH_SHOWN] if a.ip_hash else None,
            created_at=a.created_at,
        )
        for a, name, role in rows
    ]
    return AuditLogList(items=items, total=total, limit=limit, offset=offset)
