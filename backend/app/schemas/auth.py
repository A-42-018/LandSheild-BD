import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _norm_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL.match(v):
        raise ValueError("invalid email")
    return v


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")  # any client-sent `role` is ignored

    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    preferred_language: str = Field(default="en", pattern="^(en|bn)$")

    _email = field_validator("email")(_norm_email)


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)

    _email = field_validator("email")(_norm_email)


class OfficeBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    office_type: str
    name_en: str
    name_bn: str
    division_en: str
    division_bn: str
    district_en: str
    district_bn: str
    upazila_en: str | None = None
    upazila_bn: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    phone: str | None = None
    preferred_language: str
    office: OfficeBrief | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
