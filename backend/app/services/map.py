"""GeoJSON FeatureCollection of parcels for the map (P50). Read-only: never writes rows."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.land_parcel import LandParcel
from app.risk.assess import assess
from app.risk.context import load_land_context
from app.schemas.map import (
    MapCollection,
    MapFeature,
    MapProps,
    PublicMapCollection,
    PublicMapFeature,
    PublicMapProps,
)

_POLYGONS = {"Polygon", "MultiPolygon"}


def _usable(geometry: object) -> bool:
    """Only well-formed polygon geometry is served; anything else is skipped, not repaired."""
    return (
        isinstance(geometry, dict)
        and geometry.get("type") in _POLYGONS
        and isinstance(geometry.get("coordinates"), list)
        and len(geometry["coordinates"]) > 0
    )


def get_map(db: Session) -> MapCollection:
    lands = db.scalars(
        select(LandParcel).where(LandParcel.geometry.is_not(None)).order_by(LandParcel.land_id)
    ).all()
    features: list[MapFeature] = []
    for land in lands:
        if not _usable(land.geometry):
            continue
        level = assess(load_land_context(db, land)).level  # live, read-only (same as /public)
        features.append(
            MapFeature(
                geometry=land.geometry,
                properties=MapProps(
                    land_id=land.land_id,
                    dag_no=land.dag_no,
                    khatian_no=land.khatian_no,
                    area=land.area,
                    area_unit=land.area_unit,
                    status=land.status,
                    risk_level=level,
                ),
            )
        )
    return MapCollection(features=features)


def get_public_map(db: Session) -> PublicMapCollection:
    """Outlines + parcel numbers for visitors. Same polygons as `get_map`, but no risk assessment is
    run and nothing about owners, status or area leaves."""
    lands = db.scalars(
        select(LandParcel).where(LandParcel.geometry.is_not(None)).order_by(LandParcel.land_id)
    ).all()
    return PublicMapCollection(
        features=[
            PublicMapFeature(
                geometry=land.geometry,
                properties=PublicMapProps(
                    land_id=land.land_id,
                    dag_no=land.dag_no,
                    khatian_no=land.khatian_no,
                    district=land.district,
                    upazila=land.upazila,
                    mouza=land.mouza,
                ),
            )
            for land in lands
            if _usable(land.geometry)
        ]
    )
