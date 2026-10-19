from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import MutationStatus
from app.schemas.document import OfficeBrief
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
    hearing_at: datetime | None = None  # U3.4: when the hearing is held; None = not scheduled


class MutationList(BaseModel):
    total: int
    items: list[MutationQueueItem]


class MutationDetail(MutationQueueItem):
    survey_type: str | None = None  # SJ7: the parcel's survey and JL
    jl_no: str | None = None
    previous_khatian_no: str | None = None
    new_khatian_no: str | None = None
    ac_land_office: str | None = None
    checklist: dict[str, str] | None = None
    deed_no: str | None = None
    transaction_id: str | None = None
    allowed_transitions: list[str] = []  # what THIS user may do now (role + office level)
    holder_office: OfficeBrief | None = None  # the office whose database holds the land
    recommendation: str | None = None  # APPROVE | REJECT (advisory, from the field-level office)
    recommendation_note: str | None = None
    recommended_by_name: str | None = None
    recommended_at: datetime | None = None
    appeal_reason: str | None = None
    appealed_at: datetime | None = None
    can_recommend: bool = False
    can_appeal: bool = False


class MutationTransitionIn(BaseModel):
    to: MutationStatus
    reason: str | None = Field(default=None, max_length=500)
    hearing_at: datetime | None = None  # only with to=HEARING


class MutationHearingIn(BaseModel):
    hearing_at: datetime


class HearingCalendar(BaseModel):
    """One month of hearings (month boundaries in Bangladesh time) plus the cases that are in
    HEARING with no date yet."""

    month: str  # YYYY-MM
    items: list[MutationQueueItem]
    unscheduled: list[MutationQueueItem]


class MutationRecommendIn(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    note: str = Field(min_length=3, max_length=500)


class MutationAppealIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
