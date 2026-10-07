# ruff: noqa: F811
"""O1: fixture -> pdf-text -> Tesseract router. No network, Tesseract stubbed unless installed."""
from pathlib import Path

import pytest
from ai.ocr import router as router_mod
from ai.ocr import tesseract as tess
from ai.ocr.base import OCRResult, ProviderError
from ai.ocr.router import AutoOCRProvider

from app.core.config import Settings
from app.services.providers import get_providers
from tests.test_documents import _up, png, store  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import PROC, _process, jobs  # noqa: F401

SAMPLES = Path(__file__).resolve().parents[2] / "database" / "sample_data"
needs_tesseract = pytest.mark.skipif(not tess.is_available(), reason="tesseract not installed")


class FakeTesseract:
    def __init__(self, **kw):
        self.kw = kw

    def recognize(self, data, file_type):
        return OCRResult(text="khatian 1", confidence=0.8, provider="tesseract")


@pytest.fixture
def fake_tesseract(monkeypatch):
    monkeypatch.setattr(router_mod.tess, "is_available", lambda: True)
    monkeypatch.setattr(router_mod.tess, "TesseractOCRProvider", FakeTesseract)


@pytest.fixture
def no_tesseract(monkeypatch):
    monkeypatch.setattr(router_mod.tess, "is_available", lambda: False)


def _text_pdf(text: str) -> bytes:
    pymupdf = pytest.importorskip("pymupdf")
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), text)
    return doc.tobytes()


def _blank_pdf() -> bytes:
    pymupdf = pytest.importorskip("pymupdf")
    doc = pymupdf.open()
    doc.new_page()
    return doc.tobytes()


def test_demo_file_is_labelled_demo(no_tesseract):
    r = AutoOCRProvider().recognize((SAMPLES / "Doc1.png").read_bytes(), "png")
    assert r.provider == "demo" and "D-2024-0785" in r.text


def test_demo_off_uses_tesseract(fake_tesseract):
    r = AutoOCRProvider(demo_fixtures=False).recognize((SAMPLES / "Doc1.png").read_bytes(), "png")
    assert r.provider == "tesseract"


def test_marker_only_file_is_not_a_demo_sample(no_tesseract):
    # a lookalike carrying the LSMOCK marker but different bytes is NOT the saved demo file
    with pytest.raises(ProviderError) as e:
        AutoOCRProvider().recognize(png() + b"LSMOCK:Doc1", "png")
    assert e.value.code == "OCR_UNAVAILABLE"


def test_text_pdf_uses_text_layer(no_tesseract):
    pdf = _text_pdf("Deed of sale. Khatian 1245 Dag 785 Mouza Barmi District Gazipur Sreepur")
    r = AutoOCRProvider().recognize(pdf, "pdf")
    assert r.provider == "pdf-text" and r.confidence == 0.99 and "Khatian 1245" in r.text


def test_scanned_pdf_falls_through_to_tesseract(fake_tesseract):
    assert AutoOCRProvider().recognize(_blank_pdf(), "pdf").provider == "tesseract"


def test_unknown_image_without_tesseract_is_unavailable_not_mock(no_tesseract):
    with pytest.raises(ProviderError) as e:
        AutoOCRProvider().recognize(png(salt=b"never-seen"), "png")
    assert e.value.code == "OCR_UNAVAILABLE"


def test_settings_wire_auto_provider():
    p = get_providers(
        Settings(_env_file=None, ocr_provider="auto", demo_fixtures="off", ocr_max_pages=3)
    )
    assert isinstance(p.ocr, AutoOCRProvider)
    assert p.ocr.demo_fixtures is False and p.ocr.max_pages == 3 and p.ocr.preprocess is True


def test_job_failure_keeps_code_and_does_not_crash(env, jobs, no_tesseract):
    env.app.state.settings.ocr_provider = "auto"
    r = _up(env, "scan.png", png(salt=b"unknown"), "OFFICER")
    doc_id = r.json()["id"]
    assert _process(env, doc_id).status_code == 202
    got = env.get(f"/api/v1/documents/{doc_id}", headers=_h(env, "OFFICER")).json()
    assert got["processing_status"] == "FAILED" and got["failure_code"] == "OCR_UNAVAILABLE"


def test_demo_upload_end_to_end_records_source_and_extractor(env, jobs, no_tesseract):
    env.app.state.settings.ocr_provider = "auto"
    env.app.state.settings.document_ai_provider = "auto"
    r = _up(env, "Doc1.png", (SAMPLES / "Doc1.png").read_bytes(), "OFFICER")
    assert r.status_code == 201, r.text
    doc_id = r.json()["id"]
    assert _process(env, doc_id).status_code == 202
    ex = env.get(f"/api/v1/documents/{doc_id}/extraction", headers=_h(env, "OFFICER")).json()
    assert ex["ocr_source"] == "demo" and ex["extractor"] == "mock" and ex["model"] is None
    assert {f["field"]: f["value"] for f in ex["fields"]}["khatian_no"] == "1245"


def test_verify_document_503_when_ocr_unavailable(env, no_tesseract):
    env.app.state.settings.ocr_provider = "auto"
    r = env.post(
        "/api/v1/public/verify-document",
        files={"file": ("copy.png", png(salt=b"zzz"), "image/png")},
    )
    assert r.status_code == 503 and r.json()["code"] == "OCR_UNAVAILABLE"


@needs_tesseract
def test_real_tesseract_smoke_on_clean_png():
    r = AutoOCRProvider(demo_fixtures=False, lang="eng", preprocess=False).recognize(
        (SAMPLES / "Clean.png").read_bytes(), "png"
    )
    assert r.provider == "tesseract" and r.text.strip()
