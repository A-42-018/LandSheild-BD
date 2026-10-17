from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    # last four digits of the NID entered for each deed party, e.g. {"buyer": "4821"}
    party_nids: dict[str, str] = Field(default_factory=dict)


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


class ReprocessBody(BaseModel):
    """Optional body of POST /reprocess. `profile` forces the deed's Tesseract profile instead of
    OCR_PROFILE (the reviewer's modern <-> historical switch, H3 D1); omitted = detect again."""

    model_config = ConfigDict(extra="forbid")

    profile: Literal["modern", "historical"] | None = None


class PartyNidIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nid: str = Field(min_length=1, max_length=40)
    date_of_birth: date


class PartyNidsPatch(BaseModel):
    """Omitted party = unchanged; null = clear it."""

    model_config = ConfigDict(extra="forbid")

    buyer: PartyNidIn | None = None
    seller: PartyNidIn | None = None
