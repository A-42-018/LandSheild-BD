# ruff: noqa: E501
"""LandShield Historical Deed Record, LHDR v1 (H1): the digital format of a historical deed.

docs/historical-deed-roadmap.md §2 defines it. One record per deed, sections A-J; every leaf value is a
`Field` (value + verbatim + confidence + source bbox + method + legibility). A plain value is accepted
as shorthand for `Field(value=...)`, which is how the gold files in database/sample_data/historical/
are written. `plain()` turns a record back into that shorthand (what the H0 scorer compares).

Two levels of checking:
- the Pydantic models reject wrong *shape* (unknown keys, wrong types, unknown enum values);
- `check()` reports *content* problems as `Issue`s (missing seller, area <= 0, date in the future...),
  so a half-read machine record still loads and the reviewer sees what is missing.

    python -m ai.extraction.lhdr schema          # writes docs/lhdr-v1.schema.json
    python -m ai.extraction.lhdr check FILE...   # validates LHDR JSON files, prints issues
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any, Generic, Literal, TypeVar

import pydantic
from pydantic import BaseModel, BeforeValidator, ConfigDict

from ai.ocr import normalize

SCHEMA = "lhdr/1"
SCHEMA_FILE = Path(__file__).resolve().parents[2] / "docs" / "lhdr-v1.schema.json"


# ---- enums --------------------------------------------------------------------------------------

class DeedKind(StrEnum):
    SALE_SAF_KABALA = "SALE_SAF_KABALA"  # সাফ কবলা
    GIFT_HEBA = "GIFT_HEBA"  # হেবা
    GIFT_DANPATRA = "GIFT_DANPATRA"  # দানপত্র
    PARTITION_BANTONNAMA = "PARTITION_BANTONNAMA"  # বণ্টননামা
    EXCHANGE_EWAZ = "EXCHANGE_EWAZ"  # এওয়াজ
    MORTGAGE_REHEN = "MORTGAGE_REHEN"  # রেহেন / বন্ধক
    WAQF = "WAQF"  # ওয়াকফ
    POWER_OF_ATTORNEY = "POWER_OF_ATTORNEY"  # আমমোক্তারনামা
    AGREEMENT_BAINANAMA = "AGREEMENT_BAINANAMA"  # বায়নানামা
    OTHER = "OTHER"


class Era(StrEnum):
    BRITISH_INDIA = "BRITISH_INDIA"  # before 15 Aug 1947
    EAST_BENGAL_PAKISTAN = "EAST_BENGAL_PAKISTAN"  # 1947 - 16 Dec 1971
    BANGLADESH = "BANGLADESH"


class Role(StrEnum):
    SELLER = "SELLER"
    BUYER = "BUYER"
    DONOR = "DONOR"
    DONEE = "DONEE"
    MORTGAGOR = "MORTGAGOR"
    MORTGAGEE = "MORTGAGEE"
    PRINCIPAL = "PRINCIPAL"  # gives a power of attorney
    ATTORNEY = "ATTORNEY"
    WAQIF = "WAQIF"
    MUTAWALLI = "MUTAWALLI"
    SHARER = "SHARER"  # partition: every co-sharer is on both sides
    EXCHANGER = "EXCHANGER"
    WITNESS = "WITNESS"
    IDENTIFIER = "IDENTIFIER"  # সনাক্তকারী
    OTHER = "OTHER"


class Calendar(StrEnum):
    BANGLA = "bangla"
    GREGORIAN = "gregorian"
    HIJRI = "hijri"


class Precision(StrEnum):
    DAY = "day"
    DAY_PM1 = "day±1"  # pre-1987 Bangla dates: month lengths varied
    MONTH = "month"
    YEAR = "year"


class Survey(StrEnum):
    CS = "CS"
    SA = "SA"
    RS = "RS"
    BS = "BS"
    DIARA = "DIARA"
    OTHER = "OTHER"


class Currency(StrEnum):
    INR = "INR"
    PKR = "PKR"
    BDT = "BDT"


class StampType(StrEnum):
    REVENUE = "REVENUE"
    NON_JUDICIAL = "NON_JUDICIAL"
    COURT_FEE = "COURT_FEE"
    OTHER = "OTHER"


Method = Literal["text-layer", "ocr+rules", "llm", "fused", "human", "computed"]
Legibility = Literal["clear", "faded", "damaged", "illegible"]

# who is on which side of the transfer (core seller/buyer, and the >= 1 seller / buyer rule)
TRANSFEROR_ROLES = (Role.SELLER, Role.DONOR, Role.MORTGAGOR, Role.PRINCIPAL, Role.WAQIF)
TRANSFEREE_ROLES = (Role.BUYER, Role.DONEE, Role.MORTGAGEE, Role.ATTORNEY, Role.MUTAWALLI)
MUTUAL_ROLES = (Role.SHARER, Role.EXCHANGER)

# area units: canonical name -> spellings found on deeds
MODERN_UNITS: dict[str, tuple[str, ...]] = {
    "acre": ("acre", "acres", "একর"), "decimal": ("decimal", "decimals", "dec", "শতক", "শতাংশ", "ডেসিমাল"),
    "bigha": ("bigha", "বিঘা"), "katha": ("katha", "কাঠা"), "sqft": ("sqft", "sq.ft", "বর্গফুট"),
    "sqm": ("sqm", "sq.m", "বর্গমিটার"),
}  # fmt: skip
ARCHAIC_UNITS: dict[str, tuple[str, ...]] = {
    "kani": ("kani", "কানি"), "ganda": ("ganda", "গণ্ডা", "গন্ডা"), "kora": ("kora", "কড়া"),
    "kranti": ("kranti", "ক্রান্তি"), "til": ("til", "তিল"), "chatak": ("chatak", "ছটাক"),
    "dhur": ("dhur", "ধুর"), "pakhi": ("pakhi", "পাখি"),
}  # fmt: skip
_UNIT_OF = {s.casefold(): u for table in (MODERN_UNITS, ARCHAIC_UNITS) for u, ss in table.items() for s in ss}


def canonical_unit(unit: str | None) -> str | None:
    """'একর' / 'Acres' -> 'acre'; None for an unknown unit."""
    return _UNIT_OF.get(unit.strip().casefold()) if unit else None


ERA_STARTS = ((date(1971, 12, 17), Era.BANGLADESH), (date(1947, 8, 15), Era.EAST_BENGAL_PAKISTAN))


def era_of(d: date) -> Era:
    return next((era for start, era in ERA_STARTS if d >= start), Era.BRITISH_INDIA)


# ---- Field --------------------------------------------------------------------------------------

T = TypeVar("T")
_TYPE_NAMES = {str: "Text", int: "Int", bool: "Bool", date: "Date", int | float: "Number", int | str: "IntOrText"}


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Source(_Model):
    page: Annotated[int, pydantic.Field(ge=1)]
    bbox: Annotated[list[float], pydantic.Field(min_length=4, max_length=4)] | None = None  # x, y, w, h


class Field(_Model, Generic[T]):
    """One value read from the deed. `value` is normalised; `verbatim` is exactly as written."""

    value: T | None = None
    verbatim: str | None = None
    confidence: Annotated[float, pydantic.Field(ge=0, le=1)] | None = None  # None: not stated (hand-written record)
    source: Source | None = None
    method: Method | None = None
    legibility: Legibility | None = None
    edited_by_human: bool = False

    @classmethod
    def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str:
        (t,) = params
        return "Field" + (_TYPE_NAMES.get(t) or t.__name__)


def _wrap(v: Any) -> Any:
    return v if isinstance(v, dict | Field) else {"value": v}


def leaf(t: Any) -> Any:
    """Field[t] that also accepts a bare value (`"রূপগঞ্জ"` == `{"value": "রূপগঞ্জ"}`)."""
    return Annotated[Field[t], BeforeValidator(_wrap, json_schema_input_type=t | Field[t])]


Text = leaf(str)
Int = leaf(int)
Number = leaf(int | float)
Bool = leaf(bool)
Day = leaf(date)


# ---- sections -----------------------------------------------------------------------------------

class Document(_Model):  # A
    kind: leaf(DeedKind) | None = None
    era: leaf(Era) | None = None
    languages: list[Text] = []
    script: Text | None = None
    pages: Int | None = None
    condition: Text | None = None  # physical condition notes


class Registration(_Model):  # B
    deed_no: Text | None = None  # normalised: ASCII digits, letter suffix kept (4782/খ)
    deed_no_verbatim: Text | None = None
    volume: Text | None = None  # বালাম / বহি নং
    pages: Text | None = None
    office: Text | None = None  # sub-registry office
    year: Int | None = None
    endorsement: Text | None = None


class DeedDate(_Model):  # C
    verbatim: Text | None = None
    calendar: leaf(Calendar) | None = None
    day: Int | None = None
    month: leaf(int | str) | None = None  # Bangla month name, or 1-12
    year: Int | None = None  # in `calendar` (1350 = বঙ্গাব্দ)
    gregorian_from: Day | None = None
    gregorian_to: Day | None = None
    precision: leaf(Precision) | None = None


class Dates(_Model):
    execution: DeedDate | None = None
    registration: DeedDate | None = None


class Relative(_Model):
    name: Text | None = None
    deceased: Bool | None = None  # মৃত / মরহুম / স্বর্গীয়


class Address(_Model):
    village: Text | None = None  # সাং
    post: Text | None = None
    union: Text | None = None
    thana: Text | None = None
    pargana: Text | None = None
    district: Text | None = None


class Party(_Model):  # D (also witnesses / identifiers)
    role: leaf(Role)
    honorific: Text | None = None  # জনাব, শ্রী, শ্রীমতি, বেগম, মোসাম্মৎ
    name: Text | None = None
    father: Relative | None = None
    husband: Relative | None = None
    mother: Text | None = None
    address: Address | None = None
    profession: Text | None = None
    religion: Text | None = None
    nationality: Text | None = None
    share: Text | None = None  # অংশ


class Consideration(_Model):  # E
    amount: Number | None = None
    in_words: Text | None = None
    currency_written: Text | None = None  # টাকা / রুপি as printed
    era_currency: leaf(Currency) | None = None
    mode: Text | None = None  # এককালীন নগদ


class Area(_Model):
    value: Number | None = None
    unit: Text | None = None  # canonical (acre, decimal, kani...) or as written; see canonical_unit()
    parts: dict[str, Number] | None = None  # archaic compound area: {"kani": 2, "ganda": 5, "kora": 3}
    in_words: Text | None = None
    decimal_equiv: Number | None = None  # শতক


class Boundaries(_Model):  # চৌহদ্দি
    north: Text | None = None
    south: Text | None = None
    east: Text | None = None
    west: Text | None = None


class Plot(_Model):  # F, one row of the তপশিল
    district: Text | None = None
    thana: Text | None = None
    pargana: Text | None = None
    mouza: Text | None = None
    jl_no: Text | None = None
    survey: leaf(Survey) | None = None
    khatian_no: Text | None = None
    dag_no: list[Text] = []
    area: Area | None = None
    land_class: Text | None = None  # শালী / নাল, ভিটা, বাড়ি, পুকুর, ডাঙ্গা...
    boundaries: Boundaries | None = None


class TitleRecital(_Model):  # G
    basis: Text | None = None  # স্বত্ব দখলীয়, পৈতৃক সূত্রে প্রাপ্ত...
    prior_deed: Text | None = None
    nature: Text | None = None  # চিরস্থায়ী
    encumbrance_free: Bool | None = None  # নিষ্কণ্টক


class DeedWriter(_Model):
    name: Text | None = None
    licence_no: Text | None = None
    address: Address | None = None


class Stamp(_Model):
    type: leaf(StampType) | None = None
    value: Text | None = None  # as printed: "৫/- টাকা", "৮ আনা"


class Execution(_Model):  # H
    seller_mark: Text | None = None  # স্বাক্ষর / টিপসই
    witnesses: list[Party] = []
    deed_writer: DeedWriter | None = None
    stamps: list[Stamp] = []
    seals: list[Text] = []


class ModernMapping(_Model):  # I (computed from the place names, not read)
    division: Text | None = None
    district: Text | None = None
    upazila: Text | None = None


class Core(_Model):  # J, derived by ai/extraction/derive.py; plain strings like the 13 R4 fields
    owner_name: str | None = None
    father_name: str | None = None
    khatian_no: str | None = None
    dag_no: str | None = None
    mouza: str | None = None
    district: str | None = None
    upazila: str | None = None
    land_area: str | None = None
    area_unit: str | None = None
    deed_no: str | None = None
    deed_date: str | None = None
    seller: str | None = None
    buyer: str | None = None


class LHDR(_Model):
    """LandShield Historical Deed Record v1."""

    model_config = ConfigDict(title="LHDR", json_schema_extra={"description": "LandShield Historical Deed Record v1"})

    lhdr_schema: Literal["lhdr/1"] = pydantic.Field(SCHEMA, alias="schema")
    document: Document | None = None
    registration: Registration | None = None
    dates: Dates | None = None
    parties: list[Party] = []
    consideration: Consideration | None = None
    schedule: list[Plot] = []
    title_recital: TitleRecital | None = None
    execution: Execution | None = None
    modern_mapping: ModernMapping | None = None
    core: Core | None = None
    notes: list[str] = pydantic.Field([], alias="_notes")  # free text for people, never scored


def parse(data: dict | str | bytes) -> LHDR:
    """LHDR from a dict or JSON text; raises pydantic.ValidationError on a wrong shape."""
    return LHDR.model_validate(data) if isinstance(data, dict) else LHDR.model_validate_json(data)


def plain(obj: Any) -> Any:
    """The record with every Field collapsed to its value (gold shorthand); None / empty dropped."""
    if isinstance(obj, Field):
        v = obj.value
        return v.isoformat() if isinstance(v, date) else v
    if isinstance(obj, BaseModel):
        out = {}
        for name, info in type(obj).model_fields.items():
            v = plain(getattr(obj, name))
            if v not in (None, {}, []):
                out[info.alias or name] = v
        return out
    if isinstance(obj, list):
        return [plain(v) for v in obj]
    if isinstance(obj, dict):
        return {k: v for k, v in ((k, plain(v)) for k, v in obj.items()) if v is not None}
    return obj


def json_schema() -> dict:
    s = LHDR.model_json_schema(mode="validation", by_alias=True)
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": SCHEMA, **s}


# ---- content rules ------------------------------------------------------------------------------

@dataclass(frozen=True)
class Issue:
    path: str  # JSON pointer, e.g. /schedule/0/area/value
    code: str  # stable id for the UI (messages/*.json)
    severity: Literal["error", "warning"]
    message: str


_NUMBER = re.compile(r"\d+(?:[/-]\d+)*")  # khatian / dag / JL: 120, 455/1
_DEED_NO = re.compile(r"[0-9A-Za-zঀ-৿][0-9A-Za-zঀ-৿/._-]*")  # 4782/খ, D-1944-12


def _v(f: Field | None) -> Any:
    v = f.value if f is not None else None
    return None if isinstance(v, str) and not v.strip() else v


def _named(parties: list[Party], roles: tuple[Role, ...]) -> list[Party]:
    return [p for p in parties if _v(p.role) in roles and _v(p.name)]


def _plot_complete(p: Plot) -> bool:
    has_area = p.area is not None and (_v(p.area.value) is not None or any(_v(x) for x in (p.area.parts or {}).values()))
    return bool(_v(p.mouza)) and bool(_v(p.khatian_no) or any(_v(d) for d in p.dag_no)) and has_area


def check(rec: LHDR, today: date | None = None) -> list[Issue]:
    """Content rules for a historical deed (roadmap H1). Errors block approval; warnings inform."""
    from ai.extraction.derive import derive_core  # derive imports this module

    today = today or date.today()
    out: list[Issue] = []

    def err(path: str, code: str, msg: str) -> None:
        out.append(Issue(path, code, "error", msg))

    def warn(path: str, code: str, msg: str) -> None:
        out.append(Issue(path, code, "warning", msg))

    # required
    reg = rec.registration or Registration()
    if not (_v(reg.deed_no) or _v(reg.volume)):
        err("/registration/deed_no", "MISSING_DEED_REF", "deed number or registration volume (বালাম/বহি) is required")
    ex = rec.dates.execution if rec.dates else None
    if not (ex and _v(ex.verbatim)):
        err("/dates/execution/verbatim", "MISSING_EXECUTION_DATE", "the execution date as written is required")
    if len(_named(rec.parties, MUTUAL_ROLES)) < 2:
        if not _named(rec.parties, TRANSFEROR_ROLES):
            err("/parties", "NO_SELLER", "at least one named seller / donor (১ম পক্ষ) is required")
        if not _named(rec.parties, TRANSFEREE_ROLES):
            err("/parties", "NO_BUYER", "at least one named buyer / donee (২য় পক্ষ) is required")
    if not any(_plot_complete(p) for p in rec.schedule):
        err("/schedule", "NO_COMPLETE_PLOT", "at least one plot needs mouza, khatian or dag, and area")

    # format
    if _v(reg.deed_no) and not (
        _DEED_NO.fullmatch(d := normalize.number(str(_v(reg.deed_no)))) and any(c.isdigit() for c in d)
    ):
        err("/registration/deed_no", "NOT_NUMERIC", "deed number must contain digits")
    for i, p in enumerate(rec.schedule):
        base = f"/schedule/{i}"
        for key in ("khatian_no", "jl_no"):
            v = _v(getattr(p, key))
            if v and not _NUMBER.fullmatch(normalize.number(str(v))):
                err(f"{base}/{key}", "NOT_NUMERIC", f"{key} must be a number")
        for j, d in enumerate(p.dag_no):
            if _v(d) and not _NUMBER.fullmatch(normalize.number(str(_v(d)))):
                err(f"{base}/dag_no/{j}", "NOT_NUMERIC", "dag number must be a number")
        a = p.area
        if a is None:
            continue
        if _v(a.value) is not None and _v(a.value) <= 0:
            err(f"{base}/area/value", "AREA_NOT_POSITIVE", "area must be greater than 0")
        if _v(a.unit) and canonical_unit(_v(a.unit)) is None:
            err(f"{base}/area/unit", "UNKNOWN_UNIT", f"unknown area unit {_v(a.unit)!r}")
        for u, n in (a.parts or {}).items():
            if canonical_unit(u) is None:
                err(f"{base}/area/parts/{u}", "UNKNOWN_UNIT", f"unknown area unit {u!r}")
            if _v(n) is not None and _v(n) < 0:
                err(f"{base}/area/parts/{u}", "AREA_NOT_POSITIVE", "area part cannot be negative")
        if a.parts and _v(a.value) is None and not any(_v(n) for n in a.parts.values()):
            err(f"{base}/area/parts", "AREA_NOT_POSITIVE", "area must be greater than 0")
    c = rec.consideration
    if c and _v(c.amount) is not None and _v(c.amount) <= 0:
        err("/consideration/amount", "AMOUNT_NOT_POSITIVE", "consideration must be greater than 0")
    for key in ("execution", "registration"):
        d = getattr(rec.dates, key, None) if rec.dates else None
        if d is None:
            continue
        lo, hi = _v(d.gregorian_from), _v(d.gregorian_to)
        for name, x in (("gregorian_from", lo), ("gregorian_to", hi)):
            if x and x > today:
                err(f"/dates/{key}/{name}", "DATE_IN_FUTURE", "date cannot be in the future")
        if lo and hi and lo > hi:
            err(f"/dates/{key}/gregorian_to", "DATE_RANGE_REVERSED", "gregorian_to is before gregorian_from")
        if _v(d.day) is not None and not 1 <= _v(d.day) <= 32:  # Bangla months have up to 32 days
            err(f"/dates/{key}/day", "BAD_DAY", "day must be 1-32")

    # consistency (warnings)
    era = _v(rec.document.era) if rec.document else None
    lo, hi = (_v(ex.gregorian_from), _v(ex.gregorian_to)) if ex else (None, None)
    if era and (lo or hi) and era not in {era_of(x) for x in (lo, hi) if x}:
        warn("/document/era", "ERA_MISMATCH", f"era {era} does not match the execution date")
    if rec.core is not None:
        derived = derive_core(rec)
        for k, want in derived.items():
            if getattr(rec.core, k) != want:
                warn(f"/core/{k}", "CORE_MISMATCH", f"stored {getattr(rec.core, k)!r}, derived {want!r}")
    return out


def errors(rec: LHDR, today: date | None = None) -> list[Issue]:
    return [i for i in check(rec, today) if i.severity == "error"]


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args[:1] == ["schema"]:
        SCHEMA_FILE.write_text(json.dumps(json_schema(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {SCHEMA_FILE}")
        return 0
    if args[:1] == ["check"] and args[1:]:
        bad = 0
        for f in args[1:]:
            try:
                issues = check(parse(Path(f).read_bytes()))
            except pydantic.ValidationError as e:
                print(f"{f}: INVALID\n{e}")
                bad += 1
                continue
            bad += any(i.severity == "error" for i in issues)
            print(f"{f}: {'ok' if not issues else ''}")
            for i in issues:
                print(f"  {i.severity:7} {i.code:22} {i.path}  {i.message}")
        return 1 if bad else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
