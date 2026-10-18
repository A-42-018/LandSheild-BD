# ruff: noqa: E501, F811
"""H8c: the digital deed PDF (layout, footer, draft mark, NID masking, endpoint, round trip).

The layout / endpoint tests run without a PDF library (the renderer is replaced by a stub that
returns the HTML). The render and round-trip tests need WeasyPrint + Pango (and PyMuPDF / Tesseract)
and are skipped until H8a's engine is installed: pip install -e "./backend[pdf]" pymupdf
"""
import json
from pathlib import Path

import pytest
from sqlalchemy import select

from ai.extraction import lhdr
from app.models.audit import AuditLog
from app.services import deed_pdf as dp
from tests.test_documents import _db, png, store  # noqa: F401
from tests.test_downloads import _approved, _dl, _head  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_records import _historical

GOLD = Path(__file__).resolve().parents[2] / "database" / "sample_data" / "historical" / "Historical_Land_Deed.gold.json"


def _record() -> dict:
    return lhdr.parse(json.loads(GOLD.read_text(encoding="utf-8"))).model_dump(mode="json", by_alias=True, exclude_none=True)


META = {
    "deed_no": "4782/খ", "version": 2, "draft": False, "approved_at": "2026-10-18T07:00:00Z", "approver": "Officer One",
    "record_hash": "a" * 64, "file_hash": "b" * 64, "signature": "c" * 40, "key_id": "k1", "document_id": "d1",
}  # fmt: skip


@pytest.fixture
def stub_engine(monkeypatch):
    """Replace WeasyPrint: the 'PDF' is the HTML bytes behind a %PDF header."""
    monkeypatch.setattr(dp, "render_pdf", lambda html: b"%PDF-stub\n" + html.encode())


# ---- layout (no PDF library) ----------------------------------------------------------------------


def test_view_has_sections_a_to_i_in_order():
    view = dp.build_view(lhdr.SCHEMA, _record())
    assert [s["key"] for s in view] == list("ABCDEFGHI")
    flat = json.dumps(view, ensure_ascii=False)
    for want in ("কফিল উদ্দিন", "রামকান্ত দাশ", "ভবানীপুর", "4782/খ", "খাল", "1500"):
        assert want in flat


def test_nids_show_the_last_four_digits_only():
    assert dp.mask_nid("1234567890123") == "••••0123"
    assert dp.mask_nid("১২৩৪৫৬৭৮৯০") == "••••7890"
    assert dp.mask_nid("12") == "••••"
    p = dp._party({"role": "SELLER", "name": "X", "nid": "1990123456789"})
    assert ("জাতীয় পরিচয়পত্র", "NID", "••••6789") in p and "1990123456789" not in json.dumps(p, ensure_ascii=False)


def test_html_has_the_footer_and_escapes_values(monkeypatch):
    rec = _record()
    rec["parties"][0]["name"]["value"] = "<script>alert(1)</script>"
    html = dp.render_html(dp.build_view(lhdr.SCHEMA, rec), META)
    assert "<script>" not in html and "&lt;script&gt;" in html
    for want in (META["record_hash"], META["file_hash"], META["signature"], "Officer One", "2026-10-18T07:00:00Z", "4782/খ"):
        assert want in html
    assert dp.DRAFT_MARK not in html  # approved: no draft mark


def test_draft_is_marked_on_every_page_and_in_the_header():
    html = dp.render_html(dp.build_view(lhdr.SCHEMA, _record()), {**META, "draft": True, "record_hash": "", "signature": ""})
    assert html.count(dp.DRAFT_MARK) >= 2 and "@top-center" in html  # banner + running page header


def test_core_record_becomes_one_flat_section():
    view = dp.build_view("core/1", {"fields": [{"field": "deed_no", "value": "55"}, {"field": "mouza", "value": ""}]})
    assert view[0]["blocks"][0] == [("deed_no", "deed_no", "55")]


# ---- endpoint (stubbed engine) ----------------------------------------------------------------------


def test_pdf_download_of_the_approved_record(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id, "pdf")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF")
    assert r.headers["content-disposition"] == f'attachment; filename="landshield-deed-{doc_id}-v2.pdf"'
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-record-sha256"]
    assert r.headers["x-record-sha256"].encode() in r.content and dp.DRAFT_MARK.encode() not in r.content


def test_pdf_of_an_unapproved_version_is_a_marked_draft(env, jobs, stub_engine):
    doc_id = _historical(env, jobs)
    r = _dl(env, doc_id, "pdf")
    assert r.status_code == 200 and r.headers["content-disposition"].endswith('-draft.pdf"')
    assert dp.DRAFT_MARK.encode() in r.content and "x-record-sha256" not in r.headers


def test_pdf_download_is_audited_scoped_and_old_versions_work(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    assert _dl(env, doc_id, "pdf", version=1).status_code == 200
    assert _dl(env, doc_id, "pdf", version=9).status_code == 404
    assert env.get(f"/api/v1/documents/{doc_id}/download?what=pdf").status_code in (401, 403)
    assert _dl(env, doc_id, "pdf", "CITIZEN").status_code == 403
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_DOWNLOAD")).all()
    assert [(r.new_value["what"], r.new_value["version"]) for r in rows] == [("pdf", 1)]


def test_pdf_without_an_engine_is_a_503(env, jobs, monkeypatch):
    import builtins

    real = builtins.__import__
    monkeypatch.setattr(builtins, "__import__", lambda n, *a, **k: (_ for _ in ()).throw(ImportError(n)) if n == "weasyprint" else real(n, *a, **k))
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id, "pdf")
    assert r.status_code == 503 and r.json()["code"] == "PDF_ENGINE_UNAVAILABLE"


# ---- real engine: skipped until H8a's engine is installed ---------------------------------------------

def _engine():
    pytest.importorskip("weasyprint", reason="H8a engine not installed (pip install -e './backend[pdf]')")
    return pytest.importorskip("fitz", reason="PyMuPDF not installed")


def test_pdf_keeps_exact_bangla_text():
    import unicodedata

    fitz = _engine()
    pdf = dp.deed_pdf(lhdr.SCHEMA, _record(), META)
    assert pdf.startswith(b"%PDF")
    text = " ".join(unicodedata.normalize("NFC", "".join(p.get_text() for p in fitz.open(stream=pdf, filetype="pdf"))).split())
    for word in ("তপশিল", "বিক্রেতা", "পশ্চিমে", "কফিল উদ্দিন", "রামকান্ত দাশ", "ভবানীপুর", "4782/খ"):
        assert unicodedata.normalize("NFC", word) in text, word


def test_round_trip_our_pdf_back_through_the_pipeline():
    """H8c done criterion: PDF -> OCR / text layer -> historical parser -> >= 99 % of the gold values."""
    _engine()
    from ai.evaluation.historical import score_doc
    from ai.extraction.derive import derive_fields
    from ai.extraction.historical_deed import HistoricalDeedProvider
    from ai.ocr.router import AutoOCRProvider

    gold = json.loads(GOLD.read_text(encoding="utf-8"))
    pdf = dp.deed_pdf(lhdr.SCHEMA, _record(), META)
    res = AutoOCRProvider(demo_fixtures=False, profile="historical").recognize(pdf, "pdf")
    out = HistoricalDeedProvider().extract(pdf, res)
    core = {f.field: f.value for f in out.fields}
    s = score_doc(core, gold, record=out.record)
    ok = sum(a for a, _ in s["sections"].values())
    total = sum(n for _, n in s["sections"].values())
    assert ok / total >= 0.99, f"{ok}/{total}; missed {s['missed']}"
