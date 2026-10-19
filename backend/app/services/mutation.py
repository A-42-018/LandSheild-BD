"""e-Mutation workflow (F2a): auto-create from posting, pre-checks, state machine.

Everything flushes only; the caller owns the transaction (posting: review.approve_document;
transition: the endpoint commits). Pre-check results: PASS | FAIL | NOT_CHECKED (F3a fills the
two encumbrance checks (done in F3a)). NOT_CHECKED never blocks the fast track.
"""
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.rbac import REVIEW_UP
from app.models.alert import FraudAlert
from app.models.deed import Deed
from app.models.encumbrance import LandEncumbrance
from app.models.enums import AlertStatus, MutationSource, MutationStatus, OwnershipKind, Role
from app.models.land_office import LandOffice
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.user import User
from app.risk.config import AREA_TO_SQM
from app.schemas.document import OfficeBrief
from app.schemas.mutation import (
    HearingCalendar,
    MutationDetail,
    MutationList,
    MutationQueueItem,
)
from app.services import audit, ledger
from app.services.risk import analyze_land

S = MutationStatus
DHAKA = timezone(timedelta(hours=6))  # Bangladesh has no daylight saving
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
    S.APPEALED: (S.APPROVED, S.REJECTED),  # decided by the office above the holder
    S.APPROVED: (),
    S.REJECTED: (),
}
REASON_REQUIRED = (S.REJECTED.value, S.HEARING.value)
OPEN = (S.APPLIED.value, S.UNDER_REVIEW.value, S.HEARING.value)
DECISIONS = (S.APPROVED.value, S.REJECTED.value)
# Who decides: the union (tahsil) office prepares a case and recommends; the upozila (AC Land) and
# zila (ADC Revenue) offices decide. An appeal against a rejection goes to the office above.
RANK = {
    "Union Land Office": 1,
    "Circle Land Office (Metropolitan)": 2,
    "Upazila Land Office": 2,
    "District Land Office": 3,
}


def _holder(db: Session, m: MutationRecord) -> LandOffice | None:
    land = db.get(LandParcel, m.land_id)
    return db.get(LandOffice, land.office_id) if land and land.office_id else None


def can_decide(actor: User, m_office: LandOffice | None) -> bool:
    """Approve / reject a case. Admins and office-less officers (legacy / demo) are unrestricted."""
    own = actor.office if actor.role == Role.OFFICER.value else None
    if actor.role == Role.ADMIN.value or own is None:
        return actor.role in (Role.ADMIN.value, Role.OFFICER.value)
    return RANK.get(own.office_type, 0) >= 2


def can_decide_appeal(actor: User, m_office: LandOffice | None) -> bool:
    """Decide an appeal: only an office strictly above the one holding the land."""
    own = actor.office if actor.role == Role.OFFICER.value else None
    if actor.role == Role.ADMIN.value or own is None:
        return actor.role in (Role.ADMIN.value, Role.OFFICER.value)
    if m_office is None or own.id == m_office.id:
        return False
    return RANK.get(own.office_type, 0) > RANK.get(m_office.office_type, 0)


def _four_eyes(actor: User, other_id: str | None) -> bool:
    """True when this actor may not take the decision because they made the previous step."""
    return other_id is not None and other_id == actor.id and actor.role != Role.ADMIN.value

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
                OwnershipHistory.kind == OwnershipKind.CURRENT.value,
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


def _check_hearing_at(when: datetime) -> datetime:
    """A hearing is set for a moment that has not passed; naive input is read as Dhaka time."""
    when = when.replace(tzinfo=DHAKA) if when.tzinfo is None else when
    if when < datetime.now(UTC):
        raise AppError("HEARING_DATE_PAST", "The hearing date cannot be in the past", 422)
    return when.astimezone(UTC)  # store UTC whatever the offset (SQLite drops the zone)


def _utc(when: datetime | None) -> datetime | None:
    """Read back as UTC (SQLite returns naive values)."""
    return when.replace(tzinfo=UTC) if when is not None and when.tzinfo is None else when


