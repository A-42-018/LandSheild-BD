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
class OCRCell:
    row: int
    col: int
    text: str
    confidence: float  # 0..1
    bbox: tuple[int, int, int, int]  # left, top, width, height in pixels
    colspan: int = 1
    rowspan: int = 1


@dataclass(frozen=True)
class OCRTable:
    """A ruled table read cell by cell (H2). `cells` row-major; merged cells appear once."""

    page: int  # 0-based
    bbox: tuple[int, int, int, int]  # left, top, width, height in pixels
    n_rows: int
    n_cols: int
    cells: tuple[OCRCell, ...]

    def grid(self) -> list[list[str | None]]:
        """n_rows x n_cols texts; a merged cell's text sits in its top-left slot, None elsewhere."""
        g: list[list[str | None]] = [[None] * self.n_cols for _ in range(self.n_rows)]
        for c in self.cells:
            g[c.row][c.col] = c.text
        return g

    def to_dict(self) -> dict:
        return {
            "page": self.page, "bbox": list(self.bbox),
            "n_rows": self.n_rows, "n_cols": self.n_cols,
            "cells": [{"row": c.row, "col": c.col, "colspan": c.colspan, "rowspan": c.rowspan,
                       "text": c.text, "confidence": c.confidence, "bbox": list(c.bbox)}
                      for c in self.cells],
        }  # fmt: skip


@dataclass(frozen=True)
class OCRResult:
    text: str
    confidence: float  # 0..1
    provider: str
    words: tuple[OCRWord, ...] = ()  # empty for providers without word boxes (mock)
    warnings: tuple[str, ...] = ()  # e.g. PAGES_TRUNCATED, TEXT_LAYER_REJECTED
    tables: tuple[OCRTable, ...] = ()  # ruled tables read cell by cell (H2)


class OCRProvider(Protocol):
    name: str

    def recognize(self, data: bytes, file_type: str) -> OCRResult: ...
