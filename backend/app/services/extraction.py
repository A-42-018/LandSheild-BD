"""Extraction service (P27): build/store extraction_json, validate (R4), human edits.

Validation here is about FORMAT of present values (area numeric > 0, deed date valid and not in
the future, known unit) plus REQUIRED-ness. PATCH enforces format only (a reviewer fills fields
step by step); GET reports required-ness too, and approval (P29) will require validation.valid.

H5: a historical deed's LHDR record is the source of truth. PATCH edits it by JSON pointer
(`record` ops, ai/extraction/lhdr_patch.py) and writes flat field edits into it too; the 13 fields
are then derived from the record again, so the two never disagree. The LHDR content rules
(`record_validation`) are reported like the field errors; an edit may not add a format error at
the path it touched, and approval needs a record without errors. Every saved edit also updates the
document's DRAFT record version (app/services/records.py).
"""
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

import pydantic
from ai.extraction import lhdr, lhdr_patch
from ai.extraction.base import EXTRACTION_FIELDS, ExtractionResult
from ai.extraction.classify import DeedClass
from ai.extraction.derive import derive_core, derive_fields
from ai.extraction.lhdr_patch import PatchError
from ai.ocr.base import OCRResult
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import DocumentStatus, Role
from app.models.user import User
from app.schemas.extraction import (
    AREA_UNITS,
    MAX_VALUE_LEN,
    REQUIRED_FIELDS,
    SURVEY_DOC_TYPES,
    SURVEY_REQUIRED_FIELDS,
    ExtractedField,
    ExtractedFieldOut,
    Extraction,
    ExtractionOut,
    ExtractionPatch,
    ExtractionValidation,
    FieldError,
    RecordIssue,
    RecordValidation,
)
from app.services import audit, offices, records

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_NUMERIC_FIELDS = {"khatian_no", "dag_no", "land_area", "deed_no", "deed_date"}
_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")
EDITABLE_STATUSES = (DocumentStatus.REVIEW_REQUIRED.value, DocumentStatus.EXTRACTED.value)
# LHDR check() codes about the format of a present value (the rest are required-ness)
RECORD_FORMAT_CODES = frozenset({
    "NOT_NUMERIC", "AREA_NOT_POSITIVE", "UNKNOWN_UNIT", "AMOUNT_NOT_POSITIVE",
    "DATE_IN_FUTURE", "DATE_RANGE_REVERSED", "BAD_DAY",
})  # fmt: skip


def build_extraction(
    result: ExtractionResult,
    ocr: OCRResult | None = None,
    deed_class: DeedClass | None = None,
    profile_override: str | None = None,
) -> dict:
    """Provider output -> stored JSON (all 13 fields, absent -> value None / confidence 0).
    `profile_override` (reviewer's switch) replaces the detected deed_profile; deed_class keeps
    the classifier's own verdict."""
    by = {f.field: f for f in result.fields}
    fields = [
        ExtractedField(
            field=name,
            value=by[name].value if name in by else None,
            confidence=by[name].confidence if name in by else 0.0,
            source_bbox=by[name].source_bbox if name in by else None,
        )
        for name in EXTRACTION_FIELDS
    ]
    extras = dict(result.extras) if result.extras else None
    survey = extras.get("survey_type") if extras else None
    ex = Extraction(
        provider=result.provider,
        ocr_source=ocr.provider if ocr else None,
        extractor=result.provider,
        model=result.model,
        warnings=[*(ocr.warnings if ocr else ()), *result.warnings],
        fields=fields,
        survey_type=survey,
        extras=extras,
        deed_profile=profile_override or (deed_class.deed_profile if deed_class else None),
        deed_class=deed_class.to_dict() if deed_class else None,
        ocr_profile=ocr.profile if ocr else None,
        profile_overridden=profile_override is not None,
        record=result.record,
        record_schema=result.record.get("schema") if result.record else None,
    )
    return ex.dump()


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = " ".join(value.split())
    return value or None


def _parse_date(value: str) -> date | None:
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _parse_area(value: str) -> Decimal | None:
    try:
        d = Decimal(value.replace(",", ""))
    except InvalidOperation:
        return None
    return d if d.is_finite() else None


def is_survey_doc(doc: Document) -> bool:
    return doc.document_type in SURVEY_DOC_TYPES


