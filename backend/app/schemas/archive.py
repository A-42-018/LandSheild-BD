from pydantic import BaseModel


class ArchiveHit(BaseModel):
    document_id: str
    document_type: str
    land_id: str | None  # public land id (LP-…), when the document is linked to a parcel
    survey_type: str | None  # CS | SA | RS | BS
    district: str | None
    upazila: str | None
    mouza: str | None
    khatian_no: str | None
    snippet: str  # short OCR excerpt; the matched words are wrapped in [ ]
    year_from: int | None = None  # H9e: Gregorian year range of a historical deed (LHDR dates)
    year_to: int | None = None
    historical: bool = False  # the hit has an approved LHDR record


class ArchiveSearchOut(BaseModel):
    items: list[ArchiveHit]
    total: int
    limit: int
    offset: int
