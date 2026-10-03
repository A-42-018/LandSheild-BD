"""ML anomaly hint for the risk engine (P49). Optional: any failure -> skipped with a log.

`build_feature_rows` is pure (no scikit-learn import) and maps a LandContext to the 8 R3 features
of ai.fraud_detection, one row per non-rejected transaction. `ml_score_for` scores them and
returns the highest score (the most unusual transaction on the parcel), or None when ML is off,
the parcel has no transactions, or the model / scikit-learn is unavailable.
"""

import logging
from collections import Counter

from app.core.config import get_settings
from app.risk.config import ML_NEUTRAL_DURATION_DAYS
from app.risk.context import LandContext, active_transactions
from app.services.names import owner_similarity

log = logging.getLogger(__name__)
_WARNED = False


def _covers(start, end, d) -> bool:
    return (start is None or start <= d) and (end is None or d <= end)


def build_feature_rows(ctx: LandContext) -> list[dict[str, float]]:
    txs = active_transactions(ctx)
    deeds = Counter(t.deed_no.strip().casefold() for t in txs if t.deed_no and t.deed_no.strip())
    rows: list[dict[str, float]] = []
    prev_area = ctx.area  # same baseline as the AREA_MISMATCH rule
    for i, t in enumerate(txs):
        earlier = txs[:i]
        d = t.transaction_date

        area_diff = 0.0
        if t.area_unit == ctx.area_unit:
            if prev_area > 0:
                area_diff = abs(t.area - prev_area) / prev_area
            prev_area = t.area

        duration = float(ML_NEUTRAL_DURATION_DAYS)
        similarity = 1.0
        if d is not None:
            periods = [p for p in ctx.ownership if _covers(p.start_date, p.end_date, d)]
            recorded = {p.owner_id for p in periods}
            held = [p for p in periods if p.owner_id == t.seller_id and p.start_date is not None]
            if held:
                duration = float(max(0, (d - min(p.start_date for p in held)).days))
            if recorded and t.seller_id not in recorded:
                seller = ctx.owners.get(t.seller_id)
                names = [ctx.owners[o].name for o in recorded if o in ctx.owners]
                similarity = (
                    max((owner_similarity(seller.name, n) for n in names), default=0.0)
                    if seller
                    else 0.0
                )

        deed_key = t.deed_no.strip().casefold() if t.deed_no else ""
        rows.append(
            {
                "transaction_count": float(len(txs)),
                "ownership_duration": duration,
                "area_difference": float(area_diff),
                "seller_history_count": float(sum(e.seller_id == t.seller_id for e in earlier)),
                "buyer_history_count": float(
                    sum(t.buyer_id in (e.buyer_id, e.seller_id) for e in earlier)
                ),
                "owner_similarity": float(similarity),
                # No parsed document comparison exists at parcel level: neutral value.
                "document_similarity": 1.0,
                "duplicate_deed_signal": 1.0 if deed_key and deeds[deed_key] > 1 else 0.0,
            }
        )
    return rows


def _skip(reason: str) -> None:
    global _WARNED
    if _WARNED:
        log.debug("ML scoring skipped: %s", reason)
    else:
        _WARNED = True
        log.warning("ML scoring skipped (rules only): %s", reason)


def ml_score_for(ctx: LandContext) -> float | None:
    settings = get_settings()
    if settings.ml_scoring.strip().lower() != "on":
        return None
    rows = build_feature_rows(ctx)
    if not rows:
        return None
    try:
        from ai.fraud_detection import score_many  # optional extra: needs scikit-learn

        path = settings.ml_model_path.strip()
        scores = score_many(rows, path) if path else score_many(rows)
    except Exception as e:  # missing scikit-learn / model file, corrupt pickle, bad features
        _skip(f"{type(e).__name__}: {e}")
        return None
    return round(max(scores), 4)
