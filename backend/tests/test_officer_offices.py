# ruff: noqa: E501, F811
import pytest
from sqlalchemy import select

from app.core.ratelimit import reset_rate_limits
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.land_office import LandOffice, OfficerRequest
from app.models.land_parcel import LandParcel
from app.models.user import User
from tests.test_documents import _db, _up, default_office, png, store  # noqa: F401
from tests.test_extraction import _patch, _ready  # noqa: F401
from tests.test_lands import PW, _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_review import _fill, _post  # noqa: F401

OFF = "/api/v1/offices"
ADM = "/api/v1/admin/officer-requests"


def _office(env, **kw):
    env.get(f"{OFF}/divisions")  # the bundled office list loads on first use
    with _db(env) as s:
        return s.scalar(select(LandOffice.id).where(*(getattr(LandOffice, k) == v for k, v in kw.items())))


def _body(env, email="Rina@Office.test", **kw):
    body = {
        "name": "Rina Akter", "email": email, "password": "long-enough-1",
        "office_id": _office(env, office_type="Union Land Office", district_en="Dhaka", upazila_en="Savar"),
        "designation": "Union Tahsildar", "phone": "+8801711000000", "employee_id": "EMP-1001",
    }
    return {**body, **kw}


def _login(env, email, pw="long-enough-1"):
    return env.post("/api/v1/auth/login", json={"email": email, "password": pw})


def test_cascade_lists_english_and_bangla(env):
    divs = env.get(f"{OFF}/divisions").json()
    assert len(divs) == 8 and {"en": "Dhaka", "bn": "ঢাকা"} in divs
    dists = env.get(f"{OFF}/districts", params={"division": "Dhaka"}).json()
    assert any(d["en"] == "Gazipur" and d["bn"] for d in dists)
    upas = env.get(f"{OFF}/upazilas", params={"division": "Dhaka", "district": "Dhaka"}).json()
    assert any(u["en"] == "Savar" for u in upas)
    offs = env.get(f"{OFF}", params={"division": "Dhaka", "district": "Dhaka", "upazila": "Savar"}).json()
    kinds = {o["office_type"] for o in offs["items"]}
    assert kinds == {"Upazila Land Office", "Union Land Office"}
    assert all(o["name_en"] and o["name_bn"] for o in offs["items"])
    # without an upazila: only the district-level offices
    d = env.get(f"{OFF}", params={"division": "Dhaka", "district": "Dhaka"}).json()
    assert {o["office_type"] for o in d["items"]} == {"District Land Office"}


def test_cascade_filters_by_the_chosen_district(env):
    # a district not named like its division: the list must be that district's, not the division-named one
    upas = env.get(f"{OFF}/upazilas", params={"division": "Dhaka", "district": "Rajbari"}).json()
    assert {u["en"] for u in upas} == {"Baliakandi", "Goalanda", "Kalukhali", "Pangsa", "Rajbari Sadar"}
    upas = env.get(f"{OFF}/upazilas", params={"division": "Khulna", "district": "Kushtia"}).json()
    assert "Kushtia Sadar" in {u["en"] for u in upas} and "Dumuria" not in {u["en"] for u in upas}
    offs = env.get(f"{OFF}", params={"division": "Dhaka", "district": "Rajbari", "upazila": "Pangsa"}).json()
    assert offs["total"] and all(o["district_en"] == "Rajbari" and o["upazila_en"] == "Pangsa" for o in offs["items"])


def test_request_creates_inactive_account_and_cannot_login(env):
    r = env.post(f"{OFF}/officer-requests", json=_body(env, role="ADMIN"))
    assert r.status_code == 201 and r.json()["status"] == "PENDING", r.text
    with _db(env) as s:
        u = s.scalar(select(User).where(User.email == "rina@office.test"))
        assert u.role == "OFFICER" and u.is_active is False and u.office_id is None
    bad = _login(env, "rina@office.test", "wrong-password-1")
    assert bad.status_code == 401 and bad.json()["code"] == "INVALID_CREDENTIALS"
    pending = _login(env, "rina@office.test")
    assert pending.status_code == 403 and pending.json()["code"] == "ACCOUNT_PENDING"


