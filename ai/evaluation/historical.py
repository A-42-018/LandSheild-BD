# ruff: noqa: E501
"""H0 scoring for the historical-deed set (`run_eval.py --set historical`).

The gold files (database/sample_data/historical/*.gold.json, see make_historical.py) are LHDR v1 with
plain values. A prediction is a flat `{json-pointer path: value}` dict. Today's pipeline only yields the
13 core fields, so `core_to_paths` places them at their LHDR paths; every other gold value counts as
missed. From H4 on, the extractor supplies real LHDR paths and the same scorer applies unchanged.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

HIST_DIR = Path(__file__).resolve().parents[2] / "database" / "sample_data" / "historical"
CORE = (
    "owner_name", "father_name", "khatian_no", "dag_no", "mouza", "district", "upazila",
    "land_area", "area_unit", "deed_no", "deed_date", "seller", "buyer",
)  # fmt: skip
SECTIONS = {  # first path segment -> roadmap section
    "document": "A. Document", "registration": "B. Registration", "dates": "C. Dates", "parties": "D. Parties",
    "consideration": "E. Consideration", "schedule": "F. Schedule", "title_recital": "G. Title recital",
    "execution": "H. Execution", "modern_mapping": "I. Modern mapping", "core": "J. Core 13",
}  # fmt: skip
_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_UNITS = {"একর": "acre", "acre": "acre", "acres": "acre", "শতক": "decimal", "শতাংশ": "decimal", "decimal": "decimal",
          "কানি": "kani", "kani": "kani", "বিঘা": "bigha", "bigha": "bigha", "কাঠা": "katha", "katha": "katha"}  # fmt: skip


def load_set(directory: Path = HIST_DIR) -> list[dict]:
    """[{file, path, gold(dict), variant, pages}] from manifest.json."""
    man = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))["files"]
    return [
        {**m, "path": directory / m["file"], "gold": json.loads((directory / m["gold"]).read_text(encoding="utf-8"))}
        for m in man
    ]


def flatten(obj, prefix: str = "") -> dict[str, str]:
    """Leaf values as {"/schedule/0/mouza": "ভবানীপুর"}; skips `_notes`, nulls and empties."""
    out: dict[str, str] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if not k.startswith("_"):
                out.update(flatten(v, f"{prefix}/{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(flatten(v, f"{prefix}/{i}"))
    elif obj not in (None, ""):
        out[prefix] = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)
    return out


def norm(v: object) -> str:
    """Comparable form: Bangla digits -> ASCII, spaces collapsed, numbers canonical, units unified."""
    s = re.sub(r"\s+", " ", str(v if v is not None else "").translate(_DIGITS).strip().lower())
    if s in _UNITS:
        return _UNITS[s]
    try:
        return f"{float(s):g}"
    except ValueError:
        return s


def core_to_paths(core: dict[str, str | None], gold: dict) -> dict[str, str]:
    """Put 13 core values at the LHDR paths they stand for (so section scoring is comparable)."""
    parties = gold.get("parties", [])
    si = next((i for i, p in enumerate(parties) if p["role"] in ("SELLER", "DONOR", "MORTGAGOR")), 0)
    bi = next((i for i, p in enumerate(parties) if p["role"] in ("BUYER", "DONEE", "MORTGAGEE")), 1)
    where = {
        "seller": f"/parties/{si}/name", "buyer": f"/parties/{bi}/name", "owner_name": f"/parties/{si}/name",
        "father_name": f"/parties/{si}/father/name" if "father" in parties[si] else f"/parties/{si}/husband/name",
        "khatian_no": "/schedule/0/khatian_no", "dag_no": "/schedule/0/dag_no/0", "mouza": "/schedule/0/mouza",
        "district": "/schedule/0/district", "upazila": "/schedule/0/thana", "land_area": "/schedule/0/area/value",
        "area_unit": "/schedule/0/area/unit", "deed_no": "/registration/deed_no",
        "deed_date": "/dates/execution/gregorian_from",
    }
    return {where[k]: v for k, v in core.items() if v not in (None, "") and k in where}


def _hit(path: str, got: dict[str, str], want: str, gold_flat: dict[str, str]) -> bool:
    if path not in got:
        return False
    if path == "/dates/execution/gregorian_from":  # core deed_date is the middle of the from..to range
        return norm(got[path]) in (norm(want), norm(gold_flat.get("/core/deed_date")))
    return norm(got[path]) == norm(want)


def score_doc(pred_core: dict[str, str | None], gold: dict) -> dict:
    """{core: (ok, n), sections: {section: [ok, n]}, missed_core: [...]}."""
    gflat = {k: v for k, v in flatten(gold).items() if k != "/schema"}
    paths = core_to_paths(pred_core, gold)
    sections: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for path, want in gflat.items():
        sec = SECTIONS[path.split("/")[1]]
        sections[sec][1] += 1
        if sec == SECTIONS["core"]:  # J is scored on the fields themselves
            sections[sec][0] += norm(pred_core.get(path.split("/")[2])) == norm(want)
        else:
            sections[sec][0] += _hit(path, paths, want, gflat)
    core_gold = gold.get("core", {})
    ok, missed = 0, []
    for f in CORE:
        want, got = core_gold.get(f), pred_core.get(f)
        if want in (None, ""):
            continue  # nothing to read (e.g. land_area for archaic units)
        if norm(got) == norm(want):
            ok += 1
        else:
            missed.append(f)
    n = sum(1 for f in CORE if core_gold.get(f) not in (None, ""))
    return {"core": (ok, n), "sections": dict(sections), "missed_core": missed}


def run(ocr_name: str = "auto", lang: str = "ben+eng", only: str | None = None) -> dict:
    """Run today's pipeline (OCR -> rule extractor) over the set and score it."""
    from ai.extraction.rules import RuleBasedDocumentAIProvider
    from ai.ocr.router import AutoOCRProvider
    from ai.ocr.tesseract import TesseractOCRProvider

    ocr = AutoOCRProvider(demo_fixtures=False, lang=lang) if ocr_name == "auto" else TesseractOCRProvider(lang=lang)
    ext = RuleBasedDocumentAIProvider()
    rows = []
    for item in load_set():
        if only and only not in item["file"]:
            continue
        data = item["path"].read_bytes()
        res = ocr.recognize(data, item["path"].suffix.lstrip("."))
        got = {f.field: f.value for f in ext.extract(data, res).fields}
        s = score_doc(got, item["gold"])
        rows.append({"file": item["file"], "variant": item["variant"], "pages": item["pages"], "ocr": res.provider,
                     "ocr_conf": res.confidence, "got": got, **s})
    return {"rows": rows}


