from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.land import LandPublic
from app.schemas.ownership import OwnershipEntry, TransactionEntry
from app.schemas.risk import EvidenceOut


class VerificationCreate(BaseModel):
    land_id: str = Field(min_length=1, max_length=50)


class VerificationOut(BaseModel):
    id: str
    land_id: str
    status: str
    risk_score: int | None = None
    risk_level: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class DocumentConsistency(BaseModel):
    status: str  # NO_ISSUES | INCONSISTENCIES_FOUND (language-neutral codes)
    total_documents: int
    by_status: dict[str, int]
    indicators: list[EvidenceOut]


class VerificationReport(BaseModel):
    verification_id: str
    land_id: str
    verification_status: str
    overall_status: str  # land status code
    risk_score: int
    risk_level: str
    land: LandPublic
    ownership: list[OwnershipEntry]
    document_consistency: DocumentConsistency
    transactions: list[TransactionEntry]
    evidence: list[EvidenceOut]
    disclaimer_code: str
    verified_at: datetime
