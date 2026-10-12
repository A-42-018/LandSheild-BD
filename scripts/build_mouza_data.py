# ruff: noqa: E501
"""Build the union-wise mouza list (name, JL no, survey sheets) used by the map menu.

Source (official, public): Ministry of Land, "Smart Bhumi Naksha" - https://map.land.gov.bd
  the same lookups its own Division > District > Upazila > Mouza > Sheet menu uses:
  POST /getAdminByCode  level=forThana|forUnion|forMauza   (names, BBS geo codes)
  POST /getGeomByCode   level=forUnion                     (union boundary)
  POST /getGeomByCode   level=forMauza                     (mouza plots: JL no, sheet no, survey)
The portal does not say which union a mouza is in, so each mouza is placed in the union
that holds most of its plots (point-in-polygon on the portal's own union boundaries).
Only upazilas the portal has digitised are available.

Second source (official, public): Directorate of Land Records and Survey (DLRS), Online Land
Record and Survey System - https://settlement.gov.bd (its khatian-search menu):
  POST /Khatian/getdistrictlistdivisionwise, GetSurveyListDistrictWise, GetThanaListBySurvey,
       GetMouzaListBySurvey (mouza name + 9-digit code whose last 3 digits are the JL no.),
       GetSheetListBySurvey (survey sheet numbers)
It lists the mouzas of surveys in progress (RS / BRS / BDS). It names no union and gives
Bangla names only, so those mouzas have union_id null and name == bn_name.

Usage:  python scripts/build_mouza_data.py [--division 40] [--dlrs-division 020000000] [--cache DIR] [--delay 0.3]
  --division       map.land.gov.bd division code(s), comma separated (40 = Khulna, the demo scope)
  --dlrs-division  settlement.gov.bd division code(s) (020000000 = Khulna); "" skips DLRS
  --cache          folder for raw responses; reruns read from it instead of the network
Output: database/gis/mouzas.json  (committed). Stdlib only.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import http.cookiejar
import json
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

BASE = "https://map.land.gov.bd"
ROOT = Path(__file__).resolve().parents[1]
GIS = ROOT / "database" / "gis"
_BN = re.compile(r"\(([^()]*)\)\s*$")
_RING = re.compile(r"\(([^()]+)\)")


class Portal:
    def __init__(self, cache: Path, delay: float) -> None:
        self.cache, self.delay, self.token = cache, delay, ""
        cache.mkdir(parents=True, exist_ok=True)
        jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        self.op.addheaders = [("User-Agent", "LandShield-BD data build (academic project)")]

    def _login(self) -> None:
        html = self.op.open(BASE + "/", timeout=60).read().decode()  # noqa: S310
        self.token = re.search(r'name="csrf-token" content="([^"]+)', html).group(1)  # type: ignore[union-attr]

    def post(self, path: str, **data: str) -> object:
        key = hashlib.sha1(json.dumps([path, data], sort_keys=True).encode()).hexdigest()
        hit = self.cache / f"{key}.json"
        if hit.exists():
            return json.loads(hit.read_text(encoding="utf-8"))
        if not self.token:
            self._login()
        req = urllib.request.Request(  # noqa: S310
            BASE + path,
            data=urllib.parse.urlencode({**data, "_token": self.token}).encode(),
            headers={"X-Requested-With": "XMLHttpRequest", "Referer": BASE + "/"},
        )
        for attempt in range(4):
            try:
                body = self.op.open(req, timeout=180).read()  # noqa: S310
                break
            except OSError:
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        time.sleep(self.delay)
        out = json.loads(body)
        hit.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        return out


def _split(label_en: str, label_bn: str) -> tuple[str, str]:
    """'Badhal' + 'Badhal (বাধাল)' -> ('Badhal', 'বাধাল')."""
    m = _BN.search(label_bn or "")
    return label_en.strip(), (m.group(1).strip() if m else (label_bn or "").strip())


def _rings(wkt: str) -> list[list[tuple[float, float]]]:
    return [
        [tuple(map(float, pt.split()[:2])) for pt in ring.split(",")]  # type: ignore[misc]
        for ring in _RING.findall(wkt or "")
    ]


def _inside(x: float, y: float, rings: list[list[tuple[float, float]]]) -> bool:
    """Even-odd rule over every ring: handles holes and multipolygons."""
    hit = False
    for ring in rings:
        j = len(ring) - 1
        for i, (xi, yi) in enumerate(ring):
            xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
            j = i
    return hit


def _point(wkt: str) -> tuple[float, float] | None:
    rings = _rings(wkt)
    if not rings or not rings[0]:
        return None
    ring = rings[0]
    return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def _app_upazilas() -> dict[tuple[str, str], str]:
    """(district, upazila) normalised English names -> this app's upazila id."""
    dists = {
        f["properties"]["id"]: _norm(f["properties"]["name"])
        for f in json.loads((GIS / "districts.geojson").read_text(encoding="utf-8"))["features"]
    }
    out = {}
    for f in json.loads((GIS / "upazilas.geojson").read_text(encoding="utf-8"))["features"]:
        p = f["properties"]
        out[(dists[p["district_id"]], _norm(p["name"]))] = p["id"]
    return out


