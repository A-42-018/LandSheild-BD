"""Provider selection from env (R8: OCR_PROVIDER, DOCUMENT_AI_PROVIDER).

`ai/` lives at the repo root (R1), outside the backend package, so its parent is put on
sys.path when needed.

OCR: auto (demo fixture -> pdf-text -> Tesseract, O1) | tesseract (no mock fallback) | mock (tests).
Document AI: auto (Claude when ANTHROPIC_API_KEY is set, else rules; demo samples keep their
stored result) | rules | claude (falls back to rules on any failure) | mock (tests).
"""
import logging
import sys
from dataclasses import dataclass
from pathlib import Path

from app.core.config import Settings
from app.core.errors import AppError

_REPO_ROOT = str(Path(__file__).resolve().parents[3])
if _REPO_ROOT not in sys.path:
    sys.path.append(_REPO_ROOT)

from ai.extraction.base import DocumentAIProvider, ExtractionResult  # noqa: E402
from ai.extraction.claude import ClaudeDocumentAIProvider  # noqa: E402
from ai.extraction.mock import MockDocumentAIProvider  # noqa: E402
from ai.extraction.rules import RuleBasedDocumentAIProvider  # noqa: E402
from ai.mock_fixtures import is_demo_fixture  # noqa: E402
from ai.ocr.base import OCRProvider, OCRResult  # noqa: E402
from ai.ocr.mock import MockOCRProvider  # noqa: E402
from ai.ocr.router import AutoOCRProvider  # noqa: E402
from ai.ocr.tesseract import TesseractOCRProvider, is_available  # noqa: E402

logger = logging.getLogger("landshield.providers")

_ON = {"on", "true", "1", "yes"}  # same flag values as ai.preprocessing (cv2 not imported here)
KNOWN_OCR = ("auto", "mock", "tesseract", "paddle")
KNOWN_AI = ("auto", "mock", "rules", "claude", "vlm", "remote")


@dataclass(frozen=True)
class Providers:
    ocr: OCRProvider
    ai: DocumentAIProvider


class AutoDocumentAIProvider:
    """Saved demo samples keep their stored fields (DEMO_FIXTURES on); everything else goes to
    `primary` (Claude with rules fallback, or rules alone)."""

    name = "auto"

    def __init__(self, primary: DocumentAIProvider, demo_fixtures: bool) -> None:
        self.primary = primary
        self.demo_fixtures = demo_fixtures

    def extract(self, data: bytes, ocr: OCRResult) -> ExtractionResult:
        if self.demo_fixtures and ocr.provider == "demo" and is_demo_fixture(data):
            return MockDocumentAIProvider().extract(data, ocr)
        return self.primary.extract(data, ocr)


def _unavailable(kind: str, value: str, known: tuple[str, ...]) -> AppError:
    code = "PROVIDER_NOT_AVAILABLE" if value in known else "PROVIDER_UNKNOWN"
    return AppError(code, f"{kind} provider '{value}' is not available", 503, {"provider": value})


def _claude(settings: Settings) -> ClaudeDocumentAIProvider:
    return ClaudeDocumentAIProvider(
        settings.anthropic_api_key,
        settings.claude_model,
        timeout_s=settings.claude_timeout_s,
        daily_cap=settings.claude_daily_cap,
        cache_dir=Path(settings.storage_path) / "claude_cache",
    )


def get_providers(settings: Settings) -> Providers:
    ocr_name = settings.ocr_provider.strip().lower()
    ai_name = settings.document_ai_provider.strip().lower()
    demo = settings.demo_fixtures.strip().lower() in _ON
    preprocess = settings.preprocess.strip().lower() in _ON
    ocr: OCRProvider
    if ocr_name == "mock":
        ocr = MockOCRProvider()
    elif ocr_name == "auto":
        ocr = AutoOCRProvider(
            demo_fixtures=demo,
            lang=settings.tesseract_lang,
            preprocess=preprocess,
            timeout_s=settings.ocr_timeout_s,
            max_pages=settings.ocr_max_pages,
        )
    elif ocr_name == "tesseract":
        if not is_available():
            raise AppError("OCR_UNAVAILABLE", "Tesseract is not installed", 503)
        ocr = TesseractOCRProvider(
            lang=settings.tesseract_lang,
            preprocess=preprocess,
            timeout_s=settings.ocr_timeout_s,
            max_pages=settings.ocr_max_pages,
        )
    else:
        raise _unavailable("OCR", ocr_name, KNOWN_OCR)  # paddle: P42
    doc_ai: DocumentAIProvider
    if ai_name == "mock":
        doc_ai = MockDocumentAIProvider()
    elif ai_name == "rules":
        doc_ai = RuleBasedDocumentAIProvider()
    elif ai_name == "claude":
        doc_ai = _claude(settings)
    elif ai_name == "auto":
        primary: DocumentAIProvider = (
            _claude(settings) if settings.anthropic_api_key else RuleBasedDocumentAIProvider()
        )
        doc_ai = AutoDocumentAIProvider(primary, demo)
    else:
        raise _unavailable("Document AI", ai_name, KNOWN_AI)  # vlm/remote: P42
    return Providers(ocr=ocr, ai=doc_ai)
