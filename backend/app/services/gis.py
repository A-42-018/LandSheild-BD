# ruff: noqa: E501
"""National admin-boundary data for the map (P61-P65). Read-only, file-backed, third-party/simplified.

Files live in database/gis (built by scripts/build_gis_data.py). Mouzas come from
database/gis/mouzas.json and are served ONLY for the configured demo division.
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
    SearchHit,
    SearchResult,
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


def _mouzas() -> list[dict[str, Any]]:
    data = _read("mouzas.json", str(_dir()))
    return list(data.get("mouzas", [])) if isinstance(data, dict) else []


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


def capabilities() -> GisCapabilities:
    div = get_settings().mouza_enabled_division_id.strip()
    name = _division_name(div) if div else None
    enabled = bool(name)
    return GisCapabilities(
        mouza_enabled=enabled,
        mouza_enabled_division_id=div if enabled else None,
        mouza_enabled_division_name=name,
        counts={
            "divisions": len(_features("divisions")),
            "districts": len(_features("districts")),
            "upazilas": len(_features("upazilas")),
        },
        mouza_count=len(_mouzas()) if enabled else 0,
    )


def mouzas(upazila_id: str) -> MouzaList:
    upa = next((f for f in _features("upazilas") if f["properties"]["id"] == upazila_id), None)
    if upa is None:
        raise AppError("UPAZILA_NOT_FOUND", "Upazila not found", 404)
    div = get_settings().mouza_enabled_division_id.strip()
    if not div or upa["properties"]["division_id"] != div:
        return MouzaList(enabled=False, upazila_id=upazila_id, mouzas=[])
    rows = [m for m in _mouzas() if str(m.get("upazila_id")) == upazila_id]
    return MouzaList(
        enabled=True,
        upazila_id=upazila_id,
        mouzas=[MouzaOut(**{k: v for k, v in m.items() if k != "upazila_id"}) for m in rows],
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
    for m in _mouzas() if scoped else []:
        if needle in _fold(m.get("name", "")) or needle in _fold(m.get("bn_name", "")):
            hits.append(
                SearchHit(level="mouza", id=str(m["id"]), name=m["name"], bn_name=m.get("bn_name", ""), path="")
            )
    order = {"division": 0, "district": 1, "upazila": 2, "mouza": 3}
    hits.sort(key=lambda h: (order[h.level], not _fold(h.name).startswith(needle), h.name))
    return SearchResult(hits=hits[:limit], out_of_scope_hint=not any(h.level == "mouza" for h in hits))
