# ruff: noqa: E501
"""P52: injection / XSS payload sanity. Hostile input must never 500, leak SQL, or change data."""
import re
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models.land_parcel import LandParcel
from app.models.user import User
from tests.test_documents import _db, _up, png
from tests.test_lands import Q, _h

P = "/api/v1"
PAYLOADS = [
    "' OR '1'='1' --",
    "'; DROP TABLE land_parcels; --",
    "1 UNION SELECT password_hash FROM users --",
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "../../../../etc/passwd",
    "%00%27%22",
    "${jndi:ldap://x/a}",
    "{{7*7}}",
    "A" * 5000,
]
LEAK_NEEDLES = ("traceback", "sqlalchemy", "sqlite", "syntax error", "/home/", "password_hash")


def _counts(env):
    with _db(env) as s:
        return s.scalar(select(func.count()).select_from(LandParcel)), s.scalar(select(func.count()).select_from(User))


def _check(r, payload, where, bad):
    text = r.text.lower()
    if r.status_code >= 500:
        bad.append(f"{where}: {r.status_code}")
    if "json" not in r.headers.get("content-type", "") and r.status_code != 204:
        bad.append(f"{where}: content-type {r.headers.get('content-type')}")
    if r.headers.get("x-content-type-options") != "nosniff":
        bad.append(f"{where}: missing nosniff")
    if any(n in text for n in LEAK_NEEDLES):
        bad.append(f"{where}: internal detail in body")
    if payload.startswith("<") and payload.lower() in text:
        bad.append(f"{where}: payload reflected verbatim")


def test_read_endpoints_survive_hostile_input(env):
    h = _h(env, "OFFICER")
    before = _counts(env)
    bad: list[str] = []
    for p in PAYLOADS:
        for key in Q:
            r = env.get(f"{P}/lands/search", params={**Q, key: p}, headers=h)
            _check(r, p, f"search[{key}]", bad)
            if r.status_code == 200:
                bad.append(f"search[{key}] matched a parcel with payload {p[:20]!r}")
        for suffix in ("", "/ownership", "/transactions", "/risk", "/graph"):
            _check(env.get(f"{P}/lands/{p}{suffix}", headers=h), p, f"land{suffix}", bad)
        _check(env.get(f"{P}/public/verify/{p}"), p, "public", bad)
        _check(env.get(f"{P}/officer/queue", params={"q": p, "filter": p}, headers=h), p, "queue.q", bad)
        _check(env.get(f"{P}/officer/activity", params={"action": p}, headers=h), p, "activity", bad)
        _check(
            env.get(f"{P}/admin/audit-logs", params={"actor": p, "action": p, "entity_type": p}, headers=h),
            p, "audit-logs", bad,
        )  # fmt: skip
        _check(env.get(f"{P}/risk-alerts", params={"land_id": p, "status": p}, headers=h), p, "alerts", bad)
    assert not bad, "\n".join(bad)
    assert _counts(env) == before


def test_write_endpoints_survive_hostile_input(env, store):
    h = _h(env, "OFFICER")
    before = _counts(env)
    bad: list[str] = []
    for p in PAYLOADS:
        _check(env.post(f"{P}/auth/login", json={"email": p, "password": p}), p, "login", bad)
        _check(env.post(f"{P}/verification", json={"land_id": p}, headers=h), p, "verification", bad)
        _check(_up(env, "a.png", png(), document_type=p, land_id=p), p, "upload.form", bad)
        _check(
            env.post(f"{P}/documents/{p}/reject", json={"reason": p}, headers=h), p, "reject", bad,
        )  # fmt: skip
        _check(env.patch(f"{P}/risk-alerts/{p}", json={"status": p}, headers=h), p, "alert", bad)
        _check(
            env.patch(f"{P}/documents/{p}/extraction", json={"fields": [{"field": p, "value": p}]}, headers=h),
            p, "extraction", bad,
        )  # fmt: skip
    assert not bad, "\n".join(bad)
    assert _counts(env) == before


def test_upload_filename_never_reaches_disk_or_response(env, store):
    for name in ("../../evil.png", "<script>.png", "a\x00b.png", "..\\..\\x.png", "x" * 400 + ".png"):
        r = _up(env, name, png(salt=name.encode()[:8]))
        assert r.status_code in (201, 400, 413, 415, 422), (name, r.status_code)
        assert name not in r.text
    for f in store.rglob("*"):
        assert re.fullmatch(r"[0-9a-f]{32}\.(png|jpg|pdf)", f.name) or f.is_dir(), f.name
        assert store in f.parents


def test_stored_markup_is_returned_as_inert_json(env):
    """Names are stored as typed; safety comes from JSON-only responses + no HTML sinks in the UI."""
    xss = "<img src=x onerror=alert(1)>"
    r = env.post(f"{P}/auth/register", json={"name": xss, "email": "xss@x.test", "password": "correct-horse-1"})
    assert r.status_code == 201
    assert r.headers["content-type"].startswith("application/json")
    assert r.headers["x-content-type-options"] == "nosniff"
    me = env.get(f"{P}/auth/me", headers=_h_login(env))
    assert me.headers["content-type"].startswith("application/json")


def _h_login(env):
    r = env.post(f"{P}/auth/login", json={"email": "xss@x.test", "password": "correct-horse-1"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.parametrize("needle", ["dangerouslySetInnerHTML", ".innerHTML", "document.write(", "eval("])
def test_frontend_has_no_html_injection_sinks(needle):
    root = Path(__file__).resolve().parents[3] / "frontend"
    hits = []
    for sub in ("app", "components", "features", "lib"):
        for f in (root / sub).rglob("*"):
            if f.suffix in {".ts", ".tsx"} and ".test." not in f.name:
                if needle in f.read_text(encoding="utf-8"):
                    hits.append(str(f.relative_to(root)))
    assert not hits, hits
