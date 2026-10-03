"""Bangla Saf-Kabala layout parser (OCR text of a real-layout sale deed, tests/data)."""
from pathlib import Path

from ai.extraction import saf_kabala
from ai.extraction.rules import RuleBasedDocumentAIProvider
from ai.ocr.base import OCRResult

TEXT = (Path(__file__).parent / "data" / "saf_kabala_ocr.txt").read_text(encoding="utf-8")


def test_detects_saf_kabala_and_not_plain_text():
    assert saf_kabala.looks_like(TEXT)
    assert not saf_kabala.looks_like("Deed of Sale. Deed No D-1. Seller A. Buyer B.")


def test_parses_all_thirteen_fields():
    got = {k: v[0] for k, v in saf_kabala.parse(TEXT).items()}
    assert got == {
        "deed_no": "4528/1978",
        "deed_date": "1978-10-27",
        "seller": "শ্রী রমেশ চন্দ্র সরকার",
        "owner_name": "শ্রী রমেশ চন্দ্র সরকার",
        "father_name": "গোপাল চন্দ্র সরকার",
        "buyer": "মোঃ আব্দুর রহমান",
        "upazila": "সাভার",
        "district": "ঢাকা",
        "khatian_no": "87",
        "dag_no": "452",
        "mouza": "বিরুলিয়া",
        "land_area": "25",
        "area_unit": "decimal",
    }


def test_provider_uses_the_parser_and_scales_confidence():
    ocr = OCRResult(text=TEXT, confidence=0.8, provider="t")
    r = RuleBasedDocumentAIProvider().extract(b"", ocr)
    by = {f.field: f for f in r.fields}
    assert by["khatian_no"].value == "87" and 0 < by["khatian_no"].confidence <= 0.8


def test_unknown_field_stays_empty_not_guessed():
    text = TEXT.replace("দলিল নম্বরঃ ৪৫২৮/১৯৭৮", "")
    assert "deed_no" not in saf_kabala.parse(text)
