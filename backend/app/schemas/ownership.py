from datetime import date

from pydantic import BaseModel

from app.schemas.land import LandOwnerPublic


class DocumentRef(BaseModel):
    id: str
    type: str


class OwnershipEntry(BaseModel):
    owner: LandOwnerPublic
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool
    kind: str = "CURRENT"  # CURRENT | HISTORICAL (H9a: a past chain-of-title link from a historical deed)
    historical: bool = False
    confidence: float | None = None
    document: DocumentRef | None = None


class OwnershipResponse(BaseModel):
    land_id: str
    entries: list[OwnershipEntry]


class TransactionEntry(BaseModel):
    transaction_type: str
    transaction_date: date | None = None
    seller: LandOwnerPublic
    buyer: LandOwnerPublic
    area: float
    area_unit: str
    status: str
    document: DocumentRef | None = None


class TransactionsResponse(BaseModel):
    land_id: str
    transactions: list[TransactionEntry]