def _match(index: dict[tuple[str, str], str], district: str, upazila: str) -> str | None:
    d = difflib.get_close_matches(_norm(district), {k[0] for k in index}, n=1, cutoff=0.75)
    if not d:
        return None
    names = [k[1] for k in index if k[0] == d[0]]
    u = difflib.get_close_matches(_norm(upazila), names, n=1, cutoff=0.7)
    return index[(d[0], u[0])] if u else None


def build(portal: Portal, divisions: list[str]) -> dict[str, object]:
    index = _app_upazilas()
    unions_out: list[dict[str, object]] = []
    mouzas_out: list[dict[str, object]] = []
    for div in divisions:
        for dist in portal.post("/getAdminByCode", level="forDist", division_code=div):  # type: ignore[union-attr]
            dcode = dist["code"]
            for upz in portal.post("/getAdminByCode", level="forThana", division_code=div, district_code=dcode):  # type: ignore[union-attr]
                tcode = upz["code"]
                upazila_id = _match(index, dist["name_en"], upz["name_en"])
                if upazila_id is None:
                    print(f"  ! no app upazila for {dist['name_en']} / {upz['name_en']}, skipped")
                    continue
                print(f"{dist['name_en']} / {upz['name_en']} -> upazila {upazila_id}")

                unions: dict[str, dict[str, object]] = {}
                shapes: dict[str, list[list[tuple[float, float]]]] = {}
                for u in portal.post("/getAdminByCode", level="forUnion", division_code=div, district_code=dcode, thana_code=tcode):  # type: ignore[union-attr]
                    if u["code"] in unions:  # the portal lists a few unions twice (spelling variants)
                        continue
                    en, bn = _split(u["name_en"], u["name_bn"])
                    unions[u["code"]] = {"id": u["code"], "upazila_id": upazila_id, "name": en, "bn_name": bn}
                    geo = portal.post("/getGeomByCode", level="forUnion", tableName="gis_boundary_union", unionVal=u["code"])
                    shapes[u["code"]] = _rings(geo.get("geom", "") if isinstance(geo, dict) else "")

                for m in portal.post("/getAdminByCode", level="forMauza", division_code=div, district_code=dcode, thana_code=tcode):  # type: ignore[union-attr]
                    jl_prefix, _, en = m["name_en"].partition("-")
                    _, _, bn = m["name_bn"].partition("-")
                    geo = portal.post(
                        "/getGeomByCode", level="forMauza", tableName=m["m_code"].lower(),
                        mauzaVal=m["code"], plotOrLanduse="plot",
                    )
                    plots = geo.get("plots", []) if isinstance(geo, dict) else []
                    jl = Counter(str(p["jl_no_en"]) for p in plots if p.get("jl_no_en")).most_common(1)
                    sheets: dict[tuple[str, str], int] = Counter()
                    pts = []
                    for p in plots:
                        survey = str(p.get("m_code", "")).rsplit("_", 1)[-1] if p.get("m_code") else ""
                        if p.get("sht_no_en"):
                            sheets[(str(p["sht_no_en"]), survey)] += 1
                        pt = _point(p.get("geom", ""))
                        if pt:
                            pts.append(pt)
                    for s in geo.get("sheets", []) if isinstance(geo, dict) else []:
                        if not any(k[0] == s["sht_no_en"] for k in sheets):
                            sheets[(str(s["sht_no_en"]), "")] += 0
                    votes = Counter(
                        code for x, y in pts for code, rings in shapes.items() if _inside(x, y, rings)
                    )
                    union_id = votes.most_common(1)[0][0] if votes else None
                    mouzas_out.append({
                        "id": m["code"],
                        "upazila_id": upazila_id,
                        "union_id": union_id,
                        "code": m["code"],
                        "name": en.strip() or m["name_en"],
                        "bn_name": bn.strip(),
                        "jl_no": jl[0][0] if jl else jl_prefix.strip(),
                        "lat": round(sum(p[1] for p in pts) / len(pts), 5) if pts else None,
                        "long": round(sum(p[0] for p in pts) / len(pts), 5) if pts else None,
                        "plot_count": len(plots),
                        "sheets": [
                            {"sheet_no": no, "survey": sv, "plots": n}
                            for (no, sv), n in sorted(sheets.items())
                        ],
                    })
                unions_out.extend(unions.values())
                placed = sum(1 for m in mouzas_out if m["upazila_id"] == upazila_id and m["union_id"])
                total = sum(1 for m in mouzas_out if m["upazila_id"] == upazila_id)
                print(f"  {len(unions)} unions, {total} mouzas ({placed} placed in a union)")
    return {
        "source": "Ministry of Land, Smart Bhumi Naksha (map.land.gov.bd)",
        "source_url": BASE,
        "retrieved": date.today().isoformat(),
        "note": "Built by scripts/build_mouza_data.py. Union of a mouza = union holding most of its plots. Served only for MOUZA_ENABLED_DIVISION_ID.",
        "unions": unions_out,
        "mouzas": mouzas_out,
    }


