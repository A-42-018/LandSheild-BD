"""INCONSISTENT_OWNERSHIP (R3): gaps or overlaps between dated ownership periods.

A period ending on the day the next one starts is a valid hand-over. Periods with identical
start and end are treated as co-ownership. Periods without a start date cannot be placed and are
skipped. A gap is only reported when every earlier period has ended (no open-ended owner).
"""

from datetime import date

from app.risk.config import RULE_SEVERITY
from app.risk.context import Evidence, LandContext, OwnerPeriod

CODE = "INCONSISTENT_OWNERSHIP"


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def evaluate(ctx: LandContext) -> list[Evidence]:
    periods = sorted(
        (p for p in ctx.ownership if p.start_date is not None), key=lambda p: p.start_date
    )
    out: list[Evidence] = []

    def emit(kind: str, a: OwnerPeriod, b: OwnerPeriod) -> None:
        out.append(
            Evidence(
                CODE,
                RULE_SEVERITY[CODE],
                {
                    "kind": kind,
                    "owner_ids": [a.owner_id, b.owner_id],
                    "first_start": _iso(a.start_date),
                    "first_end": _iso(a.end_date),
                    "second_start": _iso(b.start_date),
                    "second_end": _iso(b.end_date),
                },
            )
        )

    for i, a in enumerate(periods):
        for b in periods[i + 1 :]:
            if (a.start_date, a.end_date) == (b.start_date, b.end_date):
                continue  # co-ownership
            if a.end_date is None or b.start_date < a.end_date:
                emit("OVERLAP", a, b)

    # Gaps: walk the timeline keeping the latest-ending period seen so far.
    latest: OwnerPeriod | None = None
    for p in periods:
        if latest is not None and latest.end_date is not None and p.start_date > latest.end_date:
            emit("GAP", latest, p)
        if latest is None or (
            latest.end_date is not None and (p.end_date is None or p.end_date > latest.end_date)
        ):
            latest = p
    return out
