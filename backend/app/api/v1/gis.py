from collections.abc import Callable

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.core.ratelimit import check_rate
from app.core.rbac import ANY_AUTH, require_roles
from app.models.user import User
from app.schemas.gis import GisCapabilities, GisCollection, MouzaList, SearchResult, UnionList
from app.services import gis as svc
from app.services import scans

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


@router.get("/scan", response_class=StreamingResponse)
def scan(
    request: Request,
    url: str = Query(min_length=20, max_length=1100),
    user: User = Depends(require_roles(*ANY_AUTH)),
    make_client: Callable[[], httpx.Client] = Depends(scans.get_scan_client_factory),
) -> StreamingResponse:
    """Download a scanned mouza map, fetched from free.mouzamap.tech and passed through."""
    check_rate("scan", user.id, request.app.state.settings.scan_rate_limit_per_min)
    found = scans.open_scan(make_client, url)
    headers = {
        "Content-Disposition": scans.content_disposition(found.filename),
        "Cache-Control": "private, no-store",
    }
    if found.size is not None:
        headers["Content-Length"] = str(found.size)
    return StreamingResponse(found.chunks, media_type="application/pdf", headers=headers)
