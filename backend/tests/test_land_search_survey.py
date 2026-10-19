"""SJ3: parcel search by survey / JL / sheet; ambiguity is a 409, never "the first row"."""

import pytest

from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import reset_rate_limits
from app.models import LandParcel
from tests.test_lands import _h, env  # noqa: F401

S = "/api/v1/lands/search"
PUB = "/api/v1/public/lands/search"
Q = {"district": "Dhaka", "upazila": "Savar", "mouza": "Ashulia", "khatian": "9001", "dag": "77"}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.setenv("MOUZA_ENABLED_DIVISION_ID", "3")  # Dhaka division: the demo registry applies
    reset_rate_limits()
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _add(env, land_id, **kw):
    base = dict(
        land_id=land_id, district="Dhaka", upazila="Savar", mouza="Ashulia", khatian_no="9001",
        dag_no="77", area=10, area_unit="decimal", survey_type="RS", jl_no="45", map_sheet_no="3",
    )
    base.update(kw)
    db = next(env.app.dependency_overrides[get_db]())
    db.add(LandParcel(**base))
    db.commit()


def _get(env, path, role="CITIZEN", **extra):
    h = _h(env, role) if path == S else None
    return env.get(path, params={**Q, **extra}, headers=h)


@pytest.mark.parametrize("path", [S, PUB])
def test_cs_rs_clash_is_409_without_survey_and_200_with_one(env, path):
    _add(env, "SJ-CS", survey_type="CS", map_sheet_no="2")
    _add(env, "SJ-RS", survey_type="RS")
    r = _get(env, path)
    assert r.status_code == 409 and r.json()["code"] == "LAND_AMBIGUOUS"
    cands = r.json()["details"]["candidates"]
    assert {c["land_id"] for c in cands} == {"SJ-CS", "SJ-RS"}
    assert all(set(c) == {"land_id", "survey_type", "jl_no", "mouza"} for c in cands)
    ok = _get(env, path, survey="RS")
    assert ok.status_code == 200 and ok.json()["land_id"] == "SJ-RS"
    assert ok.json()["survey_type"] == "RS" and ok.json()["jl_no"] == "45"
    assert _get(env, path, survey="CS").json()["land_id"] == "SJ-CS"


def test_wrong_jl_is_422(env):
    _add(env, "SJ-RS")
    r = _get(env, S, survey="RS", jl_no="46")
    assert r.status_code == 422 and r.json()["code"] == "JL_MISMATCH"


def test_same_mouza_two_jls_needs_the_jl(env):
    _add(env, "SJ-A", jl_no="45")
    _add(env, "SJ-B", jl_no="99")  # 99 is not in the registry: only the parcel query sees it
    r = _get(env, S, survey="RS")
    assert r.status_code == 409 and r.json()["code"] == "LAND_AMBIGUOUS"
    ok = _get(env, S, survey="RS", jl_no="045")  # leading zeros are ignored
    assert ok.status_code == 200 and ok.json()["land_id"] == "SJ-A"


def test_old_rows_without_survey_or_jl_still_match(env):
    _add(env, "SJ-OLD", survey_type=None, jl_no=None, map_sheet_no=None)
    r = _get(env, S, survey="RS", jl_no="45")
    assert r.status_code == 200 and r.json()["land_id"] == "SJ-OLD"


def test_missing_survey_stays_accepted_when_unambiguous(env):
    _add(env, "SJ-RS")
    assert _get(env, S).json()["land_id"] == "SJ-RS"


def test_not_found_and_bad_survey_value(env):
    assert _get(env, S, survey="RS").status_code == 404
    assert _get(env, S, survey="XX").status_code == 422


@pytest.mark.parametrize("path", [S, PUB])
def test_wrong_sheet_is_a_warning_not_a_404(env, path):
    _add(env, "SJ-RS", map_sheet_no="3")
    bad = _get(env, path, survey="RS", sheet_no="9")
    assert bad.status_code == 200 and bad.json()["warnings"] == ["SHEET_MISMATCH"]
    ok = _get(env, path, survey="RS", sheet_no="3")
    assert ok.status_code == 200 and ok.json()["warnings"] == []
    none = _get(env, path, survey="RS")
    assert none.json()["warnings"] == [] and none.json()["map_sheet_no"] == "3"


def test_sheet_not_in_registry_for_that_survey_warns(env):
    _add(env, "SJ-RS", map_sheet_no=None)
    assert _get(env, S, survey="RS", sheet_no="2").json()["warnings"] == ["SHEET_MISMATCH"]  # 2 is CS
    assert _get(env, S, survey="RS", sheet_no="4").json()["warnings"] == []


def test_public_candidates_never_leak_owners(env):
    _add(env, "SJ-CS", survey_type="CS")
    _add(env, "SJ-RS", survey_type="RS")
    body = _get(env, PUB).text
    for word in ("owner", "name", "father", "nid"):
        assert word not in body.lower().replace("mouza", "")


@pytest.mark.parametrize("path", [S, PUB])
def test_exact_survey_beats_a_legacy_row(env, path):
    _add(env, "SJ-RS")
    _add(env, "SJ-CS", survey_type="CS", map_sheet_no="2")
    _add(env, "SJ-OLD", survey_type=None, jl_no=None, map_sheet_no=None)
    assert _get(env, path, survey="RS", jl_no="45").json()["land_id"] == "SJ-RS"
    assert _get(env, path, survey="CS").json()["land_id"] == "SJ-CS"
    assert _get(env, path, survey="SA").json()["land_id"] == "SJ-OLD"  # only the legacy row fits
    r = _get(env, path)
    assert r.status_code == 409 and len(r.json()["details"]["candidates"]) == 3


@pytest.mark.parametrize("path", [S, PUB])
def test_land_id_picks_a_candidate_but_must_still_match(env, path):
    _add(env, "SJ-RS")
    _add(env, "SJ-OLD", survey_type=None, jl_no=None, map_sheet_no=None)
    ok = _get(env, path, survey="RS", land_id="SJ-OLD")  # the chooser's legacy pick
    assert ok.status_code == 200 and ok.json()["land_id"] == "SJ-OLD"
    _add(env, "SJ-ELSE", khatian_no="9002")
    assert _get(env, path, survey="RS", land_id="SJ-ELSE").status_code == 404


def test_sheet_check_never_turns_a_hit_into_422(env):
    _add(env, "SJ-BADJL", jl_no="46")  # the parcel's own JL disagrees with the registry (45)
    r = _get(env, S, survey="RS", sheet_no="3")
    assert r.status_code == 200 and r.json()["land_id"] == "SJ-BADJL"
