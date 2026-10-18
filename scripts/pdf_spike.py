"""H8a PDF engine spike: which server-side engine gives Bangla with an exact text layer?

Run (from the repo root, in an env with the `pdf` extra + pymupdf):
    pip install -e "./backend[pdf]" pymupdf
    python scripts/pdf_spike.py [--out scripts/_out] [--font path/to/font.ttf]

Candidates: weasyprint (Pango + HarfBuzz), fpdf2 (+ uharfbuzz shaping) and, since H10, the D7
fallback weasyprint+layer (the app's `deed_pdf.render_pdf`: WeasyPrint draws, an invisible PyMuPDF
text layer). For each one it renders
the same page, extracts the text with PyMuPDF (pypdf if PyMuPDF is missing), compares every source
string exactly (NFC, whitespace collapsed), scores the page with ai/ocr/quality.py, and records
render time, PDF size and installed package size. Exit 0 when at least one candidate round-trips
every string exactly AND passes the quality gate, else 1. A JSON report is written to --out.
"""
from __future__ import annotations

import argparse
import importlib
import importlib.metadata as md
import json
import sys
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ai.ocr.quality import THRESHOLD, assess  # noqa: E402

# Words that broke the sample deed's Chrome-printed text layer (ai/ocr/quality.py) plus running text.
WORDS = ["তপশিল", "বিক্রেতা", "পশ্চিমে", "সম্পত্তির", "টিপসই", "বঙ্গাব্দ", "ক্রেতা", "দলিল"]
LINES = [
    "এই সাফ কবলা দলিলের তপশিলভুক্ত সম্পত্তির বিক্রেতা মোঃ আব্দুল করিম।",
    "সম্পত্তির পশ্চিমে খাল, পূর্বে রাস্তা, উত্তরে বিক্রেতার জমি, দক্ষিণে দাগ নং ১২৩৪।",
    "দলিল নং ৫৬৭৮, ১৩৫১ বঙ্গাব্দ, ক্রেতার টিপসই ও স্বাক্ষর।",
    "Deed No 5678 · SHA-256 a1b2c3 · Version 3",
]
SOURCES = WORDS + LINES
FONT_CANDIDATES = ["NotoSansBengali-Regular.ttf", "FreeSans.ttf"]  # ai/fonts/, first found wins
PACKAGES = {"weasyprint": ["weasyprint", "pydyf", "tinyhtml5", "tinycss2", "cssselect2", "pyphen"],
            "weasyprint+layer": ["weasyprint", "pydyf", "tinyhtml5", "tinycss2", "cssselect2",
                                 "pyphen", "pymupdf"],
            "fpdf2": ["fpdf2", "uharfbuzz", "fonttools", "defusedxml"]}


def norm(s: str) -> str:
    return " ".join(unicodedata.normalize("NFC", s).split())


def pick_font(arg: str | None) -> Path:
    if arg:
        return Path(arg).resolve()
    for name in FONT_CANDIDATES:
        p = ROOT / "ai" / "fonts" / name
        if p.exists():
            return p
    raise SystemExit("no Bangla font in ai/fonts/ (see ai/fonts/README.md) and no --font given")


def spike_html(font: Path) -> str:
    body = "".join(f"<p class=w>{w}</p>" for w in WORDS) + "".join(f"<p>{x}</p>" for x in LINES)
    return (
        f"<html lang='bn'><head><meta charset='utf-8'><style>"
        f"@font-face{{font-family:Bn;src:url('{font.as_uri()}')}}"
        f"body{{font-family:Bn;font-size:14pt}}p.w{{font-size:20pt}}</style></head>"
        f"<body>{body}</body></html>"
    )


def render_weasyprint(font: Path, out: Path) -> None:
    from weasyprint import HTML

    HTML(string=spike_html(font)).write_pdf(str(out))


def render_weasyprint_layer(font: Path, out: Path) -> None:
    """D7 fallback (H10): WeasyPrint draws, the app's PyMuPDF text layer replaces its text."""
    sys.path.insert(0, str(ROOT / "backend"))
    from app.services.deed_pdf import render_pdf

    out.write_bytes(render_pdf(spike_html(font)))


def render_fpdf2(font: Path, out: Path) -> None:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_font("Bn", fname=str(font))
    pdf.set_text_shaping(True)  # needs uharfbuzz
    pdf.add_page()
    for text, size in [(w, 20) for w in WORDS] + [(x, 14) for x in LINES]:
        pdf.set_font("Bn", size=size)
        pdf.multi_cell(0, 10, text, new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(out))


def extract(path: Path) -> tuple[str, str]:
    try:
        import pymupdf

        with pymupdf.open(path) as doc:
            return "\n".join(p.get_text() for p in doc), "pymupdf"
    except ImportError:
        from pypdf import PdfReader

        return "\n".join(p.extract_text() or "" for p in PdfReader(str(path)).pages), "pypdf"


def installed_mb(names: list[str]) -> float | None:
    total, found = 0, False
    for n in names:
        try:
            dist = md.distribution(n)
        except md.PackageNotFoundError:
            continue
        found = True
        for f in dist.files or []:
            try:
                total += f.locate().stat().st_size
            except OSError:
                pass
    return round(total / 1e6, 1) if found else None


def run_candidate(name: str, fn, font: Path, out_dir: Path) -> dict:
    res: dict = {"engine": name}
    mod = {"weasyprint": "weasyprint", "weasyprint+layer": "weasyprint", "fpdf2": "fpdf"}[name]
    try:
        importlib.import_module(mod)
        if name == "weasyprint+layer":
            importlib.import_module("pymupdf")
        if name == "fpdf2":
            importlib.import_module("uharfbuzz")
    except ImportError as e:
        return {**res, "status": "not-installed", "error": str(e)}
    pdf = out_dir / f"spike-{name}.pdf"
    try:
        t0 = time.perf_counter()
        fn(font, pdf)
        res["render_s"] = round(time.perf_counter() - t0, 3)
    except Exception as e:  # noqa: BLE001 - spike: report any failure
        return {**res, "status": "render-failed", "error": f"{type(e).__name__}: {e}"}
    text, extractor = extract(pdf)
    flat = norm(text)
    misses = [s for s in SOURCES if norm(s) not in flat]
    q = assess(text)
    res.update(
        status="ok",
        extractor=extractor,
        pdf_bytes=pdf.stat().st_size,
        install_mb=installed_mb(PACKAGES[name]),
        exact=len(SOURCES) - len(misses),
        total=len(SOURCES),
        misses=misses,
        quality=round(q.score, 3),
        passes=not misses and q.score >= THRESHOLD,
    )
    return res


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "scripts" / "_out"))
    ap.add_argument("--font")
    args = ap.parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    font = pick_font(args.font)
    results = [
        run_candidate("weasyprint", render_weasyprint, font, out_dir),
        run_candidate("weasyprint+layer", render_weasyprint_layer, font, out_dir),
        run_candidate("fpdf2", render_fpdf2, font, out_dir),
    ]
    winners = [r["engine"] for r in results if r.get("passes")]
    report = {"font": font.name, "threshold": THRESHOLD, "results": results, "winners": winners}
    (out_dir / "pdf_spike_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    print("WINNERS:", winners or "none -> record the fallback (H8a Done when)")
    return 0 if winners else 1


if __name__ == "__main__":
    sys.exit(main())
