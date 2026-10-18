# ruff: noqa: E501, F811
"""H8d: the QR target (`GET /public/records/{id}`), the QR in the PDF footer and the bundle ZIP."""
import hashlib
import io
import json
import zipfile

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.document_record import DocumentRecord
from app.services import bundle as bundle_svc
from app.services import deed_pdf as dp
from tests.test_deed_pdf import META, _record, stub_engine  # noqa: F401
from tests.test_documents import _db, png, store  # noqa: F401
from tests.test_downloads import _approved, _dl  # noqa: F401
from tests.test_lands import env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_records import _historical

PUB = "/api/v1/public/records/{}"


def _rows(env, doc_id) -> dict[int, tuple[str, str]]:
    with _db(env) as s:
        rows = s.scalars(select(DocumentRecord).where(DocumentRecord.document_id == doc_id)).all()
        return {r.version: (r.id, r.status) for r in rows}


def _approved_id(env, doc_id) -> str:
    ids = [i for i, st in _rows(env, doc_id).values() if st == "APPROVED"]
    assert len(ids) == 1
    return ids[0]


# ---- the public page's API ----------------------------------------------------------------------


def test_public_record_of_an_approved_version_is_valid_and_has_no_personal_data(env, jobs):
    doc_id = _approved(env, jobs)
    r = env.get(PUB.format(_approved_id(env, doc_id)))  # anonymous
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"state", "deed_no", "version", "approved_at", "superseded"}
    assert body["state"] == "VALID" and body["version"] == 2 and body["superseded"] is False
    assert body["deed_no"] and body["approved_at"]
    assert r.headers["cache-control"] == "no-store"
    for leak in ("Officer", "Reviewer", "approved_by", "file_hash", "record_hash", "signature", "কফিল"):
        assert leak not in r.text


def test_public_record_unknown_draft_and_machine_ids_are_the_same_404(env, jobs):
    doc_id = _approved(env, jobs)
    other = _historical(env, jobs, salt=b"other")  # never approved
    ids = [i for i, st in _rows(env, other).values()] + ["no-such-id", "x" * 36]
    for rid in ids:
        r = env.get(PUB.format(rid))
        assert r.status_code == 404 and r.json()["code"] == "RECORD_NOT_FOUND", rid
    assert doc_id


def test_public_record_changed_in_the_database_is_invalid(env, jobs):
    doc_id = _approved(env, jobs)
    rid = _approved_id(env, doc_id)
    with _db(env) as s:
        row = s.get(DocumentRecord, rid)
        row.record_json = {**row.record_json, "tampered": True}
        s.commit()
    r = env.get(PUB.format(rid))
    assert r.status_code == 200 and r.json()["state"] == "INVALID"


def test_public_record_of_an_old_version_says_superseded(env, jobs):
    doc_id = _approved(env, jobs)
    rows = _rows(env, doc_id)
    old = [i for i, st in rows.values() if st == "SUPERSEDED"]
    if not old:
        pytest.skip("the helper approves once; no superseded version in this flow")
    assert env.get(PUB.format(old[0])).json()["superseded"] is True


# ---- QR in the PDF footer -----------------------------------------------------------------------


def test_record_url_is_locale_and_id_only():
    assert dp.record_url("https://demo.example/", "abc") == "https://demo.example/bn/v/r/abc"
    assert dp.record_url("", "abc") == "/bn/v/r/abc"


def test_footer_shows_the_verify_address_only_on_an_approved_version():
    url = "https://demo.example/bn/v/r/abc"
    view = dp.build_view("lhdr/1", _record())
    ok = dp.render_html(view, {**META, "verify_url": url})
    assert url in ok and "class=qr" in ok
    draft = dp.render_html(view, {**META, "draft": True, "verify_url": url})
    assert url not in draft and "class=qr" not in draft
    assert "class=qr" not in dp.render_html(view, META)  # no address configured


def test_qr_is_an_svg_data_uri():
    pytest.importorskip("segno", reason="segno not installed (pip install -e './backend[pdf]')")
    uri = dp.qr_data_uri("https://demo.example/bn/v/r/abc")
    assert uri.startswith("data:image/svg+xml")
    html = dp.render_html(dp.build_view("lhdr/1", _record()), {**META, "verify_url": "https://demo.example/bn/v/r/abc"})
    assert "<img src='data:image/svg+xml" in html


def test_pdf_endpoint_puts_this_records_address_in_the_footer(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id, "pdf")
    assert f"/bn/v/r/{_approved_id(env, doc_id)}".encode() in r.content
    draft = _dl(env, _historical(env, jobs, salt=b"draft"), "pdf")
    assert b"/v/r/" not in draft.content


