"""P48 training + evaluation. One command (from repo root):

    python -m ai.fraud_detection.train [--write-docs] [--out models/iforest.joblib]

Train on synthetic data (5% injected anomalies, unlabeled to the model), evaluate on a held-out
synthetic split with a different seed. Synthetic only: no production claims.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai.fraud_detection import model as M  # noqa: E402
from ai.fraud_detection.synthetic import ANOMALY_KINDS, generate  # noqa: E402

SEED = 2025
TRAIN_N, TRAIN_RATE = 5000, 0.05
TEST_N, TEST_RATE = 2000, 0.10
DOC = ROOT / "docs" / "ai-pipeline.md"
BEGIN, END = "<!-- ML:BEGIN -->", "<!-- ML:END -->"


def train(seed: int = SEED, n: int = TRAIN_N, rate: float = TRAIN_RATE) -> dict:
    x, _y, _k = generate(n, rate, seed)
    return M.fit(x, seed, contamination=rate)


def evaluate(bundle: dict, seed: int = SEED + 1, n: int = TEST_N, rate: float = TEST_RATE) -> dict:
    x, y, kinds = generate(n, rate, seed)
    s = M.score_matrix(bundle, x)
    pred = (s >= bundle["threshold"]).astype(int)
    p, r, f, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
    per_kind = {}
    for k in ANOMALY_KINDS:
        idx = np.array([i for i, kk in enumerate(kinds) if kk == k])
        per_kind[k] = {"n": int(len(idx)), "recall": float(pred[idx].mean()) if len(idx) else 0.0}
    return {
        "test_n": n, "test_anomalies": int(y.sum()), "threshold": bundle["threshold"],
        "precision": float(p), "recall": float(r), "f1": float(f),
        "roc_auc": float(roc_auc_score(y, s)),
        "false_positives": int(((pred == 1) & (y == 0)).sum()),
        "false_negatives": int(((pred == 0) & (y == 1)).sum()),
        "per_kind": per_kind,
    }


def render(res: dict, bundle: dict) -> str:
    rows = "\n".join(
        f"| {k} | {v['n']} | {v['recall']:.2f} |" for k, v in res["per_kind"].items()
    )
    return f"""{BEGIN}
Measured on a **held-out synthetic split** (seed {SEED + 1}, {res['test_n']} rows,
{res['test_anomalies']} injected anomalies). Model trained on {TRAIN_N} synthetic rows
({TRAIN_RATE:.0%} injected anomalies, seed {SEED}), `IsolationForest(n_estimators=200)`.
Flag threshold = training {1 - TRAIN_RATE:.0%} quantile of the scaled score
= {res['threshold']:.3f}.

| Metric | Value |
|---|---|
| Precision | {res['precision']:.3f} |
| Recall | {res['recall']:.3f} |
| F1 | {res['f1']:.3f} |
| ROC AUC | {res['roc_auc']:.3f} |
| False positives / negatives | {res['false_positives']} / {res['false_negatives']} |

| Injected anomaly type | Rows | Recall |
|---|---|---|
{rows}

Reproduce: `python -m ai.fraud_detection.train --write-docs` (artifact: `models/iforest.joblib`).

These numbers describe how well the model finds anomalies **that this generator injected**. The
generator and the model share the same assumptions, so they say nothing about real land records.
Not a fraud detector; the score is a review hint only.
{END}"""


def write_docs(res: dict, bundle: dict) -> None:
    section = (
        "\n## Anomaly model: Isolation Forest (P48)\n\n"
        "`ai/fraud_detection/`: features (R3), seeded synthetic generator, scikit-learn "
        "IsolationForest, `score(features) -> 0..1`. Not yet wired into the risk engine (P49).\n\n"
        f"{render(res, bundle)}\n"
    )
    text = DOC.read_text(encoding="utf-8") if DOC.exists() else "# AI pipeline\n"
    if BEGIN in text and END in text:
        a, b = text.index(BEGIN), text.index(END) + len(END)
        text = text[:a] + render(res, bundle) + text[b:]
    else:
        text = text.rstrip("\n") + "\n" + section
    DOC.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=M.MODEL_PATH)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--write-docs", action="store_true")
    ap.add_argument("--json", action="store_true", help="print metrics as JSON")
    a = ap.parse_args(argv)
    bundle = train(a.seed)
    res = evaluate(bundle, a.seed + 1)
    path = M.save(bundle, a.out)
    if a.write_docs:
        write_docs(res, bundle)
    print(json.dumps(res, indent=2) if a.json else render(res, bundle))
    print(f"saved {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
