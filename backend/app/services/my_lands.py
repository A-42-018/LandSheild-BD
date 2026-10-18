"""Citizen "My Lands": link the citizen's own NID, then list the land recorded under it.

The NID is linked only when it and the date of birth match a land record an office entered, so
typing someone else's number shows nothing. Every read uses the NID linked to the signed-in
account; no route takes an NID to look up, so nobody can query another person's holdings.
"""

import hmac
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.nid import NidError, nid_key
from app.core.ratelimit import check_rate
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.enums import OwnershipKind
from app.models.ownership import OwnershipHistory
from app.models.user import User
from app.risk.config import AREA_TO_SQM
from app.schemas.me import MyLand, MyLands, NidRegister, NidStatus
from app.services import audit

TRIES_PER_ACCOUNT = 5  # per 15 minutes
TRIES_PER_NID = 10  # per hour, across all accounts (slows date-of-birth guessing)
NOT_MATCHED = "No land record matches this NID and date of birth"


def nid_status(user: User) -> NidStatus:
    return NidStatus(
        registered=user.nid_hash is not None,
        last4=user.nid_last4,
        verified_at=user.nid_verified_at,
    )


def _fail(db: Session, user: User, reason: str, ip: str | None) -> None:
    audit.log(db, user, "NID_LINK_FAILED", "user", user.id, new={"reason": reason}, ip=ip)
    db.commit()


def register_nid(db: Session, user: User, body: NidRegister, ip: str | None) -> NidStatus:
    check_rate("nid-link", user.id, TRIES_PER_ACCOUNT, window=900.0)
    if user.nid_hash is not None:
        raise AppError("NID_ALREADY_REGISTERED", "An NID is already linked to this account", 409)
    try:
        key = nid_key(body.nid, body.date_of_birth)
    except NidError as exc:
        raise AppError(exc.code, "Check the NID number and date of birth", 422) from None
    check_rate("nid-link-nid", key.nid_hash, TRIES_PER_NID, window=3600.0)
    owner = db.scalar(select(Owner).where(Owner.nid_hash == key.nid_hash))
    # one answer for "no such NID" and "wrong date of birth": a guess learns nothing either way
    if (
        owner is None
        or owner.dob_hash is None
        or not hmac.compare_digest(owner.dob_hash, key.dob_hash)
    ):
        _fail(db, user, "NOT_MATCHED", ip)
        raise AppError("NID_NOT_MATCHED", NOT_MATCHED, 422)
    if db.scalar(select(User.id).where(User.nid_hash == key.nid_hash)) is not None:
        _fail(db, user, "IN_USE", ip)
        raise AppError("NID_IN_USE", "This NID is already linked to another account", 409)
    user.nid_hash, user.nid_last4 = key.nid_hash, key.last4
    user.nid_verified_at = datetime.now(UTC)
    audit.log(db, user, "NID_LINK", "user", user.id, ip=ip)
    try:
        db.commit()
    except IntegrityError:  # another account linked the same NID a moment earlier
        db.rollback()
        raise AppError("NID_IN_USE", "This NID is already linked to another account", 409) from None
    return nid_status(user)


def unregister_nid(db: Session, user: User, ip: str | None) -> None:
    if user.nid_hash is None:
        raise AppError("NID_NOT_REGISTERED", "No NID is linked to this account", 404)
    user.nid_hash = user.nid_last4 = user.nid_verified_at = None
    audit.log(db, user, "NID_UNLINK", "user", user.id, ip=ip)
    db.commit()


def _to_decimal(area: float, unit: str) -> float | None:
    factor = AREA_TO_SQM.get((unit or "").lower())
    return area * factor / AREA_TO_SQM["decimal"] if factor else None


def my_lands(db: Session, user: User, ip: str | None) -> MyLands:
    status = nid_status(user)
    if user.nid_hash is None:
        return MyLands(nid=status, current=[], past=[], total_current=0, total_area_decimal=0.0)
    rows = db.execute(
        select(OwnershipHistory, LandParcel)
        .join(LandParcel, LandParcel.id == OwnershipHistory.land_id)
        .join(Owner, Owner.id == OwnershipHistory.owner_id)
        .where(
            Owner.nid_hash == user.nid_hash,
            OwnershipHistory.kind == OwnershipKind.CURRENT.value,
        )
        .order_by(OwnershipHistory.start_date.desc(), LandParcel.land_id)
    ).all()
    current: dict[str, MyLand] = {}
    past: list[MyLand] = []
    for period, land in rows:
        item = MyLand(
            land_id=land.land_id, district=land.district, upazila=land.upazila,
            mouza=land.mouza, khatian_no=land.khatian_no, dag_no=land.dag_no,
            status=land.status, area=land.area, area_unit=land.area_unit,
            since=period.start_date, until=period.end_date,
        )  # fmt: skip
        if period.end_date is None:
            current.setdefault(land.land_id, item)
        else:
            past.append(item)
    held = list(current.values())
    areas = [_to_decimal(x.area, x.area_unit) for x in held]
    total = None if any(a is None for a in areas) else round(sum(a for a in areas if a), 2)
    audit.log(db, user, "MY_LANDS_VIEW", "user", user.id, new={"current": len(held)}, ip=ip)
    db.commit()
    return MyLands(
        nid=status, current=held, past=past, total_current=len(held), total_area_decimal=total
    )