def test_duplicate_email_and_unknown_office(env):
    assert env.post(f"{OFF}/officer-requests", json=_body(env)).status_code == 201
    assert env.post(f"{OFF}/officer-requests", json=_body(env)).status_code == 409
    assert env.post(f"{OFF}/officer-requests", json=_body(env, email="citizen@x.test")).status_code == 409
    nf = env.post(f"{OFF}/officer-requests", json=_body(env, email="b@office.test", office_id="nope"))
    assert nf.status_code == 404
    bad = env.post(f"{OFF}/officer-requests", json=_body(env, email="c@office.test", phone="abc"))
    assert bad.status_code == 422


@pytest.mark.parametrize("role,code", [("CITIZEN", 403), ("REVIEWER", 403), ("OFFICER", 403), ("ADMIN", 200)])
def test_admin_queue_roles(env, role, code):
    assert env.get(ADM, headers=_h(env, role)).status_code == code


def test_approve_activates_and_ties_office(env):
    env.post(f"{OFF}/officer-requests", json=_body(env))
    items = env.get(ADM, headers=_h(env, "ADMIN")).json()
    assert items["pending"] == 1 and items["items"][0]["office"]["name_bn"]
    rid = items["items"][0]["id"]
    ok = env.post(f"{ADM}/{rid}/approve", headers=_h(env, "ADMIN"))
    assert ok.status_code == 200 and ok.json()["status"] == "APPROVED"
    assert env.post(f"{ADM}/{rid}/approve", headers=_h(env, "ADMIN")).status_code == 409
    login = _login(env, "rina@office.test")
    assert login.status_code == 200
    me = login.json()["user"]
    assert me["role"] == "OFFICER" and me["office"]["upazila_en"] == "Savar"
    with _db(env) as s:
        assert "OFFICER_REQUEST_APPROVE" in [a.action for a in s.scalars(select(AuditLog))]


def test_reject_then_reapply(env):
    env.post(f"{OFF}/officer-requests", json=_body(env))
    rid = env.get(ADM, headers=_h(env, "ADMIN")).json()["items"][0]["id"]
    assert env.post(f"{ADM}/{rid}/reject", json={"reason": "x"}, headers=_h(env, "ADMIN")).status_code == 422
    ok = env.post(f"{ADM}/{rid}/reject", json={"reason": "Posting order not valid"}, headers=_h(env, "ADMIN"))
    assert ok.status_code == 200 and ok.json()["status"] == "REJECTED"
    rej = _login(env, "rina@office.test")
    assert rej.status_code == 403 and rej.json()["code"] == "ACCOUNT_REJECTED"
    assert rej.json()["details"]["reason"] == "Posting order not valid"
    # a different person cannot take over the email; the owner (right password) can re-apply
    assert env.post(f"{OFF}/officer-requests", json=_body(env, password="another-pass-9")).status_code == 409
    assert env.post(f"{OFF}/officer-requests", json=_body(env)).status_code == 201
    assert _login(env, "rina@office.test").json()["code"] == "ACCOUNT_PENDING"
    with _db(env) as s:
        assert len(s.scalars(select(OfficerRequest)).all()) == 2


def _approved_officer(env, email, **office):
    """An approved office officer; returns (auth header, office id)."""
    reset_rate_limits()  # several officers are created in one test
    oid = _office(env, **office)
    env.post(f"{OFF}/officer-requests", json=_body(env, email=email, office_id=oid))
    items = env.get(ADM, headers=_h(env, "ADMIN"), params={"status": "PENDING"}).json()["items"]
    rid = next(i["id"] for i in items if i["email"] == email.lower())
    env.post(f"{ADM}/{rid}/approve", headers=_h(env, "ADMIN"))
    tok = _login(env, email).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}, oid


SAVAR = {"office_type": "Union Land Office", "district_en": "Dhaka", "upazila_en": "Savar"}
RUPGANJ = {"office_type": "Union Land Office", "district_en": "Narayanganj", "upazila_en": "Rupganj"}


def _upload(env, hdr, name="a.png", **form):
    data = png(salt=name.encode())
    if not env.get("/api/v1/auth/me", headers=hdr).json().get("office"):  # no office of their own
        form.setdefault("office_id", default_office(env, data))
    return env.post(
        "/api/v1/documents/upload",
        files={"file": (name, data, "application/octet-stream")},
        data=form, headers=hdr,
    )


