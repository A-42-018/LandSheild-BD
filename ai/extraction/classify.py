# ruff: noqa: E501
"""Deed profile classifier (H3): is this deed historical (pre-1971) or modern?

`classify(text, tables)` reads OCR text (and the cells of `OCRResult.tables`) and returns a
`DeedClass`: `deed_profile` (modern | historical), `deed_kind` (LHDR `DeedKind`), `era` (LHDR `Era`,
None when nothing tells), `score` (0..1, >= 0.5 means historical), the deed year it found and the
signals that fired. No model: a weighted list of cues, so a reviewer can see why.

Each signal counts once (present or not). Weights were set on the H0 set and the modern samples:
modern deeds also carry most "old-fashioned" words (the 2001 saf-kabala test text has শ্রী, সাং,
দাতা/গ্রহীতা, তফসিল, সি.এস and a Bangla-calendar date), so those are weak. What decides:
- the deed year (Gregorian with a date cue, or a Bangla year with বঙ্গাব্দ/সন/a Bangla month,
  converted +593/+594): latest year <= 1971 is strong for historical, any year >= 1972 strong
  against; both present (a modern deed reciting an old one, or a recent copy of an old deed) leans
  modern and leaves the decision to the vocabulary;
- archaic vocabulary that modern deeds do not use: the কস্য … মিদং formula, রুপি / আনা, পাকিস্তান /
  ভারতীয় nationality, পরগণা, archaic units with a number (কানি, গণ্ডা, কড়া …);
- modern markers against: বাংলাদেশ, a national ID, an RS / BS survey.
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal

from ai.extraction.lhdr import ARCHAIC_UNITS, DeedKind, Era, era_of
from ai.ocr import normalize

Profile = Literal["modern", "historical"]

THRESHOLD = 4.0  # points at which a deed is historical (score 0.5)
SPREAD = 1.5  # points per e-fold of the logistic score
LAST_HISTORICAL_YEAR = 1971


def _rx(pattern: str, flags: int = 0) -> re.Pattern[str]:
    return re.compile(unicodedata.normalize("NFC", pattern), flags)  # OCR text is NFC'd too


_B = r"ঀ-৿"
_D = "[0-9০-৯]"
_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_NOT_B = rf"(?<![{_B}])"  # Python's \b does not work inside Bangla words (vowel signs are not \w)
_END_B = rf"(?![{_B}])"

BANGLA_MONTHS = ("বৈশাখ", "জ্যৈষ্ঠ", "জ্যৈষ্ট", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "কার্ত্তিক",
                 "অগ্রহায়ণ", "অগ্রহায়ন", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র")  # fmt: skip
# Bangla year + 594 in these months (mid-Jan to mid-Apr), + 593 in the others
_LATE_MONTHS = tuple(unicodedata.normalize("NFC", m) for m in ("মাঘ", "ফাল্গুন", "চৈত্র"))
GREGORIAN_MONTHS = ("জানুয়ারি", "জানুয়ারী", "ফেব্রুয়ারি", "ফেব্রুয়ারী", "মার্চ", "এপ্রিল", "মে", "জুন",
                    "জুলাই", "আগস্ট", "আগষ্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
                    "january", "february", "march", "april", "may", "june", "july", "august",
                    "september", "october", "november", "december",
                    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec")  # fmt: skip

_YEAR = re.compile(rf"(?<![0-9০-৯])({_D}{{4}})(?![0-9০-৯])")
_BN_AFTER = _rx(r"\s*(?:বঙ্গাব্দ|বাংলা\s*সন|বাং|সনে?র?|সালে?র?|ব\.|বাংলা)")
_BN_BEFORE = _rx(rf"(?:{'|'.join(BANGLA_MONTHS)}|সন|বঙ্গাব্দ)[\s,.:ঃ-]*$")
_GR_AFTER = _rx(r"\s*(?:সালে?র?|সনে?র?|ইং|ইংরেজি|খ্রি|খৃ|খ্রী|a\.?\s?d\b)", re.I)
_GR_BEFORE = _rx(
    rf"(?:(?:{'|'.join(GREGORIAN_MONTHS)})[\s,.]*|{_D}{{1,2}}[./-]{_D}{{1,2}}[./-]|/|তারিখ\W{{0,12}}|date\W{{0,12}})$", re.I
)
_ISO_AFTER = re.compile(rf"-{_D}{{1,2}}-{_D}{{1,2}}")  # 2024-02-12

_ARCHAIC_UNIT_WORDS = sorted(
    {s for u, ss in ARCHAIC_UNITS.items() if u != "chatak" for s in ss if not s.isascii()}, key=len, reverse=True
)  # ছটাক is still used with কাঠা on modern Dhaka deeds


# (code, weight, pattern); a positive weight points to historical. Each fires at most once.
SIGNALS: tuple[tuple[str, float, re.Pattern[str]], ...] = (
    ("FORMULA_KASYA", 2.0, _rx(rf"{_NOT_B}কস্য{_END_B}")),
    ("FORMULA_MIDANG", 2.0, _rx(rf"{_NOT_B}মিদ[ংৎম]{_END_B}")),
    ("RUPEE", 2.0, _rx(rf"রুপি|রূপি|রুপেয়া|রূপেয়া|রুপিয়া|\bRs\.?\s*{_D}")),
    ("ANNA", 1.0, _rx(rf"{_D}\s*আনা{_END_B}")),
    ("PAKISTAN", 2.0, _rx(r"পাকিস্তান|পাকিস্থান|pakistan", re.I)),
    ("BRITISH_INDIA", 2.0, _rx(r"জাতীয়তা\W{0,3}(?:\S*সূত্রে\s*)?ভারতীয়|ব্রিটিশ|বৃটিশ|british\s+india|ভারত\s*সম্রাট", re.I)),
    ("PARGANA", 2.0, _rx(r"পরগ[ণন]া")),
    ("ARCHAIC_UNIT", 2.0, _rx(rf"{_D}\s*(?:{'|'.join(_ARCHAIC_UNIT_WORDS)}){_END_B}")),
    ("TAPSHIL", 1.0, _rx(r"তপশিল|তপছিল|তপসিল")),  # modern deeds spell it তফসিল
    ("BANGLA_ERA", 1.0, _rx(rf"বঙ্গাব্দ|{_NOT_B}সন\s*{_D}{{4}}|{_D}{{4}}\s*সন{_END_B}")),
    ("BANGALI_NATIONALITY", 0.5, _rx(r"বাঙ্গালী|বাঙালী|বাঙ্গালি")),
    ("SANG", 0.5, _rx(rf"{_NOT_B}সাং\s*[-ঃ:]")),
    ("HONORIFIC", 0.5, _rx(rf"{_NOT_B}(?:জনাব|শ্রীমতী|শ্রীমতি|শ্রীযুক্ত|শ্রী)(?=[\s.:ঃ])")),
    ("DATA_GRAHITA", 0.5, _rx(r"দাতা|গ্রহীতা")),
    ("BANGLADESH", -2.0, _rx(r"বাংলাদেশ|bangladesh", re.I)),
    ("NATIONAL_ID", -3.0, _rx(r"জাতীয়\s*পরিচয়|এন\.?\s?আই\.?\s?ডি|\bNID\b")),
)
_CS = _rx(r"সি\.?\s?এস|\bC\.?\s?S\.?(?=\s*(?:খতিয়ান|khatian|দাগ))", re.I)
_LATER_SURVEY = _rx(r"আর\.?\s?এস|বি\.?\s?আর\.?\s?এস|বি\.?\s?এস(?!\w)|\b(?:R|B|BR)\.\s?S\.|\b(?:RS|BS|BRS)\b(?=\s*(?:খতিয়ান|khatian|দাগ|/))")

# deed kind: the earliest match wins (the title comes first; later mentions are recitals)
KIND_PATTERNS: tuple[tuple[DeedKind, re.Pattern[str]], ...] = (
    (DeedKind.MORTGAGE_REHEN, _rx(r"রেহেন|রেহান|বন্ধকী\s*দলিল|বন্ধক\s*দলিল|কট\s*কবলা|mortgage", re.I)),
    (DeedKind.GIFT_HEBA, _rx(r"হেবা|hiba|heba", re.I)),
    (DeedKind.GIFT_DANPATRA, _rx(r"দানপত্র|দান\s*পত্র|deed\s+of\s+gift|gift\s+deed", re.I)),
    (DeedKind.PARTITION_BANTONNAMA, _rx(r"ব[ণন]্টন\s*নামা|বাটোয়ারা|partition", re.I)),
    (DeedKind.EXCHANGE_EWAZ, _rx(r"এওয়াজ|এওয়াজ|বিনিময়\s*দলিল|exchange", re.I)),
    (DeedKind.WAQF, _rx(r"ওয়াকফ|ওয়াক্ফ|ওয়াকফ|waqf|wakf", re.I)),
    (DeedKind.POWER_OF_ATTORNEY, _rx(r"মোক্তারনামা|মোক্তার\s*নামা|power\s+of\s+attorney", re.I)),
    (DeedKind.AGREEMENT_BAINANAMA, _rx(r"বায়না|বায়না|agreement\s+for\s+sale|bainanama", re.I)),
    (DeedKind.SALE_SAF_KABALA, _rx(r"কবলা|কবালা|বিক্রয়\s*দলিল|বিক্রীত\s*দলিল|বিক্রয়|deed\s+of\s+sale|sale\s+deed", re.I)),
)


@dataclass(frozen=True)
class Signal:
    code: str
    weight: float
    evidence: str  # the matched text (or the year)


@dataclass(frozen=True)
class DeedClass:
    deed_profile: Profile
    deed_kind: DeedKind
    era: Era | None
    score: float  # 0..1; >= 0.5 historical
    year: int | None  # the deed's own year as read (Gregorian), None when no dated year
    signals: tuple[Signal, ...] = field(default=())

    @property
    def historical(self) -> bool:
        return self.deed_profile == "historical"

    def to_dict(self) -> dict[str, Any]:
        """Shape stored in extraction_json["deed_class"]."""
        return {
            "deed_profile": self.deed_profile, "deed_kind": self.deed_kind.value,
            "era": self.era.value if self.era else None, "score": self.score, "year": self.year,
            "signals": [{"code": s.code, "weight": s.weight, "evidence": s.evidence} for s in self.signals],
        }  # fmt: skip


def years(text: str, today: date | None = None) -> list[int]:
    """Gregorian years of the dates in the text. Bare 4-digit numbers (dag, deed and amount numbers)
    are not years: a Gregorian year needs a date cue (month name, dd/mm/, তারিখ, সাল/ইং/খ্রি) and a
    Bangla year (1100-1450) বঙ্গাব্দ / সন / সাল or a Bangla month in front."""
    this_year = (today or date.today()).year
    out: list[int] = []
    for m in _YEAR.finditer(text):
        y = int(m.group(1).translate(_DIGITS))
        before, after = text[max(0, m.start() - 24): m.start()], text[m.end(): m.end() + 14]
        if 1100 <= y <= 1450 and (_BN_AFTER.match(after) or _BN_BEFORE.search(before)):
            late = any(mo in before[-14:] for mo in _LATE_MONTHS)
            out.append(y + (594 if late else 593))
        elif 1757 <= y <= this_year and (
            _GR_AFTER.match(after) or _GR_BEFORE.search(before) or _ISO_AFTER.match(after)
        ):
            out.append(y)
    return [y for y in out if y <= this_year]


def deed_kind(text: str) -> DeedKind:
    hits = [(m.start(), kind) for kind, rx in KIND_PATTERNS if (m := rx.search(text))]
    return min(hits, key=lambda h: h[0])[1] if hits else DeedKind.OTHER


def _era(profile: Profile, year: int | None, sig: set[str]) -> Era | None:
    if profile == "modern":
        return Era.BANGLADESH
    if "PAKISTAN" in sig and (year is None or year <= 1947):
        return Era.EAST_BENGAL_PAKISTAN  # no Pakistan before 1947: the year is a misread digit
    if year is not None and year != 1947:
        return era_of(date(year, 1, 1))
    if "PAKISTAN" in sig:
        return Era.EAST_BENGAL_PAKISTAN
    if "BRITISH_INDIA" in sig or year == 1947:
        return Era.BRITISH_INDIA
    return None


def _table_text(tables: Iterable[Any]) -> str:
    return "\n".join(c.text for t in tables for c in t.cells if c.text)


def classify(text: str, tables: Iterable[Any] = (), today: date | None = None) -> DeedClass:
    """OCR text (+ `OCRTable`s) -> DeedClass. Empty or unreadable text is modern (the default path)."""
    full = normalize.text(f"{text}\n{_table_text(tables)}" if tables else text)
    signals: list[Signal] = []
    for code, weight, rx in SIGNALS:
        if m := rx.search(full):
            signals.append(Signal(code, weight, m.group(0).strip()))
    if cs := _CS.search(full):
        later = _LATER_SURVEY.search(full)
        signals.append(Signal("LATER_SURVEY", -1.0, later.group(0)) if later else Signal("CS_KHATIAN", 1.0, cs.group(0)))
    elif later := _LATER_SURVEY.search(full):
        signals.append(Signal("LATER_SURVEY", -1.0, later.group(0)))

    ys = years(full, today)
    old = [y for y in ys if y <= LAST_HISTORICAL_YEAR]
    year: int | None = None
    if ys and len(old) == len(ys):
        year = max(ys)
        signals.append(Signal("PRE_1971_YEAR", 4.0, str(year)))
    elif old:  # a modern deed reciting an old one, or a recent copy of an old deed
        signals.append(Signal("MIXED_YEARS", -2.0, f"{min(ys)}..{max(ys)}"))
    elif ys:
        year = max(ys)
        signals.append(Signal("POST_1971_YEAR", -6.0, str(year)))

    points = sum(s.weight for s in signals)
    score = round(1 / (1 + math.exp(-(points - THRESHOLD) / SPREAD)), 3)
    profile: Profile = "historical" if points >= THRESHOLD else "modern"
    if profile == "historical" and year is None and old:
        year = max(old)  # mixed years, vocabulary says historical: the deed's own year is the old one
    elif profile == "modern" and year is None and ys:
        year = max(ys)
    sig = {s.code for s in signals}
    return DeedClass(profile, deed_kind(full), _era(profile, year, sig), score, year, tuple(signals))
