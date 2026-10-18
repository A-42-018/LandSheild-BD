"""Historical-deed rules (H9c). They compare an approved historical deed (a past chain-of-title
link, H9a) with the CS / SA khatian owners of the same parcel. Both only *flag*; wording stays
"possible" (a spelling variant, an inheritance or an unrecorded transfer explains many cases).

* HISTORICAL_SELLER_NOT_OWNER - the deed's seller matches no CS/SA khatian owner (fuzzy name match,
  Bangla spelling variants allowed) and is not reachable from one through the recorded transfers.
* HISTORICAL_CHAIN_GAP - the seller *is* anchored to a CS/SA khatian, but the deed's buyer (and
  whoever they sold to) matches no owner of the later CS/SA khatian. With CS only, or when the
  seller is anchored to the latest CS/SA khatian, nothing later exists, so no gap is reported.

* HISTORICAL_DAG_CONFLICT (H9d) - a later historical deed claims a dag (or, when a deed lists no
  dag, the same khatian) already conveyed by an earlier deed, but its seller is neither the earlier
  buyer nor anyone the earlier buyer sold to: a different seller chain.
* HISTORICAL_CONSIDERATION_IMPLAUSIBLE (H9d) - a sale's price is in the wrong currency for its era,
  or its price per decimal is outside the era's range (`CONSIDERATION_PER_DECIMAL`). Flag only.

Evidence carries ids, surveys, dag numbers, the deed date and money, never a name.
"""

from app.risk.config import CONSIDERATION_PER_DECIMAL, ERA_CURRENCIES, RULE_SEVERITY
from app.risk.context import Evidence, HistoricalDeedInfo, HistoricalLink, LandContext
from app.risk.rules.survey_chain import _matches, _reachable

SELLER_CODE = "HISTORICAL_SELLER_NOT_OWNER"
GAP_CODE = "HISTORICAL_CHAIN_GAP"
DAG_CODE = "HISTORICAL_DAG_CONFLICT"
PRICE_CODE = "HISTORICAL_CONSIDERATION_IMPLAUSIBLE"
SALE_KIND = "SALE_SAF_KABALA"
KHATIAN_SURVEYS = ("CS", "SA")  # oldest first


def _by_survey(ctx: LandContext) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for rec in ctx.survey_records:
        if rec.survey_type in KHATIAN_SURVEYS:
            out.setdefault(rec.survey_type, []).extend(rec.owner_names)
    return out


def _base(link: HistoricalLink) -> dict:
    return {
        "transaction_id": link.transaction_id,
        "document_id": link.document_id,
        "transaction_date": link.start_date.isoformat() if link.start_date else None,
    }


def _overlap(a: HistoricalDeedInfo, b: HistoricalDeedInfo) -> tuple[str, list[str]] | None:
    """How two deeds touch the same land: shared dag numbers, else (only when one of them lists
    no dag) the same survey + khatian. None = they do not overlap."""
    dags = sorted(set(a.dags) & set(b.dags))
    if dags:
        return "DAG", dags
    if (not a.dags or not b.dags) and set(a.khatians) & set(b.khatians):
        return "KHATIAN", []
    return None


def _dag_conflicts(ctx: LandContext) -> list[Evidence]:
    deeds = [d for d in ctx.historical_deeds if d.deed_date is not None]
    deeds.sort(key=lambda d: (d.deed_date, d.transaction_id))
    out: list[Evidence] = []
    for i, later in enumerate(deeds):
        seller = ctx.owners.get(later.seller_id)
        if seller is None:
            continue
        for earlier in deeds[:i]:
            hit = _overlap(earlier, later)
            buyer = ctx.owners.get(earlier.buyer_id)
            if hit is None or buyer is None or earlier.deed_date == later.deed_date:
                continue
            if _matches(seller.name, _reachable(ctx, [buyer.name])):
                continue  # the later seller is the earlier buyer, or bought from them
            out.append(
                Evidence(
                    DAG_CODE,
                    RULE_SEVERITY[DAG_CODE],
                    {
                        "transaction_id": later.transaction_id,
                        "document_id": later.document_id,
                        "earlier_document_id": earlier.document_id,
                        "transaction_date": later.deed_date.isoformat(),
                        "earlier_date": earlier.deed_date.isoformat(),
                        "basis": hit[0],
                        "dags": hit[1],
                    },
                )
            )
    return out


def _consideration(ctx: LandContext) -> list[Evidence]:
    out: list[Evidence] = []
    for d in ctx.historical_deeds:
        if d.kind != SALE_KIND or not d.amount or d.amount <= 0 or d.era not in ERA_CURRENCIES:
            continue
        base = {
            "transaction_id": d.transaction_id,
            "document_id": d.document_id,
            "transaction_date": d.deed_date.isoformat() if d.deed_date else None,
            "era": d.era,
            "currency": d.currency,
        }
        if d.currency and d.currency not in ERA_CURRENCIES[d.era]:
            out.append(Evidence(PRICE_CODE, RULE_SEVERITY[PRICE_CODE], {**base, "reason": "CURRENCY_ERA"}))
            continue
        if not d.area_decimal:
            continue
        rate = d.amount / d.area_decimal
        low, high = CONSIDERATION_PER_DECIMAL[d.era]
        if rate < low or rate > high:
            out.append(
                Evidence(
                    PRICE_CODE,
                    RULE_SEVERITY[PRICE_CODE],
                    {
                        **base,
                        "reason": "BELOW_RANGE" if rate < low else "ABOVE_RANGE",
                        "per_decimal": round(rate, 2),
                        "range_low": low,
                        "range_high": high,
                    },
                )
            )
    return out


def evaluate(ctx: LandContext) -> list[Evidence]:
    return _khatian_rules(ctx) + _dag_conflicts(ctx) + _consideration(ctx)


def _khatian_rules(ctx: LandContext) -> list[Evidence]:
    surveys = _by_survey(ctx)
    present = [s for s in KHATIAN_SURVEYS if s in surveys]
    if not present or not ctx.historical_links:
        return []
    out: list[Evidence] = []
    for link in ctx.historical_links:
        seller = ctx.owners.get(link.seller_id)
        buyer = ctx.owners.get(link.buyer_id)
        if seller is None or buyer is None:
            continue
        # Latest CS/SA khatian the seller is anchored to (directly or via recorded transfers).
        anchor = None
        for s in present:
            if _matches(seller.name, _reachable(ctx, surveys[s])):
                anchor = s
        if anchor is None:
            out.append(
                Evidence(
                    SELLER_CODE,
                    RULE_SEVERITY[SELLER_CODE],
                    {**_base(link), "surveys": list(present)},
                )
            )
            continue
        later = [s for s in present if KHATIAN_SURVEYS.index(s) > KHATIAN_SURVEYS.index(anchor)]
        if not later:
            continue
        forward = _reachable(ctx, [buyer.name])
        later_names = sorted({n for s in later for n in surveys[s]})
        if not any(_matches(n, forward) for n in later_names):
            out.append(
                Evidence(
                    GAP_CODE,
                    RULE_SEVERITY[GAP_CODE],
                    {**_base(link), "from_survey": anchor, "to_survey": later[-1]},
                )
            )
    return out
