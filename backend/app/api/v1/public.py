from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.auth import get_settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import check_rate
from app.schemas.public import (
    DocumentVerifyBody,
    DocumentVerifyOut,
    PublicKey,
    PublicSeal,
    PublicSignature,
    PublicVerify,
)
from app.services import doc_verify, signing
from app.services import public as svc
from app.services.upload_validation import MAX_UPLOAD_BYTES

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


def _guard(request: Request, response: Response, settings: Settings) -> None:
    ip = request.client.host if request.client else "unknown"
    check_rate("public", ip, settings.public_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"


@router.get("/keys", response_model=PublicKey)
def public_keys(
    request: Request, response: Response, settings: Settings = Depends(get_settings_dep)
) -> PublicKey:
    _guard(request, response, settings)
    return PublicKey(**signing.key_info(settings))


@router.get("/seal/{land_id}", response_model=PublicSeal)
def public_seal(
    land_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicSeal:
    _guard(request, response, settings)
    land = svc.find_land(db, land_id)
    found = signing.latest_seal(db, land.id)
    if found is None:
        raise AppError("SEAL_NOT_FOUND", "No signed record for this parcel", 404)
    return PublicSeal(deed_id=found[0], hash12=found[1])


@router.get("/signature", response_model=PublicSignature)
def public_signature(
    request: Request,
    response: Response,
    d: str = Query(max_length=64),
    h: str = Query(max_length=64),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicSignature:
    _guard(request, response, settings)
    return PublicSignature(state=signing.check_deed(db, d, h, settings))


@router.post("/verify-document", response_model=DocumentVerifyOut)
async def verify_document_file(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> DocumentVerifyOut:
    """Upload is validated, compared and discarded (never stored). Stricter limit than reads."""
    ip = request.client.host if request.client else "unknown"
    check_rate("verify-doc", ip, settings.verify_doc_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    return doc_verify.verify_file(db, settings, file.filename, data)


@router.post("/verify-document/fields", response_model=DocumentVerifyOut)
def verify_document_fields(
    body: DocumentVerifyBody,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> DocumentVerifyOut:
    ip = request.client.host if request.client else "unknown"
    check_rate("verify-doc", ip, settings.verify_doc_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"
    return doc_verify.compare(db, body.deed_no, body.fields)
