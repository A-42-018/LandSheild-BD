# ruff: noqa: F811
import json

import pytest

from app.core.db import get_db
from app.core.ratelimit import reset_rate_limits
from app.models.land_parcel import LandParcel
from tests.test_lands import ROLES, _h, env, loader  # noqa: F401

URL = "/api/v1/lands/map"
PROP_KEYS = {"land_id", "dag_no", "khatian_no", "area", "area_unit", "status", "risk_level"}
BANNED = ("rahim", "karim", "hasan", "father", "hash", "file_path", "password", "nid", "owner")


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


_KEEP: list = []  # keep the get_db generator alive so its session is not closed under us


def _session(env):
    gen = env.app.dependency_overrides[get_db]()
    _KEEP.append(gen)
    return next(gen)


def _by_id(body):
    return {f["properties"]["land_id"]: f for f in body["features"]}


def test_requires_login(env):
    assert env.get(URL).status_code == 401


@pytest.mark.parametrize("role", ROLES)
def test_every_role_gets_feature_collection(env, role):
    r = env.get(URL, headers=_h(env, role))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 7  # not captured by /lands/{land_id}


def test_feature_shape_and_polygons(env):
    body = env.get(URL, headers=_h(env, "CITIZEN")).json()
    for f in body["features"]:
        assert f["type"] == "Feature" and set(f) == {"type", "geometry", "properties"}
        assert set(f["properties"]) == PROP_KEYS
        g = f["geometry"]
        assert g["type"] == "Polygon"
        ring = g["coordinates"][0]
        assert ring[0] == ring[-1] and len(ring) >= 4
        assert all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in ring)


def test_risk_levels_match_rules(env):
    by = _by_id(env.get(URL, headers=_h(env, "CITIZEN")).json())
    assert by["LP-10240"]["properties"]["risk_level"] == "HIGH"
    assert by["LP-10500"]["properties"]["risk_level"] == "MEDIUM"
    assert by["LP-10100"]["properties"]["risk_level"] == "LOW"
    p = by["LP-10100"]["properties"]
    assert (p["dag_no"], p["khatian_no"], p["area_unit"], p["status"]) == (
        "210", "610", "decimal", "ACTIVE",
    )


def test_no_personal_data_for_any_role(env):
    for role in ROLES:
        text = json.dumps(env.get(URL, headers=_h(env, role)).json()).lower()
        assert not any(w in text for w in BANNED), (role, text)


def test_read_only_no_alerts_or_rows(env):
    env.get(URL, headers=_h(env, "CITIZEN"))
    assert env.get("/api/v1/risk-alerts", headers=_h(env, "REVIEWER")).json()["items"] == []


def test_lands_without_or_with_bad_geometry_are_skipped(env):
    s = _session(env)
    rows = {r.land_id: r for r in s.query(LandParcel).all()}
    rows["LP-10001"].geometry = None
    rows["LP-10100"].geometry = {"type": "Point", "coordinates": [90.3, 23.8]}
    rows["LP-10234"].geometry = {"type": "Polygon", "coordinates": []}
    s.commit()
    by = _by_id(env.get(URL, headers=_h(env, "CITIZEN")).json())
    assert set(by) == {"LP-10240", "LP-10300", "LP-10400", "LP-10500"}


def test_seed_backfills_missing_geometry_and_keeps_existing(env):
    s = _session(env)
    rows = {r.land_id: r for r in s.query(LandParcel).all()}
    rows["LP-10001"].geometry = None
    custom = {"type": "Polygon", "coordinates": [[[1, 1], [2, 1], [2, 2], [1, 1]]]}
    rows["LP-10100"].geometry = custom
    s.commit()
    loader.seed(s, demo_password="seed-pw")
    s.expire_all()
    rows = {r.land_id: r for r in s.query(LandParcel).all()}
    assert rows["LP-10001"].geometry["type"] == "Polygon"
    assert rows["LP-10100"].geometry == custom  # existing value is never overwritten
