# ruff: noqa: E501, F811
"""F5a: khatian / porcha parser. Nothing is guessed: missing or ambiguous -> absent."""
from pathlib import Path

import pytest
from ai.extraction import khatian, saf_kabala
from ai.extraction.base import EXTRACTION_FIELDS
from ai.extraction.rules import RuleBasedDocumentAIProvider
from ai.ocr.base import OCRResult

from tests.test_documents import _files, store  # noqa: F401
from tests.test_lands import env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401

D = Path(__file__).parent / "data"
RS = (D / "khatian_rs_ocr.txt").read_text(encoding="utf-8")
BS = (D / "porcha_bs_ocr.txt").read_text(encoding="utf-8")
SAF = (D / "saf_kabala_ocr.txt").read_text(encoding="utf-8")
DEED = "Deed of Sale. Deed No D-2024-0785. Date 2024-02-12. District Gazipur, Upazila Sreepur, Mouza Barmi. Khatian 1245, Dag 785. Area 10 decimal. Seller Rahim Uddin. Buyer Karim Mia."


def test_detects_khatian_and_not_other_documents():
    assert khatian.looks_like(RS) and khatian.looks_like(BS)
    assert not khatian.looks_like(SAF) and not khatian.looks_like(DEED)
    assert not khatian.looks_like("Khatian No: 12  Dag No: 5")  # no owner / share section
    assert not saf_kabala.looks_like(RS)


@pytest.mark.parametrize(
    ("line", "want"),
    [("জরিপ: আর.এস", "RS"), ("জরিপ: সি.এস", "CS"), ("জরিপ: এস.এ", "SA"), ("Survey: BS", "BS"),
     ("জরিপ: বি.এস (বাংলাদেশ সার্ভে)", "BS"), ("জরিপ: সি.এস/এস.এ", None), ("জরিপ: অজানা", None), ("কোনো জরিপ নেই", None)],
)
def test_survey_type_only_when_unambiguous(line, want):
    assert khatian.survey_type(line) == want


def test_multi_owner_khatian_keeps_lists_and_leaves_single_fields_empty():
    hits = khatian.parse(RS)
    assert hits["khatian_no"][0] == "1245"
    assert (hits["district"][0], hits["upazila"][0], hits["mouza"][0]) == ("গাজীপুর", "শ্রীপুর", "বারমী")
    # two owners and two dags: the single-valued R4 fields stay empty (the reviewer picks)
    assert not {"owner_name", "father_name", "dag_no", "land_area", "area_unit"} & set(hits)
    x = khatian.extras(RS)
    assert x["survey_type"] == "RS" and x["jl_no"] == "42" and x["shares_complete"] is True
    assert x["owners"] == [
        {"name": "করিম মিয়া", "father": "নূর মোহাম্মদ", "share": "1/2"},
        {"name": "হাসান আলী", "father": "মোঃ ইদ্রিস", "share": "1/2"},
    ]
    assert x["dags"] == [
        {"dag_no": "785", "area": "10", "unit": "decimal"},
        {"dag_no": "786", "area": "5.5", "unit": "decimal"},
    ]


def test_single_owner_single_dag_fills_the_r4_fields():
    hits = khatian.parse(BS)
    assert {k: v[0] for k, v in hits.items()} == {
        "khatian_no": "610", "district": "ঢাকা", "upazila": "সাভার", "mouza": "আশুলিয়া",
        "owner_name": "জামাল হোসেন", "father_name": "সিরাজুল ইসলাম",
        "dag_no": "210", "land_area": "12", "area_unit": "decimal",
    }
    x = khatian.extras(BS)
    assert x["survey_type"] == "BS" and x["shares_complete"] is True and x["owners"][0]["share"] == "1"


def test_shares_that_do_not_add_up_or_cannot_be_read():
    bad = RS.replace("অংশ: ১/২\nদ", "অংশ: ১/৪\nদ")
    assert khatian.extras(bad)["shares_complete"] is False
    unread = RS.replace("অংশ: ১/২", "অংশ: আধা")
    x = khatian.extras(unread)
    assert x["shares_complete"] is None and [o["share"] for o in x["owners"]] == [None, None]
    assert [o["name"] for o in x["owners"]] == ["করিম মিয়া", "হাসান আলী"]


