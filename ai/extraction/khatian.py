# ruff: noqa: E501
"""Khatian / Porcha (record-of-rights) layout parser, Bangla and English labels (F5a).

A khatian lists the survey (CS / SA / RS / BS), the mouza and JL number, the owners with their
shares, and the dags with their areas. This parser reads those sections and returns:

  * `parse(text)`  -> field -> (value, strength, raw) for the R4 fields that map onto a khatian
  * `extras(text)` -> {"survey_type", "jl_no", "owners": [...], "dags": [...], "shares_complete"}

Nothing is guessed. A value that is not found is simply absent. A khatian has several owners and
dags, but the R4 fields are single-valued: `owner_name` / `father_name` are filled only when there
is exactly one owner, and `dag_no` / `land_area` / `area_unit` only when there is exactly one dag.
With several, the reviewer picks; the full lists are kept in `extras`.
Tuned on the synthetic specimens in database/sample_data (not on real records).
"""
from __future__ import annotations

import re
from fractions import Fraction

from ai.extraction import patterns as P

_B = r"ঀ-৿"
_D = "[0-9০-৯]"
_HEAD = re.compile(r"খতিয়ান|পর্চা|Khatian|Porcha|Record\s+of\s+Rights", re.I)
_OWNERS = re.compile(r"মালিক|Owner", re.I)
_SHARE = re.compile(r"অংশ|Share", re.I)
_DAG = re.compile(r"দাগ\s*(?:নং|নম্বর)|Dag\s*(?:No\.?|Number)", re.I)
_DEED_ONLY = re.compile(r"ক্রয়কারী|বিক্রয়কারী|Purchaser|Seller")

_SURVEYS = {
    "CS": re.compile(rf"(?<![{_B}A-Za-z])(?:সি\s*\.?\s*এস|CS)(?![{_B}A-Za-z])|ক্যাডাস্ট্রাল", re.I),
    "SA": re.compile(rf"(?<![{_B}A-Za-z])(?:এস\s*\.?\s*এ|SA)(?![{_B}A-Za-z])|স্টেট\s*একুইজিশন", re.I),
    "RS": re.compile(rf"(?<![{_B}A-Za-z])(?:আর\s*\.?\s*এস|RS)(?![{_B}A-Za-z])|রিভিশনাল", re.I),
    "BS": re.compile(rf"(?<![{_B}A-Za-z])(?:বি\s*\.?\s*এস|BS)(?![{_B}A-Za-z])|বাংলাদেশ\s*সার্ভে|সিটি\s*জরিপ", re.I),
}
_SURVEY_LINE = re.compile(r"(?:জরিপ|Survey)\s*[:ঃ\-–]\s*([^\n]+)", re.I)
_OWNER_LINE = re.compile(
    rf"^[ \t]*{_D}+[ \t]*[।.)][ \t]*(?P<name>[^,\n]+?)[ \t]*,[ \t]*(?:পিতা|Father)[ \t]*[:ঃ][ \t]*(?P<father>[^,\n]+?)"
    rf"(?:[ \t]*,[ \t]*(?:অংশ|Share)[ \t]*[:ঃ][ \t]*(?P<share>[^\n,]+?))?[ \t]*$",
    re.M | re.I,
)
_DAG_LINE = re.compile(
    rf"(?:দাগ\s*(?:নং|নম্বর)|Dag\s*(?:No\.?|Number))\s*[:ঃ]\s*(?P<dag>{_D}+(?:[/-]{_D}+)?)"
    rf"(?:\s*[,،]\s*(?:জমির\s*)?(?:পরিমাণ|Area)\s*[:ঃ]\s*(?P<area>{_D}[{_D[1:-1]},]*(?:\.{_D}+)?)"
    rf"(?:[ \t]*(?P<unit>{P.UNIT_RE})(?![{_B}A-Za-z]))?)?",
    re.I,
)
_JL = re.compile(rf"(?:জে\s*\.?\s*এল\s*\.?|JL)\s*(?:নং|নম্বর|No\.?)?\s*[:ঃ]?\s*(?P<jl>{_D}+)", re.I)


