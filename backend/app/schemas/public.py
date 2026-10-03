from datetime import datetime

from pydantic import BaseModel


class PublicCounts(BaseModel):
    ownership_records: int
    transactions: int
    flagged_transactions: int
    open_alerts: int


class PublicVerify(BaseModel):
    """PublicSafe payload (R4): no names, hashes, ids, file paths or evidence details."""

    land_id: str
    district: str
    upazila: str
    mouza: str
    status: str
    risk_level: str
    counts: PublicCounts
    last_verified_at: datetime | None = None
