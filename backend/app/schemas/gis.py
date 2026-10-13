from typing import Any, Literal

from pydantic import BaseModel


class GisFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class GisCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GisFeature]


class GisCapabilities(BaseModel):
    mouza_enabled: bool
    mouza_enabled_division_id: str | None
    mouza_enabled_division_name: str | None
    counts: dict[str, int]
    mouza_count: int
    union_count: int = 0
    mouza_source: str | None = None
    mouza_source_url: str | None = None
    mouza_sources: list[dict[str, str]] = []
    disclaimer_code: str = "DEMO_DATASET"


class UnionOut(BaseModel):
    id: str
    name: str
    bn_name: str
    mouza_count: int = 0


class UnionList(BaseModel):
    enabled: bool
    upazila_id: str
    unions: list[UnionOut]


class SheetRef(BaseModel):
    sheet_no: str
    survey: str = ""  # e.g. RS, BS, CS (survey the sheet belongs to)
    plots: int = 0
    url: str | None = None  # scanned map PDF on a third-party site (mouzamap.tech); linked, never copied


class MouzaOut(BaseModel):
    id: str
    code: str
    name: str
    bn_name: str
    union_id: str | None = None
    jl_no: str | None = None
    lat: float | None = None
    long: float | None = None
    plot_count: int | None = None
    source_url: str | None = None
    sheets: list[SheetRef] = []


class MouzaList(BaseModel):
    enabled: bool
    upazila_id: str
    union_id: str | None = None
    mouzas: list[MouzaOut]


class SearchHit(BaseModel):
    level: Literal["division", "district", "upazila", "union", "mouza"]
    id: str
    name: str
    bn_name: str
    path: str
    bbox: list[float] | None = None
    division_id: str | None = None
    district_id: str | None = None
    upazila_id: str | None = None
    union_id: str | None = None
    jl_no: str | None = None


class SearchResult(BaseModel):
    hits: list[SearchHit]
    out_of_scope_hint: bool = False
