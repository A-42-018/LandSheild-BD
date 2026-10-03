# ruff: noqa: F811, E501
import json
import unicodedata
from pathlib import Path

import pytest

from app.core.config import get_settings
from app.core.ratelimit import reset_rate_limits
from tests.test_lands import ROLES, _h, env, loader  # noqa: F401

P = "/api/v1/gis"


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _get(env, path, role="CITIZEN", **params):
    return env.get(f"{P}{path}", headers=_h(env, role), params=params)


def _find(fc, name):
    return next(f["properties"] for f in fc["features"] if f["properties"]["name"] == name)


@pytest.mark.parametrize("path", ["/capabilities", "/divisions", "/search?q=khulna"])
def test_requires_login(env, path):
    assert env.get(f"{P}{path}").status_code == 401


@pytest.mark.parametrize("role", ROLES)
def test_every_role_reads_divisions(env, role):
    r = _get(env, "/divisions", role)
    assert r.status_code == 200
    assert len(r.json()["features"]) == 8


def test_hierarchy_counts_and_names(env):
    caps = _get(env, "/capabilities").json()
    assert caps["counts"]["divisions"] == 8
    assert caps["counts"]["districts"] == 64
    assert caps["counts"]["upazilas"] >= 490
    div = _find(_get(env, "/divisions").json(), "Khulna")
    assert div["bn_name"] == "খুলনা"
    dis = _get(env, "/districts", division_id=div["id"]).json()
    bag = _find(dis, "Bagerhat")
    assert bag["bn_name"] == "বাগেরহাট"
    assert all(f["properties"]["division_id"] == div["id"] for f in dis["features"])
    upa = _get(env, "/upazilas", district_id=bag["id"]).json()
    assert unicodedata.normalize("NFC", _find(upa, "Kachua")["bn_name"]) == unicodedata.normalize("NFC", "কচুয়া")


def test_every_feature_has_geometry_bbox_and_valid_parent(env):
    divs = _get(env, "/divisions").json()
    ids = {f["properties"]["id"] for f in divs["features"]}
    total_d = 0
    for dv in ids:
        for f in _get(env, "/districts", division_id=dv).json()["features"]:
            total_d += 1
            assert f["geometry"]["type"] in {"Polygon", "MultiPolygon"}
            assert f["geometry"]["coordinates"]
            w, s, e, n = f["properties"]["bbox"]
            assert 87 < w < e < 93 and 20 < s < n < 27
    assert total_d == 64


def test_unknown_parents_are_404(env):
    assert _get(env, "/districts", division_id="999").status_code == 404
    assert _get(env, "/upazilas", district_id="999").status_code == 404
    assert _get(env, "/mouzas", upazila_id="999").status_code == 404
    assert _get(env, "/districts").status_code == 422


def test_mouzas_only_for_demo_division(env, tmp_path, monkeypatch):
    data = tmp_path / "gis"
    data.mkdir()
    src = json.loads((Path(__file__).resolve().parents[2] / "database" / "gis" / "upazilas.geojson").read_text(encoding="utf-8"))
    kachua = next(f["properties"] for f in src["features"] if f["properties"]["name"] == "Kachua" and f["properties"]["division_id"] == "4")
    other = next(f["properties"] for f in src["features"] if f["properties"]["division_id"] == "3")
    for name in ("divisions", "districts", "upazilas"):
        (data / f"{name}.geojson").write_text((Path(__file__).resolve().parents[2] / "database" / "gis" / f"{name}.geojson").read_text(encoding="utf-8"), encoding="utf-8")
    (data / "mouzas.json").write_text(json.dumps({"mouzas": [{"id": "m1", "upazila_id": kachua["id"], "code": "002", "name": "Krishnapur", "bn_name": "কৃষ্ণপুর", "jl_no": "2"}]}), encoding="utf-8")
    monkeypatch.setenv("GIS_DATA_DIR", str(data))
    monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "4")
    get_settings.cache_clear()
    from app.services import gis

    gis._read.cache_clear()
    r = _get(env, "/mouzas", upazila_id=kachua["id"]).json()
    assert r["enabled"] is True and [m["name"] for m in r["mouzas"]] == ["Krishnapur"]
    r = _get(env, "/mouzas", upazila_id=other["id"]).json()
    assert r == {"enabled": False, "upazila_id": other["id"], "mouzas": []}
    caps = _get(env, "/capabilities").json()
    assert caps["mouza_enabled"] and caps["mouza_enabled_division_name"] == "Khulna" and caps["mouza_count"] == 1
    hits = _get(env, "/search", q="krishna").json()["hits"]
    assert any(h["level"] == "mouza" for h in hits)
    monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "")
    get_settings.cache_clear()
    assert _get(env, "/capabilities").json()["mouza_enabled"] is False
    assert _get(env, "/mouzas", upazila_id=kachua["id"]).json()["mouzas"] == []
    gis._read.cache_clear()


def test_search_english_bangla_and_scope_hint(env):
    en = _get(env, "/search", q="bagerhat").json()
    assert any(h["level"] == "district" and h["bn_name"] == "বাগেরহাট" for h in en["hits"])
    bn = _get(env, "/search", q="কচুয়া").json()
    assert any(h["level"] == "upazila" and h["name"] == "Kachua" for h in bn["hits"])
    assert en["out_of_scope_hint"] is True  # no mouza matches
    assert _get(env, "/search", q="a").status_code == 422
    assert _get(env, "/search", q="zzzzqq").json()["hits"] == []


def test_responses_are_public_safe_and_small(env):
    body = _get(env, "/divisions").text.lower()
    for banned in ("password", "hash", "owner", "father", "file_path"):
        assert banned not in body
    assert len(_get(env, "/districts", division_id="3").content) < 200_000
