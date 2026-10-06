from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType, UTCDateTime, utcnow
from app.models.enums import MutationSource, MutationStatus


class MutationRecord(IdMixin, CreatedMixin, Base):
    """Land-record mutation (namjari): registers a transfer in the khatian."""

    __tablename__ = "mutation_records"
    __table_args__ = (
        Index("ix_mutation_records_land_id", "land_id"),
        Index("ix_mutation_records_deed_id", "deed_id"),
        Index("ix_mutation_records_transaction_id", "transaction_id"),
        Index("ix_mutation_records_applicant_owner_id", "applicant_owner_id"),
        Index("ix_mutation_records_status", "status"),
    )

    mutation_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    deed_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("deeds.id"), nullable=True
    )
    transaction_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("transactions.id"), nullable=True
    )
    applicant_owner_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    previous_khatian_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_khatian_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    ac_land_office: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=MutationStatus.APPLIED.value, nullable=False
    )
    checklist: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    fast_track: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    applied_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    status_changed_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(20), default=MutationSource.WORKFLOW.value, nullable=False
    )

    land = relationship("LandParcel")
    deed = relationship("Deed")
    transaction = relationship("Transaction")
    applicant = relationship("Owner", foreign_keys=[applicant_owner_id])
