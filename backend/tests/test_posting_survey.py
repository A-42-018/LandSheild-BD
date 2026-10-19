"""SJ4: posting + review write path use the survey and the JL."""
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.core.errors import AppError
from app.models.land_parcel import LandParcel
from app.schemas.extraction import Extraction, ExtractionPatch
from app.services import posting
from app.services.extraction import apply_patch
from tests.test_documents import _db  # noqa: F401
from tests.test_lands import env  # noqa: F401

V = {
    "district": "Sjdist", "upazila": "Sjupa", "mouza": "Sjmouza",
    "khatian_no": "77", "dag_no": "88",
}  # fmt: skip


def _doc(land_id=None):
    return SimpleNamespace(land_id=land_id, office_id=None, id="doc-x")


def _add(s, **kw):
    land = LandParcel(
        land_id=kw.pop("code"), area=10, area_unit="decimal", status="ACTIVE", **V, **kw
    )
    s.add(land)
    s.flush()
    return land


def _ex(survey=None, jl=None):
    return Extraction(
        provider="mock", fields=[], survey_type=survey, extras={"jl_no": jl} if jl else None
    )


def test_new_parcel_gets_survey_and_jl(env):
    with _db(env) as s:
        doc = _doc()
        survey, jl = posting._doc_survey(_ex("rs", "০৪৫"))
        assert (survey, jl) == ("RS", "45")
        land, created = posting._resolve_land(s, doc, V, 10.0, "decimal", survey, jl)
        assert created and (land.survey_type, land.jl_no) == ("RS", "45")
        assert doc.land_id == land.id


def test_legacy_parcel_is_filled_in(env):
    with _db(env) as s:
        legacy = _add(s, code="LP-90001")
        doc = _doc()
        land, created = posting._resolve_land(s, doc, V, 10.0, "decimal", "CS", "12")
        assert not created and land.id == legacy.id
        assert (legacy.survey_type, legacy.jl_no) == ("CS", "12")


def test_same_khatian_dag_in_other_survey_is_a_new_parcel(env):
    with _db(env) as s:
        cs = _add(s, code="LP-90002", survey_type="CS", jl_no="12")
        land, created = posting._resolve_land(s, _doc(), V, 10.0, "decimal", "RS", "12")
        assert created and land.id != cs.id and land.survey_type == "RS"
        assert cs.survey_type == "CS"  # never overwritten


def test_exact_survey_beats_legacy_and_two_legacy_are_ambiguous(env):
    with _db(env) as s:
        _add(s, code="LP-90003")
        exact = _add(s, code="LP-90004", survey_type="RS", jl_no="12")
        land, _ = posting._resolve_land(s, _doc(), V, 10.0, "decimal", "RS", "12")
        assert land.id == exact.id
        _add(s, code="LP-90005", survey_type="BS")
        with pytest.raises(AppError) as e:
            posting._resolve_land(s, _doc(), V, 10.0, "decimal", None, None)
        assert e.value.code == "LAND_AMBIGUOUS"
        cands = e.value.details["candidates"]  # same shape as the lookup's 409
        assert {c["land_id"] for c in cands} == {"LP-90003", "LP-90004", "LP-90005"}
        assert all(set(c) == {"land_id", "survey_type", "jl_no", "mouza"} for c in cands)


def test_filling_a_legacy_parcel_into_a_taken_key_is_409(env):
    with _db(env) as s:
        legacy = _add(s, code="LP-90008")
        _add(s, code="LP-90009", survey_type="RS", jl_no="12")
        with pytest.raises(AppError) as e:
            posting._resolve_land(s, _doc(legacy.id), V, 10.0, "decimal", "RS", "12")
        assert (e.value.status_code, e.value.code) == (409, "LAND_SURVEY_TAKEN")
        assert e.value.details["other_land_id"] == "LP-90009"
        assert (legacy.survey_type, legacy.jl_no) == (None, None)  # nothing half-filled
        land, _ = posting._resolve_land(s, _doc(legacy.id), V, 10.0, "decimal", "CS", "12")
        assert (land.survey_type, land.jl_no) == ("CS", "12")


def test_document_of_other_survey_cannot_attach(env):
    with _db(env) as s:
        cs = _add(s, code="LP-90006", survey_type="CS", jl_no="12")
        with pytest.raises(AppError) as e:
            posting._resolve_land(s, _doc(cs.id), V, 10.0, "decimal", "RS", "12")
        assert (e.value.status_code, e.value.code) == (409, "LAND_SURVEY_MISMATCH")
        with pytest.raises(AppError) as e:
            posting._resolve_land(s, _doc(cs.id), V, 10.0, "decimal", "CS", "99")
        assert e.value.code == "LAND_SURVEY_MISMATCH"
        land, _ = posting._resolve_land(s, _doc(cs.id), V, 10.0, "decimal", "CS", "12")
        assert land.id == cs.id


def test_deed_inherits_the_parcels_survey(env):
    with _db(env) as s:
        rs = _add(s, code="LP-90007", survey_type="RS", jl_no="3")
        deed = _ex()
        land, _ = posting._resolve_land(s, _doc(rs.id), V, 10.0, "decimal", None, None)
        posting._inherit_survey(deed, land)
        assert deed.survey_type == "RS"
        assert s.scalars(select(LandParcel).where(LandParcel.id == rs.id)).one().jl_no == "3"


def test_officer_can_correct_survey_and_jl_in_review():
    ex = _ex("CS", "5")
    out, old, new = apply_patch(ex, ExtractionPatch(survey_type="rs", jl_no="০০৭"))
    assert out.survey_type == "RS" and out.extras["jl_no"] == "7"
    assert old == {"survey_type": "CS", "jl_no": "5"} and new == {"survey_type": "RS", "jl_no": "7"}
    assert ex.survey_type == "CS"  # the original is untouched
    assert apply_patch(out, ExtractionPatch(survey_type="RS")) is None
    with pytest.raises(AppError) as e:
        apply_patch(ex, ExtractionPatch(survey_type="XX"))
    assert e.value.code == "EXTRACTION_INVALID"


def test_officer_can_clear_the_survey_and_jl_must_be_digits():
    ex = _ex("CS", "5")
    out, old, new = apply_patch(ex, ExtractionPatch(survey_type=""))
    assert out.survey_type is None and new == {"survey_type": None}
    assert apply_patch(_ex(None, "5"), ExtractionPatch(survey_type="")) is None
    with pytest.raises(AppError) as e:
        apply_patch(ex, ExtractionPatch(jl_no="abc"))
    assert e.value.details == [{"field": "jl_no", "code": "NOT_NUMERIC"}]
    out, _, _ = apply_patch(ex, ExtractionPatch(jl_no=""))
    assert out.extras["jl_no"] == ""
