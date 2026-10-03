from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db, get_sessionmaker
from app.core.ratelimit import check_rate
from app.core.rbac import OFFICER_UP, REVIEW_UP, require_roles
from app.models.user import User
from app.schemas.document import DocumentOut, DocumentUploadOut, RejectBody
from app.schemas.extraction import ExtractionOut, ExtractionPatch
from app.services import documents as svc
from app.services import extraction as extraction_svc
from app.services import processing
from app.services import review as review_svc
from app.services.providers import Providers, get_providers
from app.services.storage import LocalStorage, StorageService
from app.services.upload_validation import MAX_UPLOAD_BYTES
from app.workers.jobs import BackgroundTasksRunner

router = APIRouter(tags=["documents"])


def get_storage(request: Request) -> StorageService:
    return LocalStorage(request.app.state.settings.storage_path)


def get_session_factory() -> processing.SessionFactory:
    """Sessions for background jobs (the request session is closed by then). Tests override."""
    return get_sessionmaker()


def get_job_providers(request: Request) -> Providers:
    return get_providers(request.app.state.settings)


@router.post("/documents/upload", response_model=DocumentUploadOut, status_code=201)
async def upload_document(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    document_type: str = Form("DEED"),
    land_id: str | None = Form(None),
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> DocumentUploadOut:
    # R4: 20 uploads/hour/user. Counted before the body is read, so rejected files count too.
    limit = request.app.state.settings.upload_rate_limit_per_hour
    check_rate("upload", user.id, limit, window=3600.0)
    data = await file.read(MAX_UPLOAD_BYTES + 1)  # +1 so oversize is detectable, never buffered
    ip = request.client.host if request.client else None
    out = svc.upload_document(db, storage, user, file.filename, data, document_type, land_id, ip)
    if out.duplicate:
        response.status_code = 200
    return out


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    return svc.get_document(db, document_id)


@router.get("/documents/{document_id}/file")
def get_document_file(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> Response:
    data, media = svc.read_document_file(db, storage, document_id)
    return Response(
        content=data,
        media_type=media,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )


@router.post("/documents/{document_id}/process", response_model=DocumentOut, status_code=202)
def process_document(
    document_id: str,
    request: Request,
    background: BackgroundTasks,
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
    providers: Providers = Depends(get_job_providers),
    session_factory: processing.SessionFactory = Depends(get_session_factory),
) -> DocumentOut:
    ip = request.client.host if request.client else None
    out = processing.start_processing(db, user, document_id, ip)  # UPLOADED -> PROCESSING
    BackgroundTasksRunner(background).submit(
        processing.run_processing, session_factory, storage, providers, document_id
    )
    return out


@router.get("/documents/{document_id}/extraction", response_model=ExtractionOut)
def get_extraction(
    document_id: str,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ExtractionOut:
    threshold = request.app.state.settings.review_conf_threshold
    return extraction_svc.get_extraction(db, document_id, threshold)


@router.patch("/documents/{document_id}/extraction", response_model=ExtractionOut)
def patch_extraction(
    document_id: str,
    body: ExtractionPatch,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ExtractionOut:
    ip = request.client.host if request.client else None
    threshold = request.app.state.settings.review_conf_threshold
    return extraction_svc.patch_extraction(db, user, document_id, body, threshold, ip)


@router.post("/documents/{document_id}/approve", response_model=DocumentOut)
def approve_document(
    document_id: str,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    ip = request.client.host if request.client else None
    return review_svc.approve_document(db, user, document_id, ip)


@router.post("/documents/{document_id}/reject", response_model=DocumentOut)
def reject_document(
    document_id: str,
    body: RejectBody,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    ip = request.client.host if request.client else None
    return review_svc.reject_document(db, user, document_id, body.reason, ip)


@router.post("/documents/{document_id}/reprocess", response_model=DocumentOut, status_code=202)
def reprocess_document(
    document_id: str,
    request: Request,
    background: BackgroundTasks,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
    providers: Providers = Depends(get_job_providers),
    session_factory: processing.SessionFactory = Depends(get_session_factory),
) -> DocumentOut:
    ip = request.client.host if request.client else None
    out = review_svc.request_reprocess(db, user, document_id, ip)  # -> PROCESSING
    BackgroundTasksRunner(background).submit(
        processing.run_processing, session_factory, storage, providers, document_id
    )
    return out
