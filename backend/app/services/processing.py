"""Document processing (P25): UPLOADED -> PROCESSING -> REVIEW_REQUIRED | FAILED.

`start_processing` runs in the request (validates + flips to PROCESSING + audit).
`run_processing` is the background job: it opens its own session (the request session is
closed by then), runs OCR then Document-AI, and always ends in REVIEW_REQUIRED or FAILED.
"""
import logging
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentOut
from app.services import audit
from app.services.documents import _to_out
from app.services.extraction import build_extraction
from app.services.providers import Providers
from app.services.storage import StorageService

logger = logging.getLogger("landshield.processing")

SessionFactory = Callable[[], Session]

# Provider failure codes that map to an HTTP status when surfaced synchronously (verify-document)
OCR_ERROR_STATUS = {"OCR_UNAVAILABLE": 503, "OCR_TIMEOUT": 504}


def start_processing(db: Session, user: User, document_id: str, ip: str | None) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    if doc.processing_status != DocumentStatus.UPLOADED.value:
        raise AppError(
            "DOCUMENT_NOT_PROCESSABLE",
            "Only UPLOADED documents can be processed",
            409,
            {"status": doc.processing_status},
        )
    doc.processing_status = DocumentStatus.PROCESSING.value
    audit.log(
        db, user, "DOCUMENT_PROCESS", "document", doc.id,
        old={"status": DocumentStatus.UPLOADED.value},
        new={"status": DocumentStatus.PROCESSING.value},
        ip=ip,
    )  # fmt: skip
    db.commit()
    return _to_out(db, doc)


def _fail(db: Session, doc: Document, code: str) -> None:
    """Job failure: status FAILED, code kept in the audit trail (and shown as failure_code)."""
    db.rollback()
    doc.processing_status = DocumentStatus.FAILED.value
    audit.log(
        db, None, "DOCUMENT_PROCESS_FAILED", "document", doc.id,
        old={"status": DocumentStatus.PROCESSING.value},
        new={
            "status": DocumentStatus.FAILED.value,
            "error": code,
            "http_status": OCR_ERROR_STATUS.get(code),
        },
    )  # fmt: skip
    db.commit()


def run_processing(
    session_factory: SessionFactory,
    storage: StorageService,
    providers: Providers,
    document_id: str,
) -> None:
    """Background job. Never raises: any provider/storage error becomes status FAILED."""
    with session_factory() as db:
        doc = db.get(Document, document_id)
        if doc is None or doc.processing_status != DocumentStatus.PROCESSING.value:
            return
        try:
            data = storage.read(doc.file_path)
            file_type = doc.file_path.rsplit(".", 1)[-1]
            ocr = providers.ocr.recognize(data, file_type)
            result = providers.ai.extract(data, ocr)
            doc.ocr_text = ocr.text
            doc.ocr_confidence = ocr.confidence
            doc.extraction_json = build_extraction(result, ocr)
            # every document needs human approval regardless of confidence (R4)
            doc.processing_status = DocumentStatus.REVIEW_REQUIRED.value
            audit.log(
                db, None, "DOCUMENT_EXTRACTED", "document", doc.id,
                old={"status": DocumentStatus.PROCESSING.value},
                new={
                    "status": DocumentStatus.REVIEW_REQUIRED.value,
                    "ocr_provider": ocr.provider,
                    "ai_provider": result.provider,
                    "model": result.model,
                    "warnings": [*ocr.warnings, *result.warnings],
                },
            )  # fmt: skip
            db.commit()
        except Exception as exc:  # job boundary: record, never propagate
            code = getattr(exc, "code", None) or "PROCESSING_ERROR"
            logger.warning("document_processing_failed", extra={"document_id": document_id})
            _fail(db, doc, str(code))
