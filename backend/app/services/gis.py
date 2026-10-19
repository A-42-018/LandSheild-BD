# ruff: noqa: E501
"""National admin-boundary data for the map (P61-P65). Read-only, file-backed, third-party/simplified.

Files live in database/gis (built by scripts/build_gis_data.py). Unions and mouzas are read from
database/gis/mouzas.json (synthetic demo data, SJ2) and are served ONLY for the divisions in
MOUZA_ENABLED_DIVISION_ID (empty = both lists are empty).
"""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.gis import (
    GisCapabilities,
    GisCollection,
    GisFeature,
    MouzaList,
    MouzaOut,
    MouzaResolved,
    SheetRef,
    SearchHit,
    SearchResult,
    UnionList,
    UnionOut,
)

_REPO = Path(__file__).resolve().parents[3]
_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def _dir() -> Path:
    custom = get_settings().gis_data_dir
    return Path(custom) if custom else _REPO / "database" / "gis"


@lru_cache(maxsize=8)
def _read(name: str, base: str) -> Any:
    path = Path(base) / name
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _features(level: str) -> list[dict[str, Any]]:
    data = _read(f"{level}.geojson", str(_dir()))
    if data is None:
        raise AppError("GIS_DATA_MISSING", "Boundary data is not installed", 503)
    return data["features"]


def _mouza_file() -> dict[str, Any]:
    data = _read("mouzas.json", str(_dir()))
    return data if isinstance(data, dict) else {}


def _mouzas() -> list[dict[str, Any]]:
    return list(_mouza_file().get("mouzas", []))


def _unions() -> list[dict[str, Any]]:
    return list(_mouza_file().get("unions", []))


def _collection(feats: list[dict[str, Any]]) -> GisCollection:
    return GisCollection(features=[GisFeature(**f) for f in feats])


def divisions() -> GisCollection:
    return _collection(_features("divisions"))


def districts(division_id: str) -> GisCollection:
    if not any(f["properties"]["id"] == division_id for f in _features("divisions")):
        raise AppError("DIVISION_NOT_FOUND", "Division not found", 404)
    return _collection([f for f in _features("districts") if f["properties"]["division_id"] == division_id])


def upazilas(district_id: str) -> GisCollection:
    if not any(f["properties"]["id"] == district_id for f in _features("districts")):
        raise AppError("DISTRICT_NOT_FOUND", "District not found", 404)
    return _collection([f for f in _features("upazilas") if f["properties"]["district_id"] == district_id])


def _division_name(division_id: str) -> str | None:
    for f in _features("divisions"):
        if f["properties"]["id"] == division_id:
            return str(f["properties"]["name"])
    return None


def _enabled_divisions() -> dict[str, str]:
    """Division id -> name for each id in MOUZA_ENABLED_DIVISION_ID (comma separated) that exists."""
    ids = [d.strip() for d in get_settings().mouza_enabled_division_id.split(",") if d.strip()]
    return {d: n for d in ids if (n := _division_name(d))}


def capabilities() -> GisCapabilities:
    divs = _enabled_divisions()
    name = ", ".join(divs.values()) or None
    enabled = bool(divs)
    return GisCapabilities(
        mouza_enabled=enabled,
        mouza_enabled_division_id=",".join(divs) if enabled else None,
        mouza_enabled_division_name=name,
        counts={
            "divisions": len(_features("divisions")),
            "districts": len(_features("districts")),
            "upazilas": len(_features("upazilas")),
        },
        mouza_count=len(_mouzas()) if enabled else 0,
        union_count=len(_unions()) if enabled else 0,
        mouza_source=_mouza_file().get("source") if enabled else None,
        mouza_source_url=_mouza_file().get("source_url") if enabled else None,
        mouza_sources=list(_mouza_file().get("sources", [])) if enabled else [],
    )


def _in_scope(upazila_id: str) -> bool:
    """404 for an unknown upazila; False when it lies outside the mouza demo division."""
    upa = next((f for f in _features("upazilas") if f["properties"]["id"] == upazila_id), None)
    if upa is None:
        raise AppError("UPAZILA_NOT_FOUND", "Upazila not found", 404)
    return upa["properties"]["division_id"] in _enabled_divisions()


def _jl_key(m: dict[str, Any]) -> tuple[int, str]:
    jl = str(m.get("jl_no") or "")
    return (int(jl) if jl.isdigit() else 1_000_000, str(m.get("name", "")))


