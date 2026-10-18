"""Digital record versions (H5): every digital version of a document is kept (document_records).

- The extraction job saves its output as a MACHINE version; MACHINE rows never change.
- The first reviewer edit creates a DRAFT version; later edits update that DRAFT.
- Approval freezes the working copy as an APPROVED version: SHA-256 over a canonical payload
  (document id, version, schema, the record and the original file's SHA-256), Ed25519-signed with
  the deed signing key (signing.py). Frozen rows never change.
- A correction after approval never overwrites: it opens a DRAFT v(n+1) copied from the approved
  version, edited through PATCH /documents/{id}/records/{version}; approving it (four-eyes: not by
  whoever made the correction) freezes it and marks the old APPROVED version SUPERSEDED. The
  document's working copy (extraction_json) then shows the corrected record. A correction changes
  the digital record only: ownership, deeds and the ledger stay as posted (D2: they change through
  mutation / khatian).
- Reprocessing discards the open MACHINE / DRAFT versions (SUPERSEDED, still readable).

record_json is the LHDR v1 record of a historical deed (schema lhdr/1, `core` = the 13 derived
fields) or, for any other document, `core/1`: the 13 fields with confidence + bbox, survey type and
khatian extras. Rows are never deleted.
"""
import hashlib
import json
from datetime import UTC, datetime

from ai.extraction import lhdr
from ai.extraction.lhdr_patch import dump, edited
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.deed import Deed
from app.models.document import Document
from app.models.document_record import DocumentRecord
from app.models.enums import DocumentStatus, RecordStatus, Role
from app.models.user import User
from app.schemas.extraction import ExtractedField, Extraction, ExtractionPatch
from app.schemas.record import RecordVersionList, RecordVersionOut
from app.services import audit, signing
from app.services import extraction as extraction_svc

LHDR_SCHEMA = lhdr.SCHEMA
CORE_SCHEMA = "core/1"
PAYLOAD_VERSION = 1
OPEN = (RecordStatus.MACHINE.value, RecordStatus.DRAFT.value)
VALID, INVALID, UNSIGNED = signing.VALID, signing.INVALID, signing.UNSIGNED


# ---- record <-> working copy --------------------------------------------------------------------


def to_record(doc: Document, ex: Extraction) -> tuple[str, dict]:
    """(schema, record_json) of a working copy."""
    if ex.record is not None:
        return LHDR_SCHEMA, dump(extraction_svc.with_core(lhdr.parse(ex.record)))
    return CORE_SCHEMA, {
        "schema": CORE_SCHEMA,
        "document_type": doc.document_type,
        "deed_profile": ex.deed_profile,
        "fields": [f.model_dump(mode="json") for f in ex.fields],
        "survey_type": ex.survey_type,
        "extras": ex.extras,
    }


def working_copy(ex: Extraction, row: DocumentRecord) -> Extraction:
    """The working copy with this version's record in it (metadata stays from `ex`)."""
    out = ex.model_copy(deep=True)
    data = row.record_json
    if row.record_schema == LHDR_SCHEMA:
        rec = lhdr.parse(data)
        out.record, out.record_schema = dump(rec), LHDR_SCHEMA
        out.fields = extraction_svc.fields_from_record(rec, out.original_fields)
    else:
        out.fields = [ExtractedField.model_validate(f) for f in data.get("fields") or []]
        out.survey_type, out.extras = data.get("survey_type"), data.get("extras")
    human_fields = any(f.edited_by_human for f in out.fields)
    out.edited_by_human = human_fields or (
        out.record is not None and edited(lhdr.parse(out.record))
    )
    return out


