"""R3 ML features. Pure, no DB: P49 builds a FeatureInput from the land context."""
from __future__ import annotations

from dataclasses import dataclass, fields

FEATURE_NAMES: tuple[str, ...] = (
    "transaction_count",      # non-rejected transactions on the parcel
    "ownership_duration",     # days the seller has held the parcel at the transaction date
    "area_difference",        # |conveyed - recorded| / recorded (same unit), 0 if unknown
    "seller_history_count",   # earlier transactions by this seller
    "buyer_history_count",    # earlier transactions by this buyer
    "owner_similarity",       # 0..1 seller name vs recorded owner
    "document_similarity",    # 0..1 document fields vs recorded values
    "duplicate_deed_signal",  # 1 if the deed number is reused by another transaction
)


@dataclass(frozen=True)
class FeatureInput:
    transaction_count: float = 1
    ownership_duration: float = 0
    area_difference: float = 0
    seller_history_count: float = 0
    buyer_history_count: float = 0
    owner_similarity: float = 1
    document_similarity: float = 1
    duplicate_deed_signal: float = 0


def _num(v: object, name: str) -> float:
    try:
        x = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError) as e:
        raise ValueError(f"feature {name} is not a number: {v!r}") from e
    if x != x or x in (float("inf"), float("-inf")):
        raise ValueError(f"feature {name} must be finite")
    return x


def build_features(src: FeatureInput | dict | list | tuple) -> list[float]:
    """Return the 8 values in FEATURE_NAMES order, clamped to valid ranges.

    Accepts a FeatureInput, a dict (missing keys use the FeatureInput defaults, unknown keys are
    rejected) or a sequence already in FEATURE_NAMES order.
    """
    if isinstance(src, FeatureInput):
        d = {f.name: getattr(src, f.name) for f in fields(src)}
    elif isinstance(src, dict):
        unknown = set(src) - set(FEATURE_NAMES)
        if unknown:
            raise ValueError(f"unknown features: {sorted(unknown)}")
        base = FeatureInput()
        d = {n: src.get(n, getattr(base, n)) for n in FEATURE_NAMES}
    else:
        if len(src) != len(FEATURE_NAMES):
            raise ValueError(f"expected {len(FEATURE_NAMES)} features, got {len(src)}")
        d = dict(zip(FEATURE_NAMES, src, strict=True))
    v = {n: _num(d[n], n) for n in FEATURE_NAMES}
    for n in ("transaction_count", "ownership_duration", "area_difference",
              "seller_history_count", "buyer_history_count"):
        v[n] = max(0.0, v[n])
    for n in ("owner_similarity", "document_similarity", "duplicate_deed_signal"):
        v[n] = min(1.0, max(0.0, v[n]))
    return [v[n] for n in FEATURE_NAMES]
