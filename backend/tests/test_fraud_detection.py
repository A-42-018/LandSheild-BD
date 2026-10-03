"""P48 Isolation Forest: features, synthetic generator, training, score()."""
import pytest

pytest.importorskip("sklearn")
pytest.importorskip("numpy")
pytest.importorskip("joblib")

import numpy as np  # noqa: E402
from ai.fraud_detection import (  # noqa: E402
    FEATURE_NAMES,
    FeatureInput,
    ModelNotAvailable,
    build_features,
    score,
    score_many,
)
from ai.fraud_detection import model as M  # noqa: E402
from ai.fraud_detection.synthetic import ANOMALY_KINDS, generate  # noqa: E402
from ai.fraud_detection.train import evaluate, train  # noqa: E402

NORMAL = {"transaction_count": 2, "ownership_duration": 2000, "area_difference": 0.01,
          "seller_history_count": 1, "buyer_history_count": 1, "owner_similarity": 0.97,
          "document_similarity": 0.95, "duplicate_deed_signal": 0}
ANOMALOUS = {"transaction_count": 8, "ownership_duration": 10, "area_difference": 0.9,
             "seller_history_count": 9, "buyer_history_count": 1, "owner_similarity": 0.1,
             "document_similarity": 0.2, "duplicate_deed_signal": 1}


@pytest.fixture(scope="module")
def trained():
    b = train(seed=7, n=2000)
    return b, evaluate(b, seed=8, n=1000)


def test_feature_names_match_r3():
    assert FEATURE_NAMES == (
        "transaction_count", "ownership_duration", "area_difference", "seller_history_count",
        "buyer_history_count", "owner_similarity", "document_similarity", "duplicate_deed_signal")


def test_build_features_order_defaults_clamp():
    assert build_features(NORMAL) == [NORMAL[n] for n in FEATURE_NAMES]
    assert build_features({}) == build_features(FeatureInput())
    v = build_features({"owner_similarity": 5, "area_difference": -1, "duplicate_deed_signal": 2})
    assert v[FEATURE_NAMES.index("owner_similarity")] == 1.0
    assert v[FEATURE_NAMES.index("area_difference")] == 0.0
    assert v[FEATURE_NAMES.index("duplicate_deed_signal")] == 1.0
    assert build_features(list(range(8)))[0] == 0


@pytest.mark.parametrize("bad", [{"nope": 1}, {"owner_similarity": "x"},
                                 {"area_difference": float("nan")}, [1, 2]])
def test_build_features_rejects_bad_input(bad):
    with pytest.raises(ValueError):
        build_features(bad)


def test_generator_deterministic_and_labelled():
    a = generate(500, 0.1, 1)
    b = generate(500, 0.1, 1)
    assert np.array_equal(a[0], b[0]) and a[2] == b[2]
    assert not np.array_equal(a[0], generate(500, 0.1, 2)[0])
    x, y, kinds = a
    assert y.sum() == 50 and set(kinds) == {"normal", *ANOMALY_KINDS}


def test_injected_anomalies_actually_differ():
    x, y, _ = generate(1000, 0.1, 3)
    assert x[y == 1][:, FEATURE_NAMES.index("document_similarity")].mean() < \
        x[y == 0][:, FEATURE_NAMES.index("document_similarity")].mean() - 0.1


def test_training_reproducible():
    a, b = train(seed=5, n=800), train(seed=5, n=800)
    x, _, _ = generate(50, 0.2, 9)
    assert np.allclose(M.score_matrix(a, x), M.score_matrix(b, x))


def test_heldout_metrics_beat_chance(trained):
    _, res = trained
    assert res["roc_auc"] > 0.9 and res["precision"] > 0.6 and res["recall"] > 0.6


def test_score_range_and_ordering(trained, tmp_path):
    path = M.save(trained[0], tmp_path / "m.joblib")
    lo, hi = score(NORMAL, path), score(ANOMALOUS, path)
    assert 0 <= lo <= 1 and 0 <= hi <= 1 and hi > lo
    assert score_many([NORMAL, ANOMALOUS], path) == [lo, hi]


def test_committed_model_loads_and_scores():
    assert 0 <= score(NORMAL) < score(ANOMALOUS) <= 1


def test_missing_or_corrupt_model(tmp_path):
    with pytest.raises(ModelNotAvailable):
        score(NORMAL, tmp_path / "none.joblib")
    bad = tmp_path / "bad.joblib"
    bad.write_bytes(b"not a model")
    with pytest.raises(ModelNotAvailable):
        score(NORMAL, bad)
