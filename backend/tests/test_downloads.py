# ruff: noqa: E501, F811
"""H8b: download the digital record (JSON) and the original, and check a downloaded record.

Scoped like viewing, audit-logged, rate-limited; the public check answers VALID / INVALID only,
and one changed byte of the JSON makes it INVALID.
"""
import copy
import hashlib
import json

from sqlalchemy import select

from app.models.audit import AuditLog
from tests.test_documents import _db, png, store  # noqa: F401
from tests.test_extraction import _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_records import _approve_historical, _historical, _rec

D = "/api/v1/documents/{}"
VERIFY = "/api/v1/public/records/verify"


def _head(env, role):
    """One login per role and test (logins are rate-limited)."""
    cache = env.__dict__.setdefault("_dl_heads", {})
    if role not in cache:
        cache[role] = _h(env, role)
    return cache[role]


def _dl(env, doc_id, what="json", role="REVIEWER", **params):
    q = "&".join([f"what={what}", *[f"{k}={v}" for k, v in params.items()]])
    return env.get(D.format(doc_id) + f"/download?{q}", headers=_head(env, role))


def _approved(env, jobs) -> str:
    doc_id = _historical(env, jobs)
    assert _rec(env, doc_id, [{"path": "/schedule/0/boundaries/east", "value": "বড় খাল"}]).status_code == 200
    _approve_historical(env, doc_id)
    return doc_id


def _state(env, body) -> str:
    r = env.post(VERIFY, json=body)
    assert r.status_code == 200, r.text
    return r.json()["state"]


# ---- JSON ---------------------------------------------------------------------------------------


def test_json_download_of_the_approved_record(env, jobs):
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/json")
    assert r.headers["content-disposition"] == f'attachment; filename="landshield-record-{doc_id}-v2.json"'
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["cache-control"] == "private, no-store"
    body = r.json()
    assert body["format"] == "landshield-record/1" and body["record_schema"] == "lhdr/1"
    assert (body["version"], body["status"], body["draft"]) == (2, "APPROVED", False)  # default = newest approved
    assert body["document"]["id"] == doc_id and len(body["document"]["file_hash"]) == 64
    integ = body["integrity"]
    assert integ["algorithm"] == "Ed25519" and integ["key_id"] and integ["public_key"]
    assert len(integ["record_hash"]) == 64 and integ["signature"] and integ["approved_by"] and integ["approved_at"]
    assert r.headers["x-record-sha256"] == integ["record_hash"]
    assert body["record"]["schedule"][0]["boundaries"]["east"]["value"] == "বড় খাল"
    assert integ["record_hash"] == [v for v in env.get(D.format(doc_id) + "/records", headers=_h(env, "REVIEWER")).json()["items"] if v["version"] == 2][0]["record_hash"]
    assert _state(env, body) == "VALID"


def test_the_file_as_downloaded_verifies(env, jobs):
    """The bytes of the response (pretty-printed, Bangla not escaped) are what gets checked."""
    doc_id = _approved(env, jobs)
    raw = _dl(env, doc_id).content
    assert "বড় খাল".encode() in raw  # not \u-escaped
    r = env.post(VERIFY, content=raw, headers={"content-type": "application/json"})
    assert r.status_code == 200 and r.json() == {"state": "VALID"}


def test_one_changed_byte_of_the_json_makes_it_invalid(env, jobs):
    doc_id = _approved(env, jobs)
    good = _dl(env, doc_id).json()
    assert _state(env, good) == "VALID"

    def mutate(path_fn):
        bad = copy.deepcopy(good)
        path_fn(bad)
        return bad

    def deed_no(b):
        n = b["record"]["registration"]["deed_no"]
        n["value"] = n["value"][:-1] + ("X" if n["value"][-1] != "X" else "Y")

    cases = {
        "record value": deed_no,
        "boundary": lambda b: b["record"]["schedule"][0]["boundaries"]["east"].update(value="ছোট খাল"),
        "record_hash": lambda b: b["integrity"].update(record_hash="0" + b["integrity"]["record_hash"][1:] if b["integrity"]["record_hash"][0] != "0" else "1" + b["integrity"]["record_hash"][1:]),
        "signature": lambda b: b["integrity"].update(signature=("A" if b["integrity"]["signature"][0] != "A" else "B") + b["integrity"]["signature"][1:]),
        "file_hash": lambda b: b["document"].update(file_hash="f" * 64),
        "document id": lambda b: b["document"].update(id=b["document"]["id"][:-1] + ("0" if b["document"]["id"][-1] != "0" else "1")),
        "version": lambda b: b.update(version=3),
        "schema": lambda b: b.update(record_schema="core/1"),
        "approved_at": lambda b: b["integrity"].update(approved_at="2020-01-01T00:00:00Z"),
        "approved_by": lambda b: b["integrity"].update(approved_by="someone-else"),
    }
    for name, fn in cases.items():
        assert _state(env, mutate(fn)) == "INVALID", name
    # also at byte level: flip one character of the raw file
    raw = _dl(env, doc_id).content.decode()
    i = raw.index('"deed_no"')
    j = raw.index('"value"', i)
    k = raw.index(":", j) + 3  # first character inside the value
    flipped = raw[:k] + ("9" if raw[k] != "9" else "8") + raw[k + 1 :]
    r = env.post(VERIFY, content=flipped.encode(), headers={"content-type": "application/json"})
    assert r.status_code == 200 and r.json() == {"state": "INVALID"}


