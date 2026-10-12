"""Build backend/app/data/land_offices.json from the division workbooks + Bangla geocode names.

Usage (dev only; needs openpyxl, not a runtime dependency):
    python scripts/build_land_offices.py <dir-with-*_Division_Land_Offices.xlsx> <dir-with-geocode-json>

The geocode dir holds divisions/districts/upazilas/unions.json from
https://github.com/nuhil/bangladesh-geocode (name + bn_name). Bangla names are matched by
English name *within the parent* (division -> district -> upazila -> union) with a small alias
table and a fuzzy fallback; anything unmatched is printed and falls back to the English text.
"""
import difflib
import glob
import json
import re
import sys
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "land_offices.json"

DIVISION_BN = {
    "Barishal": "বরিশাল", "Chattogram": "চট্টগ্রাম", "Dhaka": "ঢাকা", "Khulna": "খুলনা",
    "Mymensingh": "ময়মনসিংহ", "Rajshahi": "রাজশাহী", "Rangpur": "রংপুর", "Sylhet": "সিলেট",
}
# workbook spelling -> geocode spelling (or direct Bangla when the geocode lacks the place)
ALIAS = {
    "barishal": "barisal", "chattogram": "chittagong", "cumilla": "comilla", "bogura": "bogra",
    "jashore": "jessore", "cox's bazar": "coxs bazar", "chapainawabganj": "nawabganj",
    "moulvibazar": "maulvibazar", "jhalakathi": "jhalokati", "barguna": "barguna",
    "netrokona": "netrakona", "narsingdi": "narsingdi", "brahmanbaria": "brahmanbaria",
    "munshiganj": "munshiganj", "habiganj": "habiganj", "jhenaidah": "jhenaidah",
    "bagerhat": "bagerhat", "khagrachhari": "khagrachari", "chuadanga": "chuadanga",
    "cumilla adarsha sadar": "comilla sadar", "cumilla sadar dakshin": "sadarsouth",
    "chapai nawabganj sadar": "nawabganj", "sunamganj dakshin": "dakshin sunamganj",
    "paikgachha": "paikgasa", "dacope": "dacope", "senbagh": "senbag", "fulchhari": "fulchari",
    "mohanganj": "mohongonj", "baniachong": "baniachang", "sullah": "shalla",
    "tahirpur": "tahirpur", "saidpur": "saidpur", "dasar": "dasar",
}
# the 8 Dhaka metropolitan circles (not in the geocode data)
CIRCLE_BN = {
    "Cantonment": "ক্যান্টনমেন্ট", "Demra": "ডেমরা", "Dhanmondi": "ধানমন্ডি", "Gulshan": "গুলশান",
    "Mirpur": "মিরপুর", "Motijheel": "মতিঝিল", "Ramna": "রমনা", "Sutrapur": "সূত্রাপুর",
    "Tejgaon": "তেজগাঁও", "Uttara": "উত্তরা", "Lalbagh": "লালবাগ", "Kotwali": "কোতোয়ালী",
}
MANUAL_BN: dict[tuple[str, str], str] = {}  # (kind, "district|name") -> Bangla, filled by hand


def key(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r"\b(upazila|upazilla|union|sadar|city corporation)\b", "", s)
    s = re.sub(r"[^a-z0-9' ]", " ", s)
    s = ALIAS.get(s.strip(), s.strip())
    s = s.replace("w", "o").replace("z", "j").replace("ee", "i").replace("oo", "u")
    return re.sub(r"[^a-z0-9]", "", s)


def match(name: str, pool: dict[str, str]) -> str | None:
    """pool: key(name) -> bn_name within one parent."""
    k = key(name)
    if k in pool:
        return pool[k]
    close = difflib.get_close_matches(k, list(pool), n=1, cutoff=0.78)
    return pool[close[0]] if close else None


def load_geo(d: Path):
    def rows(n):
        data = json.loads((d / f"{n}.json").read_text(encoding="utf-8"))
        return next(x["data"] for x in data if x.get("type") == "table")

    return rows("divisions"), rows("districts"), rows("upazilas"), rows("unions")


