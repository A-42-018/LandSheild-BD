"""Document library (H7a): a paginated, scoped list of documents.

Who sees what (same scoping as the review queue, `offices.doc_scope`):
- an office officer: documents of their own office and the offices beneath it, plus every document
  they uploaded themselves (even one filed under another office before a transfer);
- admins, reviewers and the unrestricted demo officer: everything;
- citizens never reach this module (the route is REVIEWER and up).

Filters and sorting run in SQL. Search text (deed no, mouza, party name, land id), the `profile`
filter and the `deed_date` sort read `extraction_json`, which is not indexed on either database,
so they run in Python over the SQL-filtered rows (the demo has hundreds of documents, not millions;
a column or index is the next step if that changes). Bangla digits are folded to ASCII on both
sides, so `৪৭৮২` finds `4782`.
"""
from datetime import UTC, date, datetime, time, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.deed import Deed
from app.models.document import Document
from app.models.document_record import DocumentRecord
from app.models.enums import DocumentStatus, OwnershipKind, RecordStatus, Role
from app.models.land_parcel import LandParcel
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.document import (
    ApprovedRecordBrief,
    ChainLinkBrief,
    LandDocumentItem,
    LandDocuments,
    LibraryItem,
    LibraryList,
    LibrarySort,
    LibraryTab,
    OfficeBrief,
)
from app.schemas.officer import SortOrder
from app.services import land as land_svc
from app.services import records as records_svc
from app.services.extraction import _parse_date
from app.services.offices import area_filter, doc_scope

PENDING = (DocumentStatus.REVIEW_REQUIRED.value, DocumentStatus.EXTRACTED.value)
RETRY = (DocumentStatus.UPLOADED.value, DocumentStatus.FAILED.value)
DHAKA = timezone(timedelta(hours=6))  # Bangladesh has no daylight saving
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def _norm(value) -> str:
    return " ".join(str(value).translate(_BN).casefold().split())


def _field(ex: dict, name: str) -> str | None:
    for f in ex.get("fields") or []:
        if isinstance(f, dict) and f.get("field") == name and f.get("value"):
            return str(f["value"])
    return None


def _texts(x) -> list[str]:
    """Value and verbatim of an LHDR Field (or a plain value)."""
    if isinstance(x, dict):
        return [str(x[k]) for k in ("value", "verbatim") if x.get(k) not in (None, "")]
    return [] if x in (None, "") else [str(x)]


def _deed_date(ex: dict) -> date | None:
    raw = _field(ex, "deed_date")
    if raw:
        return _parse_date(raw.translate(_BN))
    return None


def _haystack(ex: dict, land_code: str | None, land_mouza: str | None) -> list[str]:
    parts = [land_code or "", land_mouza or ""]
    parts += [v for n in ("deed_no", "mouza", "seller", "buyer", "owner_name")
              if (v := _field(ex, n))]  # fmt: skip
    rec = ex.get("record") or {}
    reg = rec.get("registration") or {}
    parts += _texts(reg.get("deed_no")) + _texts(reg.get("deed_no_verbatim"))
    for party in rec.get("parties") or []:
        if isinstance(party, dict):
            parts += _texts(party.get("name"))
    for plot in rec.get("schedule") or []:
        if isinstance(plot, dict):
            parts += _texts(plot.get("mouza"))
    return [_norm(p) for p in parts if p]


def _can_approve(doc_status: str, uploaded_by: str | None, user: User) -> bool:
    if doc_status not in PENDING:
        return False
    return user.role == Role.ADMIN.value or uploaded_by is None or uploaded_by != user.id


def _needs_action(doc_status: str, uploaded_by: str | None, user: User) -> bool:
    if _can_approve(doc_status, uploaded_by, user):
        return True
    return doc_status in RETRY and uploaded_by == user.id


def _day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=DHAKA).astimezone(UTC)


