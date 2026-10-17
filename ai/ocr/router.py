"""Auto OCR router (O1, H2): demo fixture -> checked PDF text layer -> Tesseract. Never a mock.

1. DEMO_FIXTURES on and the file is one of the saved demo samples (exact SHA-256) -> stored
   result, provider "demo".
2. PDF with an embedded text layer (>= 50 non-space characters) that passes the quality gate
   (`ai.ocr.quality`, H2) -> that text, provider "pdf-text", confidence 0.99 x quality score.
   Ruled tables come from PyMuPDF's table finder on the same page.
3. Tesseract when installed -> provider "tesseract". When a text layer existed but failed the
   gate, both are scored and the better one is kept: Tesseract (only with >= 50 characters) with
   warning TEXT_LAYER_REJECTED, or the layer with warning TEXT_LAYER_SUSPECT.
4. A failed text layer with no Tesseract is still returned (TEXT_LAYER_SUSPECT, low confidence):
   a reviewer sees every field anyway, and nothing is better than refusing the document.
5. Otherwise ProviderError("OCR_UNAVAILABLE").
"""
from __future__ import annotations

from dataclasses import replace

from ai.mock_fixtures import is_demo_fixture
from ai.ocr import quality
from ai.ocr import tesseract as tess
from ai.ocr.base import OCRResult, ProviderError
from ai.ocr.mock import MockOCRProvider
from ai.preprocessing.pdf import pdf_tables, pdf_text_layer

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
        profile: str = "modern",
    ) -> None:
        self.demo_fixtures = demo_fixtures
        self.lang = lang
        self.preprocess = preprocess
        self.timeout_s = timeout_s
        self.max_pages = max_pages
        self.profile = profile

    def _text_layer(self, data: bytes) -> tuple[OCRResult, quality.Quality] | None:
        text = pdf_text_layer(data, self.max_pages)
        if not text or len("".join(text.split())) < MIN_TEXT_CHARS:
            return None
        q = quality.assess(text)
        res = OCRResult(
            text=text, confidence=round(PDF_TEXT_CONFIDENCE * q.score, 4), provider="pdf-text"
        )
        return res, q

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        if self.demo_fixtures and is_demo_fixture(data):
            return replace(MockOCRProvider().recognize(data, file_type), provider="demo")
        layer = self._text_layer(data) if file_type.lower() == "pdf" else None
        if layer and layer[1].ok:
            return replace(layer[0], tables=pdf_tables(data, self.max_pages))
        if tess.is_available():
            ocr = tess.TesseractOCRProvider(
                lang=self.lang,
                preprocess=self.preprocess,
                timeout_s=self.timeout_s,
                max_pages=self.max_pages,
                profile=self.profile,
            ).recognize(data, file_type)
            if layer is None:
                return ocr
            has_text = len("".join(ocr.text.split())) >= MIN_TEXT_CHARS  # empty OCR scores 1.0
            if has_text and quality.better(quality.assess(ocr.text), layer[1]):
                return replace(ocr, warnings=(*ocr.warnings, "TEXT_LAYER_REJECTED"))
        if layer:
            return replace(
                layer[0], warnings=("TEXT_LAYER_SUSPECT",), tables=pdf_tables(data, self.max_pages)
            )
        raise ProviderError("OCR_UNAVAILABLE", "Tesseract is not installed")
