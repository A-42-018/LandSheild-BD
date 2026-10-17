# ruff: noqa: E501
"""H3: deed profile classifier (modern | historical), deed kind, era, and its wiring into OCR + processing."""
import json
from dataclasses import replace
from datetime import date
from pathlib import Path

import ai.mock_fixtures as mf
import pytest
from ai.extraction.classify import DeedClass, classify, deed_kind, years
from ai.extraction.lhdr import DeedKind, Era
from ai.extraction.mock import MockDocumentAIProvider
from ai.ocr import tesseract as tess
from ai.ocr.base import OCRCell, OCRResult, OCRTable

from app.services import processing
from app.services.providers import Providers
from app.services.storage import LocalStorage
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import _row, _start, jobs  # noqa: F401

SAMPLES = Path(__file__).resolve().parents[2] / "database" / "sample_data"
HIST = SAMPLES / "historical"
DATA = Path(__file__).with_name("data")
MANIFEST = json.loads((HIST / "manifest.json").read_text(encoding="utf-8"))["files"]
needs_tesseract = pytest.mark.skipif(not tess.is_available(), reason="tesseract not installed")
TODAY = date(2026, 10, 18)

# the archaic-units deed as OCR reads it (shortened)
OLD = """দলিল নং:২৭৪১
তারিখ: ১০ই পৌষ, ১৩৩৮ বঙ্গাব্দ
সাফ কবলা দলিল
মিদং কার্যঞ্চাগে
১ম পক্ষ (দাতা/ বিক্রেতা): জনাব মনিরউদ্দিন আহম্মদ, সাং- বিটঘর, জাতীয়তা-জন্মসূত্রে ভারতীয়।
কস্য সাফ কবলা বিক্রীত দলিল মিদং কার্যঞ্চাগে। নগদ ৩৫০/- (তিনশত পঞ্চাশ) টাকা বুঝিয়া পাইয়া নিম্ন তপশিল বর্ণিত
পরগণা-সরাইল
সি.এস. খতিয়ান নং: ৬৪৭
দাগ নং: ৩২০৩
জমির পরিমাণ: ২ কানি ৫ গণ্ডা ৩ কড়া"""


def _codes(c: DeedClass) -> set[str]:
    return {s.code for s in c.signals}


# ---- years ---------------------------------------------------------------------------------------

def test_bangla_years_need_a_cue_and_convert_by_month():
    assert years("তারিখ: ১০ই পৌষ, ১৩৩৮ বঙ্গাব্দ", TODAY) == [1931]
    assert years("১৫ই ফাল্গুন, ১৩৫০", TODAY) == [1944]  # মাঘ-চৈত্র fall in the next Gregorian year
    assert years("ইতি সন ১৩৬২", TODAY) == [1955]
    assert years("১৩৪৫ সালের দলিল", TODAY) == [1938]


def test_gregorian_years_need_a_date_cue():
    assert years("Date / তারিখ: 2024-02-12", TODAY) == [2024]
    assert years("ইংরেজি তারিখ: ১৫ মার্চ ২০০১", TODAY) == [2001]
    assert years("২৮শে এপ্রিল, ১৯৫৫ খ্রিঃ", TODAY) == [1955]
    assert years("দলিল নম্বরঃ ১২৩৪/২০০১", TODAY) == [2001]
    assert years("১৯৬২ সালের ১২৩৪ নং দলিল", TODAY) == [1962]


def test_bare_numbers_and_future_years_are_not_years():
    assert years("দাগ নং: ১৯৫৮, খতিয়ান নং: ১৩৪৫, পণ ২০০০/- টাকা, দলিল নং ৪৭৮২/খ", TODAY) == []
    assert years("তারিখ: ১২ মার্চ ২০৩০", TODAY) == []


# ---- profile, score, era --------------------------------------------------------------------------

