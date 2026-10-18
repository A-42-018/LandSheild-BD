"""Digital record versions (H5): document_records rows as the API shows them."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel


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