DLRS = "https://settlement.gov.bd"
DLRS_SURVEY = {"আর. এস.": "RS", "বিআরএস": "BRS"}  # anything starting বিডিএস is BDS
_BN_FOLD = str.maketrans("", "", " .")


class Dlrs(Portal):
    """settlement.gov.bd: same cached-POST client, antiforgery token from the khatian-search page."""

    def _login(self) -> None:
        html = self.op.open(DLRS + "/Khatian/Search", timeout=60).read().decode()  # noqa: S310
        self.token = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)', html).group(1)  # type: ignore[union-attr]

    def post(self, path: str, **data: str) -> object:  # type: ignore[override]
        key = hashlib.sha1(json.dumps(["dlrs", path, data], sort_keys=True).encode()).hexdigest()
        hit = self.cache / f"{key}.json"
        if hit.exists():
            return json.loads(hit.read_text(encoding="utf-8"))
        if not self.token:
            self._login()
        req = urllib.request.Request(  # noqa: S310
            DLRS + path,
            data=urllib.parse.urlencode({**data, "__RequestVerificationToken": self.token}).encode(),
            headers={"X-Requested-With": "XMLHttpRequest", "Referer": DLRS + "/Khatian/Search", "RequestVerificationToken": self.token},
        )
        for attempt in range(4):
            try:
                body = self.op.open(req, timeout=180).read()  # noqa: S310
                break
            except OSError:
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        time.sleep(self.delay)
        out = json.loads(body)
        if isinstance(out, str):  # GetSheetListBySurvey returns a JSON string
            out = json.loads(out)
        hit.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        return out


def _bn_key(s: str) -> str:
    return s.replace(" উপজেলা", "").translate(_BN_FOLD)


def _app_upazilas_bn() -> dict[tuple[str, str], str]:
    """(district bn name, upazila bn name) -> this app's upazila id."""
    dists = {
        f["properties"]["id"]: _bn_key(f["properties"]["bn_name"])
        for f in json.loads((GIS / "districts.geojson").read_text(encoding="utf-8"))["features"]
    }
    return {
        (dists[f["properties"]["district_id"]], _bn_key(f["properties"]["bn_name"])): f["properties"]["id"]
        for f in json.loads((GIS / "upazilas.geojson").read_text(encoding="utf-8"))["features"]
        if f["properties"].get("bn_name")
    }


