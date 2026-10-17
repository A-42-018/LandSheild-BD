"""Reviewer's modern <-> historical switch (H3, D1): POST /reprocess {"profile": ...} re-runs the
job with that Tesseract profile instead of OCR_PROFILE and stores it in extraction_json."""
from ai.extraction.mock import MockDocumentAIProvider
from ai.ocr.base import OCRResult
from ai.ocr.mock import MockOCRProvider
from ai.ocr.router import AutoOCRProvider
from ai.ocr.tesseract import TesseractOCRProvider
from sqlalchemy import select

from app.api.v1.documents import get_job_providers
from app.models.audit import AuditLog
from app.services import processing
from app.services.providers import Providers, with_ocr_profile
from app.services.storage import LocalStorage
from tests.test_classify import OLD
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _get, _patch, _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import _process, _row, _start, jobs  # noqa: F401
from tests.test_review import _post


class _ProfileOCR:
    """Reads the 1931 deed text and records the profile each read used (copies share `seen`)."""

    name = "fake"

    def __init__(self, text: str = OLD) -> None:
        self.profile = "auto"
        self.text = text
        self.seen: list[str] = []

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        self.seen.append(self.profile)
        used = "modern" if self.profile == "auto" else self.profile
        return OCRResult(text=self.text, confidence=0.7, provider="tesseract", profile=used)


def _use(env, ocr) -> None:  # noqa: F811
    providers = Providers(ocr, MockDocumentAIProvider())
    env.app.dependency_overrides[get_job_providers] = lambda: providers


def _audit_new(env, doc_id, action) -> list[dict]:  # noqa: F811
    with _db(env) as s:
        rows = s.scalars(
            select(AuditLog)
            .where(AuditLog.entity_id == doc_id, AuditLog.action == action)
            .order_by(AuditLog.created_at)
        ).all()
    return [r.new_value for r in rows]


# ---- with_ocr_profile ----------------------------------------------------------------------------

def test_with_ocr_profile_copies_auto_and_tesseract_providers():
    for ocr in (AutoOCRProvider(profile="auto", max_pages=3), TesseractOCRProvider(profile="auto")):
        forced = with_ocr_profile(ocr, "historical")
        assert forced is not ocr and forced.profile == "historical"
        assert ocr.profile == "auto"  # the shared provider keeps OCR_PROFILE
        assert forced.max_pages == ocr.max_pages


def test_with_ocr_profile_leaves_profile_less_providers_alone():
    ocr = MockOCRProvider()
    assert with_ocr_profile(ocr, "historical") is ocr


# ---- background job ------------------------------------------------------------------------------

def _deed(env, jobs, store, ocr, profile=None) -> str:  # noqa: F811
    r = _up(env, "scan.png", png() + b"LSMOCK:Doc1")
    assert r.status_code == 201
    doc_id = r.json()["id"]
    _start(env, doc_id)
    providers = Providers(ocr, MockDocumentAIProvider())
    processing.run_processing(jobs, LocalStorage(store), providers, doc_id, profile=profile)
    return doc_id


def test_job_without_override_detects(env, jobs, store):  # noqa: F811
    ocr = _ProfileOCR()
    ex = _row(env, _deed(env, jobs, store, ocr)).extraction_json
    assert ocr.seen == ["auto"]
    assert ex["deed_profile"] == "historical" and ex["profile_overridden"] is False


def test_job_override_forces_the_tesseract_profile(env, jobs, store):  # noqa: F811
    ocr = _ProfileOCR()
    doc_id = _deed(env, jobs, store, ocr, profile="modern")
    assert ocr.seen == ["modern"] and ocr.profile == "auto"
    row = _row(env, doc_id)
    assert row.processing_status == "REVIEW_REQUIRED" and row.document_type == "DEED"
    ex = row.extraction_json
    assert ex["deed_profile"] == "modern" and ex["ocr_profile"] == "modern"
    assert ex["profile_overridden"] is True
    assert ex["deed_class"]["deed_profile"] == "historical"  # the classifier's verdict is kept
    (new,) = _audit_new(env, doc_id, "DOCUMENT_EXTRACTED")
    assert new["deed_profile"] == "modern" and new["profile_overridden"] is True


# ---- API -----------------------------------------------------------------------------------------

def test_reviewer_flips_the_profile_and_the_document_is_re_extracted(env, jobs):  # noqa: F811
    ocr = _ProfileOCR()
    _use(env, ocr)
    doc_id = _ready(env)
    first = _get(env, doc_id).json()
    assert first["deed_profile"] == "historical" and first["profile_overridden"] is False
    assert _patch(env, doc_id, {"mouza": "Edited"}).status_code == 200

    r = _post(env, doc_id, "reprocess", json={"profile": "modern"})
    assert r.status_code == 202 and r.json()["processing_status"] == "PROCESSING"
    got = _get(env, doc_id).json()  # TestClient ran the job after the response
    assert got["processing_status"] == "REVIEW_REQUIRED"
    assert got["deed_profile"] == "modern" and got["ocr_profile"] == "modern"
    assert got["profile_overridden"] is True and got["edited_by_human"] is False
    assert got["deed_class"]["deed_profile"] == "historical"

    assert _post(env, doc_id, "reprocess", json={"profile": "historical"}).status_code == 202
    back = _get(env, doc_id).json()
    assert back["deed_profile"] == "historical" and back["ocr_profile"] == "historical"
    assert back["profile_overridden"] is True
    assert ocr.seen == ["auto", "modern", "historical"]

    requests = _audit_new(env, doc_id, "DOCUMENT_REPROCESS_REQUEST")
    assert [n.get("profile") for n in requests] == ["modern", "historical"]


def test_reprocess_without_body_detects_again(env, jobs):  # noqa: F811
    ocr = _ProfileOCR()
    _use(env, ocr)
    doc_id = _ready(env)
    assert _post(env, doc_id, "reprocess", json={"profile": "modern"}).status_code == 202
    assert _post(env, doc_id, "reprocess").status_code == 202
    got = _get(env, doc_id).json()
    assert got["deed_profile"] == "historical" and got["profile_overridden"] is False
    assert ocr.seen == ["auto", "modern", "auto"]
    assert "profile" not in _audit_new(env, doc_id, "DOCUMENT_REPROCESS_REQUEST")[-1]


def test_unknown_profile_is_rejected_and_nothing_changes(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    for body in ({"profile": "auto"}, {"profile": "old"}, {"profile": "modern", "x": 1}):
        r = _post(env, doc_id, "reprocess", json=body)
        assert r.status_code == 422, body
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
    assert _audit_new(env, doc_id, "DOCUMENT_REPROCESS_REQUEST") == []


def test_survey_records_have_no_profile_to_switch(env, jobs):  # noqa: F811
    r = _up(env, "k.png", png() + b"LSMOCK:Doc1", land_id="LP-10100", document_type="KHATIAN")
    assert r.status_code == 201
    doc_id = r.json()["id"]
    assert _process(env, doc_id).status_code == 202
    status = _row(env, doc_id).processing_status
    r = _post(env, doc_id, "reprocess", json={"profile": "historical"})
    assert r.status_code == 422 and r.json()["code"] == "PROFILE_NOT_APPLICABLE"
    assert _row(env, doc_id).processing_status == status
    assert _post(env, doc_id, "reprocess").status_code == 202  # a plain reprocess still works


def test_switch_needs_review_rights(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    body = {"profile": "historical"}
    assert _post(env, doc_id, "reprocess", role="CITIZEN", json=body).status_code == 403
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
