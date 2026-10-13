"""Fill gaps in database/gis/mouzas.json from database/gis/mouzamap_index.json (scripts/build_mouzamap_index.py).

Official sources (map.land.gov.bd, DLRS) cover only some upazilas. For every (upazila, survey, JL no)
found in the mouzamap.tech listing:
  - if mouzas.json already has that mouza (same upazila, and same Bangla name or same JL no + survey),
    the missing survey sheets are added to it (each marked with the survey and a link);
  - otherwise a new mouza is added (source "mouzamap", no union, no coordinates).
Entries from an earlier run (source "mouzamap") are dropped first, so reruns are idempotent.
Sheet links open the third-party site's viewer page (?a=view); nothing is copied.
Files with a JL no. but no survey type in their name or folders are labelled "Unknown" (Khulna, Rajshahi, Rangpur drives only).

Usage:  python scripts/merge_mouzamap_index.py [--division 3,1]   (app division ids: 3 = Dhaka, 1 = Barishal, 4 = Khulna, 5 = Rajshahi, 6 = Rangpur)
"""

from __future__ import annotations

import argparse
import collections
import difflib
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GIS = ROOT / "database" / "gis"
SOURCE = "mouzamap"


def _feats(name: str) -> list[dict]:
    return [f["properties"] for f in json.loads((GIS / f"{name}.geojson").read_text(encoding="utf-8"))["features"]]


def _key(text: str) -> str:
    t = re.sub(r"(CS[-_ ]?SA|CS|RS|SA|BS|BRS|সিএস|আরএস|জরিপ)", "", text, flags=re.I)
    t = re.sub(r"(উপজেলা|থানা|সদর|\bsadar\b|\bupazila\b|\bthana\b)", "", t, flags=re.I)
    return re.sub(r"[\s\-_.()]+|-j$", "", t.lower())


