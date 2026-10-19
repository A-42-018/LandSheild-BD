from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Role
from app.schemas.auth import _norm_email

RoleCode = Literal["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]
Lang = Literal["en", "bn"]


class AdminUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    preferred_language: str
    is_active: bool
    created_at: datetime


class AdminUserList(BaseModel):
    items: list[AdminUser]
    total: int
    limit: int
    offset: int


class AdminUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: RoleCode = Role.CITIZEN.value
    preferred_language: Lang = "en"

    _email = field_validator("email")(_norm_email)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name is empty")
        return v


class AdminUserPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: RoleCode | None = None
    is_active: bool | None = None
    preferred_language: Lang | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("name is empty")
        return v


class AdminLandRecord(BaseModel):
    land_id: str
    district: str
    upazila: str
    mouza: str
    khatian_no: str
    dag_no: str
    area: float
    area_unit: str
    status: str
    updated_at: datetime
    survey_type: str | None = None  # SJ7
    jl_no: str | None = None  # SJ7


class AdminLandRecordList(BaseModel):
    items: list[AdminLandRecord]
    total: int
    limit: int
    offset: int


class AdminDocument(BaseModel):
    id: str
    land_id: str | None
    document_type: str
    processing_status: str
    ocr_confidence: float | None
    uploaded_by: str | None  # uploader display name
    created_at: datetime


class AdminDocumentList(BaseModel):
    items: list[AdminDocument]
    total: int
    limit: int
    offset: int
