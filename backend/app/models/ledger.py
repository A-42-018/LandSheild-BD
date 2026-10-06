from sqlalchemy import Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin


class LedgerEntry(IdMixin, CreatedMixin, Base):
    """Append-only hash chain (F4c). entry_hash = SHA-256(seq|type|id|payload_hash|prev_hash)."""

    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("ix_ledger_entries_seq", "seq", unique=True),
        Index("ix_ledger_entries_entity", "entity_type", "entity_id"),
    )

    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(UUID_LEN), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False)
