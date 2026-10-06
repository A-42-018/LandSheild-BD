from typing import Any

from pydantic import BaseModel, Field


class CheckRow(BaseModel):
    """One checklist row. `code` + `detail` params only; translations live in the frontend."""

    code: str
    status: str  # PASS | WARN | FAIL | UNKNOWN
    detail: dict[str, Any] = Field(default_factory=dict)


class PrePurchaseCheck(BaseModel):
    land_id: str
    rows: list[CheckRow]
    verdict: str  # NO_INDICATORS | INDICATORS_FOUND
