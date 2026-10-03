"""Deterministic synthetic deed generator (demo data, not official records).

    python ai/evaluation/make_synthetic.py            # writes into database/sample_data + ai/evaluation/data
    python ai/evaluation/make_synthetic.py --out DIR  # everything into DIR (used by tests)

Outputs (PNG, seeded RNG, no timestamps -> two runs give identical bytes):
  sample_data/{Doc1,Doc2,AreaMismatch,SellerMismatch,Clean}.png   R7 demo documents
  evaluation/data/eval_01..eval_20.png + ground_truth.json         OCR/extraction evaluation set
Each PNG carries a tEXt chunk `LSMOCK:<key>` so the mock providers find their ground truth.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

HERE = Path(__file__).resolve().parent
AI_DIR = HERE.parent
REPO = AI_DIR.parent
FONT_DIR = AI_DIR / "fonts"
FIXTURES = AI_DIR / "mock_fixtures.json"
SEED = 2025
SIZE = (900, 1272)  # ~A4 ratio

BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
FIELD_ORDER = [
    "deed_no", "deed_date", "district", "upazila", "mouza", "khatian_no", "dag_no",
    "land_area", "area_unit", "seller", "father_name", "buyer",
]
LABELS = {  # field -> (English, Bangla)
    "deed_no": ("Deed No", "দলিল নং"),
    "deed_date": ("Date", "তারিখ"),
    "district": ("District", "জেলা"),
    "upazila": ("Upazila", "উপজেলা"),
    "mouza": ("Mouza", "মৌজা"),
    "khatian_no": ("Khatian", "খতিয়ান"),
    "dag_no": ("Dag", "দাগ"),
    "land_area": ("Area", "জমির পরিমাণ"),
    "area_unit": ("Unit", "একক"),
    "seller": ("Seller", "বিক্রেতা"),
    "father_name": ("Father's name", "পিতার নাম"),
    "buyer": ("Buyer", "ক্রেতা"),
}
NUMERIC = {"khatian_no", "dag_no", "land_area", "deed_no", "deed_date"}

# name pools for the evaluation set (all synthetic)
PEOPLE = [
    ("Rahim Uddin", "Abdul Jabbar"), ("Karim Mia", "Nur Mohammad"), ("Hasan Ali", "Md. Idris"),
    ("Jamal Hossain", "Sirajul Islam"), ("Shirin Akter", "Abul Kalam"),
    ("Nasir Ahmed", "Fazlul Haque"), ("Salma Begum", "Mizanur Rahman"),
    ("Tarek Aziz", "Abdul Latif"), ("Rubina Khatun", "Shamsul Alam"),
    ("Mahbub Alam", "Abdur Razzak"),
]
PLACES = [
    ("Gazipur", "Sreepur", "Barmi"), ("Gazipur", "Kaliakair", "Mouchak"),
    ("Dhaka", "Savar", "Ashulia"), ("Narayanganj", "Rupganj", "Bhulta"),
    ("Dhaka", "Dohar", "Nayabari"), ("Tangail", "Mirzapur", "Warshi"),
]


def _font(size: int) -> ImageFont.FreeTypeFont:
    for name in ("NotoSansBengali-Regular.ttf", "FreeSans.ttf"):  # OFL Noto preferred if present
        p = FONT_DIR / name
        if p.exists():
            return ImageFont.truetype(str(p), size, layout_engine=ImageFont.Layout.RAQM)
    raise FileNotFoundError("no font in ai/fonts")


def _from_fixture(key: str) -> dict[str, str]:
    fx = json.loads(FIXTURES.read_text(encoding="utf-8"))["by_marker"][key]
    return {k: v[0] for k, v in fx["fields"].items()}


def render(
    key: str, fields: dict[str, str], *, bn_digits: bool = False, label_mode: str = "both",
    skew: float = 0.0, noise: float = 0.0, seed: int = 0,
) -> tuple[bytes, dict]:
    """Render one deed. Returns (png_bytes, {field: bbox[x,y,w,h]})."""
    rng = random.Random(seed)
    img = Image.new("L", SIZE, 250)
    d = ImageDraw.Draw(img)
    big, mid, small = _font(40), _font(28), _font(20)
    d.rectangle([20, 20, SIZE[0] - 21, SIZE[1] - 21], outline=60, width=3)
    d.text((SIZE[0] // 2, 70), "Deed of Sale  |  বিক্রয় দলিল", font=big, fill=20, anchor="mm")
    d.text((SIZE[0] // 2, 112), "Demo Dataset — Not an Official Government Land Record",
           font=small, fill=110, anchor="mm")
    d.line([60, 140, SIZE[0] - 60, 140], fill=90, width=2)

    bboxes: dict[str, list[int]] = {}
    y = 175
    for f in FIELD_ORDER:
        if f not in fields:
            continue
        en, bn = LABELS[f]
        label = {"en": en, "bn": bn}.get(label_mode, f"{en} / {bn}")
        val = fields[f]
        shown = val.translate(BN_DIGITS) if bn_digits and f in NUMERIC else val
        d.text((60, y), label + ":", font=mid, fill=50)
        x = 330
        d.text((x, y), shown, font=mid, fill=10)
        l, t, r, b = d.textbbox((x, y), shown, font=mid)
        bboxes[f] = [l, t, r - l, b - t]
        y += 78
    d.line([60, y + 10, SIZE[0] - 60, y + 10], fill=90, width=2)
    d.text((60, y + 50), "Seller signature: ________", font=small, fill=90)
    d.text((500, y + 50), "Buyer signature: ________", font=small, fill=90)
    d.text((60, SIZE[1] - 60), "Synthetic specimen " + key, font=small, fill=140)

    if noise > 0:  # sparse speckle keeps PNGs small
        px = img.load()
        for _ in range(int(SIZE[0] * SIZE[1] * noise)):
            px[rng.randrange(SIZE[0]), rng.randrange(SIZE[1])] = rng.choice((0, 40, 120, 255))
    if skew:
        img = img.rotate(skew, resample=Image.Resampling.BICUBIC, fillcolor=250)
        # bboxes are for the unskewed layout; ground truth records the skew angle

    info = PngImagePlugin.PngInfo()
    info.add_text("LSMOCK", f"LSMOCK:{key}")  # plain tEXt chunk -> marker visible in raw bytes
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info, optimize=False, compress_level=9)
    return buf.getvalue(), bboxes


def _eval_specs(rng: random.Random, n: int = 20) -> list[dict]:
    specs = []
    for i in range(1, n + 1):
        (seller, father), (buyer, _) = rng.sample(PEOPLE, 2)
        dist, upa, mouza = rng.choice(PLACES)
        fields = {
            "deed_no": f"D-{rng.choice((2022, 2023, 2024))}-{rng.randrange(100, 999):04d}",
            "deed_date": f"{rng.choice((2022, 2023, 2024))}-{rng.randrange(1, 13):02d}-"
                         f"{rng.randrange(1, 28):02d}",
            "district": dist, "upazila": upa, "mouza": mouza,
            "khatian_no": str(rng.randrange(100, 2000)), "dag_no": str(rng.randrange(100, 999)),
            "land_area": str(rng.choice((5, 8, 10, 12, 15, 20))), "area_unit": "decimal",
            "seller": seller, "father_name": father, "buyer": buyer,
        }
        specs.append({
            "key": f"Eval{i:02d}", "fields": fields,
            "bn_digits": i % 3 == 0,
            "label_mode": ("both", "en", "bn")[i % 3],
            "skew": (0.0, 1.2, -1.8, 2.5)[i % 4],
            "noise": (0.0, 0.001, 0.003)[i % 3],
        })
    return specs


def generate(sample_dir: Path, eval_dir: Path) -> list[Path]:
    sample_dir.mkdir(parents=True, exist_ok=True)
    eval_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    # R7 demo docs: plain, clean layout (what mock providers + live demo use)
    for idx, key in enumerate(("Doc1", "Doc2", "AreaMismatch", "SellerMismatch", "Clean")):
        fields = _from_fixture(key)
        fields.setdefault("father_name", "")
        if not fields["father_name"]:
            fields.pop("father_name")
        png, _ = render(key, fields, seed=SEED + idx)
        p = sample_dir / f"{key}.png"
        p.write_bytes(png)
        written.append(p)

    rng = random.Random(SEED)
    truth = []
    for spec in _eval_specs(rng):
        png, boxes = render(
            spec["key"], spec["fields"], bn_digits=spec["bn_digits"], label_mode=spec["label_mode"],
            skew=spec["skew"], noise=spec["noise"], seed=SEED + len(truth) + 100,
        )
        p = eval_dir / f"{spec['key'].lower()}.png"
        p.write_bytes(png)
        written.append(p)
        truth.append({
            "file": p.name, "marker": spec["key"], "fields": spec["fields"],
            "bboxes": boxes, "variant": {k: spec[k] for k in ("bn_digits", "label_mode", "skew", "noise")},
        })
    gt = eval_dir / "ground_truth.json"
    gt.write_text(json.dumps({"seed": SEED, "documents": truth}, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    written.append(gt)
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, help="write everything under this dir (tests)")
    a = ap.parse_args()
    sample, ev = (a.out / "sample_data", a.out / "eval") if a.out else (
        REPO / "database" / "sample_data", HERE / "data")
    files = generate(sample, ev)
    total = sum(f.stat().st_size for f in files)
    print(f"wrote {len(files)} files, {total / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
