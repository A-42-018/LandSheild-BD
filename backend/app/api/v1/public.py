from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.auth import get_settings_dep
from app.core.config import Settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import check_rate
from app.schemas.feedback import (
    FeedbackIn,
    FeedbackReceipt,
    PageRatingIn,
    PublicFeedbackStatus,
)
from app.schemas.map import PublicMapCollection
from app.schemas.public import (
    DocumentVerifyBody,
    DocumentVerifyOut,
    PublicKey,
    PublicLandSummary,
    PublicMutationStatus,
    PublicSeal,
    PublicSignature,
    PublicVerify,
)
from app.services import audit, doc_verify, signing
from app.services import feedback as feedback_svc
from app.services import map as map_svc
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


@router.get("/map", response_model=PublicMapCollection)
def public_map(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicMapCollection:
    """U2.3: parcel outlines + numbers for the no-login map. No owners, risk or area."""
    ip = request.client.host if request.client else "unknown"
    check_rate("public-map", ip, settings.public_map_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"
    return map_svc.get_public_map(db)


@router.get("/lands/search", response_model=PublicLandSummary)
def public_land_search(
    request: Request,
    response: Response,
    district: str = Query(min_length=1, max_length=100),
    upazila: str = Query(min_length=1, max_length=100),
    mouza: str = Query(min_length=1, max_length=100),
    khatian: str = Query(min_length=1, max_length=50),
    dag: str = Query(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicLandSummary:
    """U2.1: no-login search with a masked summary. Rate-limited per IP; each hit is audited."""
    _guard(request, response, settings)
    ip = request.client.host if request.client else None
    land, summary = svc.search_land_summary(
        db, district=district, upazila=upazila, mouza=mouza, khatian=khatian, dag=dag
    )
    audit.log(db, None, "PUBLIC_LAND_SEARCH", "land", land.id, ip=ip)
    db.commit()
    return summary


@router.get("/mutation-status/{mutation_no}", response_model=PublicMutationStatus)
def public_mutation_status(
    mutation_no: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicMutationStatus:
    _guard(request, response, settings)
    return svc.get_mutation_status(db, mutation_no)


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


@router.post("/feedback", response_model=FeedbackReceipt, status_code=201)
def submit_feedback(
    body: FeedbackIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> FeedbackReceipt:
    ip = request.client.host if request.client else "unknown"
    check_rate("feedback", ip, settings.feedback_rate_limit_per_min)
    response.headers["Cache-Control"] = "no-store"
    row = feedback_svc.create(db, body)
    audit.log(db, None, "FEEDBACK_SUBMIT", "feedback", row.id, new={"kind": row.kind}, ip=ip)
    db.commit()
    return FeedbackReceipt(
        reference_no=row.reference_no, status=row.status, created_at=row.created_at
    )


@router.post("/page-rating", status_code=204)
def rate_page(
    body: PageRatingIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> None:
    ip = request.client.host if request.client else "unknown"
    check_rate("feedback", ip, settings.feedback_rate_limit_per_min)
    feedback_svc.rate_page(db, body)


@router.get("/feedback/{reference_no}", response_model=PublicFeedbackStatus)
def feedback_status(
    reference_no: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> PublicFeedbackStatus:
    _guard(request, response, settings)
    return feedback_svc.public_status(db, reference_no)
