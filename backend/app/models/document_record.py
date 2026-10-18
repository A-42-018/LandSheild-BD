from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, IdMixin, JSONType, TimestampMixin, UTCDateTime
from app.models.enums import RecordStatus


class DocumentRecord(IdMixin, TimestampMixin, Base):
    """One version of a document's digital record (H5). Rows are never deleted: MACHINE rows are
    the extractor's output and never change, a DRAFT is the reviewer's working copy, APPROVED rows
    are frozen (record_hash + Ed25519 signature) and become SUPERSEDED when a correction is
    approved. record_json is an LHDR v1 record (schema lhdr/1, historical deeds) or the 13 fields
    (core/1, modern deeds and survey records)."""

    __tablename__ = "document_records"
    __table_args__ = (
        UniqueConstraint("document_id", "version", name="uq_document_records_version"),
    )

    document_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("documents.id"), index=True, nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, ... per document
    status: Mapped[str] = mapped_column(
        String(20), default=RecordStatus.MACHINE.value, nullable=False
    )
    record_schema: Mapped[str] = mapped_column("schema", String(20), nullable=False)
    record_json: Mapped[dict] = mapped_column(JSONType, nullable=False)
    created_by: Mapped[str | None] = mapped_column(  # None = the extraction job
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 hex
    signature: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Ed25519, b64url

    document = relationship("Document")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
