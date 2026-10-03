"""PDF -> image (PyMuPDF). Imported lazily so the package works without PyMuPDF installed."""
from __future__ import annotations

import numpy as np

from ai.ocr.base import ProviderError


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
