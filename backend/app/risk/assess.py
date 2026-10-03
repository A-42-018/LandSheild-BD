"""Single entry point: rules + optional ML hint -> RiskScore (used by risk, public endpoints)."""

from app.risk import ml
from app.risk.context import LandContext
from app.risk.rules import run_rules
from app.risk.scoring import RiskScore, score_evidence


def assess(ctx: LandContext) -> RiskScore:
    return score_evidence(run_rules(ctx), ml_score=ml.ml_score_for(ctx))