def _match_bn(index: dict[tuple[str, str], str], district: str, upazila: str) -> str | None:
    district = {"যশোহর": "যশোর"}.get(district, district)
    d = _bn_key(district)
    names = [k[1] for k in index if k[0] == d]
    u = difflib.get_close_matches(_bn_key(upazila), names, n=1, cutoff=0.6)
    return index[(d, u[0])] if u else None


def build_dlrs(portal: Dlrs, divisions: list[str]) -> list[dict[str, object]]:
    index = _app_upazilas_bn()
    out: list[dict[str, object]] = []
    for div in divisions:
        for d in portal.post("/Khatian/getdistrictlistdivisionwise", divid=div):  # type: ignore[union-attr]
            for sv in portal.post("/Khatian/GetSurveyListDistrictWise", districtid=d["unitcod"], comcod=d["comcod"]):  # type: ignore[union-attr]
                survey = "BDS" if sv["rsname"].startswith("বিডিএস") else DLRS_SURVEY.get(sv["rsname"], sv["rsname"])
                for t in portal.post("/Khatian/GetThanaListBySurvey", compcode=d["comcod"], rsno1=sv["rsnum"], districtid=d["unitcod"]):  # type: ignore[union-attr]
                    upazila_id = _match_bn(index, d["unitnam"], t["upazila"])
                    if upazila_id is None:
                        print(f"  ! no app upazila for {d['unitnam']} / {t['upazila']}, skipped")
                        continue
                    rows = portal.post("/Khatian/GetMouzaListBySurvey", compcode=d["comcod"], rsno1=sv["rsnum"], thanaid=t["upzcod"])  # type: ignore[union-attr]
                    print(f"{d['unitnam']} / {t['upazila']} ({survey}) -> upazila {upazila_id}: {len(rows)} mouzas")  # type: ignore[arg-type]
                    for m in rows:  # type: ignore[union-attr]
                        sheets = portal.post("/Khatian/GetSheetListBySurvey", rsnum=sv["rsnum"], unitcod=m["unitcod"], comcod=d["comcod"])
                        nums = sorted({str(x["shetnum"]) for x in sheets.get("Table1", [])})  # type: ignore[union-attr]
                        out.append({
                            "id": m["unitcod"],
                            "upazila_id": upazila_id,
                            "union_id": None,
                            "code": m["unitcod"],
                            "name": m["unitnam"].strip(),
                            "bn_name": m["unitnam"].strip(),
                            "jl_no": m["unitcod"][-3:],
                            "lat": None,
                            "long": None,
                            "plot_count": None,
                            "sheets": [{"sheet_no": n, "survey": survey, "plots": 0} for n in nums],
                            "source_url": DLRS,
                        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--division", default="40")
    ap.add_argument("--dlrs-division", default="020000000")
    ap.add_argument("--cache", type=Path, default=ROOT / "storage" / "mouza_cache")
    ap.add_argument("--delay", type=float, default=0.3)
    a = ap.parse_args()
    data = build(Portal(a.cache, a.delay), [d.strip() for d in a.division.split(",") if d.strip()])
    dlrs = [d.strip() for d in a.dlrs_division.split(",") if d.strip()]
    if dlrs:
        have = {str(m["id"]) for m in data["mouzas"]}  # type: ignore[union-attr]
        extra = [m for m in build_dlrs(Dlrs(a.cache, a.delay), dlrs) if m["id"] not in have]
        data["mouzas"] = [*data["mouzas"], *extra]  # type: ignore[misc]
        data["sources"] = [  # type: ignore[assignment]
            {"name": "Ministry of Land, Smart Bhumi Naksha", "url": BASE},
            {"name": "Directorate of Land Records and Survey (DLRS), Online Land Record and Survey System", "url": DLRS},
        ]
        data["note"] = str(data["note"]) + " DLRS mouzas (surveys in progress) have no union and Bangla names only."
    out = GIS / "mouzas.json"
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out} ({len(data['unions'])} unions, {len(data['mouzas'])} mouzas)")  # type: ignore[arg-type]


if __name__ == "__main__":
    main()
