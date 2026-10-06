# ruff: noqa: E501
"""Synthetic Bangla khatian / porcha specimens + their mock ground truth (F5a). Demo data only.

    python ai/evaluation/make_khatian_samples.py

Bangla needs a shaping engine for conjuncts and vowel signs, which Pillow only has when built with
Raqm. So the page is drawn by headless Chrome/Chromium when found (correct Bangla); otherwise the
Pillow renderer is used and a warning says the glyphs will look wrong (the mock ground truth is unaffected).

Writes database/sample_data/Khatian_RS.png (2 owners, 2 dags) and Porcha_BS.png (1 owner, 1 dag),
each carrying an `LSMOCK:<key>` marker, and adds/replaces their entries in ai/mock_fixtures.json
(OCR text, fields as the khatian parser reads them, extras). Deterministic: two runs give the same bytes.
"""
from __future__ import annotations

import html
import io
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, PngImagePlugin

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(REPO))

from ai.evaluation.make_synthetic import FIXTURES, SIZE, _font  # noqa: E402
from ai.extraction import khatian  # noqa: E402

SPECS = {
    "Khatian_RS": [
        "খতিয়ান / পর্চা (নমুনা)",
        "সিন্থেটিক ডেমো ডেটা — সরকারি রেকর্ড নয়",
        "জরিপ: আর.এস (রিভিশনাল সার্ভে)",
        "জেলা: গাজীপুর",
        "উপজেলা: শ্রীপুর",
        "মৌজা: বারমী, জে.এল. নং ৪২",
        "খতিয়ান নং: ১২৪৫",
        "মালিক ও অংশ:",
        "১। করিম মিয়া, পিতা: নূর মোহাম্মদ, অংশ: ১/২",
        "২। হাসান আলী, পিতা: মোঃ ইদ্রিস, অংশ: ১/২",
        "দাগ ও জমির পরিমাণ:",
        "দাগ নং: ৭৮৫, পরিমাণ: ১০ শতাংশ",
        "দাগ নং: ৭৮৬, পরিমাণ: ৫.৫ শতাংশ",
    ],
    "Porcha_BS": [
        "পর্চা (নমুনা) — সিন্থেটিক ডেমো ডেটা",
        "জরিপ: বি.এস (বাংলাদেশ সার্ভে)",
        "জেলা: ঢাকা",
        "উপজেলা: সাভার",
        "মৌজা: আশুলিয়া, জে.এল. নং ১৭",
        "খতিয়ান নং: ৬১০",
        "মালিক ও অংশ:",
        "১। জামাল হোসেন, পিতা: সিরাজুল ইসলাম, অংশ: ১",
        "দাগ ও জমির পরিমাণ:",
        "দাগ নং: ২১০, পরিমাণ: ১২ শতাংশ",
    ],
}
OCR_CONFIDENCE = 0.9


CHROMES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser",
]
PAGE = """<!doctype html><meta charset="utf-8"><style>
html,body{{margin:0;width:{w}px;height:{h}px;background:#fafafa}}
.page{{position:absolute;left:20px;top:20px;right:20px;bottom:20px;border:3px solid #3c3c3c;box-sizing:border-box;padding:30px 36px;
font:28px/62px "Noto Sans Bengali","Kohinoor Bangla","Bangla Sangam MN","Nirmala UI",sans-serif;color:#282828}}
h1{{font-weight:600;font-size:36px;line-height:70px;margin:0;color:#141414}}
p{{margin:0;white-space:pre}} small{{position:absolute;left:36px;bottom:24px;font:20px sans-serif;color:#8c8c8c}}
</style><body><div class="page"><h1>{head}</h1>{rows}<small>Synthetic specimen {key}</small></div></body>"""


def _chrome() -> str | None:
    return next((c for c in CHROMES if Path(c).exists() or shutil.which(c)), None)


def render_chrome(key: str, lines: list[str], chrome: str) -> bytes:
    w, h = SIZE
    body = PAGE.format(
        w=w, h=h, head=html.escape(lines[0]),
        rows="".join(f"<p>{html.escape(x)}</p>" for x in lines[1:]), key=key,
    )  # fmt: skip
    with tempfile.TemporaryDirectory() as tmp:
        page, shot = Path(tmp, "p.html"), Path(tmp, "s.png")
        page.write_text(body, encoding="utf-8")
        subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
             f"--screenshot={shot}", page.as_uri()],
            check=True, capture_output=True,
        )
        # 16 grey levels keep the PNG small (text on a flat page); markers live in the tEXt chunk
        img = Image.open(shot).convert("L").crop((0, 0, w, h)).quantize(colors=16)
    info = PngImagePlugin.PngInfo()
    info.add_text("LSMOCK", f"LSMOCK:{key}")
    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info, optimize=False, compress_level=9)
    return buf.getvalue()


def render(key: str, lines: list[str]) -> bytes:
    chrome = _chrome()
    if chrome:
        return render_chrome(key, lines, chrome)
    print("warning: Chrome/Chromium not found; Pillow without Raqm draws Bangla with wrong glyph order", file=sys.stderr)
    return render_pillow(key, lines)


def render_pillow(key: str, lines: list[str]) -> bytes:
    img = Image.new("L", SIZE, 250)
    d = ImageDraw.Draw(img)
    big, mid, small = _font(36), _font(28), _font(20)
    d.rectangle([20, 20, SIZE[0] - 21, SIZE[1] - 21], outline=60, width=3)
    y = 70
    for i, line in enumerate(lines):
        d.text((60, y), line, font=big if i == 0 else mid, fill=20 if i == 0 else 40)
        y += 70 if i == 0 else 62
    d.text((60, SIZE[1] - 60), "Synthetic specimen " + key, font=small, fill=140)
    info = PngImagePlugin.PngInfo()
    info.add_text("LSMOCK", f"LSMOCK:{key}")
    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info, optimize=False, compress_level=9)
    return buf.getvalue()


def fixture(lines: list[str]) -> dict:
    text = "\n".join(lines)
    fields = {f: [v, round(OCR_CONFIDENCE * s, 4)] for f, (v, s, _raw) in khatian.parse(text).items()}
    return {"ocr_text": text, "ocr_confidence": OCR_CONFIDENCE, "fields": fields, "extras": khatian.extras(text)}


def main() -> None:
    fx = json.loads(FIXTURES.read_text(encoding="utf-8"))
    for key, lines in SPECS.items():
        (REPO / "database" / "sample_data" / f"{key}.png").write_bytes(render(key, lines))
        fx["by_marker"][key] = fixture(lines)
    FIXTURES.write_text(json.dumps(fx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", ", ".join(f"{k}.png" for k in SPECS))


if __name__ == "__main__":
    main()