def _ascii(s: str) -> str:
    return s.translate(P.BN_DIGITS)


def _clean(s: str | None) -> str | None:
    if not s:
        return None
    s = re.sub(r"\s+", " ", s).strip(" .,:;।-–")
    return s or None


def looks_like(text: str) -> bool:
    """A khatian heading, a share column and a dag line, and not a sale deed."""
    return bool(
        _HEAD.search(text) and _OWNERS.search(text) and _SHARE.search(text)
        and _DAG.search(text) and not _DEED_ONLY.search(text)
    )  # fmt: skip


def survey_type(text: str) -> str | None:
    """CS | SA | RS | BS from the "Survey:" line. None when absent or ambiguous (e.g. "CS/SA")."""
    m = _SURVEY_LINE.search(text)
    if not m:
        return None
    hits = [k for k, rx in _SURVEYS.items() if rx.search(m.group(1))]
    return hits[0] if len(hits) == 1 else None


def _share(raw: str | None) -> str | None:
    """'১/২' -> '1/2'; '0.5' -> '1/2'; anything else -> None (never guessed)."""
    if not raw:
        return None
    s = _ascii(raw).strip().replace(" ", "")
    try:
        f = Fraction(s)
    except (ValueError, ZeroDivisionError):
        return None
    if f <= 0 or f > 1:
        return None
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else "1"


def owners(text: str) -> list[dict[str, str | None]]:
    out = []
    for m in _OWNER_LINE.finditer(text):
        out.append({"name": _clean(m.group("name")), "father": _clean(m.group("father")), "share": _share(m.group("share"))})
    return [o for o in out if o["name"]]


def dags(text: str) -> list[dict[str, str | None]]:
    out = []
    for m in _DAG_LINE.finditer(text):
        area = _ascii(m.group("area")).replace(",", "") if m.group("area") else None
        unit = P.UNIT_SYNONYMS.get(m.group("unit").casefold()) if m.group("unit") else None
        out.append({"dag_no": _ascii(m.group("dag")), "area": area, "unit": unit})
    return out


def _line_value(label: str, text: str) -> str | None:
    m = re.search(rf"(?<![{_B}])(?:{label})\s*[:ঃ]\s*([^\n,]+)", text, re.I)
    return _clean(m.group(1)) if m else None


def extras(text: str) -> dict:
    """Everything that does not fit the 13 single-valued R4 fields."""
    owns = owners(text)
    shares = [o["share"] for o in owns]
    complete = None
    if owns and all(shares):
        complete = sum(Fraction(s) for s in shares) == 1  # type: ignore[arg-type]
    jl = _JL.search(_ascii(text))
    return {
        "survey_type": survey_type(text),
        "jl_no": jl.group("jl") if jl else None,
        "owners": owns,
        "dags": dags(text),
        "shares_complete": complete,
    }


def parse(text: str) -> dict[str, tuple[str, float, str]]:
    """field -> (value, strength 0..1, raw text as read). Only fields actually found."""
    found: dict[str, tuple[str, float, str]] = {}

    def put(field: str, value: str | None, strength: float, raw: str | None = None) -> None:
        if value:
            found[field] = (value, strength, raw if raw is not None else value)

    norm = _ascii(text)
    m = re.search(rf"(?:খতিয়ান|Khatian)\s*(?:নং|নম্বর|No\.?)\s*[:ঃ]\s*({_D}+(?:[/-]{_D}+)?)", norm, re.I)
    put("khatian_no", m.group(1) if m else None, 0.95)
    put("district", _line_value(r"(?<!উপ)জেলা|District", text), 0.9)
    put("upazila", _line_value(r"উপজেলা|Upazila|Thana", text), 0.9)
    put("mouza", _line_value(r"মৌজা|Mouza", text), 0.9)

    owns = owners(text)
    if len(owns) == 1:
        put("owner_name", owns[0]["name"], 0.9)
        put("father_name", owns[0]["father"], 0.9)
    ds = dags(text)
    if len(ds) == 1:
        d = ds[0]
        put("dag_no", d["dag_no"], 0.9)
        put("land_area", d["area"], 0.85)
        put("area_unit", d["unit"], 0.9)
    return found
