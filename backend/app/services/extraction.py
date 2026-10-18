"""Extraction service (P27): build/store extraction_json, validate (R4), human edits.

Validation here is about FORMAT of present values (area numeric > 0, deed date valid and not in
the future, known unit) plus REQUIRED-ness. PATCH enforces format only (a reviewer fills fields
step by step); GET reports required-ness too, and approval (P29) will require validation.valid.
"""
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

from ai.extraction.base import EXTRACTION_FIELDS, ExtractionResult
from ai.extraction.classify import DeedClass
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
)
from app.services import audit

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_NUMERIC_FIELDS = {"khatian_no", "dag_no", "land_area", "deed_no", "deed_date"}
_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")
EDITABLE_STATUSES = (DocumentStatus.REVIEW_REQUIRED.value, DocumentStatus.EXTRACTED.value)


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


def _to_out(
    doc: Document, ex: Extraction, threshold: float, viewer: User | None = None
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
    return _to_out(doc, _load(doc), threshold, viewer)


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

    # 1) request-level problems, reported per field
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

    # 2) format validation of the edited values only (required-ness is not enforced on PATCH)
    probe = [ExtractedField(field=n, value=v) for n, v in edits.items()]
    problems += [err for err in validate_fields(probe) if err.code != "REQUIRED"]
    if problems:
        raise AppError(
            "EXTRACTION_VALIDATION_FAILED", "Extraction values are invalid", 422,
            [p.model_dump(exclude_none=True) for p in problems],
        )  # fmt: skip

    current = {f.field: f for f in ex.fields}
    changed = {n: v for n, v in edits.items() if current[n].value != v}
    if not changed:
        return _to_out(doc, ex, threshold, user)

    if ex.original_fields is None:  # keep the machine output exactly once
        ex.original_fields = [f.model_copy(deep=True) for f in ex.fields]
    original = {f.field: f.value for f in ex.original_fields}
    old = {n: current[n].value for n in changed}
    for n, v in changed.items():
        current[n].value = v
        current[n].edited_by_human = v != original[n]
    ex.edited_by_human = any(f.edited_by_human for f in ex.fields)

    doc.extraction_json = ex.dump()  # reassign: JSON column does not track in-place mutation
    audit.log(
        db, user, "DOCUMENT_EXTRACTION_EDIT", "document", doc.id,
        old={"fields": old}, new={"fields": changed}, ip=ip,
    )  # fmt: skip
    db.commit()
    return _to_out(doc, ex, threshold, user)
