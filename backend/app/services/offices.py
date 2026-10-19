"""Land-office lookup (Division > Zila > Upozila > Union) and officer account requests.

An officer picks the office they work in, which creates an *inactive* account plus a PENDING
request; only an admin approval activates it and ties it to that office. Nothing the client
sends can set a role, an active flag or an office on an existing account.
"""
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.passwords import hash_password, verify_password
from app.models.document import Document
from app.models.enums import Role
from app.models.land_office import LandOffice, OfficerRequest
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.offices import (
    AdminOffice,
    AdminOfficeList,
    AdminOfficerRequest,
    AdminOfficerRequestList,
    OfficeList,
    OfficeOut,
    OfficerRequestIn,
    Place,
)
from app.services import audit
from app.services.admin import _contains as contains

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "land_offices.json"
_NS = uuid.UUID("5a1d5e1d-0000-4000-8000-1a4d5b1e1d01")
_FIELDS = (
    "division_en division_bn district_en district_bn upazila_en upazila_bn "
    "union_en union_bn name_en name_bn location"
).split()


def ensure_offices(db: Session) -> int:
    """Load the bundled office list when the table is empty (idempotent). Returns rows added."""
    if db.scalar(select(func.count()).select_from(LandOffice)):
        return 0
    rows = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    db.add_all(
        LandOffice(
            id=str(uuid.uuid5(_NS, r["code"])),
            code=r["code"],
            office_type=r["type"],
            **{k: r.get(k) for k in _FIELDS},
        )
        for r in rows
    )
    db.commit()
    return len(rows)


def _places(db: Session, col_en, col_bn, *where) -> list[Place]:
    rows = db.execute(
        select(col_en, col_bn).where(col_en.is_not(None), *where).distinct().order_by(col_en)
    ).all()
    return [Place(en=en, bn=bn or en) for en, bn in rows]


def divisions(db: Session) -> list[Place]:
    ensure_offices(db)
    return _places(db, LandOffice.division_en, LandOffice.division_bn)


def districts(db: Session, division: str) -> list[Place]:
    ensure_offices(db)
    return _places(
        db, LandOffice.district_en, LandOffice.district_bn, LandOffice.division_en == division
    )


def upazilas(db: Session, division: str, district: str) -> list[Place]:
    ensure_offices(db)
    return _places(
        db, LandOffice.upazila_en, LandOffice.upazila_bn,
        LandOffice.division_en == division, LandOffice.district_en == district,
    )  # fmt: skip


def offices(db: Session, division: str, district: str, upazila: str | None) -> OfficeList:
    """Offices under a district (district-level ones) or under one upazila (all of its offices)."""
    ensure_offices(db)
    cond = [LandOffice.division_en == division, LandOffice.district_en == district]
    if upazila:
        cond.append(LandOffice.upazila_en == upazila)
    else:
        cond.append(LandOffice.upazila_en.is_(None))
    rows = db.scalars(
        select(LandOffice).where(*cond).order_by(LandOffice.office_type, LandOffice.name_en)
    ).all()
    return OfficeList(items=[OfficeOut.model_validate(r) for r in rows], total=len(rows))


def list_offices(
    db: Session, q: str | None, office_type: str | None, limit: int, offset: int
) -> AdminOfficeList:
    """Admin view of every land office, with the number of active officers tied to each."""
    ensure_offices(db)
    cond = []
    q = (q or "").strip()
    if q:
        cond.append(
            or_(
                *(
                    contains(c, q)
                    for c in (
                        LandOffice.name_en, LandOffice.name_bn, LandOffice.code,
                        LandOffice.district_en, LandOffice.upazila_en,
                    )
                )
            )
        )  # fmt: skip
    if office_type:
        cond.append(LandOffice.office_type == office_type)
    total = db.scalar(select(func.count()).select_from(LandOffice).where(*cond)) or 0
    rows = db.scalars(
        select(LandOffice).where(*cond)
        .order_by(LandOffice.division_en, LandOffice.district_en, LandOffice.upazila_en,
                  LandOffice.office_type, LandOffice.name_en)
        .limit(limit).offset(offset)
    ).all()  # fmt: skip
    counts = dict(
        db.execute(
            select(User.office_id, func.count())
            .where(User.role == Role.OFFICER.value, User.is_active.is_(True),
                   User.office_id.in_([r.id for r in rows]))
            .group_by(User.office_id)
        ).all()
    )  # fmt: skip
    items = [
        AdminOffice(**OfficeOut.model_validate(r).model_dump(), officers=counts.get(r.id, 0))
        for r in rows
    ]
    return AdminOfficeList(items=items, total=total, limit=limit, offset=offset)


def user_office(user: User) -> LandOffice | None:
    """The office an OFFICER account is tied to; None = unrestricted (admins, reviewers, the
    seeded demo officer)."""
    return user.office if user.role == Role.OFFICER.value else None


