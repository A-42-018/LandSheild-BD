# ruff: noqa: E501, F811
"""H7a: GET /documents, the document library list (scoping, tabs, filters, search, sort, paging)."""
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models.document import Document
from app.models.document_record import DocumentRecord
from tests.test_documents import _db, store  # noqa: F401
from tests.test_lands import ROLES, _h, env  # noqa: F401
from tests.test_officer_offices import RUPGANJ, SAVAR, _approved_officer, _office, _upload
from tests.test_processing import jobs  # noqa: F401
from tests.test_records import D, _approve_historical, _historical, _rec

URL = "/api/v1/documents"
SAVAR_UPA = {"office_type": "Upazila Land Office", "district_en": "Dhaka", "upazila_en": "Savar"}


def _doc(env, hdr, name, **set_):
    """Upload a file as `hdr`, then set columns directly (status, extraction, office, ...)."""
    r = _upload(env, hdr, name)
    assert r.status_code == 201, r.text
    did = r.json()["id"]
    if set_:
        with _db(env) as s:
            d = s.get(Document, did)
            for k, v in set_.items():
                setattr(d, k, v)
            s.commit()
    return did


def _fields(**kw):
    return {"fields": [{"field": k, "value": v, "confidence": 0.9} for k, v in kw.items()]}


def _ids(env, hdr, **params):
    r = env.get(URL, params=params, headers=hdr)
    assert r.status_code == 200, r.text
    return [i["id"] for i in r.json()["items"]]


@pytest.mark.parametrize("role,code", [("CITIZEN", 403), ("REVIEWER", 200), ("OFFICER", 200), ("ADMIN", 200)])
def test_roles(env, role, code):
    assert env.get(URL, headers=_h(env, role)).status_code == code


def test_anonymous_is_401(env):
    assert env.get(URL).status_code == 401


def test_office_officer_sees_own_office_and_below_not_others(env, store):
    union, _ = _approved_officer(env, "u@office.test", **SAVAR)
    upazila, _ = _approved_officer(env, "z@office.test", **SAVAR_UPA)
    other, _ = _approved_officer(env, "o@office.test", **RUPGANJ)
    d_union = _doc(env, union, "a.png")
    d_other = _doc(env, other, "b.png")
    assert _ids(env, union) == [d_union]  # a union office sees only itself
    assert _ids(env, upazila) == [d_union]  # the upazila office sees the union office beneath it
    assert _ids(env, other) == [d_other]
    assert set(_ids(env, _h(env, "ADMIN"))) == {d_union, d_other}
    assert set(_ids(env, _h(env, "REVIEWER"))) == {d_union, d_other}
    assert set(_ids(env, _h(env, "OFFICER"))) == {d_union, d_other}  # unrestricted demo officer


