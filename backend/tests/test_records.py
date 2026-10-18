# ruff: noqa: E501, F811
"""H5: storage, API and permanent keeping of the digital record.

Profile detection reaches the API, nested LHDR PATCH (replace / add / remove by JSON pointer, flat
edits written into the record), versions (MACHINE -> DRAFT -> APPROVED -> SUPERSEDED), approval
freezes + Ed25519 signature, corrections after approval, and the original file stays readable and
unchanged throughout.
"""
import hashlib

import pytest
from ai.extraction.historical_deed import HistoricalDeedProvider
from ai.extraction.mock import MockDocumentAIProvider
from sqlalchemy import func, select

from app.api.v1.documents import get_job_providers
from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.document_record import DocumentRecord
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.services.providers import Providers
from tests.test_documents import _db, png, store  # noqa: F401
from tests.test_extraction import _get, _patch, _ready
from tests.test_historical_deed import _TextOCR
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import _process, _row, _up, jobs  # noqa: F401
from tests.test_review import _fill, _post

D = "/api/v1/documents/{}"


def _historical(env, jobs) -> str:  # noqa: F811
    """Upload + process a deed read as the sample historical deed (rules only, no API key)."""
    providers = Providers(_TextOCR(), MockDocumentAIProvider(), HistoricalDeedProvider())
    env.app.dependency_overrides[get_job_providers] = lambda: providers
    r = _up(env, "deed.png", png() + b"H5-historical")
    assert r.status_code == 201
    doc_id = r.json()["id"]
    assert _process(env, doc_id).status_code == 202  # TestClient runs the job after the response
    return doc_id


def _rec(env, doc_id, ops, role="REVIEWER", fields=None):
    body = {"record": ops, **({"fields": [{"field": k, "value": v} for k, v in fields.items()]} if fields else {})}
    return env.patch(D.format(doc_id) + "/extraction", json=body, headers=_h(env, role))


def _versions(env, doc_id, role="REVIEWER", headers=None) -> list[dict]:
    r = env.get(D.format(doc_id) + "/records", headers=headers or _h(env, role))
    assert r.status_code == 200, r.text
    return r.json()["items"]


def _version(env, doc_id, v, role="REVIEWER") -> dict:
    r = env.get(D.format(doc_id) + f"/records/{v}", headers=_h(env, role))
    assert r.status_code == 200, r.text
    return r.json()


def _by(out: dict) -> dict:
    return {f["field"]: f["value"] for f in out["fields"]}


def _rows(env, doc_id) -> list[DocumentRecord]:
    with _db(env) as s:
        return list(s.scalars(select(DocumentRecord).where(DocumentRecord.document_id == doc_id).order_by(DocumentRecord.version)))


def _approve_historical(env, doc_id):
    r = _post(env, doc_id, "approve")
    assert r.status_code == 200, r.text
    return r


# ---- profile + record in the API, machine version -----------------------------------------------