def unions(upazila_id: str) -> UnionList:
    if not _in_scope(upazila_id):
        return UnionList(enabled=False, upazila_id=upazila_id, unions=[])
    counts: dict[str, int] = {}
    for m in _mouzas():
        if str(m.get("upazila_id")) == upazila_id and m.get("union_id"):
            counts[str(m["union_id"])] = counts.get(str(m["union_id"]), 0) + 1
    rows = [u for u in _unions() if str(u.get("upazila_id")) == upazila_id]
    return UnionList(
        enabled=True,
        upazila_id=upazila_id,
        unions=sorted(
            (
                UnionOut(id=str(u["id"]), name=u["name"], bn_name=u.get("bn_name", ""), mouza_count=counts.get(str(u["id"]), 0))
                for u in rows
                if counts.get(str(u["id"]))  # pourashava wards / forest ranges with no digitised mouza are left out
            ),
            key=lambda u: u.name,
        ),
    )


def mouzas(upazila_id: str, union_id: str | None = None) -> MouzaList:
    if not _in_scope(upazila_id):
        return MouzaList(enabled=False, upazila_id=upazila_id, union_id=union_id, mouzas=[])
    rows = [
        m
        for m in _mouzas()
        if str(m.get("upazila_id")) == upazila_id and (not union_id or str(m.get("union_id")) == union_id)
    ]
    return MouzaList(
        enabled=True,
        upazila_id=upazila_id,
        union_id=union_id,
        mouzas=[MouzaOut(**{k: v for k, v in m.items() if k != "upazila_id"}) for m in sorted(rows, key=_jl_key)],
    )


def _fold(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).translate(_BN_DIGITS).casefold().split())


def search(q: str, limit: int = 20) -> SearchResult:
    needle = _fold(q)
    if len(needle) < 2:
        return SearchResult(hits=[])
    names = {
        "division": {f["properties"]["id"]: f["properties"]["name"] for f in _features("divisions")},
        "district": {f["properties"]["id"]: f["properties"]["name"] for f in _features("districts")},
    }
    hits: list[SearchHit] = []
    for level, key in (("division", "divisions"), ("district", "districts"), ("upazila", "upazilas")):
        for f in _features(key):
            p = f["properties"]
            if needle in _fold(p["name"]) or needle in _fold(p.get("bn_name", "")):
                parent = ""
                if level == "district":
                    parent = names["division"].get(p["division_id"], "")
                elif level == "upazila":
                    parent = f'{names["division"].get(p["division_id"], "")} / {names["district"].get(p["district_id"], "")}'
                hits.append(
                    SearchHit(
                        level=level,  # type: ignore[arg-type]
                        id=str(p["id"]),
                        name=p["name"],
                        bn_name=p.get("bn_name", ""),
                        path=parent.strip(" /"),
                        bbox=p.get("bbox"),
                        division_id=str(p["id"]) if level == "division" else p.get("division_id"),
                        district_id=str(p["id"]) if level == "district" else p.get("district_id"),
                    )
                )
    scoped = capabilities().mouza_enabled
    upas = {f["properties"]["id"]: f["properties"] for f in _features("upazilas")} if scoped else {}
    union_names = {str(u["id"]): u["name"] for u in _unions()} if scoped else {}

    def _place(upazila_id: str) -> dict[str, Any]:
        up = upas.get(upazila_id, {})
        return {
            "division_id": up.get("division_id"),
            "district_id": up.get("district_id"),
            "upazila_id": upazila_id,
            "path": f'{names["district"].get(up.get("district_id"), "")} / {up.get("name", "")}'.strip(" /"),
        }

    for u in _unions() if scoped else []:
        if needle in _fold(u.get("name", "")) or needle in _fold(u.get("bn_name", "")):
            hits.append(
                SearchHit(level="union", id=str(u["id"]), name=u["name"], bn_name=u.get("bn_name", ""), **_place(str(u["upazila_id"])))
            )
    for m in _mouzas() if scoped else []:
        jl = str(m.get("jl_no") or "")
        if needle in _fold(m.get("name", "")) or needle in _fold(m.get("bn_name", "")) or (needle.isdigit() and jl.lstrip("0") == needle.lstrip("0")):
            place = _place(str(m["upazila_id"]))
            union = union_names.get(str(m.get("union_id")), "")
            place["path"] = f'{place["path"]} / {union}'.strip(" /") if union else place["path"]
            hits.append(
                SearchHit(
                    level="mouza",
                    id=str(m["id"]),
                    name=m["name"],
                    bn_name=m.get("bn_name", ""),
                    union_id=m.get("union_id"),
                    jl_no=m.get("jl_no"),
                    **place,
                )
            )
    order = {"division": 0, "district": 1, "upazila": 2, "union": 3, "mouza": 4}
    hits.sort(key=lambda h: (order[h.level], not _fold(h.name).startswith(needle), h.name))
    return SearchResult(hits=hits[:limit], out_of_scope_hint=not any(h.level == "mouza" for h in hits))


