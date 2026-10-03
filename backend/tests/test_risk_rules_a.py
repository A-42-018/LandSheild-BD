from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models.land_parcel import LandParcel
from app.risk.context import LandContext, OwnerPeriod, TxRecord, load_land_context
from app.risk.rules import duplicate_tx, run_rules, seller
from tests.test_lands import loader


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    engine = make_engine(f"sqlite:///{tmp_path_factory.mktemp('r') / 'r.db'}")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        loader.seed(s, demo_password="seed-pw")
        yield s


def _codes(db, land_id):
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
    return sorted(e.code for e in run_rules(load_land_context(db, land)))


def test_lp_10240_triggers_both(db):
    assert _codes(db, "LP-10240") == ["POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"]


@pytest.mark.parametrize("land_id", ["LP-10001", "LP-10100", "LP-10234"])
def test_clean_scenarios_trigger_none(db, land_id):
    assert _codes(db, land_id) == []


def test_evidence_shape_and_no_names(db):
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10240"))
    for e in run_rules(load_land_context(db, land)):
        d = e.to_dict()
        assert set(d) == {"code", "severity", "params"} and d["severity"] == "HIGH"
        assert "Rahim" not in str(d) and "Karim" not in str(d)


def _ctx(txs, owners, area=10.0, unit="decimal"):
    return LandContext("LP-X", area, unit, tuple(owners), tuple(txs))


def _tx(i, seller_id, d, area=10.0, unit="decimal", status="RECORDED"):
    return TxRecord(i, seller_id, "b", d, area, unit, status)


OWN = [OwnerPeriod("a", date(2000, 1, 1), None)]


def test_duplicate_negative_single_sale():
    assert duplicate_tx.evaluate(_ctx([_tx("1", "a", date(2020, 1, 1))], OWN)) == []


def test_duplicate_negative_two_partial_sales_within_area():
    txs = [_tx("1", "a", date(2020, 1, 1), 4), _tx("2", "a", date(2020, 2, 1), 5)]
    assert duplicate_tx.evaluate(_ctx(txs, OWN)) == []


def test_duplicate_positive_total_exceeds_area():
    txs = [_tx("1", "a", date(2020, 1, 1), 4), _tx("2", "a", date(2020, 2, 1), 7)]
    ev = duplicate_tx.evaluate(_ctx(txs, OWN))
    assert len(ev) == 1 and ev[0].params["total_area"] == 11


def test_duplicate_ignores_rejected_and_other_units():
    txs = [
        _tx("1", "a", date(2020, 1, 1)),
        _tx("2", "a", date(2020, 2, 1), status="REJECTED"),
        _tx("3", "a", date(2020, 3, 1), unit="katha"),
    ]
    assert duplicate_tx.evaluate(_ctx(txs, OWN)) == []


def test_seller_boundary_outgoing_owner_ok():
    own = [
        OwnerPeriod("a", date(2000, 1, 1), date(2020, 1, 1)),
        OwnerPeriod("b", date(2020, 1, 1), None),
    ]
    assert seller.evaluate(_ctx([_tx("1", "a", date(2020, 1, 1))], own)) == []


def test_seller_mismatch_positive():
    own = [OwnerPeriod("b", date(2000, 1, 1), None)]
    ev = seller.evaluate(_ctx([_tx("1", "a", date(2020, 1, 1))], own))
    assert len(ev) == 1 and ev[0].params["recorded_owner_ids"] == ["b"]


def test_seller_skips_undated_unrecorded_and_rejected():
    own = [OwnerPeriod("b", date(2000, 1, 1), None)]
    txs = [
        _tx("1", "a", None),
        _tx("2", "a", date(1990, 1, 1)),
        _tx("3", "a", date(2020, 1, 1), status="REJECTED"),
    ]
    assert seller.evaluate(_ctx(txs, own)) == []
