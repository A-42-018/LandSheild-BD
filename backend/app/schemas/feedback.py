from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

FeedbackKind = Literal["GRIEVANCE", "FEEDBACK", "SUGGESTION"]
FeedbackStatus = Literal["RECEIVED", "IN_REVIEW", "RESOLVED", "CLOSED"]


class FeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: FeedbackKind
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=2000)
    contact_email: str | None = Field(default=None, max_length=255)
    related_ref: str | None = Field(default=None, max_length=100)

    @field_validator("contact_email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        v = (v or "").strip().lower()
        if not v:
            return None
        if "@" not in v or " " in v or v.startswith("@") or v.endswith("@"):
            raise ValueError("invalid email")
        return v

    @field_validator("subject", "message")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("blank")
        return v


class PageRatingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: str = Field(min_length=1, max_length=100, pattern=r"^/[A-Za-z0-9/_-]*$")
    helpful: bool


class FeedbackReceipt(BaseModel):
    reference_no: str
    status: str
    created_at: datetime


class PublicFeedbackStatus(BaseModel):
    """Status lookup by reference number: no subject, message or contact details."""

    reference_no: str
    kind: str
    status: str
    created_at: datetime
    updated_at: datetime
    response: str | None = None


class FeedbackItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference_no: str
    kind: str
    subject: str
    message: str
    contact_email: str | None
    related_ref: str | None
    status: str
    response: str | None
    created_at: datetime
    updated_at: datetime


class FeedbackList(BaseModel):
    items: list[FeedbackItem]
    total: int
    open: int
    helpful: int
    not_helpful: int
    limit: int
    offset: int


class FeedbackUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: FeedbackStatus
    response: str | None = Field(default=None, max_length=1000)
