"""H2: text-layer quality gate (pure functions, no OCR)."""
from pathlib import Path

import pytest
from ai.mock_fixtures import find_fixture
from ai.ocr.quality import (
    THRESHOLD,
    assess,
    bad_marks,
    better,
    dictionary,
    foreign_in_bangla,
    skeleton,
)

REPO = Path(__file__).resolve().parents[2]
SAMPLES = REPO / "database" / "sample_data"
HIST = SAMPLES / "historical"

CLEAN = (
    "১ম পক্ষ (দাতা / বিক্রেতা): জনাব কফিল উদ্দিন, পিতা- মৃত সমসের আলী, সাং- ভবানীপুর, থানা- রূপগঞ্জ, "
    "জেলা- ঢাকা, ধর্ম- ইসলাম, জাতীয়তা- জন্মসূত্রে বাঙ্গালী। বিক্রীত সম্পত্তির তপশিল, পশ্চিমে- রহিম সেখের জমি।"
)
# the same words as a Chrome-printed PDF's text layer gives them back
BROKEN = (
    "১ম পক্ষ (দাতা / বিেতা): জনাব কফিল উিন, পিতা- মৃত সমসের আলী, সাং- ভবানীপুর, থানা- রূপগঞ্জ, "
    "জেলা- ঢাকা, ধম- ইসলাম, জাতীয়তা- জন্মসূে বাঙ্গাালী। বিক্রীত সম্পির তপশিল, পিমে- রহিম সেখের জমি। িপসই"
)


def test_clean_bangla_passes():
    q = assess(CLEAN)
    assert q.ok and q.score == 1.0 and q.bad_marks == 0 and q.dict_misses == 0


def test_broken_layer_fails():
    q = assess(BROKEN)
    assert not q.ok and q.bad_marks >= 3 and q.dict_misses >= 3
    assert better(assess(CLEAN), q) and not better(q, assess(CLEAN))


@pytest.mark.parametrize(
    ("text", "bad"),
    [("বিক্রেতা", 0), ("বঙ্গাাব্দ", 1), ("িপসই", 1), ("বিেতা", 1), ("মোঃঃ", 1), ("নরসিংংপুর", 1),
     ("কোনো দাবি", 0), ("সংস্থা", 0), ("স্বত্ব", 0), ("ড়ি", 0), ("অংশ", 0)],
)  # fmt: skip
def test_bad_marks(text, bad):
    assert bad_marks(text) == bad


@pytest.mark.parametrize(
    ("word", "sk"),
    [("বিক্রেতা", "বিেতা"), ("পশ্চিম", "পিম"), ("ধর্ম", "ধম"), ("উদ্দিন", "উিন"), ("দক্ষিণ", "দিণ")],
)
def test_skeleton_is_the_damage_pattern(word, sk):
    # exactly what the broken sample layer shows: the conjunct (or reph) is dropped
    assert skeleton(word) == sk


def test_dictionary_does_not_confuse_real_words():
    # নিষ্কণ্টক -> নিক must not match নিকট; বঙ্গাব্দ -> বা (too short) must not match the word বা
    assert dictionary("আপনার নিকট হইতে বা তাহার") == (0, 0)


def test_english_and_junk():
    assert assess("Deed of sale. Khatian 1245 Dag 785 Mouza Barmi").ok
    assert not assess("Deed �� of � sale  khatian").ok
    assert assess("").score == 1.0  # nothing to judge; the router guards empty OCR itself


def test_every_modern_demo_fixture_text_passes():
    fixtures = [find_fixture(p.read_bytes()) for p in sorted(SAMPLES.glob("*.png"))]
    texts = [fx["ocr_text"] for fx in fixtures if fx]
    assert texts
    assert all(assess(t).score >= THRESHOLD for t in texts)


def test_all_historical_pdf_text_layers_fail():
    pytest.importorskip("pymupdf")
    from ai.preprocessing.pdf import pdf_text_layer

    pdfs = sorted(HIST.glob("*.pdf"))
    assert len(pdfs) == 4
    assert all(not assess(pdf_text_layer(p.read_bytes())).ok for p in pdfs)


def test_stray_glyph_codes_in_bangla_fail():
    """H10: a PDF writer that cannot map shaped Bangla glyphs back to Unicode (WeasyPrint) leaves
    stray letters / symbols inside the words. That layer scored 1.0 before; it must not be
    trusted."""
    broken = "এই সাফ কবিলা দªল°লর তপªশিলভুক্ত সম্পªত্তির ªবি°ক্রেতা ˥মোঃ আব্দুল কªরমে। সম্পªত্তির পªЕশ্চি°মে খাল, পূ°বির্বে রাস্তা।"
    assert foreign_in_bangla(broken) >= 10 and not assess(broken).ok
    fine = "দলিল নং ৪৭৮২/খ – ১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ · “বিক্রেতা” কফিল উদ্দিন। Deed no 4782 · SHA-256 ••••0123"
    assert foreign_in_bangla(fine) == 0 and assess(fine).score == 1.0
