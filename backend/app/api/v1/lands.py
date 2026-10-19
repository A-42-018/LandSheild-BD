from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ANY_AUTH, REVIEW_UP, require_roles
from app.models.enums import SurveyType
from app.models.user import User
from app.schemas.document import LandDocuments
from app.schemas.encumbrance import EncumbrancesResponse
from app.schemas.graph import LandGraph
from app.schemas.land import LandPublic
from app.schemas.mutation import MutationsResponse
from app.schemas.ownership import OwnershipResponse, TransactionsResponse
from app.schemas.pre_purchase import PrePurchaseCheck
from app.services import graph as graph_svc
from app.services import land as svc
from app.services import library as library_svc
from app.services import me as me_svc
from app.services import ownership as own_svc
from app.services import pre_purchase as pp_svc

router = APIRouter(prefix="/lands", tags=["lands"])


@router.get("/search", response_model=LandPublic)
def search_lands(
    district: str = Query(min_length=1, max_length=100),
    upazila: str = Query(min_length=1, max_length=100),
    mouza: str = Query(min_length=1, max_length=100),
    khatian: str = Query(min_length=1, max_length=50),
    dag: str = Query(min_length=1, max_length=50),
    survey: SurveyType | None = Query(default=None),  # SJ3: omitted = 409 if it is ambiguous
    jl_no: str | None = Query(default=None, max_length=20),
    sheet_no: str | None = Query(default=None, max_length=20),
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> LandPublic:
    land = svc.search_land(
        db,
        district=district,
        upazila=upazila,
        mouza=mouza,
        khatian=khatian,
        dag=dag,
        viewer=user,
        survey_type=survey.value if survey else None,
        jl_no=jl_no,
        sheet_no=sheet_no,
    )
    me_svc.record_lookup(db, user, land.land_id)  # U3.2 "my searches" (citizens only)
    return land


@router.get("/{land_id}", response_model=LandPublic)
def get_land(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> LandPublic:
    land = svc.get_land(db, land_id, user)
    me_svc.record_lookup(db, user, land.land_id)
    return land


@router.get("/{land_id}/ownership", response_model=OwnershipResponse)
def get_ownership(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> OwnershipResponse:
    return own_svc.get_ownership(db, land_id, user)


@router.get("/{land_id}/transactions", response_model=TransactionsResponse)
def get_transactions(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> TransactionsResponse:
    return own_svc.get_transactions(db, land_id, user)


@router.get("/{land_id}/documents", response_model=LandDocuments)
def get_land_documents(
    land_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> LandDocuments:
    """Every document of the land in deed-date order, each with its latest approved record (H7b)."""
    return library_svc.land_documents(db, user, land_id)


@router.get("/{land_id}/graph", response_model=LandGraph)
def get_graph(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> LandGraph:
    return graph_svc.get_graph(db, land_id, user)


@router.get("/{land_id}/encumbrances", response_model=EncumbrancesResponse)
def get_land_encumbrances(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
):
    return own_svc.get_encumbrances(db, land_id, user)


@router.get("/{land_id}/mutations", response_model=MutationsResponse)
def get_mutations(
    land_id: str,
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> MutationsResponse:
    return own_svc.get_mutations(db, land_id, user)


@router.get("/{land_id}/pre-purchase-check", response_model=PrePurchaseCheck)
def get_pre_purchase_check(
    land_id: str,
    seller: str | None = Query(default=None, max_length=120),
    user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> PrePurchaseCheck:
    return pp_svc.get_pre_purchase_check(db, land_id, seller)
