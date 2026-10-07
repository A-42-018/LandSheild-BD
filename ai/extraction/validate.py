"""Validation of LLM-extracted fields (O3): format checks + cross-check against the OCR text.

A model can invent plausible values, so nothing is trusted on its own word:
- invalid format  -> value None, confidence 0
- value not found in the OCR text (rapidfuzz >= 85 for text, token match for numbers)
  -> confidence x 0.6, which sends it to the reviewer queue
When there is no OCR text (image-only call) the cross-check is skipped.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from rapidfuzz import fuzz

from ai.extraction.base import EXTRACTION_FIELDS, ExtractedField
from ai.extraction.patterns import UNIT_SYNONYMS
from ai.ocr import normalize

FUZZY_MIN = 85
UNFOUND_FACTOR = 0.6
_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y")
_NUMBER = re.compile(r"\d+(?:[/-]\d+)?")  # khatian / dag, e.g. 1245, 12/3
_DEED_NO = re.compile(r"[A-Za-z0-9][A-Za-z0-9/._-]*")  # letters allowed (D-2024-0785), needs a digit
_AREA = re.compile(r"\d+(?:\.\d+)?")
NUMERIC_FIELDS = ("khatian_no", "dag_no", "deed_no", "land_area", "deed_date")


def _clean(v: object) -> str | None:
    if v is None:
        return None
    s = " ".join(str(v).split())
    return s or None


def _format(field: str, value: str) -> str | None:
    """Canonical value, or None when the format is invalid."""
    if field in ("khatian_no", "dag_no"):
        v = normalize.number(value)
        return v if _NUMBER.fullmatch(v) else None
    if field == "deed_no":
        v = normalize.number(value)
        return v if _DEED_NO.fullmatch(v) and any(c.isdigit() for c in v) else None
    if field == "land_area":
        v = normalize.number(value).replace(",", "")
        return v if _AREA.fullmatch(v) and float(v) > 0 else None
    if field == "area_unit":
        return UNIT_SYNONYMS.get(value.strip().casefold())
    if field == "deed_date":
        v = normalize.number(value)
        for fmt in _DATE_FORMATS:
            try:
                d = datetime.strptime(v, fmt).date()
            except ValueError:
                continue
            return d.isoformat() if d <= date.today() else None
        return None
    v = normalize.text(value)
    return v if re.search(r"[A-Za-zঀ-৿]", v) else None


def _found(field: str, value: str, text: str) -> bool:
    if field == "area_unit":
        return True  # canonical English unit; the text may say শতাংশ / decimal / dec
    if field == "deed_date":
        digits = re.findall(r"\d+", value)  # y, m, d of the ISO form
        return all(re.search(rf"(?<!\d)0*{int(x)}(?!\d)", text) for x in digits)
    if field in NUMERIC_FIELDS:
        return re.search(rf"(?<![0-9A-Za-z]){re.escape(value)}(?![0-9A-Za-z])", text) is not None
    return fuzz.partial_ratio(value.casefold(), text.casefold()) >= FUZZY_MIN


def validate(raw: dict[str, tuple[object, object]], ocr_text: str) -> list[ExtractedField]:
    """`raw` maps field -> (value, confidence) as returned by the model; all 13 fields come back."""
    text = normalize.text(ocr_text)
    text_num = normalize.number(text)
    out: list[ExtractedField] = []
    for name in EXTRACTION_FIELDS:
        value, conf = raw.get(name, (None, 0.0))
        value = _clean(value)
        try:
            conf = max(0.0, min(1.0, float(conf)))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            conf = 0.0
        if value is None:
            out.append(ExtractedField(name, None, 0.0))
            continue
        canon = _format(name, value)
        if canon is None:
            out.append(ExtractedField(name, None, 0.0))
            continue
        if text and not _found(name, canon, text_num if name in NUMERIC_FIELDS else text):
            conf *= UNFOUND_FACTOR
        out.append(ExtractedField(name, canon, round(conf, 4)))
    return out
