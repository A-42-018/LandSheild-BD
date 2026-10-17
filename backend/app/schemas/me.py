"""Citizen area `/me/*` (U3.2). Codes only; the frontend writes every sentence."""

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
# Bangladesh mobile: 01XXXXXXXXX, optionally with +880 / 880 in front of the 1.
_BD_MOBILE = re.compile(r"^(?:\+?880|0)1[3-9]\d{8}$")


class ParcelBrief(BaseModel):
    land_id: str
    district: str
    upazila: str
    mouza: str
    khatian_no: str
    dag_no: str
    status: str


class SearchItem(ParcelBrief):
    search_count: int
    last_searched_at: datetime
    watched: bool


class SearchList(BaseModel):
    items: list[SearchItem]
    total: int


class WatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    land_id: str = Field(min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=100)

    @field_validator("note")
    @classmethod
    def _blank_note(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v is not None else None


class WatchItem(ParcelBrief):
    note: str | None
    created_at: datetime
    unread: int  # unread notifications about this parcel


class WatchList(BaseModel):
    items: list[WatchItem]
    limit: int


class ReportItem(BaseModel):
    id: str
    land_id: str
    mouza: str
    dag_no: str
    status: str
    risk_level: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class ReportList(BaseModel):
    items: list[ReportItem]
    total: int


class NotificationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    land_id: str | None = None
    ref_id: str | None = None
    data: dict[str, Any] | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationItem]
    total: int
    unread: int


class NotificationsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # None = mark every notification read
    ids: list[str] | None = Field(default=None, max_length=200)


class MeSummary(BaseModel):
    searches: int
    watching: int
    reports: int
    unread: int
    recent_searches: list[SearchItem]
    recent_reports: list[ReportItem]
    latest_notifications: list[NotificationItem]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    # "" clears the number
    phone: str | None = Field(default=None, max_length=20)
    preferred_language: str | None = Field(default=None, pattern="^(en|bn)$")

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = " ".join(v.split())
        if not v:
            raise ValueError("name required")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = re.sub(r"[\s-]", "", v.translate(_BN_DIGITS))
        if v == "":
            return ""
        if not _BD_MOBILE.match(v):
            raise ValueError("invalid phone")
        return "0" + v[v.index("1") :] if not v.startswith("0") else v


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
