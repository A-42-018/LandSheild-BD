# ruff: noqa: E501, F811
"""E4: public feedback / grievance intake, reference-number status lookup, officer handling."""
import pytest

from app.core.ratelimit import reset_rate_limits
from tests.test_lands import _h, env  # noqa: F401

P = "/api/v1"
BODY = {"kind": "GRIEVANCE", "subject": "Wrong upazila shown", "message": "The upazila on the result page is wrong."}


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def _submit(env, **over):
    return env.post(f"{P}/public/feedback", json={**BODY, **over})


def test_submit_returns_reference_and_status_is_public(env):
    r = _submit(env, contact_email="Someone@Example.com")
    assert r.status_code == 201 and r.headers["cache-control"] == "no-store"
    b = r.json()
    assert b["status"] == "RECEIVED" and b["reference_no"].startswith("FB-")
    s = env.get(f"{P}/public/feedback/{b['reference_no'].lower()}")
    assert s.status_code == 200
    out = s.json()
    assert out["status"] == "RECEIVED" and out["kind"] == "GRIEVANCE" and out["response"] is None
    text = s.text.lower()
    assert "wrong upazila" not in text and "someone@example.com" not in text  # no subject, message or contact


@pytest.mark.parametrize(
    "over",
    [{"kind": "OTHER"}, {"subject": "x"}, {"message": "short"}, {"contact_email": "not-an-email"}, {"extra": 1}],
)
def test_invalid_submissions_are_rejected(env, over):
    assert _submit(env, **over).status_code == 422


def test_unknown_and_malformed_reference_are_404(env):
    for ref in ("FB-2026-00000", "nope", "FB-1-1"):
        r = env.get(f"{P}/public/feedback/{ref}")
        assert r.status_code == 404 and r.json()["code"] == "FEEDBACK_NOT_FOUND"


def test_submit_is_rate_limited(env):
    codes = [_submit(env).status_code for _ in range(7)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


def test_page_rating_is_counted_but_never_listed_or_looked_up(env):
    for helpful in (True, True, False):
        assert env.post(f"{P}/public/page-rating", json={"page": "/faq", "helpful": helpful}).status_code == 204
    assert env.post(f"{P}/public/page-rating", json={"page": "faq", "helpful": True}).status_code == 422
    body = env.get(f"{P}/feedback", headers=_h(env, "OFFICER")).json()
    assert body["items"] == [] and body["helpful"] == 2 and body["not_helpful"] == 1


def test_officer_lists_updates_and_citizen_sees_status(env):
    ref = _submit(env).json()["reference_no"]
    off = _h(env, "OFFICER")
    items = env.get(f"{P}/feedback", headers=off).json()
    assert items["total"] == 1 and items["open"] == 1 and items["items"][0]["subject"] == BODY["subject"]
    fid = items["items"][0]["id"]
    r = env.patch(f"{P}/feedback/{fid}", json={"status": "RESOLVED", "response": "Corrected."}, headers=off)
    assert r.status_code == 200 and r.json()["status"] == "RESOLVED"
    pub = env.get(f"{P}/public/feedback/{ref}").json()
    assert pub["status"] == "RESOLVED" and pub["response"] == "Corrected."
    assert env.get(f"{P}/feedback?status=RECEIVED", headers=off).json()["items"] == []
    assert env.get(f"{P}/feedback", headers=off).json()["open"] == 0


def test_only_officers_handle_feedback(env):
    fid = None
    _submit(env)
    fid = env.get(f"{P}/feedback", headers=_h(env, "OFFICER")).json()["items"][0]["id"]
    for role in ("CITIZEN", "REVIEWER"):
        assert env.get(f"{P}/feedback", headers=_h(env, role)).status_code == 403
        assert env.patch(f"{P}/feedback/{fid}", json={"status": "CLOSED"}, headers=_h(env, role)).status_code == 403
    assert env.patch(f"{P}/feedback/{fid}", json={"status": "BOGUS"}, headers=_h(env, "ADMIN")).status_code == 422
    assert env.patch(f"{P}/feedback/{'0' * 36}", json={"status": "CLOSED"}, headers=_h(env, "ADMIN")).status_code == 404