def test_historical_profile_record_and_machine_version_reach_the_api(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    out = _get(env, doc_id).json()
    assert out["deed_profile"] == "historical" and out["record_schema"] == "lhdr/1"
    assert out["record"]["schedule"][0]["mouza"]["value"] == "ভবানীপুর"
    assert out["record_validation"]["valid"] is True, out["record_validation"]
    assert out["file_hash"] == _row(env, doc_id).file_hash
    assert (out["version"], out["version_status"]) == (1, "MACHINE")
    (v1,) = _versions(env, doc_id)
    assert v1["status"] == "MACHINE" and v1["record_schema"] == "lhdr/1" and v1["created_by"] is None
    assert v1["signature_status"] == "UNSIGNED" and v1["record"] is None  # the list leaves the record out
    full = _version(env, doc_id, 1)
    assert full["record"]["core"]["khatian_no"] == "120" == _by(out)["khatian_no"]
    with _db(env) as s:
        new = s.scalar(select(AuditLog.new_value).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_EXTRACTED"))
    assert new["record_version"] == 1


def test_modern_deed_gets_a_core_version(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    out = _get(env, doc_id).json()
    assert out["record"] is None and out["record_validation"] is None
    (v1,) = _versions(env, doc_id)
    assert v1["status"] == "MACHINE" and v1["record_schema"] == "core/1"
    rec = _version(env, doc_id, 1)["record"]
    assert rec["schema"] == "core/1" and rec["document_type"] == "DEED"
    assert {f["field"]: f["value"] for f in rec["fields"]} == _by(out)


# ---- nested PATCH -------------------------------------------------------------------------------

def test_nested_patch_edits_the_record_and_opens_one_draft(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = _rec(env, doc_id, [{"path": "/schedule/0/boundaries/north", "value": " করিমের  জমি "}])
    assert r.status_code == 200, r.text
    out = r.json()
    north = out["record"]["schedule"][0]["boundaries"]["north"]
    assert north["value"] == "করিমের জমি" and north["method"] == "human" and north["edited_by_human"] is True
    assert out["edited_by_human"] is True and (out["version"], out["version_status"]) == (2, "DRAFT")
    r = _rec(env, doc_id, [{"path": "/registration/office", "value": "রূপগঞ্জ সাব-রেজিস্ট্রি অফিস"}])
    assert r.json()["version"] == 2  # later edits update the same DRAFT
    assert [v["status"] for v in _versions(env, doc_id)] == ["MACHINE", "DRAFT"]
    machine, draft = _version(env, doc_id, 1)["record"], _version(env, doc_id, 2)["record"]
    assert machine["schedule"][0]["boundaries"]["north"]["value"] == "আব্দুল করিমের জমি"  # v1 never changes
    assert draft["registration"]["office"]["value"] == "রূপগঞ্জ সাব-রেজিস্ট্রি অফিস"
    with _db(env) as s:
        logs = s.scalars(select(AuditLog).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_EXTRACTION_EDIT").order_by(AuditLog.created_at)).all()
    assert logs[0].old_value == {"record": [{"op": "replace", "path": "/schedule/0/boundaries/north", "old": "আব্দুল করিমের জমি"}]}
    assert logs[0].new_value == {"record": [{"op": "replace", "path": "/schedule/0/boundaries/north", "new": "করিমের জমি"}]}


def test_add_and_remove_list_items_and_the_core_fields_follow(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = _rec(env, doc_id, [
        {"op": "add", "path": "/execution/witnesses/-", "value": {"role": "WITNESS", "name": "আব্দুল হক", "father": {"name": "মৃত করিম"}}},
        {"op": "add", "path": "/schedule/-", "value": {"mouza": "চনপাড়া", "khatian_no": "77", "dag_no": ["12"], "area": {"value": 10, "unit": "decimal"}}},
        {"op": "add", "path": "/parties/0", "value": {"role": "SELLER", "name": "নতুন বিক্রেতা"}},
    ])
    assert r.status_code == 200, r.text
    out = r.json()
    w = out["record"]["execution"]["witnesses"][0]
    assert w["name"]["value"] == "আব্দুল হক" and w["father"]["name"]["edited_by_human"] is True
    assert len(out["record"]["schedule"]) == 2 and out["record"]["schedule"][1]["dag_no"][0]["value"] == "12"
    assert _by(out)["seller"] == "নতুন বিক্রেতা" and _by(out)["father_name"] is None  # the new first seller has no father
    edited = {f["field"] for f in out["fields"] if f["edited_by_human"]}
    assert {"seller", "owner_name", "father_name"} <= edited and "khatian_no" not in edited
    out = _rec(env, doc_id, [{"op": "remove", "path": "/parties/0"}, {"op": "remove", "path": "/execution/witnesses/0"}]).json()
    assert _by(out)["seller"] == "কফিল উদ্দিন" and _by(out)["father_name"] == "সমসের আলী"
    assert out["record"].get("execution", {}).get("witnesses", []) == []
    assert not any(f["edited_by_human"] for f in out["fields"])  # back to the machine values
    assert out["record"]["core"]["seller"] == "কফিল উদ্দিন"  # core (J) is derived again on every save


def test_flat_field_edits_are_written_into_the_record(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = _patch(env, doc_id, {"khatian_no": "১২১", "buyer": "রামকান্ত দাস", "deed_date": "1944-03-01", "land_area": "0.75"})
    assert r.status_code == 200, r.text
    out = r.json()
    rec = out["record"]
    assert rec["schedule"][0]["khatian_no"]["value"] == "121" and rec["schedule"][0]["khatian_no"]["method"] == "human"
    assert rec["parties"][1]["name"]["value"] == "রামকান্ত দাস"
    assert rec["schedule"][0]["area"]["value"]["value"] == 0.75
    ex_date = rec["dates"]["execution"]
    assert ex_date["verbatim"]["value"] == "১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ"  # as written: kept
    assert ex_date["gregorian_from"]["value"] == ex_date["gregorian_to"]["value"] == "1944-03-01"
    assert ex_date["precision"]["value"] == "day"
    by = _by(out)
    assert by["khatian_no"] == "121" and by["buyer"] == "রামকান্ত দাস" and by["land_area"] == "0.75"
    assert by["deed_date"] == "1944-03-01"
    with _db(env) as s:
        log = s.scalar(select(AuditLog).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_EXTRACTION_EDIT"))
    assert log.new_value["fields"]["khatian_no"] == "121" and log.old_value["fields"]["khatian_no"] == "120"
    paths = {c["path"] for c in log.new_value["record"]}
    assert {"/schedule/0/khatian_no", "/parties/1/name", "/schedule/0/area/value", "/dates/execution/gregorian_from"} <= paths


@pytest.mark.parametrize(
    ("ops", "code", "detail"),
    [
        ([{"path": "/nope", "value": 1}], "RECORD_PATCH_FAILED", "INVALID_PATH"),
        ([{"path": "/core/seller", "value": "x"}], "RECORD_PATCH_FAILED", "PATH_NOT_EDITABLE"),
        ([{"path": "/schema", "value": "lhdr/2"}], "RECORD_PATCH_FAILED", "PATH_NOT_EDITABLE"),
        ([{"path": "/schedule/0/area/value/confidence", "value": 1}], "RECORD_PATCH_FAILED", "PATH_NOT_EDITABLE"),
        ([{"path": "/parties/7/name", "value": "x"}], "RECORD_PATCH_FAILED", "NOT_FOUND"),
        ([{"path": "/parties/0/role", "value": "KING"}], "RECORD_PATCH_FAILED", "RECORD_INVALID"),
        ([{"op": "add", "path": "/registration/deed_no", "value": "1"}], "RECORD_PATCH_FAILED", "NOT_A_LIST"),
        ([{"path": "/schedule/0/area/value", "value": -1}], "RECORD_VALIDATION_FAILED", "AREA_NOT_POSITIVE"),
        ([{"path": "/schedule/0/khatian_no", "value": "এক শ বিশ"}], "RECORD_VALIDATION_FAILED", "NOT_NUMERIC"),
    ],
)
def test_bad_record_ops_are_refused_and_nothing_is_saved(env, jobs, ops, code, detail):  # noqa: F811
    doc_id = _historical(env, jobs)
    before = _row(env, doc_id).extraction_json
    r = _rec(env, doc_id, [{"path": "/registration/office", "value": "ok"}, *ops])  # the good first op is not kept either
    assert r.status_code == 422, r.text
    err = r.json()
    assert err["code"] == code
    assert err["details"][0]["code"] == detail
    if code == "RECORD_PATCH_FAILED":
        assert err["details"][0]["index"] == 1
    assert _row(env, doc_id).extraction_json == before
    assert [v["status"] for v in _versions(env, doc_id)] == ["MACHINE"]


def test_record_ops_on_a_document_without_a_record(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    r = _rec(env, doc_id, [{"path": "/registration/office", "value": "x"}])
    assert r.status_code == 422 and r.json()["code"] == "RECORD_NOT_AVAILABLE"


def test_patch_needs_a_field_or_an_op(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = env.patch(D.format(doc_id) + "/extraction", json={"fields": [], "record": []}, headers=_h(env, "REVIEWER"))
    assert r.status_code == 422


def test_no_op_patch_saves_nothing(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = _rec(env, doc_id, [{"path": "/schedule/0/mouza", "value": "ভবানীপুর"}])
    assert r.status_code == 200 and r.json()["version_status"] == "MACHINE"
    assert r.json()["record"]["schedule"][0]["mouza"]["method"] != "human"
    assert len(_versions(env, doc_id)) == 1


# ---- approval -----------------------------------------------------------------------------------

def test_approval_freezes_signs_and_links_the_deed(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    assert _rec(env, doc_id, [{"path": "/schedule/0/boundaries/east", "value": "বড় খাল"}]).status_code == 200
    _approve_historical(env, doc_id)
    v = _versions(env, doc_id)
    assert [x["status"] for x in v] == ["MACHINE", "APPROVED"]  # the DRAFT itself was frozen
    approved = v[1]
    assert approved["approved_by"] == "REVIEWER" and approved["approved_at"]
    assert len(approved["record_hash"]) == 64 and approved["signature"]
    assert approved["signature_status"] == "VALID" and approved["file_hash"] == _row(env, doc_id).file_hash
    full = _version(env, doc_id, 2)["record"]
    assert full["schedule"][0]["boundaries"]["east"]["value"] == "বড় খাল"
    assert full["core"] == {k: v for k, v in _by(_get(env, doc_id).json()).items() if v is not None}
    with _db(env) as s:
        deed = s.scalar(select(Deed).where(Deed.document_id == doc_id))
        row = s.scalar(select(DocumentRecord).where(DocumentRecord.document_id == doc_id, DocumentRecord.version == 2))
        approve = s.scalar(select(AuditLog.new_value).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_APPROVE"))
    assert deed.is_historical is True and deed.record_id == row.id
    assert approve["record_version"] == 2 and approve["record_hash"] == row.record_hash
    # editing a frozen row is refused through the API ...
    r = env.patch(D.format(doc_id) + "/records/2", json={"record": [{"path": "/registration/office", "value": "x"}]}, headers=_h(env, "REVIEWER"))
    assert r.status_code == 409 and r.json()["code"] == "RECORD_NOT_EDITABLE"
    assert _patch(env, doc_id, {"mouza": "x"}).status_code == 409  # the working copy is closed too


def test_changing_one_byte_of_a_frozen_record_breaks_its_signature(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    with _db(env) as s:
        row = s.scalar(select(DocumentRecord).where(DocumentRecord.document_id == doc_id, DocumentRecord.status == "APPROVED"))
        data = dict(row.record_json)
        data["registration"] = {**data["registration"], "deed_no": {**data["registration"]["deed_no"], "value": "4783/খ"}}
        row.record_json = data
        s.commit()
        version = row.version
    assert _version(env, doc_id, version)["signature_status"] == "INVALID"


def test_unedited_machine_output_is_approved_as_a_new_version(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    v = _versions(env, doc_id)
    assert [(x["version"], x["status"]) for x in v] == [(1, "MACHINE"), (2, "APPROVED")]
    assert v[1]["created_by"] == "REVIEWER" and v[1]["signature_status"] == "VALID"
    assert _version(env, doc_id, 1)["record"] == _version(env, doc_id, 2)["record"]


def test_record_errors_block_approval(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    out = _rec(env, doc_id, [{"op": "remove", "path": "/dates/execution/verbatim"}]).json()
    assert out["validation"]["valid"] is True  # the 13 flat fields are fine ...
    assert [e["code"] for e in out["record_validation"]["errors"]] == ["MISSING_EXECUTION_DATE"]  # ... the record is not
    r = _post(env, doc_id, "approve")
    assert r.status_code == 422 and r.json()["code"] == "RECORD_INVALID"
    assert r.json()["details"][0]["path"] == "/dates/execution/verbatim"
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
    assert "APPROVED" not in {v["status"] for v in _versions(env, doc_id)}


def test_modern_deed_approval_freezes_a_core_version(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    _fill(env, doc_id)
    assert _post(env, doc_id, "approve").status_code == 200
    v = _versions(env, doc_id)
    assert [x["status"] for x in v] == ["MACHINE", "APPROVED"] and v[1]["record_schema"] == "core/1"
    assert v[1]["signature_status"] == "VALID"
    with _db(env) as s:
        deed = s.scalar(select(Deed).where(Deed.document_id == doc_id))
    assert deed.is_historical is False and deed.record_id is not None


# ---- reprocess ----------------------------------------------------------------------------------

def test_reprocess_supersedes_the_open_versions(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    assert _rec(env, doc_id, [{"path": "/registration/office", "value": "x"}]).status_code == 200
    assert _post(env, doc_id, "reprocess").status_code == 202
    v = _versions(env, doc_id)
    assert [(x["version"], x["status"]) for x in v] == [(1, "SUPERSEDED"), (2, "SUPERSEDED"), (3, "MACHINE")]
    assert _get(env, doc_id).json()["version"] == 3
    assert _version(env, doc_id, 2)["record"]["registration"]["office"]["value"] == "x"  # discarded, still readable


# ---- corrections after approval -----------------------------------------------------------------

def _counts(env) -> tuple[int, int, int]:
    with _db(env) as s:
        return tuple(s.scalar(select(func.count()).select_from(m)) for m in (Deed, Transaction, Owner))


def test_correction_creates_a_new_version_and_supersedes_the_old(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    posted = _counts(env)
    rev, off = _h(env, "REVIEWER"), _h(env, "OFFICER")
    r = env.post(D.format(doc_id) + "/records", headers=rev)
    assert r.status_code == 201, r.text
    draft = r.json()
    assert (draft["version"], draft["status"], draft["created_by"]) == (3, "DRAFT", "REVIEWER")
    again = env.post(D.format(doc_id) + "/records", headers=off)
    assert again.status_code == 200 and again.json()["version"] == 3  # one open correction at a time

    assert env.post(D.format(doc_id) + "/records/3/approve", headers=off).json()["code"] == "RECORD_UNCHANGED"
    r = env.patch(D.format(doc_id) + "/records/3", headers=rev, json={
        "record": [{"path": "/schedule/0/boundaries/west", "value": "রহিম শেখের বাগান"}],
        "fields": [{"field": "dag_no", "value": "456"}],
    })
    assert r.status_code == 200, r.text
    assert r.json()["record"]["schedule"][0]["dag_no"][0]["value"] == "456"
    assert env.get(D.format(doc_id) + '/extraction', headers=rev).json()["record"]["schedule"][0]["boundaries"]["west"]["value"] == "রহিম সেখের জমি"  # not live yet

    r = env.post(D.format(doc_id) + "/records/3/approve", headers=rev)
    assert r.status_code == 403 and r.json()["code"] == "SELF_APPROVAL_FORBIDDEN"  # four-eyes
    r = env.post(D.format(doc_id) + "/records/3/approve", headers=off)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "APPROVED" and r.json()["approved_by"] == "OFFICER"

    v = _versions(env, doc_id, headers=rev)
    assert [(x["version"], x["status"]) for x in v] == [(1, "MACHINE"), (2, "SUPERSEDED"), (3, "APPROVED")]
    assert v[1]["signature_status"] == "VALID" and v[2]["signature_status"] == "VALID"  # history stays verifiable
    assert v[1]["record_hash"] != v[2]["record_hash"]
    out = env.get(D.format(doc_id) + '/extraction', headers=rev).json()
    assert out["processing_status"] == "APPROVED" and _by(out)["dag_no"] == "456"
    assert out["record"]["schedule"][0]["boundaries"]["west"]["value"] == "রহিম শেখের বাগান"
    with _db(env) as s:
        deed = s.scalar(select(Deed).where(Deed.document_id == doc_id))
        v3 = s.scalar(select(DocumentRecord.id).where(DocumentRecord.document_id == doc_id, DocumentRecord.version == 3))
        actions = [a for (a,) in s.execute(select(AuditLog.action).where(AuditLog.entity_id == doc_id).order_by(AuditLog.created_at))]
    assert deed.record_id == v3
    assert _counts(env) == posted  # a correction never re-posts ownership (D2)
    assert actions[-3:] == ["DOCUMENT_RECORD_CORRECTION_START", "DOCUMENT_RECORD_EDIT", "DOCUMENT_RECORD_APPROVE"]

    r = env.patch(D.format(doc_id) + "/records/3", headers=rev, json={"fields": [{"field": "mouza", "value": "x"}]})
    assert r.status_code == 409  # frozen


def test_correction_needs_an_approved_document(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = env.post(D.format(doc_id) + "/records", headers=_h(env, "REVIEWER"))
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_APPROVED"


def test_document_approved_before_h5_gets_a_signed_baseline(env, jobs):  # noqa: F811
    doc_id = _ready(env)
    _fill(env, doc_id)
    assert _post(env, doc_id, "approve").status_code == 200
    with _db(env) as s:  # as if approved before H5: no versions
        s.query(Deed).filter(Deed.document_id == doc_id).update({"record_id": None})
        s.query(DocumentRecord).filter(DocumentRecord.document_id == doc_id).delete()
        s.commit()
    assert _versions(env, doc_id) == []
    r = env.post(D.format(doc_id) + "/records", headers=_h(env, "REVIEWER"))
    assert r.status_code == 201
    v = _versions(env, doc_id)
    assert [(x["version"], x["status"]) for x in v] == [(1, "APPROVED"), (2, "DRAFT")]
    assert v[0]["approved_by"] is None and v[0]["signature_status"] == "VALID"


def test_missing_version_is_404(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    r = env.get(D.format(doc_id) + "/records/9", headers=_h(env, "REVIEWER"))
    assert r.status_code == 404 and r.json()["code"] == "RECORD_VERSION_NOT_FOUND"


def test_citizen_cannot_read_versions(env, jobs):  # noqa: F811
    doc_id = _historical(env, jobs)
    assert env.get(D.format(doc_id) + "/records", headers=_h(env, "CITIZEN")).status_code == 403


# ---- the original file is kept --------------------------------------------------------------------

def _file(env, doc_id):
    return env.get(D.format(doc_id) + "/file", headers=_h(env, "REVIEWER"))


def test_original_file_stays_readable_and_unchanged_after_approval_and_correction(env, jobs, store):  # noqa: F811
    doc_id = _historical(env, jobs)
    first = _file(env, doc_id)
    digest = _row(env, doc_id).file_hash
    assert first.status_code == 200 and hashlib.sha256(first.content).hexdigest() == digest
    assert first.headers["X-File-SHA256"] == digest
    _approve_historical(env, doc_id)
    env.post(D.format(doc_id) + "/records", headers=_h(env, "REVIEWER"))
    env.patch(D.format(doc_id) + "/records/3", headers=_h(env, "REVIEWER"), json={"fields": [{"field": "mouza", "value": "ভবানীপুর মৌজা"}]})
    assert env.post(D.format(doc_id) + "/records/3/approve", headers=_h(env, "OFFICER")).status_code == 200
    after = _file(env, doc_id)
    assert after.status_code == 200 and after.content == first.content
    assert after.headers["X-File-SHA256"] == digest == _version(env, doc_id, 3)["file_hash"]
    assert len([p for p in store.rglob("*") if p.is_file() and p.parent.name == "documents"]) == 1  # never copied or replaced


def test_a_changed_original_is_refused_not_served(env, jobs, store):  # noqa: F811
    doc_id = _historical(env, jobs)
    path = store / _row(env, doc_id).file_path
    path.write_bytes(path.read_bytes() + b"tampered")
    r = _file(env, doc_id)
    assert r.status_code == 500 and r.json()["code"] == "DOCUMENT_FILE_CORRUPT"
