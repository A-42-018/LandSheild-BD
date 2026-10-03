"""P48 anomaly scoring (Isolation Forest). Demo/synthetic only; not a fraud detector.

    from ai.fraud_detection import score
    score({"transaction_count": 2, ...})  # -> float in 0..1 (higher = more unusual)
"""
from .features import FEATURE_NAMES, FeatureInput, build_features
from .model import ModelNotAvailable, load_model, score, score_many

__all__ = [
    "FEATURE_NAMES",
    "FeatureInput",
    "ModelNotAvailable",
    "build_features",
    "load_model",
    "score",
    "score_many",
]
