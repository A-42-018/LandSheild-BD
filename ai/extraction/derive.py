# ruff: noqa: E501
"""LHDR -> the 13 core fields (H1, roadmap §2.1 J), so approval, posting, risk and search keep working.

Rules (the same ones make_historical.py used to write the gold `core` blocks):
- seller / owner_name = the first named transferring party (seller, donor, mortgagor...);
  buyer = the first named receiving party. A partition has neither: owner_name = the first co-sharer.
- father_name = the seller's father, else husband.
- khatian, mouza, district, upazila (= thana as written), area = the first plot; dag = its first dag.
- deed_no = the normalised deed number; deed_date = the middle of the execution date's Gregorian range,
  only when the date is known to the day (else None: nothing is guessed).
"""
from __future__ import annotations

from datetime import timedelta

from ai.extraction.base import EXTRACTION_FIELDS, ExtractedField
from ai.extraction.lhdr import (
    LHDR,
    MUTUAL_ROLES,
    TRANSFEREE_ROLES,
    TRANSFEROR_ROLES,
    DeedDate,
    Field,
    Party,
    Precision,
    Role,
    canonical_unit,
)
from ai.ocr import normalize


def _first(parties: list[Party], roles: tuple[Role, ...]) -> Party | None:
    return next((p for p in parties if p.role.value in roles and p.name and p.name.value), None)


def _area(v: float | int) -> str:
    s = f"{v:.2f}"
    return s if float(s) == v else f"{v:g}"


def _mid(d: DeedDate | None) -> str | None:
    if d is None or d.precision is not None and d.precision.value not in (Precision.DAY, Precision.DAY_PM1):
        return None
    lo = d.gregorian_from.value if d.gregorian_from else None
    hi = d.gregorian_to.value if d.gregorian_to else None
    if lo and hi:
        return (lo + timedelta(days=(hi - lo).days // 2)).isoformat()
    return (lo or hi).isoformat() if lo or hi else None


def _sources(rec: LHDR) -> dict[str, tuple[str | None, Field | None]]:
    """core field -> (value, the Field it came from)."""
    out: dict[str, tuple[str | None, Field | None]] = {f: (None, None) for f in EXTRACTION_FIELDS}

    def put(name: str, f: Field | None, value: object = None) -> None:
        v = f.value if f is not None and value is None else value
        if v not in (None, ""):
            out[name] = (str(v), f)

    mutual = [p for p in rec.parties if p.role.value in MUTUAL_ROLES and p.name and p.name.value]
    seller, buyer = _first(rec.parties, TRANSFEROR_ROLES), _first(rec.parties, TRANSFEREE_ROLES)
    if not (seller or buyer) and mutual and mutual[0].role.value == Role.EXCHANGER:
        seller, buyer = mutual[0], mutual[1] if len(mutual) > 1 else None
    owner = seller or (mutual[0] if mutual else None)
    if seller:
        put("seller", seller.name)
    if buyer:
        put("buyer", buyer.name)
    if owner:
        put("owner_name", owner.name)
        rel = owner.father if owner.father and owner.father.name else owner.husband
        if rel:
            put("father_name", rel.name)

    if rec.schedule:
        p = rec.schedule[0]
        put("khatian_no", p.khatian_no, normalize.number(p.khatian_no.value) if p.khatian_no else None)
        if p.dag_no:
            put("dag_no", p.dag_no[0], normalize.number(p.dag_no[0].value or ""))
        put("mouza", p.mouza)
        put("district", p.district)
        put("upazila", p.thana)
        if p.area:
            if p.area.value and p.area.value.value is not None:
                put("land_area", p.area.value, _area(p.area.value.value))
            if p.area.unit:
                put("area_unit", p.area.unit, canonical_unit(p.area.unit.value))

    if rec.registration and rec.registration.deed_no:
        put("deed_no", rec.registration.deed_no, normalize.number(rec.registration.deed_no.value or ""))
    if rec.dates:
        for d in (rec.dates.execution, rec.dates.registration):
            if out["deed_date"][0] is None and (iso := _mid(d)):
                put("deed_date", d.gregorian_from or d.gregorian_to, iso)
    return out


def derive_core(rec: LHDR) -> dict[str, str | None]:
    """{field: value} for the 13 core fields, in EXTRACTION_FIELDS order."""
    return {k: v for k, (v, _) in _sources(rec).items()}


def derive_fields(rec: LHDR) -> list[ExtractedField]:
    """The 13 core fields as ExtractedField, carrying confidence and bbox of the value they came from.
    A Field without a stated confidence counts as certain only when a person wrote it."""
    out = []
    for name, (value, f) in _sources(rec).items():
        if value is None or f is None:
            out.append(ExtractedField(name, None, 0.0))
            continue
        conf = f.confidence if f.confidence is not None else (1.0 if f.method in (None, "human") else 0.0)
        bbox = f.source.bbox if f.source else None
        out.append(ExtractedField(name, value, conf, bbox))
    return out
