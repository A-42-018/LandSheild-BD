"""Approval posting (P30): turn an approved extraction into land/owners/deed/transaction.

Everything here only flushes; the caller (review.approve_document) owns the single DB
transaction and commits or rolls back. Names are matched on exact normalised name + father
name (fuzzy matching is P43); similar names are never merged.
"""
from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.deed import Deed
from app.models.document import Document
from app.models.enums import LandStatus, TransactionStatus, TransactionType
from app.models.land_office import LandOffice
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.extraction import Extraction
from app.services import audit, chain, ledger, mutation, party_nid, signing
from app.services.extraction import _BN_DIGITS, _parse_area, _parse_date
from app.services.names import VARIANT_MIN, can_auto_merge, owner_similarity
from app.services.risk import analyze_land

FIRST_LAND_NUMBER = 10001
HIGH = "HIGH"


@dataclass(frozen=True)
class PostingResult:
    land_id: str  # LP-xxxxx
    created_land: bool
    transaction_id: str
    deed_id: str
    transaction_status: str
    ownership_updated: bool
    risk_score: int
    risk_level: str

    def to_dict(self) -> dict:
        return {
            "land_id": self.land_id,
            "created_land": self.created_land,
            "transaction_id": self.transaction_id,
            "deed_id": self.deed_id,
            "transaction_status": self.transaction_status,
            "ownership_updated": self.ownership_updated,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
        }


def _norm(value: str | None) -> str | None:
    if value is None:
        return None
    out = " ".join(value.translate(_BN_DIGITS).split())
    return out or None


def _key(value: str | None) -> str | None:
    n = _norm(value)
    return n.casefold() if n is not None else None


def _resolve_land(
    db: Session, doc: Document, v: dict[str, str | None], area: float, unit: str
) -> tuple[LandParcel, bool]:
    if doc.land_id is not None:
        land = db.get(LandParcel, doc.land_id)
        if land is None:
            raise AppError("LAND_NOT_FOUND", "Land parcel not found", 404)
        if _key(land.khatian_no) != _key(v["khatian_no"]) or _key(land.dag_no) != _key(
            v["dag_no"]
        ):
            raise AppError(
                "LAND_IDENTIFIER_MISMATCH",
                "Document khatian/dag do not match the land it was uploaded for",
                409,
                {"land_id": land.land_id},
            )
        _same_office(doc, land)
        return land, False
    cands = db.scalars(
        select(LandParcel).where(
            func.lower(LandParcel.district) == (_key(v["district"]) or ""),
            func.lower(LandParcel.upazila) == (_key(v["upazila"]) or ""),
            func.lower(LandParcel.mouza) == (_key(v["mouza"]) or ""),
        )
    ).all()
    for land in cands:
        if _key(land.khatian_no) == _key(v["khatian_no"]) and _key(land.dag_no) == _key(
            v["dag_no"]
        ):
            _same_office(doc, land)
            doc.land_id = land.id
            return land, False
    office = db.get(LandOffice, doc.office_id) if doc.office_id else None
    land = LandParcel(
        land_id=_next_land_code(db),
        district=_norm(v["district"]),
        upazila=_norm(v["upazila"]),
        mouza=_norm(v["mouza"]),
        khatian_no=_norm(v["khatian_no"]),
        dag_no=_norm(v["dag_no"]),
        area=area,
        area_unit=unit,
        status=LandStatus.ACTIVE.value,
        office_id=doc.office_id,
        union=office.union_en if office else None,
    )
    db.add(land)
    db.flush()
    doc.land_id = land.id
    return land, True


def _same_office(doc: Document, land: LandParcel) -> None:
    """A parcel held by one office's database cannot be changed by another office."""
    if doc.office_id and land.office_id and land.office_id != doc.office_id:
        raise AppError(
            "RECORD_OUTSIDE_AREA", "This land is held by another land office", 409,
            {"land_id": land.land_id},
        )


def _next_land_code(db: Session) -> str:
    nums = [
        int(c[3:])
        for c in db.scalars(select(LandParcel.land_id).where(LandParcel.land_id.like("LP-%")))
        if c[3:].isdigit()
    ]
    return f"LP-{max([FIRST_LAND_NUMBER - 1, *nums]) + 1}"


def _resolve_owner(db: Session, name: str, father: str | None) -> Owner:
    """Exact normalised name + father name (None only matches None); then P43 fuzzy merge
    (name AND father_name >= names.MERGE_MIN, both fathers present); else create."""
    n, f = _key(name), _key(father)
    for o in db.scalars(select(Owner).where(func.lower(Owner.name) == n)):
        if _key(o.name) == n and _key(o.father_name) == f:
            return o
    if f is not None:
        for o in db.scalars(select(Owner).where(Owner.father_name.is_not(None)).order_by(Owner.id)):
            if can_auto_merge(name, father, o.name, o.father_name):
                return o
    owner = Owner(name=_norm(name), father_name=_norm(father))
    db.add(owner)
    db.flush()
    return owner


def _resolve_party(
    db: Session, party: str, name: str, father: str | None, key: dict[str, str] | None
) -> Owner:
    """NID first (when the office entered one), then the name match, which then gets the NID.
    An NID match survives spelling variants of the name, not a different name altogether."""
    if key:
        found = party_nid.find_owner(db, key)
        if found is not None:
            if owner_similarity(found.name, name) < VARIANT_MIN:
                raise AppError(
                    "NID_NAME_MISMATCH", "This NID is on record under a different name", 409,
                    {"party": party},
                )  # fmt: skip
            return found
    owner = _resolve_owner(db, name, father)
    return party_nid.attach(db, owner, key, _norm(name), _norm(father)) if key else owner


