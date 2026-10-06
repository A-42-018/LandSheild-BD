"""Verify a document copy (F4b). Public, read-only, nothing stored.

Flow: exact file hash match with a recorded deed's document -> AUTHENTIC. Otherwise read the
fields (OCR+extraction providers, or the JSON the citizen typed) and compare them with every
recorded deed carrying that deed_no: all equal -> AUTHENTIC, else ALTERED (field NAMES only, never
the recorded values) / NOT_FOUND. Unreadable -> UNREADABLE. Indicator only.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings
from app.core.errors import AppError
from app.models.deed import Deed
from app.models.document import Document
from app.schemas.public import DocumentVerifyOut
from app.services.providers import get_providers
from app.services.storage import sha256_hex
from app.services.upload_validation import validate_upload

AUTHENTIC, ALTERED, NOT_FOUND, UNREADABLE = "AUTHENTIC", "ALTERED", "NOT_FOUND", "UNREADABLE"
COMPARED = ("khatian_no", "dag_no", "land_area", "area_unit", "deed_date", "seller", "buyer")
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def _s(v: object) -> str:
    return " ".join(str(v or "").translate(_BN).split()).casefold()


def _num(v: object) -> str:
    try:
        return f"{float(_s(v).replace(',', '')):.4f}"
    except ValueError:
        return _s(v)


def _recorded(d: Deed) -> dict[str, str]:
    return {
        "khatian_no": _s(d.land.khatian_no), "dag_no": _s(d.land.dag_no),
        "land_area": _num(d.area), "area_unit": _s(d.area_unit),
        "deed_date": d.transaction_date.isoformat() if isinstance(d.transaction_date, date) else "",
        "seller": _s(d.seller.name), "buyer": _s(d.buyer.name),
    }  # fmt: skip


def _given(fields: dict[str, str | None]) -> dict[str, str]:
    out = {k: _s(fields.get(k)) for k in COMPARED}
    out["land_area"] = _num(fields.get("land_area"))
    return out


def compare(db: Session, deed_no: str, fields: dict[str, str | None]) -> DocumentVerifyOut:
    no = " ".join((deed_no or "").split())
    if not no:
        return DocumentVerifyOut(state=NOT_FOUND)
    deeds = db.scalars(
        select(Deed)
        .options(joinedload(Deed.land), joinedload(Deed.seller), joinedload(Deed.buyer))
        .where(Deed.deed_no == no)
    ).unique().all()
    if not deeds:
        return DocumentVerifyOut(state=NOT_FOUND)
    given = _given(fields)
    best: list[str] | None = None
    for d in deeds:
        rec = _recorded(d)
        # a field the copy does not show cannot prove tampering: only present values are compared
        diff = [k for k in COMPARED if given[k] and given[k] != rec[k]]
        if not diff:
            return DocumentVerifyOut(state=AUTHENTIC, match="CONTENT")
        best = diff if best is None or len(diff) < len(best) else best
    return DocumentVerifyOut(state=ALTERED, differing=best or [])


def verify_file(
    db: Session, settings: Settings, filename: str | None, data: bytes
) -> DocumentVerifyOut:
    v = validate_upload(filename, data)
    digest = sha256_hex(data)
    hit = db.scalar(
        select(Deed.id)
        .join(Document, Document.id == Deed.document_id)
        .where(Document.file_hash == digest)
        .limit(1)
    )
    if hit is not None:
        return DocumentVerifyOut(state=AUTHENTIC, match="FILE")
    try:
        providers = get_providers(settings)
        ocr = providers.ocr.recognize(data, v.ext)
        res = providers.ai.extract(data, ocr)
    except AppError:
        raise
    except Exception:  # provider boundary: unreadable copy is an answer, not a 500
        return DocumentVerifyOut(state=UNREADABLE)
    by = {f.field: f.value for f in res.fields}
    if not by.get("deed_no"):
        return DocumentVerifyOut(state=UNREADABLE)
    return compare(db, by["deed_no"] or "", by)
