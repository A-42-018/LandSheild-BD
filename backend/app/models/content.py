from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, IdMixin, TimestampMixin

CONTENT_KINDS = ("NOTICE", "FAQ", "GUIDE")


class ContentItem(IdMixin, TimestampMixin, Base):
    """Admin-managed public text (U3.6): a notice, an FAQ entry or a guide, in both languages.

    Only `published` rows reach the public API. A notice also carries a date and a `ticker`
    flag (scrolls in the header ticker); FAQ and guide order comes from `position`.
    """

    __tablename__ = "content_items"
    __table_args__ = (Index("ix_content_items_kind_published", "kind", "published"),)

    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    title_en: Mapped[str] = mapped_column(String(200), nullable=False)
    title_bn: Mapped[str] = mapped_column(String(200), nullable=False)
    body_en: Mapped[str] = mapped_column(Text, nullable=False)
    body_bn: Mapped[str] = mapped_column(Text, nullable=False)
    published_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ticker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("users.id"), nullable=True
    )
