"""e-Mutation workflow (F2a): auto-create from posting, pre-checks, state machine.

Everything flushes only; the caller owns the transaction (posting: review.approve_document;
transition: the endpoint commits). Pre-check results: PASS | FAIL | NOT_CHECKED (F3a fills the
two encumbrance checks (done in F3a)). NOT_CHECKED never blocks the fast track.
"""
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.rbac import REVIEW_UP
from app.models.alert import FraudAlert
from app.models.deed import Deed
from app.models.encumbrance import LandEncumbrance
from app.models.enums import AlertStatus, MutationSource, MutationStatus
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.risk.config import AREA_TO_SQM
from app.schemas.mutation import (
    MutationDetail,
    MutationList,
    MutationQueueItem,
)
from app.services import audit, ledger
from app.services.risk import analyze_land

S = MutationStatus
PASS, FAIL, NOT_CHECKED = "PASS", "FAIL", "NOT_CHECKED"
CHECKS = (
    "SELLER_IS_RECORDED_OWNER",
    "NO_OPEN_HIGH_ALERT",
    "NO_ACTIVE_CASE",
    "NOT_KHAS_OR_ACQUIRED",
    "AREA_WITHIN_SELLER_HOLDING",
    "DOCUMENT_HUMAN_APPROVED",
)
TRANSITIONS: dict[str, tuple[str, ...]] = {
    S.APPLIED: (S.UNDER_REVIEW, S.HEARING, S.REJECTED),
    S.UNDER_REVIEW: (S.APPROVED, S.HEARING, S.REJECTED),
    S.HEARING: (S.UNDER_REVIEW, S.APPROVED, S.REJECTED),
    S.APPROVED: (),
    S.REJECTED: (),
}
REASON_REQUIRED = (S.REJECTED.value, S.HEARING.value)
_OPEN_ALERT = (AlertStatus.OPEN.value, AlertStatus.UNDER_REVIEW.value, AlertStatus.ESCALATED.value)


def _next_no(db: Session, year: int) -> str:
    nums = [
        int(n.rsplit("-", 1)[1])
        for n in db.scalars(select(MutationRecord.mutation_no))
        if n.rsplit("-", 1)[-1].isdigit()
    ]
    return f"MUT-{year}-{max([0, *nums]) + 1:04d}"


def run_prechecks(db: Session, m: MutationRecord, actor: User) -> dict[str, str]:
    """Checklist for one mutation (read-only)."""
    tx = db.get(Transaction, m.transaction_id) if m.transaction_id else None
    land = db.get(LandParcel, m.land_id)
    effective = tx.transaction_date if tx else None
    periods = (
        db.scalars(
            select(OwnershipHistory).where(
                OwnershipHistory.land_id == m.land_id,
                OwnershipHistory.owner_id == tx.seller_id,
            )
        ).all()
        if tx
        else []
    )
    # still the owner (flagged tx) or the period was ended by this very sale
    seller_ok = any(p.end_date is None or p.end_date == effective for p in periods)
    open_high = db.scalar(
        select(func.count())
        .select_from(FraudAlert)
        .where(
            FraudAlert.land_id == m.land_id,
            FraudAlert.severity == "HIGH",
            FraudAlert.status.in_(_OPEN_ALERT),
        )
    )
    f_m, f_l = AREA_TO_SQM.get(m.area_unit), AREA_TO_SQM.get(land.area_unit or "")
    if f_m is None or f_l is None or land.area is None:
        area = NOT_CHECKED
    else:
        area = PASS if m.area * f_m <= land.area * f_l * (1 + 1e-6) else FAIL
    active = set(
        db.scalars(
            select(LandEncumbrance.type).where(
                LandEncumbrance.land_id == m.land_id, LandEncumbrance.status == "ACTIVE"
            )
        )
    )
    return {
        "SELLER_IS_RECORDED_OWNER": PASS if seller_ok else FAIL,
        "NO_OPEN_HIGH_ALERT": FAIL if open_high else PASS,
        "NO_ACTIVE_CASE": FAIL if "COURT_CASE" in active else PASS,
        "NOT_KHAS_OR_ACQUIRED": FAIL if active & {"KHAS", "ACQUISITION"} else PASS,
        "AREA_WITHIN_SELLER_HOLDING": area,
        "DOCUMENT_HUMAN_APPROVED": PASS if actor.role in {r.value for r in REVIEW_UP} else FAIL,
    }


def _set_status(
    db: Session, m: MutationRecord, to: str, actor: User | None, reason: str | None,
    ip: str | None,
) -> None:
    old = m.status
    now = datetime.now(UTC)
    m.status, m.status_changed_at = to, now
    if to in (S.APPROVED.value, S.REJECTED.value):
        m.decided_at = now
    db.flush()
    ledger.append(db, "mutation", m.id)  # F4c
    audit.log(
        db, actor, "MUTATION_TRANSITION", "mutation", m.id,
        old={"status": old}, new={"status": to, "reason": reason, "mutation_no": m.mutation_no},
        ip=ip,
    )  # fmt: skip


