"""F6: forged-document plausibility rules (pure rule tests, no DB)."""

from datetime import date, timedelta

import pytest

from app.risk.config import RULE_POINTS, RULE_SEVERITY
from app.risk.context import LandContext, OwnerPeriod, TxRecord
from app.risk.rules import plausibility

FORBIDDEN = ("fraud confirmed", "proven", "forged", "illegal", "guilty")


def _tx(i, d, deed="D-2021-0240", s="a", b="b", status="RECORDED"):
    return TxRecord(i, s, b, d, 10.0, "decimal", status, deed)


def _ctx(txs, owners):
    return LandContext("LP-X", 10.0, "decimal", tuple(owners), tuple(txs))


def _codes(ctx):
    return [e.code for e in plausibility.evaluate(ctx)]


def test_registered_points_and_severity():
    assert (
        RULE_POINTS["DEED_NO_FORMAT_INVALID"] == 15
        and RULE_SEVERITY["DEED_NO_FORMAT_INVALID"] == "MEDIUM"
    )
    assert RULE_POINTS["IMPOSSIBLE_DATE"] == 30 and RULE_SEVERITY["IMPOSSIBLE_DATE"] == "HIGH"
    assert RULE_POINTS["RAPID_RESALE"] == 15 and RULE_SEVERITY["RAPID_RESALE"] == "MEDIUM"


@pytest.mark.parametrize(
    "no", ["D-2021-0240", "D-1", "1234/2021", "1234", "১২৩৪", "ঢা-১২৩৪"[2:], "D 77"]
)
def test_valid_deed_numbers(no):
    owners = [OwnerPeriod("a", date(2010, 1, 1), None)]
    assert _codes(_ctx([_tx("t", date(2020, 1, 1), deed=no)], owners)) == []


@pytest.mark.parametrize("no", ["X", "abc", "D-20!1", "####", "12 34 56 78 90 12 34"])
def test_invalid_deed_numbers(no):
    owners = [OwnerPeriod("a", date(2010, 1, 1), None)]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", date(2020, 1, 1), deed=no)], owners))
    assert ev.code == "DEED_NO_FORMAT_INVALID" and ev.params["transaction_id"] == "t"


def test_missing_deed_no_is_not_flagged():
    owners = [OwnerPeriod("a", date(2010, 1, 1), None)]
    assert _codes(_ctx([_tx("t", date(2020, 1, 1), deed=None)], owners)) == []


def test_future_date():
    d = date.today() + timedelta(days=30)
    owners = [OwnerPeriod("a", date(2010, 1, 1), None)]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", d)], owners))
    assert (ev.code, ev.params["reason"]) == ("IMPOSSIBLE_DATE", "FUTURE")


def test_before_seller_acquired():
    owners = [
        OwnerPeriod("x", date(2010, 1, 1), date(2019, 12, 31)),
        OwnerPeriod("a", date(2020, 1, 1), None),
    ]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", date(2015, 6, 1))], owners))
    assert ev.params["reason"] == "BEFORE_SELLER_ACQUIRED"


def test_before_record_origin():
    owners = [OwnerPeriod("x", date(2010, 1, 1), None)]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", date(2005, 6, 1), s="x")], owners))
    assert (
        ev.params["reason"] == "BEFORE_SELLER_ACQUIRED"
        or ev.params["reason"] == "BEFORE_RECORD_ORIGIN"
    )


def test_before_record_origin_for_unrecorded_seller():
    owners = [OwnerPeriod("x", date(2010, 1, 1), None)]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", date(2005, 6, 1), s="zzz")], owners))
    assert ev.params["reason"] == "BEFORE_RECORD_ORIGIN"


def test_seller_who_bought_by_transaction_is_not_before_acquired():
    owners = [
        OwnerPeriod("x", date(2010, 1, 1), date(2020, 1, 1)),
        OwnerPeriod("a", date(2021, 1, 1), None),
    ]
    txs = [
        _tx("t1", date(2018, 1, 1), s="x", b="a", deed="D-1"),
        _tx("t2", date(2019, 6, 1), s="a", b="c", deed="D-2"),
    ]
    assert "IMPOSSIBLE_DATE" not in _codes(_ctx(txs, owners))


def test_rapid_resale_by_period():
    owners = [OwnerPeriod("a", date(2021, 1, 1), None)]
    (ev,) = plausibility.evaluate(_ctx([_tx("t", date(2021, 2, 1))], owners))
    assert (
        ev.code == "RAPID_RESALE"
        and ev.params["held_days"] == 31
        and ev.params["threshold_days"] == 60
    )


def test_rapid_resale_by_previous_transaction():
    owners = [OwnerPeriod("x", date(2010, 1, 1), None)]
    txs = [
        _tx("t1", date(2020, 1, 1), s="x", b="a", deed="D-1"),
        _tx("t2", date(2020, 2, 1), s="a", b="c", deed="D-2"),
    ]
    evs = [e for e in plausibility.evaluate(_ctx(txs, owners)) if e.code == "RAPID_RESALE"]
    assert len(evs) == 1 and evs[0].params["transaction_id"] == "t2"


def test_slow_resale_and_rejected_are_not_flagged():
    owners = [OwnerPeriod("a", date(2021, 1, 1), None)]
    assert _codes(_ctx([_tx("t", date(2021, 6, 1))], owners)) == []
    assert _codes(_ctx([_tx("t", date(2021, 1, 20), status="REJECTED")], owners)) == []


def test_no_forbidden_words_and_no_names():
    owners = [OwnerPeriod("a", date(2021, 1, 1), None)]
    evs = plausibility.evaluate(_ctx([_tx("t", date(2021, 1, 20), deed="X")], owners))
    assert evs and not any(w in str(e.to_dict()).lower() for e in evs for w in FORBIDDEN)