def test_missing_parts_are_absent_not_guessed():
    no_survey = "\n".join(line for line in BS.splitlines() if "জরিপ" not in line)
    assert khatian.extras(no_survey)["survey_type"] is None
    no_khatian_no = "\n".join(line for line in BS.splitlines() if "খতিয়ান নং" not in line)
    assert "khatian_no" not in khatian.parse(no_khatian_no)
    assert khatian.extras(no_khatian_no)["jl_no"] == "17"
    assert khatian.extras("খতিয়ান পর্চা মালিক অংশ দাগ নং")["owners"] == []


def test_english_labels_and_bangla_digits():
    en = "Khatian / Porcha\nSurvey: RS\nDistrict: Gazipur\nUpazila: Sreepur\nMouza: Barmi, JL No 42\nKhatian No: 1245\nOwners and share:\n1. Karim Mia, Father: Nur Mohammad, Share: 1/2\n2. Hasan Ali, Father: Md. Idris, Share: 0.5\nDag No: 785, Area: 10 decimal"
    assert khatian.looks_like(en)
    x = khatian.extras(en)
    assert x["survey_type"] == "RS" and x["jl_no"] == "42" and x["shares_complete"] is True
    assert x["dags"] == [{"dag_no": "785", "area": "10", "unit": "decimal"}]
    assert khatian.parse(en)["dag_no"][0] == "785"


def test_provider_routes_by_text_and_returns_extras():
    prov = RuleBasedDocumentAIProvider()
    res = prov.extract(b"", OCRResult(text=RS, confidence=0.9, provider="mock"))
    by = {f.field: f for f in res.fields}
    assert [f.field for f in res.fields] == list(EXTRACTION_FIELDS)
    assert by["khatian_no"].value == "1245" and by["owner_name"].value is None and by["owner_name"].confidence == 0.0
    assert 0 < by["khatian_no"].confidence <= 0.9
    assert res.extras["survey_type"] == "RS" and len(res.extras["owners"]) == 2
    # a deed and a saf kabala still take their own paths and carry no extras
    assert prov.extract(b"", OCRResult(text=DEED, confidence=0.9, provider="mock")).extras == {}
    assert prov.extract(b"", OCRResult(text=SAF, confidence=0.9, provider="mock")).extras == {}


def test_sample_images_carry_markers_and_mock_ground_truth():
    from ai.mock_fixtures import find_fixture

    root = Path(__file__).resolve().parents[2] / "database" / "sample_data"
    rs = find_fixture((root / "Khatian_RS.png").read_bytes())
    bs = find_fixture((root / "Porcha_BS.png").read_bytes())
    assert rs and bs
    assert rs["extras"]["survey_type"] == "RS" and len(rs["extras"]["owners"]) == 2
    assert bs["extras"]["survey_type"] == "BS" and bs["fields"]["dag_no"][0] == "210"
    # the stored ground truth is exactly what the parser reads from the stored OCR text
    assert rs["extras"] == khatian.extras(rs["ocr_text"]) and bs["extras"] == khatian.extras(bs["ocr_text"])
    assert {f: v[0] for f, v in bs["fields"].items()} == {f: v[0] for f, v in khatian.parse(bs["ocr_text"]).items()}


def test_upload_khatian_sample_stores_survey_type_and_lists(env, jobs):
    """Mock OCR + mock Document AI over the real API: extras reach documents.extraction_json."""
    from tests.test_documents import _db, _up
    from tests.test_lands import _h
    from tests.test_processing import _process

    root = Path(__file__).resolve().parents[2] / "database" / "sample_data"
    r = _up(env, "Khatian_RS.png", (root / "Khatian_RS.png").read_bytes(), "OFFICER", land_id="LP-10234", document_type="KHATIAN")
    assert r.status_code == 201, r.text
    doc_id = r.json()["id"]
    assert _process(env, doc_id).status_code == 202
    from app.models.document import Document

    with _db(env) as s:
        stored = s.get(Document, doc_id).extraction_json
    assert stored["survey_type"] == "RS"
    assert stored["extras"]["jl_no"] == "42" and stored["extras"]["shares_complete"] is True
    assert [d["dag_no"] for d in stored["extras"]["dags"]] == ["785", "786"]
    by = {f["field"]: f for f in stored["fields"]}
    assert by["khatian_no"]["value"] == "1245" and by["owner_name"]["value"] is None
    # the review API still serves the 13 fields, with no extras leak into the field list
    got = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "REVIEWER"))
    assert got.status_code == 200 and len(got.json()["fields"]) == 13


