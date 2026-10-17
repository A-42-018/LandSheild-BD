"""Document processing (P25): UPLOADED -> PROCESSING -> REVIEW_REQUIRED | FAILED.

`start_processing` runs in the request (validates + flips to PROCESSING + audit).
`run_processing` is the background job: it opens its own session (the request session is
closed by then), runs OCR then Document-AI, and always ends in REVIEW_REQUIRED or FAILED.
Deeds (not khatian / porcha) are classified modern | historical on the OCR text (H3, D1: the
document_type stays DEED) and the verdict is stored in extraction_json. A reviewer's reprocess
with `profile` (modern | historical) reads with that Tesseract profile instead of OCR_PROFILE and
stores it as deed_profile with profile_overridden (deed_class keeps the classifier's verdict).
"""
import logging
from collections.abc import Callable
from dataclasses import replace

from ai.extraction import reread
from ai.extraction.classify import classify
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentOut
from app.services import audit, record_assist
from app.services.documents import _to_out
from app.services.extraction import build_extraction, is_survey_doc
from app.services.providers import Providers, with_ocr_profile
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
    profile: str | None = None,
) -> None:
    """Background job. Never raises: any provider/storage error becomes status FAILED.
    `profile` forces the deed's Tesseract profile (reviewer switch); None = OCR_PROFILE."""
    with session_factory() as db:
        doc = db.get(Document, document_id)
        if doc is None or doc.processing_status != DocumentStatus.PROCESSING.value:
            return
        try:
            data = storage.read(doc.file_path)
            file_type = doc.file_path.rsplit(".", 1)[-1]
            survey = is_survey_doc(doc)
            override = None if survey else profile
            ocr_provider = with_ocr_profile(providers.ocr, override) if override else providers.ocr
            ocr = ocr_provider.recognize(data, file_type)
            deed_class = None if survey else classify(ocr.text, ocr.tables)
            result = providers.ai.extract(data, ocr)
            try:  # best effort: check misread values against the land records, never fail the document
                alts = reread.candidates(data, result.fields)
                fields, notes = record_assist.apply(db, result.fields, alts)
                if notes:
                    result = replace(result, fields=fields, warnings=[*result.warnings, *notes])
            except Exception:
                logger.warning("record_assist_failed", extra={"id": document_id}, exc_info=True)
            doc.ocr_text = ocr.text
            doc.ocr_confidence = ocr.confidence
            doc.extraction_json = build_extraction(result, ocr, deed_class, override)
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
                    "deed_profile": override or (deed_class.deed_profile if deed_class else None),
                    "profile_overridden": override is not None,
                    "warnings": [*ocr.warnings, *result.warnings],
                },
            )  # fmt: skip
            db.commit()
        except Exception as exc:  # job boundary: record, never propagate
            code = getattr(exc, "code", None) or "PROCESSING_ERROR"
            logger.warning("document_processing_failed", extra={"document_id": document_id})
            _fail(db, doc, str(code))
