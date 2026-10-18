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


def record_paths(record: dict) -> dict[str, str]:
    """An extractor's LHDR record (plain values, H4) as {path: value}; `core` is scored on its own."""
    from ai.extraction.lhdr import parse, plain

    return {k: v for k, v in flatten(plain(parse(record))).items() if not k.startswith(("/core/", "/schema"))}


def score_doc(pred_core: dict[str, str | None], gold: dict, record: dict | None = None) -> dict:
    """{core: (ok, n), sections: {section: [ok, n]}, missed_core: [...], missed: [paths]}.
    With `record` (H4 LHDR output) every gold path is compared; without it only the 13 core
    fields count, placed at their LHDR paths (the H0 baseline)."""
    gflat = {k: v for k, v in flatten(gold).items() if k != "/schema"}
    paths = record_paths(record) if record is not None else core_to_paths(pred_core, gold)
    missed: list[str] = []
    sections: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for path, want in gflat.items():
        sec = SECTIONS[path.split("/")[1]]
        sections[sec][1] += 1
        if sec == SECTIONS["core"]:  # J is scored on the fields themselves
            ok = norm(pred_core.get(path.split("/")[2])) == norm(want)
        else:
            ok = _hit(path, paths, want, gflat)
        sections[sec][0] += ok
        if not ok:
            missed.append(path)
    core_gold = gold.get("core", {})
    ok, missed_core = 0, []
    for f in CORE:
        want, got = core_gold.get(f), pred_core.get(f)
        if want in (None, ""):
            continue  # nothing to read (e.g. land_area for archaic units)
        if norm(got) == norm(want):
            ok += 1
        else:
            missed_core.append(f)
    n = sum(1 for f in CORE if core_gold.get(f) not in (None, ""))
    return {"core": (ok, n), "sections": dict(sections), "missed_core": missed_core, "missed": missed}


def run(ocr_name: str = "auto", lang: str = "ben+eng", only: str | None = None, profile: str = "modern") -> dict:
    """Run today's pipeline (OCR -> rule extractor) over the set and score it."""
    from ai.extraction.rules import RuleBasedDocumentAIProvider
    from ai.ocr.router import AutoOCRProvider
    from ai.ocr.tesseract import TesseractOCRProvider

    ocr = (AutoOCRProvider(demo_fixtures=False, lang=lang, profile=profile) if ocr_name == "auto"
           else TesseractOCRProvider(lang=lang, profile=profile))
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


# ---- H4: the LHDR extractor, every gold value --------------------------------------------------

def lhdr_llm():
    """Claude for `--lhdr --extractor claude`, configured like the backend (backend/.env, env vars),
    with a private cache so eval runs never touch the app's cache."""
    from app.core.config import Settings

    from ai.extraction.claude import ClaudeDocumentAIProvider

    s = Settings()
    if not s.anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set (backend/.env or the environment); nothing is faked.")
    return ClaudeDocumentAIProvider(s.anthropic_api_key, s.claude_model, timeout_s=max(s.claude_timeout_s, 120),
                                    daily_cap=10_000, cache_dir=HIST_DIR.parents[2] / "backend" / "storage" / "claude_eval_cache",
                                    base_url=s.anthropic_base_url, auth=s.anthropic_auth)


def run_lhdr(ocr_name: str = "auto", lang: str = "ben+eng", only: str | None = None, profile: str = "auto",
             llm=None) -> dict:
    """OCR -> H4 historical-deed extractor (rules, fused with `llm` when given) -> every gold value."""
    from ai.extraction.historical_deed import HistoricalDeedProvider
    from ai.ocr.router import AutoOCRProvider
    from ai.ocr.tesseract import TesseractOCRProvider

    ocr = (AutoOCRProvider(demo_fixtures=False, lang=lang, profile=profile) if ocr_name == "auto"
           else TesseractOCRProvider(lang=lang, profile=profile))
    ext = HistoricalDeedProvider(llm)
    rows = []
    for item in load_set():
        if only and only not in item["file"]:
            continue
        data = item["path"].read_bytes()
        res = ocr.recognize(data, item["path"].suffix.lstrip("."))
        out = ext.extract(data, res)
        got = {f.field: f.value for f in out.fields}
        s = score_doc(got, item["gold"], out.record)
        all_ok = (sum(v[0] for v in s["sections"].values()), sum(v[1] for v in s["sections"].values()))
        rows.append({"file": item["file"], "variant": item["variant"], "ocr": res.provider, "extractor": out.provider,
                     "warnings": out.warnings, "all": all_ok, **s})
    return {"rows": rows, "llm": getattr(llm, "model", None)}


