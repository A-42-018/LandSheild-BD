"""'Check Before You Buy': six read-only checklist rows. Indicators only, never a legal finding."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.encumbrance import LandEncumbrance
from app.models.enums import MutationStatus, OwnershipKind
from app.models.mutation import MutationRecord
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.risk.assess import assess
from app.risk.context import load_land_context
from app.schemas.pre_purchase import CheckRow, PrePurchaseCheck
from app.services.names import MERGE_MIN, VARIANT_MIN, owner_similarity
from app.services.ownership import _land

PASS, WARN, FAIL, UNKNOWN = "PASS", "WARN", "FAIL", "UNKNOWN"
_PENDING = (
    MutationStatus.APPLIED.value,
    MutationStatus.UNDER_REVIEW.value,
    MutationStatus.HEARING.value,
    MutationStatus.APPEALED.value,
)


def _seller_row(db: Session, land_pk: str, seller: str | None) -> CheckRow:
    owners = db.scalars(
        select(Owner.name)
        .join(OwnershipHistory, OwnershipHistory.owner_id == Owner.id)
        .where(
            OwnershipHistory.land_id == land_pk,
            OwnershipHistory.end_date.is_(None),
            OwnershipHistory.kind == OwnershipKind.CURRENT.value,
        )
    ).all()
    if not (seller or "").strip() or not owners:
        return CheckRow(code="SELLER_MATCHES_OWNER", status=UNKNOWN, detail={})
    best = max(owner_similarity(seller, n) for n in owners)
    status = PASS if best >= MERGE_MIN else WARN if best >= VARIANT_MIN else FAIL
    return CheckRow(code="SELLER_MATCHES_OWNER", status=status, detail={})


def _mutation_row(db: Session, land_pk: str) -> CheckRow:
    pending = db.scalar(
        select(func.count())
        .select_from(MutationRecord)
        .where(MutationRecord.land_id == land_pk, MutationRecord.status.in_(_PENDING))
    )
    approved = select(MutationRecord.transaction_id).where(
        MutationRecord.land_id == land_pk,
        MutationRecord.status == MutationStatus.APPROVED.value,
        MutationRecord.transaction_id.is_not(None),
    )
    unmutated = db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.land_id == land_pk, Transaction.id.not_in(approved))
    )
    status = WARN if (pending or unmutated) else PASS
    return CheckRow(
        code="MUTATION_UP_TO_DATE",
        status=status,
        detail={"pending": pending or 0, "unmutated": unmutated or 0},
    )


def _active(db: Session, land_pk: str) -> dict[str, int]:
    rows = db.execute(
        select(LandEncumbrance.type, func.count())
        .where(LandEncumbrance.land_id == land_pk, LandEncumbrance.status == "ACTIVE")
        .group_by(LandEncumbrance.type)
    ).all()
    return {t: n for t, n in rows}


def get_pre_purchase_check(db: Session, land_id: str, seller: str | None) -> PrePurchaseCheck:
    land = _land(db, land_id)
    active = _active(db, land.id)
    cases = active.get("COURT_CASE", 0)
    khas, acq = active.get("KHAS", 0), active.get("ACQUISITION", 0)
    evidence = assess(load_land_context(db, land)).evidence
    high = sum(1 for e in evidence if e.severity == "HIGH")
    other = sum(1 for e in evidence if e.severity in ("MEDIUM", "LOW"))
    rows = [
        _seller_row(db, land.id, seller),
        _mutation_row(db, land.id),
        CheckRow(
            code="NO_PENDING_CASE", status=FAIL if cases else PASS, detail={"count": cases}
        ),
        CheckRow(
            code="NOT_KHAS_OR_ACQUIRED",
            status=FAIL if (khas or acq) else PASS,
            detail={"khas": khas, "acquisition": acq},
        ),
        CheckRow(
            code="NO_OPEN_RISK_INDICATORS",
            status=FAIL if high else WARN if other else PASS,
            detail={"high": high, "other": other},
        ),
        CheckRow(code="DOCUMENT_AUTHENTIC", status=UNKNOWN, detail={}),
    ]
    flagged = any(r.status in (WARN, FAIL) for r in rows)
    return PrePurchaseCheck(
        land_id=land.land_id,
        rows=rows,
        verdict="INDICATORS_FOUND" if flagged else "NO_INDICATORS",
    )
