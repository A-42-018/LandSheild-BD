"""Seeded synthetic data: normal parcels + injected anomalies. Not real records."""
from __future__ import annotations

import numpy as np

from .features import FEATURE_NAMES

ANOMALY_KINDS = (
    "rapid_flip", "area_mismatch", "seller_mismatch", "duplicate_deed", "doc_mismatch", "combined",
)


def _normal(rng: np.random.Generator, n: int) -> np.ndarray:
    x = np.empty((n, len(FEATURE_NAMES)))
    x[:, 0] = rng.integers(1, 5, n)                                   # transaction_count
    x[:, 1] = rng.uniform(300, 9000, n)                               # ownership_duration (days)
    x[:, 2] = np.abs(rng.normal(0, 0.03, n))                          # area_difference
    x[:, 3] = rng.integers(0, 5, n)                                   # seller_history_count
    x[:, 4] = rng.integers(0, 4, n)                                   # buyer_history_count
    x[:, 5] = rng.uniform(0.9, 1.0, n)                                # owner_similarity
    x[:, 6] = rng.uniform(0.85, 1.0, n)                               # document_similarity
    x[:, 7] = 0.0                                                     # duplicate_deed_signal
    return x


def _inject(rng: np.random.Generator, x: np.ndarray, kind: str) -> None:
    n = len(x)
    if kind in ("rapid_flip", "combined"):
        x[:, 0] = rng.integers(5, 12, n)
        x[:, 1] = rng.uniform(1, 60, n)
        x[:, 3] = rng.integers(5, 15, n)
    if kind in ("area_mismatch", "combined"):
        x[:, 2] = rng.uniform(0.25, 1.5, n)
    if kind in ("seller_mismatch", "combined"):
        x[:, 5] = rng.uniform(0.0, 0.5, n)
    if kind in ("duplicate_deed", "combined"):
        x[:, 7] = 1.0
        x[:, 0] = np.maximum(x[:, 0], rng.integers(2, 6, n))
    if kind in ("doc_mismatch", "combined"):
        x[:, 6] = rng.uniform(0.0, 0.5, n)


def generate(n: int, anomaly_rate: float, seed: int) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Return (X, y, kinds): y=1 for injected anomalies, kinds[i] = anomaly kind or 'normal'.

    Deterministic for a given (n, anomaly_rate, seed); rows are shuffled.
    """
    if not 0 <= anomaly_rate < 1:
        raise ValueError("anomaly_rate must be in [0, 1)")
    rng = np.random.default_rng(seed)
    n_anom = int(round(n * anomaly_rate))
    x = _normal(rng, n)
    y = np.zeros(n, dtype=int)
    kinds = ["normal"] * n
    for i, idx in enumerate(np.array_split(np.arange(n_anom), len(ANOMALY_KINDS))):
        if len(idx) == 0:
            continue
        kind = ANOMALY_KINDS[i]
        sub = x[idx]  # fancy indexing copies: inject into the copy, then write back
        _inject(rng, sub, kind)
        x[idx] = sub
        y[idx] = 1
        for j in idx:
            kinds[j] = kind
    perm = rng.permutation(n)
    return x[perm], y[perm], [kinds[i] for i in perm]
