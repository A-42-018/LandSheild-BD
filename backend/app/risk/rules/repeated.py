"""REPEATED_SUSPICIOUS_TRANSACTIONS (R3): many transfers of one parcel in a short window.

Triggers when >= REPEATED_TX_MIN_COUNT dated non-rejected transactions fall within
REPEATED_TX_WINDOW_DAYS. One evidence per distinct cluster (windows are not double-reported).
"""

from app.risk.config import REPEATED_TX_MIN_COUNT, REPEATED_TX_WINDOW_DAYS, RULE_SEVERITY
from app.risk.context import Evidence, LandContext, active_transactions

CODE = "REPEATED_SUSPICIOUS_TRANSACTIONS"


def evaluate(ctx: LandContext) -> list[Evidence]:
    dated = sorted(
        (t for t in active_transactions(ctx) if t.transaction_date is not None),
        key=lambda t: t.transaction_date,
    )
    out: list[Evidence] = []
    i = 0
    while i < len(dated):
        j = i
        while (
            j + 1 < len(dated)
            and (dated[j + 1].transaction_date - dated[i].transaction_date).days
            <= REPEATED_TX_WINDOW_DAYS
        ):
            j += 1
        count = j - i + 1
        if count >= REPEATED_TX_MIN_COUNT:
            cluster = dated[i : j + 1]
            out.append(
                Evidence(
                    CODE,
                    RULE_SEVERITY[CODE],
                    {
                        "transaction_ids": [t.id for t in cluster],
                        "transaction_count": count,
                        "window_days": REPEATED_TX_WINDOW_DAYS,
                        "first_date": cluster[0].transaction_date.isoformat(),
                        "last_date": cluster[-1].transaction_date.isoformat(),
                    },
                )
            )
            i = j + 1
        else:
            i += 1
    return out
