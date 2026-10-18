from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin
from app.models.enums import TransactionStatus


class Deed(IdMixin, CreatedMixin, Base):
    """deed_no is intentionally NOT unique: reuse must be detectable (DUPLICATE_DEED)."""

    __tablename__ = "deeds"
    __table_args__ = (
        Index("ix_deeds_land_id", "land_id"),
        Index("ix_deeds_seller_id", "seller_id"),
        Index("ix_deeds_buyer_id", "buyer_id"),
        Index("ix_deeds_deed_no", "deed_no"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    deed_no: Mapped[str] = mapped_column(String(100), nullable=False)
    seller_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    buyer_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    transaction_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    document_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("documents.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=TransactionStatus.RECORDED.value, nullable=False
    )

    record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # F4a SHA-256 hex
    signature: Mapped[str | None] = mapped_column(String(128), nullable=True)  # F4a Ed25519, b64url
    # H5: posted from a historical deed; record_id = its approved digital record (latest version)
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    record_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("document_records.id"), nullable=True
    )

    land = relationship("LandParcel")
    seller = relationship("Owner", foreign_keys=[seller_id])
    buyer = relationship("Owner", foreign_keys=[buyer_id])
    document = relationship("Document")
    record = relationship("DocumentRecord")
