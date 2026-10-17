"""PDF -> image (PyMuPDF). Imported lazily so the package works without PyMuPDF installed."""
from __future__ import annotations

import contextlib
import io

import numpy as np

from ai.ocr.base import OCRCell, OCRTable, ProviderError

TABLE_DPI = 200  # pdf_tables() boxes are pixels at the dpi the OCR path renders pages at


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


def pdf_tables(data: bytes, max_pages: int = 5) -> tuple[OCRTable, ...]:
    """Ruled tables of a PDF with a text layer (PyMuPDF table finder), in the same shape as the
    OCR path's: cell boxes in pixels at TABLE_DPI, pages stacked vertically. () on any error."""
    try:
        import pymupdf  # noqa: PLC0415

        out: list[OCRTable] = []
        k = TABLE_DPI / 72
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            offset = 0.0
            for i in range(min(doc.page_count, max_pages)):
                page = doc[i]
                with contextlib.redirect_stdout(io.StringIO()):  # it prints an advert line
                    found = page.find_tables().tables
                for t in found:
                    out.append(_table(t, i, k, offset))
                offset += round(page.rect.height * k)
        return tuple(out)
    except Exception:  # no PyMuPDF, damaged PDF, old PyMuPDF without find_tables
        return ()


def _table(t, page: int, k: float, offset: float) -> OCRTable:
    def px(b) -> tuple[int, int, int, int]:
        x0, y0, x1, y1 = b
        return (round(x0 * k), round(y0 * k + offset), round((x1 - x0) * k), round((y1 - y0) * k))

    texts = t.extract()
    rows = [r.cells for r in t.rows]
    cells = []
    for r, row in enumerate(rows):
        for c, box in enumerate(row):
            if box is None:
                continue
            colspan = 1
            while c + colspan < len(row) and row[c + colspan] is None:
                colspan += 1
            rowspan = 1
            below = [row_[c] if c < len(row_) else box for row_ in rows[r + 1 :]]
            while rowspan <= len(below) and below[rowspan - 1] is None:
                rowspan += 1
            text = " ".join((texts[r][c] or "").split())
            cells.append(OCRCell(r, c, text, 1.0 if text else 0.0, px(box), colspan, rowspan))
    return OCRTable(page, px(t.bbox), t.row_count, t.col_count, tuple(cells))


def pdf_to_array(data: bytes, page: int = 0, dpi: int = 200, color: bool = False) -> np.ndarray:
    """Render one PDF page to a uint8 array: grayscale (h, w), or RGB (h, w, 3) with `color`
    (errors -> ProviderError)."""
    try:
        import pymupdf  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise ProviderError("PREPROCESS_DEPENDENCY_MISSING", "PyMuPDF is not installed") from exc
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            if page >= doc.page_count:
                raise ProviderError("PDF_RENDER_FAILED", "page out of range")
            cs = pymupdf.csRGB if color else pymupdf.csGRAY
            pix = doc[page].get_pixmap(dpi=dpi, colorspace=cs, alpha=False)
            shape = (pix.height, pix.width, 3) if color else (pix.height, pix.width)
            return np.frombuffer(pix.samples, dtype=np.uint8).reshape(shape).copy()
    except ProviderError:
        raise
    except Exception as exc:
        raise ProviderError("PDF_RENDER_FAILED", "could not render PDF") from exc
