"""Citizen area (U3.2): search history, watched parcels and the notification inbox.

Rows belong to one user and are only ever read back by that user (`/me/*`).
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import UUID_LEN, Base, CreatedMixin, IdMixin, JSONType, UTCDateTime, utcnow


class SearchHistory(IdMixin, CreatedMixin, Base):
    """One row per (user, parcel): looking the same parcel up again bumps the count and the time."""

    __tablename__ = "search_history"
    __table_args__ = (
        UniqueConstraint("user_id", "land_id", name="uq_search_history_user_land"),
        Index("ix_search_history_user_last", "user_id", "last_searched_at"),
    )

    user_id: Mapped[str] = mapped_column(String(UUID_LEN), ForeignKey("users.id"), nullable=False)
    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    search_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_searched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)

    land = relationship("LandParcel", lazy="joined")


class WatchlistItem(IdMixin, CreatedMixin, Base):
    """A parcel the user watches. `checked_at` = records newer than this have not been turned
    into notifications yet."""

    __tablename__ = "watchlist"
    __table_args__ = (
        UniqueConstraint("user_id", "land_id", name="uq_watchlist_user_land"),
        Index("ix_watchlist_user_id", "user_id"),
    )

    user_id: Mapped[str] = mapped_column(String(UUID_LEN), ForeignKey("users.id"), nullable=False)
    land_id: Mapped[str] = mapped_column(
        String(UUID_LEN), ForeignKey("land_parcels.id"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(100), nullable=True)
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)

    land = relationship("LandParcel", lazy="joined")


class Notification(IdMixin, CreatedMixin, Base):
    """Inbox entry. `kind` + `data` are language-neutral codes; the frontend writes the sentence."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    user_id: Mapped[str] = mapped_column(String(UUID_LEN), ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    land_id: Mapped[str | None] = mapped_column(String(64), nullable=True)  # public parcel code
    ref_id: Mapped[str | None] = mapped_column(String(UUID_LEN), nullable=True)
    data: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
