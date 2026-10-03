from datetime import date, timedelta

import pytest
from ai.extraction.base import EXTRACTION_FIELDS
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.document import Document
from app.schemas.extraction import ExtractedField
from app.services.extraction import validate_fields
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_lands import FORBIDDEN_KEYS, _h, _keys, env  # noqa: F401
from tests.test_processing import _process, _row, _upload, jobs  # noqa: F401

EX = "/api/v1/documents/{}/extraction"


def _ready(env, marker=b"Doc1") -> str:
    doc = _upload(env, marker)
    assert _process(env, doc["id"]).status_code == 202
    return doc["id"]


def _get(env, doc_id, role="REVIEWER"):
    return env.get(EX.format(doc_id), headers=_h(env, role))


def _patch(env, doc_id, edits: dict, role="REVIEWER"):
    body = {"fields": [{"field": k, "value": v} for k, v in edits.items()]}
    return env.patch(EX.format(doc_id), json=body, headers=_h(env, role))


def _by(out: dict) -> dict:
    return {f["field"]: f for f in out["fields"]}


def test_process_ends_in_review_required_with_all_fields(env, jobs):
    doc_id = _ready(env)
    row = _row(env, doc_id)
    assert row.processing_status == "REVIEW_REQUIRED"
    assert [f["field"] for f in row.extraction_json["fields"]] == list(EXTRACTION_FIELDS)
    assert row.extraction_json["edited_by_human"] is False


def test_get_extraction_flags_low_confidence_by_threshold(env, jobs):
    out = _get(env, _ready(env)).json()
    assert out["threshold"] == 0.85 and out["provider"] == "mock"
    f = _by(out)
    assert out["has_low_confidence"] == bool(out["low_confidence_fields"])
    for name, item in f.items():
        assert item["low_confidence"] == (item["confidence"] < 0.85), name
    # fields absent from the fixture come back as null / confidence 0 -> flagged
    absent = [n for n, i in f.items() if i["value"] is None]
    assert all(f[n]["low_confidence"] for n in absent)
    assert out["original_fields"] is None and out["edited_by_human"] is False


def test_threshold_comes_from_settings(env, jobs):
    doc_id = _ready(env)
    env.app.state.settings.review_conf_threshold = 0.999
    out = _get(env, doc_id).json()
    assert all(i["low_confidence"] for i in out["fields"])  # nothing reaches 0.999
    env.app.state.settings.review_conf_threshold = 0.0
    assert _get(env, doc_id).json()["has_low_confidence"] is False


def test_get_reports_required_fields_and_valid_flag(env, jobs):
    out = _get(env, _ready(env)).json()
    errs = {(e["field"], e["code"]) for e in out["validation"]["errors"]}
    assert out["validation"]["valid"] == (not errs)
    f = _by(out)
    missing = {n for n in ("khatian_no", "dag_no", "mouza", "district", "upazila", "deed_no",
                           "seller", "buyer", "land_area", "area_unit") if f[n]["value"] is None}
    assert {n for n, c in errs if c == "REQUIRED"} == missing


def test_patch_edits_keep_original_and_mark_edited(env, jobs):
    doc_id = _ready(env, b"AreaMismatch")
    before = _by(_get(env, doc_id).json())
    r = _patch(env, doc_id, {"land_area": "10", "seller": "  Rahim   Uddin "})
    assert r.status_code == 200
    out = r.json()
    f = _by(out)
    assert f["land_area"]["value"] == "10" and f["land_area"]["edited_by_human"] is True
    assert f["seller"]["value"] == "Rahim Uddin"  # whitespace collapsed
    assert f["land_area"]["confidence"] == before["land_area"]["confidence"]  # untouched
    assert out["edited_by_human"] is True
    orig = {i["field"]: i["value"] for i in out["original_fields"]}
    assert orig["land_area"] == before["land_area"]["value"] == "12"
    # persisted + original survives a second edit
    _patch(env, doc_id, {"land_area": "11"})
    again = _get(env, doc_id).json()
    assert {i["field"]: i["value"] for i in again["original_fields"]}["land_area"] == "12"
    assert _row(env, doc_id).extraction_json["edited_by_human"] is True


def test_edit_clears_low_confidence_flag_and_revert_unmarks(env, jobs):
    doc_id = _ready(env, b"AreaMismatch")  # land_area conf 0.88 -> raise threshold to flag it
    env.app.state.settings.review_conf_threshold = 0.9
    assert "land_area" in _get(env, doc_id).json()["low_confidence_fields"]
    out = _patch(env, doc_id, {"land_area": "10"}).json()
    assert "land_area" not in out["low_confidence_fields"]
    out = _patch(env, doc_id, {"land_area": "12"}).json()  # back to the machine value
    assert _by(out)["land_area"]["edited_by_human"] is False and out["edited_by_human"] is False


