from sqlalchemy import Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType


class RiskAssessment(IdMixin, CreatedMixin, Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        Index("ix_risk_assessments_land_id", "land_id"),
        Index("ix_risk_assessments_verification_id", "verification_id"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    verification_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("verification_requests.id"), nullable=True
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    # Language-neutral level code (LOW/MEDIUM/HIGH/CRITICAL thresholds defined in R3).
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    rule_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ml_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_json: Mapped[list | dict | None] = mapped_column(JSONType, nullable=True)

    land = relationship("LandParcel")
    verification = relationship("VerificationRequest")
