# ruff: noqa: E501
"""Record-assisted correction of low-confidence OCR values (O4).

OCR misreads (1/7, c/s) cannot be told apart from pixels alone, but the land records can say which
reading is real. This only ever *chooses between* readings the OCR engine itself produced (the
extracted value and its alternative readings; the mouza may also snap to a close known name):

- mouza: snapped to a mouza name already on record in the same district/upazila (similarity >= 85)
- khatian / dag: when the (mouza, khatian, dag) written does not exist, a reading pair that matches
  exactly one parcel is used
- deed no: when it is not on record, the one alternative reading that is, is used

Every change is reported as a warning (FIELD_MATCHED_TO_RECORDS:<field>:<old>-><new>) and the document
still goes to a human reviewer. Nothing is changed when the match is ambiguous or absent, so a deed
that really differs from the records keeps its own values and shows up as a mismatch later.
"""
from __future__ import annotations

import logging
from dataclasses import replace
from itertools import product

from ai.extraction.base import ExtractedField
from rapidfuzz import fuzz
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.deed import Deed
from app.models.land_parcel import LandParcel

logger = logging.getLogger("landshield.record_assist")
MOUZA_MIN_SIMILARITY = 85


def apply(db: Session, fields: list[ExtractedField], alternatives: dict[str, list[str]]) -> tuple[list[ExtractedField], list[str]]:
    by = {f.field: f for f in fields}
    new: dict[str, str] = {}

    def val(name: str) -> str | None:
        return new.get(name) or (by[name].value if name in by else None)

    district, upazila = val("district"), val("upazila")
    if district and upazila:
        mouzas = db.scalars(
            select(LandParcel.mouza)
            .where(func.lower(LandParcel.district) == district.lower(), func.lower(LandParcel.upazila) == upazila.lower())
            .distinct()
        ).all()
        cur = val("mouza")
        if cur and mouzas and cur not in mouzas:
            score, best = max((fuzz.ratio(cur.lower(), m.lower()), m) for m in mouzas)
            if score >= MOUZA_MIN_SIMILARITY:
                new["mouza"] = best
        mouza = val("mouza")
        parcels = (
            db.execute(
                select(LandParcel.khatian_no, LandParcel.dag_no).where(
                    func.lower(LandParcel.district) == district.lower(),
                    func.lower(LandParcel.upazila) == upazila.lower(),
                    func.lower(LandParcel.mouza) == (mouza or "").lower(),
                )
            ).all()
            if mouza
            else []
        )
        kh, dag = val("khatian_no"), val("dag_no")
        if parcels and kh and dag and (kh, dag) not in {(p[0], p[1]) for p in parcels}:
            opts_k = [kh, *alternatives.get("khatian_no", [])]
            opts_d = [dag, *alternatives.get("dag_no", [])]
            hits = {(k, d) for k, d in product(opts_k, opts_d) if (k, d) in {(p[0], p[1]) for p in parcels}}
            if len(hits) == 1:
                new["khatian_no"], new["dag_no"] = next(iter(hits))

    deed_no = val("deed_no")
    if deed_no and not db.scalar(select(func.count()).select_from(Deed).where(Deed.deed_no == deed_no)):
        hits_d = [a for a in alternatives.get("deed_no", []) if db.scalar(select(func.count()).select_from(Deed).where(Deed.deed_no == a))]
        if len(hits_d) == 1:
            new["deed_no"] = hits_d[0]

    warnings: list[str] = []
    out: list[ExtractedField] = []
    for f in fields:
        if f.field in new and new[f.field] != f.value:
            warnings.append(f"FIELD_MATCHED_TO_RECORDS:{f.field}:{f.value}->{new[f.field]}")
            f = replace(f, value=new[f.field])
        out.append(f)
    return out, warnings