def test_upload_is_filed_under_the_officers_own_office(env, store):
    hdr, oid = _approved_officer(env, "u1@office.test", **SAVAR)
    r = _upload(env, hdr)
    assert r.status_code == 201
    assert r.json()["office"]["id"] == oid and r.json()["office"]["name_bn"]
    with _db(env) as s:
        assert s.scalar(select(Document.office_id)) == oid
    # naming the same office is fine; naming another office is refused
    assert _upload(env, hdr, "b.png", office_id=oid).status_code == 201
    other = _office(env, **RUPGANJ)
    bad = _upload(env, hdr, "c.png", office_id=other)
    assert bad.status_code == 403 and bad.json()["code"] == "OFFICE_MISMATCH"


def test_admin_must_name_the_office_and_files_into_it(env, store):
    for role in ("ADMIN", "OFFICER"):  # neither account has an office of its own
        r = _upload(env, _h(env, role), f"none-{role}.png", office_id="")
        assert r.status_code == 422 and r.json()["code"] == "OFFICE_REQUIRED", r.text
    with _db(env) as s:
        assert s.scalar(select(Document.id)) is None
    oid = _office(env, **RUPGANJ)
    r = _upload(env, _h(env, "ADMIN"), office_id=oid)
    assert r.status_code == 201 and r.json()["office"]["id"] == oid
    assert _upload(env, _h(env, "ADMIN"), "x.png", office_id="nope").status_code == 404


def test_officer_cannot_upload_onto_land_of_another_office(env, store):
    hdr, oid = _approved_officer(env, "u2@office.test", **SAVAR)
    other = _office(env, **RUPGANJ)
    with _db(env) as s:
        land = s.scalars(select(LandParcel)).first()
        land.office_id = other
        code = land.land_id
        s.commit()
    r = _upload(env, hdr, land_id=code)
    assert r.status_code == 403 and r.json()["code"] == "OFFICE_MISMATCH"
    with _db(env) as s:
        s.get(LandParcel, s.scalar(select(LandParcel.id).where(LandParcel.land_id == code))).office_id = oid
        s.commit()
    assert _upload(env, hdr, "ok.png", land_id=code).status_code == 201


def test_documents_live_in_one_office_only(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    b, _ = _approved_officer(env, "b@office.test", **RUPGANJ)
    doc = _upload(env, a).json()["id"]
    api = "/api/v1/documents/"
    assert env.get(api + doc, headers=a).status_code == 200
    for method, path in (("get", ""), ("get", "/file"), ("get", "/extraction"), ("post", "/approve"), ("post", "/process")):
        r = getattr(env, method)(api + doc + path, headers=b)
        assert r.status_code == 404, (method, path)
    assert env.post(api + doc + "/reject", headers=b, json={"reason": "no"}).status_code == 404
    q = lambda h: env.get("/api/v1/officer/queue", headers=h).json()["total"]  # noqa: E731
    assert q(a) == 1 and q(b) == 0
    # the same file cannot be filed again from another office (and says nothing about the first)
    dup = env.post(
        "/api/v1/documents/upload",
        files={"file": ("a.png", png(salt=b"a.png"), "application/octet-stream")}, headers=b,
    )
    assert dup.status_code == 409 and dup.json()["code"] == "DOCUMENT_ALREADY_FILED"
    # unrestricted reviewers keep national access
    assert env.get(api + doc, headers=_h(env, "REVIEWER")).status_code == 200


def test_new_land_is_held_by_the_office_and_wrong_area_is_blocked(env, jobs):
    doc_id = _ready(env)
    assert _fill(env, doc_id)["validation"]["valid"] is True
    assert _patch(env, doc_id, {"district": "Dhaka", "upazila": "Savar"}).status_code == 200
    with _db(env) as s:  # filed under a Rupganj office, but the record says Dhaka / Savar
        s.get(Document, doc_id).office_id = _office(env, **RUPGANJ)
        s.commit()
    # the review screen says so before the reviewer checks every field
    ext = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "REVIEWER")).json()
    assert ext["area_conflict"]["district"] == "Dhaka" and ext["area_conflict"]["office_name_en"]
    r = _post(env, doc_id, "approve")
    assert r.status_code == 409 and r.json()["code"] == "RECORD_OUTSIDE_AREA"
    with _db(env) as s:
        assert s.get(Document, doc_id).processing_status == "REVIEW_REQUIRED"
        s.get(Document, doc_id).office_id = _office(env, **SAVAR)
        s.commit()
    ext = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "REVIEWER")).json()
    assert ext["area_conflict"] is None
    ok = _post(env, doc_id, "approve")
    assert ok.status_code == 200, ok.text
    with _db(env) as s:
        land = s.get(LandParcel, s.get(Document, doc_id).land_id)
        office = s.get(LandOffice, land.office_id)
        assert land.office_id == _office(env, **SAVAR) and land.union == office.union_en


