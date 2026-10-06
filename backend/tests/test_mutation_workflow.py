# ruff: noqa: E501, F811
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.mutation import MutationRecord
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_review import _post

M = "/api/v1/mutations"


def _approve(env, marker: bytes) -> None:
    assert _post(env, _ready(env, marker), "approve").status_code == 200


def _workflow(env):
    r = env.get(M, headers=_h(env, "REVIEWER"))
    assert r.status_code == 200
    return [i for i in r.json()["items"] if i["source"] == "WORKFLOW"]


def test_doc1_approve_creates_fast_tracked_mutation(env, jobs):
    _approve(env, b"Doc1")
    (m,) = _workflow(env)
    assert m["status"] == "UNDER_REVIEW" and m["fast_track"] is True and m["land_id"] == "LP-10234"
    d = env.get(f"{M}/{m['id']}", headers=_h(env, "REVIEWER")).json()
    assert d["checklist"]["SELLER_IS_RECORDED_OWNER"] == "PASS"
    assert d["checklist"]["NO_ACTIVE_CASE"] == "PASS"  # F3a fills encumbrance checks
    assert d["checklist"]["NOT_KHAS_OR_ACQUIRED"] == "PASS"
    assert "FAIL" not in d["checklist"].values()
    assert d["allowed_transitions"] == ["APPROVED", "HEARING", "REJECTED"]


def test_doc2_approve_goes_to_hearing_with_failed_checks(env, jobs):
    _approve(env, b"Doc1")
    _approve(env, b"Doc2")
    second = [m for m in _workflow(env) if m["status"] == "HEARING"]
    assert len(second) == 1 and second[0]["fast_track"] is False
    d = env.get(f"{M}/{second[0]['id']}", headers=_h(env, "REVIEWER")).json()
    assert d["checklist"]["SELLER_IS_RECORDED_OWNER"] == "FAIL"
    assert d["checklist"]["NO_OPEN_HIGH_ALERT"] == "FAIL"
    # Doc1 -> Doc2 detection is untouched
    risk = env.get("/api/v1/lands/LP-10234/risk", headers=_h(env, "CITIZEN")).json()
    assert risk["risk_level"] == "HIGH" and risk["overall_score"] == 70


def test_transition_rules(env, jobs):
    _approve(env, b"Doc1")
    mid = _workflow(env)[0]["id"]
    off = _h(env, "OFFICER")
    url = f"{M}/{mid}/transition"
    assert env.post(url, json={"to": "REJECTED"}, headers=off).json()["code"] == "REASON_REQUIRED"
    assert env.post(url, json={"to": "HEARING", "reason": "  "}, headers=off).status_code == 422
    assert env.post(url, json={"to": "APPLIED"}, headers=off).json()["code"] == "MUTATION_TRANSITION_INVALID"
    assert env.post(url, json={"to": "BOGUS"}, headers=off).status_code == 422
    ok = env.post(url, json={"to": "APPROVED"}, headers=off)
    assert ok.status_code == 200 and ok.json()["status"] == "APPROVED" and ok.json()["decided_at"]
    assert ok.json()["allowed_transitions"] == []
    r = env.post(url, json={"to": "REJECTED", "reason": "late"}, headers=off)
    assert r.status_code == 409 and r.json()["code"] == "MUTATION_TRANSITION_INVALID"
    assert env.post(f"{M}/{'0' * 36}/transition", json={"to": "APPROVED"}, headers=off).status_code == 404
    assert env.post(url, json={"to": "REJECTED", "reason": "x"}, headers=_h(env, "REVIEWER")).status_code == 403


def test_every_step_is_audited_and_filter_works(env, jobs):
    _approve(env, b"Doc1")
    mid = _workflow(env)[0]["id"]
    env.post(f"{M}/{mid}/transition", json={"to": "HEARING", "reason": "check"}, headers=_h(env, "OFFICER"))
    with _db(env) as s:
        acts = [
            a.action for a in s.scalars(select(AuditLog).where(AuditLog.entity_id == mid).order_by(AuditLog.created_at))
        ]
        assert s.scalar(select(MutationRecord).where(MutationRecord.id == mid)).status == "HEARING"
    assert acts.count("MUTATION_TRANSITION") == 2 and "MUTATION_APPLIED" in acts
    q = env.get(f"{M}?status=HEARING", headers=_h(env, "REVIEWER")).json()
    assert [i["id"] for i in q["items"] if i["source"] == "WORKFLOW"] == [mid]
    assert env.get(f"{M}?status=NOPE", headers=_h(env, "REVIEWER")).status_code == 422
