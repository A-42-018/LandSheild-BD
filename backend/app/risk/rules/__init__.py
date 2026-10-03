from collections.abc import Callable

from app.risk.context import Evidence, LandContext
from app.risk.rules import (
    area,
    duplicate_deed,
    duplicate_tx,
    extraction,
    ownership,
    repeated,
    seller,
    unit,
)

RuleFn = Callable[[LandContext], list[Evidence]]

RULES: tuple[RuleFn, ...] = (
    duplicate_tx.evaluate,
    seller.evaluate,
    duplicate_deed.evaluate,
    ownership.evaluate,
    area.evaluate,
    repeated.evaluate,
    unit.evaluate,
    extraction.evaluate,
)


def run_rules(ctx: LandContext) -> list[Evidence]:
    out: list[Evidence] = []
    for rule in RULES:
        out.extend(rule(ctx))
    return out
