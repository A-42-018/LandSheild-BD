import pytest

from app.risk.config import RULE_POINTS, SCORE_CAP
from app.risk.context import Evidence
from app.risk.scoring import level_for, score_evidence


def _ev(code):
    return Evidence(code, "HIGH", {})


@pytest.mark.parametrize(
    "score,level",
    [(0, "LOW"), (29, "LOW"), (30, "MEDIUM"), (59, "MEDIUM"), (60, "HIGH"), (100, "HIGH")],
)
def test_level_boundaries(score, level):
    assert level_for(score) == level


def test_sum_from_config():
    r = score_evidence([_ev("POSSIBLE_DUPLICATE_TRANSACTION"), _ev("SELLER_MISMATCH")])
    assert r.rule_score == r.overall_score == 70
    assert r.level == "HIGH"
    expected = RULE_POINTS["POSSIBLE_DUPLICATE_TRANSACTION"] + RULE_POINTS["SELLER_MISMATCH"]
    assert r.overall_score == expected


def test_cap_at_100():
    r = score_evidence([_ev(c) for c in RULE_POINTS if RULE_POINTS[c]] * 2)
    assert r.rule_score > SCORE_CAP and r.overall_score == SCORE_CAP and r.level == "HIGH"


def test_zero_point_and_unknown_codes_add_nothing():
    r = score_evidence([_ev("UNIT_MISMATCH"), _ev("SOMETHING_NEW")])
    assert r.overall_score == 0 and r.level == "LOW" and len(r.evidence) == 2


def test_empty_is_low():
    r = score_evidence([])
    assert (r.overall_score, r.level) == (0, "LOW")
