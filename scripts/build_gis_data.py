"""Build the simplified Bangladesh admin-boundary files used by the national map (P61-P63).

Source (third-party, open, NOT official): github.com/ifahimreza/bangladesh-geojson
(upazila polygons derived from geoBoundaries gbOpen ADM3, CC BY 4.0; compiled data ODbL).
Divisions and districts are dissolved from the upazila polygons here.

Usage:  python scripts/build_gis_data.py [--src DIR]    (needs `pip install shapely`)
  --src DIR  folder holding bd-divisions.json, bd-districts.json, bd-upazilas.json,
             bangladesh.geojson; when missing the files are downloaded (network).
Output: database/gis/{divisions,districts,upazilas}.geojson  (committed, small).
"""

from __future__ import annotations

import argparse
import difflib
import json
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

BASE = "https://raw.githubusercontent.com/ifahimreza/bangladesh-geojson/master/src/data/"
FILES = ["bd-divisions.json", "bd-districts.json", "bd-upazilas.json", "bangladesh.geojson"]
OUT = Path(__file__).resolve().parents[1] / "database" / "gis"
TOL = {"upazila": 0.0015, "district": 0.003, "division": 0.006}
NDIGITS = 4


# The source tags polygons by name, so a few name clashes land in the wrong district (e.g. Gazipur's
# Sreepur carries Magura's Sreepur id, so Gazipur had no Sreepur), and the nearest-polygon fallback
# below put Dhaka's thanas under Kushtia/Magura/Narayanganj. Found by checking every polygon against
# its district centre; applied after the automatic matching.
# Keys: a source upazila id for a polygon the source tagged, "loose:<name>" for an untagged one.
# Values: ("src", source upazila id) = take id, district and Bangla name from that source upazila;
#         ("new", district name, id[, Bangla]) = a place the source has no upazila for
#         (a city thana, Singra).
FIXES: dict[str, tuple[str, ...]] = {
    "315": ("src", "162"),  # tagged Sreepur/Magura is Gazipur's Sreepur ...
    "loose:Sreepur": ("src", "315"),  # ... and the untagged one is Magura's
    "loose:Kaliakair": ("src", "160"),
    "309": ("new", "Dhaka", "g119"),  # tagged Mirpur/Kushtia is Dhaka's Mirpur thana ...
    "loose:Mirpur": ("src", "309"),  # ... the untagged one is Kushtia's
    "308": ("new", "Khulna", "g120"),  # tagged Daulatpur/Kushtia is Khulna's Daulatpur thana
    "loose:Daulatpur": ("src", "308"),
    "313": ("new", "Dhaka", "g121"),  # tagged Mohammadpur/Magura is Dhaka's thana
    "loose:Mohammadpur": ("src", "313"),
    "485": ("src", "129"),  # tagged Companiganj/Sylhet is Noakhali's ...
    "loose:Companiganj": ("src", "485"),
    "449": ("src", "446"),  # the two Pirganj polygons were swapped
    "446": ("src", "449"),
    "loose:Austagram": ("src", "178"),
    "loose:Gangni": ("src", "316"),
    "loose:Meherpur Sadar": ("src", "318"),
    "loose:Hajiganj": ("src", "63"),
    "loose:Kabirhat": ("src", "132"),
    "loose:Senbagh": ("src", "130"),
    "loose:Subarnachar": ("src", "134"),
    "loose:Hatiya": ("src", "131"),
    "loose:Manoharganj": ("src", "92"),
    "loose:Roypura": ("src", "230"),
    "loose:Lalmonirhat Sadar": ("src", "424"),
    "loose:Kanthalia": ("src", "25"),
    "loose:Narayanganj Sadar": ("src", "223"),
    # the nearest-polygon fallback put these in the neighbouring district
    "loose:Kawkhali (Betbunia)": ("src", "144"),  # Rangamati's Kawkhali, not Chattogram
    "loose:Singra": ("new", "Natore", "", "সিংড়া"),  # Natore's, not Sirajganj; no source upazila
}
# Bangla spellings the source gets wrong
BN_FIXES = {
    "Roypura": "রায়পুরা", "Senbagh": "সেনবাগ", "Subarnachar": "সুবর্ণচর",
    "Narayanganj Sadar": "নারায়ণগঞ্জ সদর",
}
for _n in (
    "Adabor Badda Cantonment Dhanmondi Gulshan Kafrul Kalabagan Khilgaon Khilkhet Pallabi Ramna "
    "Rampura Shahbagh Tejgaon Dakshinkhan Demra"
).split() + [
    "Darus Salam", "New Market", "Shah Ali", "Sher-e-bangla Nagar", "Tejgaon Ind. Area",
    "Uttar Khan",
]:
    FIXES[f"loose:{_n}"] = ("new", "Dhaka", "")  # id stays the polygon's own g-id


def _load(src: Path) -> dict[str, object]:
    src.mkdir(parents=True, exist_ok=True)
    out: dict[str, object] = {}
    for name in FILES:
        p = src / name
        if not p.exists():
            with urllib.request.urlopen(BASE + name, timeout=120) as r:  # noqa: S310
                p.write_bytes(r.read())
        out[name] = json.loads(p.read_text(encoding="utf-8"))
    return out


def _round(obj: object) -> object:
    if isinstance(obj, float):
        return round(obj, NDIGITS)
    if isinstance(obj, (list, tuple)):
        return [_round(x) for x in obj]
    return obj


def _feature(geom, props: dict) -> dict:
    g = mapping(geom)
    minx, miny, maxx, maxy = geom.bounds
    c = geom.representative_point()
    props = {
        **props,
        "bbox": [round(minx, 3), round(miny, 3), round(maxx, 3), round(maxy, 3)],
        "lat": round(c.y, 4),
        "long": round(c.x, 4),
    }
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": g["type"], "coordinates": _round(g["coordinates"])},
    }


