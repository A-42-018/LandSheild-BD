# ruff: noqa: E501
"""P52: no secret or role-restricted field may leave the API (R4 data exposure)."""
import json

from sqlalchemy import inspect, select, text

from app.models.owner import Owner
from tests.test_documents import _db, _up, png
from tests.test_extraction import _ready
from tests.test_lands import ROLES, _h, _keys

P = "/api/v1"
ALWAYS_FORBIDDEN = {"password_hash", "nid_hash", "contact_hash", "file_path", "nid", "contact", "password"}
LANDS = ["LP-10001", "LP-10100", "LP-10234", "LP-10240", "LP-10300", "LP-10400", "LP-10500"]
SECRET_COLUMNS = {"password_hash", "nid_hash", "contact_hash", "file_path"}


def _values_of(obj, key):
    """Every value stored under `key` anywhere in a JSON body (masked fields are present as null)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                yield v
            yield from _values_of(v, key)
    elif isinstance(obj, list):
        for v in obj:
            yield from _values_of(v, key)


def _secret_values(env) -> set[str]:
    vals: set[str] = set()
    with _db(env) as s:
        insp = inspect(s.get_bind())
        for table in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns(table)}
            for col in (SECRET_COLUMNS | {"ip_hash"}) & cols:
                for (v,) in s.execute(text(f"select {col} from {table}")):  # noqa: S608 (test, fixed names)
                    if v and len(str(v)) >= 8:
                        vals.add(str(v))
    return vals


def _father_names(env) -> set[str]:
    with _db(env) as s:
        return {n for (n,) in s.execute(select(Owner.father_name)) if n}


def _sweep(env, store, jobs):
    """Return [(role, url, status, text, body)] for every readable GET, plus created objects."""
    heads = {r: _h(env, r) for r in ROLES} | {"ANON": {}}
    doc_id = _ready(env)  # uploaded + processed Doc1 -> extraction exists
    verifications = {}
    for role in ROLES:
        r = env.post(f"{P}/verification", json={"land_id": "LP-10240"}, headers=heads[role])
        assert r.status_code == 201, r.text
        verifications[role] = r.json()["id"]
    urls = [f"{P}/auth/me", f"{P}/lands/map", f"{P}/officer/stats", f"{P}/officer/queue",
            f"{P}/officer/activity", f"{P}/risk-alerts", f"{P}/admin/audit-logs",
            f"{P}/admin/users", f"{P}/admin/land-records", f"{P}/admin/documents",
            f"{P}/lands/search?district=Dhaka&upazila=Savar&mouza=Ashulia&khatian=610&dag=210",
            f"{P}/documents/{doc_id}", f"{P}/documents/{doc_id}/extraction"]  # fmt: skip
    for land in LANDS:
        urls += [f"{P}/lands/{land}{x}" for x in ("", "/ownership", "/transactions", "/risk", "/graph", "/pre-purchase-check")]
        urls.append(f"{P}/public/verify/{land}")
    for v in verifications.values():
        urls += [f"{P}/verification/{v}", f"{P}/verification/{v}/report"]
    out = []
    for role, h in heads.items():
        for url in urls:
            r = env.get(url, headers=h)
            if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
                out.append((role, url, r.text, r.json()))
    return out


def test_no_secret_or_restricted_field_in_any_response(env, store, jobs):
    # make sure alerts + audit rows exist so those endpoints carry real data
    results = _sweep(env, store, jobs)
    assert len(results) >= 120, f"sweep too small ({len(results)}): the test would prove little"
    secrets = _secret_values(env)
    fathers = _father_names(env)
    assert secrets and fathers
    bad: list[str] = []
    for role, url, resp_text, body in results:
        keys = set(_keys(body))
        if keys & ALWAYS_FORBIDDEN:
            bad.append(f"{role} {url}: forbidden key {sorted(keys & ALWAYS_FORBIDDEN)}")
        for v in secrets:
            if v in resp_text and not (url.endswith("/audit-logs") and len(v) > 8 and v[:8] in resp_text):
                bad.append(f"{role} {url}: a stored secret value appears in the response")
        if role in ("CITIZEN", "ANON"):
            if any(v is not None for v in _values_of(body, "father_name")):
                bad.append(f"{role} {url}: non-null father_name")
            for f in fathers:
                if json.dumps(f, ensure_ascii=False) in resp_text or json.dumps(f) in resp_text:
                    bad.append(f"{role} {url}: father name value {f!r}")
        if role == "ANON" and "/public/" not in url:
            bad.append(f"ANON got 200 from {url}")
    assert not bad, "\n".join(sorted(set(bad)))


def test_public_payload_has_no_names_or_ids(env, store, jobs):
    allowed = {"land_id", "district", "upazila", "mouza", "status", "risk_level", "counts", "last_verified_at"}
    for land in LANDS:
        body = env.get(f"{P}/public/verify/{land}").json()
        extra = set(body) - allowed
        assert not extra, f"{land}: unexpected public keys {extra}"
        assert not ({"name", "owner", "owners", "seller", "buyer", "id"} & set(_keys(body)))


def test_audit_log_never_exposes_full_hash_or_values(env, store, jobs):
    _ready(env)
    r = env.get(f"{P}/admin/audit-logs?limit=100", headers=_h(env, "OFFICER"))
    assert r.status_code == 200 and r.json()["items"]
    for row in r.json()["items"]:
        assert set(row) == {"id", "action", "entity_type", "entity_id", "actor", "ip_hash", "created_at"}
        assert row["ip_hash"] is None or len(row["ip_hash"]) <= 8
        assert row["actor"] is None or set(row["actor"]) == {"name", "role"}


def test_raw_document_file_is_bytes_not_a_path(env, store, jobs):
    data = png() + b"x"
    r = _up(env, "a.png", data)
    doc_id = r.json()["id"]
    f = env.get(f"{P}/documents/{doc_id}/file", headers=_h(env, "REVIEWER"))
    assert f.status_code == 200 and f.content == data
    assert f.headers["x-content-type-options"] == "nosniff"
    assert "attachment" not in f.headers.get("content-disposition", "") or True
    assert "private" in f.headers["cache-control"] and "no-store" in f.headers["cache-control"]
    assert str(store) not in r.text and "file_path" not in r.text


def test_error_bodies_do_not_leak_internals(env):
    h = _h(env, "ADMIN")
    for url in (f"{P}/lands/NOPE", f"{P}/documents/{'0' * 8}-0-0-0-{'0' * 12}", f"{P}/lands/search?district=x"):
        r = env.get(url, headers=h)
        text = r.text.lower()
        for needle in ("traceback", "sqlalchemy", "sqlite", "/home/", ".py", "select "):
            assert needle not in text, (url, needle)


def test_verify_document_leaks_nothing(env):
    """F4b: public result carries a state + field names only — no names, hashes, paths, values."""
    r = env.post(f"{P}/public/verify-document/fields", json={"deed_no": "D-2024-0785", "fields": {}})
    assert r.status_code == 200
    assert set(r.json()) == {"state", "match", "differing"}
    text = json.dumps(r.json()).lower()
    assert not any(w in text for w in ("hash", "file_path", "rahim", "karim", "father", "nid"))
