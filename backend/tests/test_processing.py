import ai.mock_fixtures as mf
import pytest
from ai.extraction.base import EXTRACTION_FIELDS
from ai.extraction.mock import MockDocumentAIProvider
from ai.ocr.base import OCRResult, ProviderError
from ai.ocr.mock import MockOCRProvider
from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api.v1.documents import get_session_factory
from app.core.config import Settings
from app.core.errors import AppError
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.user import User
from app.services import processing
from app.services.providers import Providers, get_providers
from app.services.storage import LocalStorage
from app.workers.jobs import BackgroundTasksRunner, InlineRunner
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401

PROC = "/api/v1/documents/{}/process"


@pytest.fixture
def jobs(env, store):  # noqa: F811
    with _db(env) as s:
        maker = sessionmaker(bind=s.get_bind(), expire_on_commit=False)
    env.app.dependency_overrides[get_session_factory] = lambda: maker
    return maker


def _upload(env, marker: bytes | None, role="OFFICER") -> dict:
    data = png() + (b"LSMOCK:" + marker if marker else b"no-fixture")
    r = _up(env, "scan.png", data, role)
    assert r.status_code == 201
    return r.json()


def _process(env, doc_id, role="OFFICER"):
    return env.post(PROC.format(doc_id), headers=_h(env, role))


def _row(env, doc_id) -> Document:
    with _db(env) as s:
        return s.get(Document, doc_id)


def _actions(env, doc_id) -> list[str]:
    with _db(env) as s:
        rows = s.scalars(
            select(AuditLog).where(AuditLog.entity_id == doc_id).order_by(AuditLog.created_at)
        ).all()
    return [r.action for r in rows]


def test_upload_process_extracted_end_to_end(env, jobs):
    doc = _upload(env, b"Doc1")
    r = _process(env, doc["id"])
    assert r.status_code == 202
    assert r.json()["processing_status"] == "PROCESSING" and "file_path" not in r.json()
    got = env.get(f"/api/v1/documents/{doc['id']}", headers=_h(env, "REVIEWER"))
    assert got.json()["processing_status"] == "REVIEW_REQUIRED"
    row = _row(env, doc["id"])
    assert row.ocr_text.startswith("Deed of Sale") and row.ocr_confidence == 0.93
    ex = row.extraction_json
    assert ex["provider"] == "mock"
    fields = {f["field"]: f for f in ex["fields"]}
    assert tuple(fields) == EXTRACTION_FIELDS
    assert fields["seller"]["value"] == "Rahim Uddin" and fields["buyer"]["value"] == "Karim Mia"
    assert fields["dag_no"]["value"] == "785" and fields["khatian_no"]["value"] == "1245"
    assert _actions(env, doc["id"]) == ["DOCUMENT_UPLOAD", "DOCUMENT_PROCESS", "DOCUMENT_EXTRACTED"]


def test_doc2_has_different_buyer(env, jobs):
    doc = _upload(env, b"Doc2")
    _process(env, doc["id"])
    fields = {f["field"]: f["value"] for f in _row(env, doc["id"]).extraction_json["fields"]}
    assert fields["buyer"] == "Hasan Ali" and fields["seller"] == "Rahim Uddin"


def test_missing_fixture_fails(env, jobs):
    doc = _upload(env, None)
    assert _process(env, doc["id"]).status_code == 202
    row = _row(env, doc["id"])
    assert row.processing_status == "FAILED" and row.extraction_json is None
    assert row.ocr_text is None
    with _db(env) as s:
        log = s.scalar(select(AuditLog).where(AuditLog.action == "DOCUMENT_PROCESS_FAILED"))
    assert log.new_value["error"] == "NO_MOCK_FIXTURE" and log.actor_id is None


class _Boom:
    name = "boom"

    def recognize(self, data, file_type):
        raise RuntimeError("secret internal detail")

    def extract(self, data, ocr):  # pragma: no cover - never reached
        raise AssertionError


def _start(env, doc_id):
    with _db(env) as s:
        officer = s.scalar(select(User).where(User.role == "OFFICER"))
        processing.start_processing(s, officer, doc_id, None)


def test_unexpected_provider_error_becomes_failed(env, jobs, store):
    doc = _upload(env, b"Doc1")
    _start(env, doc["id"])
    assert _row(env, doc["id"]).processing_status == "PROCESSING"
    boom = Providers(ocr=_Boom(), ai=MockDocumentAIProvider())
    # must not raise
    processing.run_processing(jobs, LocalStorage(store), boom, doc["id"])
    assert _row(env, doc["id"]).processing_status == "FAILED"
    with _db(env) as s:
        log = s.scalar(select(AuditLog).where(AuditLog.action == "DOCUMENT_PROCESS_FAILED"))
    assert log.new_value["error"] == "PROCESSING_ERROR"
    assert "secret" not in str(log.new_value)  # exception text is never stored