def validate_fields(
    fields: list[ExtractedField],
    today: date | None = None,
    required: tuple[str, ...] = REQUIRED_FIELDS,
) -> list[FieldError]:
    today = today or datetime.now(UTC).date()
    by = {f.field: _clean(f.value) for f in fields}
    errors: list[FieldError] = []
    for name in required:
        if by.get(name) is None:
            errors.append(FieldError(field=name, code="REQUIRED"))
    area = by.get("land_area")
    if area is not None:
        d = _parse_area(area.translate(_BN_DIGITS))
        if d is None:
            errors.append(FieldError(field="land_area", code="NOT_A_NUMBER"))
        elif d <= 0:
            errors.append(FieldError(field="land_area", code="NOT_POSITIVE"))
    unit = by.get("area_unit")
    if unit is not None and unit.lower() not in AREA_UNITS:
        errors.append(
            FieldError(field="area_unit", code="INVALID_UNIT", params={"allowed": list(AREA_UNITS)})
        )
    deed_date = by.get("deed_date")
    if deed_date is not None:
        parsed = _parse_date(deed_date.translate(_BN_DIGITS))
        if parsed is None:
            errors.append(FieldError(field="deed_date", code="INVALID_DATE"))
        elif parsed > today:
            errors.append(FieldError(field="deed_date", code="DATE_IN_FUTURE"))
    return errors


def _normalise(name: str, value: str | None) -> str | None:
    value = _clean(value)
    if value is None:
        return None
    if name in _NUMERIC_FIELDS:
        value = value.translate(_BN_DIGITS)
    if name == "land_area":
        value = value.replace(",", "")
    if name == "area_unit":
        value = value.lower()
    if name == "deed_date" and (parsed := _parse_date(value)) is not None:
        value = parsed.isoformat()
    return value


def _load(doc: Document) -> Extraction:
    if doc.extraction_json is None:
        raise AppError(
            "EXTRACTION_NOT_READY", "No extraction available for this document", 409,
            {"status": doc.processing_status},
        )  # fmt: skip
    return Extraction.model_validate(doc.extraction_json)


