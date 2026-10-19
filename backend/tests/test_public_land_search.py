# ruff: noqa: F811
"""U2.1: GET /public/lands/search — no login, masked owners, rate-limited, audited."""

import json

import pytest
from sqlalchemy import select

from app.core.ratelimit import reset_rate_limits
from app.models.audit import AuditLog
from app.services.names import mask_name
from tests.test_documents import _db
from tests.test_lands import Q, _h, env  # noqa: F401

B = "/api/v1/public/lands/search"
KEYS = {
    "land_id", "district", "upazila", "mouza", "khatian_no", "dag_no", "area", "area_unit",
    "status", "risk_level", "owner_count", "owners_masked", "open_case", "counts",
    "survey_type", "jl_no", "map_sheet_no", "warnings",
}  # fmt: skip
BANNED = (
    "rahim", "karim", "hasan", "jamal", "father", "nid", "hash", "deed", "file_path", "evidence",
)  # fmt: skip
PLACES = {
    "LP-10001": ("Dhaka", "Savar", "Ashulia", "501", "101"),
    "LP-10240": ("Gazipur", "Sreepur", "Barmi", "1250", "790"),
    "LP-10500": ("Narayanganj", "Rupganj", "Bhulta", "910", "510"),
    "LP-10800": ("Dhaka", "Savar", "Ashulia", "1210", "810"),
    "LP-10900": ("Narayanganj", "Rupganj", "Bhulta", "1310", "910"),
}


def _q(code):
    d, u, m, k, g = PLACES[code]
    return {"district": d, "upazila": u, "mouza": m, "khatian": k, "dag": g}


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def test_no_login_shape_and_masking(env):
    r = env.get(B, params=Q)
    assert r.status_code == 200, r.text
    b = r.json()
    assert set(b) == KEYS and b["land_id"] == "LP-10100" and b["risk_level"] == "LOW"
    assert b["owner_count"] == len(b["owners_masked"]) >= 1
    assert all("***" in n for n in b["owners_masked"])
    assert b["open_case"] is False and r.headers["cache-control"] == "no-store"


def test_same_parcel_as_signed_in_search(env):
    full = env.get("/api/v1/lands/search", params=Q, headers=_h(env, "CITIZEN")).json()
    pub = env.get(B, params=Q).json()
    assert pub["land_id"] == full["land_id"] and pub["owner_count"] == len(full["current_owners"])
    assert pub["owners_masked"] == [mask_name(o["name"]) for o in full["current_owners"]]


def test_no_full_names_or_restricted_values_for_any_parcel(env):
    for code in PLACES:
        r = env.get(B, params=_q(code))
        if code == "LP-10001":  # shares khatian/dag with the SJ1 demo lands LP-12001/12003: ambiguous by design
            assert r.status_code == 409 and r.json()["code"] == "LAND_AMBIGUOUS", r.text
            assert not any(w in r.text.lower() for w in BANNED), r.text
            continue
        assert r.status_code == 200, (code, r.text)
        assert set(r.json()) == KEYS
        text = json.dumps(r.json()).lower()
        assert not any(w in text for w in BANNED), (code, text)


def test_open_case_and_risk(env):
    assert env.get(B, params=_q("LP-10800")).json()["open_case"] is True
    khas = env.get(B, params=_q("LP-10900")).json()
    assert khas["open_case"] is False and khas["counts"]["active_encumbrances"] == 1
    assert env.get(B, params=_q("LP-10240")).json()["risk_level"] == "HIGH"


def test_bangla_digits_and_case(env):
    q = {**Q, "district": "dhaka", "khatian": "৬১০", "dag": "২১০"}
    assert env.get(B, params=q).json()["land_id"] == "LP-10100"


def test_not_found_and_missing_fields(env):
    r = env.get(B, params={**Q, "dag": "9999"})
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
    assert env.get(B, params={k: v for k, v in Q.items() if k != "dag"}).status_code == 422


def test_each_hit_is_audited_without_names(env):
    env.get(B, params=Q)
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.action == "PUBLIC_LAND_SEARCH")).all()
    assert len(rows) == 1 and rows[0].actor_id is None and rows[0].entity_type == "land"
    assert rows[0].ip_hash and rows[0].new_value is None


def test_rate_limit_shared_with_public_reads(env):
    for _ in range(60):
        assert env.get(B, params=Q).status_code == 200
    r = env.get(B, params=Q)
    assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"


@pytest.mark.parametrize(
    ("name", "masked"),
    [
        ("Rahim Uddin", "R*** U***"),
        ("Md. Karim Mia", "Md. K*** M***"),
        ("মোঃ রহিম উদ্দিন", "মোঃ র*** উ***"),
        ("Mst. Ayesha", "Mst. A***"),
        ("  Hasan   Ali ", "H*** A***"),
    ],
)
def test_mask_name(name, masked):
    assert mask_name(name) == masked