def visible_office_ids(user: User):
    """Subquery of the office ids an office officer may SEE: their own office plus every office
    beneath it. A district office sees the whole district, an upazila office its upazila (the
    union offices included), a union or metro-circle office only itself."""
    own = user_office(user)
    cond = [LandOffice.id == own.id]
    if own.office_type == "District Land Office":
        cond = [
            LandOffice.division_en == own.division_en,
            LandOffice.district_en == own.district_en,
        ]
    elif own.office_type == "Upazila Land Office":
        cond = [
            LandOffice.district_en == own.district_en,
            LandOffice.upazila_en == own.upazila_en,
        ]
    return select(LandOffice.id).where(*cond)


def land_scope(user: User):
    """SQL condition: land parcels held by the offices this officer can see; None = all."""
    return None if user_office(user) is None else LandParcel.office_id.in_(visible_office_ids(user))


def doc_scope(user: User):
    """SQL condition: documents held by the offices this officer can see; None = all."""
    return None if user_office(user) is None else Document.office_id.in_(visible_office_ids(user))


def area_filter(col, division: str | None, district: str | None, upazila: str | None,
                office_id: str | None):  # fmt: skip
    """Optional 'sort the databases by area' filter on an office-id column (None = no filter)."""
    if office_id:
        return col == office_id
    cond = []
    if division:
        cond.append(LandOffice.division_en == division)
    if district:
        cond.append(LandOffice.district_en == district)
    if upazila:
        cond.append(LandOffice.upazila_en == upazila)
    return col.in_(select(LandOffice.id).where(*cond)) if cond else None


def ensure_doc_access(
    db: Session, user: User, document_id: str, write: bool = False, read: bool = False
) -> None:
    """404 for a document in an office the user can't reach (looks the same as 'not found').
    Supervisors (zila / upozila officers) may read and review (edit, approve, reject, reprocess)
    documents beneath them; starting OCR (write=True) stays with the owning office. Plain reads
    (read=True: view, file, versions, history, download) are also open to the uploader of the
    document, which the library lists for them even after an office transfer (H7a); reviewing it
    there stays with the offices that hold it."""
    own = user_office(user)
    if own is None:
        return
    row = db.execute(
        select(Document.office_id, Document.uploaded_by).where(Document.id == document_id)
    ).first()
    owner, uploader = (row[0], row[1]) if row else (None, None)
    if write:
        ok = owner == own.id
    elif read and uploader is not None and uploader == user.id:
        ok = True
    else:
        ok = owner is not None and bool(
            db.scalar(select(LandOffice.id).where(LandOffice.id == owner, LandOffice.id.in_(
                visible_office_ids(user))))
        )
    if not ok:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)


def resolve_upload_office(db: Session, user: User, requested: str | None) -> LandOffice:
    """Office an upload is filed under. An office officer can only file into their own office;
    an admin or unrestricted officer must name one (422 OFFICE_REQUIRED otherwise)."""
    own = user_office(user)
    if own is not None:
        if requested and requested != own.id:
            raise AppError(
                "OFFICE_MISMATCH", "You can only upload records for your own land office", 403
            )
        return own
    if not requested:
        raise AppError("OFFICE_REQUIRED", "Choose the land office this record belongs to", 422)
    office = db.get(LandOffice, requested)
    if office is None:
        raise AppError("OFFICE_NOT_FOUND", "Land office not found", 404)
    return office


def check_record_area(office: LandOffice | None, district: str | None, upazila: str | None) -> None:
    """The record's district / upazila must lie inside the office that holds it. (Records carry
    no union field, so a union office is enforced by ownership: only that office files into it.)"""

    def same(value: str | None, en: str, bn: str) -> bool:
        return (value or "").strip().casefold() in {en.casefold(), bn.casefold()}

    if office is None:
        return
    bad = not same(district, office.district_en, office.district_bn)
    if not bad and office.upazila_en and office.office_type != "Circle Land Office (Metropolitan)":
        bad = not same(upazila, office.upazila_en, office.upazila_bn or office.upazila_en)
    if bad:
        raise AppError(
            "RECORD_OUTSIDE_AREA",
            "This record is outside your land office's area",
            409,
            {"office": office.code, "office_name_en": office.name_en,
             "office_name_bn": office.name_bn, "district": district, "upazila": upazila},
        )


# ---- officer request (public) ------------------------------------------------------------------


