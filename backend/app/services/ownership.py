from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.land import LandOwnerPublic
from app.schemas.ownership import (
    DocumentRef,
    OwnershipEntry,
    OwnershipResponse,
    TransactionEntry,
    TransactionsResponse,
)
from app.services.land import _BN_DIGITS, _SEES_FATHER, _not_found


def _land(db: Session, land_id: str) -> LandParcel:
    key = " ".join(land_id.translate(_BN_DIGITS).split())
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == key))
    if land is None:
        raise _not_found()
    return land


def _person(owner: Owner, viewer: User) -> LandOwnerPublic:
    show = viewer.role in _SEES_FATHER
    return LandOwnerPublic(name=owner.name, father_name=owner.father_name if show else None)


def _doc_ref(doc: Document | None) -> DocumentRef | None:
    return DocumentRef(id=doc.id, type=doc.document_type) if doc is not None else None


def get_ownership(db: Session, land_id: str, viewer: User) -> OwnershipResponse:
    land = _land(db, land_id)
    rows = db.execute(
        select(OwnershipHistory, Owner, Document)
        .join(Owner, Owner.id == OwnershipHistory.owner_id)
        .outerjoin(Transaction, Transaction.id == OwnershipHistory.source_transaction_id)
        .outerjoin(Document, Document.id == Transaction.source_document_id)
        .where(OwnershipHistory.land_id == land.id)
        .order_by(
            OwnershipHistory.start_date.is_(None),
            OwnershipHistory.start_date,
            OwnershipHistory.created_at,
            OwnershipHistory.id,
        )
    ).all()
    entries = [
        OwnershipEntry(
            owner=_person(owner, viewer),
            start_date=h.start_date,
            end_date=h.end_date,
            is_current=h.end_date is None,
            confidence=h.confidence,
            document=_doc_ref(doc),
        )
        for h, owner, doc in rows
    ]
    return OwnershipResponse(land_id=land.land_id, entries=entries)


def get_transactions(db: Session, land_id: str, viewer: User) -> TransactionsResponse:
    land = _land(db, land_id)
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
    out = [
        TransactionEntry(
            transaction_type=t.transaction_type,
            transaction_date=t.transaction_date,
            seller=_person(t.seller, viewer),
            buyer=_person(t.buyer, viewer),
            area=t.area,
            area_unit=t.area_unit,
            status=t.status,
            document=_doc_ref(t.source_document),
        )
        for t in txs
    ]
    return TransactionsResponse(land_id=land.land_id, transactions=out)
