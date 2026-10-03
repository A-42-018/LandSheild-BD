from typing import Any, Literal

from pydantic import BaseModel


class MapProps(BaseModel):
    """Public-safe popup data (R4): no owner names, ids, hashes or evidence."""

    land_id: str
    dag_no: str
    khatian_no: str
    area: float
    area_unit: str
    status: str
    risk_level: str


class MapFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: MapProps


class MapCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[MapFeature]
