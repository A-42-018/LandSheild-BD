"""Ground-truth lookup shared by the mock providers.

A file matches a fixture by (1) its sha256 or (2) a marker `LSMOCK:<key>` embedded in its bytes
(PNG text chunk / PDF comment / JPEG comment, written by the P26 generator). No match -> None.
`by_hash` values are a fixture dict or the name of a `by_marker` fixture (alias).
The real-OCR router (O1) trusts ONLY the exact sha256 (`is_demo_fixture`), never the marker.
"""
import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

FIXTURE_PATH = Path(__file__).with_name("mock_fixtures.json")
_MARKER = re.compile(rb"LSMOCK:([A-Za-z0-9_.-]{1,64})")


@lru_cache
def load_fixtures() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _by_hash(data: bytes) -> dict[str, Any] | None:
    fx = load_fixtures()
    hit = fx.get("by_hash", {}).get(hashlib.sha256(data).hexdigest())
    if isinstance(hit, str):  # alias to a by_marker entry
        hit = fx.get("by_marker", {}).get(hit)
    return hit


def is_demo_fixture(data: bytes) -> bool:
    """True only for the saved demo samples: exact SHA-256 match, no marker lookup (O1)."""
    return _by_hash(data) is not None


def find_fixture(data: bytes) -> dict[str, Any] | None:
    fx = load_fixtures()
    hit = _by_hash(data)
    if hit is not None:
        return hit
    m = _MARKER.search(data)
    if m:
        return fx.get("by_marker", {}).get(m.group(1).decode("ascii"))
    return None
