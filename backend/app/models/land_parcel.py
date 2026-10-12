from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import UUID_LEN, Base, IdMixin, JSONType, TimestampMixin
from app.models.enums import LandStatus


class LandParcel(IdMixin, TimestampMixin, Base):
    __tablename__ = "land_parcels"
    __table_args__ = (
        UniqueConstraint(
            "district",
            "upazila",
            "mouza",
            "khatian_no",
            "dag_no",
            name="uq_land_parcel_identifiers",
        ),
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
