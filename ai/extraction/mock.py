"""Mock Document-AI: returns fixture fields (offline, deterministic); values kept as stored."""
from ai.extraction.base import EXTRACTION_FIELDS, ExtractedField, ExtractionResult
from ai.mock_fixtures import find_fixture
from ai.ocr.base import OCRResult, ProviderError


class MockDocumentAIProvider:
    name = "mock"

    def extract(self, data: bytes, ocr: OCRResult) -> ExtractionResult:
        fx = find_fixture(data)
        if fx is None:
            raise ProviderError("NO_MOCK_FIXTURE", "No mock ground truth for this file")
        raw = fx["fields"]
        fields = [
            ExtractedField(field=name, value=raw[name][0], confidence=float(raw[name][1]))
            if name in raw
            else ExtractedField(field=name, value=None, confidence=0.0)
            for name in EXTRACTION_FIELDS
        ]
        return ExtractionResult(provider=self.name, fields=fields, extras=dict(fx.get("extras") or {}))