def _pct(a: int, b: int) -> str:
    return f"{100 * a / b:.1f}% ({a}/{b})" if b else "n/a"


def render(result: dict, ocr_name: str = "auto") -> str:
    rows = result["rows"]
    out = ["### Historical deeds (H0 baseline)", "",
           f"- Pipeline today: OCR `--ocr {ocr_name}` (PDF text layer, else Tesseract; demo fixtures off) + the generic rule extractor",
           f"- Set: `database/sample_data/historical/` — {len(rows)} files, gold LHDR per file (`*.gold.json`)",
           "- A value counts only on exact match after normalising Bangla digits, spaces and units",
           "- Core 13 = the fields LandShield uses today; a field with no value on the deed (e.g. area in kani) is not counted",
           "- **Synthetic deeds except the two real samples (`Historical_Land_Deed*.pdf`).**", "",
           "| File | Variant | Pages | OCR | Core 13 correct | Missed core fields |", "|---|---|---|---|---|---|"]
    for r in rows:
        out.append(f"| {r['file']} | {r['variant']} | {r['pages']} | {r['ocr']} | {r['core'][0]}/{r['core'][1]} | {', '.join(r['missed_core']) or '—'} |")
    ok, n = sum(r["core"][0] for r in rows), sum(r["core"][1] for r in rows)
    out += ["", f"**Core 13 overall: {_pct(ok, n)}**", ""]
    for label, sel in (("typed + render", lambda r: r["variant"] != "scanned"), ("scanned", lambda r: r["variant"] == "scanned")):
        part = [r for r in rows if sel(r)]
        if part:
            out.append(f"- {label}: {_pct(sum(r['core'][0] for r in part), sum(r['core'][1] for r in part))}")
    tot: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in rows:
        for sec, (a, b) in r["sections"].items():
            tot[sec][0] += a
            tot[sec][1] += b
    out += ["", "Accuracy per LHDR section (all gold values; only core fields are extracted today):", "",
            "| Section | Correct |", "|---|---|"]
    for sec in SECTIONS.values():
        if sec in tot:
            out.append(f"| {sec} | {_pct(*tot[sec])} |")
    a, b = sum(v[0] for v in tot.values()), sum(v[1] for v in tot.values())
    out += [f"| **All values** | **{_pct(a, b)}** |", "",
            "Reproduce: `python ai/evaluation/run_eval.py --set historical`"]
    return "\n".join(out)