def test_a_record_signed_by_another_key_is_invalid(env, jobs):
    """Hash and signature consistent with each other but not made by this server."""
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    from app.services import records, signing

    doc_id = _approved(env, jobs)
    body = _dl(env, doc_id).json()
    i = body["integrity"]
    payload = records.payload_bytes(
        body["document"]["id"], body["document"]["file_hash"], body["version"],
        body["record_schema"], i["approved_by"], i["approved_at"], body["record"],
    )  # fmt: skip
    h = hashlib.sha256(payload).hexdigest()
    assert h == i["record_hash"]
    forged = copy.deepcopy(body)
    forged["integrity"]["signature"] = signing.sign_hash(h, Ed25519PrivateKey.generate())
    assert _state(env, forged) == "INVALID"


def test_a_hash_that_the_server_never_stored_is_invalid(env, jobs):
    """Even a correctly signed payload is refused when no such version exists here."""
    from app.services import records, signing

    doc_id = _approved(env, jobs)
    body = _dl(env, doc_id).json()
    body["version"] = 9
    i = body["integrity"]
    h = hashlib.sha256(records.payload_bytes(
        body["document"]["id"], body["document"]["file_hash"], 9, body["record_schema"],
        i["approved_by"], i["approved_at"], body["record"])).hexdigest()  # fmt: skip
    i["record_hash"], i["signature"] = h, signing.sign_hash(h, signing.load_private_key())
    assert _state(env, body) == "INVALID"


def test_a_draft_download_is_marked_and_never_verifies(env, jobs):
    doc_id = _historical(env, jobs)
    assert _rec(env, doc_id, [{"path": "/registration/office", "value": "রূপগঞ্জ"}]).status_code == 200  # opens the DRAFT (v2)
    body = _dl(env, doc_id).json()  # no approved version -> the newest
    assert (body["version"], body["status"], body["draft"]) == (2, "DRAFT", True)
    assert body["integrity"]["record_hash"] is None and body["integrity"]["signature"] is None
    assert _dl(env, doc_id).headers["content-disposition"].endswith('-v2-draft.json"')
    assert "x-record-sha256" not in _dl(env, doc_id).headers
    assert _state(env, body) == "INVALID"
    machine = _dl(env, doc_id, version=1).json()
    assert (machine["version"], machine["status"], machine["draft"]) == (1, "MACHINE", True)


def test_older_versions_and_unknown_versions(env, jobs):
    doc_id = _approved(env, jobs)
    v1 = _dl(env, doc_id, version=1)
    assert v1.status_code == 200 and v1.json()["status"] == "MACHINE"
    assert _dl(env, doc_id, version=2).json()["status"] == "APPROVED"
    r = _dl(env, doc_id, version=7)
    assert r.status_code == 404 and r.json()["code"] == "RECORD_VERSION_NOT_FOUND"
    assert _dl(env, doc_id, version=0).status_code == 422


def test_modern_deed_downloads_its_core_record(env, jobs):
    doc_id = _ready(env)
    body = _dl(env, doc_id).json()
    assert body["record_schema"] == "core/1" and body["record"]["schema"] == "core/1" and body["draft"] is True


# ---- original -----------------------------------------------------------------------------------


def test_original_download_is_the_exact_upload(env, jobs):
    doc_id = _historical(env, jobs)
    r = _dl(env, doc_id, "original")
    assert r.status_code == 200
    assert r.content == png() + b"H5-historical"
    digest = hashlib.sha256(r.content).hexdigest()
    assert r.headers["x-file-sha256"] == digest
    assert r.headers["content-disposition"] == f'attachment; filename="landshield-original-{doc_id}.png"'
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["cache-control"] == "private, no-store"
    assert _dl(env, doc_id).json()["document"]["file_hash"] == digest


def test_original_stays_downloadable_after_approval(env, jobs):
    doc_id = _approved(env, jobs)
    r = _dl(env, doc_id, "original")
    assert r.status_code == 200 and r.content == png() + b"H5-historical"


# ---- access, audit, rate limit ------------------------------------------------------------------


