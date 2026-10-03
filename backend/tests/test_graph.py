# ruff: noqa: F811
from sqlalchemy import select

from app.models.alert import FraudAlert
from app.models.risk import RiskAssessment
from tests.test_lands import ROLES, _h, env  # noqa: F401

B = "/api/v1/lands"


def _g(env, code, role="OFFICER"):
    r = env.get(f"{B}/{code}/graph", headers=_h(env, role))
    assert r.status_code == 200, r.text
    return r.json()


def _by_type(g, t):
    return [n for n in g["nodes"] if n["type"] == t]


def test_lp_10240_shows_both_sales_flagged(env):
    g = _g(env, "LP-10240")
    labels = {n["id"]: n["label"].lower() for n in g["nodes"]}
    txs = _by_type(g, "Transaction")
    assert len(txs) == 2 and all(t["props"]["flagged"] for t in txs)
    seen = set()
    for t in txs:
        sold = [e for e in g["edges"] if e["type"] == "SOLD" and e["target"] == t["id"]]
        bought = [e for e in g["edges"] if e["type"] == "BOUGHT" and e["target"] == t["id"]]
        assert len(sold) == len(bought) == 1 and sold[0]["flagged"] and bought[0]["flagged"]
        seen.add((labels[sold[0]["source"]], labels[bought[0]["source"]]))
    assert any("rahim" in a and "karim" in b for a, b in seen)
    assert any("rahim" in a and "hasan" in b for a, b in seen)
    assert all(e["flagged"] for e in g["edges"] if e["type"] in {"SOLD", "BOUGHT", "TRANSFERRED"})


def test_clean_land_not_flagged_and_chain_shape(env):
    g = _g(env, "LP-10100")
    assert len(_by_type(g, "Land")) == 1 and len(_by_type(g, "Transaction")) == 2
    assert len(_by_type(g, "Deed")) == 2 and len(_by_type(g, "Person")) == 3
    assert not any(e["flagged"] for e in g["edges"])
    owns = [e for e in g["edges"] if e["type"] == "OWNS"]
    assert len(owns) == 1 and "hasan" in next(
        n["label"].lower() for n in g["nodes"] if n["id"] == owns[0]["source"]
    )
    assert {e["type"] for e in g["edges"]} == {"OWNS", "SOLD", "BOUGHT", "REFERS_TO", "TRANSFERRED"}
    ids = {n["id"] for n in g["nodes"]}
    assert all(e["source"] in ids and e["target"] in ids for e in g["edges"])


def test_land_without_transactions(env):
    g = _g(env, "LP-10234")
    assert len(_by_type(g, "Land")) == 1 and not _by_type(g, "Transaction")
    assert [e["type"] for e in g["edges"]] == ["OWNS"]


def test_father_name_masked_for_citizen(env):
    cit = _g(env, "LP-10100", "CITIZEN")
    assert all("father_name" not in n["props"] for n in cit["nodes"])
    off = _g(env, "LP-10100", "OFFICER")
    assert all("father_name" in n["props"] for n in _by_type(off, "Person"))


def test_read_only_and_no_sensitive_fields(env):
    h = _h(env, "OFFICER")
    for role in ROLES:
        text = env.get(f"{B}/LP-10240/graph", headers=_h(env, role)).text
        for bad in ("nid_hash", "contact_hash", "file_path", "password_hash"):
            assert bad not in text
    from app.core.db import get_db

    db = next(env.app.dependency_overrides[get_db]())
    before = (
        len(db.scalars(select(FraudAlert)).all()),
        len(db.scalars(select(RiskAssessment)).all()),
    )
    env.get(f"{B}/LP-10240/graph", headers=h)
    after = (
        len(db.scalars(select(FraudAlert)).all()),
        len(db.scalars(select(RiskAssessment)).all()),
    )
    assert before == after


def test_not_found_and_auth(env):
    r = env.get(f"{B}/LP-99999/graph", headers=_h(env, "CITIZEN"))
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
    assert env.get(f"{B}/LP-10100/graph").status_code == 401
