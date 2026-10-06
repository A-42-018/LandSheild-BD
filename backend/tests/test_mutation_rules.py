# ruff: noqa: E501
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models.land_parcel import LandParcel
from app.risk.context import LandContext, MutRecord, OwnerPeriod, TxRecord, load_land_context
from app.risk.rules import mutation, run_rules
from app.risk.scoring import score_evidence
from tests.test_lands import _h, env, loader  # noqa: F401

TODAY = date(2026, 10, 6)


def _ctx(txs=(), muts=()):
    return LandContext(
        "LP-X", 10.0, "decimal", (OwnerPeriod("b", date(2020, 1, 1), None),),
        tuple(txs), mutations=tuple(muts), as_of=TODAY,
    )  # fmt: skip


def _tx(d=date(2024, 1, 1), doc=False):
    return TxRecord("t1", "a", "b", d, 10.0, "decimal", from_document=doc)


def _m(status="APPROVED", applicant="b", deed="d1", a=10.0, u="decimal", da=10.0, du="decimal"):
    return MutRecord("m1", "t1", deed, applicant, status, a, u, da, du)


def _codes(ctx):
    return [e.code for e in mutation.evaluate(ctx)]


def test_not_mutated_after_grace_only():
    assert _codes(_ctx([_tx()])) == ["REGISTERED_NOT_MUTATED"]
    assert _codes(_ctx([_tx(date(2026, 8, 1))])) == []  # inside 180-day grace
    assert _codes(_ctx([_tx()], [_m()])) == []
    assert _codes(_ctx([_tx()], [_m("APPLIED")])) == ["REGISTERED_NOT_MUTATED"]
    assert _codes(_ctx([_tx(doc=True)])) == ["REGISTERED_NOT_MUTATED"]  # no document exemption (F2a)
    pend = MutRecord("m1", "t1", "d1", "b", "UNDER_REVIEW", 10.0, "decimal", 10.0, "decimal", date(2026, 10, 1))
    assert _codes(_ctx([_tx()], [pend])) == []  # open application inside grace = in progress
    stale = MutRecord("m1", "t1", "d1", "b", "HEARING", 10.0, "decimal", 10.0, "decimal", date(2026, 1, 1))
    assert _codes(_ctx([_tx()], [stale])) == ["REGISTERED_NOT_MUTATED"]


def test_party_mismatch_and_rejected_ignored():
    assert _codes(_ctx([_tx()], [_m(applicant="x")])) == ["MUTATION_PARTY_MISMATCH"]
    assert _codes(_ctx([_tx()], [_m("REJECTED", applicant="x")])) == ["REGISTERED_NOT_MUTATED"]


def test_without_deed():
    assert "MUTATION_WITHOUT_DEED" in _codes(_ctx([_tx()], [_m(deed=None, da=None, du=None)]))


def test_area_exceeds_deed_unit_normalised():
    assert _codes(_ctx([_tx()], [_m(a=12.0)])) == ["MUTATION_AREA_EXCEEDS_DEED"]
    assert _codes(_ctx([_tx()], [_m(a=0.1, u="acre", da=10.0)])) == []  # 0.1 acre < 10 decimal
    assert _codes(_ctx([_tx()], [_m(a=0.2, u="acre", da=10.0)])) == ["MUTATION_AREA_EXCEEDS_DEED"]
    assert _codes(_ctx([_tx()], [_m(a=99.0, u="weird")])) == []  # unknown unit never compared


def test_evidence_wording_safe_and_no_names():
    ev = mutation.evaluate(_ctx([_tx()], [_m(applicant="x"), _m(deed=None)]))
    text = str([e.to_dict() for e in ev]).lower()
    assert not any(w in text for w in ("fraud", "forged", "illegal", "guilty"))


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    engine = make_engine(f"sqlite:///{tmp_path_factory.mktemp('mu') / 'mu.db'}")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        loader.seed(s, demo_password="seed-pw")
        yield s


def _score(db, land_id):
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
    return score_evidence(run_rules(load_land_context(db, land)))


def test_seeded_lands(db):
    r = _score(db, "LP-10600")
    assert [e.code for e in r.evidence] == ["REGISTERED_NOT_MUTATED"]
    assert r.level == "MEDIUM"
    r = _score(db, "LP-10700")
    assert [e.code for e in r.evidence] == ["MUTATION_PARTY_MISMATCH"]
    assert r.level == "HIGH"


@pytest.mark.parametrize(
    "land_id",
    ["LP-10001", "LP-10100", "LP-10234", "LP-10300", "LP-10400", "LP-10240", "LP-10500"],
)
def test_existing_lands_have_no_mutation_evidence(db, land_id):
    assert not [e for e in _score(db, land_id).evidence if e.code.startswith(("MUTATION", "REGIS"))]


def test_mutations_endpoint_roles(env):  # noqa: F811
    c = env.get("/api/v1/lands/LP-10700/mutations", headers=_h(env, "CITIZEN"))
    assert c.status_code == 200
    (m,) = c.json()["mutations"]
    assert m["status"] == "APPROVED" and m["new_khatian_no"] == "1110-M"
    assert m["applicant"] is None and m["area"] is None and m["ac_land_office"] is None
    o = env.get("/api/v1/lands/LP-10700/mutations", headers=_h(env, "OFFICER")).json()
    assert o["mutations"][0]["applicant"]["name"] and o["mutations"][0]["deed_no"] == "D-2023-0700"
    assert (
        env.get("/api/v1/lands/LP-10600/mutations", headers=_h(env, "CITIZEN")).json()["mutations"]
        == []
    )
    assert env.get("/api/v1/lands/LP-NOPE/mutations", headers=_h(env, "CITIZEN")).status_code == 404
