# ruff: noqa: E501
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models.land_parcel import LandParcel
from app.risk.context import EncRecord, LandContext, load_land_context
from app.risk.rules import encumbrance, run_rules
from app.risk.scoring import score_evidence
from tests.test_lands import _h, env, loader  # noqa: F401


def _ctx(*encs):
    return LandContext("LP-X", 10.0, "decimal", encumbrances=tuple(encs), as_of=date(2026, 10, 6))


def _e(type_, status="ACTIVE", i="e1"):
    return EncRecord(i, type_, "SYN-REF", status, "Synthetic Authority")


def _codes(ctx):
    return [e.code for e in encumbrance.evaluate(ctx)]


def test_each_type_maps_to_its_code():
    assert _codes(_ctx(_e("COURT_CASE"))) == ["ACTIVE_LITIGATION"]
    assert _codes(_ctx(_e("KHAS"))) == ["KHAS_LAND"]
    assert _codes(_ctx(_e("ACQUISITION"))) == ["UNDER_ACQUISITION"]
    assert _codes(_ctx(_e("MORTGAGE"))) == ["ACTIVE_MORTGAGE"]


def test_resolved_ignored_and_mortgage_scores_zero():
    assert _codes(_ctx(_e("COURT_CASE", "RESOLVED"))) == []
    r = score_evidence(run_rules(_ctx(_e("MORTGAGE"))))
    assert r.overall_score == 0 and r.level == "LOW" and r.evidence[0].severity == "INFO"


def test_points_and_severity():
    lit = score_evidence(run_rules(_ctx(_e("COURT_CASE"))))
    assert lit.overall_score == 30 and lit.evidence[0].severity == "HIGH"
    for t in ("KHAS", "ACQUISITION"):
        r = score_evidence(run_rules(_ctx(_e(t))))
        assert r.overall_score == 60 and r.level == "HIGH"


def test_evidence_wording_safe():
    text = str([e.to_dict() for e in encumbrance.evaluate(_ctx(_e("KHAS")))]).lower()
    assert not any(w in text for w in ("fraud", "forged", "illegal", "guilty"))


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    engine = make_engine(f"sqlite:///{tmp_path_factory.mktemp('enc') / 'enc.db'}")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        loader.seed(s, demo_password="seed-pw")
        yield s


def _score(db, land_id):
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
    return score_evidence(run_rules(load_land_context(db, land)))


@pytest.mark.parametrize(
    ("land_id", "code", "score"),
    [("LP-10800", "ACTIVE_LITIGATION", 30), ("LP-10900", "KHAS_LAND", 60), ("LP-11000", "UNDER_ACQUISITION", 60)],
)
def test_seeded_parcels(db, land_id, code, score):
    r = _score(db, land_id)
    assert [e.code for e in r.evidence] == [code]
    assert r.evidence[0].severity == "HIGH" and r.overall_score == score
    assert r.evidence[0].params["reference_no"].startswith("SYN-")


@pytest.mark.parametrize(
    "land_id", ["LP-10001", "LP-10100", "LP-10234", "LP-10300", "LP-10400", "LP-10240", "LP-10500"]
)
def test_old_lands_have_no_encumbrance_evidence(db, land_id):
    codes = {"ACTIVE_LITIGATION", "KHAS_LAND", "UNDER_ACQUISITION", "ACTIVE_MORTGAGE"}
    assert not [e for e in _score(db, land_id).evidence if e.code in codes]


def test_endpoint_roles(env):  # noqa: F811
    url = "/api/v1/lands/LP-10900/encumbrances"
    c = env.get(url, headers=_h(env, "CITIZEN"))
    assert c.status_code == 200
    (e,) = c.json()["encumbrances"]
    assert e["type"] == "KHAS" and e["status"] == "ACTIVE" and e["started_at"] == "2019-02-01"
    assert e["reference_no"] is None and e["authority"] is None and e["note"] is None
    o = env.get(url, headers=_h(env, "OFFICER")).json()["encumbrances"][0]
    assert o["reference_no"] == "SYN-KHAS-0901" and o["authority"]
    clean = env.get("/api/v1/lands/LP-10001/encumbrances", headers=_h(env, "CITIZEN"))
    assert clean.json()["encumbrances"] == []
    assert env.get("/api/v1/lands/LP-NOPE/encumbrances", headers=_h(env, "CITIZEN")).status_code == 404
