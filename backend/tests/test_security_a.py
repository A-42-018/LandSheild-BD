# ruff: noqa: F811
"""P51 Security A: headers, rate limits, CORS, cookie flags, production config, repo hygiene."""

import os
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from app.api.v1.auth import _set_cookie
from app.core.config import DEFAULT_HASH_SALT, Settings, production_problems
from app.core.headers import SecurityHeadersMiddleware
from app.core.ratelimit import check_rate, reset_rate_limits
from app.main import create_app
from app.services import auth as auth_svc
from app.services.upload_validation import MAX_IMAGE_PIXELS, MAX_PDF_PAGES, MAX_UPLOAD_BYTES
from tests.test_documents import EXE, _up, png, store  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
GOOD = {
    "app_env": "prod",
    "jwt_secret": "s" * 40,
    "cookie_secure": True,
    "hash_salt": "private-salt-value-123",
    "cors_origins": "https://landshield.example",
}


def settings(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


# ---------------------------------------------------------------- headers
def test_api_responses_carry_security_headers(client):
    responses = {
        "ok": client.get("/api/v1/health"),
        "405": client.post("/api/v1/health"),
        "404": client.get("/api/v1/does-not-exist"),
    }
    for path, resp in responses.items():
        h = {k.lower(): v for k, v in resp.headers.items()}
        assert h["x-content-type-options"] == "nosniff", path
        assert h["x-frame-options"] == "DENY", path
        assert h["referrer-policy"] == "no-referrer", path
        assert "default-src 'none'" in h["content-security-policy"], path
        assert "frame-ancestors 'none'" in h["content-security-policy"], path
        assert h["cache-control"] == "no-store", path
        assert "strict-transport-security" not in h, path  # dev over http


def test_docs_keep_frame_protection_but_no_blocking_csp(client):
    r = client.get("/docs")
    assert r.status_code == 200
    assert "content-security-policy" not in r.headers
    assert r.headers["x-frame-options"] == "DENY"


def test_middleware_keeps_route_values_and_adds_hsts_when_asked():
    def ep(_):
        return PlainTextResponse("x", headers={"Cache-Control": "private, max-age=5"})

    app = Starlette(routes=[Route("/", ep)])
    app.add_middleware(SecurityHeadersMiddleware, hsts=True)
    r = TestClient(app).get("/")
    assert r.headers["cache-control"] == "private, max-age=5"  # route's own value wins
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "max-age=31536000" in r.headers["strict-transport-security"]


def test_prod_app_sends_hsts():
    app = create_app(settings(**GOOD))
    assert "strict-transport-security" in TestClient(app).get("/api/v1/health").headers


# ---------------------------------------------------------------- production config
def test_good_production_config_has_no_problems():
    assert production_problems(settings(**GOOD)) == []
    create_app(settings(**GOOD))  # starts


@pytest.mark.parametrize(
    "override, needle",
    [
        ({"jwt_secret": "short"}, "JWT_SECRET"),
        ({"cookie_secure": False}, "COOKIE_SECURE"),
        ({"hash_salt": DEFAULT_HASH_SALT}, "HASH_SALT"),
        ({"hash_salt": "short"}, "HASH_SALT"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"cors_origins": "http://landshield.example"}, "CORS_ORIGINS"),
        ({"cors_origins": ""}, "CORS_ORIGINS"),
    ],
)
def test_unsafe_production_config_refuses_to_start(override, needle):
    cfg = settings(**{**GOOD, **override})
    assert any(needle in p for p in production_problems(cfg))
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        create_app(cfg)


def test_dev_is_never_blocked_by_production_checks():
    create_app(settings())  # defaults: no secret, insecure cookie, dev salt


# ---------------------------------------------------------------- CORS
def _preflight(client, origin, headers="authorization,content-type", method="POST"):
    return client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": headers,
        },
    )


def test_cors_allows_only_the_configured_origin_methods_and_headers(client):
    ok = _preflight(client, "http://localhost:3000")
    assert ok.status_code == 200
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert ok.headers["access-control-allow-credentials"] == "true"
    methods = ok.headers["access-control-allow-methods"]
    assert "POST" in methods and "PUT" not in methods
    bad_origin = _preflight(client, "https://evil.example")
    assert bad_origin.status_code == 400
    assert "access-control-allow-origin" not in bad_origin.headers
    assert _preflight(client, "http://localhost:3000", headers="x-custom").status_code == 400
    assert _preflight(client, "http://localhost:3000", method="PUT").status_code == 400


def test_wildcard_origin_is_never_echoed_with_credentials():
    c = TestClient(create_app(settings(cors_origins="*")), raise_server_exceptions=False)
    r = _preflight(c, "https://evil.example")
    assert "access-control-allow-origin" not in r.headers


# ---------------------------------------------------------------- cookie flags
def test_refresh_cookie_flags_on_login(env):
    creds = {"email": "citizen@x.test", "password": "correct-horse-1"}
    r = env.post("/api/v1/auth/login", json=creds)
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/api/v1/auth" in cookie
    assert "secure" not in cookie.replace("samesite", "")  # dev: http


def test_cookie_secure_flag_follows_setting():
    from starlette.responses import Response

    for secure in (False, True):
        resp = Response()
        _set_cookie(resp, settings(cookie_secure=secure), "tok")
        cookie = resp.headers["set-cookie"].lower()
        assert ("; secure" in cookie) is secure
        assert "httponly" in cookie and "samesite=lax" in cookie