def test_patch_noop_changes_nothing_and_logs_nothing(env, jobs):
    doc_id = _ready(env)
    value = _by(_get(env, doc_id).json())["seller"]["value"]
    r = _patch(env, doc_id, {"seller": value})
    assert r.status_code == 200 and r.json()["edited_by_human"] is False
    with _db(env) as s:
        n = s.scalars(select(AuditLog).where(AuditLog.action == "DOCUMENT_EXTRACTION_EDIT")).all()
    assert n == []


def test_patch_audit_records_only_changed_fields(env, jobs):
    doc_id = _ready(env)
    old = _by(_get(env, doc_id).json())["buyer"]["value"]
    seller = _by(_get(env, doc_id).json())["seller"]["value"]
    _patch(env, doc_id, {"buyer": "Hasan Ali", "seller": seller})
    with _db(env) as s:
        log = s.scalar(select(AuditLog).where(AuditLog.action == "DOCUMENT_EXTRACTION_EDIT"))
    assert log.entity_id == doc_id and log.actor_id is not None
    assert log.old_value == {"fields": {"buyer": old}}
    assert log.new_value == {"fields": {"buyer": "Hasan Ali"}}


@pytest.mark.parametrize(
    ("edit", "code"),
    [
        ({"land_area": "abc"}, "NOT_A_NUMBER"),
        ({"land_area": "NaN"}, "NOT_A_NUMBER"),
        ({"land_area": "inf"}, "NOT_A_NUMBER"),
        ({"land_area": "0"}, "NOT_POSITIVE"),
        ({"land_area": "-5"}, "NOT_POSITIVE"),
        ({"deed_date": "not a date"}, "INVALID_DATE"),
        ({"deed_date": "2024-13-45"}, "INVALID_DATE"),
        ({"deed_date": (date.today() + timedelta(days=1)).isoformat()}, "DATE_IN_FUTURE"),
        ({"area_unit": "furlong"}, "INVALID_UNIT"),
        ({"nope": "x"}, "UNKNOWN_FIELD"),
        ({"seller": "x" * 201}, "TOO_LONG"),
    ],
)
def test_patch_rejects_invalid_values_with_field_errors(env, jobs, edit, code):
    doc_id = _ready(env)
    before = _row(env, doc_id).extraction_json
    r = _patch(env, doc_id, edit)
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "EXTRACTION_VALIDATION_FAILED"
    assert body["details"] == [
        {"field": next(iter(edit)), "code": code, **({"params": body["details"][0]["params"]}
                                                    if "params" in body["details"][0] else {})}
    ]
    assert _row(env, doc_id).extraction_json == before  # nothing saved


def test_patch_collects_every_field_error_and_saves_none(env, jobs):
    doc_id = _ready(env)
    before = _row(env, doc_id).extraction_json
    r = _patch(env, doc_id, {"land_area": "-1", "deed_date": "2999-01-01", "seller": "Ok Name"})
    got = {(d["field"], d["code"]) for d in r.json()["details"]}
    assert r.status_code == 422
    assert got == {("land_area", "NOT_POSITIVE"), ("deed_date", "DATE_IN_FUTURE")}
    assert _row(env, doc_id).extraction_json == before  # valid sibling edit not applied either


def test_patch_duplicate_field_rejected(env, jobs):
    r = env.patch(
        EX.format(_ready(env)),
        json={"fields": [{"field": "seller", "value": "A"}, {"field": "seller", "value": "B"}]},
        headers=_h(env, "REVIEWER"),
    )
    assert r.status_code == 422
    assert r.json()["details"] == [{"field": "seller", "code": "DUPLICATE_FIELD"}]


def test_patch_normalises_bangla_digits_unit_and_date(env, jobs):
    doc_id = _ready(env)
    out = _patch(
        env, doc_id,
        {
            "land_area": "১২.৫", "khatian_no": "১২৪৫",
            "area_unit": " Decimal ", "deed_date": "১২/০২/২০২৪",
        },
    ).json()
    f = _by(out)
    assert (f["land_area"]["value"], f["khatian_no"]["value"]) == ("12.5", "1245")
    assert (f["area_unit"]["value"], f["deed_date"]["value"]) == ("decimal", "2024-02-12")


