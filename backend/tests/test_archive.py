# ruff: noqa: E501, F811
"""F5c: archive search (FTS5) + SURVEY_CHAIN_GAP rule."""

from datetime import date

import pytest
from sqlalchemy import select, text

from app.models.document import Document
from app.models.land_parcel import LandParcel
from app.risk.context import LandContext, OwnerRef, SurveyRecord, TxRecord, load_land_context
from app.risk.rules import run_rules, survey_chain
from tests.test_documents import _db
from tests.test_lands import _h, env  # noqa: F401

URL = "/api/v1/archive/search"
BN_RS = "খতিয়ান জরিপ আর.এস মৌজা বারমী মালিক করিম মিয়া দাগ ৭৮৫"
BN_CS = "খতিয়ান জরিপ সি.এস মৌজা বারমী মালিক রহিম উদ্দিন দাগ ৭৮৫"


def _doc(land_id, text, survey, status="APPROVED", district="Gazipur", h="h1", names=()):
    return Document(
        land_id=land_id, document_type="KHATIAN", file_path="x", file_hash=h, ocr_text=text,
        processing_status=status,
        extraction_json={
            "fields": [
                {"field": "district", "value": district, "confidence": 0.9},
                {"field": "khatian_no", "value": "1245", "confidence": 0.9},
            ],
            "survey_type": survey,
            "extras": {"owners": [{"name": n, "share": None} for n in names]},
        },
    )  # fmt: skip


@pytest.fixture
def seeded(env):
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
        s.add_all(
            [
                _doc(land.id, BN_RS, "RS", h="a"),
                _doc(land.id, BN_CS, "CS", h="b", district="Dhaka"),
                _doc(None, "Pending khatian jorip BS karim", "BS", status="REVIEW_REQUIRED", h="c"),
            ]
        )
        s.commit()
    return env


def test_search_finds_bangla_and_english_and_only_approved(seeded):
    h = _h(seeded, "REVIEWER")
    r = seeded.get(URL, params={"q": "বারমী"}, headers=h)
    assert r.status_code == 200 and r.json()["total"] == 2
    assert {i["survey_type"] for i in r.json()["items"]} == {"RS", "CS"}
    assert all("[" in i["snippet"] and i["land_id"] == "LP-10100" for i in r.json()["items"])
    assert seeded.get(URL, params={"q": "karim"}, headers=h).json()["total"] == 0  # not approved


def test_filters_survey_and_district(seeded):
    h = _h(seeded, "OFFICER")
    rs = seeded.get(URL, params={"q": "বারমী", "survey": "RS"}, headers=h).json()
    assert [i["survey_type"] for i in rs["items"]] == ["RS"]
    dh = seeded.get(URL, params={"q": "বারমী", "district": "dhaka"}, headers=h).json()
    assert [i["survey_type"] for i in dh["items"]] == ["CS"] and dh["items"][0][
        "district"
    ] == "Dhaka"
    assert seeded.get(URL, params={"q": "x", "survey": "ZZ"}, headers=h).status_code == 422


def test_query_is_sanitised_and_paged(seeded):
    h = _h(seeded, "ADMIN")
    for q in ['"', "AND OR NOT", "বারমী*", 'a" OR "b', "NEAR(", "-"]:
        assert seeded.get(URL, params={"q": q}, headers=h).status_code in (200, 422), q
    assert seeded.get(URL, params={"q": "   "}, headers=h).status_code == 422
    p = seeded.get(URL, params={"q": "বারমী", "limit": 1, "offset": 1}, headers=h).json()
    assert p["total"] == 2 and len(p["items"]) == 1


def test_index_follows_changes(seeded):
    h = _h(seeded, "REVIEWER")
    assert seeded.get(URL, params={"q": "pending"}, headers=h).json()["total"] == 0
    with _db(seeded) as s:
        d = s.scalar(select(Document).where(Document.file_hash == "c"))
        d.processing_status = "APPROVED"
        s.commit()
    assert seeded.get(URL, params={"q": "pending"}, headers=h).json()["total"] == 1


def test_citizen_and_anonymous_are_refused(seeded):
    assert seeded.get(URL, params={"q": "x"}).status_code == 401
    r = seeded.get(URL, params={"q": "x"}, headers=_h(seeded, "CITIZEN"))
    assert r.status_code == 403


# ---------------------------------------------------------------- SURVEY_CHAIN_GAP


def _ctx(records, txs=(), owners=None):
    return LandContext(
        "LP-X", 10.0, "decimal", survey_records=tuple(records), transactions=tuple(txs),
        owners=owners or {}, as_of=date(2000, 1, 1),
    )  # fmt: skip


def test_gap_when_later_owner_has_no_link():
    ev = survey_chain.evaluate(
        _ctx([SurveyRecord("d1", "CS", ("Rahim Uddin",)), SurveyRecord("d2", "RS", ("Karim Mia",))])
    )
    (e,) = ev
    assert (e.code, e.severity) == ("SURVEY_CHAIN_GAP", "MEDIUM")
    assert e.params["from_survey"] == "CS" and e.params["to_survey"] == "RS"
    assert e.params["unlinked_owners"] == 1 and "Karim" not in str(e.to_dict())


