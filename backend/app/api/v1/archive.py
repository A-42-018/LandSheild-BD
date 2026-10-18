from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import REVIEW_UP, require_roles
from app.models.document import Document
from app.models.user import User
from app.schemas.archive import ArchiveSearchOut
from app.services import archive as svc
from app.services import offices as office_svc

router = APIRouter(prefix="/archive", tags=["archive"])


@router.get("/search", response_model=ArchiveSearchOut)
def search_archive(
    q: str = Query(min_length=1, max_length=200),
    survey: str | None = Query(default=None, max_length=2),
    district: str | None = Query(default=None, max_length=100),
    year_from: int | None = Query(default=None, ge=1000, le=2200),
    year_to: int | None = Query(default=None, ge=1000, le=2200),
    office_division: str | None = Query(default=None, max_length=100),
    office_district: str | None = Query(default=None, max_length=100),
    office_upazila: str | None = Query(default=None, max_length=100),
    office_id: str | None = Query(default=None, max_length=36),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ArchiveSearchOut:
    conds = [
        c for c in (
            office_svc.doc_scope(user),
            office_svc.area_filter(
                Document.office_id, office_division, office_district, office_upazila, office_id
            ),
        ) if c is not None
    ]
    return svc.search(
        db, q, survey, district, limit, offset, and_(*conds) if conds else None,
        year_from, year_to,
    )
