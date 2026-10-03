from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, UTCDateTime
from app.models.enums import VerificationStatus


class VerificationRequest(IdMixin, CreatedMixin, Base):
    __tablename__ = "verification_requests"
    __table_args__ = (
        Index("ix_verification_requests_land_id", "land_id"),
        Index("ix_verification_requests_requested_by", "requested_by"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    requested_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=VerificationStatus.PENDING.value, nullable=False
    )
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    land = relationship("LandParcel")
    requester = relationship("User")
