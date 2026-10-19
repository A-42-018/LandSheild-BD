"""SJ D7 follow-up: a deed uploaded without a Land ID that matches several lands is attached to
the one the reviewer chooses (PUT /documents/{id}/land); nothing is ever picked silently."""
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.land_parcel import LandParcel
from app.models.transaction import Transaction
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _ready
from tests.test_khatian import _survey_doc
from tests.test_lands import _h, env  # noqa: F401
from tests.test_officer_offices import RUPGANJ, _approved_officer
from tests.test_processing import _row, jobs  # noqa: F401
from tests.test_review import _post

AMBIGUOUS = {"LP-10001", "LP-12001", "LP-12003"}  # Dhaka/Savar/Ashulia khatian 501 dag 101


def _attach(env, doc_id, land_id, role="REVIEWER", headers=None):
    return env.put(
        f"/api/v1/documents/{doc_id}/land", json={"land_id": land_id},
        headers=headers or _h(env, role),
    )  # fmt: skip


def _land(env, code):
    with _db(env) as s:
        return s.scalar(select(LandParcel).where(LandParcel.land_id == code))


def test_ambiguous_deed_is_attached_by_the_reviewer_then_approves(env, jobs):
    doc_id = _ready(env, b"Clean")  # uploaded without a Land ID; names no survey
    r = _post(env, doc_id, "approve")
    assert r.status_code == 409 and r.json()["code"] == "LAND_AMBIGUOUS"
    assert {c["land_id"] for c in r.json()["details"]["candidates"]} == AMBIGUOUS
    assert _row(env, doc_id).land_id is None  # nothing picked

    r = _attach(env, doc_id, " LP-10001 ")
    assert r.status_code == 200, r.text
    assert r.json()["land_id"] == "LP-10001" and r.json()["processing_status"] == "REVIEW_REQUIRED"
    with _db(env) as s:
        row = s.scalars(select(AuditLog).where(AuditLog.action == "DOCUMENT_LAND_ATTACH")).one()
        assert (row.old_value, row.new_value) == ({"land_id": None}, {"land_id": "LP-10001"})
    assert _attach(env, doc_id, "LP-10001").status_code == 200  # same land again: no new audit
    with _db(env) as s:
        n = s.scalars(select(AuditLog).where(AuditLog.action == "DOCUMENT_LAND_ATTACH")).all()
        assert len(n) == 1

    r = _post(env, doc_id, "approve")
    assert r.status_code == 200 and r.json()["land_id"] == "LP-10001"
    land = _land(env, "LP-10001")
    with _db(env) as s:
        assert s.scalars(select(Transaction).where(Transaction.land_id == land.id)).all()
    r = _attach(env, doc_id, "LP-12003")  # locked once approved
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_REVIEWABLE"


def test_attach_runs_the_posting_checks(env, jobs):
    doc_id = _ready(env, b"Clean")
    r = _attach(env, doc_id, "LP-99999")
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
    r = _attach(env, doc_id, "LP-10100")  # khatian 610 / dag 210: another land
    assert r.status_code == 409 and r.json()["code"] == "LAND_IDENTIFIER_MISMATCH"
    assert r.json()["details"] == {"land_id": "LP-10100"}
    # the reviewer corrected the deed to the CS survey: the RS land is refused, the CS one fits
    ex = f"/api/v1/documents/{doc_id}/extraction"
    r = env.patch(ex, json={"survey_type": "CS"}, headers=_h(env, "REVIEWER"))
    assert r.status_code == 200
    r = _attach(env, doc_id, "LP-10001")
    assert r.status_code == 409 and r.json()["code"] == "LAND_SURVEY_MISMATCH"
    assert _attach(env, doc_id, "LP-12001").status_code == 200
    assert _row(env, doc_id).land_id == _land(env, "LP-12001").id
    with _db(env) as s:  # a refused attach leaves no trace
        rows = s.scalars(select(AuditLog).where(AuditLog.action == "DOCUMENT_LAND_ATTACH")).all()
        assert [a.new_value["land_id"] for a in rows] == ["LP-12001"]


def test_attach_needs_an_extraction_and_a_deed(env, jobs):
    r = _up(env, "scan.png", png() + b"LSMOCK:Clean")
    assert r.status_code == 201
    r = _attach(env, r.json()["id"], "LP-10001")  # not processed yet
    assert r.status_code == 409 and r.json()["code"] == "DOCUMENT_NOT_REVIEWABLE"
    khatian = _survey_doc(env, "Khatian_RS.png", "KHATIAN")
    r = _attach(env, khatian, "LP-10001")
    assert r.status_code == 422 and r.json()["code"] == "LAND_NOT_APPLICABLE"


def test_attach_is_office_scoped(env, jobs):
    doc_id = _ready(env, b"Clean")
    other, other_office = _approved_officer(env, "far@office.test", **RUPGANJ)
    assert _attach(env, doc_id, "LP-10001", headers=other).status_code == 404  # looks absent
    assert _row(env, doc_id).land_id is None
    with _db(env) as s:  # a land held by another office's database cannot be chosen
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-12003"))
        land.office_id = other_office
        s.commit()
    r = _attach(env, doc_id, "LP-12003")
    assert r.status_code == 409 and r.json()["code"] == "RECORD_OUTSIDE_AREA"
