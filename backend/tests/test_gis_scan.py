# ruff: noqa: F811, E501
"""Mouza map scan download (app/services/scans.py): two-step fetch from free.mouzamap.tech, streamed back."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.ratelimit import reset_rate_limits
from app.services import scans
from tests.test_lands import ROLES, _h, env, loader  # noqa: F401

URL = "https://free.mouzamap.tech/3:/Bagerhat/%E0%A6%95%E0%A6%9A%E0%A7%81%E0%A6%AF%E0%A6%BC%E0%A6%BE-/BS/1-ALIPUR-1.pdf"
PDF = b"%PDF-1.3\n" + b"x" * 200_000
LINK = "/download.aspx?file=abc123&expiry=e7pk%2BFR93A%3D%3D&mac=3285ec0d"


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class Site:
    """Stands in for free.mouzamap.tech; records every request it receives."""

    def __init__(self, meta=None, meta_status=200, file_status=200, ctype="application/pdf", body=PDF, headers=None):
        self.meta = {"name": "1-ALIPUR-1_result - (www.mouzamap.tech).pdf", "size": str(len(body)), "link": LINK} if meta is None else meta
        self.meta_status, self.file_status, self.ctype, self.body = meta_status, file_status, ctype, body
        self.headers = headers or {}
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path.startswith("/download.aspx"):
            return httpx.Response(self.file_status, content=self.body, headers={"content-type": self.ctype, **self.headers})
        assert request.method == "POST"
        return httpx.Response(self.meta_status, json=self.meta)

    def install(self, env: TestClient):
        env.app.dependency_overrides[scans.get_scan_client_factory] = lambda: lambda: httpx.Client(
            transport=httpx.MockTransport(self.handler), follow_redirects=False
        )
        return self


def _scan(env, url=URL, role="CITIZEN"):
    return env.get("/api/v1/gis/scan", params={"url": url}, headers=_h(env, role))


def test_requires_login(env):
    assert env.get("/api/v1/gis/scan", params={"url": URL}).status_code == 401


@pytest.mark.parametrize("role", ROLES)
def test_every_role_downloads_the_pdf_as_an_attachment(env, role):
    site = Site().install(env)
    r = _scan(env, role=role)
    assert r.status_code == 200
    assert r.content == PDF
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-length"] == str(len(PDF))
    assert r.headers["cache-control"] == "private, no-store"
    disp = r.headers["content-disposition"]
    assert disp.startswith("attachment;")
    assert 'filename="1-ALIPUR-1_result - (www.mouzamap.tech).pdf"' in disp
    # step 1 POSTs the file path; step 2 GETs only the signed link it returned
    assert [(q.method, q.url.host, q.url.path) for q in site.requests] == [
        ("POST", "free.mouzamap.tech", "/3:/Bagerhat/কচুয়া-/BS/1-ALIPUR-1.pdf"),
        ("GET", "free.mouzamap.tech", "/download.aspx"),
    ]
    assert site.requests[1].url.query == LINK.split("?", 1)[1].encode()


def test_the_viewer_link_from_mouzas_json_works_too(env):
    site = Site().install(env)
    assert _scan(env, URL + "?a=view").status_code == 200
    assert str(site.requests[0].url).endswith("1-ALIPUR-1.pdf")  # query dropped


def test_bangla_file_name_gets_an_ascii_fallback_and_utf8_name(env):
    Site(meta={"name": "আলীপুর BS 001.pdf", "link": LINK}).install(env)
    disp = _scan(env).headers["content-disposition"]
    assert 'filename="BS 001.pdf"' in disp
    assert "filename*=UTF-8''%E0%A6%86%E0%A6%B2%E0%A7%80%E0%A6%AA%E0%A7%81%E0%A6%B0%20BS%20001.pdf" in disp


@pytest.mark.parametrize(
    "bad",
    [
        "http://free.mouzamap.tech/3:/A/B.pdf",  # not https
        "https://evil.example/3:/A/B.pdf",
        "https://free.mouzamap.tech.evil.example/3:/A/B.pdf",
        "https://evil.example@free.mouzamap.tech/3:/A/B.pdf",  # user info
        "https://free.mouzamap.tech:8443/3:/A/B.pdf",
        "https://free.mouzamap.tech/3:/A/B.txt",
        "https://free.mouzamap.tech/download.aspx?file=abc",
        "https://free.mouzamap.tech/3:/A/../../etc/B.pdf",
        "https://free.mouzamap.tech/3:/A/%2e%2e/B.pdf",
        "https://free.mouzamap.tech:abc/3:/A/B.pdf",
        "ftp://free.mouzamap.tech/3:/A/B.pdf",
        "https://localhost/3:/A/B.pdf",
        "not a url at all, but long enough to pass the length check",
    ],
)
def test_only_the_one_scan_host_is_ever_contacted(env, bad):
    site = Site().install(env)
    r = _scan(env, bad)
    assert r.status_code == 400
    assert r.json()["code"] == "SCAN_URL_INVALID"
    assert site.requests == []


def test_a_missing_scan_is_404(env):
    Site(meta_status=404, meta={"error": "nope"}).install(env)
    r = _scan(env)
    assert r.status_code == 404
    assert r.json()["code"] == "SCAN_NOT_FOUND"


@pytest.mark.parametrize(
    "site",
    [
        Site(meta_status=500),
        Site(meta={"name": "x.pdf"}),  # no link
        Site(meta={"link": "https://evil.example/download.aspx?file=1"}),  # not a site-relative link
        Site(meta={"link": "/other.aspx?file=1"}),
        Site(meta=["not", "an", "object"]),
        Site(file_status=500),
        Site(file_status=302, headers={"location": "https://evil.example/x.pdf"}),  # redirects are not followed
        Site(ctype="text/html", body=b"<html>captcha</html>"),
    ],
    ids=["meta-500", "no-link", "foreign-link", "wrong-path", "meta-not-object", "file-500", "redirect", "not-a-pdf"],
)
def test_upstream_trouble_is_a_clean_502(env, site):
    site.install(env)
    r = _scan(env)
    assert r.status_code == 502
    assert r.json()["code"] == "SCAN_UNAVAILABLE"
    assert all(q.url.host == "free.mouzamap.tech" for q in site.requests)


def test_network_failure_is_a_clean_502(env):
    def boom(request):
        raise httpx.ConnectError("down")

    env.app.dependency_overrides[scans.get_scan_client_factory] = lambda: lambda: httpx.Client(transport=httpx.MockTransport(boom))
    r = _scan(env)
    assert r.status_code == 502
    assert r.json()["code"] == "SCAN_UNAVAILABLE"


def test_oversized_scans_are_refused_before_streaming(env, monkeypatch):
    monkeypatch.setattr(scans, "MAX_SCAN_BYTES", 1000)
    Site().install(env)  # metadata lists 200 KB
    r = _scan(env)
    assert r.status_code == 502
    assert r.json()["code"] == "SCAN_TOO_LARGE"
    Site(meta={"link": LINK}).install(env)  # no listed size: the Content-Length header decides
    assert _scan(env).json()["code"] == "SCAN_TOO_LARGE"


def test_a_stream_that_outgrows_the_cap_aborts_instead_of_truncating(env, monkeypatch):
    monkeypatch.setattr(scans, "MAX_SCAN_BYTES", 150_000)

    def site(q: httpx.Request) -> httpx.Response:  # no size anywhere up front; the body is 200 KB
        if q.method == "POST":
            return httpx.Response(200, json={"link": LINK})
        return httpx.Response(
            200, content=iter([PDF[:100_000], PDF[100_000:]]), headers={"content-type": "application/pdf"}
        )

    env.app.dependency_overrides[scans.get_scan_client_factory] = lambda: lambda: httpx.Client(
        transport=httpx.MockTransport(site)
    )
    strict = TestClient(env.app, raise_server_exceptions=True)  # the abort must surface, not end quietly
    with pytest.raises(RuntimeError, match="size limit"):
        strict.get("/api/v1/gis/scan", params={"url": URL}, headers=_h(env, "CITIZEN"))


def test_downloads_are_rate_limited_per_user(env):
    Site().install(env)
    limit = get_settings().scan_rate_limit_per_min
    h = _h(env, "CITIZEN")
    for _ in range(limit):
        assert env.get("/api/v1/gis/scan", params={"url": URL}, headers=h).status_code == 200
    r = env.get("/api/v1/gis/scan", params={"url": URL}, headers=h)
    assert r.status_code == 429
    assert env.get("/api/v1/gis/scan", params={"url": URL}, headers=_h(env, "OFFICER")).status_code == 200  # other users unaffected


def test_missing_or_oversized_url_parameter_is_rejected(env):
    Site().install(env)
    assert env.get("/api/v1/gis/scan", headers=_h(env, "CITIZEN")).status_code == 422
    assert _scan(env, URL + "x" * 1200).status_code == 422
