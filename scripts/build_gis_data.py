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
                    "bn_name": bn.strip(),
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