def _get_doc(db: Session, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    return doc


def self_approval_blocked(doc: Document, user: User) -> bool:
    """Four-eyes rule: the uploader may not approve their own document (ADMIN is exempt)."""
    return doc.uploaded_by == user.id and user.role != Role.ADMIN.value


def _validate_doc(doc: Document, ex: Extraction) -> list[FieldError]:
    """Deeds need the full field set; a khatian / porcha only survey identifiers + survey type."""
    if not is_survey_doc(doc):
        return validate_fields(ex.fields)
    errors = validate_fields(ex.fields, required=SURVEY_REQUIRED_FIELDS)
    if not ex.survey_type:
        errors.append(FieldError(field="survey_type", code="REQUIRED"))
    return errors


def check_area(doc: Document, ex: Extraction) -> None:
    """The record must lie in the office's area (offices.check_record_area). A historical deed names
    places as they were (থানা রূপগঞ্জ, জেলা ঢাকা in 1944); its computed modern mapping (LHDR section
    I: Narayanganj / Rupganj) is accepted as well."""
    by = {f.field: f.value for f in ex.fields}
    try:
        offices.check_record_area(doc.office, by.get("district"), by.get("upazila"))
    except AppError:
        mm = (ex.record or {}).get("modern_mapping") or {}
        district, upazila = ((mm.get(k) or {}).get("value") for k in ("district", "upazila"))
        if not district:
            raise
        offices.check_record_area(doc.office, district, upazila)


def record_validation(record: dict | None, today: date | None = None) -> RecordValidation | None:
    if record is None:
        return None
    try:
        rec = lhdr.parse(record)
    except pydantic.ValidationError:
        issue = RecordIssue(path="", code="RECORD_INVALID", message="record does not match lhdr/1")
        return RecordValidation(valid=False, errors=[issue], warnings=[])
    issues = lhdr.check(rec, today)
    errors = [RecordIssue(path=i.path, code=i.code, message=i.message) for i in issues
              if i.severity == "error"]  # fmt: skip
    warnings = [RecordIssue(path=i.path, code=i.code, message=i.message) for i in issues
                if i.severity == "warning"]  # fmt: skip
    return RecordValidation(valid=not errors, errors=errors, warnings=warnings)


def fields_from_record(
    rec: lhdr.LHDR, original: list[ExtractedField] | None
) -> list[ExtractedField]:
    """The 13 fields derived from the record. edited_by_human = differs from the machine output."""
    orig = {f.field: f.value for f in original} if original is not None else None
    return [
        ExtractedField(
            field=f.field,
            value=f.value,
            confidence=f.confidence,
            source_bbox=f.source_bbox,
            edited_by_human=orig is not None and f.value != orig.get(f.field),
        )
        for f in derive_fields(rec)
    ]


def with_core(rec: lhdr.LHDR) -> lhdr.LHDR:
    """The record with its `core` section (J) set to the 13 values derived from it."""
    rec.core = lhdr.Core(**derive_core(rec))
    return rec


def _check_flat(patch: ExtractionPatch) -> dict[str, str | None]:
    """Request-level and format problems of the flat edits, reported per field (422)."""
    problems: list[FieldError] = []
    seen: set[str] = set()
    edits: dict[str, str | None] = {}
    for e in patch.fields:
        if e.field not in EXTRACTION_FIELDS:
            problems.append(FieldError(field=e.field, code="UNKNOWN_FIELD"))
        elif e.field in seen:
            problems.append(FieldError(field=e.field, code="DUPLICATE_FIELD"))
        elif e.value is not None and len(e.value) > MAX_VALUE_LEN:
            problems.append(
                FieldError(field=e.field, code="TOO_LONG", params={"max": MAX_VALUE_LEN})
            )
        else:
            edits[e.field] = _normalise(e.field, e.value)
        seen.add(e.field)
    # format validation of the edited values only (required-ness is not enforced on PATCH)
    probe = [ExtractedField(field=n, value=v) for n, v in edits.items()]
    problems += [err for err in validate_fields(probe) if err.code != "REQUIRED"]
    if problems:
        raise AppError(
            "EXTRACTION_VALIDATION_FAILED", "Extraction values are invalid", 422,
            [p.model_dump(exclude_none=True) for p in problems],
        )  # fmt: skip
    return edits


def _within(a: str, b: str) -> bool:
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def _patch_record(
    ex: Extraction, edits: dict[str, str | None], patch: ExtractionPatch
) -> tuple[Extraction, dict, dict] | None:
    rec = lhdr.parse(ex.record or {})
    before = {(i.path, i.code) for i in lhdr.check(rec) if i.code in RECORD_FORMAT_CODES}
    current = derive_core(rec)
    changed = {n: v for n, v in edits.items() if current[n] != v}
    try:
        rec, changes = lhdr_patch.apply(rec, [o.model_dump() for o in patch.record])
        rec, core_changes = lhdr_patch.apply_core(rec, changed)
    except PatchError as e:
        raise AppError(
            "RECORD_PATCH_FAILED", "The record edit cannot be applied", 422, [e.to_dict()]
        ) from None
    changes += core_changes
    if not changes:
        return None
    touched = [c["path"] for c in changes if c["op"] != "remove"]
    added = [
        RecordIssue(path=i.path, code=i.code, message=i.message)
        for i in lhdr.check(rec)
        if i.code in RECORD_FORMAT_CODES and (i.path, i.code) not in before
        and any(_within(i.path, t) for t in touched)
    ]  # fmt: skip
    if added:
        raise AppError(
            "RECORD_VALIDATION_FAILED", "Record values are invalid", 422,
            [a.model_dump() for a in added],
        )  # fmt: skip
    out = ex.model_copy(deep=True)
    if out.original_fields is None:  # keep the machine output exactly once
        out.original_fields = [f.model_copy(deep=True) for f in ex.fields]
    out.record = lhdr_patch.dump(with_core(rec))
    out.fields = fields_from_record(rec, out.original_fields)
    out.edited_by_human = any(f.edited_by_human for f in out.fields) or lhdr_patch.edited(rec)
    new_core = derive_core(rec)
    moved = {n for n in EXTRACTION_FIELDS if new_core[n] != current[n]}
    old = {"record": [{k: c[k] for k in ("op", "path", "old")} for c in changes]}
    new = {"record": [{k: c[k] for k in ("op", "path", "new")} for c in changes]}
    if moved:
        old["fields"] = {n: current[n] for n in sorted(moved)}
        new["fields"] = {n: new_core[n] for n in sorted(moved)}
    return out, old, new


def apply_patch(ex: Extraction, patch: ExtractionPatch) -> tuple[Extraction, dict, dict] | None:
    """Validate and apply a PATCH to an extraction (a copy is returned; None = nothing changed).
    Returns (new extraction, audit old, audit new). Raises AppError 422 and changes nothing."""
    edits = _check_flat(patch)
    if ex.record is not None:
        return _patch_record(ex, edits, patch)
    if patch.record:
        raise AppError(
            "RECORD_NOT_AVAILABLE", "This document has no LHDR record to edit", 422,
            {"record_schema": ex.record_schema},
        )  # fmt: skip
    out = ex.model_copy(deep=True)
    current = {f.field: f for f in out.fields}
    changed = {n: v for n, v in edits.items() if current[n].value != v}
    if not changed:
        return None
    if out.original_fields is None:  # keep the machine output exactly once
        out.original_fields = [f.model_copy(deep=True) for f in out.fields]
    original = {f.field: f.value for f in out.original_fields}
    old = {n: current[n].value for n in changed}
    for n, v in changed.items():
        current[n].value = v
        current[n].edited_by_human = v != original[n]
    out.edited_by_human = any(f.edited_by_human for f in out.fields)
    return out, {"fields": old}, {"fields": changed}


def _to_out(
    doc: Document,
    ex: Extraction,
    threshold: float,
    viewer: User | None = None,
    version=None,  # the document's latest DocumentRecord
) -> ExtractionOut:
    fields = [
        ExtractedFieldOut(
            **f.model_dump(),
            low_confidence=(not f.edited_by_human and f.confidence < threshold),
        )
        for f in ex.fields
    ]
    errors = _validate_doc(doc, ex)
    low = [f.field for f in fields if f.low_confidence]
    return ExtractionOut(
        document_id=doc.id,
        processing_status=doc.processing_status,
        provider=ex.provider,
        ocr_source=ex.ocr_source,
        extractor=ex.extractor or ex.provider,
        model=ex.model,
        warnings=ex.warnings,
        deed_profile=ex.deed_profile,
        deed_class=ex.deed_class,
        ocr_profile=ex.ocr_profile,
        profile_overridden=ex.profile_overridden,
        record=ex.record,
        record_schema=ex.record_schema,
        record_validation=record_validation(ex.record),
        file_hash=doc.file_hash,
        version=version.version if version is not None else None,
        version_status=version.status if version is not None else None,
        threshold=threshold,
        fields=fields,
        edited_by_human=ex.edited_by_human,
        has_low_confidence=bool(low),
        low_confidence_fields=low,
        validation=ExtractionValidation(valid=not errors, errors=errors),
        original_fields=ex.original_fields if ex.edited_by_human else None,
        self_approval_blocked=bool(viewer and self_approval_blocked(doc, viewer)),
    )


def get_extraction(
    db: Session, document_id: str, threshold: float, viewer: User | None = None
) -> ExtractionOut:
    doc = _get_doc(db, document_id)
    return _to_out(doc, _load(doc), threshold, viewer, records.latest(db, doc.id))


def patch_extraction(
    db: Session,
    user: User,
    document_id: str,
    patch: ExtractionPatch,
    threshold: float,
    ip: str | None,
) -> ExtractionOut:
    doc = _get_doc(db, document_id)
    if doc.processing_status not in EDITABLE_STATUSES:
        raise AppError(
            "DOCUMENT_NOT_EDITABLE", "Extraction can only be edited while awaiting review", 409,
            {"status": doc.processing_status},
        )  # fmt: skip
    ex = _load(doc)
    result = apply_patch(ex, patch)
    if result is None:
        return _to_out(doc, ex, threshold, user, records.latest(db, doc.id))
    new_ex, old, new = result
    doc.extraction_json = new_ex.dump()  # reassign: JSON column does not track in-place mutation
    row = records.on_edit(db, doc, user, before=ex, after=new_ex)
    audit.log(
        db, user, "DOCUMENT_EXTRACTION_EDIT", "document", doc.id,
        old=old, new=new, ip=ip,
    )  # fmt: skip
    db.commit()
    return _to_out(doc, new_ex, threshold, user, row)
