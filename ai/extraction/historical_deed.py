# ruff: noqa: E501
"""Rule parser for historical deeds (H4): OCR text + table grid -> an LHDR v1 record.

Works without any API key. The deed is cut into its parts and each part has its own parser:

    header         দলিল নং, তারিখ, sub-registry office, বহি / জিল্দ (volume)
    parties        ১ম পক্ষ (দাতা / বিক্রেতা) … ২য় পক্ষ (গ্রহীতা / ক্রেতা) …; each person is
                   `HONORIFIC NAME, পিতা- [মৃত] X, মাতা- Y, সাং- Z, থানা- …, জেলা- …, পেশা- …, ধর্ম- …, জাতীয়তা- …`
    body           consideration `১,৫০০/- (এক হাজার পাঁচশত) টাকা`, how the seller holds the land
                   (স্বত্ব দখলীয় …), nature (চিরস্থায়ী / রেহেন), নিষ্কণ্টক
    তপশিল          the H2 cell grid (header row -> columns; label rows; full-width চৌহদ্দি rows), else
                   `label: value` lines; area, archaic units, boundaries
    signature row  দাতার টিপসই / স্বাক্ষর · সাক্ষীগণের স্বাক্ষর · দলিল লেখকের স্বাক্ষর, split in three
                   columns by the word boxes (OCR puts the three columns on one line)

Clean-up that is normalisation, not guessing (the value as read always stays in `verbatim`):
- closed vocabularies are snapped when one entry is clearly closest (religion, nationality, land class,
  signature mark, number words, Bangla month names); place names snap to the gazetteer;
- consensus: the same place is printed several times (party addresses, schedule, footer); a reading
  that is a near-miss of a spelling that occurs more often is replaced by it;
- figure vs words: amounts and areas are printed twice; when they disagree the words win.
Anything else that does not parse is left out (None). Confidence = mean OCR word confidence of the value's
words x the pattern's strength, so reviewers see weak reads.
"""
from __future__ import annotations

import itertools
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from statistics import fmean
from typing import Any

from rapidfuzz import fuzz, process

from ai.extraction import bangla as bn
from ai.extraction import gazetteer
from ai.extraction.base import ExtractionResult
from ai.extraction.classify import DeedClass, classify
from ai.extraction.derive import derive_core, derive_fields
from ai.extraction.lhdr import (
    LHDR,
    Address,
    Area,
    Boundaries,
    Consideration,
    Core,
    Currency,
    Dates,
    DeedDate,
    DeedKind,
    DeedWriter,
    Document,
    Era,
    Execution,
    Field,
    ModernMapping,
    Party,
    Plot,
    Registration,
    Relative,
    Role,
    Source,
    Stamp,
    Survey,
    TitleRecital,
    era_of,
)
from ai.ocr.base import OCRResult, OCRTable, OCRWord

_B = "ঀ-৿"
D = bn.D
NOT_B = rf"(?<![{_B}])"

# pattern strength (x OCR confidence)
LABELLED = 0.95  # value right after its label, parsed fully
CELL = 0.95  # schedule cell under its header
PROSE = 0.85  # found in running text by a phrase pattern
SNAPPED = 0.8  # corrected to a known spelling / by consensus
WEAK = 0.6  # partly unreadable, or only a fallback cue

ERA_CURRENCY = {Era.BRITISH_INDIA: Currency.INR, Era.EAST_BENGAL_PAKISTAN: Currency.PKR, Era.BANGLADESH: Currency.BDT}
SIDE_ROLES: dict[DeedKind, tuple[Role, Role]] = {
    DeedKind.SALE_SAF_KABALA: (Role.SELLER, Role.BUYER), DeedKind.AGREEMENT_BAINANAMA: (Role.SELLER, Role.BUYER),
    DeedKind.GIFT_HEBA: (Role.DONOR, Role.DONEE), DeedKind.GIFT_DANPATRA: (Role.DONOR, Role.DONEE),
    DeedKind.MORTGAGE_REHEN: (Role.MORTGAGOR, Role.MORTGAGEE), DeedKind.POWER_OF_ATTORNEY: (Role.PRINCIPAL, Role.ATTORNEY),
    DeedKind.WAQF: (Role.WAQIF, Role.MUTAWALLI), DeedKind.PARTITION_BANTONNAMA: (Role.SHARER, Role.SHARER),
    DeedKind.EXCHANGE_EWAZ: (Role.EXCHANGER, Role.EXCHANGER),
}  # fmt: skip
HEADING_ROLES = (  # words in the party heading that name the role outright (longest first)
    ("রেহেনগ্রহীতা", Role.MORTGAGEE), ("রেহেনদাতা", Role.MORTGAGOR), ("বন্ধকগ্রহীতা", Role.MORTGAGEE),
    ("বন্ধকদাতা", Role.MORTGAGOR), ("বিক্রেতা", Role.SELLER), ("ক্রেতা", Role.BUYER), ("মোক্তার", Role.ATTORNEY),
)  # fmt: skip

HONORIFICS = ("শ্রীযুক্তা", "শ্রীযুক্ত", "শ্রীমতী", "শ্রীমতি", "শ্রী", "জনাব", "বেগম", "মোসাম্মৎ", "মোসাঃ", "মোছাঃ",
              "মুন্সী", "মুন্সি", "মৌলভী", "হাজী", "কুমারী")  # fmt: skip
DECEASED = ("মৃত্", "মৃত", "মরহুমা", "মরহুম", "স্বর্গীয়া", "স্বর্গীয়", "স্বর্গীয়", "পরলোকগত", "লেট")
DECEASED_GARBLED = ("স্বীয়", "স্বগীয়", "স্বর্গিয়")  # OCR forms of স্বর্গীয় (drops the reph / the ্গ)
RELIGIONS = ("ইসলাম", "হিন্দু", "বৌদ্ধ", "খ্রিস্টান", "খ্রিষ্টান")
NATIONALITIES = ("জন্মসূত্রে বাঙ্গালী", "জন্মসূত্রে ভারতীয়", "জন্মসূত্রে পাকিস্তানী", "জন্মসূত্রে বাংলাদেশী",
                 "বাঙ্গালী", "ভারতীয়", "পাকিস্তানী", "বাংলাদেশী")  # fmt: skip
PROFESSIONS = ("কৃষি", "ব্যবসা", "গৃহকর্ম", "শিক্ষকতা", "মহাজনী", "চাকুরী", "চাকরি", "মৎস্যজীবী", "দিনমজুর",
               "জমিদারী", "তালুকদারী", "ওকালতি", "ডাক্তারী", "তাঁত", "মোক্তারী")  # fmt: skip