def render_lhdr(result: dict, profile: str = "auto") -> str:
    rows = result["rows"]
    engine = f"rules + `{result['llm']}` fused" if result.get("llm") else "rules only (no API key)"
    out = ["### Historical deeds: H4 extractor (LHDR)", "",
           f"- Extractor: `ai/extraction/historical_deed.py`, {engine}; OCR `--ocr auto`, profile `{profile}`",
           "- Every gold value counts (all LHDR sections, not only the 13 core fields), exact match after normalising",
           "  Bangla digits, spaces and units; a value the deed does not print is not in the gold",
           "- **Synthetic deeds except the two real samples (`Historical_Land_Deed*.pdf`).**", "",
           "| File | Variant | OCR | Extractor | All values | Core 13 |", "|---|---|---|---|---|---|"]
    for r in rows:
        fb = next((w for w in r["warnings"] if w.startswith("CLAUDE_FALLBACK")), "")
        out.append(f"| {r['file']} | {r['variant']} | {r['ocr']} | {r['extractor']}{' (' + fb + ')' if fb else ''} | "
                   f"{_pct(*r['all'])} | {r['core'][0]}/{r['core'][1]} |")
    typed = [r for r in rows if r["variant"] != "scanned"]
    scanned = [r for r in rows if r["variant"] == "scanned"]

    def tot(rs: list[dict], k: str) -> tuple[int, int]:
        return sum(r[k][0] for r in rs), sum(r[k][1] for r in rs)

    out += ["", f"**All values: {_pct(*tot(rows, 'all'))}** · typed + render {_pct(*tot(typed, 'all'))} · "
                f"scanned {_pct(*tot(scanned, 'all'))}",
            f"**Core 13: {_pct(*tot(rows, 'core'))}**", "",
            "| Section | Correct |", "|---|---|"]
    secs: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in rows:
        for sec, (a, b) in r["sections"].items():
            secs[sec][0] += a
            secs[sec][1] += b
    out += [f"| {sec} | {_pct(*secs[sec])} |" for sec in SECTIONS.values() if sec in secs]
    out += ["", "Targets (roadmap H4, with the LLM on): >= 90 % on typed samples, >= 75 % on scanned variants.", "",
            f"Reproduce: `python ai/evaluation/run_eval.py --set historical --lhdr --profile {profile}"
            + (" --extractor claude`" if result.get("llm") else "`")]
    return "\n".join(out)


# ---- H2: input quality (is the deed's text in the OCR output at all?) --------------------------

_EN2BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
_NOT_VERBATIM = {"gregorian_from", "gregorian_to", "precision", "decimal_equiv", "pages", "month_no"}


def text_values(gold: dict) -> list[str]:
    """Gold values that must appear verbatim in a correct reading of the page: Bangla text and
    numbers (in Bangla digits). Codes (`SELLER`, `acre`), booleans, computed values (Gregorian
    range, modern mapping, core) are not on the page and are skipped."""
    out: set[str] = set()

    def walk(o, key: str = "") -> None:
        if key in _NOT_VERBATIM or key.startswith("_"):
            return
        if isinstance(o, dict):
            for k, v in o.items():
                if k not in ("core", "modern_mapping", "schema", "document"):
                    walk(v, k)
        elif isinstance(o, list):
            for v in o:
                walk(v, key)
        elif isinstance(o, bool) or o is None:
            return
        elif isinstance(o, int | float):
            out.add((f"{o:.2f}" if isinstance(o, float) and o != int(o) else str(int(o))).translate(_EN2BN))
        elif isinstance(o, str) and o.strip():
            if re.search(r"[ঀ-৿]", o):
                out.add(o)
            elif re.fullmatch(r"[0-9][0-9./-]*", o):
                out.add(o.translate(_EN2BN))

    walk(gold)
    return sorted(out)


