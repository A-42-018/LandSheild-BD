"""Verification requests + report JSON (P21). Citizens only see their own requests."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.document import Document
from app.models.enums import Role, VerificationStatus
from app.models.land_parcel import LandParcel
from app.models.risk import RiskAssessment
from app.models.user import User
from app.models.verification import VerificationRequest
from app.schemas.report import (
    DocumentConsistency,
    VerificationOut,
    VerificationReport,
)
from app.services import audit
from app.services import land as land_svc
from app.services import ownership as own_svc
from app.services import risk as risk_svc

DISCLAIMER_CODE = "DEMO_DECISION_SUPPORT"
# Evidence codes that speak to document / record consistency.
DOC_CONSISTENCY_CODES = {"DUPLICATE_DEED", "AREA_MISMATCH", "UNIT_MISMATCH"}
_REVIEW_UP = {Role.REVIEWER.value, Role.OFFICER.value, Role.ADMIN.value}


def _not_found() -> AppError:
    return AppError("VERIFICATION_NOT_FOUND", "Verification not found", 404)


def _out(req: VerificationRequest, lp_code: str) -> VerificationOut:
    return VerificationOut(
        id=req.id,
        land_id=lp_code,
        status=req.status,
        risk_score=req.risk_score,
        risk_level=req.result_summary,
        created_at=req.created_at,
        completed_at=req.completed_at,
    )


def create_verification(db: Session, land_id: str, user: User, ip: str | None) -> VerificationOut:
    land = own_svc._land(db, land_id)  # 404 LAND_NOT_FOUND before anything is written
    req = VerificationRequest(
        land_id=land.id, requested_by=user.id, status=VerificationStatus.PENDING.value
    )
    db.add(req)
    db.commit()
    req_id = req.id
    try:
        assessment = risk_svc.analyze_land(db, land.land_id, verification_id=req_id)
    except Exception as exc:
        db.rollback()
        failed = db.get(VerificationRequest, req_id)
        failed.status = VerificationStatus.FAILED.value
        failed.completed_at = datetime.now(UTC)
        db.commit()
        raise AppError("VERIFICATION_FAILED", "Verification could not be completed", 500) from exc
    req = db.get(VerificationRequest, req_id)
    req.status = VerificationStatus.COMPLETED.value
    req.risk_score = assessment.overall_score
    req.result_summary = assessment.risk_level  # language-neutral level code
    req.completed_at = datetime.now(UTC)
    audit.log(
        db,
        user,
        "VERIFICATION_CREATE",
        "verification_request",
        req.id,
        new={"land_id": land.land_id, "risk_level": assessment.risk_level},
        ip=ip,
    )
    db.commit()
    return _out(req, land.land_id)


def _load(db: Session, verification_id: str, user: User) -> tuple[VerificationRequest, LandParcel]:
    req = db.get(VerificationRequest, verification_id)
    if req is None:
        raise _not_found()
    # Citizens: own requests only; others' requests look non-existent (no id probing).
    if user.role not in _REVIEW_UP and req.requested_by != user.id:
        raise _not_found()
    land = db.get(LandParcel, req.land_id)
    return req, land


def get_verification(db: Session, verification_id: str, user: User) -> VerificationOut:
    req, land = _load(db, verification_id, user)
    return _out(req, land.land_id)


def _document_consistency(db: Session, land: LandParcel, evidence: list) -> DocumentConsistency:
    rows = db.execute(
        select(Document.processing_status, func.count())
        .where(Document.land_id == land.id)
        .group_by(Document.processing_status)
    ).all()
    by_status = {status: n for status, n in rows}
    indicators = [e for e in evidence if e.code in DOC_CONSISTENCY_CODES]
    return DocumentConsistency(
        status="INCONSISTENCIES_FOUND" if indicators else "NO_ISSUES",
        total_documents=sum(by_status.values()),
        by_status=by_status,
        indicators=indicators,
    )


def get_report(db: Session, verification_id: str, user: User) -> VerificationReport:
    req, land = _load(db, verification_id, user)
    if req.status != VerificationStatus.COMPLETED.value or req.completed_at is None:
        raise AppError("VERIFICATION_NOT_READY", "Verification report is not available", 409)
    assessment = db.scalars(
        select(RiskAssessment).where(RiskAssessment.verification_id == req.id)
    ).first()
    if assessment is None:
        raise AppError("VERIFICATION_NOT_READY", "Verification report is not available", 409)
    evidence = risk_svc._evidence_out(assessment.evidence_json)
    return VerificationReport(
        verification_id=req.id,
        land_id=land.land_id,
        verification_status=req.status,
        overall_status=land.status,
        risk_score=assessment.overall_score,
        risk_level=assessment.risk_level,
        land=land_svc._to_public(db, land, user),
        ownership=own_svc.get_ownership(db, land.land_id, user).entries,
        document_consistency=_document_consistency(db, land, evidence),
        transactions=own_svc.get_transactions(db, land.land_id, user).transactions,
        evidence=evidence,
        disclaimer_code=DISCLAIMER_CODE,
        verified_at=req.completed_at,
    )