def create_from_posting(
    db: Session, user: User, land: LandParcel, deed: Deed, tx: Transaction, ip: str | None
) -> MutationRecord:
    """APPLIED (source WORKFLOW) for the buyer. Call before risk analysis so the open
    application is visible to it; call route_after_prechecks() once posting is done."""
    now = datetime.now(UTC)
    m = MutationRecord(
        mutation_no=_next_no(db, now.year), land_id=land.id, deed_id=deed.id,
        transaction_id=tx.id, applicant_owner_id=tx.buyer_id,
        previous_khatian_no=land.khatian_no,
        new_khatian_no=f"{land.khatian_no}-M" if land.khatian_no else None,
        area=tx.area, area_unit=tx.area_unit, status=S.APPLIED.value, applied_at=now,
        status_changed_at=now, source=MutationSource.WORKFLOW.value,
    )  # fmt: skip
    db.add(m)
    db.flush()
    audit.log(
        db, user, "MUTATION_APPLIED", "mutation", m.id, old=None,
        new={"mutation_no": m.mutation_no, "transaction_id": tx.id, "status": m.status}, ip=ip,
    )  # fmt: skip
    return m


def route_after_prechecks(db: Session, m: MutationRecord, user: User, ip: str | None) -> None:
    """Pre-checks decide UNDER_REVIEW (fast track) or HEARING (failed checks listed)."""
    m.checklist = run_prechecks(db, m, user)
    failed = [c for c in CHECKS if m.checklist[c] == FAIL]
    m.fast_track = not failed
    if failed:
        _set_status(db, m, S.HEARING.value, user, "failed checks: " + ", ".join(failed), ip)
    else:
        _set_status(db, m, S.UNDER_REVIEW.value, user, "fast track", ip)


def transition(
    db: Session, mutation_id: str, to: str, actor: User, reason: str | None, ip: str | None
) -> MutationRecord:
    m = db.get(MutationRecord, mutation_id)
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    reason = " ".join(reason.split()) if reason else None
    if to not in TRANSITIONS.get(m.status, ()):
        raise AppError(
            "MUTATION_TRANSITION_INVALID", f"Cannot move from {m.status} to {to}", 409,
            {"from": m.status, "to": to, "allowed": [s.value for s in TRANSITIONS[m.status]]},
        )  # fmt: skip
    if to in REASON_REQUIRED and not reason:
        raise AppError("REASON_REQUIRED", "A reason is required for this decision", 422)
    _set_status(db, m, to, actor, reason, ip)
    if to == S.APPROVED.value:  # an approved mutation changes the risk picture
        analyze_land(db, db.get(LandParcel, m.land_id).land_id, commit=False)
    db.commit()
    return m


def _item(db: Session, m: MutationRecord) -> MutationQueueItem:
    land = db.get(LandParcel, m.land_id)
    return MutationQueueItem(
        id=m.id, mutation_no=m.mutation_no, land_id=land.land_id, status=m.status,
        fast_track=m.fast_track, applicant=m.applicant.name, area=m.area,
        area_unit=m.area_unit, applied_at=m.applied_at, status_changed_at=m.status_changed_at,
        decided_at=m.decided_at, source=m.source,
    )  # fmt: skip


def list_mutations(
    db: Session, status: str | None, limit: int, offset: int, scope=None, area=None
) -> MutationList:
    q = select(MutationRecord)
    if scope is not None or area is not None:
        q = q.join(LandParcel, LandParcel.id == MutationRecord.land_id)
    if scope is not None:  # an office officer sees their office and the offices beneath it
        q = q.where(scope)
    if area is not None:  # 'sort the databases': one office / upazila / zila / division
        q = q.where(area)
    if status:
        q = q.where(MutationRecord.status == status)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(
        q.order_by(MutationRecord.applied_at.desc(), MutationRecord.id).limit(limit).offset(offset)
    ).all()
    return MutationList(total=total, items=[_item(db, m) for m in rows])


def get_mutation(db: Session, mutation_id: str, scope=None) -> MutationDetail:
    m = db.get(MutationRecord, mutation_id)
    if m is not None and scope is not None:
        in_area = db.scalar(select(LandParcel.id).where(LandParcel.id == m.land_id, scope))
        m = m if in_area else None  # outside the officer's offices looks like "not found"
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    base = _item(db, m).model_dump()
    return MutationDetail(
        **base, previous_khatian_no=m.previous_khatian_no, new_khatian_no=m.new_khatian_no,
        ac_land_office=m.ac_land_office, checklist=m.checklist,
        deed_no=m.deed.deed_no if m.deed else None, transaction_id=m.transaction_id,
        allowed_transitions=[s.value for s in TRANSITIONS.get(m.status, ())],
    )  # fmt: skip


