"""Download of scanned mouza-map PDFs from free.mouzamap.tech (a public Google-Drive index).

mouzas.json links each scan at its viewer page (`<path>.pdf?a=view`). A plain GET of that path
is not a download: the site expects a POST, which answers with JSON holding a signed,
short-lived `/download.aspx?...` link that serves the PDF. This module follows that two-step
flow for a signed-in user and streams the bytes back; nothing is stored. Only the one pinned
host is ever contacted and redirects are never followed, so the endpoint cannot be pointed
at anything else.
"""

import logging
import re
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from urllib.parse import quote, unquote, urlsplit

import httpx

from app.core.errors import AppError

logger = logging.getLogger("landshield.scans")

SCAN_HOST = "free.mouzamap.tech"
MAX_SCAN_BYTES = 100 * 1024 * 1024
_CHUNK = 64 * 1024
# the scan site (Google Drive behind it) fails now and then; retry so one bad response is not fatal
ATTEMPTS = 3
RETRY_DELAY = 0.7  # seconds, multiplied by the attempt number
# drive number, then folders, ending in .pdf: "/3:/Bagerhat/<upazila>/BS/1-ALIPUR-1.pdf"
_PATH = re.compile(r"^/\d+:/[^\x00-\x1f]{1,900}\.pdf$", re.IGNORECASE)
_LINK = re.compile(r"^/download\.aspx\?[A-Za-z0-9_=&%.\-]{1,600}$")


def scan_file_url(raw: str) -> str:
    """The canonical file URL (no query or fragment) of a scan link; 400 for anything else."""
    bad = AppError("SCAN_URL_INVALID", "Not a mouza map scan link", 400)
    try:
        parts = urlsplit(raw.strip())
        port = parts.port
    except ValueError:
        raise bad from None
    segments = unquote(parts.path).split("/")
    if (
        parts.scheme != "https"
        or parts.hostname != SCAN_HOST
        or port not in (None, 443)
        or parts.username
        or parts.password
        or not _PATH.match(parts.path)
        or ".." in segments
    ):
        raise bad
    return f"https://{SCAN_HOST}{parts.path}"


def make_client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(20.0, read=60.0),
        follow_redirects=False,
        headers={"User-Agent": "LandShieldBD-demo/0.1 (mouza map download)"},
    )


def get_scan_client_factory() -> Callable[[], httpx.Client]:
    """FastAPI dependency; tests override it with a client on a mock transport."""
    return make_client


@dataclass
class Scan:
    chunks: Iterator[bytes]
    filename: str
    size: int | None


def _unavailable(reason: str) -> AppError:
    logger.warning("scan download failed: %s", reason)
    return AppError("SCAN_UNAVAILABLE", "The scanned map could not be fetched right now", 502)


def _file_name(name: object, url: str) -> str:
    base = name if isinstance(name, str) and name.strip() else unquote(url.rsplit("/", 1)[-1])
    safe = re.sub(r'[\x00-\x1f"\\/;:*?<>|]', "_", base).strip()[:150] or "mouza-map"
    return safe if safe.lower().endswith(".pdf") else f"{safe}.pdf"


def content_disposition(filename: str) -> str:
    ascii_name = filename.encode("ascii", "ignore").decode().strip(" ._") or "mouza-map.pdf"
    if not ascii_name.lower().endswith(".pdf"):
        ascii_name += ".pdf"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def open_scan(make: Callable[[], httpx.Client], raw_url: str) -> Scan:
    """Ask the site for a signed link and open the PDF as a byte stream (the caller iterates it).

    A transient upstream failure (SCAN_UNAVAILABLE) is retried with a fresh client and signed link;
    not-found and too-large answers are final.
    """
    url = scan_file_url(raw_url)
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return _open_once(make, url)
        except AppError as exc:
            if exc.code != "SCAN_UNAVAILABLE" or attempt == ATTEMPTS:
                raise
            time.sleep(RETRY_DELAY * attempt)
    raise AssertionError("unreachable")


def _open_once(make: Callable[[], httpx.Client], url: str) -> Scan:
    client = make()
    resp: httpx.Response | None = None
    try:
        meta = client.post(url)
        if meta.status_code == 404:
            raise AppError("SCAN_NOT_FOUND", "Scanned map not found", 404)
        if meta.status_code != 200:
            raise _unavailable(f"metadata HTTP {meta.status_code}")
        info = meta.json()
        link = info.get("link") if isinstance(info, dict) else None
        if not isinstance(link, str) or not _LINK.match(link):
            raise _unavailable("no download link in the response")
        listed = info.get("size")
        if isinstance(listed, str) and listed.isdigit() and int(listed) > MAX_SCAN_BYTES:
            raise AppError("SCAN_TOO_LARGE", "The scanned map is too large to download here", 502)
        resp = client.send(client.build_request("GET", f"https://{SCAN_HOST}{link}"), stream=True)
        if resp.status_code != 200:
            raise _unavailable(f"download HTTP {resp.status_code}")
        if not resp.headers.get("content-type", "").lower().startswith("application/pdf"):
            raise _unavailable("the file is not a PDF")
        length = resp.headers.get("content-length", "")
        size = int(length) if length.isdigit() else None
        if size is not None and size > MAX_SCAN_BYTES:
            raise AppError("SCAN_TOO_LARGE", "The scanned map is too large to download here", 502)
    except (httpx.HTTPError, ValueError) as exc:  # ValueError: the metadata was not JSON
        if resp is not None:
            resp.close()
        client.close()
        raise _unavailable(type(exc).__name__) from exc
    except AppError:
        if resp is not None:
            resp.close()
        client.close()
        raise
    return Scan(_stream(client, resp), _file_name(info.get("name"), url), size)


def _stream(client: httpx.Client, resp: httpx.Response) -> Iterator[bytes]:
    sent = 0
    try:
        for chunk in resp.iter_bytes(_CHUNK):
            sent += len(chunk)
            if sent > MAX_SCAN_BYTES:
                # headers are already out: abort so the download fails instead of truncating
                raise RuntimeError("scan exceeded the size limit")
            yield chunk
    finally:
        resp.close()
        client.close()