def test_mutations_follow_the_office_that_holds_the_land(env):
    hdr, oid = _approved_officer(env, "m@office.test", **SAVAR)
    other = _office(env, **RUPGANJ)
    with _db(env) as s:  # seed data: 7 mutations, 2 on Dhaka/Savar land, 3 on Rupganj land
        for land in s.scalars(select(LandParcel)):
            if land.district == "Dhaka":
                land.office_id = oid
            elif land.district == "Narayanganj":
                land.office_id = other
        s.commit()
    everyone = env.get("/api/v1/mutations", headers=_h(env, "OFFICER")).json()
    scoped = env.get("/api/v1/mutations", headers=hdr).json()
    assert everyone["total"] == 7 and scoped["total"] == 2
    outside = next(i for i in everyone["items"] if i not in scoped["items"])
    assert env.get(f"/api/v1/mutations/{outside['id']}", headers=hdr).status_code == 404
    tr = env.post(f"/api/v1/mutations/{outside['id']}/transition", headers=hdr, json={"to": "UNDER_REVIEW"})
    assert tr.status_code == 404
    assert env.get(f"/api/v1/mutations/{scoped['items'][0]['id']}", headers=hdr).status_code == 200


UPAZILA = {"office_type": "Upazila Land Office", "district_en": "Dhaka", "upazila_en": "Savar"}
DISTRICT = {"office_type": "District Land Office", "district_en": "Dhaka", "upazila_en": None}


def test_supervisors_see_the_offices_beneath_them_but_not_beside_them(env, store):
    union, _ = _approved_officer(env, "un@office.test", **SAVAR)
    sibling, _ = _approved_officer(env, "sib@office.test", **RUPGANJ)
    upazila, _ = _approved_officer(env, "up@office.test", **UPAZILA)
    district, _ = _approved_officer(env, "di@office.test", **DISTRICT)
    doc = _upload(env, union).json()["id"]
    api = f"/api/v1/documents/{doc}"
    for hdr in (union, upazila, district):  # own office, upazila above it, district above that
        assert env.get(api, headers=hdr).status_code == 200
        assert env.get("/api/v1/officer/queue", headers=hdr).json()["total"] == 1
    assert env.get(api, headers=sibling).status_code == 404  # another upazila
    assert env.get("/api/v1/officer/queue", headers=sibling).json()["total"] == 0
    # supervisors review what is beneath them (here: past the access check, so 409 not 404),
    # while starting OCR stays with the owning office; the sibling upazila is shut out entirely
    for hdr in (upazila, district):
        assert env.post(api + "/approve", headers=hdr).status_code == 409
        assert env.post(api + "/process", headers=hdr).status_code == 404
    assert env.post(api + "/approve", headers=sibling).status_code == 404
    assert env.post(api + "/reject", headers=sibling, json={"reason": "no"}).status_code == 404
    # a union officer does not see upwards or sideways
    up_doc = _upload(env, upazila, "u.png").json()["id"]
    assert env.get(f"/api/v1/documents/{up_doc}", headers=union).status_code == 404
    assert env.get("/api/v1/officer/queue", headers=district).json()["total"] == 2
    assert env.get("/api/v1/officer/queue", headers=upazila).json()["total"] == 2
    assert env.get("/api/v1/officer/queue", headers=union).json()["total"] == 1


def test_reviewer_can_sort_all_databases_by_area(env, store):
    a, oid_a = _approved_officer(env, "ra@office.test", **SAVAR)
    b, oid_b = _approved_officer(env, "rb@office.test", **RUPGANJ)
    _upload(env, a, "1.png")
    _upload(env, a, "2.png")
    _upload(env, b, "3.png")
    rev = _h(env, "REVIEWER")
    q = lambda **p: env.get("/api/v1/officer/queue", headers=rev, params=p).json()["total"]  # noqa: E731
    assert q() == 3
    assert q(office_id=oid_a) == 2 and q(office_id=oid_b) == 1
    assert q(district="Dhaka") == 2 and q(district="Narayanganj") == 1
    assert q(division="Dhaka") == 3 and q(upazila="Rupganj") == 1
    assert q(division="Chattogram") == 0
    # a supervisor can also narrow within what they may see
    sup, _ = _approved_officer(env, "rs@office.test", **DISTRICT)
    sq = lambda **p: env.get("/api/v1/officer/queue", headers=sup, params=p).json()["total"]  # noqa: E731
    assert sq() == 2 and sq(office_id=oid_b) == 0 and sq(office_id=oid_a) == 2


