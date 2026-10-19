from pydantic import BaseModel


class LandOwnerPublic(BaseModel):
    name: str
    father_name: str | None = None  # REVIEWER+ only (R4); None for citizens


class LandPublic(BaseModel):
    land_id: str
    district: str
    upazila: str
    mouza: str
    khatian_no: str
    dag_no: str
    area: float
    area_unit: str
    status: str
    survey_type: str | None = None
    jl_no: str | None = None
    map_sheet_no: str | None = None
    warnings: list[str] = []  # e.g. SHEET_MISMATCH (D6)
    current_owners: list[LandOwnerPublic]
