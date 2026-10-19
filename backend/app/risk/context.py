"""Pure input for risk rules (R3). Rules never touch the DB.

`load_land_context` is the only DB reader.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ai.extraction import lhdr
from app.core.config import get_settings
from app.models.deed import Deed
from app.models.document import Document
from app.models.document_record import DocumentRecord
from app.models.encumbrance import LandEncumbrance
from app.models.enums import (
    DocumentStatus,
    OwnershipKind,
    RecordStatus,
    SurveyType,
    TransactionStatus,
)
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.schemas.extraction import REQUIRED_FIELDS
from app.services import ledger


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
    from_document: bool = (
        False  # posted from an uploaded document (F2a will auto-create its mutation)
    )
    # H9a: the sale of an approved historical deed (a past chain-of-title link). The modern rules
    # (dates, areas, sellers, duplicates, ML) skip it; only the chain walks (`_reachable`) use it.
    historical: bool = False


@dataclass(frozen=True)
class MutRecord:
    """A mutation (namjari) with the deed area it should not exceed (resolved by the loader)."""

    id: str
    transaction_id: str | None
    deed_id: str | None
    applicant_owner_id: str
    status: str
    area: float
    area_unit: str
    deed_area: float | None = None
    deed_area_unit: str | None = None
    applied_on: date | None = None  # F2a: a pending mutation inside the grace window is in progress


@dataclass(frozen=True)
class EncRecord:
    """An encumbrance on the parcel (F3a). Only ACTIVE ones matter to the rules."""

    id: str
    type: str
    reference_no: str
    status: str
    authority: str | None = None


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
class SurveyRecord:
    """An approved khatian / porcha of the parcel (F5c): its survey and the owner names it lists.

    Names are used only to compare surveys; they never reach evidence params.
    """

    document_id: str
    survey_type: str  # CS | SA | RS | BS
    owner_names: tuple[str, ...]


@dataclass(frozen=True)
class HistoricalLink:
    """A past chain-of-title link (H9a) from an approved historical deed: seller -> buyer.

    Ids only; names come from `LandContext.owners` and never reach evidence params.
    """

    transaction_id: str
    document_id: str | None
    seller_id: str
    buyer_id: str
    start_date: date | None  # the deed date (None = unknown)


@dataclass(frozen=True)
class HistoricalDeedInfo:
    """What the approved digital record (LHDR) of a historical deed says about the plot and the price (H9d).

    Ids, dag / khatian numbers and money only; names never reach evidence params.
    """

    transaction_id: str
    document_id: str
    seller_id: str
    buyer_id: str
    deed_date: date | None
    dags: tuple[str, ...] = ()  # normalised dag numbers of the schedule
    khatians: tuple[tuple[str, str], ...] = ()  # (survey, khatian no) of the schedule
    kind: str | None = None  # DeedKind value
    era: str | None = None  # Era value
    currency: str | None = None  # INR | PKR | BDT as written on the deed
    amount: float | None = None
    area_decimal: float | None = None  # total area in decimal (shatak); None = not convertible


@dataclass(frozen=True)
class LandContext:
    land_id: str
    area: float
    area_unit: str
    ownership: tuple[OwnerPeriod, ...] = field(default_factory=tuple)
    transactions: tuple[TxRecord, ...] = field(default_factory=tuple)  # chronological
    owners: dict[str, OwnerRef] = field(default_factory=dict)  # owner_id -> names (P43)
    low_confidence_docs: tuple[DocConfidence, ...] = field(default_factory=tuple)  # P49
    mutations: tuple[MutRecord, ...] = field(default_factory=tuple)  # F1b
    encumbrances: tuple[EncRecord, ...] = field(default_factory=tuple)  # F3a
    as_of: date | None = None  # reference "today" for time-based rules; None = date.today()
    survey_records: tuple[SurveyRecord, ...] = field(default_factory=tuple)  # F5c
    # F4c: (entity_type, entity_id) of records whose live row differs from the ledger
    integrity_failures: tuple[tuple[str, str], ...] = field(default_factory=tuple)
    historical_links: tuple[HistoricalLink, ...] = field(default_factory=tuple)  # H9c
    historical_deeds: tuple[HistoricalDeedInfo, ...] = field(default_factory=tuple)  # H9d


@dataclass(frozen=True)
class Evidence:
    """Language-neutral evidence; the backend never emits translated text."""

    code: str
    severity: str
    params: dict

    def to_dict(self) -> dict:
        return {"code": self.code, "severity": self.severity, "params": dict(self.params)}


def active_transactions(ctx: LandContext, include_historical: bool = False) -> list[TxRecord]:
    """Not-rejected sales. Historical-deed sales are left out unless asked for: a 1944 deed is a
    past link of the chain of title, not a transfer the modern rules can judge."""
    return [
        t
        for t in ctx.transactions
        if t.status != TransactionStatus.REJECTED.value and (include_historical or not t.historical)
    ]


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


def _mutations(db: Session, land: LandParcel) -> tuple[MutRecord, ...]:
    rows = db.execute(
        select(MutationRecord, Deed)
        .outerjoin(Deed, Deed.id == MutationRecord.deed_id)
        .where(MutationRecord.land_id == land.id)
        .order_by(MutationRecord.applied_at, MutationRecord.id)
    ).all()
    return tuple(
        MutRecord(
            id=m.id,
            transaction_id=m.transaction_id,
            deed_id=m.deed_id,
            applicant_owner_id=m.applicant_owner_id,
            status=m.status,
            area=m.area,
            area_unit=m.area_unit,
            deed_area=d.area if d is not None else None,
            deed_area_unit=d.area_unit if d is not None else None,
            applied_on=m.applied_at.date() if m.applied_at is not None else None,
        )
        for m, d in rows
    )


def _encumbrances(db: Session, land: LandParcel) -> tuple[EncRecord, ...]:
    rows = db.scalars(
        select(LandEncumbrance)
        .where(LandEncumbrance.land_id == land.id)
        .order_by(
            LandEncumbrance.started_at.is_(None), LandEncumbrance.started_at, LandEncumbrance.id
        )
    ).all()
    return tuple(EncRecord(e.id, e.type, e.reference_no, e.status, e.authority) for e in rows)


SURVEY_TYPES = tuple(s.value for s in SurveyType)


def _survey_records(db: Session, land: LandParcel) -> tuple[SurveyRecord, ...]:
    docs = db.scalars(
        select(Document)
        .where(
            Document.land_id == land.id,
            Document.processing_status == DocumentStatus.APPROVED.value,
        )
        .order_by(Document.created_at, Document.id)
    ).all()
    out: list[SurveyRecord] = []
    for d in docs:
        ex = d.extraction_json or {}
        survey = ex.get("survey_type") or land.survey_type  # SJ4: the parcel's survey as fallback
        if survey not in SURVEY_TYPES:
            continue
        owners = (ex.get("extras") or {}).get("owners") or []
        names = tuple(
            o["name"] for o in owners if isinstance(o, dict) and isinstance(o.get("name"), str)
        )
        if names:
            out.append(SurveyRecord(d.id, survey, names))
    return tuple(out)


def _historical_links(db: Session, land: LandParcel) -> tuple[HistoricalLink, ...]:
    rows = db.execute(
        select(OwnershipHistory, Transaction)
        .join(Transaction, Transaction.id == OwnershipHistory.source_transaction_id)
        .where(
            OwnershipHistory.land_id == land.id,
            OwnershipHistory.kind == OwnershipKind.HISTORICAL.value,
            Transaction.status != TransactionStatus.REJECTED.value,
        )
        .order_by(
            OwnershipHistory.start_date.is_(None), OwnershipHistory.start_date, Transaction.id
        )
    ).all()
    return tuple(
        HistoricalLink(t.id, t.source_document_id, t.seller_id, h.owner_id, h.start_date)
        for h, t in rows
    )


_DECIMAL_PER_UNIT = {  # one unit in decimal (shatak); archaic units are left out on purpose
    "decimal": 1.0, "acre": 100.0, "bigha": 33.0, "katha": 720 / 435.6,
    "sqft": 1 / 435.6, "sqm": 1 / 40.4686,
}  # fmt: skip


def _num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _digits(v: str) -> str:
    return str(v).translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")).strip().casefold()


def _area_decimal(plots: list[dict]) -> float | None:
    total = 0.0
    for p in plots:
        a = p.get("area") or {}
        eq = _num(a.get("decimal_equiv"))
        if eq is None:
            unit = lhdr.canonical_unit(a.get("unit"))
            v = _num(a.get("value"))
            if unit not in _DECIMAL_PER_UNIT or v is None:
                return None
            eq = v * _DECIMAL_PER_UNIT[unit]
        total += eq
    return total if plots and total > 0 else None


def _historical_deeds(
    db: Session, land: LandParcel, links: tuple[HistoricalLink, ...]
) -> tuple[HistoricalDeedInfo, ...]:
    """The newest APPROVED lhdr/1 record of each historical deed on this parcel."""
    out: list[HistoricalDeedInfo] = []
    for link in links:
        if link.document_id is None:
            continue
        row = db.scalars(
            select(DocumentRecord)
            .where(
                DocumentRecord.document_id == link.document_id,
                DocumentRecord.status == RecordStatus.APPROVED.value,
                DocumentRecord.record_schema == lhdr.SCHEMA,
            )
            .order_by(DocumentRecord.version.desc())
        ).first()
        if row is None:
            continue
        try:
            rec = lhdr.plain(lhdr.parse(row.record_json))
        except Exception:  # a record that does not parse has nothing to compare
            continue
        plots = rec.get("schedule") or []
        cons = rec.get("consideration") or {}
        docsec = rec.get("document") or {}
        dags = sorted({_digits(d) for p in plots for d in (p.get("dag_no") or []) if str(d).strip()})
        khat = sorted(
            {
                (str(p.get("survey") or ""), _digits(p["khatian_no"]))
                for p in plots
                if p.get("khatian_no")
            }
        )
        out.append(
            HistoricalDeedInfo(
                transaction_id=link.transaction_id,
                document_id=link.document_id,
                seller_id=link.seller_id,
                buyer_id=link.buyer_id,
                deed_date=link.start_date,
                dags=tuple(dags),
                khatians=tuple(khat),
                kind=docsec.get("kind"),
                era=docsec.get("era"),
                currency=cons.get("era_currency"),
                amount=_num(cons.get("amount")),
                area_decimal=_area_decimal(plots),
            )
        )
    return tuple(out)


def load_land_context(
    db: Session, land: LandParcel, review_threshold: float | None = None
) -> LandContext:
    if review_threshold is None:
        review_threshold = get_settings().review_conf_threshold
    periods = db.scalars(
        select(OwnershipHistory)
        .where(
            OwnershipHistory.land_id == land.id,
            OwnershipHistory.kind == OwnershipKind.CURRENT.value,  # H9a: past links are for H9c
        )
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
    muts = _mutations(db, land)
    links = _historical_links(db, land)
    historical_tx = set(
        db.scalars(
            select(OwnershipHistory.source_transaction_id).where(
                OwnershipHistory.land_id == land.id,
                OwnershipHistory.kind == OwnershipKind.HISTORICAL.value,
                OwnershipHistory.source_transaction_id.is_not(None),
            )
        )
    )
    owner_ids = (
        {p.owner_id for p in periods}
        | {x for h in links for x in (h.seller_id, h.buyer_id)}
        | {s for t in txs for s in (t.seller_id, t.buyer_id)}
        | {m.applicant_owner_id for m in muts}
    )
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
                from_document=t.source_document_id is not None,
                historical=t.id in historical_tx,
            )
            for t in txs
        ),
        owners=owners,
        low_confidence_docs=_low_confidence_docs(db, land, review_threshold),
        mutations=muts,
        encumbrances=_encumbrances(db, land),
        survey_records=_survey_records(db, land),
        integrity_failures=ledger.integrity_failures(db, land),
        historical_links=links,
        historical_deeds=_historical_deeds(db, land, links),
    )