def _write(name: str, feats: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "features": feats}
    path = OUT / name
    path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{name}: {len(feats)} features, {path.stat().st_size / 1024:.0f} KB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/tmp/gis")
    data = _load(Path(ap.parse_args().src))
    divs = {d["id"]: d for d in data["bd-divisions.json"]["divisions"]}  # type: ignore[index]
    dists = {d["id"]: d for d in data["bd-districts.json"]["districts"]}  # type: ignore[index]
    raw = data["bangladesh.geojson"]["features"]  # type: ignore[index]

    ups = {u["id"]: u for u in data["bd-upazilas.json"]["upazilas"]}  # type: ignore[index]
    matched = [f for f in raw if f["properties"]["upazila_id"] in ups]
    loose = [f for f in raw if f["properties"]["upazila_id"] not in ups]
    mgeo = [shape(f["geometry"]) for f in matched]
    tree = STRtree(mgeo)
    free = {k: u for k, u in ups.items() if k not in {f["properties"]["upazila_id"] for f in matched}}

    # Polygons whose id is missing in the source: district = nearest matched polygon,
    # names/ids inherited from a still-unused upazila of that district when the spelling is close.
    resolved: list[tuple[dict, str, str, str, str]] = []  # (feature, id, district, name, bn)
    for f in matched:
        p = f["properties"]
        resolved.append((f, p["upazila_id"], p["district_id"], p["name"], p["bn_name"]))
    cands: list[tuple[float, int, str]] = []
    loose_district: list[str] = []
    for i, f in enumerate(loose):
        near = matched[int(tree.nearest(shape(f["geometry"])))]["properties"]["district_id"]
        loose_district.append(near)
        for k, u in free.items():
            if u["district_id"] == near:
                r = difflib.SequenceMatcher(None, u["name"].lower(), f["properties"]["name"].lower())
                cands.append((r.ratio(), i, k))
    taken_f: set[int] = set()
    taken_u: set[str] = set()
    inherit: dict[int, str] = {}
    for ratio, i, k in sorted(cands, reverse=True):
        if ratio >= 0.8 and i not in taken_f and k not in taken_u:
            taken_f.add(i)
            taken_u.add(k)
            inherit[i] = k
    for i, f in enumerate(loose):
        name = f["properties"]["name"]
        if i in inherit:
            u = ups[inherit[i]]
            resolved.append((f, u["id"], u["district_id"], u["name"], u["bn_name"]))
        else:  # no Bangla name in the source: UI falls back to the English name
            resolved.append((f, f"g{i + 1}", loose_district[i], name, ""))

    by_dist_name = {d["name"]: k for k, d in dists.items()}
    for i, (f, uid, _did, name, _bn) in enumerate(resolved):
        p = f["properties"]
        tagged = p["upazila_id"] in ups
        fix = FIXES.get(p["upazila_id"] if tagged else f"loose:{name}")
        if fix is None:
            continue
        if fix[0] == "src":
            u = ups[fix[1]]
            # keep the polygon's own English spelling
            resolved[i] = (f, u["id"], u["district_id"], name, u["bn_name"])
        else:
            nid = fix[2] or uid
            resolved[i] = (f, nid, by_dist_name[fix[1]], name, fix[3] if len(fix) > 3 else "")

    dist_parts: dict[str, list] = {}
    upa_feats: list[dict] = []
    for f, uid, did, name, bn in resolved:
        g = shape(f["geometry"])
        if g.is_empty:
            raise SystemExit(f"empty geometry: {name}")
        dist_parts.setdefault(did, []).append(g)
        upa_feats.append(
            _feature(
                g.simplify(TOL["upazila"], preserve_topology=True),
                {
                    "id": uid,
                    "district_id": did,
                    "division_id": dists[did]["division_id"],
                    "name": name.strip(),
                    "bn_name": BN_FIXES.get(name.strip(), bn.strip()),
                },
            )
        )
    upa_feats.sort(key=lambda f: (f["properties"]["id"].startswith("g"), f["properties"]["id"].zfill(5)))
    print(f"upazila polygons: {len(upa_feats)} ({len(loose) - len(inherit)} without a Bangla name)")

    dist_feats: list[dict] = []
    div_parts: dict[str, list] = {}
    for did, parts in sorted(dist_parts.items(), key=lambda kv: int(kv[0])):
        d = dists[did]
        u = unary_union([p.buffer(0.0008) for p in parts]).buffer(-0.0008)
        div_parts.setdefault(d["division_id"], []).append(u)
        dist_feats.append(
            _feature(
                u.simplify(TOL["district"], preserve_topology=True),
                {"id": did, "division_id": d["division_id"], "name": d["name"], "bn_name": d["bn_name"]},
            )
        )
    div_feats = []
    for vid, parts in sorted(div_parts.items(), key=lambda kv: int(kv[0])):
        v = divs[vid]
        u = unary_union([p.buffer(0.0008) for p in parts]).buffer(-0.0008)
        div_feats.append(
            _feature(
                u.simplify(TOL["division"], preserve_topology=True),
                {"id": vid, "name": v["name"], "bn_name": v["bn_name"]},
            )
        )
    _write("divisions.geojson", div_feats)
    _write("districts.geojson", dist_feats)
    _write("upazilas.geojson", upa_feats)
    if (len(div_feats), len(dist_feats)) != (8, 64):
        raise SystemExit(f"expected 8 divisions / 64 districts, got {len(div_feats)}/{len(dist_feats)}")


if __name__ == "__main__":
    main()
