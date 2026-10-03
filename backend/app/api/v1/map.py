from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rbac import ANY_AUTH, require_roles
from app.models.user import User
from app.schemas.map import MapCollection
from app.services import map as svc

# Registered BEFORE lands.router so "/lands/map" is not captured by "/lands/{land_id}".
router = APIRouter(prefix="/lands", tags=["lands"])


@router.get("/map", response_model=MapCollection)
def land_map(
    _user: User = Depends(require_roles(*ANY_AUTH)),
    db: Session = Depends(get_db),
) -> MapCollection:
    return svc.get_map(db)
