from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.services import gis
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


def _to_public(
    db: Session, land: LandParcel, viewer: User, warnings: list[str] | None = None
) -> LandPublic:
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
        survey_type=land.survey_type,
        jl_no=land.jl_no,
        map_sheet_no=land.map_sheet_no,
        warnings=warnings or [],
        current_owners=owners,
    )


def get_land(db: Session, land_id: str, viewer: User) -> LandPublic:
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == _norm(land_id)))
    if land is None:
        raise _not_found()
    return _to_public(db, land, viewer)


def _resolve_registry(district: str, upazila: str, mouza: str, jl_no: str | None):
    """Registry entry for the mouza (None when the registry does not cover it). A JL that does
    not belong to the mouza raises JL_MISMATCH (422); a name shared by several mouzas is left to
    the parcel query to judge."""
    try:
        return gis.resolve_mouza(district, upazila, mouza, jl_no)
    except AppError as exc:
        if exc.code in ("MOUZA_NOT_FOUND", "MOUZA_AMBIGUOUS"):
            return None
        raise


def find_by_location(
    db: Session,
    *,
    district: str,
    upazila: str,
    mouza: str,
    khatian: str,
    dag: str,
    survey_type: str | None = None,
    jl_no: str | None = None,
) -> LandParcel:
    """Exact parcel lookup: case-insensitive place names, Bangla digits accepted.

    404 none, 409 LAND_AMBIGUOUS when several parcels match (never picks the first one; the
    candidates carry no owner data), 422 JL_MISMATCH. Old rows without survey/JL still match.
    """
    d, u, m, k, g = (_norm(v) for v in (district, upazila, mouza, khatian, dag))
    jl = gis.norm_jl(_norm(jl_no)) if jl_no else ""
    if jl:
        _resolve_registry(d, u, m, jl)
    stmt = select(LandParcel).where(
        func.lower(LandParcel.district) == d.lower(),
        func.lower(LandParcel.upazila) == u.lower(),
        func.lower(LandParcel.mouza) == m.lower(),
        LandParcel.khatian_no == k,
        LandParcel.dag_no == g,
    )
    if survey_type:
        st = survey_type.strip().upper()
        stmt = stmt.where(or_(LandParcel.survey_type == st, LandParcel.survey_type.is_(None)))
    if jl:
        stmt = stmt.where(or_(LandParcel.jl_no == jl, LandParcel.jl_no.is_(None)))
    rows = list(db.scalars(stmt.order_by(LandParcel.land_id)))
    if not rows:
        raise _not_found()
    if len(rows) > 1:
        raise AppError(
            "LAND_AMBIGUOUS",
            "More than one parcel matches; give the survey and JL number",
            409,
            details={
                "candidates": [
                    {
                        "land_id": r.land_id,
                        "survey_type": r.survey_type,
                        "jl_no": r.jl_no,
                        "mouza": r.mouza,
                    }
                    for r in rows
                ]
            },
        )
    return rows[0]


def sheet_warnings(land: LandParcel, sheet_no: str | None) -> list[str]:
    """SHEET_MISMATCH when the given sheet differs from the parcel's, or is not a sheet of that
    mouza for the parcel's survey (D6: a warning only, never a 404)."""
    given = _norm(sheet_no).lstrip("0") if sheet_no else ""
    if not given:
        return []
    own = (land.map_sheet_no or "").strip().lstrip("0")
    if own and own != given:
        return ["SHEET_MISMATCH"]
    reg = _resolve_registry(land.district, land.upazila, land.mouza, land.jl_no)
    if reg is not None:
        known = {s.sheet_no.strip().lstrip("0") for s in gis.sheets_for(reg.id, land.survey_type)}
        if known and given not in known:
            return ["SHEET_MISMATCH"]
    return []


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
    survey_type: str | None = None,
    jl_no: str | None = None,
    sheet_no: str | None = None,
) -> LandPublic:
    land = find_by_location(
        db,
        district=district,
        upazila=upazila,
        mouza=mouza,
        khatian=khatian,
        dag=dag,
        survey_type=survey_type,
        jl_no=jl_no,
    )
    return _to_public(db, land, viewer, sheet_warnings(land, sheet_no))