LAND_CLASSES = ("শালী", "নাল", "ভিটা", "বাড়ি", "বাস্তু", "পুকুর", "ডাঙ্গা", "চালা", "বাগান", "পতিত", "ডোবা", "খাল",
                "ছন", "জঙ্গল", "কান্দি", "বিল", "চর", "আমন", "বোরো", "বসতবাড়ি")  # fmt: skip
MARKS = ("টিপসই / স্বাক্ষর", "স্বাক্ষর / টিপসই", "টিপসই", "স্বাক্ষর", "স্বাক্ষর (বা টিপসহি)")
BASIS_PHRASES = ("পৈতৃক ওয়ারিশসূত্রে প্রাপ্ত", "ওয়ারিশসূত্রে প্রাপ্ত", "ওয়ারিশ সূত্রে প্রাপ্ত", "পৈতৃক সূত্রে প্রাপ্ত",
                 "খরিদা সূত্রে প্রাপ্ত", "খরিদসূত্রে প্রাপ্ত", "দানসূত্রে প্রাপ্ত", "দান সূত্রে প্রাপ্ত", "হেবা সূত্রে প্রাপ্ত",
                 "স্বত্ব দখলীয়", "স্বত্ববান দখলীয়")  # fmt: skip


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _rx(p: str, flags: int = 0) -> re.Pattern[str]:
    return re.compile(nfc(p), flags)


def _snap(v: str | None, vocab: tuple[str, ...], cutoff: int = 85) -> tuple[str | None, bool]:
    """(vocabulary entry, changed?) when one entry is clearly closest; else (v, False)."""
    if not v:
        return v, False
    if v in vocab:
        return v, False
    hits = process.extract(v, vocab, scorer=fuzz.ratio, limit=2)
    if hits and hits[0][1] >= cutoff and (len(hits) < 2 or hits[0][1] - hits[1][1] >= 5):
        return hits[0][0], True
    return v, False


_JUNK_TOKEN = re.compile(r"^(?:[A-Za-z&@#$%^*+=~`'\"|\\/_<>\[\]{}()!?.,;:০-৯0-9\-–]+|[^\w" + _B + "]+)$")
_ORPHAN_SHRI = re.compile(nfc(r"^[্]*্রী(?=[" + _B + r"])"))  # '্্রীরামকান্ত' = শ্রী glued and broken


def clean_text(v: str | None, keep_digits: bool = False) -> str | None:
    """Value text without OCR junk tokens (Latin fragments, stray punctuation, stray digits)."""
    if not v:
        return None
    toks = []
    for t in nfc(v).replace("|", " ").split():
        t = t.strip(" ,;:.।|-–")
        if not t or (_JUNK_TOKEN.match(t) and not (keep_digits and re.fullmatch(rf"{D}+(?:[/.]{D}+)?", t))):
            continue
        if re.search(r"[A-Za-z]", t) and re.search(f"[{_B}]", t):
            t = re.sub(r"[A-Za-z]+", "", t)
        toks.append(t)
    out = " ".join(toks).strip(" ,;:.।-")
    return out or None


# ---- locating values among OCR words (confidence + bbox) ----------------------------------------

def _wkey(s: str) -> str:
    return re.sub(rf"[^{_B}A-Za-z0-9]", "", bn.ascii_digits(nfc(s)))


class Locator:
    """Finds the OCR words that spell a value: their mean confidence and joined bbox."""

    def __init__(self, ocr: OCRResult) -> None:
        self.words: tuple[OCRWord, ...] = ocr.words
        self.keys = [_wkey(w.text) for w in ocr.words]
        self.base = ocr.confidence or 0.0

    def find(self, text: str | None) -> tuple[float, list[float] | None]:
        k = _wkey(text or "")
        if not k or not self.words:
            return self.base, None
        n = len(self.words)
        for i in range(n):
            if not self.keys[i] or not (k.startswith(self.keys[i]) or self.keys[i].find(k) >= 0 or k.find(self.keys[i]) >= 0):
                continue
            joined = ""
            for j in range(i, min(n, i + 14)):
                joined += self.keys[j]
                if k in joined:
                    ws = self.words[i: j + 1]
                    return fmean(w.confidence for w in ws), _bbox(ws)
                if len(joined) > len(k) + 40:
                    break
        return self.base, None


def _bbox(ws) -> list[float]:
    left, top = min(w.bbox[0] for w in ws), min(w.bbox[1] for w in ws)
    right, bottom = max(w.bbox[0] + w.bbox[2] for w in ws), max(w.bbox[1] + w.bbox[3] for w in ws)
    return [float(left), float(top), float(right - left), float(bottom - top)]


# ---- the parser ---------------------------------------------------------------------------------

_PARTY_HEAD = _rx(r"পক্ষ\s*(?:[\(（]\s*([^)）\n]{0,40}?)\s*[\)）]|([^\n:ঃ()]{2,30}?)\s*[\)）])\s*[:ঃ;]?")
_PARTY_HEAD_NAME = _rx(r"(প্রথম|দ্বিতীয়|[১2]ম|[২2]য়?)\s*পক্ষ\s*[:ঃ]")
_BODY_START = _rx(r"(?:\n|^)\s*(?:কস্য|অদ্য|আমি|আমার|এতদ)")
_SCHEDULE_HEAD = _rx(r"তপশিল\s*পরিচয়|সম্পত্তির\s*তপশিল|তফসিল\s*[I|।]?\s*সম্প|তপশিল\s*$|তফসিল\s*$", re.M)
_SIG_HEAD = _rx(r"স\S{0,6}গণের")
_FOOTER = _rx(r"পৃষ্ঠা\s*[০-৯0-9]")
_PERSON_LABELS: tuple[tuple[str, str], ...] = (
    ("father", r"পিতা"), ("husband", r"স্বামী"), ("mother", r"মাতা"), ("village", r"সাং|সাঃ|সাকিন|গ্রাম|সা(?=\s+[ঀ-৿])"),
    ("post", r"পোঃ|পোষ্ট|পোস্ট|ডাকঘর"), ("union", r"ইউনিয়ন"), ("thana", r"থানা|উপজেলা"), ("pargana", r"পরগ[ণন]া"),
    ("district", r"জেলা|জিলা"), ("profession", r"পেশা"), ("religion", r"ধর্ম"), ("nationality", r"জাতীয়তা"), ("name", r"নাম"),
)  # fmt: skip
_LABEL_RE = _rx(
    NOT_B + r"(?:" + "|".join(f"(?P<{k}>{p})" for k, p in _PERSON_LABELS) + rf")(?![{_B}])\s*[-–:ঃ]?\s*"
)
_DEED_NO = _rx(rf"দা?লিল\s*(?:নং|নম্বর|নম্বরঃ|নও|নং:)\s*[:ঃ.]?\s*({D}+(?:\s*/\s*(?:[ক-হ]|{D}+))?)")
_OFFICE = _rx(rf"([{_B}]+(?:\s+সদর)?)\s+সা[বর][-\s]?(রেজি\S*)\s+অফিস")
_VOLUME = _rx(rf"বহি\s*নং\s*({D}+)\s*,\s*জি\S*\s*({D}+)")
_DATE_LABEL = _rx(r"তারিখ\s*[:ঃ]\s*([^\n]{4,60})")
_PARTIAL_DATE = _rx(rf"({D}{{1,2}})\s*(?:ই|লা|রা|ঠা|শে)\s+\S+[\s,]+({D}{{4}})")
_PARGANA = _rx(rf"{NOT_B}[পগ]রগ[ণন]া\s*[-–:ঃ]\s*([{_B}]+)")
_JL = _rx(rf"জে\.?\s*এল\.?\s*(?:নং)?\s*[:ঃ-]?\s*({D}+)")
_FOOT_MOUZA = _rx(rf"([{_B}]{{2,}})\s*মৌজা\s*(?:&nbsp;|\s)*পৃষ্ঠা")
_STAMP = _rx(rf"স্ট্যাম্প[^\n]*\n?\s*({D}+(?:/-)?)\s*(টাকা|রুপি|আনা)")
_LICENCE = _rx(rf"[\(（]?\s*লাইসেন্স\s*নং\s*({D}+(?:/[ক-হ])?)\s*[\)）]?")
_ENCUMBRANCE = _rx(r"নিষ্ক[ণন]্?ট?টক|নিষ্কণ্টক|নিস্কণ্টক|নিষ্কন্টক|নিষ্কণটক")
_PERPETUAL = _rx(r"চিরস্থায়ী|চিরস্থায়ী|চির্থায়ী|চিরতরে")

