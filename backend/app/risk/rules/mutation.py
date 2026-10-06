"""Registration <-> mutation mismatch rules (F1b). Wording is "possible"/"not yet recorded".

REGISTERED_NOT_MUTATED   sale older than MUTATION_GRACE_DAYS with no APPROVED mutation
                         (an open application filed within the grace window counts as in progress)
MUTATION_PARTY_MISMATCH  mutation applicant is not the buyer of the registered sale
MUTATION_WITHOUT_DEED    mutation carries no deed reference
MUTATION_AREA_EXCEEDS_DEED  mutated area (unit-normalised) is larger than the deed area

Rejected mutations are ignored by the last three. Unknown units are never compared.
"""

from datetime import date, timedelta

from app.risk.config import AREA_EPS, AREA_TO_SQM, MUTATION_GRACE_DAYS, RULE_SEVERITY
from app.risk.context import Evidence, LandContext, MutRecord, active_transactions

APPROVED = "APPROVED"
REJECTED = "REJECTED"
PENDING = ("APPLIED", "UNDER_REVIEW", "HEARING")


def _live(ctx: LandContext) -> list[MutRecord]:
    return [m for m in ctx.mutations if m.status != REJECTED]


def _ev(code: str, **params) -> Evidence:
    return Evidence(code, RULE_SEVERITY[code], params)


def _not_mutated(ctx: LandContext) -> list[Evidence]:
    cutoff = (ctx.as_of or date.today()) - timedelta(days=MUTATION_GRACE_DAYS)
    # approved, or an open application filed inside the grace window (in progress, not "missing")
    approved = {
        m.transaction_id
        for m in ctx.mutations
        if m.status == APPROVED
        or (m.status in PENDING and m.applied_on is not None and m.applied_on >= cutoff)
    }
    return [
        _ev(
            "REGISTERED_NOT_MUTATED",
            transaction_id=t.id,
            transaction_date=t.transaction_date.isoformat(),
            grace_days=MUTATION_GRACE_DAYS,
        )
        for t in active_transactions(ctx)
        if t.transaction_date is not None
        and t.transaction_date < cutoff
        and t.id not in approved
    ]


def _party(ctx: LandContext) -> list[Evidence]:
    buyers = {t.id: t.buyer_id for t in active_transactions(ctx)}
    return [
        _ev(
            "MUTATION_PARTY_MISMATCH",
            mutation_id=m.id,
            transaction_id=m.transaction_id,
            applicant_owner_id=m.applicant_owner_id,
            buyer_owner_id=buyers[m.transaction_id],
        )
        for m in _live(ctx)
        if m.transaction_id in buyers and m.applicant_owner_id != buyers[m.transaction_id]
    ]


def _no_deed(ctx: LandContext) -> list[Evidence]:
    return [
        _ev("MUTATION_WITHOUT_DEED", mutation_id=m.id, transaction_id=m.transaction_id)
        for m in _live(ctx)
        if m.deed_id is None
    ]


def _area(ctx: LandContext) -> list[Evidence]:
    out = []
    for m in _live(ctx):
        f_m, f_d = AREA_TO_SQM.get(m.area_unit), AREA_TO_SQM.get(m.deed_area_unit or "")
        if m.deed_area is None or f_m is None or f_d is None:
            continue
        if m.area * f_m - m.deed_area * f_d > AREA_EPS * max(1.0, m.deed_area * f_d):
            out.append(
                _ev(
                    "MUTATION_AREA_EXCEEDS_DEED",
                    mutation_id=m.id,
                    mutation_area=m.area,
                    mutation_unit=m.area_unit,
                    deed_area=m.deed_area,
                    deed_unit=m.deed_area_unit,
                )
            )
    return out


def evaluate(ctx: LandContext) -> list[Evidence]:
    return [*_not_mutated(ctx), *_party(ctx), *_no_deed(ctx), *_area(ctx)]
