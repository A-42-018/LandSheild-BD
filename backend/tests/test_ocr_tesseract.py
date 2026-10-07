import logging
from pathlib import Path

import pytest
from ai.ocr import tesseract as tess
from ai.ocr.base import ProviderError

from app.core.config import Settings
from app.core.errors import AppError
from app.services.providers import get_providers

ROOT = Path(__file__).resolve().parents[2]
needs_tesseract = pytest.mark.skipif(not tess.is_available(), reason="tesseract not installed")


def _settings(**kw):
    return Settings(_env_file=None, **kw)


def test_resolve_lang_drops_missing(caplog):
    with caplog.at_level(logging.WARNING, logger="landshield.ocr.tesseract"):
        assert tess.resolve_lang("ben+eng", ["eng", "osd"]) == "eng"
    assert "tesseract_lang_missing" in caplog.text
    assert tess.resolve_lang("ben+eng", ["ben", "eng"]) == "ben+eng"
    with pytest.raises(ProviderError) as e:
        tess.resolve_lang("ben", ["eng"])
    assert e.value.code == "TESSERACT_LANG_MISSING"


def test_unavailable_is_503_and_never_mock(monkeypatch):
    monkeypatch.setattr("app.services.providers.is_available", lambda: False)
    with pytest.raises(AppError) as e:
        get_providers(_settings(ocr_provider="tesseract"))
    assert e.value.code == "OCR_UNAVAILABLE" and e.value.status_code == 503


def test_available_selects_tesseract(monkeypatch):
    monkeypatch.setattr("app.services.providers.is_available", lambda: True)
    p = get_providers(
        _settings(
            ocr_provider=" Tesseract ", preprocess="on", tesseract_lang="eng", ocr_max_pages=2
        )
    )
    assert p.ocr.name == "tesseract" and p.ocr.preprocess is True and p.ocr.lang == "eng"
    assert p.ocr.max_pages == 2 and p.ocr.timeout_s == 30
    off = get_providers(_settings(ocr_provider="tesseract", preprocess="off"))
    assert off.ocr.preprocess is False
    assert get_providers(_settings(ocr_provider="tesseract")).ocr.preprocess is True  # default on


def test_missing_binary_is_clear_error(monkeypatch):
    def boom(*a, **k):
        raise OSError("no binary")

    pt = pytest.importorskip("pytesseract")
    monkeypatch.setattr(pt, "get_languages", boom)
    with pytest.raises(ProviderError) as e:
        tess.installed_languages()
    assert e.value.code == "TESSERACT_NOT_INSTALLED"
    assert tess.is_available() is False


@needs_tesseract
def test_recognizes_clean_demo_document():
    data = (ROOT / "database/sample_data/Clean.png").read_bytes()
    r = tess.TesseractOCRProvider(lang="eng").recognize(data, "png")
    assert r.provider == "tesseract" and r.words
    assert 0.0 < r.confidence <= 1.0
    assert all(0.0 <= w.confidence <= 1.0 and len(w.bbox) == 4 for w in r.words)
    assert "Ashulia" in r.text or "Savar" in r.text or "Dhaka" in r.text


@needs_tesseract
def test_bad_image_error_code():
    with pytest.raises(ProviderError) as e:
        tess.TesseractOCRProvider(lang="eng").recognize(b"not an image", "png")
    assert e.value.code == "IMAGE_DECODE_FAILED"


@needs_tesseract
def test_preprocess_flag_path_runs():
    pytest.importorskip("cv2")
    data = (ROOT / "database/sample_data/Clean.png").read_bytes()
    r = tess.TesseractOCRProvider(lang="eng", preprocess=True).recognize(data, "png")
    assert r.words


