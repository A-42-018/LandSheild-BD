"""File storage (P23). `StorageService` is the interface; `LocalStorage` keeps files on disk,
`S3Storage` (H5, D6) in a private S3-compatible bucket (Cloudflare R2, Supabase Storage, AWS...).

Stored names are server-generated (from the *validated* type); the client filename is never used.
Keys are relative to the storage root and never leave the server: files are served only through
the access-checked routes, never by bucket URL. Originals are never overwritten: LocalStorage
creates files exclusively; S3 keys are content-addressed (documents/<sha256>.<ext>), so an existing
key already holds exactly these bytes and is left alone.

STORAGE_BACKEND=local (default; dev and tests) | s3 (S3_BUCKET, S3_ENDPOINT, S3_REGION,
S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY; needs boto3: pip install -e ".[s3]").
"""
import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


class StorageError(Exception):
    """Raised for unsafe keys/extensions or missing files."""


@dataclass(frozen=True)
class StoredFile:
    key: str  # relative, server-only (documents.file_path)
    sha256: str
    size: int


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class StorageService(Protocol):
    def save(self, data: bytes, ext: str) -> StoredFile: ...

    def read(self, key: str) -> bytes: ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None: ...


def _check_ext(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if not ext.isalnum() or not ext.isascii() or len(ext) > 5:
        raise StorageError("Invalid extension")
    return ext


def _check_key(key: str) -> str:
    if (
        not key or "\x00" in key or "\\" in key or key.startswith("/")
        or any(part in ("", ".", "..") for part in key.split("/"))
    ):  # fmt: skip
        raise StorageError("Invalid storage key")
    return key


class LocalStorage:
    SUBDIR = "documents"

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()

    def _resolve(self, key: str) -> Path:
        """Resolve a key under root; reject absolute paths, `..`, and symlink escapes."""
        if not key or "\x00" in key or "\\" in key:
            raise StorageError("Invalid storage key")
        path = (self.root / key).resolve()
        if path == self.root or not path.is_relative_to(self.root):
            raise StorageError("Storage key escapes the storage root")
        return path

    def save(self, data: bytes, ext: str) -> StoredFile:
        ext = _check_ext(ext)
        key = f"{self.SUBDIR}/{uuid.uuid4().hex}.{ext}"
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # "xb": exclusive create, so an existing file can never be overwritten
        with open(path, "xb") as fh:
            fh.write(data)
        return StoredFile(key=key, sha256=sha256_hex(data), size=len(data))

    def read(self, key: str) -> bytes:
        path = self._resolve(key)
        if not path.is_file():
            raise StorageError("File not found")
        return path.read_bytes()

    def exists(self, key: str) -> bool:
        try:
            return self._resolve(key).is_file()
        except StorageError:
            return False

    def delete(self, key: str) -> None:
        path = self._resolve(key)
        if path.is_file():
            os.remove(path)


class S3Storage:
    """Private S3-compatible bucket. `client` is a boto3 S3 client (tests pass a fake)."""

    SUBDIR = "documents"
    MEDIA = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg"}

    def __init__(self, client: Any, bucket: str) -> None:
        if not bucket:
            raise StorageError("S3_BUCKET is not set")
        self.client = client
        self.bucket = bucket

    def _missing(self, exc: Exception) -> bool:
        code = str(getattr(exc, "response", {}).get("Error", {}).get("Code", ""))
        return code in ("404", "NoSuchKey", "NotFound")

    def save(self, data: bytes, ext: str) -> StoredFile:
        ext = _check_ext(ext)
        digest = sha256_hex(data)
        key = f"{self.SUBDIR}/{digest}.{ext}"
        if not self.exists(key):  # same key = same bytes: never written twice
            self.client.put_object(
                Bucket=self.bucket, Key=key, Body=data,
                ContentType=self.MEDIA.get(ext, "application/octet-stream"),
                Metadata={"sha256": digest},
            )  # fmt: skip
        return StoredFile(key=key, sha256=digest, size=len(data))

    def read(self, key: str) -> bytes:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=_check_key(key))
        except Exception as exc:
            if self._missing(exc):
                raise StorageError("File not found") from None
            raise
        return obj["Body"].read()

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=_check_key(key))
        except StorageError:
            return False
        except Exception as exc:
            if self._missing(exc):
                return False
            raise
        return True

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=_check_key(key))


def make_storage(settings: Any) -> StorageService:
    """The storage backend chosen by STORAGE_BACKEND (local | s3)."""
    backend = (settings.storage_backend or "local").strip().lower()
    if backend == "local":
        return LocalStorage(settings.storage_path)
    if backend != "s3":
        raise StorageError(f"Unknown STORAGE_BACKEND {backend!r} (local | s3)")
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover - depends on the install
        raise StorageError('STORAGE_BACKEND=s3 needs boto3: pip install -e ".[s3]"') from exc
    style = "path" if settings.s3_force_path_style else "auto"
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint or None,
        region_name=settings.s3_region or None,
        aws_access_key_id=settings.s3_access_key_id or None,
        aws_secret_access_key=settings.s3_secret_access_key or None,
        config=Config(s3={"addressing_style": style}, retries={"max_attempts": 3}),
    )
    return S3Storage(client, settings.s3_bucket)
