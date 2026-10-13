"""Alternative readings (O4): other plausible OCR readings of low-confidence image fields.

Full-page OCR reads stylised or handwriting-like values (digits especially) unreliably, and the
alternatives are not a vote: re-reading a crop at higher scale can be *worse* (an upscaled "1" in
some fonts looks like "7"). So this module never replaces a value. It only lists the other readings
the engine produces for the field's crop (same character shape as the current value: digits stay
digits, letters stay letters), so a later step can check them against evidence the pixels cannot
give - the land records.
"""
from __future__ import annotations

import logging
import re
from collections import Counter

from ai.extraction.base import ExtractedField

logger = logging.getLogger("landshield.reread")

FIELDS = frozenset({"deed_no", "khatian_no", "dag_no", "land_area", "mouza"})
MIN_CONF = 0.9
SCALES = (1, 2, 3, 4)
MODES = ((7, "eng"), (8, "eng"), (7, "ben+eng"), (8, "ben+eng"))


def _shape(s: str) -> str:
    return re.sub(r"[A-Za-z]", "A", re.sub(r"\d", "9", s))


def _canon(s: str) -> str:
    return re.sub(r"[()|\[\]{}]", "", " ".join(s.split())).strip(" .,:;_")


def _is_image(data: bytes) -> bool:
    return data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff"


def candidates(data: bytes, fields: list[ExtractedField]) -> dict[str, list[str]]:
    """field -> other readings (most frequent first, current value excluded). Errors give {}."""
    todo = [f for f in fields if f.value and f.source_bbox and f.field in FIELDS and f.confidence < MIN_CONF]
    if not todo or not _is_image(data):
        return {}
    try:
        import cv2
        import numpy as np
        import pytesseract

        from ai.ocr import tesseract as tess

        installed = tess.installed_languages()
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)
        if img is None:
            return {}
        out: dict[str, list[str]] = {}
        for f in todo:
            x, y, w, h = (int(v) for v in f.source_bbox or [])
            crop = img[max(0, y - 12) : y + h + 12, max(0, x - 12) : x + w + 40]
            if crop.size == 0:
                continue
            shape, seen = _shape(f.value or ""), Counter[str]()
            for sc in SCALES:
                big = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
                _, bw = cv2.threshold(big, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                for psm, lang in MODES:
                    if any(part not in installed for part in lang.split("+")):
                        continue
                    text = _canon(pytesseract.image_to_string(bw, lang=lang, config=f"--psm {psm}"))
                    if text and text != f.value and _shape(text) == shape:
                        seen[text] += 1
            if seen:
                out[f.field] = [t for t, _ in seen.most_common()]
        return out
    except Exception:  # an extra opinion must never break extraction
        logger.warning("reread_failed", exc_info=True)
        return {}
