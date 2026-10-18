"""P41/O4 evaluation. One command:  python ai/evaluation/run_eval.py [--write-docs]
        [--ocr {tesseract,auto}] [--extractor {rules,claude}] [--out FILE]
        [--set historical [--only NAME] [--profile historical] [--input-quality] [--lhdr]]
            (H0: historical-deed set, baseline per LHDR section; H2: OCR input quality before/after;
             H4: --lhdr scores the LHDR extractor on every gold value, --extractor claude fuses Claude)

The OCR is always run on the real image (demo fixtures are never used here). `--extractor claude`
needs ANTHROPIC_API_KEY (+ `pip install anthropic`); without it the run stops, nothing is faked.

Part A  Tesseract + rules extractor, per-field accuracy on the 20 synthetic docs
        (PREPROCESS off vs on, split by label mode / skew / noise).
Part B  Rule-engine precision/recall on the seeded R7 scenarios (exact evidence codes).
Part C  Bangla khatian / porcha specimens (F5a): character error rate (CER), parsed-field
        accuracy and review rate, on clean + noisy + skewed variants (F5b).
Synthetic documents, not real records.
"""
from __future__ import annotations

import argparse
import json
import os
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


def make_providers(ocr_name: str, extractor: str, preprocess: bool, lang: str, cache_dir: str):
    """(ocr, extractor) for one eval run. Demo fixtures are off; Claude uses a private cache."""
    import os

    from ai.extraction.claude import ClaudeDocumentAIProvider
    from ai.extraction.rules import RuleBasedDocumentAIProvider
    from ai.ocr.router import AutoOCRProvider
    from ai.ocr.tesseract import TesseractOCRProvider

    if ocr_name == "auto":
        ocr = AutoOCRProvider(demo_fixtures=False, lang=lang, preprocess=preprocess)
    else:
        ocr = TesseractOCRProvider(lang=lang, preprocess=preprocess)
    if extractor == "claude":
        ext = ClaudeDocumentAIProvider(
            os.environ["ANTHROPIC_API_KEY"],
            os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001"),
            daily_cap=10_000,
            cache_dir=cache_dir,
        )
    else:
        ext = RuleBasedDocumentAIProvider()
    return ocr, ext


def run_extraction(make, preprocess: bool) -> dict:
    truth = json.loads((DATA / "ground_truth.json").read_text(encoding="utf-8"))["documents"]
    ocr, ext = make(preprocess)
    fallbacks = 0
    per_field = defaultdict(lambda: [0, 0])
    per_doc, groups = [], defaultdict(lambda: [0, 0])
    for d in truth:
        data = (DATA / d["file"]).read_bytes()
        res = ext.extract(data, ocr.recognize(data, "png"))
        fallbacks += res.provider != ext.name
        got = {f.field: f.value for f in res.fields}
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
    return {
        "per_field": dict(per_field), "groups": dict(groups), "per_doc": per_doc,
        "total": (tot, n), "fallbacks": fallbacks,
    }  # fmt: skip


SPECIMENS = ("Khatian_RS", "Porcha_BS")
VARIANTS = ("clean", "noisy", "skewed")
REVIEW_THRESHOLD = 0.85  # settings.review_conf_threshold


def _variant(png: bytes, kind: str) -> bytes:
    """Deterministic degradation of a specimen (seeded noise, 2 degree skew)."""
    import io

    import numpy as np
    from PIL import Image

    if kind == "clean":
        return png
    img = Image.open(io.BytesIO(png)).convert("L")
    if kind == "skewed":
        img = img.rotate(2.0, resample=Image.BICUBIC, fillcolor=255)
    else:
        arr = np.asarray(img, dtype=np.float32)
        arr += np.random.default_rng(7).normal(0, 18, arr.shape)
        img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def _cer(ref: str, hyp: str) -> float:
    from rapidfuzz.distance import Levenshtein

    ref, hyp = " ".join(ref.split()), " ".join(hyp.split())
    return Levenshtein.distance(ref, hyp) / max(1, len(ref))


