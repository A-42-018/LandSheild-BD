"""LOW_EXTRACTION_CONFIDENCE (R3): a pending document has a required field below the threshold.

Review flag only: 0 points, INFO, never creates an alert. Field names are schema identifiers
(e.g. land_area), never extracted values.
"""

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext

CODE = "LOW_EXTRACTION_CONFIDENCE"


def evaluate(ctx: LandContext) -> list[Evidence]:
    if not ctx.low_confidence_docs:
        return []
    fields = sorted({f for d in ctx.low_confidence_docs for f in d.fields})
    return [
        Evidence(
            CODE,
            RULE_SEVERITY[CODE],
            {"document_count": len(ctx.low_confidence_docs), "fields": fields},
        )
    ]
