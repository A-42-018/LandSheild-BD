"""OCR provider interface (D3). Providers are pure: bytes in, text + confidence out."""
from dataclasses import dataclass
from typing import Protocol


class ProviderError(Exception):
    """Raised by a provider; `code` is a language-neutral machine code."""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class OCRWord:
    text: str
    confidence: float  # 0..1
    bbox: tuple[int, int, int, int]  # left, top, width, height in pixels


@dataclass(frozen=True)
class OCRResult:
    text: str
    confidence: float  # 0..1
    provider: str
    words: tuple[OCRWord, ...] = ()  # empty for providers without word boxes (mock)


class OCRProvider(Protocol):
    name: str

    def recognize(self, data: bytes, file_type: str) -> OCRResult: ...
