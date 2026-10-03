from datetime import datetime

from pydantic import BaseModel

from app.schemas.officer import ActivityActor


class AuditLogItem(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str | None
    actor: ActivityActor | None
    ip_hash: str | None  # truncated (first 8 hex chars); full hash never exposed
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogItem]
    total: int
    limit: int
    offset: int
