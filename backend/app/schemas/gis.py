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
    disclaimer_code: str = "DEMO_DATASET"


class MouzaOut(BaseModel):
    id: str
    code: str
    name: str
    bn_name: str
    jl_no: str | None = None
    lat: float | None = None
    long: float | None = None
    sheets: list[dict[str, Any]] = []


class MouzaList(BaseModel):
    enabled: bool
    upazila_id: str
    mouzas: list[MouzaOut]


class SearchHit(BaseModel):
    level: Literal["division", "district", "upazila", "mouza"]
    id: str
    name: str
    bn_name: str
    path: str
    bbox: list[float] | None = None
    division_id: str | None = None
    district_id: str | None = None


class SearchResult(BaseModel):
    hits: list[SearchHit]
    out_of_scope_hint: bool = False
