from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Kind = Literal["NOTICE", "FAQ", "GUIDE"]

_TITLE = Field(min_length=3, max_length=200)
_BODY = Field(min_length=3, max_length=5000)


def _clean(v: str) -> str:
    return v.strip()


class ContentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Kind
    title_en: str = _TITLE
    title_bn: str = _TITLE
    body_en: str = _BODY
    body_bn: str = _BODY
    published_on: date | None = None
    ticker: bool = False
    published: bool = True
    position: int = Field(default=0, ge=0, le=9999)

    _strip = field_validator("title_en", "title_bn", "body_en", "body_bn")(_clean)

    @model_validator(mode="after")
    def _notice_rules(self) -> "ContentIn":
        if self.kind == "NOTICE" and self.published_on is None:
            raise ValueError("a notice needs a date")
        if self.kind != "NOTICE":
            self.ticker = False  # only notices scroll in the ticker
        return self


class ContentPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title_en: str | None = Field(default=None, min_length=3, max_length=200)
    title_bn: str | None = Field(default=None, min_length=3, max_length=200)
    body_en: str | None = Field(default=None, min_length=3, max_length=5000)
    body_bn: str | None = Field(default=None, min_length=3, max_length=5000)
    published_on: date | None = None
    ticker: bool | None = None
    published: bool | None = None
    position: int | None = Field(default=None, ge=0, le=9999)

    _strip = field_validator("title_en", "title_bn", "body_en", "body_bn")(
        lambda v: v.strip() if v else v
    )


class PublicContent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: Kind
    title_en: str
    title_bn: str
    body_en: str
    body_bn: str
    published_on: date | None
    ticker: bool
    position: int


class PublicContentList(BaseModel):
    items: list[PublicContent]


class AdminContent(PublicContent):
    published: bool
    created_at: datetime
    updated_at: datetime


class AdminContentList(BaseModel):
    items: list[AdminContent]
    total: int
    limit: int
    offset: int
