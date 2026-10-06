from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import OFFICER_UP, REVIEW_UP, require_roles
from app.models.enums import MutationStatus
from app.models.user import User
from app.schemas.mutation import MutationDetail, MutationList, MutationTransitionIn
from app.services import mutation as svc

router = APIRouter(prefix="/mutations", tags=["mutations"])


@router.get("", response_model=MutationList)
def list_mutations(
    status: MutationStatus | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> MutationList:
    return svc.list_mutations(db, status.value if status else None, limit, offset)


@router.get("/{mutation_id}", response_model=MutationDetail)
def get_mutation(
    mutation_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    return svc.get_mutation(db, mutation_id)


@router.post("/{mutation_id}/transition", response_model=MutationDetail)
def transition_mutation(
    mutation_id: str,
    body: MutationTransitionIn,
    request: Request,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
) -> MutationDetail:
    ip = request.client.host if request.client else None
    svc.transition(db, mutation_id, body.to.value, user, body.reason, ip)
    return svc.get_mutation(db, mutation_id)
