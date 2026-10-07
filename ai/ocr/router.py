"""Auto OCR router (O1): demo fixture -> PDF text layer -> Tesseract. Never a silent mock.

1. DEMO_FIXTURES on and the file is one of the saved demo samples (exact SHA-256) -> stored
   result, provider "demo".
2. PDF with an embedded text layer (>= 50 non-space characters) -> that text, provider "pdf-text".
3. Tesseract when installed -> provider "tesseract".
4. Otherwise ProviderError("OCR_UNAVAILABLE").
"""
from __future__ import annotations

from dataclasses import replace

from ai.mock_fixtures import is_demo_fixture
from ai.ocr import tesseract as tess
from ai.ocr.base import OCRResult, ProviderError
from ai.ocr.mock import MockOCRProvider
from ai.preprocessing.pdf import pdf_text_layer

MIN_TEXT_CHARS = 50
PDF_TEXT_CONFIDENCE = 0.99


class AutoOCRProvider:
    name = "auto"

    def __init__(
        self,
        *,
        demo_fixtures: bool = True,
        lang: str = tess.DEFAULT_LANG,
        preprocess: bool = True,
        timeout_s: int = 30,
        max_pages: int = 5,
    ) -> None:
        self.demo_fixtures = demo_fixtures
        self.lang = lang
        self.preprocess = preprocess
        self.timeout_s = timeout_s
        self.max_pages = max_pages

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        if self.demo_fixtures and is_demo_fixture(data):
            return replace(MockOCRProvider().recognize(data, file_type), provider="demo")
        if file_type.lower() == "pdf":
            text = pdf_text_layer(data, self.max_pages)
            if text and len("".join(text.split())) >= MIN_TEXT_CHARS:
                return OCRResult(text=text, confidence=PDF_TEXT_CONFIDENCE, provider="pdf-text")
        if tess.is_available():
            return tess.TesseractOCRProvider(
                lang=self.lang,
                preprocess=self.preprocess,
                timeout_s=self.timeout_s,
                max_pages=self.max_pages,
            ).recognize(data, file_type)
        raise ProviderError("OCR_UNAVAILABLE", "Tesseract is not installed")
