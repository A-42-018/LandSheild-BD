"""PDF -> image (PyMuPDF). Imported lazily so the package works without PyMuPDF installed."""
from __future__ import annotations

import numpy as np

from ai.ocr.base import ProviderError


def pdf_page_count(data: bytes) -> int:
    try:
        import pymupdf  # noqa: PLC0415

        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return doc.page_count
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise ProviderError("PREPROCESS_DEPENDENCY_MISSING", "PyMuPDF is not installed") from exc
    except Exception as exc:
        raise ProviderError("PDF_RENDER_FAILED", "could not read PDF") from exc


def pdf_text_layer(data: bytes, max_pages: int = 5) -> str | None:
    """Embedded text of the first `max_pages` pages, or None when unreadable / no PyMuPDF."""
    try:
        import pymupdf  # noqa: PLC0415

        with pymupdf.open(stream=data, filetype="pdf") as doc:
            pages = [doc[i].get_text() for i in range(min(doc.page_count, max_pages))]
    except Exception:  # not a PDF, encrypted, PyMuPDF missing: caller falls through to OCR
        return None
    text = "\n".join(p.strip() for p in pages).strip()
    return text or None


def pdf_to_array(data: bytes, page: int = 0, dpi: int = 200) -> np.ndarray:
    """Render one PDF page to a grayscale uint8 array (errors -> ProviderError)."""
    try:
        import pymupdf  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise ProviderError("PREPROCESS_DEPENDENCY_MISSING", "PyMuPDF is not installed") from exc
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            if page >= doc.page_count:
                raise ProviderError("PDF_RENDER_FAILED", "page out of range")
            pix = doc[page].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY, alpha=False)
            return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
    except ProviderError:
        raise
    except Exception as exc:
        raise ProviderError("PDF_RENDER_FAILED", "could not render PDF") from exc
