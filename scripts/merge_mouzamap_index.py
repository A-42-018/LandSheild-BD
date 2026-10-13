"""Fill gaps in database/gis/mouzas.json from database/gis/mouzamap_index.json (scripts/build_mouzamap_index.py).

Official sources (map.land.gov.bd, DLRS) cover only some upazilas. For every (upazila, survey, JL no)
found in the mouzamap.tech listing:
  - if mouzas.json already has that mouza, the survey sheets it lacks are added to it (each marked with the
    survey and a link), and a link is put on an official sheet with the same survey and number that had none.
    "Already has it" means, in this order: the same Bangla or English name anywhere in the upazila; or the same
    JL no. and a sheet of the same survey; or the same JL no. and a similar name (see skeleton() below);
  - otherwise a new mouza is added (source "mouzamap", no union, no coordinates).
A JL no. alone is NOT taken as identity across surveys: CS/SA numbered mouzas differently from RS/BS, so the same
number in one upazila can be two different mouzas. Those stay separate rows.
Entries from an earlier run (source "mouzamap") are dropped first, so reruns are idempotent.
Sheet links open the third-party site's viewer page (?a=view); the app downloads through its own API. Nothing is copied here.
Files with a JL no. but no survey type in their name or folders are labelled "Unknown" (Khulna, Rajshahi, Rangpur drives only).

Usage:  python scripts/merge_mouzamap_index.py [--division 3,1]   (app division ids: 3 = Dhaka, 1 = Barishal, 4 = Khulna, 5 = Rajshahi, 6 = Rangpur)
"""

from __future__ import annotations

import argparse
import collections
import difflib
import json
import re
import unicodedata
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


# Names of the same mouza differ in script and spelling ("KRISNOPUR", "Krishnapur", "কৃষ্ণপুর"), so they are compared by a
# coarse consonant skeleton that is the same for Latin and Bangla text. SAME_NAME was chosen on the data (docs/gis.md):
# 98% of official English/Bangla name pairs score at least 0.8, 0.4% of different mouzas of one upazila do, and among
# scan rows sharing an upazila and JL no. the scores split into ~2,000 pairs at 0.9-1.0 and a tail of different mouzas
# below 0.7. Between 0.7 and 0.92 pairs are mixed, so they are left as separate rows (a leftover duplicate row is
# harmless; a wrong merge would attach the wrong PDF to a mouza).
SAME_NAME = 0.92
_BN_CONSONANT = {ch: c for chars, c in (
    ("কখ", "k"), ("গঘ", "g"), ("ঙং", "n"), ("চছ", "k"), ("জঝয", "j"), ("ঞনণ", "n"), ("টঠতথৎ", "t"), ("ডঢদধ", "d"),
    ("পফ", "p"), ("বভ", "b"), ("ম", "m"), ("রঋৃ", "r"), ("ল", "l"), ("শষস", "s"),  # ৃ is "ri" in কৃষ্ণ (Krishna)
) for ch in chars}
_NAME_TAGS = re.compile(
    r"সি\s*\.?\s*এস|এস\s*\.?\s*এ|আর\s*\.?\s*এস|বি\s*\.?\s*এস|\b(?:cs|sa|rs|bs|brs|diara|mouza|moja)\b|মৌজা", re.I
)


def _squash(s: str) -> str:
    return re.sub(r"(.)\1+", r"\1", s)


def skeleton(name: str) -> str:
    """Consonants only, with look-alike letters merged: 'Krishnapur', 'KRISNOPUR' and 'কৃষ্ণপুর' all give 'krsnpr'."""
    s = unicodedata.normalize("NFC", name)
    s = _NAME_TAGS.sub(" ", re.sub(r"\(.*?\)", " ", s))  # "(B.P.O)", survey tags such as "সি.এস", "127" prefixes
    if re.search(r"[ঀ-৿]", s):
        for a, b in (("ড়", "র"), ("ঢ়", "র"), ("য়", ""), ("ড\u09bc", "র"), ("ঢ\u09bc", "র"), ("য\u09bc", "")):  # nukta letters
            s = s.replace(a, b)
        return _squash("".join(_BN_CONSONANT.get(c, "") for c in s))
    s = re.sub(r"[^a-z]", "", s.lower())
    for a, b in (("kkh", "ks"), ("ph", "p"), ("z", "j"), ("v", "b"), ("q", "k"), ("c", "k"), ("x", "ks"), ("f", "p")):  # "Dakkhin" = দক্ষিণ
        s = s.replace(a, b)
    return _squash(re.sub(r"[aeiouhyw]", "", s))


