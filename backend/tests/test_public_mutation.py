# ruff: noqa: E501, F811
"""F2c: public mutation tracker. No login, no names, no land id; steps come from the audit trail."""
import json

import pytest

from app.core.ratelimit import reset_rate_limits
from tests.test_documents import _files, png, store  # noqa: F401
from tests.test_extraction import _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_review import _post

B = "/api/v1/public/mutation-status"
KEYS = {"mutation_no", "status", "fast_track", "office", "applied_at", "days_pending", "steps"}
BANNED = ("rahim", "karim", "hasan", "jamal", "applicant", "land_id", "LP-1", "deed", "hash", "father", "nid", "password")


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def _states(body):
    return [(s["step"], s["state"]) for s in body["steps"]]


def test_seeded_approved_mutation_without_login(env):
    r = env.get(f"{B}/MUT-2012-0001")
    assert r.status_code == 200, r.text
    b = r.json()
    assert set(b) == KEYS and b["status"] == "APPROVED" and b["days_pending"] is None
    assert b["office"] == "AC Land Office, Savar" and b["fast_track"] is False
    # seeded rows have no audit trail: review is done without a date, hearing never happened
    assert _states(b) == [("APPLIED", "done"), ("REVIEW", "done"), ("HEARING", "skipped"), ("DECIDED", "done")]
    assert b["steps"][0]["at"] and b["steps"][1]["at"] is None and b["steps"][3]["at"]
    assert r.headers["cache-control"] == "no-store"


def test_number_is_case_and_space_tolerant(env):
    assert env.get(f"{B}/%20mut-2012-0001").status_code == 200


@pytest.mark.parametrize("no", ["MUT-2012-9999", "MUT-1-1", "nope", "LP-10100", "MUT-2012-0001' OR 1=1"])
def test_unknown_or_malformed_number_is_404(env, no):
    r = env.get(f"{B}/{no}")
    assert r.status_code == 404 and r.json()["code"] == "MUTATION_NOT_FOUND"


def test_workflow_fast_track_then_hearing_steps(env, jobs):
    assert _post(env, _ready(env, b"Doc1"), "approve").status_code == 200
    assert _post(env, _ready(env, b"Doc2"), "approve").status_code == 200
    items = env.get("/api/v1/mutations", headers=_h(env, "REVIEWER")).json()["items"]
    by_status = {i["status"]: i["mutation_no"] for i in items if i["source"] == "WORKFLOW"}
    fast = env.get(f"{B}/{by_status['UNDER_REVIEW']}").json()
    assert fast["fast_track"] is True and fast["days_pending"] == 0
    assert _states(fast) == [("APPLIED", "done"), ("REVIEW", "current"), ("HEARING", "pending"), ("DECIDED", "pending")]
    assert fast["steps"][1]["at"] and fast["steps"][2]["at"] is None
    hear = env.get(f"{B}/{by_status['HEARING']}").json()
    assert _states(hear) == [("APPLIED", "done"), ("REVIEW", "done"), ("HEARING", "current"), ("DECIDED", "pending")]
    assert hear["steps"][2]["at"] and hear["fast_track"] is False
    # an officer approves the fast-track one -> decided, no longer pending
    mid = next(i["id"] for i in items if i["mutation_no"] == by_status["UNDER_REVIEW"])
    assert env.post(f"/api/v1/mutations/{mid}/transition", json={"to": "APPROVED"}, headers=_h(env, "OFFICER")).status_code == 200
    done = env.get(f"{B}/{by_status['UNDER_REVIEW']}").json()
    assert done["status"] == "APPROVED" and done["days_pending"] is None
    assert _states(done) == [("APPLIED", "done"), ("REVIEW", "done"), ("HEARING", "skipped"), ("DECIDED", "done")]


def test_payload_has_no_names_or_ids(env):
    for no in ("MUT-2012-0001", "MUT-2019-0002", "MUT-2023-0007"):
        text = json.dumps(env.get(f"{B}/{no}").json())
        assert not any(w.lower() in text.lower() for w in BANNED), (no, text)


def test_rate_limited_like_public_verify(env):
    codes = [env.get(f"{B}/MUT-2012-0001").status_code for _ in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429