def norm_jl(value: str | None) -> str:
    """JL as stored: Bangla digits converted, spaces trimmed, no leading zeros ('০৪৫' -> '45')."""
    raw = unicodedata.normalize("NFKC", str(value or "")).translate(_BN_DIGITS).strip()
    return raw.lstrip("0") or ("0" if raw else "")


def _name_key(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip().casefold()


def _place_ids(district: str, upazila: str) -> set[str]:
    """Upazila ids whose district and upazila names match (English or Bangla, case-insensitive)."""
    dkey, ukey = _name_key(district), _name_key(upazila)
    dist_ids = {
        str(f["properties"]["id"])
        for f in _features("districts")
        if dkey in (_name_key(f["properties"]["name"]), _name_key(f["properties"].get("bn_name", "")))
    }
    return {
        str(f["properties"]["id"])
        for f in _features("upazilas")
        if str(f["properties"]["district_id"]) in dist_ids
        and ukey in (_name_key(f["properties"]["name"]), _name_key(f["properties"].get("bn_name", "")))
    }


def _jl_options(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {"jl_no": str(m.get("jl_no") or ""), "mouza": str(m["name"]), "mouza_id": str(m["id"]), "union_id": str(m.get("union_id") or "")}
        for m in sorted(rows, key=_jl_key)
    ]


def resolve_mouza(district: str, upazila: str, mouza: str, jl_no: str | None = None) -> MouzaResolved:
    """The one mouza matching district/upazila/name (and JL when given).

    MOUZA_NOT_FOUND 404, MOUZA_AMBIGUOUS 409 (details.options lists the JLs), JL_MISMATCH 422.
    """
    ups = _place_ids(district, upazila)
    ukeys = {u for u in ups if _in_scope(u)}
    mkey = _name_key(mouza)
    rows = [
        m
        for m in _mouzas()
        if str(m.get("upazila_id")) in ukeys and mkey in (_name_key(str(m.get("name", ""))), _name_key(str(m.get("bn_name", ""))))
    ]
    if not rows:
        raise AppError("MOUZA_NOT_FOUND", "Mouza not found in this upazila", 404)
    jl = norm_jl(jl_no)
    if jl:
        hit = [m for m in rows if norm_jl(m.get("jl_no")) == jl]
        if not hit:
            raise AppError("JL_MISMATCH", "This JL number does not belong to that mouza", 422, details={"options": _jl_options(rows)})
        rows = hit
    if len(rows) > 1:
        raise AppError("MOUZA_AMBIGUOUS", "More than one mouza has this name; give the JL number", 409, details={"options": _jl_options(rows)})
    m = rows[0]
    return MouzaResolved(
        id=str(m["id"]),
        name=m["name"],
        bn_name=m.get("bn_name", ""),
        upazila_id=str(m["upazila_id"]),
        union_id=m.get("union_id"),
        jl_no=norm_jl(m.get("jl_no")) or None,
        sheets=[SheetRef(**s) for s in m.get("sheets", [])],
    )


def sheets_for(mouza_id: str, survey: str | None = None) -> list[SheetRef]:
    """Map sheets of a mouza, optionally only those of one survey (CS/SA/RS/BS)."""
    m = next((x for x in _mouzas() if str(x.get("id")) == str(mouza_id)), None)
    if m is None:
        raise AppError("MOUZA_NOT_FOUND", "Mouza not found", 404)
    want = (survey or "").strip().upper()
    return [SheetRef(**s) for s in m.get("sheets", []) if not want or str(s.get("survey", "")).upper() == want]
