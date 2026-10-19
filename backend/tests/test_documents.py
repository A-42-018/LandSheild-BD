import struct
import zlib

import pytest
from ai.mock_fixtures import find_fixture
from sqlalchemy import func, select

from app.api.v1.documents import get_storage
from app.core.db import get_db
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.land_office import LandOffice
from app.services.offices import ensure_offices
from app.services.storage import LocalStorage, StorageError
from app.services.upload_validation import MAX_PDF_PAGES, MAX_UPLOAD_BYTES
from tests.test_lands import FORBIDDEN_KEYS, _h, _keys, env  # noqa: F401

URL = "/api/v1/documents/upload"


def _chunk(tag: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + tag + body + struct.pack(">I", zlib.crc32(tag + body))


def png(w=4, h=4, salt=b"") -> bytes:
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00" * (1 + 3 * min(w, 4)) * min(h, 4) + salt)
    sig = b"\x89PNG\r\n\x1a\n"
    return sig + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", idat) + _chunk(b"IEND", b"")


def jpeg(w=8, h=6) -> bytes:
    sof = b"\x08" + struct.pack(">HH", h, w) + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    return b"\xff\xd8\xff\xc0" + struct.pack(">H", len(sof) + 2) + sof + b"\xff\xd9"


def pdf(pages=1) -> bytes:
    body = b"".join(b"%d 0 obj\n<< /Type /Page >>\nendobj\n" % (i + 3) for i in range(pages))
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Pages >>\nendobj\n" + body + b"%%EOF\n"


EXE = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 200


@pytest.fixture
def store(env, tmp_path):
    root = tmp_path / "storage"
    env.app.dependency_overrides[get_storage] = lambda: LocalStorage(root)
    return root


def default_office(env, data: bytes = b"") -> str:
    """Every upload names a land office (422 OFFICE_REQUIRED otherwise), and processing then checks
    that the record lies in that office's area. The seeded role accounts have no office of their
    own, so a test upload files under the district (DC) land office of the mock fixture's district
    (Dhaka when the file matches none): a district office takes records from any of its upazilas."""
    fields = (find_fixture(data) or {}).get("fields") or {}
    district = (fields.get("district") or ["Dhaka"])[0]
    with _db(env) as s:
        ensure_offices(s)
        return s.scalar(
            select(LandOffice.id)
            .where(LandOffice.office_type == "District Land Office",
                   (LandOffice.district_en == district) | (LandOffice.district_bn == district))
            .order_by(LandOffice.code)
            .limit(1)
        )  # fmt: skip


def _up(env, name, data, role="OFFICER", **form):
    form.setdefault("office_id", default_office(env, data))
    return env.post(
        URL,
        files={"file": (name, data, "application/octet-stream")},
        data=form,
        headers=_h(env, role),
    )


def _files(root):
    return [p for p in root.rglob("*") if p.is_file()] if root.exists() else []


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def test_officer_uploads_png(env, store):
    data = png()
    r = _up(env, "deed.png", data, document_type="deed")
    assert r.status_code == 201
    b = r.json()
    assert b["document_type"] == "DEED" and b["processing_status"] == "UPLOADED"
    assert b["file_type"] == "png" and b["duplicate"] is False and b["land_id"] is None
    assert len(b["file_hash"]) == 64
    assert not set(_keys(b)) & (FORBIDDEN_KEYS - {"id"})
    [f] = _files(store)
    assert f.read_bytes() == data and f.suffix == ".png" and f.name != "deed.png"
    with _db(env) as s:
        assert s.scalar(select(AuditLog).where(AuditLog.action == "DOCUMENT_UPLOAD"))


def test_admin_uploads_jpeg_and_pdf_with_land(env, store):
    r = _up(env, "a.JPEG", jpeg(), "ADMIN", land_id="LP-10100", document_type="KHATIAN")
    assert r.status_code == 201
    assert (r.json()["file_type"], r.json()["land_id"]) == ("jpg", "LP-10100")
    r = _up(env, "b.pdf", pdf(3), "ADMIN")
    assert r.status_code == 201 and r.json()["file_type"] == "pdf"


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER"])
def test_upload_forbidden_roles(env, store, role):
    assert _up(env, "d.png", png(), role).status_code == 403
    assert _files(store) == []


def test_upload_requires_auth(env, store):
    r = env.post(URL, files={"file": ("d.png", png(), "image/png")})
    assert r.status_code == 401


def test_upload_missing_file_422(env, store):
    assert env.post(URL, headers=_h(env, "OFFICER")).status_code == 422


def test_get_document(env, store):
    doc = _up(env, "d.png", png()).json()
    for role in ("REVIEWER", "OFFICER", "ADMIN"):
        r = env.get(f"/api/v1/documents/{doc['id']}", headers=_h(env, role))
        assert r.status_code == 200 and r.json()["id"] == doc["id"], role
        assert "file_path" not in r.json() and "duplicate" not in r.json()


def test_get_document_denied_and_not_found(env, store):
    doc = _up(env, "d.png", png()).json()
    assert env.get(f"/api/v1/documents/{doc['id']}", headers=_h(env, "CITIZEN")).status_code == 403
    r = env.get("/api/v1/documents/does-not-exist", headers=_h(env, "OFFICER"))
    assert r.status_code == 404 and r.json()["code"] == "DOCUMENT_NOT_FOUND"
    assert env.get(f"/api/v1/documents/{doc['id']}").status_code == 401


def test_renamed_exe_rejected(env, store):
    for name in ("evil.exe", "evil.png", "evil.pdf", "evil.jpg", "noext"):
        r = _up(env, name, EXE)
        assert r.status_code == 415 and r.json()["code"] == "UNSUPPORTED_FILE_TYPE", name
    assert _files(store) == []
    with _db(env) as s:
        assert s.scalar(select(func.count()).select_from(Document)) == 0


def test_extension_content_mismatch_rejected(env, store):
    r = _up(env, "scan.pdf", png())
    assert r.status_code == 415 and r.json()["code"] == "FILE_TYPE_MISMATCH"
    assert _up(env, "scan.png", jpeg()).json()["code"] == "FILE_TYPE_MISMATCH"
    assert _files(store) == []


def test_oversized_rejected(env, store):
    r = _up(env, "big.png", png() + b"\x00" * MAX_UPLOAD_BYTES)
    assert r.status_code == 413 and r.json()["code"] == "FILE_TOO_LARGE"
    assert _files(store) == []


def test_empty_file_rejected(env, store):
    r = _up(env, "e.png", b"")
    assert r.status_code == 400 and r.json()["code"] == "EMPTY_FILE"


def test_traversal_filename_never_used_for_storage(env, store, tmp_path):
    data = png()
    for name in ("../../evil.png", "..\\..\\evil.png", "/etc/cron.d/evil.png"):
        r = _up(env, name, data + name.encode())
        assert r.status_code == 201, name
    stored = _files(store)
    assert len(stored) == 3
    assert all(p.parent == store / "documents" and "evil" not in p.name for p in stored)
    assert [p for p in tmp_path.rglob("evil*")] == []
    r = _up(env, "../../evil.exe", EXE)
    assert r.status_code == 415


def test_local_storage_key_guard(tmp_path):
    st = LocalStorage(tmp_path / "root")
    saved = st.save(b"hello", "png")
    assert st.read(saved.key) == b"hello" and st.exists(saved.key)
    (tmp_path / "secret.txt").write_text("x")
    for bad in ("../secret.txt", "documents/../../secret.txt", "/etc/passwd", "", ".", "a\\b"):
        with pytest.raises(StorageError):
            st.read(bad)
        assert st.exists(bad) is False
    with pytest.raises(StorageError):
        st.delete("../secret.txt")
    for bad_ext in ("../x", "p/ng", "exe\x00", ""):
        with pytest.raises(StorageError):
            st.save(b"x", bad_ext)
    assert (tmp_path / "secret.txt").exists()


def test_local_storage_symlink_escape_rejected(tmp_path):
    st = LocalStorage(tmp_path / "root")
    st.save(b"x", "png")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "f.png").write_bytes(b"x")
    (tmp_path / "root" / "documents" / "link").symlink_to(outside, target_is_directory=True)
    with pytest.raises(StorageError):
        st.read("documents/link/f.png")


