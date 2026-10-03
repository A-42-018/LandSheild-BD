"""Admin users + records (P37). Every user change is audited; no secret column is ever selected."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.passwords import hash_password
from app.models.document import Document
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.admin import (
    AdminDocument,
    AdminDocumentList,
    AdminLandRecord,
    AdminLandRecordList,
    AdminUser,
    AdminUserCreate,
    AdminUserList,
    AdminUserPatch,
)
from app.services import audit

USER_SORT = {
    "name": User.name,
    "email": User.email,
    "role": User.role,
    "created_at": User.created_at,
}
LAND_SORT = {
    "land_id": LandParcel.land_id,
    "district": LandParcel.district,
    "mouza": LandParcel.mouza,
    "area": LandParcel.area,
    "status": LandParcel.status,
    "updated_at": LandParcel.updated_at,
}
DOC_SORT = {
    "created_at": Document.created_at,
    "document_type": Document.document_type,
    "processing_status": Document.processing_status,
    "ocr_confidence": Document.ocr_confidence,
    "land_id": LandParcel.land_id,
}


def _like(value: str) -> str:
    esc = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc.lower()}%"


def _contains(col, q: str):
    return func.lower(col).like(_like(q), escape="\\")


def _order(columns: dict, sort: str, order: str, default: str, tiebreak):
    col = columns.get(sort) or columns[default]
    return (col.asc() if order == "asc" else col.desc()), tiebreak


# ---- users ------------------------------------------------------------------------------------
def list_users(
    db: Session, q: str | None, role: str | None, is_active: bool | None,
    sort: str, order: str, limit: int, offset: int,
) -> AdminUserList:  # fmt: skip
    cond = []
    q = (q or "").strip()
    if q:
        cond.append(or_(_contains(User.name, q), _contains(User.email, q)))
    if role:
        cond.append(User.role == role)
    if is_active is not None:
        cond.append(User.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(User).where(*cond)) or 0
    stmt = (
        select(User).where(*cond).order_by(*_order(USER_SORT, sort, order, "created_at", User.id))
    )
    rows = db.scalars(stmt.limit(limit).offset(offset)).all()
    return AdminUserList(
        items=[AdminUser.model_validate(u) for u in rows], total=total, limit=limit, offset=offset
    )


def create_user(db: Session, actor: User, body: AdminUserCreate, ip: str | None) -> User:
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise AppError("EMAIL_TAKEN", "Email already registered", 409)
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        preferred_language=body.preferred_language,
        is_active=True,
    )
    db.add(user)
    db.flush()
    audit.log(
        db, actor, "USER_CREATE", "user", user.id,
        new={"role": user.role, "is_active": True}, ip=ip,
    )  # fmt: skip
    db.commit()
    return user


def update_user(
    db: Session, actor: User, user_id: str, body: AdminUserPatch, ip: str | None
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AppError("NOT_FOUND", "User not found", 404)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise AppError("NO_CHANGES", "Nothing to update", 422)
    if user.id == actor.id and (
        ("role" in changes and changes["role"] != user.role) or changes.get("is_active") is False
    ):
        raise AppError(
            "CANNOT_CHANGE_OWN_ACCESS",
            "You cannot change your own role or deactivate yourself",
            409,
        )
    old = {k: getattr(user, k) for k in changes if getattr(user, k) != changes[k]}
    new = {k: changes[k] for k in old}
    if not old:
        return user  # no-op: nothing written, nothing audited
    for k, v in new.items():
        setattr(user, k, v)
    audit.log(db, actor, "USER_UPDATE", "user", user.id, old=old, new=new, ip=ip)
    db.commit()
    return user


# ---- records ----------------------------------------------------------------------------------
def list_land_records(
    db: Session, q: str | None, status: str | None, sort: str, order: str, limit: int, offset: int
) -> AdminLandRecordList:
    cond = []
    q = (q or "").strip()
    if q:
        cond.append(or_(*(_contains(c, q) for c in (
            LandParcel.land_id, LandParcel.district, LandParcel.upazila, LandParcel.mouza,
            LandParcel.khatian_no, LandParcel.dag_no))))  # fmt: skip
    if status:
        cond.append(LandParcel.status == status)
    total = db.scalar(select(func.count()).select_from(LandParcel).where(*cond)) or 0
    stmt = (
        select(LandParcel)
        .where(*cond)
        .order_by(*_order(LAND_SORT, sort, order, "land_id", LandParcel.id))
    )
    rows = db.scalars(stmt.limit(limit).offset(offset)).all()
    items = [
        AdminLandRecord(
            land_id=p.land_id,
            district=p.district,
            upazila=p.upazila,
            mouza=p.mouza,
            khatian_no=p.khatian_no,
            dag_no=p.dag_no,
            area=p.area,
            area_unit=p.area_unit,
            status=p.status,
            updated_at=p.updated_at,
        )  # fmt: skip
        for p in rows
    ]
    return AdminLandRecordList(items=items, total=total, limit=limit, offset=offset)


def list_documents(
    db: Session, q: str | None, status: str | None, sort: str, order: str, limit: int, offset: int
) -> AdminDocumentList:
    cond = []
    q = (q or "").strip()
    if q:
        fields = (LandParcel.land_id, Document.document_type, Document.processing_status, User.name)
        cond.append(or_(*(_contains(c, q) for c in fields)))
    if status:
        cond.append(Document.processing_status == status)

    def joined(stmt):
        return (
            stmt.outerjoin(LandParcel, LandParcel.id == Document.land_id)
            .outerjoin(User, User.id == Document.uploaded_by)
            .where(*cond)
        )

    total = db.scalar(joined(select(func.count()).select_from(Document))) or 0
    stmt = joined(select(Document, LandParcel.land_id, User.name)).order_by(
        *_order(DOC_SORT, sort, order, "created_at", Document.id)
    )
    rows = db.execute(stmt.limit(limit).offset(offset)).all()
    items = [
        AdminDocument(
            id=d.id,
            land_id=land_id,
            document_type=d.document_type,
            processing_status=d.processing_status,
            ocr_confidence=d.ocr_confidence,
            uploaded_by=name,
            created_at=d.created_at,
        )  # fmt: skip
        for d, land_id, name in rows
    ]
    return AdminDocumentList(items=items, total=total, limit=limit, offset=offset)
