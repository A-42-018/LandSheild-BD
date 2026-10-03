"""Pure risk aggregation (R3). Weights come from app/risk/config.py only."""

from dataclasses import dataclass

from app.risk.config import (
    LEVEL_THRESHOLDS,
    ML_MAX_POINTS,
    ML_MIN_SCORE,
    RULE_POINTS,
    RULE_SEVERITY,
    SCORE_CAP,
)
from app.risk.context import Evidence


@dataclass(frozen=True)
class RiskScore:
    rule_score: int  # uncapped sum of rule points (ML excluded)
    overall_score: int  # rules + ML, capped at SCORE_CAP and never lifted into HIGH by ML alone
    level: str
    evidence: tuple[Evidence, ...]
    ml_score: float | None = None  # raw 0..1 anomaly score, None when ML was skipped
    ml_points: int = 0  # points ML actually added to overall_score


def points_for(code: str) -> int:
    return RULE_POINTS.get(code, 0)


def level_for(score: int) -> str:
    for floor, level in LEVEL_THRESHOLDS:
        if score >= floor:
            return level
    return LEVEL_THRESHOLDS[-1][1]


def ml_points_for(ml_score: float | None) -> int:
    """0..ML_MAX_POINTS, linear from ML_MIN_SCORE (0) to 1.0 (max). None/low score -> 0."""
    if ml_score is None or ml_score <= ML_MIN_SCORE:
        return 0
    frac = min(1.0, (ml_score - ML_MIN_SCORE) / (1.0 - ML_MIN_SCORE))
    return min(ML_MAX_POINTS, round(ML_MAX_POINTS * frac))


def score_evidence(evidence: list[Evidence], ml_score: float | None = None) -> RiskScore:
    """Rule points + optional ML points (cap ML_MAX_POINTS).

    ML cannot alone create HIGH: when the rule-only level is below HIGH, the total is held one
    point under the HIGH threshold. ML_ANOMALY evidence (INFO) is appended only when ML would
    add points; its params carry the raw score and the points actually applied.
    """
    rule_total = sum(points_for(e.code) for e in evidence)
    rule_overall = min(rule_total, SCORE_CAP)
    raw_ml = ml_points_for(ml_score)
    total = min(rule_total + raw_ml, SCORE_CAP)
    high_floor, high_level = LEVEL_THRESHOLDS[0]
    if level_for(rule_overall) != high_level and total >= high_floor:
        total = high_floor - 1
    applied = total - rule_overall
    items = list(evidence)
    if raw_ml > 0 and ml_score is not None:
        items.append(
            Evidence(
                "ML_ANOMALY",
                RULE_SEVERITY["ML_ANOMALY"],
                {"score": round(ml_score, 4), "points": applied},
            )
        )
    return RiskScore(
        rule_total,
        total,
        level_for(total),
        tuple(items),
        ml_score=ml_score,
        ml_points=applied,
    )