def test_no_gap_when_same_person_or_variant():
    recs = [
        SurveyRecord("d1", "SA", ("Rahim Uddin",)),
        SurveyRecord("d2", "RS", ("Md. Rahim Uddin",)),
    ]
    assert survey_chain.evaluate(_ctx(recs)) == []


def test_no_gap_when_transfers_link_through_two_hops():
    owners = {"a": OwnerRef("Rahim Uddin"), "b": OwnerRef("Salam Mia"), "c": OwnerRef("Karim Mia")}
    txs = [
        TxRecord("t1", "a", "b", date(2000, 1, 1), 10.0, "decimal"),
        TxRecord("t2", "b", "c", date(2005, 1, 1), 10.0, "decimal"),
    ]
    recs = [SurveyRecord("d1", "CS", ("Rahim Uddin",)), SurveyRecord("d2", "BS", ("Karim Mia",))]
    assert survey_chain.evaluate(_ctx(recs, txs, owners)) == []


def test_single_survey_or_unordered_inputs():
    assert survey_chain.evaluate(_ctx([SurveyRecord("d1", "RS", ("A B",))])) == []
    recs = [SurveyRecord("d2", "BS", ("Karim Mia",)), SurveyRecord("d1", "CS", ("Rahim Uddin",))]
    assert survey_chain.evaluate(_ctx(recs))[0].params["from_survey"] == "CS"


def test_loader_reads_only_approved_khatians_and_rule_runs(env):
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
        s.add_all(
            [
                _doc(land.id, "x", "CS", h="1", names=("Qwerty Zxcvb",)),
                _doc(land.id, "y", "RS", h="2", names=("Plokij Mnbvc",)),
                _doc(land.id, "z", "BS", status="REVIEW_REQUIRED", h="3", names=("Zed",)),
            ]
        )
        s.commit()
        ctx = load_land_context(s, land)
        assert [r.survey_type for r in ctx.survey_records] == ["CS", "RS"]
        assert "SURVEY_CHAIN_GAP" in [e.code for e in run_rules(ctx)]


# ---------------------------------------------------------------- H9e: LHDR fields + year range

from app.services import archive as archive_svc  # noqa: E402
from tests.test_documents import png, store  # noqa: E402,F401
from tests.test_processing import jobs  # noqa: E402,F401
from tests.test_records import _approve_historical, _historical  # noqa: E402,F401


def _approved_sample(env, jobs):
    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    return doc_id


def test_sample_deed_is_found_by_party_mouza_and_years(env, jobs):
    doc_id = _approved_sample(env, jobs)
    h = _h(env, "REVIEWER")
    for q in ("রামকান্ত", "ভবানীপুর", "কফিল", "সমসের"):  # buyer, mouza, seller, seller's father
        r = env.get(URL, params={"q": q, "year_from": 1940, "year_to": 1950}, headers=h).json()
        assert [i["document_id"] for i in r["items"]] == [doc_id], q
    hit = r["items"][0]
    assert (hit["year_from"], hit["year_to"], hit["historical"]) == (1944, 1944, True)
    assert hit["mouza"] == "ভবানীপুর"  # from the record; no parcel is linked to it


def test_dag_and_khatian_match_in_both_digit_scripts(env, jobs):
    doc_id = _approved_sample(env, jobs)
    h = _h(env, "OFFICER")
    for q in ("455", "৪৫৫", "120", "১২০"):
        r = env.get(URL, params={"q": q}, headers=h).json()
        assert doc_id in [i["document_id"] for i in r["items"]], q


def test_year_range_overlaps_and_excludes_other_years(env, jobs):
    _approved_sample(env, jobs)
    h = _h(env, "REVIEWER")
    q = {"q": "রামকান্ত"}
    assert env.get(URL, params={**q, "year_from": 1950, "year_to": 1960}, headers=h).json()["total"] == 0
    assert env.get(URL, params={**q, "year_to": 1943}, headers=h).json()["total"] == 0
    assert env.get(URL, params={**q, "year_from": 1945}, headers=h).json()["total"] == 0
    assert env.get(URL, params={**q, "year_from": 1944, "year_to": 1944}, headers=h).json()["total"] == 1
    assert env.get(URL, params={**q, "year_to": 1950}, headers=h).json()["total"] == 1  # open start


def test_year_filter_drops_documents_without_a_year(seeded):
    h = _h(seeded, "REVIEWER")
    assert seeded.get(URL, params={"q": "বারমী"}, headers=h).json()["total"] == 2
    assert seeded.get(URL, params={"q": "বারমী", "year_from": 1900}, headers=h).json()["total"] == 0
    hit = seeded.get(URL, params={"q": "বারমী"}, headers=h).json()["items"][0]
    assert (hit["year_from"], hit["year_to"], hit["historical"]) == (None, None, False)