def test_who_may_download(env, jobs):
    doc_id = _approved(env, jobs)
    for what in ("json", "original"):
        assert _dl(env, doc_id, what, "CITIZEN").status_code == 403
        assert env.get(D.format(doc_id) + f"/download?what={what}").status_code == 401
        for role in ("REVIEWER", "OFFICER", "ADMIN"):
            assert _dl(env, doc_id, what, role).status_code == 200, (what, role)
    assert _dl(env, "no-such-document").status_code == 404
    assert _dl(env, doc_id, "pdf").status_code == 422  # not available before H8c
    assert env.get(D.format(doc_id) + "/download", headers=_head(env, "REVIEWER")).status_code == 422


def test_every_download_is_audited(env, jobs):
    doc_id = _approved(env, jobs)
    assert _dl(env, doc_id, "json").status_code == 200
    assert _dl(env, doc_id, "json", version=1).status_code == 200
    assert _dl(env, doc_id, "original", "OFFICER").status_code == 200
    assert _dl(env, doc_id, "json", version=7).status_code == 404  # failed: no row
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_DOWNLOAD").order_by(AuditLog.created_at)).all()
    assert [(r.new_value["what"], r.new_value["version"], r.actor_role) for r in rows] == [
        ("json", 2, "REVIEWER"), ("json", 1, "REVIEWER"), ("original", None, "OFFICER"),
    ]  # fmt: skip
    assert all(r.entity_type == "document" and r.actor_id and r.ip_hash is not None or r.ip_hash is None for r in rows)
    blob = json.dumps([r.new_value for r in rows], ensure_ascii=False)
    assert "বড়" not in blob and "file_hash" not in blob  # the log holds what + version only


def test_downloads_are_rate_limited_per_user(env, jobs):
    doc_id = _approved(env, jobs)
    env.app.state.settings.download_rate_limit_per_hour = 3
    try:
        assert [_dl(env, doc_id, "json").status_code for _ in range(3)] == [200, 200, 200]
        r = _dl(env, doc_id, "original")
        assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"
        assert _dl(env, doc_id, "json", "OFFICER").status_code == 200  # another user has their own count
    finally:
        env.app.state.settings.download_rate_limit_per_hour = 30


# ---- public check -------------------------------------------------------------------------------


def test_public_check_is_anonymous_and_returns_the_state_only(env, jobs):
    doc_id = _approved(env, jobs)
    body = _dl(env, doc_id).json()
    r = env.post(VERIFY, json=body)  # no auth header
    assert r.status_code == 200 and r.json() == {"state": "VALID"}
    assert r.headers["cache-control"] == "no-store"
    bad = copy.deepcopy(body)
    bad["record"]["registration"]["deed_no"]["value"] = "x"
    r = env.post(VERIFY, json=bad)
    assert r.json() == {"state": "INVALID"} and "x" not in r.text.replace("state", "").replace("INVALID", "")


def test_public_check_refuses_malformed_and_oversized_bodies(env, jobs):
    assert env.post(VERIFY, json={"nope": 1}).status_code == 422
    assert env.post(VERIFY, content=b"not json", headers={"content-type": "application/json"}).status_code == 422
    junk = {"format": "x", "document": {"id": 1, "file_hash": None}, "version": 1, "record_schema": "core/1", "integrity": {"record_hash": 5}, "record": {}}
    assert _state(env, junk) == "INVALID"  # wrong types are INVALID, never a 500
    big = {**junk, "record": {"pad": "a" * (1024 * 1024 + 10)}}
    r = env.post(VERIFY, json=big)
    assert r.status_code == 413 and r.json()["code"] == "RECORD_TOO_LARGE"
    payload = json.dumps(big).encode()  # chunked: no Content-Length to trust, the bytes are counted
    chunks = (payload[i : i + 65536] for i in range(0, len(payload), 65536))
    r = env.post(VERIFY, content=chunks, headers={"content-type": "application/json"})
    assert r.status_code == 413 and r.json()["code"] == "RECORD_TOO_LARGE"
    small = json.dumps(junk).encode()
    r = env.post(VERIFY, content=iter([small[:10], small[10:]]), headers={"content-type": "application/json"})
    assert r.status_code == 200 and r.json() == {"state": "INVALID"}


def test_public_check_writes_no_audit_row(env, jobs):
    doc_id = _approved(env, jobs)
    body = _dl(env, doc_id).json()
    with _db(env) as s:
        before = len(s.scalars(select(AuditLog.id)).all())
    assert _state(env, body) == "VALID"
    with _db(env) as s:
        assert len(s.scalars(select(AuditLog.id)).all()) == before


def test_public_check_is_rate_limited(env, jobs):
    env.app.state.settings.public_rate_limit_per_min = 3
    try:
        body = {"format": "x", "document": {}, "version": 1, "record_schema": "core/1", "integrity": {}, "record": {}}
        assert [env.post(VERIFY, json=body).status_code for _ in range(3)] == [200, 200, 200]
        assert env.post(VERIFY, json=body).status_code == 429
    finally:
        env.app.state.settings.public_rate_limit_per_min = 60
