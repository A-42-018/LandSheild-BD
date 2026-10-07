"""Risk analysis + persistence (P19). Rules stay pure; this is the only writer."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.alert import FraudAlert
from app.models.enums import AlertStatus, Role
from app.models.land_parcel import LandParcel
from app.models.risk import RiskAssessment
from app.models.user import User
from app.risk.assess import assess
from app.risk.config import ALERT_MIN_POINTS
from app.risk.context import Evidence, load_land_context
from app.risk.scoring import RiskScore, points_for
from app.schemas.risk import (
    EvidenceOut,
    LandRisk,
    RiskAlertList,
    RiskAlertOut,
    public_params,
)
from app.services import audit

_DISMISS_HIGH = (Role.OFFICER.value, Role.ADMIN.value)  # may dismiss a HIGH alert


def _land_or_404(db: Session, land_id: str) -> LandParcel:
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
    if land is None:
        raise AppError("LAND_NOT_FOUND", "Land parcel not found", 404)
    return land


def _alert_tx_id(ev: Evidence) -> str | None:
    p = ev.params
    if isinstance(p.get("transaction_id"), str):
        return p["transaction_id"]
    ids = p.get("transaction_ids")
    return ids[-1] if isinstance(ids, list) and ids else None  # latest transaction involved


def _upsert_alerts(db: Session, land: LandParcel, result: RiskScore) -> None:
    for ev in result.evidence:
        if points_for(ev.code) < ALERT_MIN_POINTS:
            continue
        tx_id = _alert_tx_id(ev)
        stmt = select(FraudAlert).where(
            FraudAlert.land_id == land.id, FraudAlert.alert_type == ev.code
        )
        stmt = stmt.where(
            FraudAlert.transaction_id.is_(None)
            if tx_id is None
            else FraudAlert.transaction_id == tx_id
        )
        existing = db.scalars(stmt).first()
        if existing is None:
            db.add(
                FraudAlert(
                    land_id=land.id,
                    transaction_id=tx_id,
                    alert_type=ev.code,
                    severity=ev.severity,
                    risk_score=result.overall_score,
                    evidence=[ev.to_dict()],
                    status=AlertStatus.OPEN.value,
                )
            )
        elif existing.status == AlertStatus.OPEN.value:  # reviewer decisions are never overwritten
            existing.severity = ev.severity
            existing.risk_score = result.overall_score
            existing.evidence = [ev.to_dict()]


def analyze_land(
    db: Session, land_id: str, verification_id: str | None = None, *, commit: bool = True
) -> RiskAssessment:
    """Run rules, persist an assessment (reused if unchanged) and deduped alerts.

    Commits unless commit=False (P30 posting runs it inside its own transaction: flush only).
    """
    land = _land_or_404(db, land_id)
    result = assess(load_land_context(db, land))
    evidence = [e.to_dict() for e in result.evidence]

    latest = db.scalars(
        select(RiskAssessment)
        .where(RiskAssessment.land_id == land.id, RiskAssessment.verification_id.is_(None))
        .order_by(RiskAssessment.created_at.desc(), RiskAssessment.id)
    ).first()
    if (
        verification_id is None
        and latest is not None
        and latest.overall_score == result.overall_score
        and latest.risk_level == result.level
        and latest.ml_score == result.ml_score
        and latest.evidence_json == evidence
    ):
        assessment = latest
    else:
        assessment = RiskAssessment(
            land_id=land.id,
            verification_id=verification_id,
            overall_score=result.overall_score,
            risk_level=result.level,
            rule_score=result.rule_score,
            ml_score=result.ml_score,
            evidence_json=evidence,
        )
        db.add(assessment)
    _upsert_alerts(db, land, result)
    if commit:
        db.commit()
    else:
        db.flush()
    return assessment


def _evidence_out(items: list | dict | None) -> list[EvidenceOut]:
    return [
        EvidenceOut(
            code=e["code"],
            severity=e["severity"],
            params=public_params(e.get("params", {})),
        )
        for e in (items or [])
    ]


def get_land_risk(db: Session, land_id: str) -> LandRisk:
    assessment = analyze_land(db, land_id)
    return LandRisk(
        land_id=land_id,
        overall_score=assessment.overall_score,
        risk_level=assessment.risk_level,
        rule_score=assessment.rule_score,
        ml_score=assessment.ml_score,
        evidence=_evidence_out(assessment.evidence_json),
        assessed_at=assessment.created_at,
    )


def _alert_out(a: FraudAlert, lp_code: str) -> RiskAlertOut:
    return RiskAlertOut(
        id=a.id,
        land_id=lp_code,
        alert_type=a.alert_type,
        severity=a.severity,
        risk_score=a.risk_score,
        evidence=_evidence_out(a.evidence),
        status=a.status,
        created_at=a.created_at,
    )


def list_alerts(
    db: Session,
    status: str | None,
    severity: str | None,
    land_id: str | None,
    limit: int,
    offset: int,
) -> RiskAlertList:
    cond = []
    if status:
        cond.append(FraudAlert.status == status)
    if severity:
        cond.append(FraudAlert.severity == severity)
    if land_id:
        cond.append(LandParcel.land_id == land_id)
    base = select(FraudAlert, LandParcel.land_id).join(
        LandParcel, LandParcel.id == FraudAlert.land_id
    )
    total = db.scalar(
        select(func.count())
        .select_from(FraudAlert)
        .join(LandParcel, LandParcel.id == FraudAlert.land_id)
        .where(*cond)
    )
    rows = db.execute(
        base.where(*cond)
        .order_by(FraudAlert.created_at.desc(), FraudAlert.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return RiskAlertList(
        items=[_alert_out(a, code) for a, code in rows],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


def update_alert(
    db: Session, alert_id: str, new_status: AlertStatus, actor: User, ip: str | None,
    reason: str | None = None,
) -> RiskAlertOut:  # fmt: skip
    alert = db.get(FraudAlert, alert_id)
    if alert is None:
        raise AppError("ALERT_NOT_FOUND", "Risk alert not found", 404)
    reason = " ".join(reason.split()) if reason else None
    if new_status == AlertStatus.DISMISSED:
        # a dismissed alert leaves the public QR count and stops gating mutations
        if alert.severity == "HIGH" and actor.role not in _DISMISS_HIGH:
            raise AppError(
                "ALERT_DISMISS_FORBIDDEN", "Only an officer can dismiss a HIGH alert", 403
            )
        if not reason:
            raise AppError("REASON_REQUIRED", "A reason is required to dismiss an alert", 422)
    old = alert.status
    alert.status = new_status.value
    alert.reviewed_by = None if new_status == AlertStatus.OPEN else actor.id
    audit.log(
        db,
        actor,
        "RISK_ALERT_UPDATE",
        "fraud_alert",
        alert.id,
        old={"status": old},
        new={"status": alert.status, **({"reason": reason} if reason else {})},
        ip=ip,
    )
    db.commit()
    lp_code = db.scalar(select(LandParcel.land_id).where(LandParcel.id == alert.land_id))
    return _alert_out(alert, lp_code or "")