# ---------------------------------------------------------------- rate limits
def test_shared_limiter_blocks_after_limit_per_bucket_and_key():
    for _ in range(3):
        check_rate("t", "ip1", 3)
    with pytest.raises(Exception) as e:
        check_rate("t", "ip1", 3)
    assert getattr(e.value, "code", "") == "RATE_LIMITED" and e.value.status_code == 429
    check_rate("t", "ip2", 3)  # other key unaffected
    check_rate("other", "ip1", 3)  # other bucket unaffected
    reset_rate_limits()
    check_rate("t", "ip1", 3)


def test_login_limiter_uses_the_shared_store():
    for _ in range(2):
        auth_svc.check_login_rate("1.2.3.4", 2)
    with pytest.raises(Exception) as e:
        auth_svc.check_login_rate("1.2.3.4", 2)
    assert e.value.status_code == 429
    auth_svc.reset_login_limits()
    auth_svc.check_login_rate("1.2.3.4", 2)


def test_register_is_rate_limited_per_ip(env):
    env.app.state.settings.auth_rate_limit_per_min = 3
    codes = [
        env.post(
            "/api/v1/auth/register",
            json={"name": "N", "email": f"n{i}@x.test", "password": "correct-horse-1"},
        ).status_code
        for i in range(5)
    ]
    assert codes == [201, 201, 201, 429, 429]


def test_upload_limit_is_per_user_and_counts_rejected_files(env, store):
    env.app.state.settings.upload_rate_limit_per_hour = 3
    ok = [_up(env, "a.png", png(salt=bytes([i]))).status_code for i in range(3)]
    assert ok == [201, 201, 201]
    blocked = _up(env, "b.png", png(salt=b"z"))
    assert blocked.status_code == 429 and blocked.json()["code"] == "RATE_LIMITED"
    assert _up(env, "c.png", png(salt=b"y"), role="ADMIN").status_code == 201  # other user


def test_rejected_uploads_still_consume_the_budget(env, store):
    env.app.state.settings.upload_rate_limit_per_hour = 2
    assert _up(env, "x.png", EXE).status_code == 415
    assert _up(env, "y.png", EXE).status_code == 415
    assert _up(env, "z.png", png()).status_code == 429


def test_upload_size_limits_are_unchanged():
    assert MAX_UPLOAD_BYTES == 10 * 1024 * 1024
    assert MAX_IMAGE_PIXELS == 40_000_000
    assert MAX_PDF_PAGES == 20


# ---------------------------------------------------------------- repo hygiene
_SKIP = {".git", "node_modules", ".venv", ".next", "__pycache__", "storage", ".pytest_cache"}
_SECRET_PATTERNS = [
    re.compile("-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIV" + "ATE KEY-----"),
    re.compile(r"AK" + r"IA[0-9A-Z]{16}"),
    re.compile(r"sk-" + r"ant-[A-Za-z0-9_-]{20,}"),
    re.compile(r"gh" + r"p_[A-Za-z0-9]{36}"),
    re.compile(r"xox[b" + r"p]-[A-Za-z0-9-]{10,}"),
]
_TEXT = {".py", ".ts", ".tsx", ".mjs", ".js", ".json", ".md", ".sh", ".toml", ".yml", ".example"}


def _files():
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in _SKIP]  # prune: never walk node_modules/.venv
        for n in names:
            yield Path(base) / n


def test_no_secret_material_in_the_repo():
    hits = []
    for p in _files():
        if p.suffix not in _TEXT and p.name != ".env.example":
            continue
        if p.stat().st_size > 2_000_000 or p.name == "package-lock.json":
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        hits += [str(p.relative_to(ROOT)) for rx in _SECRET_PATTERNS if rx.search(text)]
    assert hits == []


def test_gitignore_covers_secrets_and_runtime_data():
    lines = {ln.strip() for ln in (ROOT / ".gitignore").read_text().splitlines()}
    for needed in (".env", ".env.*", "!.env.example", "storage/", "*.db", "node_modules/", ".venv/",
                   ".next/", "docs/backup/", "*.pem", "*.key"):
        assert needed in lines, needed


def test_env_example_has_no_filled_in_secrets():
    values = {}
    for ln in (ROOT / ".env.example").read_text().splitlines():
        if "=" in ln and not ln.startswith("#"):
            k, v = ln.split("=", 1)
            values[k.strip()] = v.split("#", 1)[0].strip()
    for k in ("JWT_SECRET", "DEMO_PASSWORD", "HASH_SALT"):
        assert values[k] == "", k
    assert values["UPLOAD_RATE_LIMIT_PER_HOUR"] == "20"


def test_cookie_samesite_none_requires_secure():
    from app.core.config import Settings, production_problems

    base = dict(jwt_secret="x" * 40, hash_salt="s" * 20, cors_origins="https://a.example")
    bad = production_problems(Settings(cookie_secure=True, cookie_samesite="bogus", **base))
    assert any("COOKIE_SAMESITE" in p for p in bad)
    bad = production_problems(Settings(cookie_secure=False, cookie_samesite="none", **base))
    assert any("requires COOKIE_SECURE" in p for p in bad)
    ok = production_problems(Settings(cookie_secure=True, cookie_samesite="none", **base))
    assert not any("COOKIE_SAMESITE" in p for p in ok)