def list_documents(
    db: Session,
    user: User,
    *,
    tab: LibraryTab | None = None,
    mine: bool = False,
    status: DocumentStatus | None = None,
    document_type: str | None = None,
    profile: str | None = None,
    division: str | None = None,
    district: str | None = None,
    upazila: str | None = None,
    office_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    sort: LibrarySort = LibrarySort.CREATED_AT,
    order: SortOrder = SortOrder.DESC,
    limit: int = 20,
    offset: int = 0,
) -> LibraryList:
    if date_from and date_to and date_from > date_to:
        raise AppError("INVALID_DATE_RANGE", "date_from is after date_to", 422)
    cond = []
    scope = doc_scope(user)  # None = unrestricted
    if scope is not None:  # uploaders always see their own uploads
        cond.append(or_(scope, Document.uploaded_by == user.id))
    if tab == LibraryTab.OFFICE and scope is not None:
        cond.append(scope)
    if mine or tab == LibraryTab.MINE:
        cond.append(Document.uploaded_by == user.id)
    if tab == LibraryTab.ACTION:
        review = Document.processing_status.in_(PENDING)
        if user.role != Role.ADMIN.value:  # four-eyes: not my own upload
            not_mine = or_(Document.uploaded_by.is_(None), Document.uploaded_by != user.id)
            review = and_(review, not_mine)
        retry = and_(Document.processing_status.in_(RETRY), Document.uploaded_by == user.id)
        cond.append(or_(review, retry))
    if status is not None:
        cond.append(Document.processing_status == status.value)
    if document_type:
        cond.append(Document.document_type == document_type)
    area = area_filter(Document.office_id, division, district, upazila, office_id)
    if area is not None:
        cond.append(area)
    if date_from:
        cond.append(Document.created_at >= _day_start(date_from))
    if date_to:
        cond.append(Document.created_at < _day_start(date_to + timedelta(days=1)))

    sort_col = Document.processing_status if sort == LibrarySort.STATUS else Document.created_at
    primary = sort_col.asc() if order == SortOrder.ASC else sort_col.desc()
    base = (
        select(Document, LandParcel.land_id, LandParcel.mouza)
        .outerjoin(LandParcel, Document.land_id == LandParcel.id)
        .where(*cond)
    )
    term = _norm(q) if q and q.strip() else None
    in_python = bool(term) or profile is not None or sort == LibrarySort.DEED_DATE
    if not in_python:
        total = db.scalar(
            select(func.count()).select_from(Document).where(*cond)
        ) or 0
        rows = db.execute(base.order_by(primary, Document.id).limit(limit).offset(offset)).all()
    else:
        rows = db.execute(base.order_by(primary, Document.id)).all()
        kept = []
        for row in rows:
            doc, code, mouza = row
            ex = doc.extraction_json or {}
            if profile is not None and ex.get("deed_profile") != profile:
                continue
            if term and not any(term in h for h in _haystack(ex, code, mouza)):
                continue
            kept.append(row)
        if sort == LibrarySort.DEED_DATE:
            dated = [(r, _deed_date(r[0].extraction_json or {})) for r in kept]
            have = sorted((x for x in dated if x[1]), key=lambda x: (x[1], x[0][0].id),
                          reverse=order == SortOrder.DESC)  # fmt: skip
            kept = [x[0] for x in have] + [x[0] for x in dated if not x[1]]
        total = len(kept)
        rows = kept[offset : offset + limit]

    return LibraryList(items=_items(db, user, rows), total=total, limit=limit, offset=offset)


