from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType


class AuditLog(IdMixin, CreatedMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_actor_id", "actor_id"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    actor_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(UUID_LEN), nullable=True)
    old_value: Mapped[dict | list | None] = mapped_column(JSONType, nullable=True)
    new_value: Mapped[dict | list | None] = mapped_column(JSONType, nullable=True)
    # Salted hash only; raw IP is never stored (R2/R4).
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    actor = relationship("User")
