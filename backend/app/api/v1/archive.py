from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import REVIEW_UP, require_roles
from app.models.user import User
from app.schemas.archive import ArchiveSearchOut
from app.services import archive as svc

router = APIRouter(prefix="/archive", tags=["archive"])


@router.get("/search", response_model=ArchiveSearchOut)
def search_archive(
    q: str = Query(min_length=1, max_length=200),
    survey: str | None = Query(default=None, max_length=2),
    district: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ArchiveSearchOut:
    return svc.search(db, q, survey, district, limit, offset)
