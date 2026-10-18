"""H8d: `what=bundle` — one ZIP with the original, the digital deed PDF, the record JSON and a
`manifest.json` that lists every file with its SHA-256 and size, plus the version, record hash,
signature, key id and the version history. No names: the manifest carries hashes and dates only.
"""
from __future__ import annotations

import hashlib
import io
import json
import zipfile
from datetime import datetime

BUNDLE_FORMAT = "landshield-bundle/1"
_FIXED_TIME = (2026, 1, 1, 0, 0, 0)  # same input -> same ZIP bytes


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def build_manifest(
    envelope: dict, files: list[tuple[str, bytes]], versions: list[dict], verify_url: str | None
) -> dict:
    """`files` = [(name, bytes)] as they sit in the ZIP; the manifest itself is not listed."""
    integ = envelope["integrity"]
    return {
        "format": BUNDLE_FORMAT,
        "document_id": envelope["document"]["id"],
        "version": envelope["version"],
        "status": envelope["status"],
        "draft": envelope["draft"],
        "verify_url": verify_url,
        "integrity": {
            "record_hash": integ["record_hash"],
            "signature": integ["signature"],
            "algorithm": integ["algorithm"],
            "key_id": integ["key_id"],
            "approved_at": integ["approved_at"],
            "original_sha256": envelope["document"]["file_hash"],
        },
        "files": [
            {"name": n, "sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)} for n, b in files
        ],
        "versions": versions,
    }


def version_summary(items) -> list[dict]:
    """From `records.list_versions().items`: status, dates, hash and signature per version."""
    return [
        {
            "version": i.version,
            "status": i.status,
            "created_at": _iso(i.created_at),
            "approved_at": _iso(i.approved_at),
            "record_hash": i.record_hash,
            "signature": i.signature,
        }
        for i in items
    ]


def build_zip(files: list[tuple[str, bytes]], manifest: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        manifest_bytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode()
        for name, data in [*files, ("manifest.json", manifest_bytes)]:
            info = zipfile.ZipInfo(name, date_time=_FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)
    return buf.getvalue()
