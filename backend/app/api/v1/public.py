from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.auth import get_settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.core.ratelimit import check_rate
from app.schemas.public import PublicVerify
from app.services import public as svc

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/verify/{land_id}", response_model=PublicVerify)
def public_verify(
    land_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicVerify:
    ip = request.client.host if request.client else "unknown"
    check_rate("public", ip, settings.public_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"
    return svc.get_public_verify(db, land_id)
