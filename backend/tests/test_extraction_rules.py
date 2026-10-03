# ruff: noqa: E501
import json
from pathlib import Path

import pytest
from ai.extraction.base import EXTRACTION_FIELDS
from ai.extraction.rules import RuleBasedDocumentAIProvider
from ai.ocr.base import OCRResult, OCRWord

from app.core.config import Settings
from app.services.providers import get_providers

ROOT = Path(__file__).resolve().parents[2]
RULES = RuleBasedDocumentAIProvider()


def _run(text, conf=0.9, words=()):
    res = RULES.extract(b"", OCRResult(text=text, confidence=conf, provider="t", words=tuple(words)))
    return {f.field: f for f in res.fields}


def _vals(text, **kw):
    return {k: f.value for k, f in _run(text, **kw).items()}


def test_all_13_fields_labelled_en():
    text = "\n".join(
        [
            "Owner name: Rahim Uddin", "Father's name: Abdul Jabbar", "Khatian No: 1245", "Dag No: 785",
            "Mouza: Barmi", "District: Gazipur", "Upazila: Sreepur", "Area: 10", "Unit: decimal",
            "Deed No: D-2024-0785", "Date: 12/02/2024", "Seller: Rahim Uddin", "Buyer: Karim Mia",
        ]
    )  # fmt: skip
    v = _vals(text)
    assert list(v) == list(EXTRACTION_FIELDS)
    assert v == {
        "owner_name": "Rahim Uddin", "father_name": "Abdul Jabbar", "khatian_no": "1245", "dag_no": "785",
        "mouza": "Barmi", "district": "Gazipur", "upazila": "Sreepur", "land_area": "10",
        "area_unit": "decimal", "deed_no": "D-2024-0785", "deed_date": "2024-02-12",
        "seller": "Rahim Uddin", "buyer": "Karim Mia",
    }  # fmt: skip


def test_bangla_labels_and_digits():
    text = "\n".join(
        [
            "মালিকের নাম: রহিম উদ্দিন", "পিতার নাম: আব্দুল জব্বার", "খতিয়ান নং: ১২৪৫", "দাগ নং: ৭৮৫",
            "মৌজা: বারমী", "জেলা: গাজীপুর", "উপজেলা: শ্রীপুর", "জমির পরিমাণ: ১০.৫", "একক: শতাংশ",
            "দলিল নং: ডি-২০২৪-০৭৮৫", "তারিখ: ১২-০২-২০২৪", "বিক্রেতা: রহিম", "ক্রেতা: করিম",
        ]
    )  # fmt: skip
    v = _vals(text)
    assert v["khatian_no"] == "1245" and v["dag_no"] == "785" and v["land_area"] == "10.5"
    assert v["deed_no"] == "ডি-2024-0785" and v["deed_date"] == "2024-02-12"
    assert v["area_unit"] == "decimal"
    # label substrings must not collide: জেলা inside উপজেলা, ক্রেতা inside বিক্রেতা
    assert v["district"] == "গাজীপুর" and v["upazila"] == "শ্রীপুর"
    assert v["seller"] == "রহিম" and v["buyer"] == "করিম"


def test_bilingual_label_and_signature_line_ignored():
    v = _vals("Seller / বিক্রেতা: Rubina Khatun\nBuyer signature: ________\nSeller signature: ________")
    assert v["seller"] == "Rubina Khatun" and v["buyer"] is None


@pytest.mark.parametrize(
    ("written", "canonical"),
    [("decimal", "decimal"), ("শতাংশ", "decimal"), ("কাঠা", "katha"), ("বিঘা", "bigha"),
     ("Acre", "acre"), ("একর", "acre"), ("sqft", "sqft")],
)  # fmt: skip
def test_area_unit_synonyms_are_names_not_conversions(written, canonical):
    v = _vals(f"Area: 12\nUnit: {written}")
    assert v["land_area"] == "12" and v["area_unit"] == canonical  # number never converted


def test_inline_prose_and_unit_next_to_area():
    v = _vals(
        "Deed of Sale. Deed No D-2024-0785. Date 2024-02-12. District Gazipur, Upazila Sreepur, "
        "Mouza Barmi. Khatian 1245, Dag 785. Area 10 decimal. Seller Rahim Uddin. Buyer Karim Mia."
    )
    assert v["land_area"] == "10" and v["area_unit"] == "decimal"
    assert v["seller"] == "Rahim Uddin" and v["buyer"] == "Karim Mia" and v["deed_no"] == "D-2024-0785"
    assert v["owner_name"] is None and v["father_name"] is None


