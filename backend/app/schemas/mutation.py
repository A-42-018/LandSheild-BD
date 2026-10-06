from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import MutationStatus
from app.schemas.land import LandOwnerPublic


class MutationEntry(BaseModel):
    """Citizens get status, dates and khatian only; staff fields stay None for them."""

    mutation_no: str
    status: str
    applied_at: datetime
    decided_at: datetime | None = None
    previous_khatian_no: str | None = None
    new_khatian_no: str | None = None
    applicant: LandOwnerPublic | None = None
    area: float | None = None
    area_unit: str | None = None
    ac_land_office: str | None = None
    deed_no: str | None = None


class MutationsResponse(BaseModel):
    land_id: str
    mutations: list[MutationEntry]


class MutationQueueItem(BaseModel):
    id: str
    mutation_no: str
    land_id: str
    status: str
    fast_track: bool
    applicant: str
    area: float
    area_unit: str
    applied_at: datetime
    status_changed_at: datetime
    decided_at: datetime | None = None
    source: str


class MutationList(BaseModel):
    total: int
    items: list[MutationQueueItem]


class MutationDetail(MutationQueueItem):
    previous_khatian_no: str | None = None
    new_khatian_no: str | None = None
    ac_land_office: str | None = None
    checklist: dict[str, str] | None = None
    deed_no: str | None = None
    transaction_id: str | None = None
    allowed_transitions: list[str] = []


class MutationTransitionIn(BaseModel):
    to: MutationStatus
    reason: str | None = Field(default=None, max_length=500)
