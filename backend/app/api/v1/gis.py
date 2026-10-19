from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.v1.auth import get_settings_dep
from app.core.config import Settings
from app.core.ratelimit import check_rate
from app.schemas.gis import GisCapabilities, GisCollection, MouzaList, MouzaResolved, SearchResult, UnionList
from app.services import gis as svc


def _open_data(
    request: Request, response: Response, settings: Settings = Depends(get_settings_dep)
) -> None:
    """Boundaries are open data (geoBoundaries): readable without sign-in (U2.3), per-IP limited."""
    ip = request.client.host if request.client else "unknown"
    check_rate("public-map", ip, settings.public_map_rate_limit_per_min)
    response.headers["Cache-Control"] = "public, max-age=300"


router = APIRouter(prefix="/gis", tags=["gis"], dependencies=[Depends(_open_data)])


@router.get("/capabilities", response_model=GisCapabilities)
def capabilities() -> GisCapabilities:
    return svc.capabilities()


@router.get("/divisions", response_model=GisCollection)
def divisions() -> GisCollection:
    return svc.divisions()


@router.get("/districts", response_model=GisCollection)
def districts(division_id: str = Query(min_length=1, max_length=8)) -> GisCollection:
    return svc.districts(division_id)


@router.get("/upazilas", response_model=GisCollection)
def upazilas(district_id: str = Query(min_length=1, max_length=8)) -> GisCollection:
    return svc.upazilas(district_id)


@router.get("/unions", response_model=UnionList)
def unions(upazila_id: str = Query(min_length=1, max_length=8)) -> UnionList:
    return svc.unions(upazila_id)


@router.get("/mouzas", response_model=MouzaList)
def mouzas(
    upazila_id: str = Query(min_length=1, max_length=8),
    union_id: str | None = Query(default=None, min_length=1, max_length=12, pattern=r"^\d+$"),
) -> MouzaList:
    return svc.mouzas(upazila_id, union_id)


@router.get("/mouzas/resolve", response_model=MouzaResolved)
def resolve_mouza(
    district: str = Query(min_length=1, max_length=80),
    upazila: str = Query(min_length=1, max_length=80),
    mouza: str = Query(min_length=1, max_length=80),
    jl_no: str | None = Query(default=None, max_length=12),
) -> MouzaResolved:
    return svc.resolve_mouza(district, upazila, mouza, jl_no)


@router.get("/search", response_model=SearchResult)
def search(q: str = Query(min_length=2, max_length=60)) -> SearchResult:
    return svc.search(q)
