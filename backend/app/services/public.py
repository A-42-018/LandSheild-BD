"""Public (no-login) QR page payload. Read-only: never writes, never exposes names."""

import re
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.alert import FraudAlert
from app.models.audit import AuditLog
from app.models.encumbrance import LandEncumbrance
from app.models.enums import (
    AlertStatus,
    EncumbranceType,
    TransactionStatus,
    VerificationStatus,
)
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.verification import VerificationRequest
from app.risk.assess import assess
from app.risk.context import load_land_context
from app.schemas.public import (
    PublicCounts,
    PublicLandSummary,
    PublicMutationStatus,
    PublicMutationStep,
    PublicVerify,
)
from app.services import land as land_svc
from app.services.names import mask_name

_LAND_ID = re.compile(r"^LP-\d{5}$")
_MUTATION_NO = re.compile(r"^MUT-\d{4}-\d{4}$")
_ACTIVE_ALERTS = (
    AlertStatus.OPEN.value,
    AlertStatus.UNDER_REVIEW.value,
    AlertStatus.ESCALATED.value,
)


def _count(db: Session, col, *where) -> int:
    return db.scalar(select(func.count(col)).where(*where)) or 0


def find_land(db: Session, land_id: str) -> LandParcel:
    code = land_id.strip().upper()
    land = None
    if _LAND_ID.match(code):
        land = db.scalar(select(LandParcel).where(LandParcel.land_id == code))
    if land is None:
        raise AppError("LAND_NOT_FOUND", "Land parcel not found", 404)
    return land


def _counts(db: Session, land: LandParcel) -> PublicCounts:
    return PublicCounts(
        ownership_records=_count(db, OwnershipHistory.id, OwnershipHistory.land_id == land.id),
        transactions=_count(db, Transaction.id, Transaction.land_id == land.id),
        flagged_transactions=_count(
            db,
            Transaction.id,
            Transaction.land_id == land.id,
            Transaction.status == TransactionStatus.FLAGGED.value,
        ),
        open_alerts=_count(
            db, FraudAlert.id, FraudAlert.land_id == land.id, FraudAlert.status.in_(_ACTIVE_ALERTS)
        ),
        active_encumbrances=_count(
            db,
            LandEncumbrance.id,
            LandEncumbrance.land_id == land.id,
            LandEncumbrance.status == "ACTIVE",
        ),
        pending_mutations=_count(
            db,
            MutationRecord.id,
            MutationRecord.land_id == land.id,
            MutationRecord.status.in_(("APPLIED", "UNDER_REVIEW", "HEARING", "APPEALED")),
        ),
    )


def get_public_verify(db: Session, land_id: str) -> PublicVerify:
    land = find_land(db, land_id)
    level = assess(load_land_context(db, land)).level
    last = db.scalar(
        select(func.max(VerificationRequest.completed_at)).where(
            VerificationRequest.land_id == land.id,
            VerificationRequest.status == VerificationStatus.COMPLETED.value,
        )
    )
    return PublicVerify(
        land_id=land.land_id,
        district=land.district,
        upazila=land.upazila,
        mouza=land.mouza,
        status=land.status,
        risk_level=level,
        counts=_counts(db, land),
        last_verified_at=last,
    )


def search_land_summary(
    db: Session, *, district: str, upazila: str, mouza: str, khatian: str, dag: str
) -> tuple[LandParcel, PublicLandSummary]:
    """Same lookup as the signed-in search, answered with a masked summary (read-only)."""
    land = land_svc.find_by_location(
        db, district=district, upazila=upazila, mouza=mouza, khatian=khatian, dag=dag
    )
    owners = land_svc.current_owners(db, land)
    open_case = _count(
        db,
        LandEncumbrance.id,
        LandEncumbrance.land_id == land.id,
        LandEncumbrance.type == EncumbranceType.COURT_CASE.value,
        LandEncumbrance.status == "ACTIVE",
    )
    return land, PublicLandSummary(
        land_id=land.land_id,
        district=land.district,
        upazila=land.upazila,
        mouza=land.mouza,
        khatian_no=land.khatian_no,
        dag_no=land.dag_no,
        area=land.area,
        area_unit=land.area_unit,
        status=land.status,
        risk_level=assess(load_land_context(db, land)).level,
        owner_count=len(owners),
        owners_masked=[mask_name(o.name) for o in owners],
        open_case=open_case > 0,
        counts=_counts(db, land),
    )


_RANK = {
    "APPLIED": 0, "UNDER_REVIEW": 1, "HEARING": 2, "APPEALED": 2, "APPROVED": 3, "REJECTED": 3,
}


def get_mutation_status(db: Session, mutation_no: str) -> PublicMutationStatus:
    """Read-only tracker payload. Step dates come from the MUTATION_TRANSITION audit rows;
    seeded records have none, so only the applied/decided dates are known for them."""
    no = mutation_no.strip().upper()
    m = None
    if _MUTATION_NO.match(no):
        m = db.scalar(select(MutationRecord).where(MutationRecord.mutation_no == no))
    if m is None:
        raise AppError("MUTATION_NOT_FOUND", "Mutation application not found", 404)
    seen: dict[str, datetime] = {}
    rows = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.entity_type == "mutation",
            AuditLog.entity_id == m.id,
            AuditLog.action == "MUTATION_TRANSITION",
        )
        .order_by(AuditLog.created_at)
    )
    for row in rows:
        to = (row.new_value or {}).get("status")
        if to and to not in seen:
            seen[to] = row.created_at
    rank = _RANK.get(m.status, 0)
    decided = rank == 3
    at = {0: m.applied_at, 1: seen.get("UNDER_REVIEW"), 2: seen.get("HEARING"), 3: m.decided_at}
    steps = []
    for i, name in enumerate(("APPLIED", "REVIEW", "HEARING", "DECIDED")):
        if i == 3:
            state = "done" if decided else "pending"
        elif i < rank:
            # a hearing that never happened (fast track / seeded) is shown as skipped
            state = "skipped" if i == 2 and at[2] is None else "done"
        elif i == rank and not decided:
            state = "current"
        else:
            state = "pending"
        shown = at[i] if state != "pending" else None
        steps.append(PublicMutationStep(step=name, state=state, at=shown))
    applied = m.applied_at if m.applied_at.tzinfo else m.applied_at.replace(tzinfo=UTC)
    days = None if decided else max(0, (datetime.now(UTC) - applied).days)
    return PublicMutationStatus(
        mutation_no=m.mutation_no, status=m.status, fast_track=m.fast_track,
        office=m.ac_land_office, applied_at=m.applied_at, days_pending=days, steps=steps,
    )  # fmt: skip
