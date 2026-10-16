# ruff: noqa: F811
"""U2.3: GET /public/map — outlines and parcel numbers only, no login."""

import json

import pytest

from app.core.ratelimit import reset_rate_limits
from tests.test_lands import _h, env  # noqa: F401

B = "/api/v1/public/map"
PROPS = {"land_id", "dag_no", "khatian_no", "district", "upazila", "mouza"}
BANNED = ("rahim", "karim", "hasan", "jamal", "father", "nid", "hash", "owner", "risk", "area")


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def test_no_login_and_only_numbers_and_place(env):
    r = env.get(B)
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    b = r.json()
    assert b["type"] == "FeatureCollection" and len(b["features"]) >= 5
    for f in b["features"]:
        assert set(f["properties"]) == PROPS
        assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
    text = json.dumps(b["features"]).lower()
    assert not any(w in text for w in BANNED)


def test_same_parcels_as_signed_in_map(env):
    full = env.get("/api/v1/lands/map", headers=_h(env, "CITIZEN")).json()["features"]
    pub = env.get(B).json()["features"]
    assert [f["properties"]["land_id"] for f in pub] == [f["properties"]["land_id"] for f in full]
    assert [f["geometry"] for f in pub] == [f["geometry"] for f in full]


def test_rate_limited(env):
    for _ in range(120):
        assert env.get(B).status_code == 200
    assert env.get(B).status_code == 429
