"""List the scanned mouza-map PDFs published on free.mouzamap.tech (Dhaka 0:/, Barishal 4:/, ...) as index entries.

Third-party, unofficial site: a Google-Drive-style index of scanned CS/SA/RS mouza map sheets.
This script only READS directory listings (the same POST the site's own pages make) and records,
per PDF: district, folder path, mouza name, JL number and survey type parsed from the file name,
size, and the link to the file on that site. It never downloads or copies a PDF.

Usage:  python scripts/build_mouzamap_index.py [--root 0:/ --root 4:/] [--delay 0.5] [--cache DIR]
  Each run replaces only the entries under the given roots; entries of other roots already in the file are kept.
Output: database/gis/mouzamap_index.json  (committed). Stdlib only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://free.mouzamap.tech"
FOLDER = "application/vnd.google-apps.folder"
_BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
SURVEY_BN = {"সি.এস": "CS", "সি এস": "CS", "এস.এ": "SA", "এস এ": "SA", "আর.এস": "RS", "আর এস": "RS", "বি.আর.এস": "BRS", "বি.এস": "BS", "বি এস": "BS", "পি.এস": "PS"}
SURVEY_RE = r"CS[-_ ]?SA|CS|SA|RS|BRS|BDS|BS|PS|" + "|".join(re.escape(k) for k in SURVEY_BN)


def listing(path: str, cache: Path, delay: float) -> list[dict]:
    key = cache / (hashlib.sha1(path.encode()).hexdigest() + ".json")
    if key.exists():
        return json.loads(key.read_text(encoding="utf-8"))
    rows: list[dict] = []
    token, idx = None, 0
    while True:
        body = json.dumps({"q": "", "password": "", "page_token": token, "page_index": idx}).encode()
        req = urllib.request.Request(
            BASE + urllib.parse.quote(path, safe="/:"), data=body, headers={"Content-Type": "application/json", "User-Agent": "LandShieldBD-index/1.0"}
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read())
        time.sleep(delay)
        rows += d["data"]["files"]
        token, idx = d.get("nextPageToken"), idx + 1
        if not token:
            break
    cache.mkdir(parents=True, exist_ok=True)
    key.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    return rows


def _survey(token: str | None) -> str | None:
    if not token:
        return None
    token = SURVEY_BN.get(token.strip(), token.strip())
    return re.sub(r"[_ ]", "-", token.upper())


def survey_from_trail(trail: list[str]) -> str | None:
    for part in reversed(trail):
        if re.search(r"diy?[ae]ra|দিয়ারা", part, flags=re.I):  # 'DIYARA', '4_DIYERA', 'দিয়ারা-' (river-island survey)
            return "DIARA"
        if re.search(r"(?:^|[\s_-])PETY(?:$|[\s_-])", part, flags=re.I):  # petty survey
            return "PS"
        if re.search(r"CS[-_ ]?RS", part, flags=re.I):  # '2_CSRS-আরএস': files carry no survey, the Bangla part says RS
            return "RS"
        m = re.search(rf"(?:^|[\s_-])({SURVEY_RE})(?:$|[\s_-])", part, flags=re.I)
        if m:
            return _survey(m.group(1))
        if "সিটি জরিপ" in part:
            return "CITY"
    return None


def parse_name(name: str) -> dict:
    """Names seen: '18-Raypara-2_result_result', 'এস.এ_আমতা_৮২_১', '307-1 সি.এস_বাঙ্গুরী_৩০৭_১', '11-RS-সেলনা-1'.

    Returns jl_no, survey (None when the name does not say), mouza and sheet_no (None when absent).
    """
    stem = re.sub(r"\.pdf$", "", re.sub(r"^(copy of\s+)+", "", name.strip(), flags=re.I), flags=re.I)
    stem = re.sub(r"\(?\s*www\.mouzamap\.tech\s*\)?", "", stem, flags=re.I)
    stem = re.sub(r"_result(_result)?", "", stem, flags=re.I)
    stem = re.sub(r"\s*\(\d+\)\s*$", "", stem.strip(" -_.")).strip(" -_.").translate(_BN)
    survey = jl = sheet = None
    if m := re.match(r"^(\d+)\s+(.+?)[_ ]SH[-_ ]?(\d+)$", stem, flags=re.I):  # '8 ITBARIA_SH-1' (JL, name, sheet)
        return {"jl_no": m.group(1).zfill(3), "survey": None, "mouza": m.group(2).strip(" -."), "sheet_no": m.group(3).zfill(3)}
    if m := re.match(r"^(\d+)-(\d+)$", stem):  # nameless '68-1' (JL, sheet)
        return {"jl_no": m.group(1).zfill(3), "survey": None, "mouza": "", "sheet_no": m.group(2).zfill(3)}
    m = re.match(rf"^\d+-\d+\s+({SURVEY_RE})[_ ](.+)$", stem, flags=re.I)  # '307-1 সি.এস_বাঙ্গুরী_307_1'
    if m:
        survey, stem = _survey(m.group(1)), m.group(2)
    else:
        m = re.match(rf"^({SURVEY_RE})[_ ]+(.*)$", stem, flags=re.I)  # 'এস.এ_আমতা_82_1'
        if m:
            survey, stem = _survey(m.group(1)), m.group(2)
    if survey and (m := re.match(r"^()(\d+)(?:_+(\d*))?$", stem)):  # nameless: 'সি.এস__336_1'
        stem, jl, sheet = "", m.group(2), m.group(3) or None
    elif survey and (m := re.match(r"^(.*?)_+(\d+)(?:_+(\d*))?$", stem)):
        stem, jl, sheet = m.group(1), m.group(2), m.group(3) or None
    elif m := re.match(rf"^0*(\d+)-(?:({SURVEY_RE})-)?(.+?)(?:-(\d+))?$", stem, flags=re.I):  # '11-RS-সেলনা-1', '18-Raypara-2'
        jl, survey, stem, sheet = m.group(1), _survey(m.group(2)), m.group(3), m.group(4)
    elif m := re.match(r"^(.*?)_+(\d+)_+\d+_+(\d+)$", stem):  # 'চর বেরেট_71_141_6' (name, JL, other no., sheet)
        stem, jl, sheet = m.group(1), m.group(2), m.group(3)
    elif m := re.match(r"^(.*?)_+(\d+)(?:_+(\d*))?$", stem):  # 'অলুয়া_60_1'
        stem, jl, sheet = m.group(1), m.group(2), m.group(3) or None
    mouza = re.sub(r"\s+", " ", stem.replace("_", " ")).strip(" -.")
    return {"jl_no": jl.zfill(3) if jl else None, "survey": survey, "mouza": mouza, "sheet_no": sheet.zfill(3) if sheet else None}


def walk(path: str, trail: list[str], cache: Path, delay: float, out: list[dict]) -> None:
    for f in listing(path, cache, delay):
        if f["mimeType"] == FOLDER:
            walk(f"{path}{f['name']}/", [*trail, f["name"]], cache, delay, out)
        elif f["name"].lower().endswith(".pdf"):
            p = parse_name(f["name"])
            out.append({
                "district": trail[0] if trail else None,
                "upazila_folder": trail[1] if len(trail) > 1 else None,
                "path": path.removeprefix("/") + f["name"],
                **p,
                "survey": p["survey"] or survey_from_trail(trail),
                "size": int(f["size"]) if f.get("size") else None,
            })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", action="append", help="drive to index, e.g. 0:/ (Dhaka) or 4:/ (Barishal); repeatable")
    ap.add_argument("--delay", type=float, default=0.5)
    ap.add_argument("--cache", type=Path, default=ROOT / "storage" / "mouzamap_cache")
    a = ap.parse_args()
    roots = [r if r.startswith("/") else "/" + r for r in (a.root or ["/0:/"])]
    dest = ROOT / "database" / "gis" / "mouzamap_index.json"
    kept: list[dict] = []
    if dest.exists():
        kept = [f for f in json.loads(dest.read_text(encoding="utf-8"))["files"] if not any(f["path"].startswith(r.removeprefix("/")) for r in roots)]
    out: list[dict] = []
    for root in roots:
        walk(root, [], a.cache, a.delay, out)
    out = [*kept, *out]
    data = {
        "source": "free.mouzamap.tech (third party, unofficial scanned mouza maps)",
        "source_url": BASE,
        "retrieved": time.strftime("%Y-%m-%d"),
        "note": "Listing only; PDFs are linked (source_url + '/' + path, percent-encoded), never copied. JL no, sheet and survey type are parsed from file and folder names and may be wrong.",
        "files": out,
    }
    dest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {dest} ({len(out)} PDFs)")


if __name__ == "__main__":
    main()
