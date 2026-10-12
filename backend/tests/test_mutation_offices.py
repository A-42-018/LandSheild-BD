# ruff: noqa: E501, F811
import pytest
from sqlalchemy import select

from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from tests.test_documents import _db  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_officer_offices import DISTRICT, RUPGANJ, SAVAR, UPAZILA, _approved_officer, _office

M = "/api/v1/mutations"


def _open_case(env, **office):
    """Re-open one seeded Savar mutation and make the given office hold the Savar land."""
    oid = _office(env, **office)
    with _db(env) as s:
        for land in s.scalars(select(LandParcel)):
            land.office_id = oid if land.district == "Dhaka" else None
        m = s.scalars(
            select(MutationRecord).join(LandParcel, LandParcel.id == MutationRecord.land_id)
            .where(LandParcel.district == "Dhaka").order_by(MutationRecord.id)
        ).first()
        m.status, m.decided_at, m.decided_by = "UNDER_REVIEW", None, None
        mid = m.id
        s.commit()
    return mid


@pytest.fixture
def case(env):
    """An open mutation on Savar land held by a Savar union office; returns its id."""
    return _open_case(env, **SAVAR)


def _detail(env, mid, hdr):
    return env.get(f"{M}/{mid}", headers=hdr).json()


def test_union_office_prepares_but_cannot_decide(env, case):
    union, _ = _approved_officer(env, "u@x.office", **SAVAR)
    d = _detail(env, case, union)
    assert d["holder_office"]["district_en"] == "Dhaka" and d["holder_office"]["name_bn"]
    assert not {"APPROVED", "REJECTED"} & set(d["allowed_transitions"])
    assert d["can_recommend"] is True
    for to in ("APPROVED", "REJECTED"):
        r = env.post(f"{M}/{case}/transition", headers=union, json={"to": to, "reason": "x"})
        assert r.status_code == 403 and r.json()["code"] == "DECISION_FORBIDDEN"
    ok = env.post(f"{M}/{case}/transition", headers=union, json={"to": "HEARING", "reason": "site visit"})
    assert ok.status_code == 200 and ok.json()["status"] == "HEARING"
    rec = env.post(f"{M}/{case}/recommend", headers=union, json={"decision": "APPROVE", "note": "Boundaries verified on site"})
    assert rec.status_code == 200
    out = rec.json()
    assert out["recommendation"] == "APPROVE" and out["recommended_by_name"] and out["status"] == "HEARING"


def test_recommend_validation_and_closed_cases(env, case):
    union, _ = _approved_officer(env, "v@x.office", **SAVAR)
    assert env.post(f"{M}/{case}/recommend", headers=union, json={"decision": "MAYBE", "note": "abc"}).status_code == 422
    assert env.post(f"{M}/{case}/recommend", headers=union, json={"decision": "APPROVE", "note": "x"}).status_code == 422
    assert env.post(f"{M}/{case}/recommend", headers=_h(env, "REVIEWER"), json={"decision": "APPROVE", "note": "abc"}).status_code == 403
    env.post(f"{M}/{case}/transition", headers=_h(env, "ADMIN"), json={"to": "APPROVED"})
    closed = env.post(f"{M}/{case}/recommend", headers=union, json={"decision": "APPROVE", "note": "late note"})
    assert closed.status_code == 409 and closed.json()["code"] == "MUTATION_NOT_OPEN"


def test_upozila_decides_but_not_what_it_recommended(env, case):
    union, _ = _approved_officer(env, "u2@x.office", **SAVAR)
    upa, _ = _approved_officer(env, "up2@x.office", **UPAZILA)
    other_upa, _ = _approved_officer(env, "up3@x.office", **UPAZILA)
    env.post(f"{M}/{case}/recommend", headers=union, json={"decision": "APPROVE", "note": "verified"})
    assert "APPROVED" in _detail(env, case, upa)["allowed_transitions"]
    # an upozila officer who recommended it cannot also decide it
    env.post(f"{M}/{case}/recommend", headers=upa, json={"decision": "APPROVE", "note": "agree"})
    me = _detail(env, case, upa)
    assert not {"APPROVED", "REJECTED"} & set(me["allowed_transitions"])
    r = env.post(f"{M}/{case}/transition", headers=upa, json={"to": "APPROVED"})
    assert r.status_code == 403 and r.json()["code"] == "SELF_DECISION_FORBIDDEN"
    # a colleague at the same level can
    ok = env.post(f"{M}/{case}/transition", headers=other_upa, json={"to": "APPROVED"})
    assert ok.status_code == 200 and ok.json()["status"] == "APPROVED"