def test_image_pixel_cap(env, store):
    r = _up(env, "huge.png", png(w=10000, h=10000))
    assert r.status_code == 413 and r.json()["code"] == "IMAGE_TOO_LARGE"
    assert _up(env, "huge.jpg", jpeg(w=9000, h=9000)).json()["code"] == "IMAGE_TOO_LARGE"
    assert _up(env, "ok.png", png(w=4000, h=4000)).status_code == 201
    assert _up(env, "ok.jpg", jpeg(w=4000, h=4000)).status_code == 201


def test_pdf_page_cap(env, store):
    ok = _up(env, "ok.pdf", pdf(MAX_PDF_PAGES))
    assert ok.status_code == 201
    r = _up(env, "long.pdf", pdf(MAX_PDF_PAGES + 1))
    assert r.status_code == 413 and r.json()["code"] == "PDF_TOO_MANY_PAGES"


def test_same_hash_flagged_duplicate_not_overwritten(env, store):
    data = png(salt=b"same")
    first = _up(env, "a.png", data)
    [f] = _files(store)
    mtime = f.stat().st_mtime_ns
    second = _up(env, "renamed.png", data, "ADMIN")
    assert (first.status_code, second.status_code) == (201, 200)
    assert second.json()["duplicate"] is True and second.json()["id"] == first.json()["id"]
    assert len(_files(store)) == 1 and _files(store)[0].stat().st_mtime_ns == mtime
    assert _files(store)[0].read_bytes() == data
    with _db(env) as s:
        assert s.scalar(select(func.count()).select_from(Document)) == 1
        assert s.scalar(select(AuditLog).where(AuditLog.action == "DOCUMENT_UPLOAD_DUPLICATE"))
    assert _up(env, "other.png", png(salt=b"different")).json()["duplicate"] is False


