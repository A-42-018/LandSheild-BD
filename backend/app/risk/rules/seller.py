"""SELLER_MISMATCH (R3): seller is not a recorded owner at the transaction date.

Owner identity is by owner_id only; similar names are never treated as the same person. When the
seller's name is only a possible variant of a recorded owner (P43, no father_name conflict) the
result is POSSIBLE_NAME_VARIANT (INFO, review required) instead of a hard SELLER_MISMATCH.

A period covers date D when start <= D and (end is None or D <= end),
so the outgoing owner on the transfer date still counts. Transactions with no date, or with no
recorded owner at that date, cannot be assessed and are skipped.
"""

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext, active_transactions
from app.services.names import is_name_variant, owner_similarity

CODE = "SELLER_MISMATCH"
VARIANT_CODE = "POSSIBLE_NAME_VARIANT"


def _variants(ctx: LandContext, seller_id: str, recorded: set[str]) -> list[tuple[str, float]]:
    seller = ctx.owners.get(seller_id)
    if seller is None:
        return []
    found = []
    for oid in sorted(recorded):
        rec = ctx.owners.get(oid)
        if rec and is_name_variant(seller.name, seller.father_name, rec.name, rec.father_name):
            found.append((oid, owner_similarity(seller.name, rec.name)))
    return found


def evaluate(ctx: LandContext) -> list[Evidence]:
    out: list[Evidence] = []
    for t in active_transactions(ctx):
        d = t.transaction_date
        if d is None:
            continue
        recorded = {
            p.owner_id
            for p in ctx.ownership
            if (p.start_date is None or p.start_date <= d)
            and (p.end_date is None or d <= p.end_date)
        }
        if not recorded or t.seller_id in recorded:
            continue
        variants = _variants(ctx, t.seller_id, recorded)
        if variants:
            out.append(
                Evidence(
                    VARIANT_CODE,
                    RULE_SEVERITY[VARIANT_CODE],
                    {
                        "transaction_id": t.id,
                        "transaction_date": d.isoformat(),
                        "seller_owner_id": t.seller_id,
                        "recorded_owner_ids": [oid for oid, _ in variants],
                        "similarity": max(s for _, s in variants),
                    },
                )
            )
            continue
        out.append(
            Evidence(
                CODE,
                RULE_SEVERITY[CODE],
                {
                    "transaction_id": t.id,
                    "transaction_date": d.isoformat(),
                    "seller_owner_id": t.seller_id,
                    "recorded_owner_ids": sorted(recorded),
                },
            )
        )
    return out
