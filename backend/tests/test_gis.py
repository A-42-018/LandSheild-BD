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
def test_boundaries_are_open_data_without_login(env, path):
    """U2.3: the public map needs them; they carry no personal data."""
    r = env.get(f"{P}{path}")
    assert r.status_code == 200 and "max-age" in r.headers["cache-control"]


def test_gis_rate_limited_per_ip(env):
    for _ in range(120):
        assert env.get(f"{P}/divisions").status_code == 200
    assert env.get(f"{P}/divisions").status_code == 429


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


def test_gazipur_lists_all_five_upazilas_and_name_clashes_sit_in_the_right_district(env):
    """Gazipur's Sreepur carried Magura's Sreepur id in the source, so Gazipur had no Sreepur and Kaliakair sat
    under Magura; Dhaka's thanas were scattered over Kushtia/Magura. Guards FIXES in scripts/build_gis_data.py."""
    h = _h(env, "CITIZEN")

    def get(path, **params):
        return env.get(f"{P}{path}", headers=h, params=params).json()["features"]

    dist = {f["properties"]["name"]: f["properties"] for dv in get("/divisions") for f in get("/districts", division_id=dv["properties"]["id"])}

    def names(d):
        return {f["properties"]["name"]: f["properties"] for f in get("/upazilas", district_id=dist[d]["id"])}

    gaz = names("Gazipur")
    assert {"Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"} <= set(gaz)
    assert not {"Dakshinkhan", "Uttar Khan"} & set(gaz)
    assert gaz["Sreepur"]["bn_name"] == "শ্রীপুর" and gaz["Sreepur"]["bbox"][0] > 90.0  # not Magura's (89.3)
    assert gaz["Kaliakair"]["bn_name"]  # Bangla name comes from the source upazila (spelling varies)
    mag = names("Magura")
    assert set(mag) == {"Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"} and mag["Sreepur"]["bbox"][0] < 89.6
    assert {"Gulshan", "Dhanmondi", "Mirpur", "Savar", "Dakshinkhan"} <= set(names("Dhaka"))
    assert {"Mirpur", "Daulatpur"} <= set(names("Kushtia"))
    # Singra is Natore's (not Sirajganj's), Kawkhali is Rangamati's (not Chattogram's)
    assert "Singra" in names("Natore") and "Singra" not in names("Sirajgonj")
    assert "Kawkhali (Betbunia)" in names("Rangamati") and "Kawkhali (Betbunia)" not in names("Chattogram")


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
    assert _get(env, "/unions", upazila_id="999").status_code == 404
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
    assert r == {"enabled": False, "upazila_id": other["id"], "union_id": None, "mouzas": []}
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