def found(values: list[str], text: str) -> int:
    flat = re.sub(r"\s+", " ", text)
    return sum(re.sub(r"\s+", " ", v) in flat for v in values)


def _legacy(lang: str):
    """The pre-H2 path: text layer trusted when >= 50 chars, else plain Tesseract (no tables,
    no missed-line recovery). Kept here only as the 'before' column."""
    from ai.ocr.router import MIN_TEXT_CHARS
    from ai.ocr.tesseract import TesseractOCRProvider
    from ai.preprocessing.pdf import pdf_text_layer

    tess = TesseractOCRProvider(lang=lang, preprocess=True, layout=False)

    def read(data: bytes, ext: str) -> tuple[str, str, int]:
        if ext == "pdf":
            t = pdf_text_layer(data)
            if t and len("".join(t.split())) >= MIN_TEXT_CHARS:
                return t, "pdf-text", 0
        return tess.recognize(data, ext).text, "tesseract", 0

    return read


def input_quality(lang: str = "ben+eng", only: str | None = None) -> dict:
    """Gold values found in the OCR text: before H2, H2 modern profile, H2 historical profile."""
    from ai.ocr.router import AutoOCRProvider

    legacy = _legacy(lang)
    readers = {"before": legacy}
    for prof in ("modern", "historical"):
        ocr = AutoOCRProvider(demo_fixtures=False, lang=lang, profile=prof)

        def read(data: bytes, ext: str, _o=ocr) -> tuple[str, str, int]:
            r = _o.recognize(data, ext)
            src = r.provider + "".join(f" ({w})" for w in r.warnings if w.startswith("TEXT_LAYER"))
            return r.text, src, len(r.tables)

        readers[prof] = read
    rows = []
    for item in load_set():
        if only and only not in item["file"]:
            continue
        data, ext = item["path"].read_bytes(), item["path"].suffix.lstrip(".")
        vals = text_values(item["gold"])
        row = {"file": item["file"], "variant": item["variant"], "n": len(vals)}
        for name, read in readers.items():
            text, src, tables = read(data, ext)
            row[name] = {"found": found(vals, text), "source": src, "tables": tables}
        rows.append(row)
    return {"rows": rows}


def render_input(result: dict) -> str:
    rows = result["rows"]
    out = ["### Historical deeds: input quality (H2)", "",
           "Share of the gold values (Bangla text and numbers that are printed on the page) found verbatim in the",
           "OCR text, i.e. what any extractor could at best read. Independent of the extractor.", "",
           "- **before**: pre-H2 router (text layer trusted at >= 50 characters; Tesseract without tables / line recovery)",
           "- **modern**, **historical**: H2 router (checked text layer, table cells, missed-line recovery) with `OCR_PROFILE`",
           "",
           "| File | Variant | before | modern | historical | Source (modern) | Tables |", "|---|---|---|---|---|---|---|"]
    tot = {k: 0 for k in ("before", "modern", "historical")}
    tot_scan = dict(tot)
    n = n_scan = 0
    for r in rows:
        out.append(f"| {r['file']} | {r['variant']} | {r['before']['found']}/{r['n']} | {r['modern']['found']}/{r['n']} | "
                   f"{r['historical']['found']}/{r['n']} | {r['modern']['source']} | {r['modern']['tables']} |")
        n += r["n"]
        for k in tot:
            tot[k] += r[k]["found"]
        if r["variant"] == "scanned":
            n_scan += r["n"]
            for k in tot:
                tot_scan[k] += r[k]["found"]
    out += ["", f"**All files:** before {_pct(tot['before'], n)} · modern {_pct(tot['modern'], n)} · "
                f"historical {_pct(tot['historical'], n)}",
            f"**Scanned only:** before {_pct(tot_scan['before'], n_scan)} · modern {_pct(tot_scan['modern'], n_scan)} · "
            f"historical {_pct(tot_scan['historical'], n_scan)}", "",
            "Reproduce: `python ai/evaluation/run_eval.py --set historical --input-quality`"]
    return "\n".join(out)
