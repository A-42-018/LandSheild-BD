"""Digital record versions (H5): document_records rows as the API shows them."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.officer import ActivityActor


class RecordVersionOut(BaseModel):
    document_id: str
    version: int
    status: str  # MACHINE | DRAFT | APPROVED | SUPERSEDED
    record_schema: str  # lhdr/1 | core/1
    created_by: str | None = None  # user name; None = the extraction job
    created_at: datetime
    updated_at: datetime
    approved_by: str | None = None
    approved_at: datetime | None = None
    record_hash: str | None = None
    signature: str | None = None
    signature_status: str  # VALID | INVALID | UNSIGNED
    file_hash: str  # SHA-256 of the original upload; part of the signed payload
    record: dict[str, Any] | None = None  # the record itself (single-version reads only)


class RecordVersionList(BaseModel):
    document_id: str
    file_hash: str
    items: list[RecordVersionOut]


# ---- H7b: who changed what, per version (read from the audit log) -------------------------------


class RecordChange(BaseModel):
    """One changed value. Values are shortened to text (200 characters) for the history view."""

    path: str  # JSON pointer of an LHDR record (/schedule/0/khatian_no) or a flat field name
    op: str | None = None  # replace | add | remove (record edits only)
    old: str | None = None
    new: str | None = None


class RecordHistoryEvent(BaseModel):
    kind: str  # CREATED | EDIT | CORRECTION_START | BASELINE | APPROVE
    at: datetime
    actor: ActivityActor | None = None  # None = the extraction job
    changes: list[RecordChange] = []  # EDIT only


class RecordHistoryVersion(BaseModel):
    version: int
    status: str  # MACHINE | DRAFT | APPROVED | SUPERSEDED
    record_schema: str
    events: list[RecordHistoryEvent]  # oldest first; the first one is CREATED


class RecordHistory(BaseModel):
    document_id: str
    versions: list[RecordHistoryVersion]