def test_uploaders_always_see_their_own_uploads(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    b, _ = _approved_officer(env, "b@office.test", **RUPGANJ)
    doc = _doc(env, a, "a.png", office_id=_office(env, **RUPGANJ))  # now held by another office
    assert _ids(env, a) == [doc]  # still the uploader's
    assert _ids(env, b) == [doc]  # and the holding office's
    assert _ids(env, a, tab="office") == []  # not part of "my office" any more
    assert _ids(env, a, tab="mine") == [doc]


def test_tabs_mine_office_action(env, store):
    me, _ = _approved_officer(env, "me@office.test", **SAVAR)
    upa, _ = _approved_officer(env, "upa@office.test", **SAVAR_UPA)
    mine_review = _doc(env, me, "m1.png", processing_status="REVIEW_REQUIRED")
    mine_new = _doc(env, me, "m2.png")  # UPLOADED: I still have to start processing
    mine_failed = _doc(env, me, "m3.png", processing_status="FAILED")
    mine_done = _doc(env, me, "m4.png", processing_status="APPROVED")
    theirs_review = _doc(env, upa, "t1.png", processing_status="EXTRACTED", office_id=_office(env, **SAVAR))
    theirs_new = _doc(env, upa, "t2.png", office_id=_office(env, **SAVAR))
    assert set(_ids(env, me, tab="mine")) == {mine_review, mine_new, mine_failed, mine_done}
    assert set(_ids(env, me, tab="office")) == {mine_review, mine_new, mine_failed, mine_done, theirs_review, theirs_new}
    # action: someone else's review I may decide, plus my own uploads to process / retry
    # (my own pending review is four-eyes blocked)
    assert set(_ids(env, me, tab="action")) == {theirs_review, mine_new, mine_failed}
    by = {i["id"]: i for i in env.get(URL, headers=me).json()["items"]}
    assert by[theirs_review]["needs_my_action"] and not by[mine_review]["needs_my_action"]
    assert by[mine_new]["uploaded_by_me"] and not by[theirs_new]["uploaded_by_me"]
    # an admin may approve their own upload (four-eyes exemption)
    adm = _h(env, "ADMIN")
    assert mine_review in _ids(env, adm, tab="action") and theirs_new not in _ids(env, adm, tab="action")
    assert _ids(env, me, mine=True, status="APPROVED") == [mine_done]


def test_filters(env, store):
    a, oa = _approved_officer(env, "a@office.test", **SAVAR)
    b, ob = _approved_officer(env, "b@office.test", **RUPGANJ)
    adm = _h(env, "ADMIN")
    d1 = _doc(env, a, "1.png", processing_status="APPROVED", document_type="DEED",
              extraction_json={"deed_profile": "historical", **_fields(deed_no="4782/খ")})
    d2 = _doc(env, a, "2.png", document_type="KHATIAN", extraction_json={"deed_profile": "modern"})
    d3 = _doc(env, b, "3.png", document_type="DEED", processing_status="REVIEW_REQUIRED")
    assert set(_ids(env, adm, status="APPROVED")) == {d1}
    assert set(_ids(env, adm, type="DEED")) == {d1, d3}
    assert _ids(env, adm, type="KHATIAN") == [d2]
    assert _ids(env, adm, profile="historical") == [d1]
    assert _ids(env, adm, profile="modern") == [d2]  # a document not read yet has no profile
    assert set(_ids(env, adm, office_id=oa)) == {d1, d2}
    assert _ids(env, adm, district="Narayanganj") == [d3]
    assert set(_ids(env, adm, upazila="Savar")) == {d1, d2}
    for bad in ({"status": "NOPE"}, {"type": "NOPE"}, {"profile": "x"}, {"tab": "x"}, {"sort": "x"}, {"limit": 0}, {"limit": 101}):
        assert env.get(URL, params=bad, headers=adm).status_code == 422, bad


def test_date_range(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    old = _doc(env, a, "old.png", created_at=datetime(2026, 3, 10, 12, 0, tzinfo=UTC))
    new = _doc(env, a, "new.png", created_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC))
    assert set(_ids(env, a)) == {old, new}
    assert _ids(env, a, date_from="2026-09-01") == [new]
    assert _ids(env, a, date_to="2026-03-10") == [old]  # the end day is included
    assert _ids(env, a, date_from="2026-03-10", date_to="2026-03-10") == [old]
    assert _ids(env, a, date_from="2026-04-01", date_to="2026-08-31") == []
    r = env.get(URL, params={"date_from": "2026-09-02", "date_to": "2026-09-01"}, headers=a)
    assert r.status_code == 422 and r.json()["code"] == "INVALID_DATE_RANGE"


def test_search_deed_no_mouza_party_and_land_id(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    flat = _doc(env, a, "flat.png", extraction_json=_fields(deed_no="4782/খ", mouza="ভবানীপুর", seller="কফিল উদ্দিন"))
    rec = _doc(env, a, "rec.png", extraction_json={"record": {
        "registration": {"deed_no": {"value": "9911", "verbatim": "৯৯১১"}},
        "parties": [{"role": "BUYER", "name": {"value": "রামকান্ত দাশ", "verbatim": "রামকান্ত দাশ"}}],
        "schedule": [{"mouza": "চর কুমিল্লা"}],
    }})
    plain = _doc(env, a, "plain.png")
    assert _ids(env, a, q="4782") == [flat]
    assert _ids(env, a, q="৪৭৮২") == [flat]  # Bangla digits fold to ASCII
    assert _ids(env, a, q="ভবানী") == [flat]
    assert _ids(env, a, q="কফিল") == [flat]
    assert _ids(env, a, q="রামকান্ত") == [rec]
    assert _ids(env, a, q="9911") == [rec] and _ids(env, a, q="৯৯১১") == [rec]
    assert _ids(env, a, q="কুমিল্লা") == [rec]
    assert _ids(env, a, q="no-such-thing") == []
    # land id and the land's mouza
    from app.models.land_parcel import LandParcel

    with _db(env) as s:
        land = s.scalars(select(LandParcel)).first()
        code, mouza, pk = land.land_id, land.mouza, land.id
        s.get(Document, plain).land_id = pk
        s.commit()
    assert _ids(env, _h(env, "ADMIN"), q=code.lower()) == [plain]
    assert plain in _ids(env, _h(env, "ADMIN"), q=mouza)
    # search never widens the scope
    other, _ = _approved_officer(env, "o@office.test", **RUPGANJ)
    assert _ids(env, other, q="4782") == []


def test_search_pagination_counts(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    for i in range(5):
        _doc(env, a, f"x{i}.png", extraction_json=_fields(mouza="আশুলিয়া"))
    r = env.get(URL, params={"q": "আশুলিয়া", "limit": 2, "offset": 2}, headers=a).json()
    assert r["total"] == 5 and len(r["items"]) == 2 and r["limit"] == 2 and r["offset"] == 2


def test_sort_created_status_and_deed_date(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    d1 = _doc(env, a, "1.png", created_at=datetime(2026, 1, 1, tzinfo=UTC), processing_status="REJECTED",
              extraction_json=_fields(deed_date="1944-02-27"))
    d2 = _doc(env, a, "2.png", created_at=datetime(2026, 2, 1, tzinfo=UTC), processing_status="APPROVED",
              extraction_json=_fields(deed_date="2001-05-09"))
    d3 = _doc(env, a, "3.png", created_at=datetime(2026, 3, 1, tzinfo=UTC), processing_status="FAILED")
    assert _ids(env, a) == [d3, d2, d1]  # newest first by default
    assert _ids(env, a, order="asc") == [d1, d2, d3]
    assert _ids(env, a, sort="status", order="asc") == [d2, d3, d1]
    assert _ids(env, a, sort="deed_date", order="asc") == [d1, d2, d3]
    assert _ids(env, a, sort="deed_date") == [d2, d1, d3]  # no deed date: always last
    item = env.get(URL, params={"sort": "deed_date", "order": "asc"}, headers=a).json()["items"][0]
    assert item["deed_date"] == "1944-02-27"


def test_pagination(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    made = [_doc(env, a, f"p{i}.png", created_at=datetime(2026, 1, i + 1, tzinfo=UTC)) for i in range(5)]
    page1 = env.get(URL, params={"limit": 2}, headers=a).json()
    page3 = env.get(URL, params={"limit": 2, "offset": 4}, headers=a).json()
    assert page1["total"] == 5 and [i["id"] for i in page1["items"]] == [made[4], made[3]]
    assert [i["id"] for i in page3["items"]] == [made[0]]
    assert env.get(URL, params={"limit": 2, "offset": 50}, headers=a).json()["items"] == []


def test_item_shape_digitised_and_versions(env, store):
    a, _ = _approved_officer(env, "a@office.test", **SAVAR)
    doc = _doc(env, a, "h.png", processing_status="APPROVED",
               extraction_json={"deed_profile": "historical", **_fields(deed_no="4782/খ", mouza="ভবানীপুর")})
    plain = _doc(env, a, "p.png")
    with _db(env) as s:
        for ver, st in ((1, "SUPERSEDED"), (2, "APPROVED"), (3, "DRAFT")):
            s.add(DocumentRecord(document_id=doc, version=ver, status=st, record_schema="lhdr/1", record_json={}))
        s.commit()
    by = {i["id"]: i for i in env.get(URL, headers=a).json()["items"]}
    h = by[doc]
    assert (h["deed_no"], h["mouza"], h["deed_profile"], h["historical"]) == ("4782/খ", "ভবানীপুর", "historical", True)
    assert (h["digitised"], h["approved_version"], h["versions"]) == (True, 2, 3)
    assert h["file_type"] == "png" and h["office"]["name_en"] and h["uploaded_by_me"] is True
    p = by[plain]
    assert (p["digitised"], p["approved_version"], p["versions"], p["historical"]) == (False, None, 0, False)
    assert not ({"file_path", "file_hash", "uploaded_by", "party_nids", "extraction_json", "ocr_text"} & set(h))


def test_empty_library(env):
    r = env.get(URL, headers=_h(env, "ADMIN")).json()
    assert r == {"items": [], "total": 0, "limit": 20, "offset": 0}


# ---- H7b: GET /lands/{land_id}/documents ---------------------------------------------------------


def _land(env) -> tuple[str, str]:
    from app.models.land_parcel import LandParcel

    with _db(env) as s:
        land = s.scalars(select(LandParcel)).first()
        return land.land_id, land.id


def _land_docs(env, hdr, code):
    return env.get(f"/api/v1/lands/{code}/documents", headers=hdr)


@pytest.mark.parametrize("role,code", [("CITIZEN", 403), ("REVIEWER", 200), ("OFFICER", 200), ("ADMIN", 200)])
def test_land_documents_roles(env, role, code):
    land, _ = _land(env)
    assert _land_docs(env, _h(env, role), land).status_code == code


def test_land_documents_anonymous_and_unknown_land(env):
    land, _ = _land(env)
    assert env.get(f"/api/v1/lands/{land}/documents").status_code == 401
    r = _land_docs(env, _h(env, "ADMIN"), "LP-99999")
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"


def test_land_documents_are_in_deed_date_order_undated_last(env, store):
    land, pk = _land(env)
    adm = _h(env, "ADMIN")
    newer = _doc(env, adm, "n.png", land_id=pk, extraction_json={"deed_profile": "modern", **_fields(deed_no="9/ক", deed_date="2001-05-01")})
    undated = _doc(env, adm, "u.png", land_id=pk)
    older = _doc(env, adm, "o.png", land_id=pk, extraction_json={"deed_profile": "historical", **_fields(deed_no="4782/খ", deed_date="1944-02-27")})
    _doc(env, adm, "elsewhere.png")  # another land (none): not listed
    out = _land_docs(env, adm, land).json()
    assert out["land_id"] == land and out["total"] == 3
    assert [i["id"] for i in out["items"]] == [older, newer, undated]
    first = out["items"][0]
    assert (first["historical"], first["deed_no"], first["deed_date"], first["land_id"]) == (True, "4782/খ", "1944-02-27", land)
    assert out["items"][1]["historical"] is False
    assert not ({"file_path", "file_hash", "uploaded_by", "extraction_json"} & set(first))


def test_land_documents_scoping(env, store):
    land, pk = _land(env)
    union, _ = _approved_officer(env, "u@office.test", **SAVAR)
    upazila, _ = _approved_officer(env, "z@office.test", **SAVAR_UPA)
    other, _ = _approved_officer(env, "o@office.test", **RUPGANJ)
    d_union = _doc(env, union, "a.png", land_id=pk)
    d_other = _doc(env, other, "b.png", land_id=pk)
    ids = lambda h: [i["id"] for i in _land_docs(env, h, land).json()["items"]]  # noqa: E731
    assert ids(union) == [d_union]
    assert ids(upazila) == [d_union]  # the office above sees the one beneath it
    assert ids(other) == [d_other]
    assert set(ids(_h(env, "ADMIN"))) == {d_union, d_other}
    assert set(ids(_h(env, "REVIEWER"))) == {d_union, d_other}
    moved = _doc(env, union, "m.png", land_id=pk, office_id=_office(env, **RUPGANJ))  # held by another office now
    assert moved in ids(union)  # an uploader keeps seeing their own upload
    assert _land_docs(env, other, land).status_code == 200  # the land itself stays visible


def test_land_documents_include_a_document_linked_only_by_its_deed(env, store):
    from app.models.deed import Deed

    land, pk = _land(env)
    adm = _h(env, "ADMIN")
    doc = _doc(env, adm, "d.png")
    with _db(env) as s:
        deed = s.scalars(select(Deed).where(Deed.land_id == pk)).first()
        if deed is None:
            pytest.skip("seed has no deed on the first land")
        deed.document_id = doc
        s.commit()
    assert doc in [i["id"] for i in _land_docs(env, adm, land).json()["items"]]


def test_land_documents_show_the_approved_record(env, jobs):
    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    with _db(env) as s:
        pk = s.get(Document, doc_id).land_id
        from app.models.land_parcel import LandParcel

        land = s.get(LandParcel, pk).land_id
    out = _land_docs(env, _h(env, "REVIEWER"), land).json()
    item = next(i for i in out["items"] if i["id"] == doc_id)
    assert (item["historical"], item["digitised"], item["approved_version"]) == (True, True, 1 + 1)
    rec = item["approved_record"]
    assert (rec["version"], rec["record_schema"], rec["approved_by"], rec["signature_status"]) == (2, "lhdr/1", "REVIEWER", "VALID")
    assert rec["approved_at"]


# ---- H7b: GET /documents/{id}/records/history ----------------------------------------------------


def _history(env, doc_id, role="REVIEWER", headers=None):
    return env.get(D.format(doc_id) + "/records/history", headers=headers or _h(env, role))


def test_history_roles_and_missing_document(env, jobs):
    doc_id = _historical(env, jobs)
    assert _history(env, doc_id, "CITIZEN").status_code == 403
    assert env.get(D.format(doc_id) + "/records/history").status_code == 401
    r = _history(env, "00000000-0000-0000-0000-000000000000", "ADMIN")
    assert r.status_code == 404 and r.json()["code"] == "DOCUMENT_NOT_FOUND"
    # the version route still takes numbers: "history" is not read as a version
    assert env.get(D.format(doc_id) + "/records/1", headers=_h(env, "REVIEWER")).status_code == 200


def test_history_shows_edits_per_version_through_a_correction(env, jobs):
    doc_id = _historical(env, jobs)
    rev, off = _h(env, "REVIEWER"), _h(env, "OFFICER")
    assert _rec(env, doc_id, [{"path": "/schedule/0/boundaries/north", "value": "করিমের জমি"}]).status_code == 200
    assert _rec(env, doc_id, [{"path": "/registration/office", "value": "রূপগঞ্জ সাব-রেজিস্ট্রি অফিস"}]).status_code == 200
    _approve_historical(env, doc_id)
    assert env.post(D.format(doc_id) + "/records", headers=rev).status_code == 201
    r = env.patch(D.format(doc_id) + "/records/3", headers=rev, json={"record": [{"path": "/schedule/0/boundaries/west", "value": "রহিম শেখের বাগান"}]})
    assert r.status_code == 200, r.text
    assert env.post(D.format(doc_id) + "/records/3/approve", headers=off).status_code == 200

    out = _history(env, doc_id).json()
    assert out["document_id"] == doc_id
    v1, v2, v3 = out["versions"]
    assert [(v["version"], v["status"]) for v in out["versions"]] == [(1, "MACHINE"), (2, "SUPERSEDED"), (3, "APPROVED")]
    assert [(e["kind"], e["actor"]) for e in v1["events"]] == [("CREATED", None)]  # the extraction job; never edited
    assert [e["kind"] for e in v2["events"]] == ["CREATED", "EDIT", "EDIT", "APPROVE"]
    assert v2["events"][0]["actor"] == {"name": "REVIEWER", "role": "REVIEWER"}
    e1, e2 = v2["events"][1], v2["events"][2]
    assert e1["changes"] == [{"path": "/schedule/0/boundaries/north", "op": "replace", "old": "আব্দুল করিমের জমি", "new": "করিমের জমি"}]
    assert [c["path"] for c in e2["changes"]] == ["/registration/office"]
    assert v2["events"][3]["actor"]["name"] == "REVIEWER" and v2["events"][3]["changes"] == []
    assert [e["kind"] for e in v3["events"]] == ["CREATED", "CORRECTION_START", "EDIT", "APPROVE"]
    assert [c["path"] for c in v3["events"][2]["changes"]] == ["/schedule/0/boundaries/west"]
    assert v3["events"][3]["actor"] == {"name": "OFFICER", "role": "OFFICER"}
    for v in out["versions"]:  # oldest first inside a version
        assert [e["at"] for e in v["events"]] == sorted(e["at"] for e in v["events"])
    # one version's edits never show up under another
    assert all(c["path"] != "/schedule/0/boundaries/west" for e in v2["events"] for c in e["changes"])


def test_history_flat_field_edits_of_a_document_without_a_record(env, jobs):
    from tests.test_extraction import _patch, _ready

    doc_id = _ready(env)
    assert _patch(env, doc_id, {"buyer": "Hasan Ali"}).status_code == 200
    out = _history(env, doc_id).json()
    edits = [e for v in out["versions"] for e in v["events"] if e["kind"] == "EDIT"]
    assert len(edits) == 1 and edits[0]["actor"]["role"] in ("REVIEWER", "OFFICER", "ADMIN")
    (c,) = edits[0]["changes"]
    assert c["path"] == "buyer" and c["op"] is None and c["new"] == "Hasan Ali" and c["old"]
    assert edits[0] in out["versions"][-1]["events"]  # the DRAFT the edit opened


def test_history_values_are_shortened(env, jobs):
    from app.services.records import SHOWN, _changes

    long = "ক" * 500
    (c,) = _changes({"record": [{"op": "replace", "path": "/a", "old": long}]}, {"record": [{"op": "replace", "path": "/a", "new": {"x": [1, 2]}}]})
    assert len(c.old) == SHOWN and c.old.endswith("\u2026") and c.new == '{"x": [1, 2]}'
    assert _changes(None, None) == []


def test_history_is_scoped_like_the_other_record_routes(env, jobs):
    doc_id = _historical(env, jobs)
    other, _ = _approved_officer(env, "o@office.test", **RUPGANJ)
    with _db(env) as s:
        s.get(Document, doc_id).office_id = _office(env, **SAVAR)
        s.commit()
    r = _history(env, doc_id, headers=other)
    assert r.status_code == 404 and r.json()["code"] == "DOCUMENT_NOT_FOUND"