def _items(db: Session, user: User, rows) -> list[LibraryItem]:
    """Library rows (Document, land code, land mouza) -> items, with one query for the versions."""
    ids = [d.id for d, _, _ in rows]
    versions: dict[str, list[tuple[int, str]]] = {}
    if ids:
        for did, ver, st in db.execute(
            select(DocumentRecord.document_id, DocumentRecord.version, DocumentRecord.status)
            .where(DocumentRecord.document_id.in_(ids))
        ):
            versions.setdefault(did, []).append((ver, st))
    items = []
    for doc, code, mouza in rows:
        ex = doc.extraction_json or {}
        recs = versions.get(doc.id, [])
        approved = [v for v, st in recs if st == RecordStatus.APPROVED.value]
        prof = ex.get("deed_profile")
        items.append(
            LibraryItem(
                id=doc.id,
                land_id=code,
                document_type=doc.document_type,
                processing_status=doc.processing_status,
                file_type=doc.file_path.rsplit(".", 1)[-1],
                created_at=doc.created_at,
                office=OfficeBrief.model_validate(doc.office) if doc.office else None,
                deed_no=_field(ex, "deed_no"),
                mouza=_field(ex, "mouza") or mouza,
                deed_date=_deed_date(ex),
                deed_profile=prof if prof in ("modern", "historical") else None,
                historical=prof == "historical",
                uploaded_by_me=doc.uploaded_by == user.id,
                digitised=bool(approved),
                approved_version=max(approved) if approved else None,
                versions=len(recs),
                needs_my_action=_needs_action(doc.processing_status, doc.uploaded_by, user),
            )
        )
    return items


def land_documents(db: Session, user: User, land_id: str) -> LandDocuments:
    """Every document of one land (H7b), oldest deed first, each with its latest approved record.

    A document belongs to the land through `documents.land_id` or through a deed it posted
    (`deeds.document_id`). Scoped exactly like the library list: the user's own office and the
    offices beneath it, plus their own uploads; a document outside that scope is not listed (the
    land itself stays visible). Documents without a deed date come last, then by upload time.
    """
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_svc._norm(land_id)))
    if land is None:
        raise land_svc._not_found()
    cond = [
        or_(
            Document.land_id == land.id,
            Document.id.in_(select(Deed.document_id).where(Deed.land_id == land.id)),
        )
    ]
    scope = doc_scope(user)
    if scope is not None:
        cond.append(or_(scope, Document.uploaded_by == user.id))
    docs = list(db.scalars(select(Document).where(*cond)).all())
    dated = [(d, _deed_date(d.extraction_json or {})) for d in docs]
    dated.sort(key=lambda x: (x[1] is None, x[1] or date.min, _utc(x[0].created_at), x[0].id))
    rows = [(d, land.land_id, land.mouza) for d, _ in dated]
    base = _items(db, user, rows)

    approved: dict[str, DocumentRecord] = {}
    if rows:
        for rec in db.scalars(
            select(DocumentRecord).where(
                DocumentRecord.document_id.in_([d.id for d, _ in dated]),
                DocumentRecord.status == RecordStatus.APPROVED.value,
            )
        ):
            approved[rec.document_id] = rec
    links: dict[str, ChainLinkBrief] = {}  # document id -> its historical chain-of-title link (H9b)
    if rows:
        for doc_id, link in db.execute(
            select(Transaction.source_document_id, OwnershipHistory)
            .join(OwnershipHistory, OwnershipHistory.source_transaction_id == Transaction.id)
            .where(
                Transaction.land_id == land.id,
                Transaction.source_document_id.in_([d.id for d, _ in dated]),
                OwnershipHistory.kind == OwnershipKind.HISTORICAL.value,
            )
        ):
            links[doc_id] = ChainLinkBrief(start_date=link.start_date, end_date=link.end_date)
    items = []
    for (doc, _), item in zip(dated, base, strict=True):
        rec = approved.get(doc.id)
        brief = None
        if rec is not None:
            brief = ApprovedRecordBrief(
                version=rec.version,
                record_schema=rec.record_schema,
                approved_at=rec.approved_at,
                approved_by=rec.approver.name if rec.approver else None,
                signature_status=records_svc.check_signature(doc, rec),
            )
        items.append(
            LandDocumentItem(**item.model_dump(), approved_record=brief, chain_link=links.get(doc.id))
        )
    return LandDocuments(land_id=land.land_id, items=items, total=len(items))


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
