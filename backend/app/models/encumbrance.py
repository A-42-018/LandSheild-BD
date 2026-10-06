from datetime import date

from sqlalchemy import Date, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin
from app.models.enums import EncumbranceStatus


class LandEncumbrance(IdMixin, CreatedMixin, Base):
    """Court case, khas land, acquisition or mortgage recorded against a parcel (synthetic)."""

    __tablename__ = "land_encumbrances"
    __table_args__ = (
        Index("ix_land_encumbrances_land_id", "land_id"),
        Index("ix_land_encumbrances_type", "type"),
        Index("ix_land_encumbrances_status", "status"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    reference_no: Mapped[str] = mapped_column(String(60), nullable=False)
    authority: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=EncumbranceStatus.ACTIVE.value, nullable=False
    )
    started_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    land = relationship("LandParcel")
