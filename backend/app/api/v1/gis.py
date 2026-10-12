from fastapi import APIRouter, Depends, Query

from app.core.rbac import ANY_AUTH, require_roles
from app.models.user import User
from app.schemas.gis import GisCapabilities, GisCollection, MouzaList, SearchResult, UnionList
from app.services import gis as svc

router = APIRouter(prefix="/gis", tags=["gis"])


@router.get("/capabilities", response_model=GisCapabilities)
def capabilities(_user: User = Depends(require_roles(*ANY_AUTH))) -> GisCapabilities:
    return svc.capabilities()


@router.get("/divisions", response_model=GisCollection)
def divisions(_user: User = Depends(require_roles(*ANY_AUTH))) -> GisCollection:
    return svc.divisions()


@router.get("/districts", response_model=GisCollection)
def districts(
    division_id: str = Query(min_length=1, max_length=8),
    _user: User = Depends(require_roles(*ANY_AUTH)),
) -> GisCollection:
    return svc.districts(division_id)


@router.get("/upazilas", response_model=GisCollection)
def upazilas(
    district_id: str = Query(min_length=1, max_length=8),
    _user: User = Depends(require_roles(*ANY_AUTH)),
) -> GisCollection:
    return svc.upazilas(district_id)


@router.get("/unions", response_model=UnionList)
def unions(
    upazila_id: str = Query(min_length=1, max_length=8),
    _user: User = Depends(require_roles(*ANY_AUTH)),
) -> UnionList:
    return svc.unions(upazila_id)


@router.get("/mouzas", response_model=MouzaList)
def mouzas(
    upazila_id: str = Query(min_length=1, max_length=8),
    union_id: str | None = Query(default=None, min_length=1, max_length=12, pattern=r"^\d+$"),
    _user: User = Depends(require_roles(*ANY_AUTH)),
) -> MouzaList:
    return svc.mouzas(upazila_id, union_id)


@router.get("/search", response_model=SearchResult)
def search(
    q: str = Query(min_length=2, max_length=60),
    _user: User = Depends(require_roles(*ANY_AUTH)),
) -> SearchResult:
    return svc.search(q)
