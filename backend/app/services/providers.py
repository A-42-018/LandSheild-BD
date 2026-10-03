"""Provider selection from env (R8: OCR_PROVIDER, DOCUMENT_AI_PROVIDER).

`ai/` lives at the repo root (R1), outside the backend package, so its parent is put on
sys.path when needed. OCR: mock | tesseract (P39; falls back to mock, logged, when
Tesseract is unavailable). Document AI: mock | rules (P40).
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

from ai.extraction.base import DocumentAIProvider  # noqa: E402
from ai.extraction.mock import MockDocumentAIProvider  # noqa: E402
from ai.extraction.rules import RuleBasedDocumentAIProvider  # noqa: E402
from ai.ocr.base import OCRProvider  # noqa: E402
from ai.ocr.mock import MockOCRProvider  # noqa: E402
from ai.ocr.tesseract import TesseractOCRProvider, is_available  # noqa: E402

logger = logging.getLogger("landshield.providers")

_ON = {"on", "true", "1", "yes"}  # same flag values as ai.preprocessing (cv2 not imported here)
KNOWN_OCR = ("mock", "tesseract", "paddle")
KNOWN_AI = ("mock", "rules", "vlm", "remote")


@dataclass(frozen=True)
class Providers:
    ocr: OCRProvider
    ai: DocumentAIProvider


def _unavailable(kind: str, value: str, known: tuple[str, ...]) -> AppError:
    code = "PROVIDER_NOT_AVAILABLE" if value in known else "PROVIDER_UNKNOWN"
    return AppError(code, f"{kind} provider '{value}' is not available", 503, {"provider": value})


def get_providers(settings: Settings) -> Providers:
    ocr_name = settings.ocr_provider.strip().lower()
    ai_name = settings.document_ai_provider.strip().lower()
    ocr: OCRProvider
    if ocr_name == "mock":
        ocr = MockOCRProvider()
    elif ocr_name == "tesseract":
        if is_available():
            ocr = TesseractOCRProvider(
                lang=settings.tesseract_lang, preprocess=settings.preprocess.strip().lower() in _ON
            )
        else:
            logger.warning("ocr_fallback_to_mock", extra={"requested": "tesseract"})
            ocr = MockOCRProvider()
    else:
        raise _unavailable("OCR", ocr_name, KNOWN_OCR)  # paddle: P42
    doc_ai: DocumentAIProvider
    if ai_name == "mock":
        doc_ai = MockDocumentAIProvider()
    elif ai_name == "rules":
        doc_ai = RuleBasedDocumentAIProvider()
    else:
        raise _unavailable("Document AI", ai_name, KNOWN_AI)  # vlm/remote: P42
    return Providers(ocr=ocr, ai=doc_ai)
