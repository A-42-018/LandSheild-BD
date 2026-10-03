"""Upload validation (P23): extension, magic-byte sniff, size, image pixel cap, PDF cap.

Dependency-free beyond `filetype`: image dimensions are read from the PNG/JPEG headers and
the PDF page count is a conservative byte scan (real parsing arrives with OpenCV/OCR phases).
"""
import re
import struct
from dataclasses import dataclass
from pathlib import PurePosixPath

import filetype

from app.core.errors import AppError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_PDF_PAGES = 20

# sniffed kind -> (canonical extension stored, extensions accepted from the client name)
_KINDS = {
    "jpg": ("jpg", {"jpg", "jpeg"}),
    "png": ("png", {"png"}),
    "pdf": ("pdf", {"pdf"}),
}
_ALLOWED_EXTS = {e for _, exts in _KINDS.values() for e in exts}
_PAGE_RE = re.compile(rb"/Type\s*/Page(?![A-Za-z])")
_PAGES_COUNT_RE = re.compile(rb"/Type\s*/Pages\b[^>]*?/Count\s+(\d+)", re.S)


@dataclass(frozen=True)
class ValidatedUpload:
    ext: str  # canonical, from the sniffed type
    mime: str
    pages: int | None = None
    pixels: int | None = None


def _bad(code: str, message: str, status: int = 400) -> AppError:
    return AppError(code, message, status)


def client_extension(filename: str | None) -> str:
    """Extension of the basename only (handles `/` and `\\` separators); '' if none."""
    if not filename:
        return ""
    base = PurePosixPath(filename.replace("\\", "/")).name
    return PurePosixPath(base).suffix.lower().lstrip(".")


def _png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[12:16] != b"IHDR":
        raise _bad("INVALID_IMAGE", "Corrupt PNG")
    return struct.unpack(">II", data[16:24])


def _jpeg_size(data: bytes) -> tuple[int, int]:
    i, n = 2, len(data)
    while i + 4 <= n:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # standalone markers
            i += 2
            continue
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):  # SOFn
            if i + 9 > n:
                break
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height
        i += 2 + seg_len
    raise _bad("INVALID_IMAGE", "Corrupt JPEG")


def _pdf_pages(data: bytes) -> int:
    if b"%PDF-" not in data[:1024]:
        raise _bad("INVALID_PDF", "Missing PDF header")
    pages = len(_PAGE_RE.findall(data))
    if pages == 0:  # page objects may sit in compressed object streams: use /Count
        counts = [int(c) for c in _PAGES_COUNT_RE.findall(data)]
        pages = max(counts, default=0)
    return pages


def validate_upload(filename: str | None, data: bytes) -> ValidatedUpload:
    if not data:
        raise _bad("EMPTY_FILE", "File is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise _bad("FILE_TOO_LARGE", "File exceeds the 10 MB limit", 413)

    ext = client_extension(filename)
    if ext not in _ALLOWED_EXTS:
        raise _bad("UNSUPPORTED_FILE_TYPE", "Only JPG, PNG and PDF files are accepted", 415)

    kind = filetype.guess(data)
    if kind is None or kind.extension not in _KINDS:
        raise _bad("UNSUPPORTED_FILE_TYPE", "File content is not JPG, PNG or PDF", 415)
    canonical, accepted = _KINDS[kind.extension]
    if ext not in accepted:
        raise _bad("FILE_TYPE_MISMATCH", "File extension does not match its content", 415)

    if canonical == "pdf":
        pages = _pdf_pages(data)
        if pages > MAX_PDF_PAGES:
            raise _bad("PDF_TOO_MANY_PAGES", f"PDF exceeds {MAX_PDF_PAGES} pages", 413)
        return ValidatedUpload(canonical, kind.mime, pages=pages)

    width, height = _png_size(data) if canonical == "png" else _jpeg_size(data)
    if width <= 0 or height <= 0:
        raise _bad("INVALID_IMAGE", "Image has no dimensions")
    if width * height > MAX_IMAGE_PIXELS:
        raise _bad("IMAGE_TOO_LARGE", "Image resolution exceeds the allowed maximum", 413)
    return ValidatedUpload(canonical, kind.mime, pixels=width * height)
