"""RECORD_INTEGRITY_FAILED (F4c): a record of this parcel no longer matches the hash-chained
ledger entry written when it was approved. Wording stays "possible"; the cause is not asserted."""

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext

CODE = "RECORD_INTEGRITY_FAILED"


def evaluate(ctx: LandContext) -> list[Evidence]:
    if not ctx.integrity_failures:
        return []
    kind, eid = ctx.integrity_failures[0]
    return [
        Evidence(
            CODE, RULE_SEVERITY[CODE],
            {"count": len(ctx.integrity_failures), "entity_type": kind, "entity_id": eid},
        )  # fmt: skip
    ]
