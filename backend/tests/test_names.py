from datetime import date

import pytest

from app.risk.context import Evidence, LandContext, OwnerPeriod, OwnerRef, TxRecord
from app.risk.rules import run_rules, seller
from app.services.names import (
    MERGE_MIN,
    VARIANT_MIN,
    can_auto_merge,
    is_name_variant,
    normalize_name,
    owner_similarity,
)


def test_normalize_strips_honorifics_punctuation_spacing_digits():
    assert normalize_name("  Md.  RAHIM   Uddin ") == "rahim uddin"
    assert normalize_name("মোঃ রহিম উদ্দিন") == normalize_name("মো. রহিম  উদ্দিন")
    assert normalize_name("Md.") == "md"  # never reduces a name to nothing
    assert normalize_name(None) == "" and normalize_name("  ") == ""


def test_romanisation_makes_bangla_comparable():
    assert normalize_name("রহিম") == "rohim"
    assert owner_similarity("Rahim", "রহিম") >= VARIANT_MIN


@pytest.mark.parametrize(
    ("a", "b", "low", "high"),
    [
        ("Rahim Uddin", "rahim  uddin", 1.0, 1.0),
        ("Md. Rahim Uddin", "Rahim Uddin", 1.0, 1.0),
        ("Rahim", "Rahim Uddin", VARIANT_MIN, MERGE_MIN - 0.01),
        ("Rahim", "রহিম", VARIANT_MIN, MERGE_MIN - 0.01),
        ("Karim Mia", "Karim Miah", MERGE_MIN, 1.0),
        ("Rahim", "Karim", 0.0, VARIANT_MIN - 0.01),
        ("Rahim Uddin", "Hasan Ali", 0.0, VARIANT_MIN - 0.01),
        ("Rahim", "", 0.0, 0.0),
    ],
)
def test_owner_similarity_ranges(a, b, low, high):
    assert low <= owner_similarity(a, b) <= high


def test_variant_needs_no_father_conflict():
    assert is_name_variant("Rahim", None, "Rahim Uddin", "Abdul Jabbar")
    assert is_name_variant("Rahim", "Abdul Jabbar", "Rahim Uddin", "Abdul Jabar")
    assert not is_name_variant("Rahim", "Nur Mohammad", "Rahim Uddin", "Abdul Jabbar")
    assert not is_name_variant("Rahim", None, "Karim Mia", None)


def test_auto_merge_requires_name_and_father_at_threshold():
    assert can_auto_merge("Md. Rahim Uddin", "Abdul Jabbar", "Rahim Uddin", "abdul  jabbar")
    assert can_auto_merge("Karim Mia", "Nur Mohammad", "Karim Miah", "Nur Mohammad")
    # similar names never merge without a father_name on both sides
    assert not can_auto_merge("Rahim Uddin", None, "Rahim Uddin", "Abdul Jabbar")
    assert not can_auto_merge("Rahim Uddin", "Abdul Jabbar", "Rahim Uddin", None)
    # name below MERGE_MIN even though father matches
    assert not can_auto_merge("Rahim", "Abdul Jabbar", "Rahim Uddin", "Abdul Jabbar")
    assert not can_auto_merge("রহিম", "Abdul Jabbar", "Rahim", "Abdul Jabbar")
    # identical name, different father -> different people
    assert not can_auto_merge("Rahim Uddin", "Nur Mohammad", "Rahim Uddin", "Abdul Jabbar")


def _ctx(seller_ref, recorded_ref, owners=None):
    owners = owners or {"s": seller_ref, "a": recorded_ref}
    return LandContext(
        "LP-X", 10.0, "decimal",
        (OwnerPeriod("a", date(2000, 1, 1), None),),
        (TxRecord("t1", "s", "b", date(2020, 1, 1), 10.0, "decimal"),),
        owners,
        as_of=date(2000, 1, 1),
    )  # fmt: skip


def test_seller_rule_emits_variant_instead_of_hard_mismatch():
    ev = seller.evaluate(_ctx(OwnerRef("Rahim"), OwnerRef("Rahim Uddin", "Abdul Jabbar")))
    assert [e.code for e in ev] == ["POSSIBLE_NAME_VARIANT"]
    e = ev[0]
    assert e.severity == "INFO" and e.params["recorded_owner_ids"] == ["a"]
    assert 0.7 <= e.params["similarity"] < 0.9
    assert "Rahim" not in str(e.to_dict())  # ids only, no names in evidence


def test_seller_rule_bangla_variant():
    ev = seller.evaluate(_ctx(OwnerRef("রহিম"), OwnerRef("Rahim", None)))
    assert [e.code for e in ev] == ["POSSIBLE_NAME_VARIANT"]


@pytest.mark.parametrize(
    ("s", "r"),
    [
        (OwnerRef("Rahim"), OwnerRef("Karim Mia", "Nur Mohammad")),  # different person
        (OwnerRef("Rahim", "Nur Mohammad"), OwnerRef("Rahim Uddin", "Abdul Jabbar")),  # father
    ],
)
def test_seller_rule_keeps_hard_mismatch(s, r):
    ev = seller.evaluate(_ctx(s, r))
    assert [e.code for e in ev] == ["SELLER_MISMATCH"] and ev[0].severity == "HIGH"


def test_seller_rule_without_names_stays_hard_mismatch():
    ctx = _ctx(None, None, owners={})
    assert [e.code for e in seller.evaluate(ctx)] == ["SELLER_MISMATCH"]


def test_variant_scores_no_points_and_is_registered():
    from app.risk.config import RULE_POINTS, RULE_SEVERITY
    from app.risk.scoring import score_evidence

    assert RULE_POINTS["POSSIBLE_NAME_VARIANT"] == 0
    assert RULE_SEVERITY["POSSIBLE_NAME_VARIANT"] == "INFO"
    ev = run_rules(_ctx(OwnerRef("Rahim"), OwnerRef("Rahim Uddin", "Abdul Jabbar")))
    assert isinstance(ev[0], Evidence)
    assert score_evidence(ev).overall_score == 0
