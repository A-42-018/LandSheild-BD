import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import _norm_email

_PHONE = re.compile(r"^\+?[0-9][0-9 \-]{6,18}[0-9]$")


class Place(BaseModel):
    en: str
    bn: str


class OfficeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    office_type: str
    division_en: str
    division_bn: str
    district_en: str
    district_bn: str
    upazila_en: str | None = None
    upazila_bn: str | None = None
    union_en: str | None = None
    union_bn: str | None = None
    name_en: str
    name_bn: str
    location: str | None = None


class OfficeList(BaseModel):
    items: list[OfficeOut]
    total: int


class OfficerRequestIn(BaseModel):
    model_config = ConfigDict(extra="ignore")  # a client-sent role is ignored

    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    preferred_language: str = Field(default="en", pattern="^(en|bn)$")
    office_id: str = Field(min_length=1, max_length=36)
    designation: str = Field(min_length=2, max_length=100)
    phone: str = Field(max_length=30)
    employee_id: str = Field(min_length=2, max_length=50)
    proof_note: str | None = Field(default=None, max_length=1000)

    _email = field_validator("email")(_norm_email)

    @field_validator("phone")
    @classmethod
    def _phone_ok(cls, v: str) -> str:
        v = v.strip()
        if not _PHONE.match(v):
            raise ValueError("invalid phone")
        return v


RequestStatus = Literal["PENDING", "APPROVED", "REJECTED"]


class OfficerRequestOut(BaseModel):
    id: str
    status: RequestStatus
    created_at: datetime
    office: OfficeOut


class AdminOfficerRequest(BaseModel):
    id: str
    status: RequestStatus
    created_at: datetime
    user_id: str
    name: str
    email: str
    designation: str
    phone: str
    employee_id: str
    proof_note: str | None
    office: OfficeOut
    reviewed_at: datetime | None
    rejection_reason: str | None


class AdminOfficerRequestList(BaseModel):
    items: list[AdminOfficerRequest]
    total: int
    pending: int
    limit: int
    offset: int


class RejectIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=500)
