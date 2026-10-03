from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, IdMixin, TimestampMixin


class Owner(IdMixin, TimestampMixin, Base):
    __tablename__ = "owners"

    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    father_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Salted hashes only, never raw values (R2).
    nid_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    contact_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
