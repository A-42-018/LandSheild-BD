"""S1: docs/concept-note.md -> docs/concept-note.html -> docs/LandShield-BD-Concept-Note.pdf (A4).

Usage: pip install markdown && python scripts/export_concept_note.py [--chrome PATH]
Needs Google Chrome / Chromium (headless print). Check the page count after export: limit is 4.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

DOCS = Path(__file__).resolve().parent.parent / "docs"
SRC, HTML, PDF = DOCS / "concept-note.md", DOCS / "concept-note.html", DOCS / "LandShield-BD-Concept-Note.pdf"
CHROMES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
]

CSS = """
@page { size: A4; margin: 13mm 14mm 12mm; }
* { box-sizing: border-box; }
body { font: 9.6pt/1.38 Inter, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
h1 { font-size: 19pt; color: #006a4e; margin: 0 0 2mm; border-bottom: 2.5px solid #006a4e; padding-bottom: 1.5mm; }
h2 { font-size: 11.5pt; color: #006a4e; margin: 3.6mm 0 1.4mm; break-after: avoid; }
p { margin: 0 0 1.6mm; }
ul, ol { margin: 0 0 1.6mm; padding-left: 5mm; }
li { margin-bottom: 0.8mm; }
blockquote { margin: 1.5mm 0; padding: 1.4mm 3mm; background: #fef9e7; border-left: 3px solid #d4a017; font-size: 8.8pt; }
blockquote p { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 2mm; font-size: 8.7pt; break-inside: avoid; }
th, td { border: 1px solid #cbd5e1; padding: 1mm 1.8mm; text-align: left; vertical-align: top; }
th { background: #e8f2ee; }
code { font-size: 8.6pt; }
img { max-width: 100%; }
p > img[alt="Architecture"] { display: block; width: 100%; margin: 1mm 0; }
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 1mm 0 2mm; }
.shots p { margin: 0; break-inside: avoid; }
.shots img { display: block; width: 100%; height: 46mm; object-fit: cover; object-position: left top; border: 1px solid #cbd5e1; }
.shots p::after { content: attr(data-cap); display: block; font-size: 8pt; color: #475569; margin-top: 0.8mm; }
"""


def build_html() -> str:
    body = markdown.markdown(SRC.read_text(encoding="utf-8"), extensions=["tables", "md_in_html"])
    # Caption each screenshot with its alt text.
    import re

    body = re.sub(
        r'<p>(<img alt="([^"]+)" src="concept-note/\d[^"]*" />)</p>',
        lambda m: f'<p data-cap="{m.group(2)}">{m.group(1)}</p>',
        body,
    )
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LandShield BD — Concept Note</title><style>{CSS}</style></head><body>{body}</body></html>'


def find_chrome(explicit: str | None) -> str:
    for c in [explicit] if explicit else CHROMES:
        if c and (Path(c).exists() or shutil.which(c)):
            return c
    sys.exit("Chrome/Chromium not found; pass --chrome PATH")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome")
    args = ap.parse_args()
    HTML.write_text(build_html(), encoding="utf-8")
    subprocess.run(
        [find_chrome(args.chrome), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={PDF}", HTML.as_uri()],
        check=True, capture_output=True,
    )
    print(f"wrote {PDF.relative_to(DOCS.parent)}")


if __name__ == "__main__":
    main()
