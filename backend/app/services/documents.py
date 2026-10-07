from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.document import DOCUMENT_TYPES, DocumentOut, DocumentUploadOut
from app.services import audit
from app.services.storage import StorageError, StorageService, sha256_hex
from app.services.upload_validation import validate_upload


def _failure_code(db: Session, doc: Document) -> str | None:
    if doc.processing_status != DocumentStatus.FAILED.value:
        return None
    new = db.scalar(
        select(AuditLog.new_value)
        .where(AuditLog.entity_id == doc.id, AuditLog.action == "DOCUMENT_PROCESS_FAILED")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    return (new or {}).get("error")


def _to_out(db: Session, doc: Document) -> DocumentOut:
    land = db.get(LandParcel, doc.land_id) if doc.land_id else None
    return DocumentOut(
        id=doc.id,
        land_id=land.land_id if land else None,
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        file_hash=doc.file_hash,
        file_type=doc.file_path.rsplit(".", 1)[-1],
        created_at=doc.created_at,
        failure_code=_failure_code(db, doc),
    )


def upload_document(
    db: Session,
    storage: StorageService,
    user: User,
    filename: str | None,
    data: bytes,
    document_type: str,
    land_id: str | None,
    ip: str | None,
) -> DocumentUploadOut:
    document_type = document_type.strip().upper()
    if document_type not in DOCUMENT_TYPES:
        raise AppError(
            "INVALID_DOCUMENT_TYPE", "Unknown document type", 422, {"allowed": DOCUMENT_TYPES}
        )
    land = None
    if land_id:
        land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id.strip()))
        if land is None:
            raise AppError("LAND_NOT_FOUND", "Land parcel not found", 404)

    checked = validate_upload(filename, data)
    digest = sha256_hex(data)

    existing = db.scalar(select(Document).where(Document.file_hash == digest))
    if existing is not None:  # same bytes: flag, never overwrite or store twice
        audit.log(
            db, user, "DOCUMENT_UPLOAD_DUPLICATE", "document", existing.id,
            new={"file_hash": digest}, ip=ip,
        )  # fmt: skip
        db.commit()
        return DocumentUploadOut(**_to_out(db, existing).model_dump(), duplicate=True)

    stored = storage.save(data, checked.ext)
    try:
        doc = Document(
            land_id=land.id if land else None,
            document_type=document_type,
            file_path=stored.key,
            file_hash=stored.sha256,
            processing_status=DocumentStatus.UPLOADED.value,
            uploaded_by=user.id,
        )
        db.add(doc)
        db.flush()
        audit.log(
            db, user, "DOCUMENT_UPLOAD", "document", doc.id,
            new={
                "document_type": document_type,
                "file_hash": stored.sha256,
                "file_type": checked.ext,
                "size": stored.size,
                "land_id": land.land_id if land else None,
            },
            ip=ip,
        )  # fmt: skip
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(stored.key)  # don't leave an orphan file behind
        raise
    return DocumentUploadOut(**_to_out(db, doc).model_dump(), duplicate=False)


def get_document(db: Session, document_id: str) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    return _to_out(db, doc)


PREVIEW_MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}


def read_document_file(db: Session, storage: StorageService, document_id: str) -> tuple[bytes, str]:
    """Bytes + media type of the stored original (reviewer preview, P28). Path never leaves."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    try:
        data = storage.read(doc.file_path)
    except StorageError:
        raise AppError("DOCUMENT_FILE_MISSING", "Document file is not available", 404) from None
    ext = doc.file_path.rsplit(".", 1)[-1].lower()
    media = PREVIEW_MEDIA_TYPES.get(ext, "application/octet-stream")
    return data, media
