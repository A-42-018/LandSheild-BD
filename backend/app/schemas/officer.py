from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class QueueFilter(StrEnum):
    PENDING = "pending"
    LOW_CONFIDENCE = "low_confidence"
    HIGH_RISK = "high_risk"
    RECENT = "recent"


class QueueSort(StrEnum):
    CREATED_AT = "created_at"
    STATUS = "status"
    LAND_ID = "land_id"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class OfficerStats(BaseModel):
    total_records: int
    pending_review: int
    high_risk: int
    verified: int
    open_alerts: int = 0
    pending_mutations: int = 0
    active_encumbrances: int = 0
    ledger_status: str = "INTACT"  # INTACT | BROKEN (status + entry count only, no detail)
    ledger_entries: int = 0


class QueueItem(BaseModel):
    id: str  # document id (needed to open /officer/review/{id})
    land_id: str | None
    document_type: str
    processing_status: str
    min_confidence: float | None
    low_confidence: bool
    high_risk: bool
    created_at: datetime


class QueueList(BaseModel):
    items: list[QueueItem]
    total: int
    limit: int
    offset: int


class ActivityActor(BaseModel):
    name: str
    role: str


class ActivityItem(BaseModel):
    id: str
    action: str
    entity_type: str
    actor: ActivityActor | None
    created_at: datetime


class ActivityList(BaseModel):
    items: list[ActivityItem]
    total: int
    limit: int
    offset: int
