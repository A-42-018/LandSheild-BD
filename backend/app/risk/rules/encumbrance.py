"""Encumbrance rules (F3a). Wording is "recorded"/"possible"; only ACTIVE entries count.

ACTIVE_LITIGATION   an active court case is recorded against the parcel
KHAS_LAND           the parcel is recorded as khas (government) land
UNDER_ACQUISITION   an active acquisition is recorded for the parcel
ACTIVE_MORTGAGE     an active mortgage is recorded (informational, 0 points)
"""

from app.risk.config import RULE_SEVERITY
from app.risk.context import EncRecord, Evidence, LandContext

ACTIVE = "ACTIVE"
CODE_BY_TYPE = {
    "COURT_CASE": "ACTIVE_LITIGATION",
    "KHAS": "KHAS_LAND",
    "ACQUISITION": "UNDER_ACQUISITION",
    "MORTGAGE": "ACTIVE_MORTGAGE",
}


def _ev(e: EncRecord) -> Evidence:
    code = CODE_BY_TYPE[e.type]
    return Evidence(
        code,
        RULE_SEVERITY[code],
        {"encumbrance_id": e.id, "reference_no": e.reference_no, "authority": e.authority},
    )


def evaluate(ctx: LandContext) -> list[Evidence]:
    return [_ev(e) for e in ctx.encumbrances if e.status == ACTIVE and e.type in CODE_BY_TYPE]