def test_archaic_deed_is_historical_with_every_cue():
    c = classify(OLD, today=TODAY)
    assert c.historical and c.score > 0.99 and c.year == 1931 and c.era == Era.BRITISH_INDIA
    assert c.deed_kind == DeedKind.SALE_SAF_KABALA
    assert {"FORMULA_KASYA", "FORMULA_MIDANG", "PARGANA", "ARCHAIC_UNIT", "TAPSHIL", "BANGLA_ERA",
            "CS_KHATIAN", "PRE_1971_YEAR", "BRITISH_INDIA", "SANG", "HONORIFIC", "DATA_GRAHITA"} <= _codes(c)


def test_without_a_readable_date_the_vocabulary_decides():
    c = classify(OLD.replace("১৩৩৮", "১৩?৮"), today=TODAY)
    assert c.historical and c.year is None and c.era == Era.BRITISH_INDIA


def test_modern_deed_with_old_fashioned_words_stays_modern():
    """The 2001 saf-kabala has শ্রী, সাং, দাতা/গ্রহীতা, তফসিল, সি.এস and a Bangla date: still modern."""
    c = classify((DATA / "saf_kabala_ocr.txt").read_text(encoding="utf-8"), today=TODAY)
    assert c.deed_profile == "modern" and c.year == 2001 and c.era == Era.BANGLADESH
    assert c.deed_kind == DeedKind.SALE_SAF_KABALA
    assert {"SANG", "HONORIFIC", "DATA_GRAHITA", "POST_1971_YEAR", "BANGLADESH"} <= _codes(c)


def test_modern_deed_reciting_an_old_deed_is_modern():
    text = ("এই জমি ১৯৬২ সালের ১২৩৪ নং সাফ কবলা দলিল মূলে প্রাপ্ত। দলিল নং ৫৬৭৮/২০১৫, তারিখ: ১২ মার্চ ২০১৫।"
            " জাতীয়তা: বাংলাদেশী, জাতীয় পরিচয়পত্র নং ১২৩৪৫৬৭৮৯০")
    c = classify(text, today=TODAY)
    assert c.deed_profile == "modern" and "MIXED_YEARS" in _codes(c) and c.year == 2015


def test_recent_copy_of_an_old_deed_is_historical_with_the_old_year():
    c = classify("সার্টিফাইড কপি, নকল প্রদানের তারিখ: ১০ জানুয়ারি ২০১৫\n" + OLD, today=TODAY)
    assert c.historical and "MIXED_YEARS" in _codes(c) and c.year == 1931


def test_pakistan_nationality_beats_a_misread_pre_1947_year():
    text = "তারিখ: ৫ই কার্তিক, ১৩৩৯ বঙ্গাব্দ। কস্য সাফ কবলা দলিল মিদং। জাতীয়তা- জন্মসূত্রে পাকিস্তানী। ২,৫০০/- রুপি"
    c = classify(text, today=TODAY)
    assert c.historical and c.year == 1932 and c.era == Era.EAST_BENGAL_PAKISTAN


def test_empty_and_unreadable_text_is_modern():
    for text in ("", "—_——_— জল এ\nআত এ উর"):
        c = classify(text, today=TODAY)
        assert c.deed_profile == "modern" and c.score < 0.5 and c.deed_kind == DeedKind.OTHER


def test_place_names_are_not_honorifics():
    assert "HONORIFIC" not in _codes(classify("উপজেলা: শ্রীপুর", today=TODAY))
    assert "HONORIFIC" in _codes(classify("শ্রী অনিল কুমার দাস", today=TODAY))


def test_table_cells_count():
    cell = OCRCell(row=1, col=0, text="২ কানি ৫ গণ্ডা", confidence=0.9, bbox=(0, 0, 1, 1))
    t = OCRTable(page=0, bbox=(0, 0, 1, 1), n_rows=2, n_cols=1, cells=(cell,))
    assert "ARCHAIC_UNIT" not in _codes(classify("মৌজা: বিটঘর", today=TODAY))
    assert "ARCHAIC_UNIT" in _codes(classify("মৌজা: বিটঘর", [t], today=TODAY))