def name_similarity(a: str, b: str) -> float:
    ka, kb = skeleton(a), skeleton(b)
    if len(ka) < 2 or len(kb) < 2:
        return 0.0
    if ka == kb:
        return 1.0
    if min(len(ka), len(kb)) < 3:  # too little left to trust anything but an exact match
        return 0.0
    return difflib.SequenceMatcher(None, ka, kb).ratio()


def _names(m: dict) -> list[str]:
    return [n for n in dict.fromkeys([m["name"], m.get("bn_name") or ""]) if n]


def mouza_similarity(m: dict, name: str) -> float:
    return max((name_similarity(n, name) for n in _names(m)), default=0.0)


def merge_same_code(rows: list[dict]) -> tuple[list[dict], int]:
    """One row per official code: the sources sometimes list one mouza twice, each time with other survey sheets."""
    first: dict[str, dict] = {}
    out: list[dict] = []
    for m in rows:
        keep = first.setdefault(m["id"], m)
        if keep is m:
            out.append(m)
            continue
        have = {(s.get("survey"), s.get("sheet_no")) for s in keep["sheets"]}
        keep["sheets"] += [s for s in m["sheets"] if (s.get("survey"), s.get("sheet_no")) not in have]
    return out, len(rows) - len(out)


def absorb_name(m: dict, name: str) -> None:
    """A scan row that gains a spelling in the other script keeps both ("GANOPARA (গণপাড়া)"); official names are never touched."""
    if m.get("source") != SOURCE:
        return
    bangla = bool(re.search(r"[ঀ-৿]", name))
    if bangla and not m.get("bn_name"):
        m["bn_name"] = name
    elif not bangla and (m["name"] == m.get("bn_name") or (m["name"].isupper() and not name.isupper())):
        m["name"] = name


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
    ap.add_argument("--out", type=Path, default=GIS / "mouzas.json", help="where to write the result (default: mouzas.json itself)")
    a = ap.parse_args()
    listing = json.loads((GIS / "mouzamap_index.json").read_text(encoding="utf-8"))
    dest = GIS / "mouzas.json"
    data = json.loads(dest.read_text(encoding="utf-8"))
    mouzas = [m for m in data["mouzas"] if m.get("source") != SOURCE]
    for m in mouzas:  # strip sheets (and links on official sheets) a previous run added
        m["sheets"] = [s for s in m.get("sheets", []) if s.get("source") != SOURCE]
        for s in m["sheets"]:
            if s.pop("url_source", None):
                s.pop("url", None)
    mouzas, same_code = merge_same_code(mouzas)
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

    added = extended = by_name = linked = 0
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
        if known is None:  # same JL no. and a similar name in the other script or spelling; official rows first
            close = [
                (mouza_similarity(m, name), m.get("source") != SOURCE, m)
                for m in by_upazila[up] if m.get("jl_no") == jl
            ]
            close = [c for c in close if c[0] >= SAME_NAME]
            if close:
                known = max(close, key=lambda c: (c[1], c[0]))[2]
                by_name += 1
        if known:
            absorb_name(known, name)
            on_record = {(s.get("survey"), s.get("sheet_no")): s for s in known["sheets"]}
            links = {s["url"] for s in known["sheets"] if s.get("url")}
            changed = False
            for s in sheets:
                cur = on_record.get((s["survey"], s["sheet_no"]))
                if s["url"] in links:
                    continue
                if cur is not None and not cur.get("url"):  # an official sheet of the same survey and number: give it the scan link
                    cur["url"], cur["url_source"] = s["url"], SOURCE
                    linked += 1
                else:  # a new sheet, or a second scan of a sheet number (e.g. filed under the CS-era JL no.): never drop a link
                    known["sheets"].append(s)
                    on_record.setdefault((s["survey"], s["sheet_no"]), s)
                links.add(s["url"])
                changed = True
            extended += changed
            continue
        has_bn = bool(re.search(r"[ঀ-৿]", name))
        code = f"mm-{up}-{survey}-{jl}"  # unique: one scan row per (upazila, survey, JL no); stays put when matching improves
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
    a.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"added {added} mouzas, extended {extended} ({by_name} found by similar name, {linked} official sheets given a scan link); "
          f"{same_code} official rows with a repeated code merged; skipped {skipped} unparseable files; total {len(mouzas)}")
    for (d, u), n in unmatched.most_common(80):
        print(f"  ! unmatched folder {d} / {u}: {n} files")


if __name__ == "__main__":
    main()