def create_request(db: Session, data: OfficerRequestIn) -> OfficerRequest:
    ensure_offices(db)
    office = db.get(LandOffice, data.office_id)
    if office is None:
        raise AppError("OFFICE_NOT_FOUND", "Land office not found", 404)
    user = db.scalar(select(User).where(User.email == data.email))
    if user is not None:
        # only a rejected applicant (proving the password) may apply again
        last = _last_request(db, user.id)
        if not (
            user.role == Role.OFFICER.value
            and not user.is_active
            and last is not None
            and last.status == "REJECTED"
            and verify_password(data.password, user.password_hash)
        ):
            raise AppError("EMAIL_TAKEN", "Email already registered", 409)
        user.name = data.name.strip()
        user.preferred_language = data.preferred_language
    else:
        user = User(
            name=data.name.strip(),
            email=data.email,
            password_hash=hash_password(data.password),
            role=Role.OFFICER.value,
            preferred_language=data.preferred_language,
            is_active=False,  # an admin approval activates it
        )
        db.add(user)
        db.flush()
    req = OfficerRequest(
        user_id=user.id,
        office_id=office.id,
        designation=data.designation.strip(),
        phone=data.phone,
        employee_id=data.employee_id.strip(),
        proof_note=(data.proof_note or "").strip() or None,
        status="PENDING",
    )
    db.add(req)
    db.flush()
    return req


def _last_request(db: Session, user_id: str) -> OfficerRequest | None:
    return db.scalar(
        select(OfficerRequest)
        .where(OfficerRequest.user_id == user_id)
        .order_by(OfficerRequest.created_at.desc(), OfficerRequest.id)
        .limit(1)
    )


def login_block(db: Session, user: User) -> AppError | None:
    """Error to raise when a correct password belongs to a not-yet-active officer account."""
    last = _last_request(db, user.id)
    if last is None or user.role != Role.OFFICER.value:
        return None
    if last.status == "PENDING":
        return AppError("ACCOUNT_PENDING", "Officer account is awaiting admin approval", 403)
    if last.status == "REJECTED":
        return AppError(
            "ACCOUNT_REJECTED", "Officer account request was rejected", 403,
            {"reason": last.rejection_reason},
        )  # fmt: skip
    return None


# ---- admin -------------------------------------------------------------------------------------


def _admin_item(req: OfficerRequest, user: User, office: LandOffice) -> AdminOfficerRequest:
    return AdminOfficerRequest(
        id=req.id, status=req.status, created_at=req.created_at, user_id=user.id,
        name=user.name, email=user.email, designation=req.designation, phone=req.phone,
        employee_id=req.employee_id, proof_note=req.proof_note,
        office=OfficeOut.model_validate(office), reviewed_at=req.reviewed_at,
        rejection_reason=req.rejection_reason,
    )  # fmt: skip


def list_requests(
    db: Session, status: str | None, division: str | None, district: str | None,
    q: str | None, limit: int, offset: int,
) -> AdminOfficerRequestList:  # fmt: skip
    cond = []
    if status:
        cond.append(OfficerRequest.status == status)
    if division:
        cond.append(LandOffice.division_en == division)
    if district:
        cond.append(LandOffice.district_en == district)
    q = (q or "").strip().lower()
    if q:
        esc = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{esc}%"
        cond.append(
            or_(
                func.lower(User.name).like(like, escape="\\"),
                func.lower(User.email).like(like, escape="\\"),
                func.lower(OfficerRequest.employee_id).like(like, escape="\\"),
            )
        )
    base = (
        select(OfficerRequest, User, LandOffice)
        .join(User, User.id == OfficerRequest.user_id)
        .join(LandOffice, LandOffice.id == OfficerRequest.office_id)
        .where(*cond)
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    pending = (
        db.scalar(
            select(func.count())
            .select_from(OfficerRequest)
            .where(OfficerRequest.status == "PENDING")
        )
        or 0
    )
    rows = db.execute(
        base.order_by(
            (OfficerRequest.status != "PENDING"),
            OfficerRequest.created_at.desc(),
            OfficerRequest.id,
        )
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminOfficerRequestList(
        items=[_admin_item(r, u, o) for r, u, o in rows],
        total=total, pending=pending, limit=limit, offset=offset,
    )  # fmt: skip


def _pending(db: Session, request_id: str) -> tuple[OfficerRequest, User]:
    req = db.get(OfficerRequest, request_id)
    if req is None:
        raise AppError("NOT_FOUND", "Officer request not found", 404)
    if req.status != "PENDING":
        raise AppError("ALREADY_DECIDED", "This request was already decided", 409)
    user = db.get(User, req.user_id)
    assert user is not None
    return req, user


def decide(
    db: Session, admin: User, request_id: str, approve: bool, reason: str | None, ip: str | None
) -> AdminOfficerRequest:
    req, user = _pending(db, request_id)
    office = db.get(LandOffice, req.office_id)
    assert office is not None
    req.status = "APPROVED" if approve else "REJECTED"
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.now(UTC)
    if approve:
        user.is_active = True
        user.office_id = office.id
    else:
        req.rejection_reason = reason
    audit.log(
        db, admin, "OFFICER_REQUEST_APPROVE" if approve else "OFFICER_REQUEST_REJECT",
        "user", user.id, new={"office": office.code, "reason": reason}, ip=ip,
    )  # fmt: skip
    db.commit()
    return _admin_item(req, user, office)
