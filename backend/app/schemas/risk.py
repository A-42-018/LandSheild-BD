from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import AlertStatus


def public_params(params: dict[str, Any]) -> dict[str, Any]:
    """Drop internal-id params (`*_id`, `*_ids`) so no database ids leave the API."""
    return {k: v for k, v in params.items() if not (k.endswith("_id") or k.endswith("_ids"))}


class EvidenceOut(BaseModel):
    code: str
    severity: str
    params: dict[str, Any] = Field(default_factory=dict)


class LandRisk(BaseModel):
    land_id: str
    overall_score: int
    risk_level: str
    rule_score: int
    ml_score: float | None = None  # raw 0..1 anomaly hint; None when ML was skipped
    evidence: list[EvidenceOut]
    assessed_at: datetime


class RiskAlertOut(BaseModel):
    id: str
    land_id: str
    alert_type: str
    severity: str
    risk_score: int
    evidence: list[EvidenceOut]
    status: str
    created_at: datetime


class RiskAlertList(BaseModel):
    items: list[RiskAlertOut]
    total: int
    limit: int
    offset: int


class RiskAlertPatch(BaseModel):
    status: AlertStatus
    reason: str | None = Field(default=None, max_length=500)  # required to dismiss
