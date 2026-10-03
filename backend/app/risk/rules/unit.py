"""UNIT_MISMATCH (R3): parcel and transactions use different area units. Flag only, 0 points,
no unit conversion."""

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext, active_transactions

CODE = "UNIT_MISMATCH"


def evaluate(ctx: LandContext) -> list[Evidence]:
    differing = [t for t in active_transactions(ctx) if t.area_unit != ctx.area_unit]
    if not differing:
        return []
    return [
        Evidence(
            CODE,
            RULE_SEVERITY[CODE],
            {
                "parcel_unit": ctx.area_unit,
                "units": sorted({ctx.area_unit, *(t.area_unit for t in differing)}),
                "transaction_ids": [t.id for t in differing],
            },
        )
    ]