# ---- hashing + signature ------------------------------------------------------------------------


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:  # SQLite returns naive datetimes; they are stored as UTC
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_payload(doc: Document, row: DocumentRecord) -> bytes:
    body = {
        "v": PAYLOAD_VERSION,
        "document_id": doc.id,
        "file_hash": doc.file_hash,
        "version": row.version,
        "schema": row.record_schema,
        "approved_by": row.approved_by or "",
        "approved_at": _iso(row.approved_at),
        "record": row.record_json,
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def compute_hash(doc: Document, row: DocumentRecord) -> str:
    return hashlib.sha256(canonical_payload(doc, row)).hexdigest()


def check_signature(doc: Document, row: DocumentRecord) -> str:
    """VALID only when the stored hash matches the stored record and the signature verifies."""
    if not row.record_hash or not row.signature:
        return UNSIGNED
    pub = signing.load_private_key().public_key()
    ok = compute_hash(doc, row) == row.record_hash and signing.verify_hash(
        row.record_hash, row.signature, pub
    )
    return VALID if ok else INVALID


def _freeze(doc: Document, row: DocumentRecord, user: User | None) -> None:
    row.status = RecordStatus.APPROVED.value
    row.approved_by = user.id if user else None
    row.approved_at = datetime.now(UTC).replace(microsecond=0) if user else None
    row.record_hash = compute_hash(doc, row)
    row.signature = signing.sign_hash(row.record_hash, signing.load_private_key())


# ---- rows ---------------------------------------------------------------------------------------


def rows(db: Session, document_id: str) -> list[DocumentRecord]:
    return list(
        db.scalars(
            select(DocumentRecord)
            .where(DocumentRecord.document_id == document_id)
            .order_by(DocumentRecord.version)
        ).all()
    )


def latest(db: Session, document_id: str) -> DocumentRecord | None:
    return db.scalar(
        select(DocumentRecord)
        .where(DocumentRecord.document_id == document_id)
        .order_by(DocumentRecord.version.desc())
        .limit(1)
    )


def _add(
    db: Session, doc: Document, status: str, schema: str, data: dict, user: User | None
) -> DocumentRecord:
    n = db.scalar(
        select(func.max(DocumentRecord.version)).where(DocumentRecord.document_id == doc.id)
    )
    row = DocumentRecord(
        document_id=doc.id,
        version=(n or 0) + 1,
        status=status,
        record_schema=schema,
        record_json=data,
        created_by=user.id if user else None,
    )
    db.add(row)
    db.flush()
    return row


def supersede_open(db: Session, document_id: str) -> int:
    """MACHINE / DRAFT versions -> SUPERSEDED (reprocessing discards them). Flush by the caller."""
    res = db.execute(
        update(DocumentRecord)
        .where(DocumentRecord.document_id == document_id, DocumentRecord.status.in_(OPEN))
        .values(status=RecordStatus.SUPERSEDED.value)
    )
    return res.rowcount or 0


def record_machine(db: Session, doc: Document) -> DocumentRecord:
    """The extraction job's output as a new MACHINE version (call after extraction_json is set)."""
    supersede_open(db, doc.id)
    schema, data = to_record(doc, Extraction.model_validate(doc.extraction_json))
    return _add(db, doc, RecordStatus.MACHINE.value, schema, data, None)


def on_edit(db: Session, doc: Document, user: User, before: Extraction, after: Extraction):
    """A saved reviewer edit: update the DRAFT, or open one after the MACHINE version. Documents
    extracted before H5 get their pre-edit state as MACHINE v1 first."""
    row = latest(db, doc.id)
    if row is None:
        schema, data = to_record(doc, before)
        row = _add(db, doc, RecordStatus.MACHINE.value, schema, data, None)
    schema, data = to_record(doc, after)
    if row.status == RecordStatus.DRAFT.value:
        row.record_schema, row.record_json = schema, data
        row.updated_at = datetime.now(UTC)
        db.flush()
        return row
    return _add(db, doc, RecordStatus.DRAFT.value, schema, data, user)


def freeze(db: Session, doc: Document, user: User, ex: Extraction) -> DocumentRecord:
    """Approval: the working copy becomes the APPROVED version (the DRAFT itself, or a new version
    after an unedited MACHINE one). Flush only; the caller commits with the approval."""
    schema, data = to_record(doc, ex)
    row = latest(db, doc.id)
    if row is None or row.status != RecordStatus.DRAFT.value:
        row = _add(db, doc, RecordStatus.DRAFT.value, schema, data, user)
    else:
        row.record_schema, row.record_json = schema, data
    _supersede_approved(db, doc.id, keep=row.id)
    _freeze(doc, row, user)
    db.flush()
    return row


def _supersede_approved(db: Session, document_id: str, keep: str) -> int | None:
    old = db.scalar(
        select(DocumentRecord).where(
            DocumentRecord.document_id == document_id,
            DocumentRecord.status == RecordStatus.APPROVED.value,
            DocumentRecord.id != keep,
        )
    )
    if old is None:
        return None
    old.status = RecordStatus.SUPERSEDED.value
    return old.version


def link_deeds(db: Session, doc: Document, row: DocumentRecord, ex: Extraction) -> None:
    """deeds.record_id -> the approved version; deeds.is_historical from the deed profile."""
    for deed in db.scalars(select(Deed).where(Deed.document_id == doc.id)).all():
        deed.record_id = row.id
        deed.is_historical = ex.deed_profile == "historical"


# ---- API ----------------------------------------------------------------------------------------


def _doc(db: Session, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    return doc


def _version(db: Session, doc: Document, version: int) -> DocumentRecord:
    row = db.scalar(
        select(DocumentRecord).where(
            DocumentRecord.document_id == doc.id, DocumentRecord.version == version
        )
    )
    if row is None:
        raise AppError("RECORD_VERSION_NOT_FOUND", "Record version not found", 404)
    return row


def to_out(doc: Document, row: DocumentRecord, with_record: bool = False) -> RecordVersionOut:
    return RecordVersionOut(
        document_id=doc.id,
        version=row.version,
        status=row.status,
        record_schema=row.record_schema,
        created_by=row.creator.name if row.creator else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
        approved_by=row.approver.name if row.approver else None,
        approved_at=row.approved_at,
        record_hash=row.record_hash,
        signature=row.signature,
        signature_status=check_signature(doc, row),
        file_hash=doc.file_hash,
        record=row.record_json if with_record else None,
    )


def list_versions(db: Session, document_id: str) -> RecordVersionList:
    doc = _doc(db, document_id)
    return RecordVersionList(
        document_id=doc.id,
        file_hash=doc.file_hash,
        items=[to_out(doc, r) for r in rows(db, doc.id)],
    )


def get_version(db: Session, document_id: str, version: int) -> RecordVersionOut:
    doc = _doc(db, document_id)
    return to_out(doc, _version(db, doc, version), with_record=True)


def _approved_doc(db: Session, document_id: str) -> Document:
    doc = _doc(db, document_id)
    if doc.processing_status != DocumentStatus.APPROVED.value or doc.extraction_json is None:
        raise AppError(
            "DOCUMENT_NOT_APPROVED", "Only an approved document's record can be corrected", 409,
            {"status": doc.processing_status},
        )  # fmt: skip
    return doc


def start_correction(
    db: Session, user: User, document_id: str, ip: str | None
) -> tuple[RecordVersionOut, bool]:
    """Open a correction DRAFT (or return the open one: created = False)."""
    doc = _approved_doc(db, document_id)
    row = latest(db, doc.id)
    if row is not None and row.status == RecordStatus.DRAFT.value:
        return to_out(doc, row, with_record=True), False
    ex = Extraction.model_validate(doc.extraction_json)
    schema, data = to_record(doc, ex)
    if row is None or row.status != RecordStatus.APPROVED.value:
        # approved before H5: the approved working copy is kept as v1 first, signed now and
        # without an approver (the original approval is in the audit log)
        base = _add(db, doc, RecordStatus.DRAFT.value, schema, data, None)
        _freeze(doc, base, None)
        audit.log(
            db, user, "DOCUMENT_RECORD_BASELINE", "document", doc.id,
            new={"version": base.version, "record_hash": base.record_hash}, ip=ip,
        )  # fmt: skip
        row = base
    draft = _add(db, doc, RecordStatus.DRAFT.value, row.record_schema, row.record_json, user)
    audit.log(
        db, user, "DOCUMENT_RECORD_CORRECTION_START", "document", doc.id,
        old={"version": row.version}, new={"version": draft.version}, ip=ip,
    )  # fmt: skip
    db.commit()
    return to_out(doc, draft, with_record=True), True


def _open_correction(db: Session, doc: Document, version: int) -> DocumentRecord:
    row = _version(db, doc, version)
    last = latest(db, doc.id)
    if row.status != RecordStatus.DRAFT.value or last is None or last.id != row.id:
        raise AppError(
            "RECORD_NOT_EDITABLE", "Only the open correction draft can be changed", 409,
            {"status": row.status},
        )  # fmt: skip
    return row


def patch_correction(
    db: Session, user: User, document_id: str, version: int, patch: ExtractionPatch, ip: str | None
) -> RecordVersionOut:
    doc = _approved_doc(db, document_id)
    row = _open_correction(db, doc, version)
    ex = working_copy(Extraction.model_validate(doc.extraction_json), row)
    result = extraction_svc.apply_patch(ex, patch)
    if result is None:
        return to_out(doc, row, with_record=True)
    new_ex, old, new = result
    row.record_schema, row.record_json = to_record(doc, new_ex)
    row.updated_at = datetime.now(UTC)
    audit.log(
        db, user, "DOCUMENT_RECORD_EDIT", "document", doc.id,
        old=old, new={**new, "version": row.version}, ip=ip,
    )  # fmt: skip
    db.commit()
    return to_out(doc, row, with_record=True)


def approve_correction(
    db: Session, user: User, document_id: str, version: int, ip: str | None
) -> RecordVersionOut:
    doc = _approved_doc(db, document_id)
    row = _open_correction(db, doc, version)
    if row.created_by == user.id and user.role != Role.ADMIN.value:  # four-eyes
        raise AppError(
            "SELF_APPROVAL_FORBIDDEN", "You cannot approve a correction you made", 403
        )
    prev = db.scalar(
        select(DocumentRecord).where(
            DocumentRecord.document_id == doc.id,
            DocumentRecord.status == RecordStatus.APPROVED.value,
        )
    )
    if prev is not None and prev.record_json == row.record_json:
        raise AppError("RECORD_UNCHANGED", "The correction does not change the record", 409)
    ex = working_copy(Extraction.model_validate(doc.extraction_json), row)
    errors = extraction_svc._validate_doc(doc, ex)
    if errors:
        raise AppError(
            "EXTRACTION_INVALID", "Extraction has validation errors", 422,
            [e.model_dump(exclude_none=True) for e in errors],
        )  # fmt: skip
    rv = extraction_svc.record_validation(ex.record)
    if rv is not None and not rv.valid:
        raise AppError(
            "RECORD_INVALID", "The record has validation errors", 422,
            [i.model_dump() for i in rv.errors],
        )  # fmt: skip
    extraction_svc.check_area(doc, ex)
    superseded = _supersede_approved(db, doc.id, keep=row.id)
    _freeze(doc, row, user)
    link_deeds(db, doc, row, ex)
    doc.extraction_json = ex.dump()  # the working copy (archive search, GET extraction) follows
    audit.log(
        db, user, "DOCUMENT_RECORD_APPROVE", "document", doc.id,
        old={"version": superseded},
        new={"version": row.version, "record_hash": row.record_hash},
        ip=ip,
    )  # fmt: skip
    db.commit()
    return to_out(doc, row, with_record=True)
