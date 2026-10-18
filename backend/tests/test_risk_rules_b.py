from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models.land_parcel import LandParcel
from app.risk.context import LandContext, OwnerPeriod, TxRecord, load_land_context
from app.risk.rules import area, duplicate_deed, ownership, repeated, run_rules, unit
from tests.test_lands import loader

FORBIDDEN = ("fraud confirmed", "proven", "forged", "illegal", "guilty")


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    engine = make_engine(f"sqlite:///{tmp_path_factory.mktemp('rb') / 'rb.db'}")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        loader.seed(s, demo_password="seed-pw")
        yield s


def _eval(db, land_id):
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
    return run_rules(load_land_context(db, land))


@pytest.mark.parametrize(
    "land_id,expected",
    [
        ("LP-10500", ["DUPLICATE_DEED"]),
        ("LP-10240", ["POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"]),
        ("LP-10001", []),
        ("LP-10100", []),
        ("LP-10234", []),
        ("LP-10300", []),
        ("LP-10400", []),
    ],
)
def test_seed_scenarios_exact_codes(db, land_id, expected):
    assert sorted(e.code for e in _eval(db, land_id)) == expected


def test_lp_10500_evidence_and_no_names(db):
    (e,) = _eval(db, "LP-10500")
    d = e.to_dict()
    assert d["severity"] == "HIGH" and d["params"]["deed_no"] == "D-2018-0500"
    assert d["params"]["transaction_count"] == 2 and len(d["params"]["transaction_ids"]) == 2
    assert not any(n in str(d) for n in ("Rahim", "Karim", "Hasan"))


def _ctx(txs=(), owners=(), area_=10.0, unit_="decimal"):
    # fixed as_of: time-based mutation rule (F1b) is exercised in test_mutation_rules.py
    return LandContext("LP-X", area_, unit_, tuple(owners), tuple(txs), as_of=date(2000, 1, 1))


def _tx(i, d=None, a=10.0, u="decimal", deed=None, status="RECORDED", s="a", b="b"):
    return TxRecord(i, s, b, d, a, u, status, deed)


# --- DUPLICATE_DEED
def test_deed_positive_case_and_whitespace_insensitive():
    out = duplicate_deed.evaluate(_ctx([_tx("1", deed="D-1"), _tx("2", deed=" d-1 ")]))
    assert len(out) == 1 and out[0].params["transaction_ids"] == ["1", "2"]


def test_deed_negative_distinct_missing_and_rejected():
    assert duplicate_deed.evaluate(_ctx([_tx("1", deed="D-1"), _tx("2", deed="D-2")])) == []
    assert duplicate_deed.evaluate(_ctx([_tx("1"), _tx("2")])) == []
    assert (
        duplicate_deed.evaluate(
            _ctx([_tx("1", deed="D-1"), _tx("2", deed="D-1", status="REJECTED")])
        )
        == []
    )


# --- AREA_MISMATCH
def test_area_positive_vs_parcel_and_vs_previous_tx():
    (e,) = area.evaluate(_ctx([_tx("1", a=12.0)]))
    assert e.params["previous_source"] == "PARCEL" and e.params["previous_area"] == 10.0
    (e,) = area.evaluate(_ctx([_tx("1", a=10.0), _tx("2", a=8.0)]))
    assert e.params["transaction_id"] == "2" and e.params["previous_source"] == "TRANSACTION"


def test_area_negative_equal_other_unit_rejected():
    assert area.evaluate(_ctx([_tx("1", a=10.0), _tx("2", a=10.0)])) == []
    assert area.evaluate(_ctx([_tx("1", a=12.0, u="katha")])) == []
    assert area.evaluate(_ctx([_tx("1", a=12.0, status="REJECTED")])) == []


# --- INCONSISTENT_OWNERSHIP
def _p(o, s, e):
    return OwnerPeriod(o, s, e)


def test_ownership_gap():
    out = ownership.evaluate(
        _ctx(owners=[_p("a", date(2000, 1, 1), date(2010, 1, 1)), _p("b", date(2010, 6, 1), None)])
    )
    assert [e.params["kind"] for e in out] == ["GAP"]


def test_ownership_overlap_closed_and_open_ended():
    out = ownership.evaluate(
        _ctx(owners=[_p("a", date(2000, 1, 1), date(2012, 1, 1)), _p("b", date(2010, 1, 1), None)])
    )
    assert [e.params["kind"] for e in out] == ["OVERLAP"]
    out = ownership.evaluate(
        _ctx(owners=[_p("a", date(2000, 1, 1), None), _p("b", date(2010, 1, 1), None)])
    )
    assert [e.params["kind"] for e in out] == ["OVERLAP"]


def test_ownership_negative_handover_coowners_undated_single():
    chain = [_p("a", date(2000, 1, 1), date(2010, 1, 1)), _p("b", date(2010, 1, 1), None)]
    assert ownership.evaluate(_ctx(owners=chain)) == []
    co = [_p("a", date(2000, 1, 1), None), _p("b", date(2000, 1, 1), None)]
    assert ownership.evaluate(_ctx(owners=co)) == []
    assert (
        ownership.evaluate(_ctx(owners=[_p("a", None, None), _p("b", date(2010, 1, 1), None)]))
        == []
    )
    assert ownership.evaluate(_ctx(owners=[_p("a", date(2000, 1, 1), None)])) == []


