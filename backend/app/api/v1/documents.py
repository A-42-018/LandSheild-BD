import json
from datetime import date
from typing import Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.db import get_db, get_sessionmaker
from app.core.ratelimit import check_rate
from app.core.rbac import OFFICER_UP, REVIEW_UP, require_roles
from app.models.enums import DocumentStatus
from app.models.user import User
from app.schemas.document import (
    DocumentOut,
    DocumentUploadOut,
    LibraryList,
    LibrarySort,
    LibraryTab,
    PartyNidsPatch,
    RejectBody,
    ReprocessBody,
)
from app.schemas.extraction import ExtractionOut, ExtractionPatch
from app.schemas.officer import SortOrder
from app.schemas.record import RecordHistory, RecordVersionList, RecordVersionOut
from app.services import audit, processing
from app.services import bundle as bundle_svc
from app.services import deed_pdf as deed_pdf_svc
from app.services import documents as svc
from app.services import extraction as extraction_svc
from app.services import library as library_svc
from app.services import offices as office_svc
from app.services import party_nid as nid_svc
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


@router.get("/documents", response_model=LibraryList)
def list_documents(
    tab: LibraryTab | None = None,
    mine: bool = False,
    status: DocumentStatus | None = None,
    type: Literal["DEED", "KHATIAN", "PORCHA", "MUTATION", "OTHER"] | None = None,
    profile: Literal["modern", "historical"] | None = None,
    division: str | None = Query(default=None, max_length=100),
    district: str | None = Query(default=None, max_length=100),
    upazila: str | None = Query(default=None, max_length=100),
    office_id: str | None = Query(default=None, max_length=36),
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = Query(default=None, max_length=100),
    sort: LibrarySort = LibrarySort.CREATED_AT,
    order: SortOrder = SortOrder.DESC,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> LibraryList:
    """The document library (H7a). Scoped like the review queue; uploaders always see their own."""
    return library_svc.list_documents(
        db, user, tab=tab, mine=mine, status=status, document_type=type, profile=profile,
        division=division, district=district, upazila=upazila, office_id=office_id,
        date_from=date_from, date_to=date_to, q=q, sort=sort, order=order,
        limit=limit, offset=offset,
    )  # fmt: skip


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


def _pdf_meta(db: Session, row, body: dict, site_url: str) -> dict:
    """What the PDF footer prints, from the H8b export envelope (+ the approver's display name).
    `verify_url` (H8d) is the QR target: the public page of this record version."""
    integ, rec = body["integrity"], body["record"]
    deed_no = records_svc.deed_number(body["record_schema"], rec)
    approver = db.get(User, integ["approved_by"]) if integ["approved_by"] else None
    return {
        "deed_no": deed_no or body["document"]["id"], "version": body["version"], "draft": body["draft"],
        "approved_at": integ["approved_at"], "approver": approver.name if approver else "",
        "record_hash": integ["record_hash"], "file_hash": body["document"]["file_hash"],
        "signature": integ["signature"], "key_id": integ["key_id"], "document_id": body["document"]["id"],
        "verify_url": None if body["draft"] else deed_pdf_svc.record_url(site_url, row.id),
    }  # fmt: skip


@router.get("/documents/{document_id}/download")
def download_document(
    document_id: str,
    request: Request,
    what: Literal["pdf", "json", "original", "bundle"] = Query(...),
    version: int | None = Query(None, ge=1),
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> Response:
    """H8b/H8c/H8d: the digital record as JSON, the digital deed PDF (QR to the public page), the
    original upload byte for byte, or a ZIP of all three + manifest.json. One version (default =
    newest approved, else newest). Scoped like viewing, rate-limited per user, audited."""
    office_svc.ensure_doc_access(db, user, document_id)
    settings = request.app.state.settings
    check_rate("download", user.id, settings.download_rate_limit_per_hour, window=3600.0)
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
    if what in ("pdf", "json", "bundle"):
        row, body = records_svc.export_json(db, document_id, version)
        shown = row.version
        draft = "-draft" if body["draft"] else ""
        if row.record_hash:
            headers["X-Record-SHA256"] = row.record_hash
    if what == "pdf":
        data = deed_pdf_svc.deed_pdf(
            row.record_schema, row.record_json, _pdf_meta(db, row, body, settings.public_site_url)
        )
        media = "application/pdf"
        name = f"landshield-deed-{document_id}-v{row.version}{draft}.pdf"
    elif what == "json":
        data = json.dumps(body, ensure_ascii=False, indent=2).encode()
        media = "application/json"
        name = f"landshield-record-{document_id}-v{row.version}{draft}.json"
    elif what == "bundle":
        meta = _pdf_meta(db, row, body, settings.public_site_url)
        original, _, digest = svc.read_document_file(db, storage, document_id)
        ext = svc.original_extension(db, document_id)
        files = [
            (f"original.{ext}", original),
            ("deed.pdf", deed_pdf_svc.deed_pdf(row.record_schema, row.record_json, meta)),
            ("record.json", json.dumps(body, ensure_ascii=False, indent=2).encode()),
        ]
        history = bundle_svc.version_summary(records_svc.list_versions(db, document_id).items)
        manifest = bundle_svc.build_manifest(body, files, history, meta["verify_url"])
        data = bundle_svc.build_zip(files, manifest)
        media = "application/zip"
        headers["X-File-SHA256"] = digest
        name = f"landshield-bundle-{document_id}-v{row.version}{draft}.zip"
    else:
        data, media, digest = svc.read_document_file(db, storage, document_id)
        shown = None
        ext = svc.original_extension(db, document_id)
        name = f"landshield-original-{document_id}.{ext}"
        headers["X-File-SHA256"] = digest
    headers["Content-Disposition"] = f'attachment; filename="{name}"'
    ip = request.client.host if request.client else None
    audit.log(
        db, user, "DOCUMENT_DOWNLOAD", "document", document_id,
        new={"what": what, "version": shown}, ip=ip,
    )  # fmt: skip
    db.commit()
    return Response(content=data, media_type=media, headers=headers)


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


@router.get("/documents/{document_id}/records/history", response_model=RecordHistory)
def get_record_history(
    document_id: str,
    user: User = Depends(require_roles(*REVIEW_UP)),
    db: Session = Depends(get_db),
) -> RecordHistory:
    """Who changed what and when, per record version (from the audit log). H7b."""
    office_svc.ensure_doc_access(db, user, document_id)
    return records_svc.history(db, document_id)


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