_HEADER_COLS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("jl_no", _rx(r"জে\.?\s*এল")), ("khatian_no", _rx(r"খতিয়ান|খতিয়ান")), ("dag_no", _rx(r"দাগ")),
    ("area", _rx(r"পরিমাণ|পরিমান")), ("land_class", _rx(r"শ্রেণী|শ্রেনী|শ্রেণি|শ্রেণ")),
    ("boundaries", _rx(r"চৌহদ্দি|চৌহদি|Boundaries", re.I)), ("district", _rx(r"জেলা|জিলা")),
    ("thana", _rx(r"থানা|উপজেলা")), ("mouza", _rx(r"মৌজা")), ("pargana", _rx(r"পরগ[ণন]া")),
)  # fmt: skip
_SURVEY = (("CS", _rx(r"সি\.?\s*এস|C\.?\s*S\.?", re.I)), ("SA", _rx(r"এস\.?\s*এ")), ("RS", _rx(r"আর\.?\s*এস")),
           ("BS", _rx(r"বি\.?\s*এস")))  # fmt: skip


def _survey(text: str) -> str | None:
    return next((s for s, rx in _SURVEY if rx.search(text)), None)


def _col_of(header: str) -> str | None:
    return next((k for k, rx in _HEADER_COLS if rx.search(header)), None)


def _intact(raw: str, cleaned: str | None) -> bool:
    """False when OCR junk was dropped from inside a value (the cleaned value may miss a word)."""
    toks = [t for t in nfc(raw).split() if t.strip(" ,;:.।|-–")]
    inner = toks[1:-1]
    return bool(cleaned) and not any(_JUNK_TOKEN.match(t.strip(" ,;:.।|-–")) for t in inner)


_B8 = str.maketrans({"8": "৪"})


def _number(v: str | None, bangla_doc: bool) -> str | None:
    """Khatian / dag / JL text -> ASCII digits; Latin '8' among Bangla digits is the look-alike ৪."""
    if not v:
        return None
    s = nfc(v).strip(" .,;।")
    if bangla_doc and re.fullmatch(r"[8০-৯]+", s) and "8" in s:
        s = s.translate(_B8)
    m = re.match(rf"({D}+(?:/{D}+)?)", s)
    if m and not re.search(r"[A-Za-z]", s[: m.end() + 1]):
        return bn.ascii_digits(m.group(1))
    nums = re.findall(rf"(?<![0-9০-৯A-Za-z]){D}+(?:/{D}+)?(?![0-9০-৯A-Za-z])", s)
    return bn.ascii_digits(nums[0]) if len(nums) == 1 else None  # 'যারে\n১২০': junk line above the number


@dataclass
class _Ctx:
    locator: Locator
    method: str
    notes: list[str] = field(default_factory=list)

    def f(self, value: Any, verbatim: str | None = None, strength: float = LABELLED, where: str | None = None,
          conf: float | None = None, bbox: list[float] | None = None, method: str | None = None) -> Field | None:
        if value is None or value == "":
            return None
        if conf is None:
            base, found_bbox = self.locator.find(where or verbatim or (value if isinstance(value, str) else None))
            conf, bbox = base, bbox or found_bbox
        return Field(value=value, verbatim=verbatim, confidence=round(max(0.0, min(1.0, conf * strength)), 4),
                     source=Source(page=1, bbox=bbox) if bbox else None, method=method or self.method)  # type: ignore[arg-type]

    def computed(self, value: Any, conf: float | None) -> Field | None:
        if value is None:
            return None
        return Field(value=value, confidence=round(conf if conf is not None else 0.9, 4), method="computed")


