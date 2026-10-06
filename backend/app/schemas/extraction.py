"""Extraction schema (P27, R4): the 13 extracted fields, their review flags and validation."""
from typing import Any

from ai.extraction.base import EXTRACTION_FIELDS
from pydantic import BaseModel, Field

REQUIRED_FIELDS = (
    "khatian_no", "dag_no", "mouza", "district", "upazila",
    "land_area", "area_unit", "deed_no", "seller", "buyer",
)  # fmt: skip
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
    fields: list[ExtractedField] = Field(default_factory=list)
    edited_by_human: bool = False
    original_fields: list[ExtractedField] | None = None  # snapshot taken before the first edit
    survey_type: str | None = None  # khatian / porcha: CS | SA | RS | BS (None = not read)
    extras: dict[str, Any] | None = None  # khatian: jl_no, owners + shares, dags

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
    threshold: float
    fields: list[ExtractedFieldOut]
    edited_by_human: bool
    has_low_confidence: bool
    low_confidence_fields: list[str]
    validation: ExtractionValidation
    original_fields: list[ExtractedField] | None = None


class FieldEdit(BaseModel):
    field: str
    value: str | None = None


class ExtractionPatch(BaseModel):
    fields: list[FieldEdit] = Field(min_length=1, max_length=len(EXTRACTION_FIELDS))
