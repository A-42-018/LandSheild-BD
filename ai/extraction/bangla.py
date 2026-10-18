# ruff: noqa: E501
"""Bangla value parsers for historical deeds (H4): number words, Bangla-calendar dates, money, area.

Pure functions, no OCR. Each parser returns None when the text does not parse: nothing is guessed.

- `number_words("এক হাজার পাঁচশত")` -> 1500; `"অর্ধ"` -> 0.5. Units 1-99 are irregular in Bangla, so
  they are a table; শত / হাজার / লক্ষ / কোটি multiply. Chandrabindu (ঁ) is optional, as OCR drops it.
- `parse_date("১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ")` -> `BDate(day=15, month="ফাল্গুন", year=1350, calendar="bangla")`;
  `to_gregorian()` gives a range: before the 1987 reform the Bangla month lengths followed the sun and
  varied by a day, so a pre-1394 BS date is `(mid - 1, mid + 1)` with precision `day±1`. Later dates use
  the Bangladesh revised calendar (1987: 5 × 31 days then 30, ফাল্গুন 31 in a Gregorian leap year;
  2019 revision: 6 × 31, ফাল্গুন 29/30) and are exact.
- `parse_money("১,৫০০/- (এক হাজার পাঁচশত) টাকা")` -> amount 1500, words, currency word. When the
  figure and the words disagree the words win (OCR misreads ১ as ৯ far more often than a whole word).
- `parse_area("০.৫০ একর (অর্ধ একর)")`, archaic compound areas `"২ কানি ৫ গণ্ডা ৩ কড়া"` -> parts.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

from ai.extraction.lhdr import canonical_unit

BN_DIGITS = "০১২৩৪৫৬৭৮৯"
_TO_ASCII = str.maketrans(BN_DIGITS, "0123456789")
_TO_BN = str.maketrans("0123456789", BN_DIGITS)
D = "[0-9০-৯]"
B = "ঀ-৿"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def ascii_digits(s: str) -> str:
    return s.translate(_TO_ASCII)


def bn_digits(s: str) -> str:
    return s.translate(_TO_BN)


def _key(word: str) -> str:
    """Lookup key: NFC, no chandrabindu, ো/ও endings folded (এগারো == এগার)."""
    w = nfc(word).replace("ঁ", "").strip()
    return w[:-1] if len(w) > 2 and w.endswith("ো") else w


# ---- number words -------------------------------------------------------------------------------

_UNITS = (
    "এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগার বার তের চৌদ্দ পনের ষোল সতের আঠার ঊনিশ বিশ "
    "একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আঠাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ "
    "ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ "
    "সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বায়ান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন "
    "ঊনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর একাত্তর "
    "বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি একাশি বিরাশি তিরাশি চুরাশি "
    "পঁচাশি ছিয়াশি সাতাশি অষ্টাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই "
    "ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই"
).split()
NUMBER_WORDS: dict[str, float] = {_key(w): i + 1 for i, w in enumerate(_UNITS)}
NUMBER_WORDS |= {_key(w): n for w, n in (
    ("দুই", 2), ("দু", 2), ("ছয়", 6), ("ছয়", 6), ("নয়", 9), ("নয়", 9), ("উনিশ", 19), ("কুড়ি", 20), ("কুড়ি", 20),
    ("উনত্রিশ", 29), ("উনচল্লিশ", 39), ("উনপঞ্চাশ", 49), ("উনষাট", 59), ("উনসত্তর", 69), ("উনআশি", 79),
    ("উননব্বই", 89), ("বায়ান্ন", 52), ("বিয়াল্লিশ", 42), ("শূন্য", 0), ("অর্ধ", 0.5), ("আধা", 0.5),
    ("সাড়ে", None), ("সোয়া", None), ("পৌনে", None),  # quarter forms: not resolved alone, see below
)}  # fmt: skip
_MULT = {_key(w): m for w, m in (("শত", 100), ("শো", 100), ("শ", 100), ("হাজার", 1000), ("লক্ষ", 100_000),
                                   ("লাখ", 100_000), ("কোটি", 10_000_000))}  # fmt: skip
_SUFFIX_MULT = ("শত", "শো")  # glued: পাঁচশত, তিনশো


_CANON = {_key(w): w for w in _UNITS} | {_key(w): w for w in ("দুই", "ছয়", "নয়", "শূন্য", "অর্ধ", "শত", "হাজার", "লক্ষ", "কোটি")}


_VALID = {nfc(w) for w in _UNITS} | {nfc(w) + "ো" for w in _UNITS[10:18]} | {nfc(w) for w in ("দুই", "ছয়", "নয়", "অর্ধ", "শত", "হাজার", "লক্ষ", "লাখ", "কোটি")}


def canonical_words(text: str) -> str:
    """Misspelt number words in a dictionary spelling ('পচিশ শতক' -> 'পঁচিশ শতক'); valid spellings
    (বার / বারো both) and other words are kept as written."""
    return " ".join(t if nfc(t) in _VALID else _CANON.get(_key(t), t) for t in nfc(text).split())


def _split(token: str) -> list[str]:
    """'পাঁচশত' -> ['পাঁচ', 'শত']; other tokens as they are."""
    for suf in _SUFFIX_MULT:
        if token.endswith(suf) and len(token) > len(suf) and _key(token[: -len(suf)]) in NUMBER_WORDS:
            return [token[: -len(suf)], suf]
    return [token]


def number_words(text: str) -> float | None:
    """Bangla number in words -> number; None if any word is not a number word.
    'একশত বাহাত্তর' -> 172, 'এক হাজার পাঁচশত' -> 1500, 'অর্ধ' -> 0.5."""
    tokens = [t for raw in re.split(r"[\s,\-–]+", nfc(text).strip()) if raw for t in _split(raw)]
    if not tokens:
        return None
    total, current, seen = 0.0, 0.0, False
    for t in tokens:
        k = _key(t)
        if k in _MULT:
            m = _MULT[k]
            current = (current or 1) * m
            if m >= 1000:
                total, current = total + current, 0.0
            seen = True
        elif k in NUMBER_WORDS and NUMBER_WORDS[k] is not None:
            current += NUMBER_WORDS[k]  # type: ignore[operator]
            seen = True
        else:
            return None
    return (total + current) if seen else None


def as_number(s: str) -> float | None:
    """'১,৫০০' / '0.50' -> number."""
    v = ascii_digits(s).replace(",", "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def tidy(n: float) -> int | float:
    return int(n) if float(n).is_integer() else round(n, 4)


# ---- Bangla calendar ----------------------------------------------------------------------------

BANGLA_MONTHS = ("বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র")
MONTH_SPELLINGS: dict[str, int] = {nfc(m): i for i, m in enumerate(BANGLA_MONTHS)}
MONTH_SPELLINGS |= {nfc(s): i for s, i in (
    ("জ্যৈষ্ট", 1), ("জৈষ্ঠ", 1), ("আষাঢ", 2), ("শ্রাবন", 3), ("আশ্বীন", 5), ("কার্ত্তিক", 6), ("কাতিক", 6),
    ("কার্তীক", 6), ("অগ্রহায়ন", 7), ("অঘ্রাণ", 7), ("অঘ্রান", 7), ("ফাল্গুণ", 10), ("ফালগুন", 10), ("চৈত", 11),
)}  # fmt: skip
GREGORIAN_MONTHS = {nfc(k): v for k, v in {
    "জানুয়ারি": 1, "জানুয়ারী": 1, "ফেব্রুয়ারি": 2, "ফেব্রুয়ারী": 2, "মার্চ": 3, "এপ্রিল": 4, "মে": 5, "জুন": 6,
    "জুলাই": 7, "আগস্ট": 8, "আগষ্ট": 8, "সেপ্টেম্বর": 9, "অক্টোবর": 10, "নভেম্বর": 11, "ডিসেম্বর": 12,
}.items()}  # fmt: skip
# (Gregorian month, day) on which each Bangla month began before the 1987 reform; +-1 day by year
TRADITIONAL_START = ((4, 14), (5, 15), (6, 15), (7, 16), (8, 16), (9, 16), (10, 17), (11, 16), (12, 16), (1, 14), (2, 13), (3, 14))
REFORM_YEAR, REVISION_YEAR = 1394, 1426  # BS years the 1987 and 2019 calendars start

_DAY = rf"({D}{{1,2}})\s*(?:ই|লা|রা|ঠা|শে|তম|ম)?"
_MONTH = "|".join(sorted(map(re.escape, MONTH_SPELLINGS), key=len, reverse=True))
_GMONTH = "|".join(sorted(map(re.escape, GREGORIAN_MONTHS), key=len, reverse=True))
_ERA = r"(?:বঙ্গাব্দ|বঙ্গাব্দের|বাংলা\s*সন|সনের|সন|সাল|বাং)"
BANGLA_DATE = re.compile(nfc(rf"{_DAY}\s+({_MONTH})[\s,]*({D}{{4}})\s*{_ERA}?"))
BANGLA_DATE_YEAR_FIRST = re.compile(nfc(rf"(?:সন\s*)?({D}{{4}})\s*{_ERA}\s*{_DAY}\s+({_MONTH})"))
GREGORIAN_DATE = re.compile(nfc(rf"{_DAY}\s+({_GMONTH})[\s,]*({D}{{4}})"))


@dataclass(frozen=True)
class BDate:
    verbatim: str
    calendar: str  # bangla | gregorian
    day: int | None
    month: str | int | None  # Bangla month name, or 1-12
    year: int | None
    start: int = 0  # offset of the match in the searched text
    end: int = 0
    corrected: bool = False  # a look-alike digit was fixed (৯৩৫০ -> ১৩৫০)

    def to_gregorian(self) -> tuple[date | None, date | None, str | None]:
        """(from, to, precision)."""
        if self.calendar == "gregorian":
            if not (self.day and isinstance(self.month, int) and self.year):
                return None, None, None
            try:
                d = date(self.year, self.month, self.day)
            except ValueError:
                return None, None, None
            return d, d, "day"
        if not (isinstance(self.month, str) and self.year):
            return None, None, None
        m = MONTH_SPELLINGS.get(nfc(self.month))
        if m is None:
            return None, None, None
        start = bangla_month_start(self.year, m)
        if self.day is None:
            nxt = bangla_month_start(self.year + (m == 11), (m + 1) % 12)
            return start, nxt - timedelta(days=1), "month"
        if not 1 <= self.day <= 32:
            return None, None, None
        mid = start + timedelta(days=self.day - 1)
        if self.year < REFORM_YEAR:
            return mid - timedelta(days=1), mid + timedelta(days=1), "day±1"
        return mid, mid, "day"


def _leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def bangla_month_start(bs_year: int, month: int) -> date:
    """First day of Bangla month `month` (0 = বৈশাখ) of BS year `bs_year`."""
    gy = bs_year + 593
    if bs_year < REFORM_YEAR:
        gm, gd = TRADITIONAL_START[month]
        return date(gy + (gm < 4), gm, gd)
    six = bs_year >= REVISION_YEAR
    lengths = [31] * (6 if six else 5) + [30] * (6 if six else 7)
    if six:
        lengths[10] = 30 if _leap(gy + 1) else 29
    elif _leap(gy + 1):
        lengths[10] = 31
    return date(gy, 4, 14) + timedelta(days=sum(lengths[:month]))


BS_YEARS = range(1100, 1451)  # Bangla years a deed can carry (1693-2043 AD)
_LOOKALIKE_FIRST = {"৯": "১", "9": "1"}  # Tesseract reads a leading ১ as ৯ on faint print


def _bdate(m: re.Match, calendar: str, day_g: int, month_g: int, year_g: int) -> BDate | None:
    month: str | int = m.group(month_g)
    if calendar == "gregorian":
        month = GREGORIAN_MONTHS[nfc(month)]
    else:
        month = BANGLA_MONTHS[MONTH_SPELLINGS[nfc(month)]]  # canonical spelling
    raw_year, corrected = m.group(year_g), False
    year = int(ascii_digits(raw_year))
    if calendar == "bangla" and year not in BS_YEARS:
        fixed = _LOOKALIKE_FIRST.get(raw_year[0], raw_year[0]) + raw_year[1:]
        if int(ascii_digits(fixed)) not in BS_YEARS:
            return None
        year, corrected = int(ascii_digits(fixed)), True
    verbatim = m.group(0).strip(" ,")
    if corrected:
        verbatim = verbatim.replace(raw_year, bn_digits(str(year)))
    return BDate(verbatim, calendar, int(ascii_digits(m.group(day_g))), month, year, m.start(), m.end(), corrected)


def find_dates(text: str) -> list[BDate]:
    """Every Bangla-calendar and Gregorian (Bangla-written) date in the text, in order."""
    text = nfc(text)
    out = [_bdate(m, "bangla", 1, 2, 3) for m in BANGLA_DATE.finditer(text)]
    out += [_bdate(m, "bangla", 2, 3, 1) for m in BANGLA_DATE_YEAR_FIRST.finditer(text)]
    out += [_bdate(m, "gregorian", 1, 2, 3) for m in GREGORIAN_DATE.finditer(text)]
    return sorted((d for d in out if d is not None), key=lambda d: d.start)


def parse_date(text: str) -> BDate | None:
    ds = find_dates(text)
    return ds[0] if ds else None


# ---- money --------------------------------------------------------------------------------------

CURRENCY_WORDS = ("টাকা", "রুপি", "রূপি", "রুপেয়া", "রূপেয়া", "রুপিয়া")
_CUR = "|".join(CURRENCY_WORDS)
MONEY = re.compile(nfc(rf"({D}[{D[1:-1]},.]*)\s*/-?\s*(?:[\(€\[{{]\s*([^)\]}}\n]{{2,60}}?)\s*[\)\]}}])?\s*({_CUR})?"))


@dataclass(frozen=True)
class Money:
    amount: int | float | None
    figure: str  # as written: ১,৫০০/-
    words: str | None
    currency: str | None
    agree: bool | None  # figure == words (None: one of them missing)
    start: int
    end: int


def parse_money(text: str) -> Money | None:
    """The first `figure/- (words) currency` in the text."""
    for m in MONEY.finditer(nfc(text)):
        fig, words, cur = m.group(1), (m.group(2) or "").strip() or None, m.group(3)
        if not (words or cur):
            continue
        n_fig = as_number(fig)
        n_words = number_words(words) if words else None  # words with an unreadable token do not count
        if words and n_words is None:
            words = None if n_fig is not None else words
        agree = None if n_fig is None or n_words is None else n_fig == n_words
        amount = n_words if n_words is not None and (n_fig is None or not agree) else n_fig
        return Money(tidy(amount) if amount is not None else None, f"{fig}/-", words, cur, agree, m.start(), m.end())
    return None


# ---- area ---------------------------------------------------------------------------------------

# 1 acre = 100 decimal (শতক); Bengal standard bigha = 33 decimal, katha = bigha / 20. Archaic
# units (kani, ganda, kora ...) differ by district, so they get no decimal value: only their parts.
DECIMALS_PER = {"acre": 100.0, "decimal": 1.0, "bigha": 33.0, "katha": 1.65, "sqft": 1 / 435.6, "sqm": 1 / 40.47}
# within one kani: 1 kani = 20 ganda, 1 ganda = 4 kora, 1 kora = 3 kranti, 1 kranti = 20 til
ARCHAIC_IN_KANI = {"kani": 1.0, "ganda": 1 / 20, "kora": 1 / 80, "kranti": 1 / 240, "til": 1 / 4800}
_UNIT_WORDS = "একর|শতক|শতাংশ|ডেসিমাল|বিঘা|কাঠা|কানি|গণ্ডা|গন্ডা|কড়া|কড়া|ক্রান্তি|তিল|ছটাক|ধুর|পাখি|acres?|decimals?"
AREA = re.compile(nfc(rf"({D}+(?:\.{D}+)?)\s*({_UNIT_WORDS})(?:\s*[\(\[]\s*([^)\]\n]{{2,40}}?)\s*[\)\]])?"), re.I)
_PART = re.compile(nfc(rf"({D}+(?:\.{D}+)?)\s*({_UNIT_WORDS})"), re.I)
_WORD_AREA = re.compile(nfc(rf"([{B}\s]+?)\s*({_UNIT_WORDS})$"))


@dataclass
class AreaRead:
    value: float | None = None
    unit: str | None = None  # canonical
    parts: dict[str, float] = field(default_factory=dict)
    in_words: str | None = None
    decimal_equiv: float | None = None
    words_agree: bool | None = None
    verbatim: str = ""


def words_area(text: str) -> tuple[float, str] | None:
    """'অর্ধ একর' -> (0.5, 'acre'); 'বিশ শতক' -> (20, 'decimal')."""
    m = _WORD_AREA.search(nfc(text).strip())
    if not m:
        return None
    n, u = number_words(m.group(1)), canonical_unit(m.group(2))
    return (n, u) if n is not None and u else None


def to_decimal(value: float, unit: str) -> float | None:
    per = DECIMALS_PER.get(unit)
    return round(value * per, 2) if per is not None else None


def parse_area(text: str) -> AreaRead | None:
    """Area as printed in a schedule cell. Archaic compounds keep their parts."""
    text = nfc(text)
    parts = [(as_number(n), canonical_unit(u)) for n, u in _PART.findall(text)]
    archaic = [(n, u) for n, u in parts if u in ARCHAIC_IN_KANI or u in ("chatak", "dhur", "pakhi")]
    if len(archaic) >= 2 or (archaic and len(parts) == 1 and parts[0][1] in ARCHAIC_IN_KANI):
        out = AreaRead(unit=archaic[0][1], verbatim=text.strip())
        for n, u in archaic:
            if n is not None and u:
                out.parts[u] = tidy(n)
        return out
    m = AREA.search(text)
    if not m:
        wa = words_area(text)
        if wa:
            return AreaRead(value=wa[0], unit=wa[1], in_words=text.strip(), decimal_equiv=to_decimal(*wa), verbatim=text.strip())
        return None
    value, unit, words = as_number(m.group(1)), canonical_unit(m.group(2)), (m.group(3) or "").strip() or None
    out = AreaRead(value=value, unit=unit, in_words=words, verbatim=m.group(0))
    if words and (wa := words_area(words)) and value is not None and unit:
        a, b = to_decimal(value, unit), to_decimal(*wa)
        out.words_agree = a is not None and b is not None and abs(a - b) < 0.01
        if not out.words_agree and b is not None and DECIMALS_PER.get(unit):
            out.value = round(b / DECIMALS_PER[unit], 4)  # the words win, as for money
    if out.value is not None and unit:
        out.decimal_equiv = to_decimal(out.value, unit)
    return out


# ---- boundaries (চৌহদ্দি) ------------------------------------------------------------------------

DIRECTIONS = {
    "north": ("উত্তরে", "উত্তর"), "south": ("দক্ষিণে", "দক্ষিনে", "দক্ষিপে", "দক্ষিণ"),
    "east": ("পূর্বে", "পুর্বে", "পূবে", "পূর্ব"), "west": ("পশ্চিমে", "পশ্চিনে", "পশ্চিম"),
}  # fmt: skip
_DIR_WORD = {nfc(w): d for d, ws in DIRECTIONS.items() for w in ws}
_DIR_RE = re.compile(
    rf"(?<![{B}])({'|'.join(sorted(map(re.escape, _DIR_WORD), key=len, reverse=True))})(?:\s*[-–:ঃ]\s*|\s+(?=[{B}]))"
)


ORDER = ("north", "south", "east", "west")  # the order deeds always list the four sides in
_BOUNDS_LABEL = re.compile(nfc(rf"^[^,{B}]*?(?:চৌ\S*|চতু\S*সীমা\S*|\S{{1,8}})\s*(?:\([^)]*\))?\s*[-–:ঃ]\s*(?=\S)"))


def parse_boundaries(text: str, by_order: bool = False) -> dict[str, str]:
    """{'north': 'আব্দুল করিমের জমি', ...} from 'উত্তরে- …, দক্ষিণে- …, পূর্বে- …, পশ্চিমে- …।'.
    Sides are comma-separated; with `by_order`, a side whose direction word is unreadable is placed
    by the fixed N, S, E, W order when the four comma parts are all there (key ends with '?')."""
    text = nfc(text).replace("\n", " ")
    text = re.split(r"[।|]", text)[0]
    segs = [s for s in (x.strip() for x in text.split(",")) if s]
    out: dict[str, str] = {}
    unlabelled: list[tuple[int, str]] = []
    for i, seg in enumerate(segs):
        m = _DIR_RE.search(seg)
        if m:
            d, v = _DIR_WORD[nfc(m.group(1))], seg[m.end():]
        else:
            d, v = None, (_BOUNDS_LABEL.sub("", seg) if i == 0 else seg)
        v = re.sub(r"\s+", " ", v).strip(" ,;.-")
        if not v:
            continue
        if d and d not in out:
            out[d] = v
        elif d is None:
            unlabelled.append((i, v))
    if by_order and len(out) >= 2 and len(segs) == 4:
        for i, v in unlabelled:
            if ORDER[i] not in out:
                out[ORDER[i] + "?"] = v
    return out
