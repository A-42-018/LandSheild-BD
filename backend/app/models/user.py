from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, IdMixin, TimestampMixin
from app.models.enums import Role


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=Role.CITIZEN.value, nullable=False)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # the land office an approved officer works in (None for every other account)
    office_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("land_offices.id"), nullable=True
    )
    office = relationship("LandOffice", lazy="joined", foreign_keys=[office_id])