def test_mutations_and_archive_can_be_sorted_by_area(env):
    oid_s = _office(env, **SAVAR)
    oid_r = _office(env, **RUPGANJ)
    with _db(env) as s:
        for land in s.scalars(select(LandParcel)):
            land.office_id = oid_s if land.district == "Dhaka" else oid_r if land.district == "Narayanganj" else None
        s.commit()
    rev = _h(env, "REVIEWER")
    m = lambda **p: env.get("/api/v1/mutations", headers=rev, params=p).json()["total"]  # noqa: E731
    assert m() == 7 and m(upazila="Savar") == 2 and m(district="Narayanganj") == 3 and m(office_id=oid_s) == 2
    assert m(district="Narayanganj", upazila="Savar") == 0
    sup, _ = _approved_officer(env, "ms@office.test", **UPAZILA)
    assert env.get("/api/v1/mutations", headers=sup).json()["total"] == 2  # Savar union land beneath
    ar = env.get("/api/v1/archive/search", headers=rev, params={"q": "x", "office_district": "Dhaka"})
    assert ar.status_code == 200


def test_zila_and_upozila_officers_approve_documents_beneath_them(env, jobs):
    upazila, _ = _approved_officer(env, "ua@office.test", **UPAZILA)
    district, _ = _approved_officer(env, "da@office.test", **DISTRICT)
    sibling, _ = _approved_officer(env, "sa@office.test", **RUPGANJ)
    doc_id = _ready(env)  # uploaded by the unrestricted demo officer, so no four-eyes clash
    assert _fill(env, doc_id)["validation"]["valid"] is True
    assert _patch(env, doc_id, {"district": "Dhaka", "upazila": "Savar"}).status_code == 200
    with _db(env) as s:
        s.get(Document, doc_id).office_id = _office(env, **SAVAR)
        s.commit()
    assert env.post(f"/api/v1/documents/{doc_id}/approve", headers=sibling).status_code == 404
    ok = env.post(f"/api/v1/documents/{doc_id}/approve", headers=upazila)
    assert ok.status_code == 200 and ok.json()["processing_status"] == "APPROVED"
    # a zila officer can edit and reject too
    other = _ready(env, b"Doc2")
    with _db(env) as s:
        s.get(Document, other).office_id = _office(env, **SAVAR)
        s.commit()
    assert env.get(f"/api/v1/documents/{other}/extraction", headers=district).status_code == 200
    rj = env.post(f"/api/v1/documents/{other}/reject", headers=district, json={"reason": "Unclear scan"})
    assert rj.status_code == 200 and rj.json()["processing_status"] == "REJECTED"


def test_admin_office_list_filters_and_counts_officers(env):
    ao = f"{ADM.rsplit('/', 1)[0]}/offices"
    assert env.get(ao).status_code == 401
    assert env.get(ao, headers=_h(env, "OFFICER")).status_code == 403
    assert env.get(ao, headers=_h(env, "CITIZEN")).status_code == 403
    adm = _h(env, "ADMIN")
    r = env.get(f"{ao}?limit=5", headers=adm)
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 5 and body["total"] > 5 and body["limit"] == 5
    assert {"code", "name_bn", "office_type", "officers"} <= set(body["items"][0])
    assert all(i["officers"] == 0 for i in body["items"])

    t = env.get(f"{ao}?office_type=Union Land Office&q=savar&limit=100", headers=adm).json()
    assert t["total"] >= 1 and all(i["office_type"] == "Union Land Office" for i in t["items"])
    assert env.get(f"{ao}?q=%25_%25", headers=adm).json()["total"] == 0  # wildcards are escaped

    # an approved officer shows up in their office's count
    rid = env.post(f"{OFF}/officer-requests", json=_body(env)).json()["id"]
    assert env.post(f"{ADM}/{rid}/approve", headers=adm).status_code == 200
    office_id = _body(env)["office_id"]
    rows = env.get(f"{ao}?office_type=Union Land Office&q=savar&limit=100", headers=adm).json()["items"]
    assert {i["id"]: i["officers"] for i in rows}[office_id] == 1