def test_ownership_no_gap_reported_when_open_ended_owner_precedes():
    out = ownership.evaluate(
        _ctx(
            owners=[
                _p("a", date(2000, 1, 1), None),
                _p("b", date(2005, 1, 1), date(2006, 1, 1)),
                _p("c", date(2008, 1, 1), None),
            ]
        )
    )
    assert all(e.params["kind"] == "OVERLAP" for e in out)


# --- REPEATED_SUSPICIOUS_TRANSACTIONS
def test_repeated_positive_three_in_window():
    txs = [_tx("1", date(2021, 1, 1)), _tx("2", date(2021, 2, 1)), _tx("3", date(2021, 3, 1))]
    (e,) = repeated.evaluate(_ctx(txs))
    assert e.params["transaction_count"] == 3 and e.params["transaction_ids"] == ["1", "2", "3"]


def test_repeated_negative_two_spread_rejected_undated():
    two = [_tx("1", date(2021, 1, 1)), _tx("2", date(2021, 1, 5))]
    assert repeated.evaluate(_ctx(two)) == []
    spread = [_tx("1", date(2015, 1, 1)), _tx("2", date(2018, 1, 1)), _tx("3", date(2021, 1, 1))]
    assert repeated.evaluate(_ctx(spread)) == []
    rej = [
        _tx("1", date(2021, 1, 1)),
        _tx("2", date(2021, 1, 2), status="REJECTED"),
        _tx("3", date(2021, 1, 3)),
    ]
    assert repeated.evaluate(_ctx(rej)) == []
    assert repeated.evaluate(_ctx([_tx("1"), _tx("2"), _tx("3")])) == []


# --- UNIT_MISMATCH
def test_unit_positive_flag_only():
    (e,) = unit.evaluate(_ctx([_tx("1", u="katha"), _tx("2")]))
    assert e.severity == "INFO" and e.params["units"] == ["decimal", "katha"]
    assert e.params["transaction_ids"] == ["1"]


def test_unit_negative_same_unit_or_rejected():
    assert unit.evaluate(_ctx([_tx("1"), _tx("2")])) == []
    assert unit.evaluate(_ctx([_tx("1", u="katha", status="REJECTED")])) == []


# --- cross-cutting
def test_clean_context_no_alerts():
    owners = [_p("a", date(2000, 1, 1), date(2010, 1, 1)), _p("b", date(2010, 1, 1), None)]
    txs = [_tx("1", date(2010, 1, 1), deed="D-1", s="a", b="b")]
    assert run_rules(_ctx(txs, owners)) == []


def test_every_evidence_complete_and_wording_safe():
    owners = [_p("a", date(2000, 1, 1), date(2010, 1, 1)), _p("b", date(2011, 1, 1), None)]
    txs = [
        _tx("1", date(2021, 1, 1), a=12.0, u="katha", deed="D-1", s="a"),
        _tx("2", date(2021, 1, 20), a=12.0, deed="D-1", s="a"),
        _tx("3", date(2021, 2, 1), a=9.0, deed="D-1", s="a"),
    ]
    out = run_rules(_ctx(txs, owners))
    assert {
        "DUPLICATE_DEED",
        "INCONSISTENT_OWNERSHIP",
        "AREA_MISMATCH",
        "REPEATED_SUSPICIOUS_TRANSACTIONS",
        "UNIT_MISMATCH",
    } <= {e.code for e in out}
    for e in out:
        d = e.to_dict()
        assert set(d) == {"code", "severity", "params"} and d["params"]
        assert not any(w in str(d).lower() for w in FORBIDDEN)


def test_config_covers_all_rule_codes():
    from app.risk.config import RULE_POINTS, RULE_SEVERITY

    codes = {
        "POSSIBLE_DUPLICATE_TRANSACTION",
        "SELLER_MISMATCH",
        "DUPLICATE_DEED",
        "INCONSISTENT_OWNERSHIP",
        "AREA_MISMATCH",
        "REPEATED_SUSPICIOUS_TRANSACTIONS",
        "UNIT_MISMATCH",
        "POSSIBLE_NAME_VARIANT",  # P43
        "LOW_EXTRACTION_CONFIDENCE",  # P49
        "ML_ANOMALY",  # P49
        "REGISTERED_NOT_MUTATED",  # F1b
        "MUTATION_PARTY_MISMATCH",
        "MUTATION_WITHOUT_DEED",
        "MUTATION_AREA_EXCEEDS_DEED",
        "ACTIVE_LITIGATION",  # F3a
        "KHAS_LAND",
        "UNDER_ACQUISITION",
        "ACTIVE_MORTGAGE",
        "RECORD_INTEGRITY_FAILED",  # F4c
        "DEED_NO_FORMAT_INVALID",  # F6
        "IMPOSSIBLE_DATE",
        "RAPID_RESALE",
        "SURVEY_CHAIN_GAP",  # F5c
        "HISTORICAL_CHAIN_GAP",  # H9c
        "HISTORICAL_SELLER_NOT_OWNER",
        "HISTORICAL_DAG_CONFLICT",  # H9d
        "HISTORICAL_CONSIDERATION_IMPLAUSIBLE",
    }
    assert codes == set(RULE_POINTS) == set(RULE_SEVERITY)
    assert RULE_POINTS["UNIT_MISMATCH"] == 0 and RULE_SEVERITY["UNIT_MISMATCH"] == "INFO"