# ---- bundle -------------------------------------------------------------------------------------


def _unzip(r) -> dict[str, bytes]:
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert z.testzip() is None
    return {n: z.read(n) for n in z.namelist()}


def test_bundle_holds_the_original_pdf_json_and_a_manifest_whose_hashes_match(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id, "bundle")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"
    assert r.headers["content-disposition"] == f'attachment; filename="landshield-bundle-{doc_id}-v2.zip"'
    files = _unzip(r)
    assert sorted(files) == sorted([n for n in files if n.startswith("original.")] + ["deed.pdf", "record.json", "manifest.json"])
    m = json.loads(files["manifest.json"])
    assert m["format"] == bundle_svc.BUNDLE_FORMAT and m["version"] == 2 and m["draft"] is False
    assert {f["name"] for f in m["files"]} == set(files) - {"manifest.json"}
    for f in m["files"]:
        assert hashlib.sha256(files[f["name"]]).hexdigest() == f["sha256"] and len(files[f["name"]]) == f["bytes"]
    original = next(n for n in files if n.startswith("original."))
    assert files[original] == _dl(env, doc_id, "original").content
    assert m["integrity"]["original_sha256"] == hashlib.sha256(files[original]).hexdigest()
    rec = json.loads(files["record.json"])
    assert m["integrity"]["record_hash"] == rec["integrity"]["record_hash"] == r.headers["x-record-sha256"]
    assert m["integrity"]["signature"] == rec["integrity"]["signature"]
    assert m["verify_url"].endswith(f"/bn/v/r/{_approved_id(env, doc_id)}")
    assert [v["version"] for v in m["versions"]] == sorted(v["version"] for v in m["versions"]) and len(m["versions"]) >= 2
    assert b"%PDF" in files["deed.pdf"]


def test_bundle_manifest_has_no_names(env, jobs, stub_engine):
    m = _unzip(_dl(env, _approved(env, jobs), "bundle"))["manifest.json"].decode()
    for leak in ("Officer", "Reviewer", "approved_by", "created_by", "@"):
        assert leak not in m


def test_bundle_json_still_verifies_publicly(env, jobs, stub_engine):
    files = _unzip(_dl(env, _approved(env, jobs), "bundle"))
    r = env.post("/api/v1/public/records/verify", json=json.loads(files["record.json"]))
    assert r.status_code == 200 and r.json() == {"state": "VALID"}


def test_bundle_of_a_draft_is_marked_and_has_no_verify_address(env, jobs, stub_engine):
    doc_id = _historical(env, jobs)
    r = _dl(env, doc_id, "bundle")
    assert r.status_code == 200 and r.headers["content-disposition"].endswith('-draft.zip"')
    files = _unzip(r)
    m = json.loads(files["manifest.json"])
    assert m["draft"] is True and m["verify_url"] is None and m["integrity"]["record_hash"] is None
    assert dp.DRAFT_MARK.encode() in files["deed.pdf"]


def test_bundle_is_audited_scoped_and_old_versions_work(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    assert _dl(env, doc_id, "bundle", version=1).status_code == 200
    assert _dl(env, doc_id, "bundle", version=9).status_code == 404
    assert env.get(f"/api/v1/documents/{doc_id}/download?what=bundle").status_code in (401, 403)
    assert _dl(env, doc_id, "bundle", "CITIZEN").status_code == 403
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_DOWNLOAD")).all()
    assert [(r.new_value["what"], r.new_value["version"]) for r in rows] == [("bundle", 1)]


def test_bundles_count_against_the_download_rate_limit(env, jobs, stub_engine):
    doc_id = _approved(env, jobs)
    env.app.state.settings.download_rate_limit_per_hour = 2
    try:
        assert [_dl(env, doc_id, "bundle").status_code for _ in range(2)] == [200, 200]
        r = _dl(env, doc_id, "pdf")
        assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"
    finally:
        env.app.state.settings.download_rate_limit_per_hour = 30


def test_bundle_without_a_pdf_engine_is_a_503(env, jobs, monkeypatch):
    import builtins

    real = builtins.__import__
    monkeypatch.setattr(builtins, "__import__", lambda n, *a, **k: (_ for _ in ()).throw(ImportError(n)) if n == "weasyprint" else real(n, *a, **k))
    r = _dl(env, _approved(env, jobs), "bundle")
    assert r.status_code == 503 and r.json()["code"] == "PDF_ENGINE_UNAVAILABLE"


def test_zip_bytes_are_deterministic():
    files = [("a.txt", b"x"), ("b.txt", b"y")]
    m = {"k": 1}
    assert bundle_svc.build_zip(files, m) == bundle_svc.build_zip(files, m)