# Folder spellings fuzzy matching cannot reach: (district, folder) -> this app's upazila name.
ALIASES = {
    ("Dhaka", "কতোয়ালী"): "Kotwali", ("Dhaka", "লালবাগ"): "Lalbagh", ("Dhaka", "মতিঝিল"): "Motijheel",
    ("Dhaka", "সুত্রাপুর"): "Sutrapur", ("Faridpur", "CHAR VODRASHON"): "Charbhadrasan",
    ("Gazipur", "জয়দেবপুর- গাজীপুর সদর"): "Gazipur Sadar", ("Gopalganj", "কাশীয়ানি-"): "Kashiani",
    ("Kishoreganj", "কটিয়াদি"): "Katiadi", ("Manikganj", "ঘিত্তর"): "Ghior", ("Munshiganj", "লৌহজং"): "Lohajang",
    ("Munshiganj", "টুংগীবাড়ি-"): "Tongibari", ("Narayanganj", "বন্দর-RS-BS  @CS naraynganj"): "Bandar",
    ("Rajbari", "গোয়ালান্দ-"): "Goalandaghat", ("Shariatpur", "জার্জিরা"): "Zanjira",
    ("Shariatpur", "ড্যামুডে"): "Damudya", ("Shariatpur", "নরিয়া"): "Naria", ("Tangail", "দেলদোয়ার"): "Delduar",
    ("Tangail", "ভূয়াপুর-"): "Bhuapur",
    # Barishal division. "District/Name" = the folder sits under the wrong district on the site.
    ("Pirojpur", "মঠবাড়িয়া"): "Mathbaria", ("Barishal", "বানরীপাড়া"): "Banaripara", ("Barishal", "স্বরুপকাটী"): "Pirojpur/Nesarabad",
    ("Barishal", "দৌলত খাঁ"): "Bhola/Daulatkhan", ("Barishal", "দৌলতখাঁ-"): "Bhola/Daulatkhan", ("Bhola", "মনিপুরা"): "Manpura",
    ("Barishal", "কলাপাড়া"): "Patuakhali/Kalapara", ("Jhalokati", "কলাপাড়া-CS"): "Patuakhali/Kalapara",
    ("Barishal", "বাউফল-"): "Patuakhali/Bauphal", ("Barishal", "পটুয়াখালী -"): "Patuakhali/Patuakhali Sadar",
    ("Barishal", "পাথরঘাটা"): "Barguna/Patharghata", ("Barguna", "পাথর ঘাটা"): "Patharghata",
    ("Barishal", "নাজিরপুর (বাকেরগঞ্জ)"): "Pirojpur/Nazirpur", ("Barishal", "বাকরগঞ্জ-দিয়ারা"): "Bakerganj",
    ("Barishal", "বাকরগঞ্জ-CS"): "Bakerganj", ("Patuakhali", "দুম\u200cকি-"): "Dumki", ("Patuakhali", "গোলাচিপা-"): "Galachipa",
    # Khulna division.
    ("Jessore", "যশোর সদর-"): "Kotwali", ("Jessore", "শার্শা-"): "Sharsha", ("Khulna", "দাকপ-"): "Dacope",
    ("Khulna", "খুলনা সদর-"): "Khulna Sadar", ("Khulna", "কয়রা-"): "Koyra", ("Khulna", "শ্যামনগর-"): "Satkhira/Shyamnagar",
    ("Khulna", "তালা"): "Satkhira/Tala", ("Khulna", "ফকিরহাট-CS"): "Bagerhat/Fakirhat", ("Bagerhat", "কচুয়া-"): "Kachua",
    ("Satkhira", "কলারোয়া"): "Kalaroa", ("Meherpur", "গাংনী-"): "Chuadanga/Gangni",
    ("Meherpur", "মেহেরপুর-"): "Chuadanga/Meherpur Sadar", ("Meherpur", "মেহেরপুর সদর-"): "Chuadanga/Meherpur Sadar",
    ("Chuadanga", "জিবননগর-(153)"): "Jibannagar",
    # Rajshahi and Rangpur divisions.
    ("Dinajpur", "BODHA"): "Panchagarh/Boda", ("Dinajpur", "AUTWARI"): "Panchagarh/Atwari", ("Dinajpur", "আটোয়ারী-"): "Panchagarh/Atwari",
    ("Panchagarh", "আটোয়ারী"): "Atwari", ("Lalmonirhat", "লালমুনিরহাট সদর"): "Kurigram/Lalmonirhat Sadar",
    ("Sirajganj", "রায়গঞ্জ"): "Royganj", ("Dinajpur", "ফুলবাড়ী"): "Phulbari", ("Bogura", "বগুড়া সদর-"): "Bogra Sadar",
    ("Gaibandha", "ফুলছুড়ি"): "Fulchhari", ("Thakurgaon", "রাণীশংকৈল-J"): "Ranisankail",
    ("Dinajpur", "বালিয়াডাঙ্গী-"): "Thakurgaon/Baliadangi", ("Bogura", "দুবচাচিয়া"): "Dhupchanchia",
    ("Dinajpur", "বিরল"): "Biral", ("Dinajpur", "ঘোড়াঘাঠ"): "Ghoraghat", ("Kurigram", "রৌওমারি"): "Raumari",
    # Naragati thana (old Jessore) is Kalia today: Baoishona, Bagudanga, Mulshri and Charsinggoti are in Kalia's official list.
    ("Jessore", "নড়াগাতী-CS"): "Narail/Kalia Upazilla",
    # Folders named after a survey, not an upazila. Panchagarh Sadar: JL 9-13, 21, 22 are exactly the gaps in its official RS list.
    ("Panchagarh", "RS"): "Panchagarh Sadar", ("Panchagarh", "bs"): "Panchagarh Sadar",
    ("Rajshahi", "Poba"): "Paba", ("Rajshahi", "বোয়ালিয়া-"): "Boalia",
}

# Survey-named folders that hold one folder per upazila: the upazila is the next path segment (2:/Rajshahi/RS/Poba/...).
NESTED = {("Rajshahi", "RS"), ("Rajshahi", "রাজশাহী")}

# Files with a JL no. but no survey anywhere in the file or folder name are listed under this label, for these drives
# only (3:/ Khulna, 2:/ Rajshahi, 6:/ Rangpur); Dhaka (0:/) and Barishal (4:/) keep skipping them.
UNKNOWN_SURVEY = "Unknown"
UNKNOWN_SURVEY_ROOTS = ("3:/", "2:/", "6:/")


# District spellings on the site that differ from this app's district names.
DISTRICT_ALIASES = {"Jessore": "Jashore", "Sirajganj": "Sirajgonj"}


def build_upazila_index(divisions: set[str]) -> dict[str, list[tuple[str, str]]]:
    dists = {d["id"]: d for d in _feats("districts") if d["division_id"] in divisions}
    out: dict[str, list[tuple[str, str]]] = {d["name"]: [] for d in dists.values()}
    for u in _feats("upazilas"):
        if u["district_id"] in dists:
            dn = dists[u["district_id"]]["name"]
            out[dn] += [(_key(u["name"]), u["id"]), (_key(u.get("bn_name", "")), u["id"])]
            if u["name"].lower().endswith(" sadar"):  # 'Faridpur Sadar' folders are often just the district
                out[dn].append((_key(dn), u["id"]))
    return out


