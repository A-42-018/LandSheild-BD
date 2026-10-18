"""Review decisions (P29): approve / reject / reprocess. Approve also posts (P30), atomically."""
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.models.user import User
from app.schemas.document import DocumentOut
from app.schemas.extraction import Extraction
from app.services import audit, offices, party_nid, posting
from app.services.documents import _to_out
from app.services.extraction import (
    EDITABLE_STATUSES,
    _validate_doc,
    is_survey_doc,
    self_approval_blocked,
)

REPROCESSABLE_STATUSES = (*EDITABLE_STATUSES, DocumentStatus.FAILED.value)


def _get(db: Session, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    return doc


def _require_status(doc: Document, allowed: tuple[str, ...], code: str, msg: str) -> None:
    if doc.processing_status not in allowed:
        raise AppError(code, msg, 409, {"status": doc.processing_status})


def approve_document(
    db: Session, user: User, document_id: str, ip: str | None, require_nid: bool = True
) -> DocumentOut:
    doc = _get(db, document_id)
    _require_status(
        doc, EDITABLE_STATUSES, "DOCUMENT_NOT_REVIEWABLE", "Document is not awaiting review"
    )
    # four-eyes: whoever uploaded a document cannot approve it (ADMIN exempt, demo/ops role)
    if self_approval_blocked(doc, user):
        raise AppError("SELF_APPROVAL_FORBIDDEN", "You cannot approve a document you uploaded", 403)
    if doc.extraction_json is None:
        raise AppError(
            "EXTRACTION_NOT_READY", "No extraction available for this document", 409,
            {"status": doc.processing_status},
        )  # fmt: skip
    extraction = Extraction.model_validate(doc.extraction_json)
    errors = _validate_doc(doc, extraction)
    if errors:  # backend-enforced: invalid data can never be approved
        raise AppError(
            "EXTRACTION_INVALID", "Extraction has validation errors", 422,
            [e.model_dump(exclude_none=True) for e in errors],
        )  # fmt: skip
    by = {f.field: f.value for f in extraction.fields}
    offices.check_record_area(doc.office, by.get("district"), by.get("upazila"))
    old = doc.processing_status
    if is_survey_doc(doc):
        # A survey record (khatian / porcha) is archived, not posted: no seller, buyer or deed, so
        # ownership, ledger and mutations stay untouched. It becomes searchable in the archive.
        doc.processing_status = DocumentStatus.APPROVED.value
        audit.log(
            db, user, "DOCUMENT_APPROVE", "document", doc.id,
            old={"status": old},
            new={"status": DocumentStatus.APPROVED.value, "posted": False,
                 "survey_type": extraction.survey_type},
            ip=ip,
        )  # fmt: skip
        db.commit()
        return _to_out(db, doc)
    if require_nid and not party_nid.has_buyer_nid(doc):
        raise AppError(
            "OWNER_NID_REQUIRED", "Enter the new owner's NID and date of birth first", 422
        )
    try:  # one transaction: posting + status + audit commit together or not at all
        result = posting.post_document(db, user, doc, extraction, ip)
        doc.processing_status = DocumentStatus.APPROVED.value
        audit.log(
            db, user, "DOCUMENT_APPROVE", "document", doc.id,
            old={"status": old},
            new={
                "status": DocumentStatus.APPROVED.value,
                "transaction_id": result.transaction_id,
                "transaction_status": result.transaction_status,
            },
            ip=ip,
        )  # fmt: skip
        db.commit()
    except AppError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise AppError("POSTING_FAILED", "Could not post the approved document", 500) from exc
    return _to_out(db, doc)


def reject_document(
    db: Session, user: User, document_id: str, reason: str, ip: str | None
) -> DocumentOut:
    doc = _get(db, document_id)
    _require_status(
        doc, EDITABLE_STATUSES, "DOCUMENT_NOT_REVIEWABLE", "Document is not awaiting review"
    )
    old = doc.processing_status
    doc.processing_status = DocumentStatus.REJECTED.value
    audit.log(
        db, user, "DOCUMENT_REJECT", "document", doc.id,
        old={"status": old}, new={"status": DocumentStatus.REJECTED.value, "reason": reason},
        ip=ip,
    )  # fmt: skip
    db.commit()
    return _to_out(db, doc)


def request_reprocess(
    db: Session, user: User, document_id: str, ip: str | None, profile: str | None = None
) -> DocumentOut:
    """REVIEW_REQUIRED|EXTRACTED|FAILED -> PROCESSING; the caller queues run_processing.
    `profile` (modern | historical) is the reviewer's deed profile switch: the job then reads with
    that Tesseract profile instead of OCR_PROFILE. Deeds only (khatian / porcha have no profile)."""
    doc = _get(db, document_id)
    _require_status(
        doc, REPROCESSABLE_STATUSES, "DOCUMENT_NOT_REPROCESSABLE",
        "Only documents awaiting review or failed can be reprocessed",
    )  # fmt: skip
    if profile is not None and is_survey_doc(doc):
        raise AppError(
            "PROFILE_NOT_APPLICABLE", "Only deeds have a modern / historical profile", 422,
            {"document_type": doc.document_type},
        )  # fmt: skip
    ex = doc.extraction_json or {}
    old = {"status": doc.processing_status, "edited_by_human": bool(ex.get("edited_by_human"))}
    new = {"status": DocumentStatus.PROCESSING.value}
    if profile is not None:
        old["deed_profile"] = ex.get("deed_profile")
        new["profile"] = profile
    doc.processing_status = DocumentStatus.PROCESSING.value
    doc.extraction_json = None  # machine output is regenerated; human edits are discarded
    audit.log(db, user, "DOCUMENT_REPROCESS_REQUEST", "document", doc.id, old=old, new=new, ip=ip)
    db.commit()
    return _to_out(db, doc)
