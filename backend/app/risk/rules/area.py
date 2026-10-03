"""AREA_MISMATCH (R3): a transaction's area differs from the previous recorded area (same unit).

Baseline for each transaction = area of the previous non-rejected same-unit transaction, else the
parcel's recorded area. Different units are never compared (UNIT_MISMATCH covers that).
"""

from app.risk.config import AREA_EPS, RULE_SEVERITY
from app.risk.context import Evidence, LandContext, active_transactions

CODE = "AREA_MISMATCH"


def evaluate(ctx: LandContext) -> list[Evidence]:
    out: list[Evidence] = []
    prev_area = ctx.area
    source = "PARCEL"
    for t in active_transactions(ctx):
        if t.area_unit != ctx.area_unit:
            continue
        if abs(t.area - prev_area) > AREA_EPS:
            out.append(
                Evidence(
                    CODE,
                    RULE_SEVERITY[CODE],
                    {
                        "transaction_id": t.id,
                        "document_area": t.area,
                        "previous_area": prev_area,
                        "previous_source": source,
                        "area_unit": ctx.area_unit,
                    },
                )
            )
        prev_area = t.area
        source = "TRANSACTION"
    return out
