from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.land_office import LandOffice
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.document import DOCUMENT_TYPES, DocumentOut, DocumentUploadOut, OfficeBrief
from app.services import audit, offices
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
        office=OfficeBrief.model_validate(doc.office) if doc.office else None,
        party_nids={k: v["last4"] for k, v in (doc.party_nids or {}).items()},
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
    office_id: str | None = None,
    party_nids: dict | None = None,
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
    office: LandOffice | None = offices.resolve_upload_office(db, user, office_id)
    if land is not None and office is not None and land.office_id not in (None, office.id):
        raise AppError("OFFICE_MISMATCH", "That land belongs to another land office", 403)

    checked = validate_upload(filename, data)
    digest = sha256_hex(data)

    existing = db.scalar(select(Document).where(Document.file_hash == digest))
    if existing is not None and office is not None and existing.office_id not in (None, office.id):
        # the same file already sits in another office: say so, but show nothing about it
        raise AppError("DOCUMENT_ALREADY_FILED", "This file was already filed elsewhere", 409)
    if existing is not None:  # same bytes: flag, never overwrite or store twice
        audit.log(
            db, user, "DOCUMENT_UPLOAD_DUPLICATE", "document", existing.id,
            new={"file_hash": digest}, ip=ip,
        )  # fmt: skip
        db.commit()
        return DocumentUploadOut(**_to_out(db, existing).model_dump(), duplicate=True)

    stored = storage.save(data, checked.ext)
    if stored.sha256 != digest:  # the backend stored something else than it was given
        raise AppError("STORAGE_ERROR", "The file could not be stored", 500)
    try:
        doc = Document(
            land_id=land.id if land else None,
            document_type=document_type,
            file_path=stored.key,
            file_hash=stored.sha256,
            processing_status=DocumentStatus.UPLOADED.value,
            uploaded_by=user.id,
            office_id=office.id if office else None,
            party_nids=party_nids,
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
                "office": office.code if office else None,
                "party_nids": sorted(party_nids or {}),
            },
            ip=ip,
        )  # fmt: skip
        db.commit()
    except Exception:
        db.rollback()
        # don't leave an orphan behind, but never remove a file a document points to (S3 keys are
        # content-addressed: a concurrent upload of the same bytes shares the key)
        if db.scalar(select(Document.id).where(Document.file_path == stored.key)) is None:
            storage.delete(stored.key)
        raise
    return DocumentUploadOut(**_to_out(db, doc).model_dump(), duplicate=False)


def get_document(db: Session, document_id: str) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    return _to_out(db, doc)


PREVIEW_MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}


def read_document_file(
    db: Session, storage: StorageService, document_id: str
) -> tuple[bytes, str, str]:
    """Bytes, media type and SHA-256 of the stored original (reviewer preview, P28). The original
    is kept for good (H5): every read is checked against the hash taken at upload, so a changed or
    damaged file is refused instead of served. The storage path never leaves the server."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    try:
        data = storage.read(doc.file_path)
    except StorageError:
        raise AppError("DOCUMENT_FILE_MISSING", "Document file is not available", 404) from None
    if sha256_hex(data) != doc.file_hash:
        raise AppError(
            "DOCUMENT_FILE_CORRUPT", "The stored file does not match its recorded hash", 500,
            {"file_hash": doc.file_hash},
        )  # fmt: skip
    ext = doc.file_path.rsplit(".", 1)[-1].lower()
    media = PREVIEW_MEDIA_TYPES.get(ext, "application/octet-stream")
    return data, media, doc.file_hash