class HistoricalDeedParser:
    def __init__(self, ocr: OCRResult, pages: int | None = None, deed_class: DeedClass | None = None) -> None:
        self.ocr = ocr
        self.text = nfc(ocr.text or "")
        self.lines = [ln for ln in self.text.splitlines() if not _FOOTER.search(ln) or len(ln) > 80]
        self.body = "\n".join(self.lines)
        self.flat = re.sub(r"\s+", " ", self.body)
        self.tables: tuple[OCRTable, ...] = ocr.tables
        self.pages = pages
        self.cls = deed_class or classify(self.text, self.tables)
        every = self.text + " ".join(c.text for t in self.tables for c in t.cells)
        self.bangla_digits = len(re.findall("[০-৯]", every)) > len(re.findall("[0-9]", every))
        self.c = _Ctx(Locator(ocr), "text-layer" if ocr.provider == "pdf-text" else "ocr+rules")

    # ---- top level -----------------------------------------------------------------------------
    def parse(self) -> LHDR:
        rec = LHDR()
        rec.registration = self.registration()
        rec.dates = self.dates()
        kind = self.cls.deed_kind
        rec.parties = self.parties(kind)
        rec.consideration = self.consideration()
        rec.schedule = self.schedule()
        rec.title_recital = self.recital(kind)
        rec.execution = self.execution()
        self.consensus(rec)
        rec.document = self.document(rec, kind)
        rec.notes = self.c.notes
        return finish(rec)

    # ---- A. document ---------------------------------------------------------------------------
    def document(self, rec: LHDR, kind: DeedKind) -> Document:
        c = self.c
        era, era_conf = None, None
        ex = rec.dates.execution if rec.dates else None
        if ex and ex.gregorian_from and ex.gregorian_from.value:
            era, era_conf = era_of(ex.gregorian_from.value), ex.gregorian_from.confidence
        elif ex and ex.year and ex.year.value and (ex.calendar is None or ex.calendar.value == "bangla"):
            eras = {era_of(date(ex.year.value + k, m, 1)) for k, m in ((593, 4), (594, 4))}
            if len(eras) == 1:  # the Bangla year spans two Gregorian years; both in one era
                era, era_conf = eras.pop(), (ex.year.confidence or 0) * 0.9
        if era is None and self.cls.era:
            era, era_conf = self.cls.era, self.cls.score * 0.8
        langs = ["bn"]
        if re.search(r"\((?:[A-Z][a-z]+\s*){1,4}\)", self.text) or re.search(nfc(r"ইংরেজি\s*[:ঃ]?\s*" + D), self.text):
            langs.append("en")  # English words in the deed, or an English (Gregorian) date
        return Document(
            kind=c.computed(kind, max(self.cls.score, 0.6)), era=c.computed(era, era_conf),
            languages=[c.computed(x, 0.9) for x in langs],  # type: ignore[misc]
            pages=c.computed(self.pages, 1.0) if self.pages else None,
        )

    # ---- B. registration -----------------------------------------------------------------------
    def registration(self) -> Registration:
        c, reg = self.c, Registration()
        if m := _DEED_NO.search(self.text):
            raw = re.sub(r"\s+", "", m.group(1))
            reg.deed_no = c.f(bn.ascii_digits(raw), raw, LABELLED, where=raw)
            reg.deed_no_verbatim = c.f(raw, raw, LABELLED, where=raw)
        if m := _OFFICE.search(self.text):
            place, changed = gazetteer.snap(clean_text(m.group(1)), "thana")
            word = "সাব-রেজিস্ট্রার" if "ার" in m.group(2) else "সাব-রেজিস্ট্রি"
            if place:
                reg.office = c.f(f"{place} {word} অফিস", m.group(0), SNAPPED if changed else PROSE, where=m.group(0))
        if m := _VOLUME.search(self.text):
            reg.volume = c.f(f"বহি নং {m.group(1)}, জিল্দ {m.group(2)}", m.group(0), LABELLED, where=m.group(0))
        return reg

    # ---- C. dates ------------------------------------------------------------------------------
    def dates(self) -> Dates | None:
        c = self.c
        found = [d for d in bn.find_dates(self.text) if d.calendar == "bangla"]
        head = _DATE_LABEL.search(self.text)
        d = None
        if head:
            d = next((x for x in found if head.start() <= x.start <= head.end()), None)
        d = d or (found[0] if found else None)
        strength = LABELLED if d and head and head.start() <= d.start <= head.end() else PROSE
        if d is None and head and (m := _PARTIAL_DATE.search(head.group(1))):
            day, year = int(bn.ascii_digits(m.group(1))), int(bn.ascii_digits(m.group(2)))
            if 1100 <= year <= 1450:  # month unreadable: keep what was read, no Gregorian range
                return Dates(execution=DeedDate(calendar=c.computed("bangla", 0.6), day=c.f(day, m.group(1), WEAK, where=m.group(0)),
                                                year=c.f(year, m.group(2), WEAK, where=m.group(0))))
            return None
        if d is None:
            return None
        lo, hi, prec = d.to_gregorian()
        conf, bbox = c.locator.find(d.verbatim)
        conf *= strength * (WEAK if d.corrected else 1.0)
        if d.corrected:
            c.notes.append(f"execution date: year read with a look-alike first digit, corrected to {d.year}")

        def mk(v: Any, verb: str | None = None) -> Field | None:
            return c.f(v, verb, 1.0, conf=conf, bbox=bbox)

        return Dates(execution=DeedDate(
            verbatim=mk(d.verbatim, d.verbatim), calendar=c.computed("bangla", conf), day=mk(d.day),
            month=mk(d.month), year=mk(d.year), gregorian_from=c.computed(lo, conf), gregorian_to=c.computed(hi, conf),
            precision=c.computed(prec, conf),
        ))

    # ---- D. parties ----------------------------------------------------------------------------
    def _party_blocks(self) -> list[tuple[str, str]]:
        """[(heading words, person text)] for ১ম / ২য় পক্ষ, in order."""
        heads = list(_PARTY_HEAD.finditer(self.body)) or list(_PARTY_HEAD_NAME.finditer(self.body))
        out = []
        for i, h in enumerate(heads[:4]):
            end = heads[i + 1].start() if i + 1 < len(heads) else len(self.body)
            block = self.body[h.end(): end]
            if (b := _BODY_START.search(block)) and b.start() > 0:
                block = block[: b.start()]
            if i + 1 < len(heads):  # drop the next heading's "২য়" / "দ্বিতীয়" prefix
                block = re.sub(nfc(r"\n?[^\n]{0,12}$"), "", block) if "\n" in block else block
            out.append((next((g for g in h.groups() if g), ""), block))
        return out

    def _two_column_blocks(self) -> list[tuple[str, str]] | None:
        """Both parties printed side by side (১ম পক্ষ left, ২য় পক্ষ right): each column's lines,
        rebuilt from the word boxes, up to the body text."""
        words = self.ocr.words
        heads = [w for w in words if nfc(w.text).startswith("পক্ষ")]
        pair = next(((a, b) for a in heads for b in heads if b.bbox[0] > a.bbox[0] + 200
                     and abs(a.bbox[1] - b.bbox[1]) < max(a.bbox[3], 12)), None)
        if pair is None:
            return None
        a, b = pair
        line_h = max(a.bbox[3], 12)
        left_of_b = [w for w in words if abs(w.bbox[1] - b.bbox[1]) < line_h and w.bbox[0] < b.bbox[0] and w.bbox[0] > a.bbox[0]]
        split = max((w.bbox[0] for w in left_of_b), default=b.bbox[0]) - 4
        top = max(a.bbox[1], b.bbox[1]) + line_h * 0.6
        body = [w for w in words if w.bbox[1] > top and _BODY_START.match("\n" + nfc(w.text))]
        bottom = min((w.bbox[1] for w in body), default=top + line_h * 8)
        out = []
        for lo, hi in ((-1, split), (split, 1e9)):
            ws = [w for w in words if top < w.bbox[1] < bottom - line_h * 0.3 and lo <= w.bbox[0] < hi]
            lines: list[list[OCRWord]] = []
            for w in sorted(ws, key=lambda w: w.bbox[1] + w.bbox[3] / 2):
                cy = w.bbox[1] + w.bbox[3] / 2
                if lines and abs(cy - (lines[-1][0].bbox[1] + lines[-1][0].bbox[3] / 2)) < line_h * 0.6:
                    lines[-1].append(w)
                else:
                    lines.append([w])
            text = ", ".join(" ".join(w.text for w in sorted(ln, key=lambda w: w.bbox[0])) for ln in lines)
            out.append(("", text))
        return out

    def parties(self, kind: DeedKind) -> list[Party]:
        side = SIDE_ROLES.get(kind, (Role.SELLER, Role.BUYER))
        out = []
        blocks = self._party_blocks()
        first = clean_text(blocks[0][1]) if blocks else None
        if len(blocks) >= 2 and (not first or len(first) <= 10) and (two := self._two_column_blocks()):
            blocks = two  # the first block is empty: the second heading is on the same line
        for i, (heading, block) in enumerate(blocks):
            role = next((r for w, r in HEADING_ROLES if w in nfc(heading)), None)
            if role is None or (kind in (DeedKind.GIFT_DANPATRA, DeedKind.GIFT_HEBA) and role in (Role.SELLER, Role.BUYER)):
                role = side[min(i, 1)]
            if p := self.person(block, role):
                out.append(p)
        return out

    def person(self, block: str, role: Role) -> Party | None:
        c = self.c
        text = re.sub(r"\s+", " ", nfc(block)).strip(" :;,/|")
        if not text:
            return None
        marks = list(_LABEL_RE.finditer(text))
        vals: dict[str, str] = {}
        extra: list[str] = []  # comma parts with no label (a line lost its label to OCR)
        for i, m in enumerate(marks):
            key = m.lastgroup or ""
            if key == "name" and i > 0:
                continue
            end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
            v, *rest = text[m.end(): end].split(",")
            v = v.strip(" ;।|")
            if key not in vals and v:
                vals[key] = v
            extra += [x for x in rest if clean_text(x)]
        for x in extra:  # an unlabelled 'হিন্দু' is the religion
            for key, vocab in (("religion", RELIGIONS), ("profession", PROFESSIONS), ("nationality", NATIONALITIES)):
                v = clean_text(x)
                if key not in vals and v and _snap(v, vocab, 90)[0] in vocab:
                    vals[key] = x
                    break
        lead = text[: marks[0].start()] if marks else text.split(",")[0]
        if "name" in vals and not clean_text(lead):
            lead = vals.pop("name")
        p = Party(role=Field(value=role, confidence=0.9, method="computed"))
        honorific, name, hconf = self._honorific(lead)
        p.honorific = c.f(honorific, honorific, LABELLED * hconf) if honorific else None
        p.name = c.f(name, lead.strip(" ,"), PROSE if _intact(lead, name) else WEAK, where=name)
        for key in ("father", "husband"):
            if key in vals:
                rel_name, deceased, strength = self._relative(vals[key])
                if rel_name:
                    setattr(p, key, Relative(name=c.f(rel_name, vals[key], LABELLED if _intact(vals[key], rel_name) else WEAK, where=rel_name),
                                             deceased=c.f(True, None, strength, where=vals[key]) if deceased else None))
        if "mother" in vals:
            p.mother = c.f(clean_text(vals["mother"]), vals["mother"], LABELLED)
        addr = Address()
        for key, kind in (("village", None), ("post", None), ("union", None), ("thana", "thana"), ("pargana", None), ("district", "district")):
            if key in vals and (v := clean_text(vals[key])):
                snapped, changed = gazetteer.snap(v, kind) if kind else (v, False)
                setattr(addr, key, c.f(snapped, vals[key], SNAPPED if changed else LABELLED, where=v))
        p.address = addr if addr.model_dump(exclude_none=True) else None
        for key, vocab in (("profession", PROFESSIONS), ("religion", RELIGIONS), ("nationality", NATIONALITIES)):
            if key in vals and (v := clean_text(vals[key])):
                snapped, changed = _snap(v, vocab, 80 if key == "nationality" else 85)
                setattr(p, key, c.f(snapped, vals[key], SNAPPED if changed else LABELLED, where=v))
        return p if p.name else None

    @staticmethod
    def _honorific(lead: str) -> tuple[str | None, str | None, float]:
        s = re.sub(nfc(r"(?<![ঀ-৿])মো[:ঃ.]?(?=\s)"), "মোঃ", nfc(lead).strip())  # OCR drops the visarga of মোঃ
        s = re.sub(r"^নাম\s*[:ঃ]\s*", "", s)
        conf = 1.0
        if _ORPHAN_SHRI.match(s):
            return "শ্রী", clean_text(_ORPHAN_SHRI.sub("", s)), 0.7
        toks = s.split()
        while toks and _JUNK_TOKEN.match(toks[0]):
            toks.pop(0)
            conf = 0.8
        s = " ".join(toks)
        for h in HONORIFICS:
            if s.startswith(h) and (len(s) == len(h) or not re.match(f"[{_B}]", s[len(h)]) or h == "শ্রী"):
                return h, clean_text(s[len(h):]), conf
        return None, clean_text(s), conf

    @staticmethod
    def _relative(v: str) -> tuple[str | None, bool, float]:
        s = nfc(v).strip()
        toks = s.split()
        if toks and _JUNK_TOKEN.match(toks[0]):  # 'WHT নগেন্দ্রনাথ ঘোষ': the prefix is unreadable
            return clean_text(" ".join(toks[1:])), False, 0
        for w in DECEASED:
            if s.startswith(w):
                return clean_text(s[len(w):]), True, LABELLED
        for w in DECEASED_GARBLED:
            if s.startswith(w):
                return clean_text(s[len(w):]), True, WEAK
        return clean_text(s), False, 0

    # ---- E. consideration ----------------------------------------------------------------------
    def consideration(self) -> Consideration | None:
        c = self.c
        start = _BODY_START.search(self.body)
        body = self.body[start.start():] if start else self.body
        m = bn.parse_money(body)
        if m is None or m.amount is None:
            return None
        strength = LABELLED if m.agree else (PROSE if m.agree is None else WEAK)
        con = Consideration(
            amount=c.f(m.amount, m.figure, strength, where=m.figure),
            in_words=c.f(bn.canonical_words(m.words), m.words, PROSE) if m.words else None,
            currency_written=c.f(m.currency, m.currency, PROSE, where=body[m.start: m.end]) if m.currency else None,
        )
        before, after = body[max(0, m.start - 30): m.start], body[m.end: m.end + 20]
        if mm := re.search(nfc(r"(এককালীন\s+নগদ|নগদ)\s*$"), before):
            con.mode = c.f(mm.group(1), mm.group(1), PROSE)
        elif mm := re.match(nfc(r"\s*(?:টাকা|রুপি)?\s*(নগদ)"), after):
            con.mode = c.f(mm.group(1), mm.group(1), PROSE)
        if m.agree is False:
            c.notes.append(f"consideration: figure {m.figure} disagrees with the words ({m.words}); the words were used")
        return con

    # ---- F. schedule ---------------------------------------------------------------------------
    def schedule(self) -> list[Plot]:
        plots = self._plots_from_tables()
        if len(plots) == 1 and (m := _SCHEDULE_HEAD.search(self.body)):
            self._fill_from_text(plots[0], self.body[m.end():])  # a grid holding only part of the schedule
        plots = plots or self._plots_from_text()
        c = self.c
        if m := _PARGANA.search(self.text):
            for p in plots:
                v, changed = gazetteer.snap(m.group(1), "thana")  # most parganas gave their name to a thana
                p.pargana = p.pargana or c.f(v, m.group(0), SNAPPED if changed else LABELLED, where=m.group(1))
        if m := _JL.search(self.text):
            for p in plots:
                p.jl_no = p.jl_no or c.f(bn.ascii_digits(m.group(1)), m.group(1), LABELLED, where=m.group(0))
        return plots

    def _cell_field(self, col: str, text: str, conf: float, bbox, plot: Plot, header: str = "") -> None:
        c = self.c

        def f(v: Any, strength: float = CELL) -> Field | None:
            return c.f(v, text, strength, conf=conf, bbox=list(map(float, bbox)) if bbox else None)

        if col in ("district", "thana"):
            v = clean_text(text)
            snapped, changed = gazetteer.snap(v, col)
            setattr(plot, col, f(snapped, SNAPPED if changed else CELL))
        elif col in ("mouza", "pargana"):
            setattr(plot, col, f(clean_text(text)))
        elif col in ("khatian_no", "jl_no"):
            setattr(plot, col, f(_number(text, self.bangla_digits)))
            if col == "khatian_no" and (s := _survey(header)):
                plot.survey = c.computed(Survey(s), conf * CELL)
        elif col == "dag_no":
            dags = [_number(t, self.bangla_digits) for t in re.split(r"[,،;]\s*", nfc(text).split("(")[0])]
            plot.dag_no = [x for x in (f(d) for d in dags if d) if x]
            if plot.survey is None and (s := _survey(header)):
                plot.survey = c.computed(Survey(s), conf * CELL)
        elif col == "area":
            self._area(text, plot, conf, bbox)
        elif col == "land_class":
            v, changed = _snap(clean_text(nfc(text).split("(")[0]), LAND_CLASSES, 75)
            plot.land_class = f(v, SNAPPED if changed else CELL)
        elif col == "boundaries":
            self._bounds(text, plot, conf, bbox)

    def _area(self, text: str, plot: Plot, conf: float, bbox) -> None:
        c = self.c
        a = bn.parse_area(text)
        bb = list(map(float, bbox)) if bbox else None
        if a is None:
            return
        strength = CELL if a.words_agree in (True, None) else WEAK
        area = Area(
            value=c.f(bn.tidy(a.value), a.verbatim, strength, conf=conf, bbox=bb) if a.value is not None else None,
            unit=c.f(a.unit, a.verbatim, strength, conf=conf, bbox=bb),
            parts={u: c.f(n, a.verbatim, strength, conf=conf, bbox=bb) for u, n in a.parts.items()} or None,  # type: ignore[misc]
            in_words=c.f(bn.canonical_words(a.in_words), a.in_words, strength, conf=conf, bbox=bb) if a.in_words else None,
            decimal_equiv=c.computed(bn.tidy(a.decimal_equiv), conf * strength) if a.decimal_equiv is not None else None,
        )
        plot.area = area
        rest = nfc(text)[nfc(text).find(a.verbatim) + len(a.verbatim):] if a.verbatim in nfc(text) else ""
        if plot.land_class is None and (m := re.match(nfc(rf"\s*([{_B}]+)\s+জমি"), rest)):
            v, _ = _snap(m.group(1), LAND_CLASSES, 75)
            if v in LAND_CLASSES:
                plot.land_class = c.f(v, m.group(1), CELL, conf=conf, bbox=bb)

    def _bounds(self, text: str, plot: Plot, conf: float | None, bbox) -> None:
        c = self.c
        b = bn.parse_boundaries(text, by_order=True)
        if not b:
            return
        bb = list(map(float, bbox)) if bbox else None
        kw: dict[str, Any] = {}
        for d, v in b.items():
            v2, strength = clean_text(v), (WEAK if d.endswith("?") else 1.0)
            if conf is None:
                kw[d.rstrip("?")] = c.f(v2, v, PROSE * strength, where=v2)
            else:
                kw[d.rstrip("?")] = c.f(v2, v, CELL * strength, conf=conf, bbox=bb)
        plot.boundaries = Boundaries(**kw)

    def _plots_from_tables(self) -> list[Plot]:
        plots: list[Plot] = []
        for t in self.tables:
            rows: dict[int, list] = {}
            for cell in t.cells:
                rows.setdefault(cell.row, []).append(cell)
            header: dict[int, tuple[str, str]] | None = None  # col -> (field, header text)
            cur: Plot | None = None
            for r in sorted(rows):
                cells = sorted(rows[r], key=lambda x: x.col)
                cols = {cell.col: _col_of(cell.text) for cell in cells}
                if header is None and sum(1 for v in cols.values() if v) >= 2 and len(cells) >= 3:
                    header = {cell.col: (cols[cell.col], cell.text) for cell in cells if cols[cell.col]}  # type: ignore[misc]
                    continue
                if header is None:
                    continue
                texts = [cell.text.strip() for cell in cells]
                if len(cells) >= 3 and sum(1 for cell in cells if cell.col in header and cell.text.strip()) >= 3:
                    cur = Plot()
                    plots.append(cur)
                    for cell in cells:
                        if cell.col in header and cell.text.strip():
                            fld, htext = header[cell.col]
                            self._cell_field(fld, cell.text, cell.confidence, cell.bbox, cur, htext)
                    continue
                if cur is None:
                    cur = Plot()
                    plots.append(cur)
                if len(cells) >= 2 and (lab := _col_of(texts[0])) and texts[1]:
                    self._cell_field(lab, cells[1].text, cells[1].confidence, cells[1].bbox, cur, texts[0])
                elif len(cells) == 1 and len(bn.parse_boundaries(texts[0])) >= 2:
                    self._bounds(texts[0], cur, cells[0].confidence, cells[0].bbox)
        return [p for p in plots if p.model_dump(exclude_none=True, exclude_defaults=True)]

    def _plots_from_text(self) -> list[Plot]:
        """`label: value` lines of the schedule (text layer / OCR without a grid)."""
        m = _SCHEDULE_HEAD.search(self.body)
        part = self.body[m.end():] if m else ""
        if not part:
            return []
        return [plot] if (plot := self._fill_from_text(Plot(), part)).model_dump(exclude_none=True, exclude_defaults=True) else []

    def _fill_from_text(self, plot: Plot, part: str) -> Plot:
        lines = part.splitlines()
        if (bm := re.search(nfc(r"(?:চৌহ\S*|চতু\S*সীমা\S*)[^\n]*[:ঃ-]\s*\n"), part)) and plot.boundaries is None:
            nxt = part[bm.end():].splitlines()[:6]
            nxt = list(itertools.takewhile(lambda x: not re.search(nfc(r"স্বাক্ষর|সাক্ষ|সাক্ষর"), x), nxt))
            if nxt:
                self._bounds(", ".join(x.strip(" ,|") for x in nxt), plot, None, None)
        for ln in lines:
            if len(bn.parse_boundaries(ln)) >= 2:
                if plot.boundaries is None:
                    self._bounds(ln, plot, None, None)
                if plot.area is None and (a := bn.parse_area(ln)) and (a.parts or a.value):
                    conf, bbox = self.c.locator.find(a.verbatim)
                    self._area(a.verbatim, plot, conf * WEAK / CELL, bbox)
                continue
            for seg in re.split(nfc(r",\s*(?=[^,:ঃ]{2,30}[:ঃ])"), ln):  # 'থানা: কোতোয়ালী, মৌজা: …' on one line
                lm = re.match(nfc(r"\s*([^:ঃ\n]{2,30}?)\s*[:ঃ]\s*(.+)$"), seg)
                if not lm or not (col := _col_of(lm.group(1))) or col == "boundaries":
                    continue
                if getattr(plot, col, None) not in (None, []):
                    continue
                conf, bbox = self.c.locator.find(lm.group(2))
                self._cell_field(col, lm.group(2).strip(" ,"), conf, bbox, plot, lm.group(1))
        return plot

    # ---- G. title recital ----------------------------------------------------------------------
    def recital(self, kind: DeedKind) -> TitleRecital | None:
        c, flat = self.c, self.flat
        tr = TitleRecital()
        for ph in BASIS_PHRASES:
            if nfc(ph) in flat:
                tr.basis = c.f(ph, ph, PROSE)
                break
        else:
            al = None
            for ph in BASIS_PHRASES:
                a = fuzz.partial_ratio_alignment(nfc(ph), flat)
                if a and a.score >= 90 and (al is None or a.score > al[1].score):
                    al = (ph, a)
            if al:
                tr.basis = c.f(al[0], flat[al[1].dest_start: al[1].dest_end], SNAPPED)
            elif m := re.search(nfc(rf"আমার\s+\S*[A-Za-z]\S*\s+দখলীয়(?![{_B}])"), flat):
                tr.basis = c.f("স্বত্ব দখলীয়", m.group(0), WEAK, where="দখলীয়")
        if kind == DeedKind.MORTGAGE_REHEN and re.search(nfc(r"রেহেন\s*আবদ্ধ|রেহেন\s*রাখি"), flat):
            tr.nature = c.f("রেহেন", "রেহেন", PROSE)
        elif m := _PERPETUAL.search(flat):
            tr.nature = c.f("চিরস্থায়ী", m.group(0), PROSE if m.group(0).startswith("চিরস্থা") else SNAPPED)
        if m := _ENCUMBRANCE.search(flat):
            tr.encumbrance_free = c.f(True, m.group(0), PROSE)
        return tr if tr.model_dump(exclude_none=True) else None

    # ---- H. execution --------------------------------------------------------------------------
    def execution(self) -> Execution | None:
        c = self.c
        ex = Execution()
        sig = re.search(nfc(r"দাতার\s+(.{2,24}?)\s+স\S{0,3}ক্ষ?\S*গণের"), self.text)
        if sig:
            raw = re.sub(r"\s*/\s*", " / ", sig.group(1).strip())
            v, changed = _snap(raw, MARKS, 70)
            if v in MARKS:
                ex.seller_mark = c.f(v, sig.group(1), SNAPPED if changed else PROSE, where=sig.group(1))
        if ex.seller_mark is None and (m := re.search(nfc(r"নিজ\s+(স্বাক্ষর\s*\(বা\s+টিপ\S+\))"), self.text)):
            ex.seller_mark = c.f("স্বাক্ষর (বা টিপসহি)", m.group(1), PROSE)
        wit, writer = self._signature_columns()
        ex.witnesses = wit
        ex.deed_writer = writer
        if m := _STAMP.search(self.text):
            ex.stamps = [Stamp(value=c.f(f"{m.group(1)} {m.group(2)}", m.group(0), PROSE, where=m.group(1)))]
        return ex if ex.model_dump(exclude_none=True, exclude_defaults=True) else None

    def _signature_columns(self) -> tuple[list[Party], DeedWriter | None]:
        c = self.c
        words = self.ocr.words
        heads = [w for w in words if _SIG_HEAD.search(nfc(w.text))]
        if not words or not heads:
            return [], None
        head = max(heads, key=lambda w: w.bbox[1])
        hy, hh = head.bbox[1], max(head.bbox[3], 12)
        x0 = min(w.bbox[0] for w in words)
        x1 = max(w.bbox[0] + w.bbox[2] for w in words)
        third = (x1 - x0) / 3

        def col(w: OCRWord) -> int:
            return min(2, max(0, int((w.bbox[0] + w.bbox[2] / 2 - x0) / third)))

        wit_col = col(head)
        writer_heads = [w for w in words if "লেখক" in nfc(w.text) and abs(w.bbox[1] - hy) < hh * 1.5]
        writer_col = col(writer_heads[0]) if writer_heads and col(writer_heads[0]) != wit_col else (2 if wit_col != 2 else None)
        below = [w for w in words if hy + hh * 0.6 < w.bbox[1] < hy + hh * 8 and w.bbox[2] < (x1 - x0) * 0.5
                 and not re.search(nfc(r"পৃষ্ঠা|মৌজা"), w.text)]
        lines: list[list[OCRWord]] = []
        for w in sorted(below, key=lambda w: w.bbox[1] + w.bbox[3] / 2):
            cy = w.bbox[1] + w.bbox[3] / 2
            if lines and abs(cy - (lines[-1][0].bbox[1] + lines[-1][0].bbox[3] / 2)) < hh * 0.6:
                lines[-1].append(w)
            else:
                lines.append([w])
        witnesses: list[Party] = []
        writer_words: list[OCRWord] = []
        for ln in lines:
            cols: dict[int, list[OCRWord]] = {}
            for w in sorted(ln, key=lambda w: w.bbox[0]):
                cols.setdefault(col(w), []).append(w)
            if wit_col in cols:
                ws = cols[wit_col]
                while ws and re.fullmatch(nfc(rf"[\W০-৯0-9A-Za-z]{{1,3}}।?|{D}+।?"), nfc(ws[0].text)):
                    ws = ws[1:]  # '১।', '২', '51' numbering
                txt = " ".join(w.text for w in ws)
                hon, name, _ = self._honorific(txt)
                if name and len(name) >= 3:
                    conf, bbox = fmean(w.confidence for w in ws), _bbox(ws)
                    witnesses.append(Party(role=Field(value=Role.WITNESS, confidence=0.9, method="computed"),
                                           honorific=c.f(hon, hon, PROSE, conf=conf, bbox=bbox) if hon else None,
                                           name=c.f(name, txt, PROSE, conf=conf, bbox=bbox)))
            if writer_col is not None:
                writer_words += cols.get(writer_col, [])
        writer = None
        if writer_words:
            txt = " ".join(w.text for w in writer_words)
            conf, bbox = fmean(w.confidence for w in writer_words), _bbox(writer_words)
            lic = _LICENCE.search(nfc(txt))
            name = clean_text(re.split(nfc(r"[\(（]|দলিল\s*লেখক"), nfc(txt)[: lic.start()] if lic else nfc(txt))[0])
            if name and len(name) >= 3:
                writer = DeedWriter(name=c.f(name, txt, PROSE, conf=conf, bbox=bbox),
                                    licence_no=c.f(lic.group(1), lic.group(0), PROSE, conf=conf, bbox=bbox) if lic else None)
        return witnesses, writer

    # ---- consensus over repeated place names ---------------------------------------------------
    def consensus(self, rec: LHDR) -> None:
        """The same place is printed several times; a near-miss of a more frequent spelling is replaced."""
        groups: dict[str, list[tuple[Any, str]]] = {"village": [], "thana": [], "district": []}
        for p in rec.parties:
            if p.address:
                for k, g in (("village", "village"), ("thana", "thana"), ("district", "district")):
                    if (f := getattr(p.address, k)) is not None:
                        groups[g].append((f, k))
        for pl in rec.schedule:
            for k, g in (("mouza", "village"), ("thana", "thana"), ("district", "district")):
                if (f := getattr(pl, k)) is not None:
                    groups[g].append((f, k))
        office = rec.registration.office if rec.registration else None
        if office and office.value:
            place, _, tail = str(office.value).partition(" সাব-")
            thanas = Counter(str(f.value) for f, _ in groups["thana"] if f.value)
            best = max((t for t in thanas if t != place and fuzz.ratio(t, place) >= 80), key=lambda t: thanas[t], default=None)
            if best:
                office.value = f"{best} সাব-{tail}"
                office.confidence = round((office.confidence or 0) * SNAPPED, 4)
        foot = [m.group(1) for m in _FOOT_MOUZA.finditer(self.text)]
        for g, items in groups.items():
            votes = Counter(str(f.value) for f, _ in items if f.value)
            if g == "village":
                votes.update(foot)
            for f, _ in items:
                v = str(f.value)
                best = max((w for w in votes if w != v and fuzz.ratio(w, v) >= 80), key=lambda w: votes[w], default=None)
                if best and votes[best] > votes[v]:
                    f.value = best
                    f.confidence = round((f.confidence or 0) * SNAPPED, 4)

