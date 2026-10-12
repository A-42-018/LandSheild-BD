from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, UTCDateTime

OFFICE_TYPES = (
    "District Land Office",
    "Upazila Land Office",
    "Union Land Office",
    "Circle Land Office (Metropolitan)",
)


class LandOffice(IdMixin, Base):
    """One land office with its Division > Zila > Upozila > Union chain, English and Bangla."""

    __tablename__ = "land_offices"
    __table_args__ = (
        Index("ix_land_offices_division_en", "division_en"),
        Index("ix_land_offices_district_en", "district_en"),
        Index("ix_land_offices_upazila_en", "upazila_en"),
    )

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    office_type: Mapped[str] = mapped_column(String(40), nullable=False)
    division_en: Mapped[str] = mapped_column(String(100), nullable=False)
    division_bn: Mapped[str] = mapped_column(String(100), nullable=False)
    district_en: Mapped[str] = mapped_column(String(100), nullable=False)
    district_bn: Mapped[str] = mapped_column(String(100), nullable=False)
    upazila_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    upazila_bn: Mapped[str | None] = mapped_column(String(100), nullable=True)
    union_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    union_bn: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)


class OfficerRequest(IdMixin, CreatedMixin, Base):
    """An officer account request; the account stays inactive until an admin approves it."""

    __tablename__ = "officer_requests"
    __table_args__ = (
        Index("ix_officer_requests_user_id", "user_id"),
        Index("ix_officer_requests_status", "status"),
    )

    user_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=False
    )
    office_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_offices.id"), nullable=False
    )
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False)
    proof_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
