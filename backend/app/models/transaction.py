from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin
from app.models.enums import TransactionStatus, TransactionType


class Transaction(IdMixin, CreatedMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_land_id", "land_id"),
        Index("ix_transactions_seller_id", "seller_id"),
        Index("ix_transactions_buyer_id", "buyer_id"),
        Index("ix_transactions_deed_id", "deed_id"),
    )

    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    seller_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    buyer_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("owners.id"), nullable=False
    )
    # Link to the deed this transaction was posted from (lets DUPLICATE_DEED compare deed_no).
    deed_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("deeds.id"), nullable=True
    )
    transaction_type: Mapped[str] = mapped_column(
        String(30), default=TransactionType.SALE.value, nullable=False
    )
    transaction_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    source_document_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("documents.id"), nullable=True
    )
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=TransactionStatus.RECORDED.value, nullable=False
    )

    land = relationship("LandParcel")
    seller = relationship("Owner", foreign_keys=[seller_id])
    buyer = relationship("Owner", foreign_keys=[buyer_id])
    deed = relationship("Deed")
    source_document = relationship("Document")