def test_geometric_text_joins_label_and_value_rows():
    from ai.ocr.base import OCRWord
    from ai.ocr.tesseract import _geometric_text

    w = lambda t, x, y: OCRWord(t, 0.9, (x, y, 40, 20))  # noqa: E731
    # block order puts the whole label column before the value column
    words = [w("Deed", 10, 10), w("Date:", 10, 50), w("D-1", 300, 12), w("2024-01-01", 300, 52)]
    assert _geometric_text(words) == "Deed D-1\nDate: 2024-01-01"


# --- O2: psm retry, upscale, timeout, multi-page --------------------------------------------
def _fake_data(words, conf, x=10):
    n = len(words)
    return {
        "text": words, "conf": [conf] * n, "left": [x] * n, "top": list(range(0, 20 * n, 20)),
        "width": [30] * n, "height": [10] * n, "block_num": [1] * n, "par_num": [1] * n,
        "line_num": list(range(n)),
    }  # fmt: skip


@pytest.fixture
def fake_pt(monkeypatch):
    pt = pytest.importorskip("pytesseract")
    monkeypatch.setattr(tess, "installed_languages", lambda: ["eng", "ben"])
    calls = []

    def install(fn):
        def image_to_data(img, lang, config, output_type, timeout):
            calls.append((config, img.size, timeout))
            return fn(config, img)

        monkeypatch.setattr(pt, "image_to_data", image_to_data)
        return calls

    return install


def test_good_first_pass_stops_at_psm6(fake_pt):
    from tests.test_documents import png

    calls = fake_pt(lambda cfg, img: _fake_data(["a", "b"], 90))
    r = tess.TesseractOCRProvider(lang="eng", timeout_s=7).recognize(png(), "png")
    assert [c[0] for c in calls] == ["--psm 6"] and calls[0][2] == 7
    assert r.confidence == 0.9 and r.provider == "tesseract"


def test_low_confidence_retries_psm4_then_upscaled_and_keeps_best(fake_pt):
    from tests.test_documents import png

    def fn(cfg, img):
        if cfg == "--psm 4":
            return _fake_data(["x", "y"], 40)
        if img.size[0] >= tess.MIN_WIDTH:  # upscaled attempt: best, boxes must map back
            return _fake_data(["u", "v"], 70, x=tess.MIN_WIDTH // 2)
        return _fake_data(["p"], 20)

    calls = fake_pt(fn)
    r = tess.TesseractOCRProvider(lang="eng").recognize(png(), "png")  # 4x4 px: upscaled 1500 wide
    assert [c[0] for c in calls] == ["--psm 6", "--psm 4", "--psm 6"]
    assert [w.text for w in r.words] == ["u", "v"]
    assert r.words[0].bbox[0] == 2  # 750 / (1500/4) = 2 in ORIGINAL coordinates
    assert r.confidence == 0.7


def test_timeout_maps_to_ocr_timeout(fake_pt):
    from tests.test_documents import png

    def boom(cfg, img):
        raise RuntimeError("Tesseract process timeout")

    fake_pt(boom)
    with pytest.raises(ProviderError) as e:
        tess.TesseractOCRProvider(lang="eng").recognize(png(), "png")
    assert e.value.code == "OCR_TIMEOUT"


def test_multipage_pdf_is_concatenated_with_offsets_and_truncated(fake_pt):
    pymupdf = pytest.importorskip("pymupdf")
    doc = pymupdf.open()
    for _ in range(3):
        doc.new_page(width=300, height=400)
    fake_pt(lambda cfg, img: _fake_data(["w"], 90))
    r = tess.TesseractOCRProvider(lang="eng", max_pages=2).recognize(doc.tobytes(), "pdf")
    assert r.warnings == ("PAGES_TRUNCATED",)
    tops = [w.bbox[1] for w in r.words]
    assert len(tops) == 2 and tops[1] > tops[0] + 100  # page 2 sits below page 1
    full = tess.TesseractOCRProvider(lang="eng", max_pages=5).recognize(doc.tobytes(), "pdf")
    assert full.warnings == () and len(full.words) == 3
