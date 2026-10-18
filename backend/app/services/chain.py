"""Chain of title (H9a, D2): an approved historical deed is a *past* link of the land's ownership
history (buyer, from the deed date), never the current owner.

- The link is an `ownership_history` row with kind HISTORICAL, tied to the deed's transaction
  (`source_transaction_id`). Current-owner queries ignore it (kind CURRENT only).
- `end_date` is the start of the next known holder (any later period on the land). When none is
  known it is the deed date itself (a one-day span, the end of the holding is unknown); with no
  deed date both dates stay null.
- A correction after approval updates the same link (`refresh`), never adds a second one.
- Every call only flushes; the caller commits.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.enums import OwnershipKind
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.schemas.extraction import Extraction

HISTORICAL = OwnershipKind.HISTORICAL.value


def is_historical(extraction: Extraction) -> bool:
    return extraction.deed_profile == "historical"


def _confidence(extraction: Extraction) -> float | None:
    confs = [f.confidence for f in extraction.fields if f.field in ("seller", "buyer")]
    return min(confs) if confs else None


def link_for(db: Session, tx_id: str) -> OwnershipHistory | None:
    return db.scalar(
        select(OwnershipHistory).where(
            OwnershipHistory.source_transaction_id == tx_id,
            OwnershipHistory.kind == HISTORICAL,
        )
    )


def _set_ranges(db: Session, land_pk: str) -> None:
    """end_date of every historical link of the land = start of the next known period."""
    periods = db.scalars(select(OwnershipHistory).where(OwnershipHistory.land_id == land_pk)).all()
    for link in (p for p in periods if p.kind == HISTORICAL):
        if link.start_date is None:
            link.end_date = None
            continue
        later = [
            p.start_date
            for p in periods
            if p.id != link.id and p.start_date is not None and p.start_date > link.start_date
        ]
        link.end_date = min(later) if later else link.start_date


def record(
    db: Session,
    land: LandParcel,
    buyer: Owner,
    tx: Transaction,
    tx_date: date | None,
    extraction: Extraction,
) -> OwnershipHistory:
    """Add the link for a posted historical deed (or return the one it already has)."""
    link = link_for(db, tx.id)
    if link is None:
        link = OwnershipHistory(
            land_id=land.id, owner_id=buyer.id, start_date=tx_date, end_date=None,
            source_transaction_id=tx.id, confidence=_confidence(extraction), kind=HISTORICAL,
        )  # fmt: skip
        db.add(link)
        db.flush()
    _set_ranges(db, land.id)
    db.flush()
    return link


def refresh(
    db: Session, doc: Document, buyer: Owner, tx_date: date | None, extraction: Extraction
) -> OwnershipHistory | None:
    """A correction was approved: update the document's link in place. None = it has none."""
    tx = db.scalar(select(Transaction).where(Transaction.source_document_id == doc.id))
    link = link_for(db, tx.id) if tx is not None else None
    if link is None:
        return None
    link.owner_id, link.start_date = buyer.id, tx_date
    link.confidence = _confidence(extraction)
    _set_ranges(db, link.land_id)
    db.flush()
    return link
