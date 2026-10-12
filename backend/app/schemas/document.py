from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

DOCUMENT_TYPES = ("DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER")


class OfficeBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    office_type: str
    name_en: str
    name_bn: str
    division_en: str
    division_bn: str
    district_en: str
    district_bn: str
    upazila_en: str | None = None
    upazila_bn: str | None = None


class DocumentOut(BaseModel):
    """Public view of a document; never exposes file_path (server-only) or uploader."""

    id: str
    land_id: str | None = None  # LP-xxxxx
    document_type: str
    processing_status: str
    file_hash: str  # sha256 of the stored bytes
    file_type: str  # jpg | png | pdf
    created_at: datetime
    failure_code: str | None = None  # status FAILED: OCR_UNAVAILABLE, OCR_TIMEOUT, ...
    office: OfficeBrief | None = None  # the land office whose database holds this document


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