def run_bangla(make, preprocess: bool) -> dict:
    from ai.extraction import khatian

    fx = json.loads((ROOT / "ai" / "mock_fixtures.json").read_text(encoding="utf-8"))["by_marker"]
    ocr, _ = make(preprocess)
    rows = []
    for name in SPECIMENS:
        truth = fx[name]["ocr_text"]
        want = fx[name]["extras"]
        png = (ROOT / "database" / "sample_data" / f"{name}.png").read_bytes()
        for kind in VARIANTS:
            res = ocr.recognize(_variant(png, kind), "png")
            hits = khatian.parse(res.text)
            got = khatian.extras(res.text)
            checks = {
                "khatian_no": hits.get("khatian_no", (None,))[0] == fx[name]["fields"]["khatian_no"][0],
                "mouza": hits.get("mouza", (None,))[0] == fx[name]["fields"]["mouza"][0],
                "survey_type": got["survey_type"] == want["survey_type"],
                "owners": [o["name"] for o in got["owners"]] == [o["name"] for o in want["owners"]],
                "dags": [d["dag_no"] for d in got["dags"]] == [d["dag_no"] for d in want["dags"]],
            }
            low = [w for w in res.words if w.confidence < REVIEW_THRESHOLD]
            rows.append({
                "doc": name, "variant": kind, "cer": _cer(truth, res.text), "checks": checks,
                "word_conf": res.confidence, "low_words": len(low), "words": len(res.words),
            })  # fmt: skip
    return {"rows": rows}


def run_rules() -> dict:
    import loader
    from sqlalchemy import select
    from sqlalchemy.orm import sessionmaker

    import app.models  # noqa: F401
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


def render_bangla(bn: dict) -> list[str]:
    out = ["", "### C. Bangla khatian / porcha specimens (F5a) — CER and parsed fields", "",
           "Specimens: `Khatian_RS.png`, `Porcha_BS.png` (synthetic Bangla, shaped by headless Chrome). "
           "CER = Levenshtein distance / reference length over whitespace-normalised text; the "
           "parsed-field check compares the F5a parser output on the OCR text with the specimen's "
           "known values (khatian no, mouza, survey type, owner names, dag numbers). A document "
           f"needs review when any word has confidence < {REVIEW_THRESHOLD:.2f}.", ""]
    for flag in ("off", "on"):
        out += [f"PREPROCESS {flag}:", "", "| Specimen | Variant | CER | Fields correct | Mean word conf | Words < threshold |",
                "|---|---|---|---|---|---|"]
        for r in bn[flag]["rows"]:
            ok = sum(r["checks"].values())
            out.append(f"| {r['doc']} | {r['variant']} | {100 * r['cer']:.1f}% | {ok}/{len(r['checks'])} "
                       f"| {r['word_conf']:.2f} | {r['low_words']}/{r['words']} |")
        rows = bn[flag]["rows"]
        mean_cer = sum(r["cer"] for r in rows) / len(rows)
        review = sum(1 for r in rows if r["low_words"] > 0)
        fields = sum(sum(r["checks"].values()) for r in rows)
        total = sum(len(r["checks"]) for r in rows)
        out += ["", f"**Mean CER {100 * mean_cer:.1f}%** · parsed fields {pct(fields, total)} · "
                f"review rate {pct(review, len(rows))}", ""]
    return out


def render(
    results: dict, rules: dict, lang: str, installed: list[str], bangla: dict | None = None,
    ocr_name: str = "tesseract", extractor: str = "rules",
) -> str:  # fmt: skip
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    n_docs = len(results["off"]["per_doc"])
    out = [
        BEGIN, "", "## Evaluation results", "",
        f"- Date: {today} (UTC)",
        f"- Dataset: {n_docs} synthetic documents × {len(FIELDS)} fields = {n_docs * len(FIELDS)} field values",
        f"- OCR: Tesseract (`--ocr {ocr_name}`, demo fixtures off), languages used: `{lang}` (installed: {', '.join(installed)})",
        f"- Extractor: `--extractor {extractor}`"
        + (" (rule-based)" if extractor == "rules" else f", model `{os.environ.get('CLAUDE_MODEL', 'claude-haiku-4-5-20251001')}`, "
           f"{results['off'].get('fallbacks', 0) + results['on'].get('fallbacks', 0)} fallbacks to rules"),
        "- A field counts only on exact match (trimmed, case-insensitive)",
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

    if bangla:
        out += render_bangla(bangla)
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


HIST_BEGIN, HIST_END = "<!-- HIST-EVAL:BEGIN -->", "<!-- HIST-EVAL:END -->"
HIST_OCR_BEGIN, HIST_OCR_END = "<!-- HIST-OCR:BEGIN -->", "<!-- HIST-OCR:END -->"
HIST_LHDR_BEGIN, HIST_LHDR_END = "<!-- HIST-LHDR:BEGIN -->", "<!-- HIST-LHDR:END -->"
HIST_LLM_BEGIN, HIST_LLM_END = "<!-- HIST-LHDR-LLM:BEGIN -->", "<!-- HIST-LHDR-LLM:END -->"


def _write_block(text: str, begin: str, end: str) -> None:
    old = DOC.read_text(encoding="utf-8") if DOC.exists() else "# AI pipeline\n"
    if begin in old and end in old:
        new = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _: text, old, flags=re.S)
    else:
        new = old.rstrip() + "\n\n" + text + "\n"
    DOC.write_text(new, encoding="utf-8")


