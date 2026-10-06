"""Forged-document plausibility rules (F6). Wording stays "possible": none asserts forgery.

* DEED_NO_FORMAT_INVALID - the deed number is not a plausible registry number (a short
  alphanumeric code or number, optionally with a year part, e.g. D-2021-0240, 1234/2021, ১২৩৪).
* IMPOSSIBLE_DATE - a dated transfer that cannot have happened: in the future, before the seller
  acquired the parcel, or before the parcel's first recorded owner.
* RAPID_RESALE - the seller held the parcel for fewer than RAPID_RESALE_DAYS days.
"""

import re
from datetime import date

from app.risk.config import RAPID_RESALE_DAYS, RULE_SEVERITY
from app.risk.context import Evidence, LandContext, active_transactions

DIGIT = r"[0-9০-৯]"
DEED_NO_RE = re.compile(rf"^[A-Za-z]{{0,4}}[-/ ]?{DIGIT}{{1,8}}(?:[-/]{DIGIT}{{1,8}})?$")

FORMAT_CODE = "DEED_NO_FORMAT_INVALID"
DATE_CODE = "IMPOSSIBLE_DATE"
RESALE_CODE = "RAPID_RESALE"


def _acquired_on(ctx: LandContext, seller_id: str, d: date) -> date | None:
    """Latest known date (<= d) on which `seller_id` acquired the parcel."""
    dates = [
        p.start_date
        for p in ctx.ownership
        if p.owner_id == seller_id and p.start_date is not None and p.start_date <= d
    ]
    dates += [
        t.transaction_date
        for t in active_transactions(ctx)
        if t.buyer_id == seller_id and t.transaction_date is not None and t.transaction_date < d
    ]
    return max(dates) if dates else None


def _first_acquired(ctx: LandContext, seller_id: str) -> date | None:
    dates = [p.start_date for p in ctx.ownership if p.owner_id == seller_id and p.start_date]
    return min(dates) if dates else None


def evaluate(ctx: LandContext) -> list[Evidence]:
    today = date.today()  # real clock: ctx.as_of is only a test hook for the grace-period rules
    origin_dates = [p.start_date for p in ctx.ownership if p.start_date is not None]
    origin = min(origin_dates) if origin_dates else None
    out: list[Evidence] = []
    for t in active_transactions(ctx):
        no = " ".join((t.deed_no or "").split())
        if t.deed_no is not None and not DEED_NO_RE.match(no):
            out.append(
                Evidence(
                    FORMAT_CODE,
                    RULE_SEVERITY[FORMAT_CODE],
                    {"transaction_id": t.id, "deed_no": no},
                )
            )
        d = t.transaction_date
        if d is None:
            continue
        first = _first_acquired(ctx, t.seller_id)
        reason = None
        if d > today:
            reason = "FUTURE"
        elif (
            first is not None
            and d < first
            and not any(
                x.buyer_id == t.seller_id and x.transaction_date and x.transaction_date <= d
                for x in active_transactions(ctx)
            )
        ):
            reason = "BEFORE_SELLER_ACQUIRED"
        elif origin is not None and d < origin:
            reason = "BEFORE_RECORD_ORIGIN"
        if reason:
            out.append(
                Evidence(
                    DATE_CODE,
                    RULE_SEVERITY[DATE_CODE],
                    {"transaction_id": t.id, "transaction_date": d.isoformat(), "reason": reason},
                )
            )
            continue
        acquired = _acquired_on(ctx, t.seller_id, d)
        if acquired is not None and (d - acquired).days < RAPID_RESALE_DAYS:
            out.append(
                Evidence(
                    RESALE_CODE,
                    RULE_SEVERITY[RESALE_CODE],
                    {
                        "transaction_id": t.id,
                        "transaction_date": d.isoformat(),
                        "acquired_on": acquired.isoformat(),
                        "held_days": (d - acquired).days,
                        "threshold_days": RAPID_RESALE_DAYS,
                    },
                )
            )
    return out
