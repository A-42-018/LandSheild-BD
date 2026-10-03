"""DUPLICATE_DEED (R3): the same deed_no is used by more than one non-rejected transaction.

Scope: transactions of this parcel (the context is per-parcel). deed_no is compared after
trimming and case-folding; transactions without a deed are ignored.
"""

from collections import defaultdict

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext, TxRecord, active_transactions

CODE = "DUPLICATE_DEED"


def evaluate(ctx: LandContext) -> list[Evidence]:
    groups: dict[str, list[TxRecord]] = defaultdict(list)
    for t in active_transactions(ctx):
        key = (t.deed_no or "").strip().casefold()
        if key:
            groups[key].append(t)
    out: list[Evidence] = []
    for txs in groups.values():
        if len(txs) < 2:
            continue
        out.append(
            Evidence(
                CODE,
                RULE_SEVERITY[CODE],
                {
                    "deed_no": (txs[0].deed_no or "").strip(),
                    "transaction_ids": [t.id for t in txs],
                    "transaction_count": len(txs),
                },
            )
        )
    return out