@pytest.mark.parametrize(("text", "kind"), [
    ("রেহেন বন্ধকী দলিল\nকস্য রেহেন ... বিক্রয় করিতে পারিবেন না", DeedKind.MORTGAGE_REHEN),
    ("দানপত্র দলিল\nমূল্য বা পণ গ্রহণ ব্যতিরেকে দান করিলাম", DeedKind.GIFT_DANPATRA),
    ("হেবা বিল এওয়াজ দলিল", DeedKind.GIFT_HEBA),
    ("বণ্টননামা দলিল", DeedKind.PARTITION_BANTONNAMA),
    ("আমমোক্তারনামা", DeedKind.POWER_OF_ATTORNEY),
    ("সাফ কবলা দলিল। জমি কোথাও বন্ধক বা দায়বদ্ধ নহে। পূর্বে হেবা দলিল মূলে প্রাপ্ত", DeedKind.SALE_SAF_KABALA),
    ("Deed of Sale | বিক্রয় দলিল", DeedKind.SALE_SAF_KABALA),
    ("খতিয়ান / পর্চা (নমুনা)", DeedKind.OTHER),
])
def test_deed_kind_is_the_earliest_title(text, kind):
    assert deed_kind(text) == kind


def test_to_dict_is_json_ready():
    d = classify(OLD, today=TODAY).to_dict()
    assert json.loads(json.dumps(d, ensure_ascii=False)) == d
    assert d["deed_profile"] == "historical" and d["deed_kind"] == "SALE_SAF_KABALA" and d["era"] == "BRITISH_INDIA"
    assert {"code": "PARGANA", "weight": 2.0, "evidence": "পরগণা"} in d["signals"]


# ---- done criteria: H0 set historical, modern samples not -----------------------------------------

def test_demo_fixture_and_test_ocr_texts_are_modern():
    texts = {k: v.get("ocr_text", "") for k, v in mf.load_fixtures()["by_marker"].items()}
    texts |= {p.name: p.read_text(encoding="utf-8") for p in DATA.glob("*_ocr.txt")}
    assert len(texts) >= 14
    for name, text in texts.items():
        assert classify(text).deed_profile == "modern", name


@needs_tesseract
def test_every_historical_file_and_no_modern_sample_is_historical():
    """H3 done: every file of the H0 manifest is historical on its first (modern-profile) reading,
    with the manifest's deed kind; every modern sample in database/sample_data is not."""
    from ai.ocr.router import AutoOCRProvider

    ocr = AutoOCRProvider(demo_fixtures=False, profile="modern")
    for item in MANIFEST:
        p = HIST / item["file"]
        r = ocr.recognize(p.read_bytes(), p.suffix[1:])
        c = classify(r.text, r.tables)
        assert c.historical, (p.name, c.signals)
        assert c.deed_kind.value == item["kind"], p.name
        gold_era = json.loads((HIST / item["gold"]).read_text(encoding="utf-8"))["document"]["era"]
        assert c.era is None or c.era.value == gold_era, p.name
    for p in sorted(SAMPLES.glob("*.png")):
        r = ocr.recognize(p.read_bytes(), "png")
        assert classify(r.text, r.tables).deed_profile == "modern", p.name


# ---- OCR_PROFILE=auto ------------------------------------------------------------------------------

def _fake_read(monkeypatch, texts: dict[str, str]) -> list[str]:
    calls: list[str] = []

    def read(self, data, file_type, profile):
        calls.append(profile)
        return OCRResult(text=texts[profile], confidence=0.8, provider="tesseract", profile=profile)

    monkeypatch.setattr(tess.TesseractOCRProvider, "_recognize", read)
    return calls


