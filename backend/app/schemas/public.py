from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PublicCounts(BaseModel):
    ownership_records: int
    transactions: int
    flagged_transactions: int
    open_alerts: int
    active_encumbrances: int = 0
    pending_mutations: int = 0


class PublicVerify(BaseModel):
    """PublicSafe payload (R4): no names, hashes, ids, file paths or evidence details."""

    land_id: str
    district: str
    upazila: str
    mouza: str
    status: str
    risk_level: str
    counts: PublicCounts
    last_verified_at: datetime | None = None


class PublicLandSummary(BaseModel):
    """Masked search result (U2.1): owners as "R*** U***" only; no father name, NID, deeds or ids.
    Full records stay behind sign-in (`/lands/*`)."""

    land_id: str
    district: str
    upazila: str
    mouza: str
    khatian_no: str
    dag_no: str
    area: float
    area_unit: str
    status: str
    risk_level: str
    owner_count: int
    owners_masked: list[str]
    open_case: bool  # an ACTIVE court case is recorded against the parcel
    counts: PublicCounts


class PublicKey(BaseModel):
    algorithm: str
    public_key: str
    key_id: str


class PublicSeal(BaseModel):
    """Latest signed deed of a parcel: random id + 12-char hash prefix (no names, no full hash)."""

    deed_id: str
    hash12: str


class PublicSignature(BaseModel):
    state: str  # VALID | INVALID | UNSIGNED | NOT_FOUND


class DocumentVerifyBody(BaseModel):
    deed_no: str = Field(min_length=1, max_length=100)
    fields: dict[str, str | None] = Field(default_factory=dict, max_length=20)


class DocumentVerifyOut(BaseModel):
    """AUTHENTIC | ALTERED | NOT_FOUND | UNREADABLE. `differing`: field names only."""

    state: str
    match: str | None = None  # FILE (identical bytes) | CONTENT (same fields)
    differing: list[str] = Field(default_factory=list)


class PublicMutationStep(BaseModel):
    step: str  # APPLIED | REVIEW | HEARING | DECIDED
    state: str  # done | current | pending | skipped
    at: datetime | None = None


class PublicMutationStatus(BaseModel):
    """Citizen tracker (F2c): status + step dates + office only. No names, land id or documents."""

    mutation_no: str
    status: str
    fast_track: bool
    office: str | None = None
    applied_at: datetime
    days_pending: int | None = None  # None once decided
    steps: list[PublicMutationStep]


class RecordVerifyBody(BaseModel):
    """A digital-record JSON file as downloaded (H8b). Only its shape is checked here; the
    content is checked against the signature."""

    format: str = Field(max_length=50)
    document: dict[str, Any]
    version: int
    status: str | None = None
    draft: bool | None = None
    record_schema: str = Field(max_length=50)
    created_at: str | None = None
    integrity: dict[str, Any]
    record: dict[str, Any]


class PublicRecord(BaseModel):
    """H8d: what the QR page of a digital record shows. No names, ids of people or field values."""

    state: str  # VALID | INVALID  (stored hash + signature re-checked on every read)
    deed_no: str | None = None
    version: int
    approved_at: datetime | None = None
    superseded: bool = False  # a newer approved version exists


class RecordVerifyOut(BaseModel):
    state: str  # VALID | INVALID  (nothing else is returned: no names, ids or values)
