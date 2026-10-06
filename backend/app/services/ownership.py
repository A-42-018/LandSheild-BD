from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.encumbrance import LandEncumbrance
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.encumbrance import EncumbranceEntry, EncumbrancesResponse
from app.schemas.land import LandOwnerPublic
from app.schemas.mutation import MutationEntry, MutationsResponse
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


def get_mutations(db: Session, land_id: str, viewer: User) -> MutationsResponse:
    land = _land(db, land_id)
    rows = db.scalars(
        select(MutationRecord)
        .where(MutationRecord.land_id == land.id)
        .order_by(MutationRecord.applied_at, MutationRecord.id)
    ).all()
    staff = viewer.role in _SEES_FATHER
    out = [
        MutationEntry(
            mutation_no=m.mutation_no,
            status=m.status,
            applied_at=m.applied_at,
            decided_at=m.decided_at,
            previous_khatian_no=m.previous_khatian_no,
            new_khatian_no=m.new_khatian_no,
            applicant=_person(m.applicant, viewer) if staff else None,
            area=m.area if staff else None,
            area_unit=m.area_unit if staff else None,
            ac_land_office=m.ac_land_office if staff else None,
            deed_no=m.deed.deed_no if staff and m.deed is not None else None,
        )
        for m in rows
    ]
    return MutationsResponse(land_id=land.land_id, mutations=out)


def get_encumbrances(db: Session, land_id: str, viewer: User) -> EncumbrancesResponse:
    land = _land(db, land_id)
    rows = db.scalars(
        select(LandEncumbrance)
        .where(LandEncumbrance.land_id == land.id)
        .order_by(
            LandEncumbrance.started_at.is_(None), LandEncumbrance.started_at, LandEncumbrance.id
        )
    ).all()
    staff = viewer.role in _SEES_FATHER
    return EncumbrancesResponse(
        land_id=land.land_id,
        encumbrances=[
            EncumbranceEntry(
                type=e.type,
                status=e.status,
                started_at=e.started_at,
                resolved_at=e.resolved_at,
                reference_no=e.reference_no if staff else None,
                authority=e.authority if staff else None,
                note=e.note if staff else None,
            )
            for e in rows
        ],
    )
