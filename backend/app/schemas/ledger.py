from typing import Literal

from pydantic import BaseModel


class LedgerVerify(BaseModel):
    status: Literal["INTACT", "BROKEN"]
    entries: int
    broken_seq: int | None = None
    reason: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