def test_missing_stored_file_becomes_failed(env, jobs, store):
    doc = _upload(env, b"Doc1")
    for f in _files(store):
        f.unlink()
    assert _process(env, doc["id"]).status_code == 202
    assert _row(env, doc["id"]).processing_status == "FAILED"


def test_run_processing_ignores_non_processing_documents(env, jobs, store):
    doc = _upload(env, b"Doc1")  # still UPLOADED
    providers = Providers(ocr=MockOCRProvider(), ai=MockDocumentAIProvider())
    processing.run_processing(jobs, LocalStorage(store), providers, doc["id"])
    processing.run_processing(jobs, LocalStorage(store), providers, "missing-id")
    assert _row(env, doc["id"]).processing_status == "UPLOADED"


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER"])
def test_process_forbidden_roles(env, jobs, role):
    doc = _upload(env, b"Doc1")
    assert _process(env, doc["id"], role).status_code == 403
    assert _row(env, doc["id"]).processing_status == "UPLOADED"


def test_process_requires_auth_and_404(env, jobs):
    doc = _upload(env, b"Doc1")
    assert env.post(PROC.format(doc["id"])).status_code == 401
    r = _process(env, "does-not-exist")
    assert r.status_code == 404 and r.json()["code"] == "DOCUMENT_NOT_FOUND"


def test_process_twice_conflicts(env, jobs):
    doc = _upload(env, b"Doc1")
    assert _process(env, doc["id"], "ADMIN").status_code == 202
    r = _process(env, doc["id"])
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_PROCESSABLE"
    assert r.json()["details"] == {"status": "REVIEW_REQUIRED"}


@pytest.mark.parametrize(
    ("ocr", "code"), [("paddle", "PROVIDER_NOT_AVAILABLE"), ("bogus", "PROVIDER_UNKNOWN")]
)
def test_unavailable_provider_503_leaves_document_untouched(env, jobs, ocr, code):
    doc = _upload(env, b"Doc1")
    env.app.state.settings.ocr_provider = ocr
    r = _process(env, doc["id"])
    assert r.status_code == 503 and r.json()["code"] == code
    assert _row(env, doc["id"]).processing_status == "UPLOADED"


def test_env_switching_in_get_providers():
    mk = lambda **kw: Settings(_env_file=None, **kw)  # noqa: E731
    p = get_providers(mk(ocr_provider=" Mock ", document_ai_provider="MOCK"))
    assert p.ocr.name == "mock" and p.ai.name == "mock"
    for kw in ({"ocr_provider": "paddle"}, {"document_ai_provider": "vlm"}):
        with pytest.raises(AppError) as e:
            get_providers(mk(**kw))
        assert e.value.code == "PROVIDER_NOT_AVAILABLE" and e.value.status_code == 503
    with pytest.raises(AppError) as e:
        get_providers(mk(document_ai_provider="nope"))
    assert e.value.code == "PROVIDER_UNKNOWN"


def test_job_runners():
    calls = []
    InlineRunner().submit(lambda a, b=0: calls.append((a, b)), 1, b=2)
    assert calls == [(1, 2)]
    tasks = BackgroundTasks()
    BackgroundTasksRunner(tasks).submit(calls.append, "later")
    assert len(tasks.tasks) == 1 and calls == [(1, 2)]  # queued, not run yet


def test_mock_fixture_lookup_by_hash_and_marker(monkeypatch):
    data = b"hash-keyed bytes"
    fx = {"ocr_text": "t", "ocr_confidence": 0.5, "fields": {"seller": ["Rahim Uddin", 0.9]}}
    monkeypatch.setattr(
        mf, "load_fixtures", lambda: {"by_hash": {mf.hashlib.sha256(data).hexdigest(): fx}}
    )
    ocr = MockOCRProvider().recognize(data, "png")
    assert (ocr.text, ocr.confidence, ocr.provider) == ("t", 0.5, "mock")
    res = MockDocumentAIProvider().extract(data, ocr)
    by = {f.field: f for f in res.fields}
    assert by["seller"].value == "Rahim Uddin" and by["seller"].confidence == 0.9
    assert by["buyer"].value is None and by["buyer"].confidence == 0.0  # absent -> low confidence
    assert len(res.fields) == len(EXTRACTION_FIELDS)
    with pytest.raises(ProviderError) as e:
        MockOCRProvider().recognize(b"other", "png")
    assert e.value.code == "NO_MOCK_FIXTURE"


def test_mock_marker_fixtures_cover_demo_docs():
    fx = mf.load_fixtures()["by_marker"]
    assert {"Doc1", "Doc2", "AreaMismatch", "SellerMismatch"} <= set(fx)
    assert isinstance(OCRResult(text="x", confidence=1.0, provider="mock"), OCRResult)
