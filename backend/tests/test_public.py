# ruff: noqa: F811
import json

import pytest

from app.core.ratelimit import reset_rate_limits
from tests.test_lands import ROLES, _h, env  # noqa: F401

B = "/api/v1/public/verify"
KEYS = {
    "land_id", "district", "upazila", "mouza", "status", "risk_level", "counts", "last_verified_at",
}
BANNED = ("rahim", "karim", "hasan", "hash", "file_path", "password", "father", "nid", "evidence")


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def test_no_login_needed_and_shape(env):
    r = env.get(f"{B}/LP-10100")
    assert r.status_code == 200, r.text
    b = r.json()
    assert set(b) == KEYS and b["land_id"] == "LP-10100" and b["risk_level"] == "LOW"
    assert b["counts"]["transactions"] == 2 and b["counts"]["ownership_records"] >= 3
    assert b["last_verified_at"] is None
    assert r.headers["cache-control"] == "no-store"


def test_flagged_land_levels(env):
    b = env.get(f"{B}/LP-10240").json()
    assert b["risk_level"] == "HIGH"
    assert env.get(f"{B}/LP-10500").json()["risk_level"] == "MEDIUM"


def test_leak_all_lands_no_names_hashes_paths(env):
    codes = ("LP-10001", "LP-10100", "LP-10234", "LP-10240", "LP-10300", "LP-10400", "LP-10500")
    for code in codes:
        r = env.get(f"{B}/{code}")
        assert r.status_code == 200
        text = json.dumps(r.json()).lower()
        assert not any(w in text for w in BANNED), (code, text)
        assert set(r.json()) == KEYS


def test_last_verified_after_report(env):
    h = _h(env, "CITIZEN")
    r = env.post("/api/v1/verification", json={"land_id": "LP-10100"}, headers=h)
    assert r.status_code == 201
    assert env.get(f"{B}/LP-10100").json()["last_verified_at"] is not None


def test_read_only_no_alert_or_assessment_rows(env):
    env.get(f"{B}/LP-10240")
    admin = _h(env, "REVIEWER")
    assert env.get("/api/v1/risk-alerts", headers=admin).json()["items"] == []


def test_not_found_and_bad_format(env):
    for code in ("LP-99999", "abc", "LP-1", "LP-100000"):
        r = env.get(f"{B}/{code}")
        assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"


def test_lowercase_code_accepted(env):
    assert env.get(f"{B}/lp-10001").status_code == 200


def test_rate_limit_60_per_minute(env):
    for _ in range(60):
        assert env.get(f"{B}/LP-10001").status_code == 200
    r = env.get(f"{B}/LP-10001")
    assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"