# ---- computed sections --------------------------------------------------------------------------

def _computed(value: Any, conf: float | None) -> Field | None:
    return None if value is None else Field(value=value, confidence=round(conf if conf is not None else 0.9, 4), method="computed")


def finish(rec: LHDR) -> LHDR:
    """Fill what is computed, not read, where it is missing (also after fusion): era from the execution
    date, the era's currency, the modern place (I) and the 13 core fields (J)."""
    ex = rec.dates.execution if rec.dates else None
    if ex and ex.gregorian_from and ex.gregorian_from.value:
        rec.document = rec.document or Document()
        if rec.document.era is None:
            rec.document.era = _computed(era_of(ex.gregorian_from.value), ex.gregorian_from.confidence)
    era = rec.document.era if rec.document else None
    if rec.consideration and era and era.value and rec.consideration.era_currency is None:
        rec.consideration.era_currency = _computed(ERA_CURRENCY.get(era.value), era.confidence)
    if rec.modern_mapping is None:
        places = [(p.thana, p.district) for p in rec.schedule] + [
            (p.address.thana, p.address.district) for p in rec.parties if p.address]
        for t, d in places:
            m = gazetteer.modern(t.value if t else None, d.value if d else None)
            if m and m.upazila:
                conf = min(x.confidence or 0 for x in (t, d) if x) * (0.95 if m.exact else 0.9)
                rec.modern_mapping = ModernMapping(division=_computed(m.division, conf), district=_computed(m.district, conf),
                                                   upazila=_computed(m.upazila, conf))
                break
    rec.core = Core(**derive_core(rec))
    return rec


