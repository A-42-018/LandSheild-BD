from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, IdMixin, TimestampMixin


class Feedback(IdMixin, TimestampMixin, Base):
    """Public feedback, grievance or suggestion, plus the anonymous page-helpful rating."""

    __tablename__ = "feedback_items"
    __table_args__ = (
        Index("ix_feedback_items_status", "status"),
        Index("ix_feedback_items_kind", "kind"),
    )

    reference_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    related_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="RECEIVED", nullable=False)
    response: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    responded_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
