"""File storage (P23). `StorageService` is the interface; `LocalStorage` keeps files on disk.

Stored names are server-generated (uuid + extension from the *validated* type); the client
filename is never used. Keys are relative to the storage root and never leave it.
"""
import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


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
        ext = ext.lower().lstrip(".")
        if not ext.isalnum() or not ext.isascii() or len(ext) > 5:
            raise StorageError("Invalid extension")
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