def transition(
    db: Session, mutation_id: str, to: str, actor: User, reason: str | None, ip: str | None,
    hearing_at: datetime | None = None,
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
    holder = _holder(db, m)
    if m.status == S.APPEALED.value:
        if not can_decide_appeal(actor, holder):
            raise AppError(
                "APPEAL_DECISION_FORBIDDEN", "Only the office above decides this appeal", 403
            )
        if _four_eyes(actor, m.decided_by):  # not the one who rejected it in the first place
            raise AppError("SELF_DECISION_FORBIDDEN", "You cannot decide your own rejection", 403)
    elif to in DECISIONS:
        if not can_decide(actor, holder):
            raise AppError(
                "DECISION_FORBIDDEN", "Only the upozila or zila office approves or rejects", 403
            )
        if _four_eyes(actor, m.recommended_by):  # the recommender cannot also be the decider
            raise AppError(
                "SELF_DECISION_FORBIDDEN", "You cannot decide a case you recommended", 403
            )
    if to in REASON_REQUIRED and not reason:
        raise AppError("REASON_REQUIRED", "A reason is required for this decision", 422)
    if hearing_at is not None and to != S.HEARING.value:
        raise AppError("HEARING_DATE_UNEXPECTED", "A hearing date goes with HEARING only", 422)
    if hearing_at is not None:
        hearing_at = _check_hearing_at(hearing_at)
    _set_status(db, m, to, actor, reason, ip)
    if to == S.HEARING.value:  # a fresh hearing: any earlier date no longer applies
        m.hearing_at = hearing_at
    if to in DECISIONS:
        m.decided_by = actor.id
    if to == S.APPROVED.value:  # an approved mutation changes the risk picture
        analyze_land(db, db.get(LandParcel, m.land_id).land_id, commit=False)
    db.commit()
    return m


def schedule_hearing(
    db: Session, mutation_id: str, actor: User, hearing_at: datetime, ip: str | None
) -> MutationRecord:
    """Set or move the hearing date of a case that is in HEARING. Recorded and audited."""
    m = db.get(MutationRecord, mutation_id)
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    if m.status != S.HEARING.value:
        raise AppError("MUTATION_NOT_IN_HEARING", "Only a case in hearing can be scheduled", 409,
                       {"status": m.status})  # fmt: skip
    when = _check_hearing_at(hearing_at)
    old = {"hearing_at": m.hearing_at.isoformat() if m.hearing_at else None}
    m.hearing_at = when
    audit.log(
        db, actor, "MUTATION_HEARING_SET", "mutation", m.id, old=old,
        new={"hearing_at": when.isoformat(), "mutation_no": m.mutation_no}, ip=ip,
    )  # fmt: skip
    db.commit()
    return m


def hearing_calendar(
    db: Session, month: str, scope=None, area=None, limit: int = 500
) -> HearingCalendar:
    """Cases with a hearing in `month` (YYYY-MM, Dhaka time), by date; plus unscheduled ones."""
    year, mon = int(month[:4]), int(month[5:7])
    start = datetime(year, mon, 1, tzinfo=DHAKA).astimezone(UTC)
    end = datetime(year + (mon == 12), mon % 12 + 1, 1, tzinfo=DHAKA).astimezone(UTC)

    def rows(*where):
        q = select(MutationRecord).join(LandParcel, LandParcel.id == MutationRecord.land_id)
        for extra in (scope, area):
            if extra is not None:
                q = q.where(extra)
        return db.scalars(q.where(*where).limit(limit)).all()

    dated = rows(MutationRecord.hearing_at >= start, MutationRecord.hearing_at < end)
    dated.sort(key=lambda m: (_utc(m.hearing_at), m.id))
    open_undated = rows(
        MutationRecord.status == S.HEARING.value, MutationRecord.hearing_at.is_(None)
    )
    open_undated.sort(key=lambda m: (m.applied_at, m.id))
    return HearingCalendar(
        month=month, items=[_item(db, m) for m in dated],
        unscheduled=[_item(db, m) for m in open_undated],
    )


def recommend(
    db: Session, mutation_id: str, actor: User, decision: str, note: str, ip: str | None
) -> MutationRecord:
    """Field-level recommendation (advisory): recorded and audited, status unchanged."""
    m = db.get(MutationRecord, mutation_id)
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    if m.status not in OPEN:
        raise AppError("MUTATION_NOT_OPEN", "Only an open case can be recommended", 409,
                       {"status": m.status})  # fmt: skip
    old = {"recommendation": m.recommendation}
    m.recommendation, m.recommendation_note = decision, " ".join(note.split())
    m.recommended_by, m.recommended_at = actor.id, datetime.now(UTC)
    audit.log(
        db, actor, "MUTATION_RECOMMEND", "mutation", m.id, old=old,
        new={"recommendation": decision, "mutation_no": m.mutation_no}, ip=ip,
    )  # fmt: skip
    db.commit()
    return m


def appeal(
    db: Session, mutation_id: str, actor: User, reason: str, ip: str | None
) -> MutationRecord:
    """A rejection can be appealed once; the office above the holder then decides."""
    m = db.get(MutationRecord, mutation_id)
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    if m.status != S.REJECTED.value or m.appealed_at is not None:
        raise AppError(
            "APPEAL_NOT_ALLOWED", "Only a rejected case that was not appealed before can be", 409,
            {"status": m.status},
        )  # fmt: skip
    m.appeal_reason, m.appealed_by = " ".join(reason.split()), actor.id
    m.appealed_at = datetime.now(UTC)
    _set_status(db, m, S.APPEALED.value, actor, m.appeal_reason, ip)
    db.commit()
    return m


def _allowed(db: Session, m: MutationRecord, actor: User | None) -> list[str]:
    if actor is None or actor.role not in (Role.OFFICER.value, Role.ADMIN.value):
        return []  # reviewers and citizens read cases; they do not move them
    holder = _holder(db, m)
    out = []
    for to in TRANSITIONS.get(m.status, ()):
        if m.status == S.APPEALED.value:
            ok = can_decide_appeal(actor, holder) and not _four_eyes(actor, m.decided_by)
        elif to in DECISIONS:
            ok = can_decide(actor, holder) and not _four_eyes(actor, m.recommended_by)
        else:
            ok = True
        if ok:
            out.append(to.value if hasattr(to, "value") else to)
    return out


def _item(db: Session, m: MutationRecord) -> MutationQueueItem:
    land = db.get(LandParcel, m.land_id)
    return MutationQueueItem(
        id=m.id, mutation_no=m.mutation_no, land_id=land.land_id, status=m.status,
        fast_track=m.fast_track, applicant=m.applicant.name, area=m.area,
        area_unit=m.area_unit, applied_at=m.applied_at, status_changed_at=m.status_changed_at,
        decided_at=m.decided_at, source=m.source, hearing_at=_utc(m.hearing_at),
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


def get_mutation(
    db: Session, mutation_id: str, scope=None, actor: User | None = None
) -> MutationDetail:
    m = db.get(MutationRecord, mutation_id)
    if m is not None and scope is not None:
        in_area = db.scalar(select(LandParcel.id).where(LandParcel.id == m.land_id, scope))
        m = m if in_area else None  # outside the officer's offices looks like "not found"
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation not found", 404)
    base = _item(db, m).model_dump()
    land = db.get(LandParcel, m.land_id)
    return MutationDetail(
        **base, survey_type=land.survey_type, jl_no=land.jl_no, previous_khatian_no=m.previous_khatian_no, new_khatian_no=m.new_khatian_no,
        ac_land_office=m.ac_land_office, checklist=m.checklist,
        deed_no=m.deed.deed_no if m.deed else None, transaction_id=m.transaction_id,
        allowed_transitions=_allowed(db, m, actor),
        holder_office=OfficeBrief.model_validate(holder) if (holder := _holder(db, m)) else None,
        recommendation=m.recommendation, recommendation_note=m.recommendation_note,
        recommended_by_name=(rb.name if (rb := db.get(User, m.recommended_by)) else None)
        if m.recommended_by else None,
        recommended_at=m.recommended_at,
        appeal_reason=m.appeal_reason, appealed_at=m.appealed_at,
        can_recommend=bool(
            actor and actor.role in (Role.OFFICER.value, Role.ADMIN.value) and m.status in OPEN
        ),
        can_appeal=bool(
            actor and actor.role in (Role.OFFICER.value, Role.ADMIN.value)
            and m.status == S.REJECTED.value and m.appealed_at is None
        ),
    )  # fmt: skip


