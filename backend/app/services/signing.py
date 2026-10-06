"""Record hash + Ed25519 signature for deeds (F4a).

record_hash = SHA-256 over canonical JSON (sorted keys, normalised fields + document file hash).
signature   = Ed25519 over the ASCII record_hash. Key: SIGNING_KEY (base64 32-byte seed) or the
PEM at SIGNING_KEY_PATH (default <STORAGE_PATH>/signing/ed25519.pem, auto-generated in dev and
gitignored); if neither can be used an in-memory key is created (signatures die with the process).
"""
import base64
import hashlib
import json
import logging
import os
import unicodedata
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.deed import Deed

log = logging.getLogger("landshield.signing")
PAYLOAD_VERSION = 1
VALID, INVALID, UNSIGNED, NOT_FOUND = "VALID", "INVALID", "UNSIGNED", "NOT_FOUND"
_cache: dict[tuple[str, str], Ed25519PrivateKey] = {}


def clear_key_cache() -> None:
    _cache.clear()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _path(s: Settings) -> Path:
    if s.signing_key_path:
        return Path(s.signing_key_path)
    return Path(s.storage_path) / "signing" / "ed25519.pem"


def load_private_key(s: Settings | None = None) -> Ed25519PrivateKey:
    s = s or get_settings()
    ck = (s.signing_key, str(_path(s)))
    if ck in _cache:
        return _cache[ck]
    if s.signing_key:
        key = Ed25519PrivateKey.from_private_bytes(_unb64(s.signing_key.strip()))
    else:
        path = _path(s)
        if path.is_file():
            key = serialization.load_pem_private_key(path.read_bytes(), password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise ValueError("SIGNING_KEY_PATH must hold an Ed25519 private key")
        else:
            key = Ed25519PrivateKey.generate()
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                pem = key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                )
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as fh:
                    fh.write(pem)
            except OSError:
                log.warning("signing key could not be saved; using an in-memory key")
    _cache[ck] = key
    return key


def public_key_bytes(key: Ed25519PrivateKey | Ed25519PublicKey) -> bytes:
    pub = key.public_key() if isinstance(key, Ed25519PrivateKey) else key
    return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def key_info(s: Settings | None = None) -> dict:
    raw = public_key_bytes(load_private_key(s))
    return {
        "algorithm": "Ed25519",
        "public_key": _b64(raw),
        "key_id": hashlib.sha256(raw).hexdigest()[:12],
    }


def _txt(v: str | None) -> str:
    return " ".join(unicodedata.normalize("NFC", v or "").split())


def canonical_payload(deed: Deed) -> bytes:
    land, doc = deed.land, deed.document
    body = {
        "v": PAYLOAD_VERSION,
        "land_id": land.land_id,
        "khatian_no": _txt(land.khatian_no),
        "dag_no": _txt(land.dag_no),
        "deed_no": _txt(deed.deed_no),
        "seller": _txt(deed.seller.name),
        "buyer": _txt(deed.buyer.name),
        "date": deed.transaction_date.isoformat() if deed.transaction_date else "",
        "area": f"{float(deed.area):.4f}",
        "area_unit": _txt(deed.area_unit).lower(),
        "file_hash": doc.file_hash if doc is not None else "",
    }
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def compute_hash(deed: Deed) -> str:
    return hashlib.sha256(canonical_payload(deed)).hexdigest()


def sign_hash(record_hash: str, key: Ed25519PrivateKey) -> str:
    return _b64(key.sign(record_hash.encode()))


def verify_hash(record_hash: str, signature: str, public: Ed25519PublicKey) -> bool:
    try:
        public.verify(_unb64(signature), record_hash.encode())
    except (InvalidSignature, ValueError):
        return False
    return True


def seal(deed: Deed, s: Settings | None = None) -> None:
    """Set record_hash + signature on a deed (flush by the caller)."""
    deed.record_hash = compute_hash(deed)
    deed.signature = sign_hash(deed.record_hash, load_private_key(s))


def seal_unsigned(db: Session, s: Settings | None = None) -> int:
    rows = db.scalars(select(Deed).where(Deed.record_hash.is_(None))).all()
    for d in rows:
        seal(d, s)
    db.flush()
    return len(rows)


def check_deed(db: Session, deed_id: str, h12: str, s: Settings | None = None) -> str:
    """VALID only if the stored hash matches the live data, the prefix matches,
    and the signature verifies."""
    deed = db.get(Deed, deed_id) if deed_id else None
    if deed is None:
        return NOT_FOUND
    if not deed.record_hash or not deed.signature:
        return UNSIGNED
    pub = load_private_key(s).public_key()
    ok = (
        len(h12) >= 8
        and deed.record_hash.startswith(h12.lower())
        and compute_hash(deed) == deed.record_hash
        and verify_hash(deed.record_hash, deed.signature, pub)
    )
    return VALID if ok else INVALID


def latest_seal(db: Session, land_pk: str) -> tuple[str, str] | None:
    deed = db.scalar(
        select(Deed)
        .where(Deed.land_id == land_pk, Deed.record_hash.is_not(None))
        .order_by(Deed.transaction_date.desc().nulls_last(), Deed.created_at.desc())
        .limit(1)
    )
    return (deed.id, deed.record_hash[:12]) if deed else None
