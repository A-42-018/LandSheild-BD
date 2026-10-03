from datetime import datetime

from pydantic import BaseModel, field_validator

DOCUMENT_TYPES = ("DEED", "KHATIAN", "MUTATION", "OTHER")


class DocumentOut(BaseModel):
    """Public view of a document; never exposes file_path (server-only) or uploader."""

    id: str
    land_id: str | None = None  # LP-xxxxx
    document_type: str
    processing_status: str
    file_hash: str  # sha256 of the stored bytes
    file_type: str  # jpg | png | pdf
    created_at: datetime


class DocumentUploadOut(DocumentOut):
    duplicate: bool = False  # True: identical bytes already stored; nothing new was saved


class RejectBody(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("reason must not be empty")
        if len(v) > 500:
            raise ValueError("reason too long")
        return v
