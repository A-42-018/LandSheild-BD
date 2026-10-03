"""Mock OCR: returns fixture ground truth (offline, deterministic)."""
from ai.mock_fixtures import find_fixture
from ai.ocr.base import OCRResult, ProviderError


class MockOCRProvider:
    name = "mock"

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        fx = find_fixture(data)
        if fx is None:
            raise ProviderError("NO_MOCK_FIXTURE", "No mock ground truth for this file")
        return OCRResult(
            text=fx["ocr_text"], confidence=float(fx["ocr_confidence"]), provider=self.name
        )