def test_unknown_is_null_never_guessed():
    f = _run("random text with no labels at all 12345")
    assert all(x.value is None and x.confidence == 0.0 and x.source_bbox is None for x in f.values())
    f = _run("Khatian: abc\nDate: 31/02/2024\nUnit: furlong\nArea: many")
    assert f["khatian_no"].value is None and f["area_unit"].value is None and f["land_area"].value is None
    assert f["deed_date"].value == "31/02/2024"  # invalid date kept as written, lower strength
    assert f["deed_date"].confidence < 0.9 * 0.7


def test_confidence_is_word_conf_times_strength_and_bbox_from_words():
    words = [
        OCRWord("Seller:", 0.99, (10, 10, 60, 20)),
        OCRWord("Rubina", 0.80, (100, 10, 50, 20)),
        OCRWord("Khatun", 0.60, (160, 12, 50, 18)),
    ]
    f = _run("Seller: Rubina Khatun", conf=0.5, words=words)["seller"]
    assert f.confidence == pytest.approx(0.70 * 0.95, abs=1e-4)  # mean(0.8, 0.6) x colon text
    assert f.source_bbox == [100.0, 10.0, 110.0, 20.0]
    g = _run("Seller: Rubina Khatun", conf=0.5)["seller"]  # no word boxes -> OCR-level conf
    assert g.confidence == pytest.approx(0.5 * 0.95) and g.source_bbox is None


def test_duplicate_value_picks_run_after_its_label():
    words = [
        OCRWord("Khatian:", 0.9, (10, 10, 40, 10)), OCRWord("77", 0.9, (60, 10, 10, 10)),
        OCRWord("Dag:", 0.9, (10, 40, 40, 10)), OCRWord("77", 0.5, (60, 40, 10, 10)),
    ]  # fmt: skip
    f = _run("Khatian: 77\nDag: 77", words=words)
    assert f["khatian_no"].source_bbox[1] == 10.0 and f["dag_no"].source_bbox[1] == 40.0
    assert f["dag_no"].confidence < f["khatian_no"].confidence


def test_ground_truth_text_all_eval_docs():
    pytest.importorskip("PIL")
    from ai.evaluation.make_synthetic import BN_DIGITS, FIELD_ORDER, LABELS, NUMERIC

    gt = json.loads((ROOT / "ai/evaluation/data/ground_truth.json").read_text(encoding="utf-8"))
    assert len(gt["documents"]) == 20
    for doc in gt["documents"]:
        mode, bn = doc["variant"]["label_mode"], doc["variant"]["bn_digits"]
        lines = []
        for f in FIELD_ORDER:
            en, bn_label = LABELS[f]
            label = {"en": en, "bn": bn_label}.get(mode, f"{en} / {bn_label}")
            shown = doc["fields"][f]
            lines.append(f"{label}: {shown.translate(BN_DIGITS) if bn and f in NUMERIC else shown}")
        lines += ["Seller signature: ________    Buyer signature: ________"]
        got = _vals("\n".join(lines))
        for f, want in doc["fields"].items():
            assert got[f] == want, (doc["file"], f, got[f], want)
        assert got["owner_name"] is None  # generator renders no owner label -> never invented


def test_provider_selected_by_env_and_vlm_still_unavailable():
    p = get_providers(Settings(_env_file=None, document_ai_provider=" Rules "))
    assert p.ai.name == "rules"
    assert p.ai.extract(b"", OCRResult("Khatian: 5", 0.9, "t")).provider == "rules"


def test_garbled_bilingual_partner_label_does_not_break_value():
    # eng-only Tesseract garbles the Bangla half of "Deed No / <bn>:"; the value must survive
    v = _vals("Deed No / «feat as: D-2024-0101\nKhatian / afoata: 501\nSeller / ror: Jamal Hossain")
    assert v["deed_no"] == "D-2024-0101" and v["khatian_no"] == "501" and v["seller"] == "Jamal Hossain"
    assert _vals("Buyer / Got Hasan Ali")["buyer"] is None  # no colon + junk partner: not guessed
