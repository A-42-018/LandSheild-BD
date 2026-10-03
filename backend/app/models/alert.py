from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType
from app.models.enums import AlertStatus


class FraudAlert(IdMixin, CreatedMixin, Base):
    __tablename__ = "fraud_alerts"
    __table_args__ = (
        Index("ix_fraud_alerts_land_id", "land_id"),
        Index("ix_fraud_alerts_transaction_id", "transaction_id"),
        Index("ix_fraud_alerts_status", "status"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    transaction_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("transactions.id"), nullable=True
    )
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    evidence: Mapped[list | dict | None] = mapped_column(JSONType, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=AlertStatus.OPEN.value, nullable=False
    )
    reviewed_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )

    land = relationship("LandParcel")
    transaction = relationship("Transaction")
    reviewer = relationship("User")
