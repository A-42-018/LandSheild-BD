from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.enums import OwnershipKind, Role
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.user import User
from app.schemas.land import LandOwnerPublic, LandPublic

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_SEES_FATHER = {Role.REVIEWER.value, Role.OFFICER.value, Role.ADMIN.value}


def _norm(value: str) -> str:
    return " ".join(value.translate(_BN_DIGITS).split())


def _not_found() -> AppError:
    return AppError("LAND_NOT_FOUND", "Land parcel not found", 404)


def _to_public(db: Session, land: LandParcel, viewer: User) -> LandPublic:
    rows = current_owners(db, land)
    show_father = viewer.role in _SEES_FATHER
    owners = [
        LandOwnerPublic(name=o.name, father_name=o.father_name if show_father else None)
        for o in rows
    ]
    return LandPublic(
        land_id=land.land_id,
        district=land.district,
        upazila=land.upazila,
        mouza=land.mouza,
        khatian_no=land.khatian_no,
        dag_no=land.dag_no,
        area=land.area,
        area_unit=land.area_unit,
        status=land.status,
        current_owners=owners,
    )


def get_land(db: Session, land_id: str, viewer: User) -> LandPublic:
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == _norm(land_id)))
    if land is None:
        raise _not_found()
    return _to_public(db, land, viewer)


def find_by_location(
    db: Session, *, district: str, upazila: str, mouza: str, khatian: str, dag: str
) -> LandParcel:
    """Exact parcel lookup: case-insensitive place names, Bangla digits accepted (404 if none)."""
    d, u, m, k, g = (_norm(v) for v in (district, upazila, mouza, khatian, dag))
    land = db.scalar(
        select(LandParcel).where(
            func.lower(LandParcel.district) == d.lower(),
            func.lower(LandParcel.upazila) == u.lower(),
            func.lower(LandParcel.mouza) == m.lower(),
            LandParcel.khatian_no == k,
            LandParcel.dag_no == g,
        )
    )
    if land is None:
        raise _not_found()
    return land


def current_owners(db: Session, land: LandParcel) -> list[Owner]:
    return list(
        db.execute(
            select(Owner)
            .join(OwnershipHistory, OwnershipHistory.owner_id == Owner.id)
            .where(OwnershipHistory.land_id == land.id,
                OwnershipHistory.end_date.is_(None),
                OwnershipHistory.kind == OwnershipKind.CURRENT.value,
            )
            .order_by(OwnershipHistory.start_date, Owner.name)
        ).scalars()
    )


def search_land(
    db: Session,
    *,
    district: str,
    upazila: str,
    mouza: str,
    khatian: str,
    dag: str,
    viewer: User,
) -> LandPublic:
    land = find_by_location(
        db, district=district, upazila=upazila, mouza=mouza, khatian=khatian, dag=dag
    )
    return _to_public(db, land, viewer)