def run_historical(a) -> int:
    """H0: score today's pipeline on the historical-deed set (needs Tesseract for scans)."""
    from ai.evaluation import historical
    from ai.ocr.tesseract import installed_languages, resolve_lang

    if a.extractor != "rules" and not a.lhdr:
        print("--extractor claude on the historical set needs --lhdr (the H4 extractor).")
        return 2
    try:
        lang = resolve_lang(a.lang, installed_languages())
    except Exception as exc:  # Tesseract unavailable
        print(f"Tesseract not runnable ({exc}). Install it and re-run.")
        return 2
    if a.input_quality:
        body, begin, end = historical.render_input(historical.input_quality(lang, a.only)), HIST_OCR_BEGIN, HIST_OCR_END
    elif a.lhdr:
        llm = historical.lhdr_llm() if a.extractor == "claude" else None
        res = historical.run_lhdr("auto", lang, a.only, a.profile, llm)
        body = historical.render_lhdr(res, a.profile)
        begin, end = (HIST_LLM_BEGIN, HIST_LLM_END) if llm else (HIST_LHDR_BEGIN, HIST_LHDR_END)
    else:
        body = historical.render(historical.run(a.ocr, lang, a.only, a.profile), a.ocr)
        begin, end = HIST_BEGIN, HIST_END
    text = "\n".join([begin, "", body, "", end])
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf-8")
    if a.write_docs:
        _write_block(text, begin, end)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-docs", action="store_true", help="update docs/ai-pipeline.md")
    ap.add_argument("--out", help="also write the report to this file")
    ap.add_argument("--lang", default="ben+eng")
    ap.add_argument("--ocr", choices=("tesseract", "auto"), default="tesseract")
    ap.add_argument("--extractor", choices=("rules", "claude"), default="rules")
    ap.add_argument("--set", choices=("default", "historical"), default="default",
                    help="historical = H0 deed set (database/sample_data/historical), scored per LHDR section")
    ap.add_argument("--only", help="with --set historical: only files whose name contains this")
    ap.add_argument("--profile", choices=("modern", "historical", "auto"), default="modern",
                    help="with --set historical: OCR profile (H2)")
    ap.add_argument("--lhdr", action="store_true",
                    help="with --set historical: the H4 extractor, every gold value scored (--extractor claude: fused with Claude)")
    ap.add_argument("--input-quality", action="store_true",
                    help="with --set historical: gold values found in the OCR text, before H2 vs H2 profiles")
    a = ap.parse_args()
    if a.set == "historical":
        return run_historical(a)

    from ai.ocr.tesseract import installed_languages, resolve_lang

    try:
        installed = installed_languages()
        lang = resolve_lang(a.lang, installed)
    except Exception as exc:  # Tesseract unavailable
        print(f"Tesseract not runnable ({exc}). Install it and re-run.")
        return 2
    if a.extractor == "claude":
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("ANTHROPIC_API_KEY is not set: cannot evaluate the Claude extractor.")
            return 2
        try:
            import anthropic  # noqa: F401
        except ImportError:
            print("The 'anthropic' package is not installed (pip install 'anthropic>=0.40').")
            return 2
    cache = tempfile.mkdtemp(prefix="ls-eval-claude-")

    def make(pre: bool):
        return make_providers(a.ocr, a.extractor, pre, lang, cache)

    results = {k: run_extraction(make, k == "on") for k in ("off", "on")}
    rules = run_rules()
    bangla = {k: run_bangla(make, k == "on") for k in ("off", "on")} if "ben" in installed else None
    text = render(results, rules, lang, installed, bangla, a.ocr, a.extractor)
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf-8")
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
