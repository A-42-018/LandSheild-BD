from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin
from app.models.enums import OwnershipKind


class OwnershipHistory(IdMixin, CreatedMixin, Base):
    __tablename__ = "ownership_history"
    __table_args__ = (
        Index("ix_ownership_history_land_id", "land_id"),
        Index("ix_ownership_history_owner_id", "owner_id"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    owner_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # null = current owner
    source_transaction_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("transactions.id"), nullable=True
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # H9a: HISTORICAL = a past chain-of-title link (never the current owner, whatever end_date is)
    kind: Mapped[str] = mapped_column(
        String(12), default=OwnershipKind.CURRENT.value, server_default="CURRENT", nullable=False
    )

    land = relationship("LandParcel")
    owner = relationship("Owner")
    source_transaction = relationship("Transaction")
