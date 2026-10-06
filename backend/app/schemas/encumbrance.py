from datetime import date

from pydantic import BaseModel


class EncumbranceEntry(BaseModel):
    type: str
    status: str
    started_at: date | None = None
    resolved_at: date | None = None
    # staff only (citizens get null)
    reference_no: str | None = None
    authority: str | None = None
    note: str | None = None


class EncumbrancesResponse(BaseModel):
    land_id: str
    encumbrances: list[EncumbranceEntry]