def _survey_doc(env, name, doc_type, land_id=None):
    from tests.test_documents import _up
    from tests.test_processing import _process

    root = Path(__file__).resolve().parents[2] / "database" / "sample_data"
    kw = {"land_id": land_id} if land_id else {}
    r = _up(env, name, (root / name).read_bytes(), "OFFICER", document_type=doc_type, **kw)
    assert r.status_code == 201, r.text
    assert _process(env, r.json()["id"]).status_code == 202
    return r.json()["id"]


def test_khatian_can_be_approved_without_deed_fields_and_is_archived_not_posted(env, jobs):
    """A survey record needs khatian/mouza/district/upazila + survey type, not seller/buyer/area."""
    from sqlalchemy import func, select

    from app.models.deed import Deed
    from app.models.ledger import LedgerEntry
    from app.models.transaction import Transaction
    from tests.test_documents import _db
    from tests.test_lands import _h

    doc_id = _survey_doc(env, "Khatian_RS.png", "KHATIAN")
    ex = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "REVIEWER")).json()
    assert ex["validation"]["valid"] is True, ex["validation"]  # no deed-only REQUIRED errors
    with _db(env) as s:
        before = [s.scalar(select(func.count()).select_from(m)) for m in (Deed, Transaction, LedgerEntry)]
    r = env.post(f"/api/v1/documents/{doc_id}/approve", headers=_h(env, "REVIEWER"))
    assert r.status_code == 200 and r.json()["processing_status"] == "APPROVED"
    with _db(env) as s:  # nothing was posted to ownership / ledger
        after = [s.scalar(select(func.count()).select_from(m)) for m in (Deed, Transaction, LedgerEntry)]
    assert after == before
    hits = env.get("/api/v1/archive/search", params={"q": "খতিয়ান", "survey": "RS"}, headers=_h(env, "REVIEWER")).json()
    assert hits["total"] >= 1 and hits["items"][0]["survey_type"] == "RS"
    again = env.post(f"/api/v1/documents/{doc_id}/approve", headers=_h(env, "REVIEWER"))
    assert again.status_code == 409


def test_porcha_is_approvable_and_deeds_still_need_every_deed_field(env, jobs):
    from tests.test_lands import _h

    porcha = _survey_doc(env, "Porcha_BS.png", "PORCHA")
    assert env.post(f"/api/v1/documents/{porcha}/approve", headers=_h(env, "REVIEWER")).status_code == 200
    # the same Khatian image uploaded as a DEED keeps the strict deed validation
    deed = _survey_doc(env, "Khatian_RS.png", "DEED")
    ex = env.get(f"/api/v1/documents/{deed}/extraction", headers=_h(env, "REVIEWER")).json()
    assert ex["validation"]["valid"] is False
    r = env.post(f"/api/v1/documents/{deed}/approve", headers=_h(env, "REVIEWER"))
    assert r.status_code == 422 and r.json()["code"] == "EXTRACTION_INVALID"


def test_survey_doc_missing_its_identifiers_cannot_be_approved(env, jobs):
    from tests.test_extraction import _patch
    from tests.test_lands import _h

    doc_id = _survey_doc(env, "Khatian_RS.png", "KHATIAN")
    assert _patch(env, doc_id, {"mouza": None}).status_code == 200
    r = env.post(f"/api/v1/documents/{doc_id}/approve", headers=_h(env, "REVIEWER"))
    assert r.status_code == 422 and {"field": "mouza", "code": "REQUIRED"} in r.json()["details"]