def match_upazila(index: dict[str, list[tuple[str, str]]], district: str, folder: str) -> str | None:
    alias = ALIASES.get((district, folder))
    district = DISTRICT_ALIASES.get(district, district)
    cands = index.get(district, [])
    if alias:
        if "/" in alias:
            district, alias = alias.split("/", 1)
            cands = index.get(district, [])
        return next((i for key, i in cands if key == _key(alias)), None)
    k = _key(folder)
    if not k:
        return None
    exact = [i for key, i in cands if key and key == k]
    if exact:
        return exact[0]
    close = difflib.get_close_matches(k, [c[0] for c in cands if c[0]], n=1, cutoff=0.75)
    return next(i for key, i in cands if key == close[0]) if close else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--division", default="3,1", help="comma separated app division ids")
    a = ap.parse_args()
    listing = json.loads((GIS / "mouzamap_index.json").read_text(encoding="utf-8"))
    dest = GIS / "mouzas.json"
    data = json.loads(dest.read_text(encoding="utf-8"))
    mouzas = [m for m in data["mouzas"] if m.get("source") != SOURCE]
    for m in mouzas:  # strip sheets a previous run added
        m["sheets"] = [s for s in m.get("sheets", []) if s.get("source") != SOURCE]
    by_upazila: dict[str, list[dict]] = collections.defaultdict(list)
    for m in mouzas:
        by_upazila[str(m["upazila_id"])].append(m)

    index = build_upazila_index({d.strip() for d in a.division.split(",")})
    groups: dict[tuple[str, str, str], list[dict]] = collections.defaultdict(list)
    unmatched: collections.Counter[tuple[str, str]] = collections.Counter()
    skipped = 0
    for f in listing["files"]:
        if f["jl_no"] and not f["survey"] and f["path"].startswith(UNKNOWN_SURVEY_ROOTS):
            f = {**f, "survey": UNKNOWN_SURVEY}
        if not f["jl_no"] or not f["survey"]:
            skipped += 1
            continue
        folder = f["upazila_folder"] or ""
        if (f["district"], folder) in NESTED:
            folder = f["path"].split("/")[3].strip()
        up = match_upazila(index, f["district"], folder)
        if up is None:
            unmatched[(f["district"], folder)] += 1
            continue
        groups[(up, f["survey"], f["jl_no"])].append(f)

    added = extended = 0
    for (up, survey, jl), files in sorted(groups.items()):
        name = collections.Counter(f["mouza"] for f in files if f["mouza"]).most_common(1)
        name = name[0][0] if name else f"JL {jl}"
        sheets = [
            {
                "sheet_no": f["sheet_no"] or "001",
                "survey": survey,
                "plots": 0,
                "source": SOURCE,
                "url": listing["source_url"] + "/" + urllib.parse.quote(f["path"], safe="/:") + "?a=view",  # viewer page; direct download links are signed and expire
            }
            for f in sorted(files, key=lambda f: (f["sheet_no"] or "", f["path"]))
        ]
        sheets = list({s["sheet_no"]: s for s in reversed(sheets)}.values())[::-1]  # "(1)" copies repeat a sheet

        known = next(
            (m for m in by_upazila[up] if m.get("bn_name") == name or m["name"].lower() == name.lower()
             or (m.get("jl_no") == jl and any(s.get("survey") == survey for s in m.get("sheets", [])))),
            None,
        )
        if known:
            have = {(s.get("survey"), s.get("sheet_no")) for s in known["sheets"]}
            new = [s for s in sheets if (s["survey"], s["sheet_no"]) not in have]
            if new:
                known["sheets"] += new
                extended += 1
            continue
        has_bn = bool(re.search(r"[ঀ-৿]", name))
        code = f"mm-{up}-{survey}-{jl}-{len(by_upazila[up])}"
        m = {
            "id": code, "upazila_id": up, "union_id": None, "code": code,
            "name": name, "bn_name": name if has_bn else "", "jl_no": jl,
            "lat": None, "long": None, "plot_count": None,
            "sheets": sheets, "source": SOURCE, "source_url": listing["source_url"],
        }
        mouzas.append(m)
        by_upazila[up].append(m)
        added += 1

    data["mouzas"] = mouzas
    srcs = [s for s in data.get("sources", []) if s.get("url") != listing["source_url"]]
    data["sources"] = [*srcs, {"name": "mouzamap.tech scanned CS/SA/RS mouza maps (third party, unofficial; listing only)", "url": listing["source_url"]}]
    if "mouzamap" not in data["note"]:
        data["note"] += " mouzamap.tech entries fill upazilas the official sources lack; names, JL and sheet numbers are parsed from file names."
    dest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"added {added} mouzas, extended {extended}; skipped {skipped} unparseable files; total {len(mouzas)}")
    for (d, u), n in unmatched.most_common(80):
        print(f"  ! unmatched folder {d} / {u}: {n} files")


if __name__ == "__main__":
    main()
