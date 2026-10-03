"""Pure input for risk rules (R3). Rules never touch the DB.

`load_land_context` is the only DB reader.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document
from app.models.enums import DocumentStatus, TransactionStatus
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.schemas.extraction import REQUIRED_FIELDS


@dataclass(frozen=True)
class OwnerPeriod:
    owner_id: str
    start_date: date | None
    end_date: date | None  # None = current owner


@dataclass(frozen=True)
class TxRecord:
    id: str
    seller_id: str
    buyer_id: str
    transaction_date: date | None
    area: float
    area_unit: str
    status: str = TransactionStatus.RECORDED.value
    deed_no: str | None = None


@dataclass(frozen=True)
class OwnerRef:
    """Names are used only for P43 variant detection; they never reach evidence params."""

    name: str
    father_name: str | None = None


@dataclass(frozen=True)
class DocConfidence:
    """A document still awaiting review that has required fields below the review threshold."""

    document_id: str
    fields: tuple[str, ...]


@dataclass(frozen=True)
class LandContext:
    land_id: str
    area: float
    area_unit: str
    ownership: tuple[OwnerPeriod, ...] = field(default_factory=tuple)
    transactions: tuple[TxRecord, ...] = field(default_factory=tuple)  # chronological
    owners: dict[str, OwnerRef] = field(default_factory=dict)  # owner_id -> names (P43)
    low_confidence_docs: tuple[DocConfidence, ...] = field(default_factory=tuple)  # P49


@dataclass(frozen=True)
class Evidence:
    """Language-neutral evidence; the backend never emits translated text."""

    code: str
    severity: str
    params: dict

    def to_dict(self) -> dict:
        return {"code": self.code, "severity": self.severity, "params": dict(self.params)}


def active_transactions(ctx: LandContext) -> list[TxRecord]:
    return [t for t in ctx.transactions if t.status != TransactionStatus.REJECTED.value]


_PENDING = (DocumentStatus.REVIEW_REQUIRED.value, DocumentStatus.EXTRACTED.value)


def _low_confidence_docs(
    db: Session, land: LandParcel, threshold: float
) -> tuple[DocConfidence, ...]:
    """Pending-review documents of this parcel with a required field below `threshold`.

    A field corrected by a human is no longer low-confidence (same rule as the review screen).
    """
    docs = db.scalars(
        select(Document)
        .where(Document.land_id == land.id, Document.processing_status.in_(_PENDING))
        .order_by(Document.created_at, Document.id)
    ).all()
    out: list[DocConfidence] = []
    for d in docs:
        raw = (d.extraction_json or {}).get("fields") or []
        low = tuple(
            f["field"]
            for f in raw
            if isinstance(f, dict)
            and f.get("field") in REQUIRED_FIELDS
            and not f.get("edited_by_human")
            and float(f.get("confidence") or 0.0) < threshold
        )
        if low:
            out.append(DocConfidence(d.id, low))
    return tuple(out)


def load_land_context(
    db: Session, land: LandParcel, review_threshold: float | None = None
) -> LandContext:
    if review_threshold is None:
        review_threshold = get_settings().review_conf_threshold
    periods = db.scalars(
        select(OwnershipHistory)
        .where(OwnershipHistory.land_id == land.id)
        .order_by(OwnershipHistory.start_date.is_(None), OwnershipHistory.start_date)
    ).all()
    txs = db.scalars(
        select(Transaction)
        .where(Transaction.land_id == land.id)
        .order_by(
            Transaction.transaction_date.is_(None),
            Transaction.transaction_date,
            Transaction.created_at,
            Transaction.id,
        )
    ).all()
    owner_ids = {p.owner_id for p in periods} | {s for t in txs for s in (t.seller_id, t.buyer_id)}
    owners: dict[str, OwnerRef] = {}
    if owner_ids:
        for o in db.scalars(select(Owner).where(Owner.id.in_(owner_ids))):
            owners[o.id] = OwnerRef(o.name, o.father_name)
    return LandContext(
        land_id=land.land_id,
        area=land.area,
        area_unit=land.area_unit,
        ownership=tuple(OwnerPeriod(p.owner_id, p.start_date, p.end_date) for p in periods),
        transactions=tuple(
            TxRecord(
                id=t.id,
                seller_id=t.seller_id,
                buyer_id=t.buyer_id,
                transaction_date=t.transaction_date,
                area=t.area,
                area_unit=t.area_unit,
                status=t.status,
                deed_no=t.deed.deed_no if t.deed is not None else None,
            )
            for t in txs
        ),
        owners=owners,
        low_confidence_docs=_low_confidence_docs(db, land, review_threshold),
    )