def test_bad_years_are_refused(seeded):
    h = _h(seeded, "REVIEWER")
    assert seeded.get(URL, params={"q": "x", "year_from": 1950, "year_to": 1940}, headers=h).status_code == 422
    assert seeded.get(URL, params={"q": "x", "year_from": 12}, headers=h).status_code == 422
    assert seeded.get(URL, params={"q": "x", "year_to": "abc"}, headers=h).status_code == 422


def test_same_answers_on_the_python_scan_used_for_office_scoped_users(env, jobs):
    doc_id = _approved_sample(env, jobs)
    with _db(env) as s:
        cond = Document.id.is_not(None)
        found = archive_svc.search(s, "রামকান্ত", None, None, 10, 0, cond, 1940, 1950)
        assert [i.document_id for i in found.items] == [doc_id]
        assert (found.items[0].year_from, found.items[0].historical) == (1944, True)
        assert archive_svc.search(s, "রামকান্ত", None, None, 10, 0, cond, 1950, 1960).total == 0
        assert archive_svc.search(s, "455", None, None, 10, 0, cond).total == 1


def test_signature_changes_with_the_approved_record_version(env, jobs):
    doc_id = _approved_sample(env, jobs)
    with _db(env) as s:
        rows, versions = archive_svc._approved(s)
        before = archive_svc._signature(rows, versions)
        versions[doc_id] += 1  # what an approved correction does
        assert archive_svc._signature(rows, versions) != before


def test_an_old_index_without_year_columns_is_upgraded(env, jobs):
    """SQLite: an FTS5 table from before H9e is rebuilt. Postgres: the missing columns are added
    (only then: the catalog is checked first, an ALTER TABLE on every search would lock it)."""
    doc_id = _approved_sample(env, jobs)
    h = _h(env, "REVIEWER")
    with _db(env) as s:
        pg = s.get_bind().dialect.name == "postgresql"
        if pg:
            assert env.get(URL, params={"q": "রামকান্ত"}, headers=h).status_code == 200  # builds it
            for col in ("year_from", "year_to", "historical"):
                s.execute(text(f"ALTER TABLE archive_index DROP COLUMN {col}"))
            s.execute(text("DELETE FROM archive_index"))  # force a rebuild into the new columns
        else:
            s.execute(text("DROP TABLE IF EXISTS archive_fts"))
            s.execute(text("CREATE VIRTUAL TABLE archive_fts USING fts5(doc_id, body)"))
        s.commit()
    r = env.get(URL, params={"q": "রামকান্ত", "year_from": 1940}, headers=h).json()
    assert [i["document_id"] for i in r["items"]] == [doc_id]
    if pg:
        with _db(env) as s:
            cols = set(s.scalars(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'archive_index'"
            )))  # fmt: skip
            assert {"year_from", "year_to", "historical"} <= cols


def test_modern_deeds_carry_their_deed_year(env):
    """A modern (core/1) deed has no LHDR record; its flat deed_date is its year, so a year filter
    keeps it instead of dropping every modern deed."""
    with _db(env) as s:
        for h, iso in (("m1", "2018-05-01"), ("m2", "১২/০৩/২০০৯")):
            doc = _doc(None, "দলিল মৌজা কাশিমপুর", None, h=h)
            doc.document_type = "DEED"
            doc.extraction_json["fields"].append({"field": "deed_date", "value": iso, "confidence": 0.9})
            s.add(doc)
        s.commit()
    h = _h(env, "REVIEWER")
    q = {"q": "কাশিমপুর"}
    r = env.get(URL, params={**q, "year_from": 2015, "year_to": 2020}, headers=h).json()
    assert r["total"] == 1 and (r["items"][0]["year_from"], r["items"][0]["year_to"]) == (2018, 2018)
    assert r["items"][0]["historical"] is False
    assert env.get(URL, params={**q, "year_to": 2010}, headers=h).json()["total"] == 1  # the 2009 deed
    with _db(env) as s:  # same answer on the office-scoped scan
        found = archive_svc.search(s, "কাশিমপুর", None, None, 10, 0, Document.id.is_not(None), 2015, 2020)
        assert [i.year_from for i in found.items] == [2018]


def test_a_search_on_an_unchanged_index_parses_no_record(env, jobs, monkeypatch):
    _approved_sample(env, jobs)
    h = _h(env, "REVIEWER")
    assert env.get(URL, params={"q": "রামকান্ত"}, headers=h).json()["total"] == 1  # builds the index
    calls = []
    real = archive_svc.lhdr.parse
    monkeypatch.setattr(archive_svc.lhdr, "parse", lambda *a, **k: calls.append(1) or real(*a, **k))
    for _ in range(3):
        assert env.get(URL, params={"q": "রামকান্ত"}, headers=h).json()["total"] == 1
    assert calls == []  # only the record versions are read to check the signature
