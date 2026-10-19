from datetime import date, datetime
from enum import StrEnum
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


class LandAttachBody(BaseModel):
    land_id: str = Field(min_length=1, max_length=32)  # LP-xxxxx, the land the officer chose


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


# ---- H7a: document library -----------------------------------------------------------------------


class LibraryTab(StrEnum):
    """Tab presets of the library page."""

    MINE = "mine"  # uploaded by me
    OFFICE = "office"  # held by my office and the offices beneath it
    ACTION = "action"  # waiting for me: review I may decide, or my own upload to process / retry


class LibrarySort(StrEnum):
    CREATED_AT = "created_at"  # newest first by default
    STATUS = "status"
    DEED_DATE = "deed_date"  # documents without a deed date always come last


class LibraryItem(BaseModel):
    """One row of the library. No file path, hash or uploader identity (see DocumentOut)."""

    id: str
    land_id: str | None = None  # LP-xxxxx
    document_type: str
    processing_status: str
    file_type: str  # jpg | png | pdf (the preview thumbnail is GET /documents/{id}/file)
    created_at: datetime
    office: OfficeBrief | None = None
    deed_no: str | None = None
    mouza: str | None = None
    deed_date: date | None = None  # ISO date of the deed (the middle of a historical date range)
    deed_profile: str | None = None  # modern | historical (None = not read yet / no profile)
    historical: bool = False
    uploaded_by_me: bool = False
    digitised: bool = False  # an APPROVED digital record exists
    approved_version: int | None = None  # version number of that APPROVED record
    versions: int = 0  # how many record versions the document has (MACHINE, DRAFT, ...)
    needs_my_action: bool = False


class LibraryList(BaseModel):
    items: list[LibraryItem]
    total: int
    limit: int
    offset: int


# ---- H7b: the documents of one land --------------------------------------------------------------


class ApprovedRecordBrief(BaseModel):
    """The latest APPROVED digital record of a document (no record content, no hash of the file)."""

    version: int
    record_schema: str  # lhdr/1 | core/1
    approved_at: datetime | None = None
    approved_by: str | None = None  # user name
    signature_status: str  # VALID | INVALID | UNSIGNED


class ChainLinkBrief(BaseModel):
    """The past chain-of-title link this document created on the land (H9a / H9b). No names."""

    start_date: date | None = None
    end_date: date | None = None


class LandDocumentItem(LibraryItem):
    approved_record: ApprovedRecordBrief | None = None
    chain_link: ChainLinkBrief | None = None  # set when an approved historical deed is a link of the chain


class LandDocuments(BaseModel):
    land_id: str  # LP-xxxxx
    items: list[LandDocumentItem]  # deed date, oldest first; documents without a date come last
    total: int
