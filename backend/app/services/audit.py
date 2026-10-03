"""Audit helper (R2/R4): writes audit_logs rows; client IP is stored only as a salted hash."""
import hashlib
import hmac
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.audit import AuditLog
from app.models.user import User


def hash_ip(ip: str | None, salt: str | None = None) -> str | None:
    if not ip:
        return None
    key = (get_settings().hash_salt if salt is None else salt).encode()
    return hmac.new(key, ip.strip().encode(), hashlib.sha256).hexdigest()


def log(
    db: Session,
    actor: User | str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    old: Any = None,
    new: Any = None,
    ip: str | None = None,
) -> AuditLog:
    """Add an audit row to the session (caller commits, so it shares the caller's transaction)."""
    actor_id = actor.id if isinstance(actor, User) else actor
    row = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old,
        new_value=new,
        ip_hash=hash_ip(ip),
    )
    db.add(row)
    db.flush()
    return row
