from sqlalchemy import Float, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, IdMixin, JSONType, TimestampMixin
from app.models.enums import LandStatus


class LandParcel(IdMixin, TimestampMixin, Base):
    __tablename__ = "land_parcels"
    # SJ1 key (D3) as a unique INDEX: survey_type / jl_no are NULL on legacy rows, and a unique
    # constraint treats NULLs as distinct, so two identical legacy rows would both be accepted.
    # coalesce() makes NULL count as one value (SQLite + Postgres); migration 0019 builds the same.
    __table_args__ = (
        Index(
            "uq_land_parcel_identifiers",
            "district",
            "upazila",
            text("coalesce(jl_no, '')"),
            "mouza",
            text("coalesce(survey_type, '')"),
            "khatian_no",
            "dag_no",
            unique=True,
        ),
        Index("ix_land_parcels_mouza_jl", func.lower(text("mouza")), "jl_no"),  # lookups use lower()
    )

    land_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    upazila: Mapped[str] = mapped_column(String(100), nullable=False)
    mouza: Mapped[str] = mapped_column(String(100), nullable=False)
    dag_no: Mapped[str] = mapped_column(String(50), nullable=False)
    khatian_no: Mapped[str] = mapped_column(String(50), nullable=False)
    area: Mapped[float] = mapped_column(Float, nullable=False)
    area_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    geometry: Mapped[dict | None] = mapped_column(JSONType, nullable=True)  # GeoJSON
    status: Mapped[str] = mapped_column(String(20), default=LandStatus.ACTIVE.value, nullable=False)
    # the land office whose database holds this parcel (set when its first document is posted)
    office_id: Mapped[str | None] = mapped_column(
        String(UUID_LEN), ForeignKey("land_offices.id"), index=True, nullable=True
    )
    union: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # SJ1: khatian/dag numbers are renumbered by every survey, so they only mean something inside
    # one survey. NULL on legacy rows (a lookup that matches several of them is ambiguous, SJ3).
    survey_type: Mapped[str | None] = mapped_column(String(2), nullable=True)  # SurveyType
    jl_no: Mapped[str | None] = mapped_column(String(20), nullable=True)  # no leading zeros
    map_sheet_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
