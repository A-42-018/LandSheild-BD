# ruff: noqa: F811
import json

import pytest

from app.core.ratelimit import reset_rate_limits
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_review import _fill, _post

V = "/api/v1/public/verify-document"


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def _approved(env, marker=b"Doc1") -> bytes:
    doc_id = _ready(env, marker)
    _fill(env, doc_id)
    assert _post(env, doc_id, "approve").status_code == 200
    return png() + b"LSMOCK:" + marker  # same bytes _upload stored


def _send(env, data: bytes, name="copy.png"):
    return env.post(V, files={"file": (name, data, "image/png")})


def test_same_file_is_authentic(env, jobs):
    data = _approved(env)
    r = _send(env, data)
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "AUTHENTIC" and r.json()["match"] == "FILE"
    assert r.headers["cache-control"] == "no-store"


def test_edited_copy_is_altered_with_field_names_only(env, jobs):
    _approved(env)
    r = _send(env, png(salt=b"x") + b"LSMOCK:Doc1Altered")
    b = r.json()
    assert r.status_code == 200 and b["state"] == "ALTERED"
    assert "land_area" in b["differing"]
    text = json.dumps(b).lower()
    assert not any(w in text for w in ("rahim", "karim", "10", "d-2024"))


def test_rescanned_copy_same_content_is_authentic(env, jobs):
    _approved(env)
    r = _send(env, png(salt=b"rescan") + b"LSMOCK:Doc1")
    assert r.json() == {"state": "AUTHENTIC", "match": "CONTENT", "differing": []}


def test_unknown_deed_not_found(env, jobs):
    _approved(env, b"Doc1")
    assert _send(env, png(salt=b"y") + b"LSMOCK:Doc2").json()["state"] == "NOT_FOUND"


def test_unreadable_copy(env, jobs):
    assert _send(env, png(salt=b"z") + b"no-fixture").json()["state"] == "UNREADABLE"


def test_json_fields_mode(env, jobs):
    _approved(env)
    ok = env.post(f"{V}/fields", json={"deed_no": "D-2024-0785", "fields": {"land_area": "10"}})
    assert ok.json()["state"] == "AUTHENTIC"
    bad = env.post(f"{V}/fields", json={"deed_no": "D-2024-0785", "fields": {"land_area": "15"}})
    assert bad.json() == {"state": "ALTERED", "match": None, "differing": ["land_area"]}
    nf = env.post(f"{V}/fields", json={"deed_no": "D-0000-0000", "fields": {}})
    assert nf.json()["state"] == "NOT_FOUND"


def test_rejects_bad_files_and_nothing_is_stored(env, jobs):
    bad = env.post(V, files={"file": ("a.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 415
    assert env.post(V, files={"file": ("a.png", b"", "image/png")}).status_code == 400
    with _db(env) as s:
        from sqlalchemy import func, select

        from app.models.document import Document

        before = s.scalar(select(func.count(Document.id)))
    _send(env, png(salt=b"q") + b"LSMOCK:Doc1")
    with _db(env) as s:
        assert s.scalar(select(func.count(Document.id))) == before


def test_rate_limited(env, jobs):
    limit = env.app.state.settings.verify_doc_rate_limit_per_min
    codes = [
        env.post(f"{V}/fields", json={"deed_no": "X", "fields": {}}).status_code
        for _ in range(limit + 1)
    ]
    assert codes[-1] == 429 and set(codes[:-1]) == {200}
