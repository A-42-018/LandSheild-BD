"""P41 evaluation. One command:  python ai/evaluation/run_eval.py [--write-docs]

Part A  Tesseract + rules extractor, per-field accuracy on the 20 synthetic docs
        (PREPROCESS off vs on, split by label mode / skew / noise).
Part B  Rule-engine precision/recall on the seeded R7 scenarios (exact evidence codes).
Synthetic documents, not real records.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for p in (ROOT, ROOT / "backend", ROOT / "database" / "seed"):
    sys.path.insert(0, str(p))

DATA = Path(__file__).with_name("data")
DOC = ROOT / "docs" / "ai-pipeline.md"
BEGIN, END = "<!-- EVAL:BEGIN -->", "<!-- EVAL:END -->"
FIELDS = (
    "deed_no", "deed_date", "district", "upazila", "mouza", "khatian_no", "dag_no",
    "land_area", "area_unit", "seller", "father_name", "buyer",
)  # fmt: skip

# Expected evidence codes per seeded R7 scenario (see backend/tests/test_risk_rules_b.py).
EXPECTED = {
    "LP-10001": [],
    "LP-10100": [],
    "LP-10234": [],
    "LP-10240": ["POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"],
    "LP-10300": [],
    "LP-10400": [],
    "LP-10500": ["DUPLICATE_DEED"],
}


def _norm(v: str | None) -> str:
    return re.sub(r"\s+", " ", (v or "").strip().lower())


def run_extraction(preprocess: bool, lang: str) -> dict:
    from ai.extraction.rules import RuleBasedDocumentAIProvider
    from ai.ocr.tesseract import TesseractOCRProvider

    truth = json.loads((DATA / "ground_truth.json").read_text(encoding="utf-8"))["documents"]
    ocr, ext = TesseractOCRProvider(lang=lang, preprocess=preprocess), RuleBasedDocumentAIProvider()
    per_field = defaultdict(lambda: [0, 0])
    per_doc, groups = [], defaultdict(lambda: [0, 0])
    for d in truth:
        data = (DATA / d["file"]).read_bytes()
        got = {f.field: f.value for f in ext.extract(data, ocr.recognize(data, "png")).fields}
        ok = 0
        for f in FIELDS:
            hit = _norm(got.get(f)) == _norm(d["fields"].get(f))
            per_field[f][0] += hit
            per_field[f][1] += 1
            ok += hit
        v = d["variant"]
        for key in (f"labels={v['label_mode']}", f"skew={'0' if v['skew'] == 0 else '!=0'}",
                    f"noise={'yes' if v['noise'] > 0.002 else 'low'}"):
            groups[key][0] += ok
            groups[key][1] += len(FIELDS)
        per_doc.append((d["file"], ok))
    tot = sum(v[0] for v in per_field.values())
    n = sum(v[1] for v in per_field.values())
    return {"per_field": dict(per_field), "groups": dict(groups), "per_doc": per_doc, "total": (tot, n)}


def run_rules() -> dict:
    import app.models  # noqa: F401
    import loader
    from sqlalchemy import select
    from sqlalchemy.orm import sessionmaker

    from app.core.db import Base, make_engine
    from app.models.land_parcel import LandParcel
    from app.risk.context import load_land_context
    from app.risk.rules import run_rules as run

    with tempfile.TemporaryDirectory() as tmp:
        engine = make_engine(f"sqlite:///{tmp}/eval.db")
        Base.metadata.create_all(engine)
        stats = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
        rows = []
        with sessionmaker(bind=engine, expire_on_commit=False)() as s:
            loader.seed(s, demo_password="eval-pw")
            for land_id, expected in EXPECTED.items():
                land = s.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
                got = sorted({e.code for e in run(load_land_context(s, land))})
                for c in set(got) | set(expected):
                    k = "tp" if c in got and c in expected else "fp" if c in got else "fn"
                    stats[c][k] += 1
                rows.append((land_id, expected, got))
        engine.dispose()
    tp = sum(v["tp"] for v in stats.values())
    fp = sum(v["fp"] for v in stats.values())
    fn = sum(v["fn"] for v in stats.values())
    return {"stats": dict(stats), "rows": rows, "tp": tp, "fp": fp, "fn": fn}


def _pr(tp: int, fp: int, fn: int) -> tuple[float, float]:
    return (tp / (tp + fp) if tp + fp else 1.0, tp / (tp + fn) if tp + fn else 1.0)


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.1f}% ({a}/{b})" if b else "n/a"


def render(results: dict, rules: dict, lang: str, installed: list[str]) -> str:
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    n_docs = len(results["off"]["per_doc"])
    out = [
        BEGIN, "", "## Evaluation results", "",
        f"- Date: {today} (UTC)",
        f"- Dataset: {n_docs} synthetic documents × {len(FIELDS)} fields = {n_docs * len(FIELDS)} field values",
        f"- OCR: Tesseract, languages used: `{lang}` (installed: {', '.join(installed)})",
        "- Extractor: rule-based (`DOCUMENT_AI_PROVIDER=rules`); a field counts only on exact match (trimmed, case-insensitive)",
        "- **Synthetic documents, not real records.**",
    ]
    if "ben" not in installed:
        out.append(
            "- Caveat: `ben` traineddata was not installed for this run, so Bangla labels/names were "
            "read by an English-only model; Bangla accuracy is **not** measured. Re-run with "
            "`sudo apt install tesseract-ocr-ben && python ai/evaluation/run_eval.py --write-docs`."
        )
    out += ["", "### A. Per-field accuracy (Tesseract + rules)", "",
            "| Field | PREPROCESS off | PREPROCESS on |", "|---|---|---|"]
    for f in FIELDS:
        out.append(f"| {f} | {pct(*results['off']['per_field'][f])} | {pct(*results['on']['per_field'][f])} |")
    out.append(f"| **All fields** | **{pct(*results['off']['total'])}** | **{pct(*results['on']['total'])}** |")
    out += ["", "By document variant:", "", "| Variant | off | on |", "|---|---|---|"]
    for g in sorted(results["off"]["groups"]):
        out.append(f"| {g} | {pct(*results['off']['groups'][g])} | {pct(*results['on']['groups'][g])} |")
    out += ["", "Per document (correct fields of 12):", "", "| Doc | off | on |", "|---|---|---|"]
    for (f, a), (_, b) in zip(results["off"]["per_doc"], results["on"]["per_doc"], strict=True):
        out.append(f"| {f} | {a} | {b} |")

    p, r = _pr(rules["tp"], rules["fp"], rules["fn"])
    out += ["", "### B. Rule engine precision / recall (seeded R7 scenarios)", "",
            "| Land | Expected codes | Got | Match |", "|---|---|---|---|"]
    for land, exp, got in rules["rows"]:
        out.append(f"| {land} | {', '.join(exp) or '—'} | {', '.join(got) or '—'} | {'yes' if exp == got else 'NO'} |")
    out += ["", "| Code | TP | FP | FN | Precision | Recall |", "|---|---|---|---|---|---|"]
    for c, v in sorted(rules["stats"].items()):
        cp, cr = _pr(v["tp"], v["fp"], v["fn"])
        out.append(f"| {c} | {v['tp']} | {v['fp']} | {v['fn']} | {cp:.2f} | {cr:.2f} |")
    out += [f"| **Overall** | {rules['tp']} | {rules['fp']} | {rules['fn']} | **{p:.2f}** | **{r:.2f}** |", "",
            "Scenarios that need uploaded documents (LP-10234 after Doc2, LP-10300, LP-10400) are covered "
            "by `backend/tests/integration/test_demo_flow.py`; on the seed alone they expect no codes.", "",
            "Reproduce: `python ai/evaluation/run_eval.py --write-docs`", "", END]
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-docs", action="store_true", help="update docs/ai-pipeline.md")
    ap.add_argument("--lang", default="ben+eng")
    a = ap.parse_args()

    from ai.ocr.tesseract import installed_languages, resolve_lang

    try:
        installed = installed_languages()
        lang = resolve_lang(a.lang, installed)
    except Exception as exc:  # Tesseract unavailable
        print(f"Tesseract not runnable ({exc}). Install it and re-run.")
        return 2
    results = {k: run_extraction(k == "on", lang) for k in ("off", "on")}
    rules = run_rules()
    text = render(results, rules, lang, installed)
    print(text)
    if a.write_docs:
        old = DOC.read_text(encoding="utf-8") if DOC.exists() else "# AI pipeline\n"
        if BEGIN in old and END in old:
            new = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda _: text, old, flags=re.S)
        else:
            new = old.rstrip() + "\n\n" + text + "\n"
        DOC.write_text(new, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