def test_unknown_land_and_bad_type(env, store):
    r = _up(env, "d.png", png(), land_id="LP-99999")
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
    r = _up(env, "d.png", png(), document_type="PASSPORT")
    assert r.status_code == 422 and r.json()["code"] == "INVALID_DOCUMENT_TYPE"
    assert _files(store) == []


def test_file_preview_returns_original_bytes_for_reviewers(env, store):
    data = png(salt=b"preview")
    doc = _up(env, "a.png", data).json()
    for role in ("REVIEWER", "OFFICER", "ADMIN"):
        r = env.get(f"/api/v1/documents/{doc['id']}/file", headers=_h(env, role))
        assert r.status_code == 200
        assert r.content == data
        assert r.headers["content-type"] == "image/png"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert "no-store" in r.headers["cache-control"]
        assert "content-disposition" not in r.headers


def test_file_preview_pdf_media_type(env, store):
    doc = _up(env, "a.pdf", pdf()).json()
    r = env.get(f"/api/v1/documents/{doc['id']}/file", headers=_h(env, "REVIEWER"))
    assert r.headers["content-type"] == "application/pdf"


def test_file_preview_requires_reviewer_role(env, store):
    doc = _up(env, "a.png", png(salt=b"rbac")).json()
    url = f"/api/v1/documents/{doc['id']}/file"
    assert env.get(url).status_code == 401
    assert env.get(url, headers=_h(env, "CITIZEN")).status_code == 403


def test_file_preview_unknown_and_missing_file(env, store):
    r = env.get("/api/v1/documents/nope/file", headers=_h(env, "REVIEWER"))
    assert (r.status_code, r.json()["code"]) == (404, "DOCUMENT_NOT_FOUND")
    doc = _up(env, "a.png", png(salt=b"gone")).json()
    for f in _files(store):
        f.unlink()
    r = env.get(f"/api/v1/documents/{doc['id']}/file", headers=_h(env, "REVIEWER"))
    assert (r.status_code, r.json()["code"]) == (404, "DOCUMENT_FILE_MISSING")
