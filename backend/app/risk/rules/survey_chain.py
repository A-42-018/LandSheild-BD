"""SURVEY_CHAIN_GAP (F5c): an owner in a later survey (CS < SA < RS < BS) has no recorded link
to the holders of the earlier survey.

A later-survey owner is "linked" when their name matches an earlier-survey owner (same person,
spelling variants allowed) or when the recorded transfers lead from an earlier owner to them
(any number of hops). Otherwise one evidence per (earlier, later) survey pair is emitted, with
counts only: it may be an inheritance or an unrecorded transfer, so wording stays "possible".
"""

from app.risk.config import RULE_SEVERITY
from app.risk.context import SURVEY_TYPES, Evidence, LandContext, active_transactions
from app.services.names import VARIANT_MIN, owner_similarity

CODE = "SURVEY_CHAIN_GAP"


def _matches(name: str, others: list[str]) -> bool:
    return any(owner_similarity(name, o) >= VARIANT_MIN for o in others)


def _reachable(ctx: LandContext, start: list[str]) -> list[str]:
    """Earlier-survey owners plus everyone they (transitively) sold to in the recorded transfers."""
    reach = list(start)
    moves = [
        (ctx.owners[t.seller_id].name, ctx.owners[t.buyer_id].name)
        for t in active_transactions(ctx, include_historical=True)  # H9a: deeds are chain links
        if t.seller_id in ctx.owners and t.buyer_id in ctx.owners
    ]
    changed = True
    while changed:
        changed = False
        for seller, buyer in moves:
            if _matches(seller, reach) and not _matches(buyer, reach):
                reach.append(buyer)
                changed = True
    return reach


def evaluate(ctx: LandContext) -> list[Evidence]:
    by_survey: dict[str, list] = {}
    for rec in ctx.survey_records:
        by_survey.setdefault(rec.survey_type, []).append(rec)
    present = [s for s in SURVEY_TYPES if s in by_survey]
    out: list[Evidence] = []
    for earlier, later in zip(present, present[1:], strict=False):
        reach = _reachable(ctx, [n for r in by_survey[earlier] for n in r.owner_names])
        later_names = sorted({n for r in by_survey[later] for n in r.owner_names})
        unlinked = [n for n in later_names if not _matches(n, reach)]
        if unlinked:
            out.append(
                Evidence(
                    CODE,
                    RULE_SEVERITY[CODE],
                    {
                        "from_survey": earlier,
                        "to_survey": later,
                        "unlinked_owners": len(unlinked),
                        "owners_in_later_survey": len(later_names),
                        "document_ids": [r.document_id for r in by_survey[later]],
                    },
                )
            )
    return out