def test_sibling_office_and_reviewer_cannot_act(env, case):
    sibling, _ = _approved_officer(env, "sib@x.office", **RUPGANJ)
    assert env.get(f"{M}/{case}", headers=sibling).status_code == 404
    assert env.post(f"{M}/{case}/recommend", headers=sibling, json={"decision": "APPROVE", "note": "abc"}).status_code == 404
    assert _detail(env, case, _h(env, "REVIEWER"))["allowed_transitions"] == []  # reviewers read only


def test_appeal_goes_to_the_office_above(env, case):
    union, _ = _approved_officer(env, "ua@x.office", **SAVAR)
    upa, _ = _approved_officer(env, "upa@x.office", **UPAZILA)
    zila, _ = _approved_officer(env, "zila@x.office", **DISTRICT)
    # only a rejected case can be appealed
    assert env.post(f"{M}/{case}/appeal", headers=union, json={"reason": "not rejected yet"}).status_code == 409
    rej = env.post(f"{M}/{case}/transition", headers=upa, json={"to": "REJECTED", "reason": "documents incomplete"})
    assert rej.status_code == 200
    d = _detail(env, case, union)
    assert d["can_appeal"] is True and d["allowed_transitions"] == []
    ap = env.post(f"{M}/{case}/appeal", headers=union, json={"reason": "Missing papers were submitted"})
    assert ap.status_code == 200 and ap.json()["status"] == "APPEALED" and ap.json()["appeal_reason"]
    assert env.post(f"{M}/{case}/appeal", headers=union, json={"reason": "again please"}).status_code == 409
    # not the union, not the upozila that rejected it; the zila office above decides
    assert _detail(env, case, union)["allowed_transitions"] == []
    r1 = env.post(f"{M}/{case}/transition", headers=union, json={"to": "APPROVED"})
    assert r1.status_code == 403 and r1.json()["code"] == "APPEAL_DECISION_FORBIDDEN"
    r2 = env.post(f"{M}/{case}/transition", headers=upa, json={"to": "APPROVED"})
    assert r2.status_code == 403 and r2.json()["code"] == "SELF_DECISION_FORBIDDEN"
    assert set(_detail(env, case, zila)["allowed_transitions"]) == {"APPROVED", "REJECTED"}
    done = env.post(f"{M}/{case}/transition", headers=zila, json={"to": "APPROVED"})
    assert done.status_code == 200 and done.json()["status"] == "APPROVED"
    assert env.post(f"{M}/{case}/appeal", headers=union, json={"reason": "too late now"}).status_code == 409


def test_appeal_of_an_upozila_held_case_needs_the_zila(env):
    mid = _open_case(env, **UPAZILA)
    upa, _ = _approved_officer(env, "h1@x.office", **UPAZILA)
    upa2, _ = _approved_officer(env, "h2@x.office", **UPAZILA)
    zila, _ = _approved_officer(env, "h3@x.office", **DISTRICT)
    env.post(f"{M}/{mid}/transition", headers=upa, json={"to": "REJECTED", "reason": "no title"})
    env.post(f"{M}/{mid}/appeal", headers=upa2, json={"reason": "title papers attached"})
    # a colleague at the same upozila office cannot decide an appeal against its own office
    no = env.post(f"{M}/{mid}/transition", headers=upa2, json={"to": "APPROVED"})
    assert no.status_code == 403 and no.json()["code"] == "APPEAL_DECISION_FORBIDDEN"
    assert env.post(f"{M}/{mid}/transition", headers=zila, json={"to": "REJECTED", "reason": "upheld"}).status_code == 200
