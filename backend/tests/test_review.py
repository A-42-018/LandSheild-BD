import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _get, _patch, _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import _actions, _row, _upload, jobs  # noqa: F401

D = "/api/v1/documents/{}/"


def _post(env, doc_id, action, role="REVIEWER", json=None):
    return env.post(D.format(doc_id) + action, headers=_h(env, role), json=json)


def _fill(env, doc_id):
    """Make Doc1 valid: fill any required field the mock left empty."""
    out = _get(env, doc_id).json()
    fill = {
        "khatian_no": "501", "dag_no": "101", "mouza": "Ashulia", "district": "Dhaka",
        "upazila": "Savar", "land_area": "15", "area_unit": "decimal", "deed_no": "D-1",
        "seller": "A", "buyer": "B",
    }  # fmt: skip
    missing = {
        f["field"]: fill[f["field"]]
        for f in out["fields"]
        if f["field"] in fill and not f["value"]
    }
    if missing:
        assert _patch(env, doc_id, missing).status_code == 200
    return _get(env, doc_id).json()


def _invalidate(env, doc_id):
    assert _patch(env, doc_id, {"seller": None}).status_code == 200
    assert _get(env, doc_id).json()["validation"]["valid"] is False


def test_approve_valid_sets_approved_and_audits(env, jobs):
    doc_id = _ready(env)
    assert _fill(env, doc_id)["validation"]["valid"] is True
    r = _post(env, doc_id, "approve")
    assert r.status_code == 200 and r.json()["processing_status"] == "APPROVED"
    assert _row(env, doc_id).processing_status == "APPROVED"
    assert "DOCUMENT_APPROVE" in _actions(env, doc_id)
    assert "file_path" not in r.text


def test_approve_blocked_when_invalid_and_nothing_changes(env, jobs):
    doc_id = _ready(env)
    _fill(env, doc_id)
    _invalidate(env, doc_id)
    r = _post(env, doc_id, "approve")
    assert r.status_code == 422 and r.json()["code"] == "EXTRACTION_INVALID"
    assert {"field": "seller", "code": "REQUIRED"} in r.json()["details"]
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
    assert "DOCUMENT_APPROVE" not in _actions(env, doc_id)


def test_approve_twice_conflicts(env, jobs):
    doc_id = _ready(env)
    _fill(env, doc_id)
    assert _post(env, doc_id, "approve").status_code == 200
    r = _post(env, doc_id, "approve")
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_REVIEWABLE"
    assert r.json()["details"] == {"status": "APPROVED"}
    assert _patch(env, doc_id, {"mouza": "X"}).status_code == 409  # locked after approval


def test_reject_requires_reason_and_stores_it_in_audit(env, jobs):
    doc_id = _ready(env)
    for bad in ({}, {"reason": ""}, {"reason": "   "}, {"reason": "x" * 501}):
        r = _post(env, doc_id, "reject", json=bad)
        assert r.status_code == 422, bad
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
    r = _post(env, doc_id, "reject", json={"reason": "  Blurry   scan "})
    assert r.status_code == 200 and r.json()["processing_status"] == "REJECTED"
    with _db(env) as s:
        row = s.scalars(select(AuditLog).where(AuditLog.action == "DOCUMENT_REJECT")).one()
    assert row.new_value == {"status": "REJECTED", "reason": "Blurry scan"}
    assert _post(env, doc_id, "reject", json={"reason": "again"}).status_code == 409


def test_reject_works_even_when_invalid(env, jobs):
    doc_id = _ready(env)
    _fill(env, doc_id)
    _invalidate(env, doc_id)
    assert _post(env, doc_id, "reject", json={"reason": "unreadable"}).status_code == 200


def test_reprocess_requeues_and_discards_edits(env, jobs):
    doc_id = _ready(env)
    assert _patch(env, doc_id, {"mouza": "Edited"}).status_code == 200
    r = _post(env, doc_id, "reprocess")
    assert r.status_code == 202
    row = _row(env, doc_id)
    assert row.processing_status == "REVIEW_REQUIRED"  # job ran after response (TestClient)
    assert row.extraction_json["edited_by_human"] is False
    assert "DOCUMENT_REPROCESS_REQUEST" in _actions(env, doc_id)


def test_reprocess_not_allowed_after_decision(env, jobs):
    doc_id = _ready(env)
    assert _post(env, doc_id, "reject", json={"reason": "bad"}).status_code == 200
    r = _post(env, doc_id, "reprocess")
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_REPROCESSABLE"


def test_reprocess_failed_document(env, jobs):
    doc = _upload(env, None)  # no mock fixture -> FAILED
    r = env.post(f"/api/v1/documents/{doc['id']}/process", headers=_h(env, "OFFICER"))
    assert r.status_code == 202
    assert _row(env, doc["id"]).processing_status == "FAILED"
    assert _post(env, doc["id"], "reprocess").status_code == 202
    assert _row(env, doc["id"]).processing_status == "FAILED"  # still no fixture, ends FAILED again


@pytest.mark.parametrize(
    "action,body", [("approve", None), ("reject", {"reason": "x"}), ("reprocess", None)]
)
def test_permissions_and_not_found(env, jobs, action, body):
    doc_id = _ready(env)
    assert _post(env, doc_id, action, role="CITIZEN", json=body).status_code == 403
    assert env.post(D.format(doc_id) + action, json=body).status_code == 401
    r = _post(env, "00000000-0000-0000-0000-000000000000", action, json=body)
    assert r.status_code == 404 and r.json()["code"] == "DOCUMENT_NOT_FOUND"
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"


def test_not_ready_document_cannot_be_approved(env, jobs):
    doc = _upload(env, b"Doc1")  # UPLOADED, never processed
    r = _post(env, doc["id"], "approve")
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_REVIEWABLE"
