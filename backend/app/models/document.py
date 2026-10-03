from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType
from app.models.enums import DocumentStatus


class Document(IdMixin, CreatedMixin, Base):
    __tablename__ = "documents"

    land_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), index=True, nullable=True
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)  # server-only
    file_hash: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    extraction_json: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.UPLOADED.value, nullable=False
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