def _mouza_dir(tmp_path, payload):
    data = tmp_path / "gis"
    data.mkdir()
    for name in ("divisions", "districts", "upazilas"):
        (data / f"{name}.geojson").write_text((Path(__file__).resolve().parents[2] / "database" / "gis" / f"{name}.geojson").read_text(encoding="utf-8"), encoding="utf-8")
    (data / "mouzas.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return data


def test_union_wise_mouzas_with_jl_and_sheets(env, tmp_path, monkeypatch):
    src = json.loads((Path(__file__).resolve().parents[2] / "database" / "gis" / "upazilas.geojson").read_text(encoding="utf-8"))
    kachua = next(f["properties"] for f in src["features"] if f["properties"]["name"] == "Kachua" and f["properties"]["division_id"] == "4")
    up = kachua["id"]
    data = _mouza_dir(tmp_path, {
        "source": "Ministry of Land, Smart Bhumi Naksha (map.land.gov.bd)",
        "source_url": "https://map.land.gov.bd",
        "unions": [
            {"id": "40013815", "upazila_id": up, "name": "Badhal", "bn_name": "বাধাল"},
            {"id": "40013828", "upazila_id": up, "name": "Dhopakhali", "bn_name": "ধোপাখালী"},
        ],
        "mouzas": [
            {"id": "m10", "upazila_id": up, "union_id": "40013815", "code": "c10", "name": "Badhal", "bn_name": "বাধাল", "jl_no": "010",
             "sheets": [{"sheet_no": "001", "survey": "RS", "plots": 40}, {"sheet_no": "002", "survey": "RS", "plots": 12}]},
            {"id": "m2", "upazila_id": up, "union_id": "40013815", "code": "c2", "name": "Krishnapur", "bn_name": "কৃষ্ণপুর", "jl_no": "002",
             "sheets": [{"sheet_no": "001", "survey": "RS", "plots": 9}]},
            {"id": "m4", "upazila_id": up, "union_id": "40013828", "code": "c4", "name": "Dhopakhali", "bn_name": "ধোপাখালী", "jl_no": "004", "sheets": []},
        ],
        "sources": [{"name": "Ministry of Land", "url": "https://map.land.gov.bd"}],
    })
    monkeypatch.setenv("GIS_DATA_DIR", str(data))
    monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "4")
    get_settings.cache_clear()
    from app.services import gis

    gis._read.cache_clear()
    try:
        u = _get(env, "/unions", upazila_id=up).json()
        assert u["enabled"] is True
        assert [(x["name"], x["bn_name"], x["mouza_count"]) for x in u["unions"]] == [("Badhal", "বাধাল", 2), ("Dhopakhali", "ধোপাখালী", 1)]

        all_m = _get(env, "/mouzas", upazila_id=up).json()["mouzas"]
        assert [m["jl_no"] for m in all_m] == ["002", "004", "010"]  # sorted by JL number
        badhal = _get(env, "/mouzas", upazila_id=up, union_id="40013815").json()
        assert badhal["union_id"] == "40013815"
        assert [m["name"] for m in badhal["mouzas"]] == ["Krishnapur", "Badhal"]
        assert badhal["mouzas"][1]["sheets"] == [
            {"sheet_no": "001", "survey": "RS", "plots": 40, "url": None},
            {"sheet_no": "002", "survey": "RS", "plots": 12, "url": None},
        ]
        assert _get(env, "/mouzas", upazila_id=up, union_id="x1").status_code == 422

        caps = _get(env, "/capabilities").json()
        assert caps["union_count"] == 2 and caps["mouza_source_url"] == "https://map.land.gov.bd"
        assert caps["mouza_sources"] == [{"name": "Ministry of Land", "url": "https://map.land.gov.bd"}]

        hits = _get(env, "/search", q="krishnapur").json()["hits"]
        m = next(h for h in hits if h["level"] == "mouza")
        assert m["upazila_id"] == up and m["union_id"] == "40013815" and m["jl_no"] == "002"
        assert m["division_id"] == "4" and m["path"].endswith("Kachua / Badhal")
        assert any(h["level"] == "union" and h["name"] == "Dhopakhali" for h in _get(env, "/search", q="ধোপাখালী").json()["hits"])
        assert [h["name"] for h in _get(env, "/search", q="10").json()["hits"] if h["level"] == "mouza"] == ["Badhal"]  # by JL no

        monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "")
        get_settings.cache_clear()
        assert _get(env, "/unions", upazila_id=up).json() == {"enabled": False, "upazila_id": up, "unions": []}
    finally:
        gis._read.cache_clear()


def test_mouzas_without_union_are_listed_under_the_upazila(env, tmp_path, monkeypatch):
    src = json.loads((Path(__file__).resolve().parents[2] / "database" / "gis" / "upazilas.geojson").read_text(encoding="utf-8"))
    up = next(f["properties"]["id"] for f in src["features"] if f["properties"]["name"] == "Kachua" and f["properties"]["division_id"] == "4")
    data = _mouza_dir(tmp_path, {
        "unions": [],
        "mouzas": [{"id": "020601015", "upazila_id": up, "union_id": None, "code": "020601015", "name": "চক তেলিগাতী", "bn_name": "চক তেলিগাতী", "jl_no": "015",
                    "source_url": "https://settlement.gov.bd", "sheets": [{"sheet_no": "001", "survey": "BRS", "plots": 0}]}],
    })
    monkeypatch.setenv("GIS_DATA_DIR", str(data))
    monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "4")
    get_settings.cache_clear()
    from app.services import gis

    gis._read.cache_clear()
    try:
        assert _get(env, "/unions", upazila_id=up).json()["unions"] == []
        m = _get(env, "/mouzas", upazila_id=up).json()["mouzas"]
        assert [(x["jl_no"], x["union_id"], x["source_url"]) for x in m] == [("015", None, "https://settlement.gov.bd")]
        hit = next(h for h in _get(env, "/search", q="তেলিগাতী").json()["hits"] if h["level"] == "mouza")
        assert hit["jl_no"] == "015" and hit["union_id"] is None
    finally:
        gis._read.cache_clear()