def test_auto_profile_rereads_a_historical_deed(monkeypatch):
    calls = _fake_read(monkeypatch, {"modern": OLD, "historical": OLD + "\nশ্রেণী: নাল"})
    r = tess.TesseractOCRProvider(profile="auto").recognize(b"x", "png")
    assert calls == ["modern", "historical"]
    assert r.profile == "historical" and r.text.endswith("নাল") and "HISTORICAL_PROFILE" in r.warnings


def test_auto_profile_keeps_a_modern_reading(monkeypatch):
    calls = _fake_read(monkeypatch, {"modern": "Deed of Sale. Date 2024-02-12", "historical": "unused"})
    r = tess.TesseractOCRProvider(profile="auto").recognize(b"x", "png")
    assert calls == ["modern"] and r.profile == "modern" and not r.warnings


def test_fixed_profiles_read_once(monkeypatch):
    calls = _fake_read(monkeypatch, {"modern": OLD, "historical": OLD})
    tess.TesseractOCRProvider(profile="historical").recognize(b"x", "png")
    tess.TesseractOCRProvider(profile="modern").recognize(b"x", "png")
    assert calls == ["historical", "modern"]


def test_settings_default_profile_is_auto():
    from app.core.config import Settings
    from app.services.providers import get_providers

    assert Settings(_env_file=None).ocr_profile == "auto"
    assert get_providers(Settings(_env_file=None, ocr_provider="auto")).ocr.profile == "auto"


@needs_tesseract
def test_auto_profile_on_the_scanned_sample_deed():
    from ai.ocr.router import AutoOCRProvider

    data = (HIST / "Historical_Land_Deed_scan.jpg").read_bytes()
    r = AutoOCRProvider(demo_fixtures=False, profile="auto").recognize(data, "jpg")
    assert r.provider == "tesseract" and r.profile == "historical" and "HISTORICAL_PROFILE" in r.warnings
    assert classify(r.text, r.tables).historical


# ---- processing stores the verdict in extraction_json (D1: document_type stays DEED) --------------

class _TextOCR:
    name = "fake"

    def __init__(self, text: str) -> None:
        self.text = text

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        base = OCRResult(text=self.text, confidence=0.7, provider="tesseract")
        return replace(base, profile="historical", warnings=("HISTORICAL_PROFILE",))


def _run(env, jobs, store, text: str, **form) -> str:  # noqa: F811
    r = _up(env, "scan.png", png() + b"LSMOCK:Doc1", **form)
    assert r.status_code == 201
    doc_id = r.json()["id"]
    _start(env, doc_id)
    processing.run_processing(jobs, LocalStorage(store), Providers(_TextOCR(text), MockDocumentAIProvider()), doc_id)
    return doc_id


def test_processing_stores_historical_profile(env, jobs, store):  # noqa: F811
    doc_id = _run(env, jobs, store, OLD)
    row = _row(env, doc_id)
    assert row.document_type == "DEED" and row.processing_status == "REVIEW_REQUIRED"
    ex = row.extraction_json
    assert ex["deed_profile"] == "historical" and ex["ocr_profile"] == "historical"
    assert ex["deed_class"]["era"] == "BRITISH_INDIA" and ex["deed_class"]["year"] == 1931
    assert "HISTORICAL_PROFILE" in ex["warnings"]
    got = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "REVIEWER")).json()
    assert got["deed_profile"] == "historical" and got["deed_class"]["deed_kind"] == "SALE_SAF_KABALA"


def test_processing_stores_modern_profile(env, jobs, store):  # noqa: F811
    doc_id = _run(env, jobs, store, "Deed of Sale. Date 2024-02-12. Seller Rahim Uddin.")
    assert _row(env, doc_id).extraction_json["deed_profile"] == "modern"


def test_survey_records_are_not_classified(env, jobs, store):  # noqa: F811
    doc_id = _run(env, jobs, store, OLD, document_type="KHATIAN")
    ex = _row(env, doc_id).extraction_json
    assert ex["deed_profile"] is None and ex["deed_class"] is None
