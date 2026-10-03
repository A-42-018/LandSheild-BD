"""POSSIBLE_DUPLICATE_TRANSACTION (R3).

Same seller, >=2 non-rejected transactions, and the first conveys the full recorded area or the
total conveyed area exceeds it. Same-unit only (no conversion).
"""

from collections import defaultdict

from app.risk.config import AREA_EPS, RULE_SEVERITY
from app.risk.context import Evidence, LandContext, TxRecord, active_transactions

CODE = "POSSIBLE_DUPLICATE_TRANSACTION"


def evaluate(ctx: LandContext) -> list[Evidence]:
    by_seller: dict[str, list[TxRecord]] = defaultdict(list)
    for t in active_transactions(ctx):
        if t.area_unit == ctx.area_unit:
            by_seller[t.seller_id].append(t)

    out: list[Evidence] = []
    for seller_id, txs in by_seller.items():
        if len(txs) < 2:
            continue
        total = sum(t.area for t in txs)
        first_full = txs[0].area >= ctx.area - AREA_EPS
        if first_full or total > ctx.area + AREA_EPS:
            out.append(
                Evidence(
                    CODE,
                    RULE_SEVERITY[CODE],
                    {
                        "seller_owner_id": seller_id,
                        "transaction_ids": [t.id for t in txs],
                        "transaction_count": len(txs),
                        "total_area": total,
                        "recorded_area": ctx.area,
                        "area_unit": ctx.area_unit,
                        "first_conveys_full_area": first_full,
                    },
                )
            )
    return out
