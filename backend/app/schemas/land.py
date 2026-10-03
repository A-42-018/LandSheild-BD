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
    current_owners: list[LandOwnerPublic]
