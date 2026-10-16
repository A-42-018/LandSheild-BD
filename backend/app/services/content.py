"""Admin-managed notices, FAQ entries and guides (U3.6); the public list is published rows only."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.content import ContentItem
from app.models.user import User
from app.schemas.content import AdminContentList, ContentIn, ContentPatch, PublicContentList
from app.services import audit

_FIELDS = (
    "title_en", "title_bn", "body_en", "body_bn", "published_on", "ticker", "published", "position"
)  # fmt: skip


def _order(kind: str | None):
    # notices: newest first; FAQ and guides: by position, then oldest first
    if kind == "NOTICE":
        return (ContentItem.published_on.desc(), ContentItem.created_at.desc())
    return (ContentItem.position, ContentItem.created_at)


def public_list(db: Session, kind: str) -> PublicContentList:
    rows = db.scalars(
        select(ContentItem)
        .where(ContentItem.kind == kind, ContentItem.published.is_(True))
        .order_by(*_order(kind))
    ).all()
    return PublicContentList.model_validate({"items": rows})


def list_items(
    db: Session, kind: str | None, q: str | None, limit: int, offset: int
) -> AdminContentList:
    stmt = select(ContentItem)
    if kind:
        stmt = stmt.where(ContentItem.kind == kind)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(ContentItem.title_en).like(like) | ContentItem.title_bn.like(like)
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(*_order(kind)).limit(limit).offset(offset)).all()
    return AdminContentList.model_validate(
        {"items": rows, "total": total, "limit": limit, "offset": offset}
    )


def _get(db: Session, item_id: str) -> ContentItem:
    row = db.get(ContentItem, item_id)
    if row is None:
        raise AppError("CONTENT_NOT_FOUND", "Content item not found", 404)
    return row


def create(db: Session, admin: User, data: ContentIn, ip: str | None) -> ContentItem:
    row = ContentItem(**data.model_dump(), updated_by=admin.id)
    db.add(row)
    db.flush()
    new = data.model_dump(mode="json")
    audit.log(db, admin, "CONTENT_CREATE", "content", row.id, new=new, ip=ip)
    db.commit()
    return row


def update(
    db: Session, admin: User, item_id: str, data: ContentPatch, ip: str | None
) -> ContentItem:
    row = _get(db, item_id)
    changes = data.model_dump(exclude_unset=True)
    if row.kind == "NOTICE" and "published_on" in changes and changes["published_on"] is None:
        raise AppError("VALIDATION_ERROR", "A notice needs a date", 422)
    if row.kind != "NOTICE":
        changes.pop("ticker", None)
        changes.pop("published_on", None)
    old = {k: getattr(row, k) for k in changes}
    for k, v in changes.items():
        if k in _FIELDS:
            setattr(row, k, v)
    row.updated_by = admin.id
    audit.log(
        db, admin, "CONTENT_UPDATE", "content", row.id,
        old={k: str(v) for k, v in old.items()},
        new={k: str(v) for k, v in changes.items()},
        ip=ip,
    )  # fmt: skip
    db.commit()
    return row


def delete(db: Session, admin: User, item_id: str, ip: str | None) -> None:
    row = _get(db, item_id)
    audit.log(
        db, admin, "CONTENT_DELETE", "content", row.id,
        old={"kind": row.kind, "title_en": row.title_en}, ip=ip,
    )  # fmt: skip
    db.delete(row)
    db.commit()