def main(xlsx_dir: str, geo_dir: str) -> None:
    divs, dists, upas, unis = load_geo(Path(geo_dir))
    dist_by_div: dict[str, dict[str, str]] = {}
    div_name = {d["id"]: d["name"] for d in divs}
    dist_id: dict[tuple[str, str], str] = {}
    for d in dists:
        dist_by_div.setdefault(d["division_id"], {})[key(d["name"])] = d["bn_name"]
    dist_bn_all = {key(d["name"]): d for d in dists}
    upa_by_dist: dict[str, dict[str, tuple[str, str]]] = {}
    for u in upas:
        upa_by_dist.setdefault(u["district_id"], {})[key(u["name"])] = (u["bn_name"], u["id"])
    uni_by_upa: dict[str, dict[str, str]] = {}
    for n in unis:
        uni_by_upa.setdefault(n["upazilla_id"], {})[key(n["name"])] = n["bn_name"]
    del div_name, dist_id

    rows: list[dict] = []
    missing: list[str] = []
    for f in sorted(glob.glob(f"{xlsx_dir}/*_Division_Land_Offices.xlsx")):
        ws = openpyxl.load_workbook(f, read_only=True)["All Land Offices"]
        for sl, div, dist, _name, otype, upa, loc in list(ws.iter_rows(values_only=True))[1:]:
            if sl is None:
                continue
            d = dist_bn_all.get(key(dist))
            if d is None:
                missing.append(f"district {dist}")
            dist_bn = d["bn_name"] if d else dist
            upa_name = None if upa in (None, "-") else upa
            upa_bn = union_bn = None
            union_name = None
            if otype == "Circle Land Office (Metropolitan)":
                upa_bn = CIRCLE_BN.get(upa_name or "")
                if upa_bn is None:
                    missing.append(f"circle {upa_name}")
            elif upa_name:
                hit = upa_by_dist.get(d["id"] if d else "", {}).get(key(upa_name)) if d else None
                if hit is None and d:
                    close = difflib.get_close_matches(
                        key(upa_name), list(upa_by_dist.get(d["id"], {})), n=1, cutoff=0.78
                    )
                    hit = upa_by_dist[d["id"]][close[0]] if close else None
                if hit is None:
                    missing.append(f"upazila {dist}/{upa_name}")
                else:
                    upa_bn = hit[0]
                if otype == "Union Land Office":
                    union_name = re.sub(r" Union Land Office.*$", "", _name)
                    pool = uni_by_upa.get(hit[1], {}) if hit else {}
                    union_bn = match(union_name, pool)
                    if union_bn is None:
                        missing.append(f"union {dist}/{upa_name}/{union_name}")
            rows.append(
                {
                    "type": otype,
                    "division_en": div, "division_bn": DIVISION_BN[div],
                    "district_en": dist, "district_bn": dist_bn,
                    "upazila_en": upa_name, "upazila_bn": upa_bn or upa_name,
                    "union_en": union_name, "union_bn": union_bn or union_name,
                    "name_en": _name, "location": loc,
                }
            )
    # Bangla office names from the place names (the workbook only has English)
    fixed = {
        "Office of the Deputy Commissioner (DC) – Land / Revenue Branch":
            "জেলা প্রশাসকের কার্যালয় – ভূমি / রাজস্ব শাখা",
        "Additional Deputy Commissioner (Revenue) Office":
            "অতিরিক্ত জেলা প্রশাসক (রাজস্ব) কার্যালয়",
        "District Land Record Room": "জেলা ভূমি রেকর্ড রুম",
    }
    for r in rows:
        t = r["type"]
        if t == "District Land Office":
            r["name_bn"] = fixed.get(r["name_en"], r["name_en"])
        elif t == "Upazila Land Office":
            r["name_bn"] = f"{r['upazila_bn']} উপজেলা ভূমি অফিস (সহকারী কমিশনার (ভূমি))"
        elif t == "Union Land Office":
            r["name_bn"] = f"{r['union_bn']} ইউনিয়ন ভূমি অফিস (তহসিল অফিস)"
        else:
            r["name_bn"] = f"{r['upazila_bn']} রাজস্ব সার্কেল ভূমি অফিস"
    for i, r in enumerate(rows, 1):
        r["code"] = f"LO-{i:05d}"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(rows)} offices to {OUT}; {len(missing)} Bangla names unmatched")
    for m in missing:
        print("  unmatched:", m)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
