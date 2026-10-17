from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import OFFICER_UP, REVIEW_UP, require_roles
from app.models.enums import MutationStatus
from app.models.land_parcel import LandParcel
from app.models.user import User
from app.schemas.mutation import (
    HearingCalendar,
    MutationAppealIn,
    MutationDetail,
    MutationHearingIn,
    MutationList,
    MutationRecommendIn,
    MutationTransitionIn,
)
from app.services import mutation as svc
from app.services.offices import area_filter, land_scope

router = APIRouter(prefix="/mutations", tags=["mutations"])


@router.get("", response_model=MutationList)
def list_mutations(
    status: MutationStatus | None = None,
    division: str | None = Query(default=None, max_length=100),
    district: str | None = Query(default=None, max_length=100),
    upazila: str | None = Query(default=None, max_length=100),
    office_id: str | None = Query(default=None, max_length=36),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> MutationList:
    return svc.list_mutations(
        db, status.value if status else None, limit, offset, land_scope(user),
        area_filter(LandParcel.office_id, division, district, upazila, office_id),
    )


@router.get("/hearings", response_model=HearingCalendar)
def hearings(
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    division: str | None = Query(default=None, max_length=100),
    district: str | None = Query(default=None, max_length=100),
    upazila: str | None = Query(default=None, max_length=100),
    office_id: str | None = Query(default=None, max_length=36),
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> HearingCalendar:
    return svc.hearing_calendar(
        db, month, land_scope(user),
        area_filter(LandParcel.office_id, division, district, upazila, office_id),
    )


@router.get("/{mutation_id}", response_model=MutationDetail)
def get_mutation(
    mutation_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    return svc.get_mutation(db, mutation_id, land_scope(user), user)


@router.post("/{mutation_id}/transition", response_model=MutationDetail)
def transition_mutation(
    mutation_id: str,
    body: MutationTransitionIn,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    svc.get_mutation(db, mutation_id, land_scope(user))  # 404 outside the officer's offices
    ip = request.client.host if request.client else None
    svc.transition(db, mutation_id, body.to.value, user, body.reason, ip, body.hearing_at)
    return svc.get_mutation(db, mutation_id, None, user)


@router.post("/{mutation_id}/hearing", response_model=MutationDetail)
def schedule_hearing(
    mutation_id: str,
    body: MutationHearingIn,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    svc.get_mutation(db, mutation_id, land_scope(user))
    ip = request.client.host if request.client else None
    svc.schedule_hearing(db, mutation_id, user, body.hearing_at, ip)
    return svc.get_mutation(db, mutation_id, None, user)


@router.post("/{mutation_id}/recommend", response_model=MutationDetail)
def recommend_mutation(
    mutation_id: str,
    body: MutationRecommendIn,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    svc.get_mutation(db, mutation_id, land_scope(user))
    ip = request.client.host if request.client else None
    svc.recommend(db, mutation_id, user, body.decision, body.note, ip)
    return svc.get_mutation(db, mutation_id, None, user)


@router.post("/{mutation_id}/appeal", response_model=MutationDetail)
def appeal_mutation(
    mutation_id: str,
    body: MutationAppealIn,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    svc.get_mutation(db, mutation_id, land_scope(user))
    ip = request.client.host if request.client else None
    svc.appeal(db, mutation_id, user, body.reason, ip)
    return svc.get_mutation(db, mutation_id, None, user)
