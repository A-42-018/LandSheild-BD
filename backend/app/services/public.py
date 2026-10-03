"""Public (no-login) QR page payload. Read-only: never writes, never exposes names."""

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.alert import FraudAlert
from app.models.enums import AlertStatus, TransactionStatus, VerificationStatus
from app.models.land_parcel import LandParcel
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.models.verification import VerificationRequest
from app.risk.assess import assess
from app.risk.context import load_land_context
from app.schemas.public import PublicCounts, PublicVerify

_LAND_ID = re.compile(r"^LP-\d{5}$")
_ACTIVE_ALERTS = (
    AlertStatus.OPEN.value,
    AlertStatus.UNDER_REVIEW.value,
    AlertStatus.ESCALATED.value,
)


def _count(db: Session, col, *where) -> int:
    return db.scalar(select(func.count(col)).where(*where)) or 0


def get_public_verify(db: Session, land_id: str) -> PublicVerify:
    code = land_id.strip().upper()
    land = None
    if _LAND_ID.match(code):
        land = db.scalar(select(LandParcel).where(LandParcel.land_id == code))
    if land is None:
        raise AppError("LAND_NOT_FOUND", "Land parcel not found", 404)
    level = assess(load_land_context(db, land)).level
    last = db.scalar(
        select(func.max(VerificationRequest.completed_at)).where(
            VerificationRequest.land_id == land.id,
            VerificationRequest.status == VerificationStatus.COMPLETED.value,
        )
    )
    counts = PublicCounts(
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
    )
    return PublicVerify(
        land_id=land.land_id,
        district=land.district,
        upazila=land.upazila,
        mouza=land.mouza,
        status=land.status,
        risk_level=level,
        counts=counts,
        last_verified_at=last,
    )