def _father_for(party: str, v: dict[str, str | None]) -> str | None:
    """father_name on the deed belongs to owner_name; only attach it to that same person."""
    owner = v.get("owner_name")
    return v.get("father_name") if owner and _key(owner) == _key(party) else None


def post_document(
    db: Session, user: User, doc: Document, extraction: Extraction, ip: str | None
) -> PostingResult:
    """Post one APPROVABLE (already validated) document. Flush only; caller commits."""
    by = {f.field: f for f in extraction.fields}
    v = {k: _norm(f.value) for k, f in by.items()}
    area = float(_parse_area((v["land_area"] or "").translate(_BN_DIGITS)) or 0)
    unit = (v["area_unit"] or "").lower()
    tx_date: date | None = _parse_date(v["deed_date"]) if v.get("deed_date") else None

    land, created = _resolve_land(db, doc, v, area, unit)
    nids = doc.party_nids or {}
    seller = _resolve_party(
        db, "seller", v["seller"], _father_for(v["seller"], v), nids.get("seller")
    )
    buyer = _resolve_party(db, "buyer", v["buyer"], _father_for(v["buyer"], v), nids.get("buyer"))
    if seller.id == buyer.id and nids:
        raise AppError("SAME_PARTY_NID", "Buyer and seller resolve to the same NID holder", 422)

    deed = Deed(
        land_id=land.id, deed_no=v["deed_no"], seller_id=seller.id, buyer_id=buyer.id,
        transaction_date=tx_date, area=area, area_unit=unit, document_id=doc.id,
        status=TransactionStatus.RECORDED.value,
    )  # fmt: skip
    db.add(deed)
    db.flush()
    signing.seal(deed)  # F4a: hash + Ed25519 signature at approval
    tx = Transaction(
        land_id=land.id, seller_id=seller.id, buyer_id=buyer.id, deed_id=deed.id,
        transaction_type=TransactionType.SALE.value, transaction_date=tx_date, area=area,
        area_unit=unit, source_document_id=doc.id, status=TransactionStatus.RECORDED.value,
    )  # fmt: skip
    db.add(tx)
    db.flush()

    mut_rec = mutation.create_from_posting(db, user, land, deed, tx, ip)
    assessment = analyze_land(db, land.land_id, commit=False)  # sees the new tx, makes alerts
    tx.risk_score = assessment.overall_score
    evidence = assessment.evidence_json or []
    # POSSIBLE_NAME_VARIANT (P43) is INFO but the seller is unconfirmed: hold ownership for review.
    high = any(
        e.get("severity") == HIGH or e.get("code") == "POSSIBLE_NAME_VARIANT" for e in evidence
    )

    updated = False
    if high:
        tx.status = deed.status = TransactionStatus.FLAGGED.value  # ownership untouched
    elif not chain.is_historical(extraction):
        _update_ownership(db, land, seller, buyer, tx, tx_date, extraction)
        updated = True
    if chain.is_historical(extraction):
        # D2: a historical deed is a past link of the chain of title, the current owner stays
        chain.record(db, land, buyer, tx, tx_date, extraction)

    mutation.route_after_prechecks(db, mut_rec, user, ip)
    ledger.append(db, "deed", deed.id)  # F4c: tamper-evident record of the approved sale
    ledger.append(db, "transaction", tx.id)
    result = PostingResult(
        land_id=land.land_id, created_land=created, transaction_id=tx.id, deed_id=deed.id,
        transaction_status=tx.status, ownership_updated=updated,
        risk_score=assessment.overall_score, risk_level=assessment.risk_level,
    )  # fmt: skip
    audit.log(
        db, user,
        "TRANSACTION_FLAGGED" if high else "TRANSACTION_RECORDED",
        "transaction", tx.id, old=None, new={"document_id": doc.id, **result.to_dict()}, ip=ip,
    )  # fmt: skip
    return result


def _update_ownership(
    db: Session,
    land: LandParcel,
    seller: Owner,
    buyer: Owner,
    tx: Transaction,
    tx_date: date | None,
    extraction: Extraction,
) -> None:
    effective = tx_date or datetime.now(UTC).date()  # deed_date is optional (R4)
    for period in db.scalars(
        select(OwnershipHistory).where(
            OwnershipHistory.land_id == land.id,
            OwnershipHistory.owner_id == seller.id,
            OwnershipHistory.end_date.is_(None),
        )
    ):
        period.end_date = effective
    confs = [
        f.confidence for f in extraction.fields if f.field in ("seller", "buyer")
    ]
    db.add(
        OwnershipHistory(
            land_id=land.id, owner_id=buyer.id, start_date=effective, end_date=None,
            source_transaction_id=tx.id, confidence=min(confs) if confs else None,
        )  # fmt: skip
    )
    db.flush()


def refresh_chain_link(db: Session, doc: Document, extraction: Extraction) -> None:
    """A correction of a historical deed was approved (H9a): update its chain-of-title link in
    place (buyer, start date), without posting anything new. Flush only; caller commits."""
    by = {f.field: f for f in extraction.fields}
    v = {k: _norm(f.value) for k, f in by.items()}
    if not v.get("buyer"):
        return
    tx_date = _parse_date(v["deed_date"]) if v.get("deed_date") else None
    buyer = _resolve_owner(db, v["buyer"], _father_for(v["buyer"], v))
    chain.refresh(db, doc, buyer, tx_date, extraction)
