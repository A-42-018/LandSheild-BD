"""Text clean-up for Bangla OCR output (O2). Pure functions, no dependencies.

`text()` is safe for any field; `number()` converts Bangla digits and must only be applied to
numeric fields (khatian, dag, area, deed number, dates), never to names.
"""
from __future__ import annotations

import re
import unicodedata

BN_TO_EN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿"))  # ZWSP ZWNJ ZWJ WJ BOM
_BN_NUM_SEP = str.maketrans({"،": ",", "٫": ".", "．": "."})

# frequent Tesseract slips on printed Bangla labels -> canonical label (whole words only)
LABEL_FIXES: dict[str, str] = {
    "খতিয়ন": "খতিয়ান", "খতীয়ান": "খতিয়ান", "খতিয়াণ": "খতিয়ান",
    "মোজা": "মৌজা", "দাগনং": "দাগ নং", "খতিয়াননং": "খতিয়ান নং",
    "জেএল": "জে.এল.", "জে.এল": "জে.এল.",
}  # fmt: skip
_LABEL_RE = re.compile(
    "|".join(re.escape(k) for k in sorted(LABEL_FIXES, key=len, reverse=True)), re.UNICODE
)


def text(s: str | None) -> str:
    """NFC, zero-width characters removed, spaces collapsed per line, common label slips fixed."""
    if not s:
        return ""
    s = unicodedata.normalize("NFC", s).translate(_ZERO_WIDTH)
    s = _LABEL_RE.sub(lambda m: LABEL_FIXES[m.group(0)], s)
    return "\n".join(re.sub(r"[ \t ]+", " ", ln).strip() for ln in s.splitlines()).strip()


def number(s: str | None) -> str:
    """Bangla digits -> ASCII and Bangla separators -> ASCII: '১০.৫০' -> '10.50'."""
    if not s:
        return ""
    return unicodedata.normalize("NFC", s).translate(_ZERO_WIDTH).translate(BN_TO_EN).translate(
        _BN_NUM_SEP
    ).strip()
