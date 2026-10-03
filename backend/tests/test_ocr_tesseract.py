import logging
from pathlib import Path

import pytest
from ai.ocr import tesseract as tess
from ai.ocr.base import ProviderError
from ai.ocr.mock import MockOCRProvider

from app.core.config import Settings
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


def test_unavailable_falls_back_to_mock_and_logs(monkeypatch, caplog):
    monkeypatch.setattr("app.services.providers.is_available", lambda: False)
    with caplog.at_level(logging.WARNING, logger="landshield.providers"):
        p = get_providers(_settings(ocr_provider="tesseract"))
    assert isinstance(p.ocr, MockOCRProvider)
    assert "ocr_fallback_to_mock" in caplog.text


def test_available_selects_tesseract(monkeypatch):
    monkeypatch.setattr("app.services.providers.is_available", lambda: True)
    p = get_providers(_settings(ocr_provider=" Tesseract ", preprocess="on", tesseract_lang="eng"))
    assert p.ocr.name == "tesseract" and p.ocr.preprocess is True and p.ocr.lang == "eng"
    assert get_providers(_settings(ocr_provider="tesseract")).ocr.preprocess is False


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
