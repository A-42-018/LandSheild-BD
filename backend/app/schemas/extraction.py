"""Extraction schema (P27, R4): the 13 extracted fields, their review flags and validation."""
from typing import Any

from ai.extraction.base import EXTRACTION_FIELDS
from pydantic import BaseModel, Field

REQUIRED_FIELDS = (
    "khatian_no", "dag_no", "mouza", "district", "upazila",
    "land_area", "area_unit", "deed_no", "seller", "buyer",
)  # fmt: skip
# khatian / porcha (survey records): no deed, so no deed number / seller / buyer / area to demand
SURVEY_REQUIRED_FIELDS = ("khatian_no", "mouza", "district", "upazila")
SURVEY_DOC_TYPES = ("KHATIAN", "PORCHA")
AREA_UNITS = ("decimal", "katha", "bigha", "acre", "sqft", "sqm")
MAX_VALUE_LEN = 200


class ExtractedField(BaseModel):
    """One extracted value. `confidence` is the model's own and is never changed by an edit."""

    field: str
    value: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source_bbox: list[float] | None = None
    edited_by_human: bool = False


class Extraction(BaseModel):
    """Shape stored in documents.extraction_json (P25 rows without the new keys still load)."""

    provider: str = "unknown"
    ocr_source: str | None = None  # demo | pdf-text | tesseract | mock (O1)
    extractor: str | None = None  # rules | claude | mock (O3)
    model: str | None = None  # LLM model name when extractor == "claude"
    warnings: list[str] = Field(default_factory=list)  # PAGES_TRUNCATED, CLAUDE_FALLBACK:<why>
    fields: list[ExtractedField] = Field(default_factory=list)
    edited_by_human: bool = False
    original_fields: list[ExtractedField] | None = None  # snapshot taken before the first edit
    survey_type: str | None = None  # khatian / porcha: CS | SA | RS | BS (None = not read)
    extras: dict[str, Any] | None = None  # khatian: jl_no, owners + shares, dags
    # H3 (D1): deeds stay document_type DEED; the classifier's verdict lives here (None = not run:
    # khatian / porcha, or rows from before H3). deed_class: kind, era, score, year, signals.
    deed_profile: str | None = None  # modern | historical
    deed_class: dict[str, Any] | None = None
    ocr_profile: str | None = None  # Tesseract profile that produced the text (None = no image OCR)

    def dump(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


class FieldError(BaseModel):
    field: str
    code: str  # REQUIRED NOT_A_NUMBER NOT_POSITIVE INVALID_DATE DATE_IN_FUTURE INVALID_UNIT ...
    params: dict[str, Any] | None = None


class ExtractionValidation(BaseModel):
    valid: bool
    errors: list[FieldError]


class ExtractedFieldOut(ExtractedField):
    low_confidence: bool  # confidence < REVIEW_CONF_THRESHOLD and not corrected by a human


class ExtractionOut(BaseModel):
    document_id: str
    processing_status: str
    provider: str
    ocr_source: str | None = None
    extractor: str | None = None
    model: str | None = None
    warnings: list[str] = Field(default_factory=list)
    deed_profile: str | None = None  # H3: modern | historical (None = not classified)
    deed_class: dict[str, Any] | None = None
    ocr_profile: str | None = None
    threshold: float
    fields: list[ExtractedFieldOut]
    edited_by_human: bool
    has_low_confidence: bool
    low_confidence_fields: list[str]
    validation: ExtractionValidation
    original_fields: list[ExtractedField] | None = None
    # viewer uploaded this document and is not ADMIN: approve is refused (SELF_APPROVAL_FORBIDDEN)
    self_approval_blocked: bool = False


class FieldEdit(BaseModel):
    field: str
    value: str | None = None


class ExtractionPatch(BaseModel):
    fields: list[FieldEdit] = Field(min_length=1, max_length=len(EXTRACTION_FIELDS))
