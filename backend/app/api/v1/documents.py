from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db, get_sessionmaker
from app.core.ratelimit import check_rate
from app.core.rbac import OFFICER_UP, REVIEW_UP, require_roles
from app.models.user import User
from app.schemas.document import (
    DocumentOut,
    DocumentUploadOut,
    PartyNidsPatch,
    RejectBody,
    ReprocessBody,
)
from app.schemas.extraction import ExtractionOut, ExtractionPatch
from app.schemas.record import RecordVersionList, RecordVersionOut
from app.services import documents as svc
from app.services import extraction as extraction_svc
from app.services import offices as office_svc
from app.services import party_nid as nid_svc
from app.services import processing
from app.services import records as records_svc
from app.services import review as review_svc
from app.services.providers import Providers, get_providers
from app.services.storage import StorageService, make_storage
from app.services.upload_validation import MAX_UPLOAD_BYTES
from app.workers.jobs import BackgroundTasksRunner

router = APIRouter(tags=["documents"])


def get_storage(request: Request) -> StorageService:
    """STORAGE_BACKEND=local (disk under STORAGE_PATH) | s3 (one client per app)."""
    state = request.app.state
    if getattr(state, "storage", None) is None:
        state.storage = make_storage(state.settings)
    return state.storage


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
    office_id: str | None = Form(None),
    # the landowner's NID + date of birth (YYYY-MM-DD); stored only as keyed hashes
    buyer_nid: str | None = Form(None, max_length=40),
    buyer_dob: str | None = Form(None, max_length=10),
    seller_nid: str | None = Form(None, max_length=40),
    seller_dob: str | None = Form(None, max_length=10),
    user: User = Depends(require_roles(*OFFICER_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> DocumentUploadOut:
    # R4: 20 uploads/hour/user. Counted before the body is read, so rejected files count too.
    limit = request.app.state.settings.upload_rate_limit_per_hour
    check_rate("upload", user.id, limit, window=3600.0)
    nids = nid_svc.from_upload(buyer_nid, buyer_dob, seller_nid, seller_dob)
    data = await file.read(MAX_UPLOAD_BYTES + 1)  # +1 so oversize is detectable, never buffered
    ip = request.client.host if request.client else None
    out = svc.upload_document(
        db, storage, user, file.filename, data, document_type, land_id, ip, office_id, nids
    )
    if out.duplicate:
        response.status_code = 200
    return out


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    office_svc.ensure_doc_access(db, user, document_id)
    return svc.get_document(db, document_id)


@router.get("/documents/{document_id}/file")
def get_document_file(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> Response:
    office_svc.ensure_doc_access(db, user, document_id)
    data, media, digest = svc.read_document_file(db, storage, document_id)
    return Response(
        content=data,
        media_type=media,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "X-File-SHA256": digest,  # the original's hash, checked on every read (H5)
        },
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
    office_svc.ensure_doc_access(db, user, document_id, write=True)
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
    office_svc.ensure_doc_access(db, user, document_id)
    threshold = request.app.state.settings.review_conf_threshold
    return extraction_svc.get_extraction(db, document_id, threshold, user)


@router.patch("/documents/{document_id}/extraction", response_model=ExtractionOut)
def patch_extraction(
    document_id: str,
    body: ExtractionPatch,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> ExtractionOut:
    office_svc.ensure_doc_access(db, user, document_id)
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
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    require_nid = request.app.state.settings.owner_nid_required
    return review_svc.approve_document(db, user, document_id, ip, require_nid)


@router.patch("/documents/{document_id}/party-nids", response_model=DocumentOut)
def set_party_nids(
    document_id: str,
    body: PartyNidsPatch,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    return nid_svc.set_party_nids(db, user, document_id, body, ip)


@router.post("/documents/{document_id}/reject", response_model=DocumentOut)
def reject_document(
    document_id: str,
    body: RejectBody,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> DocumentOut:
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    return review_svc.reject_document(db, user, document_id, body.reason, ip)


@router.post("/documents/{document_id}/reprocess", response_model=DocumentOut, status_code=202)
def reprocess_document(
    document_id: str,
    request: Request,
    background: BackgroundTasks,
    body: ReprocessBody | None = None,  # no body = detect the deed profile again
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
    providers: Providers = Depends(get_job_providers),
    session_factory: processing.SessionFactory = Depends(get_session_factory),
) -> DocumentOut:
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    profile = body.profile if body else None
    out = review_svc.request_reprocess(db, user, document_id, ip, profile)  # -> PROCESSING
    BackgroundTasksRunner(background).submit(
        processing.run_processing, session_factory, storage, providers, document_id,
        profile=profile,
    )
    return out


# ---- H5: digital record versions ---------------------------------------------------------------


@router.get("/documents/{document_id}/records", response_model=RecordVersionList)
def list_record_versions(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordVersionList:
    office_svc.ensure_doc_access(db, user, document_id)
    return records_svc.list_versions(db, document_id)


@router.get("/documents/{document_id}/records/{version}", response_model=RecordVersionOut)
def get_record_version(
    document_id: str,
    version: int,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordVersionOut:
    office_svc.ensure_doc_access(db, user, document_id)
    return records_svc.get_version(db, document_id, version)


@router.post("/documents/{document_id}/records", response_model=RecordVersionOut, status_code=201)
def start_record_correction(
    document_id: str,
    request: Request,
    response: Response,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordVersionOut:
    """Open a correction of an approved document's record (the open draft if there is one: 200)."""
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    out, created = records_svc.start_correction(db, user, document_id, ip)
    if not created:
        response.status_code = 200
    return out


@router.patch("/documents/{document_id}/records/{version}", response_model=RecordVersionOut)
def patch_record_correction(
    document_id: str,
    version: int,
    body: ExtractionPatch,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordVersionOut:
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    return records_svc.patch_correction(db, user, document_id, version, body, ip)


@router.post(
    "/documents/{document_id}/records/{version}/approve", response_model=RecordVersionOut
)
def approve_record_correction(
    document_id: str,
    version: int,
    request: Request,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordVersionOut:
    office_svc.ensure_doc_access(db, user, document_id)
    ip = request.client.host if request.client else None
    return records_svc.approve_correction(db, user, document_id, version, ip)