def test_filling_all_required_fields_makes_extraction_valid(env, jobs):
    doc_id = _ready(env, b"Doc2")
    out = _patch(env, doc_id, {
        "khatian_no": "1245", "dag_no": "785", "mouza": "Barmi", "district": "Gazipur",
        "upazila": "Sreepur", "land_area": "10", "area_unit": "decimal", "deed_no": "D-1",
        "seller": "Rahim Uddin", "buyer": "Hasan Ali",
    }).json()
    assert out["validation"] == {"valid": True, "errors": []}
    cleared = _patch(env, doc_id, {"buyer": "   "}).json()  # blank -> null -> REQUIRED again
    assert _by(cleared)["buyer"]["value"] is None
    errors = cleared["validation"]["errors"]
    assert errors == [{"field": "buyer", "code": "REQUIRED", "params": None}]


def test_validate_fields_unit_rules():
    today = date(2026, 1, 1)
    ok = [ExtractedField(field="deed_date", value="2026-01-01"),
          ExtractedField(field="land_area", value="0.5")]
    assert [e.code for e in validate_fields(ok, today) if e.code != "REQUIRED"] == []
    bad = [ExtractedField(field="deed_date", value="2026-01-02")]
    codes = [e.code for e in validate_fields(bad, today) if e.code != "REQUIRED"]
    assert codes == ["DATE_IN_FUTURE"]


def test_patch_blocked_unless_awaiting_review(env, jobs):
    doc_id = _ready(env)
    with _db(env) as s:
        s.get(Document, doc_id).processing_status = "APPROVED"
        s.commit()
    r = _patch(env, doc_id, {"seller": "Someone"})
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_EDITABLE"
    assert r.json()["details"] == {"status": "APPROVED"}
    assert _get(env, doc_id).status_code == 200  # still readable


def test_extraction_not_ready_before_processing_and_after_failure(env, jobs):
    uploaded = _upload(env, b"Doc1")
    r = _get(env, uploaded["id"])
    assert r.status_code == 409 and r.json()["code"] == "EXTRACTION_NOT_READY"
    assert r.json()["details"] == {"status": "UPLOADED"}
    failed = _upload(env, None)
    _process(env, failed["id"])  # NO_MOCK_FIXTURE -> FAILED, no extraction_json
    r = _get(env, failed["id"])
    assert r.status_code == 409 and r.json()["details"] == {"status": "FAILED"}
    assert _patch(env, failed["id"], {"seller": "x"}).status_code == 409


def test_extraction_404_and_auth(env, jobs):
    assert _get(env, "missing").status_code == 404
    assert _get(env, "missing").json()["code"] == "DOCUMENT_NOT_FOUND"
    assert _patch(env, "missing", {"seller": "x"}).status_code == 404
    doc_id = _ready(env)
    assert env.get(EX.format(doc_id)).status_code == 401
    body = {"fields": [{"field": "seller", "value": "x"}]}
    assert env.patch(EX.format(doc_id), json=body).status_code == 401


@pytest.mark.parametrize("role", ["CITIZEN"])
def test_citizen_forbidden(env, jobs, role):
    doc_id = _ready(env)
    assert _get(env, doc_id, role).status_code == 403
    assert _patch(env, doc_id, {"seller": "x"}, role).status_code == 403
    assert _row(env, doc_id).extraction_json["edited_by_human"] is False


@pytest.mark.parametrize("role", ["REVIEWER", "OFFICER", "ADMIN"])
def test_reviewer_up_can_read_and_edit(env, jobs, role):
    doc_id = _ready(env)
    assert _get(env, doc_id, role).status_code == 200
    assert _patch(env, doc_id, {"seller": f"By {role}"}, role).status_code == 200


def test_patch_empty_or_oversized_body_rejected(env, jobs):
    doc_id = _ready(env)
    h = _h(env, "REVIEWER")
    assert env.patch(EX.format(doc_id), json={"fields": []}, headers=h).status_code == 422
    assert env.patch(EX.format(doc_id), json={}, headers=h).status_code == 422
    too_many = {"fields": [{"field": "seller", "value": "x"}] * 14}
    assert env.patch(EX.format(doc_id), json=too_many, headers=h).status_code == 422


def test_extraction_response_never_leaks_internal_keys(env, jobs, store):
    doc_id = _ready(env)
    for resp in (_get(env, doc_id), _patch(env, doc_id, {"seller": "Edited Name"})):
        leaked = FORBIDDEN_KEYS - {"id"}
        assert not (set(_keys(resp.json())) & leaked)
        assert "file_path" not in resp.text and str(store) not in resp.text
