"""Document-AI provider interface (D4). Turns OCR output into the 13 R4 fields."""
from dataclasses import dataclass, field
from typing import Protocol

from ai.ocr.base import OCRResult

EXTRACTION_FIELDS = (
    "owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila",
    "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer",
)  # fmt: skip


@dataclass(frozen=True)
class ExtractedField:
    field: str
    value: str | None
    confidence: float  # 0..1
    source_bbox: list[float] | None = None


@dataclass(frozen=True)
class ExtractionResult:
    provider: str
    fields: list[ExtractedField] = field(default_factory=list)
    # document-level data that does not fit the 13 single-valued fields (khatian: survey type, owners, dags)
    extras: dict = field(default_factory=dict)
    model: str | None = None  # LLM model name when provider == "claude"
    warnings: list[str] = field(default_factory=list)  # e.g. CLAUDE_FALLBACK:timeout


class DocumentAIProvider(Protocol):
    name: str

    def extract(self, data: bytes, ocr: OCRResult) -> ExtractionResult: ...