# ---- provider -----------------------------------------------------------------------------------

def page_count(data: bytes) -> int:
    if data[:5] == b"%PDF-":
        try:
            from ai.preprocessing.pdf import pdf_page_count  # noqa: PLC0415

            return pdf_page_count(data)
        except Exception:  # a page count must never break extraction
            return 1
    return 1


def parse(ocr: OCRResult, data: bytes | None = None, deed_class: DeedClass | None = None) -> LHDR:
    """OCR result -> LHDR record (rules only)."""
    return HistoricalDeedParser(ocr, page_count(data) if data else None, deed_class).parse()


class HistoricalDeedProvider:
    """Historical-deed extractor (H4): rules, plus the vision LLM when one is configured, fused.

    `llm` is anything with `extract_lhdr(data, ocr) -> (dict | None, warnings)` (ClaudeDocumentAIProvider).
    Without it (no API key) the rule parser alone fills the record. The result carries the 13 core fields
    (derived from the record, so the rest of LandShield is unchanged) and the record itself.
    """

    name = "historical"

    def __init__(self, llm: Any = None) -> None:
        self.llm = llm

    def extract(self, data: bytes, ocr: OCRResult, deed_class: DeedClass | None = None) -> ExtractionResult:
        rec = parse(ocr, data, deed_class)
        provider, model, warnings = "rules", None, []
        if self.llm is not None:
            llm_rec, warnings = self.llm.extract_lhdr(data, ocr)
            if llm_rec is not None:
                from ai.extraction import fuse  # noqa: PLC0415

                rec = finish(fuse.fuse(rec, llm_rec, ocr.text or ""))
                provider, model = "fused", getattr(self.llm, "model", None)
        return ExtractionResult(
            provider=provider, fields=derive_fields(rec), model=model, warnings=list(warnings),
            record=rec.model_dump(mode="json", by_alias=True, exclude_none=True, exclude_defaults=False),
        )
