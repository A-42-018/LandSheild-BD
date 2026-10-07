import unicodedata

from ai.extraction.rules import RuleBasedDocumentAIProvider
from ai.ocr import normalize
from ai.ocr.base import OCRResult


def test_number_converts_bangla_digits_and_separators():
    assert normalize.number("১০.৫০") == "10.50"
    assert normalize.number("১,২৩৪") == "1,234"
    assert normalize.number("১২৪৫") == "1245"
    assert normalize.number(None) == ""


def test_text_keeps_bangla_digits_in_names():
    # digits are converted by number() only; text() must not touch names
    assert normalize.text("মৌজা: বারমী ৪২") == "মৌজা: বারমী ৪২"


def test_text_nfc_and_zero_width_cleanup():
    decomposed = unicodedata.normalize("NFD", "é")
    assert normalize.text(decomposed) == "é"
    assert normalize.text("খত​িয়ান‌ নং﻿") == "খতিয়ান নং"
    assert normalize.text("a   b\t c\n\n  d ") == "a b c\n\nd"


def test_common_label_fixes():
    assert normalize.text("খতিয়ন নং: ১২") == "খতিয়ান নং: ১২"
    assert normalize.text("মোজা: বারমী") == "মৌজা: বারমী"
    assert normalize.text("দাগনং ৭৮৫") == "দাগ নং ৭৮৫"


def test_label_variants_extract_through_rules():
    text = (
        "খতিয়ান নাম্বার: ১২৪৫\nদাগ নাম্বার: ৭৮৫\nমৌজার নাম: বারমী\n"
        "জমির পরিমাণ: ১০ ডেসিমাল"
    )
    got = {
        f.field: f.value
        for f in RuleBasedDocumentAIProvider().extract(b"", OCRResult(text, 0.9, "x")).fields
    }
    assert got["khatian_no"] == "1245" and got["dag_no"] == "785"
    assert got["mouza"] == "বারমী" and got["land_area"] == "10" and got["area_unit"] == "decimal"


def test_unknown_stays_none():
    ocr = OCRResult("nothing useful here", 0.9, "tesseract")
    res = RuleBasedDocumentAIProvider().extract(b"", ocr)
    assert all(f.value is None and f.confidence == 0.0 for f in res.fields)
