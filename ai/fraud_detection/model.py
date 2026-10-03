"""IsolationForest wrapper: train, save, load, score(features) -> 0..1."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from .features import FEATURE_NAMES, build_features

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "iforest.joblib"


class ModelNotAvailable(RuntimeError):
    """Model file missing/unreadable; train with `python -m ai.fraud_detection.train`."""


def fit(x: np.ndarray, seed: int, contamination: float) -> dict:
    """Unsupervised fit. Scores are rescaled so the training median -> 0 and the training
    max -> 1; `threshold` is the training quantile (1 - contamination) on that scale."""
    clf = IsolationForest(n_estimators=200, contamination=contamination, random_state=seed)
    clf.fit(x)
    raw = -clf.score_samples(x)
    lo, hi = float(np.median(raw)), float(raw.max())
    scaled = np.clip((raw - lo) / (hi - lo), 0, 1)
    return {
        "model": clf, "lo": lo, "hi": hi, "seed": seed, "contamination": contamination,
        "threshold": float(np.quantile(scaled, 1 - contamination)),
        "features": list(FEATURE_NAMES),
    }


def _scale(bundle: dict, raw: np.ndarray) -> np.ndarray:
    return np.clip((raw - bundle["lo"]) / (bundle["hi"] - bundle["lo"]), 0, 1)


def score_matrix(bundle: dict, x: np.ndarray) -> np.ndarray:
    return _scale(bundle, -bundle["model"].score_samples(x))


def save(bundle: dict, path: Path = MODEL_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path, compress=3)
    return path


@lru_cache(maxsize=4)
def _load(path: str) -> dict:
    p = Path(path)
    if not p.is_file():
        raise ModelNotAvailable(f"model not found: {p}")
    try:
        bundle = joblib.load(p)
    except Exception as e:  # corrupt/incompatible pickle
        raise ModelNotAvailable(f"model unreadable: {p}") from e
    if bundle.get("features") != list(FEATURE_NAMES):
        raise ModelNotAvailable("model feature list does not match FEATURE_NAMES; retrain")
    return bundle


def load_model(path: Path | str = MODEL_PATH) -> dict:
    return _load(str(path))


def score(features, path: Path | str = MODEL_PATH) -> float:
    """0..1 anomaly score for one feature set (FeatureInput | dict | sequence). Higher = more
    unusual compared with the synthetic training data; it is a review hint, not a verdict."""
    return float(score_many([features], path)[0])


def score_many(rows, path: Path | str = MODEL_PATH) -> list[float]:
    bundle = load_model(path)
    x = np.array([build_features(r) for r in rows], dtype=float).reshape(-1, len(FEATURE_NAMES))
    return [float(v) for v in score_matrix(bundle, x)]
