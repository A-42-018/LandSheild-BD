"""Ruled-table reading (H2). OpenCV finds the grid, the caller OCRs each cell.

Page OCR turns a bordered table into noise (`[লা [aeees [we` on the sample deed's schedule), and
even when it reads the cells it loses which header a value belongs to. Here the grid is found
from its ruling lines, so every cell keeps its `(row, col)` and merged cells keep their span:

1. ink mask (adaptive threshold) -> long horizontal / vertical runs by morphological opening;
   word headlines (মাত্রা) are shorter than the kernel and drop out
2. each connected group of lines with >= 3 horizontal and >= 3 vertical lines is a table
   (a lone box such as a stamp or the page border is not)
3. per row band, the vertical lines crossing it split it into cells; all splits together give
   the column edges, so a cell spanning columns gets `colspan` > 1; a missing horizontal line
   above a cell merges it into the cell above (`rowspan`)

`table_text()` turns a read table into lines the text extractors understand: a header row over
value rows becomes `header: value` pairs, a two-cell row `label: value`.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from ai.ocr.base import OCRCell, OCRTable

H_KERNEL_FRAC = 0.08  # horizontal line kernel = 8 % of page width (longer than a word headline)
V_KERNEL_FRAC = 0.012  # vertical line kernel = 1.2 % of page height (taller than a letter)
LINE_COVER = 0.6  # a separator must cover 60 % of the row band / cell width
NO_LINE = 0.2  # under 20 % of a cell's top edge ruled = no line (merged); faded scans keep more
RIDGE_PX, RIDGE_DARKER = 8, 8  # faint-line test: +-8 px window, line rows >= 8 grey levels darker
MIN_ROW_PX = 12  # thinner bands are double lines, not rows
CLUSTER_PX = 8  # line positions closer than this are one line


@dataclass(frozen=True)
class CellBox:
    row: int
    col: int
    colspan: int
    rowspan: int
    box: tuple[int, int, int, int]  # x0, y0, x1, y1 inside the ruling lines


@dataclass(frozen=True)
class Grid:
    bbox: tuple[int, int, int, int]  # left, top, width, height
    n_rows: int
    n_cols: int
    cells: tuple[CellBox, ...]


def ink(gray: np.ndarray) -> np.ndarray:
    """uint8 mask, 255 where there is dark ink (adaptive, so tinted paper and shadows pass)."""
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15
    )


def line_masks(bw: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(horizontal, vertical) ruling-line masks of an ink mask."""
    h, w = bw.shape
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (max(25, round(w * H_KERNEL_FRAC)), 1))
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, round(h * V_KERNEL_FRAC))))
    return cv2.morphologyEx(bw, cv2.MORPH_OPEN, hk), cv2.morphologyEx(bw, cv2.MORPH_OPEN, vk)


def _cluster(positions: np.ndarray) -> list[int]:
    """Centres of runs of positions that are within CLUSTER_PX of each other."""
    out: list[int] = []
    run: list[int] = []
    for p in positions.tolist():
        if run and p - run[-1] > CLUSTER_PX:
            out.append(round(sum(run) / len(run)))
            run = []
        run.append(p)
    if run:
        out.append(round(sum(run) / len(run)))
    return out


def _nearest(edges: list[int], x: int) -> int:
    return min(range(len(edges)), key=lambda i: abs(edges[i] - x))


def _ridge(gray: np.ndarray, y: int, x0: int, x1: int) -> bool:
    """A faint ruling line at row y over [x0, x1): the rows there are darker than the rows a few
    pixels above and below. Catches lines the ink mask misses (grey header fill on a faded scan)."""
    top = max(y - RIDGE_PX, 0)
    band = gray[top : y + RIDGE_PX + 1, x0 + 5 : x1 - 5].astype(np.float32)
    if band.shape[0] < 2 * RIDGE_PX or band.shape[1] < 3:
        return False
    p = band.mean(axis=1)
    centre = p[RIDGE_PX - 3 : RIDGE_PX + 4].min()
    return min(p[:3].mean(), p[-3:].mean()) - centre >= RIDGE_DARKER


def _grid(gray: np.ndarray, hm: np.ndarray, vm: np.ndarray, x: int, y: int) -> Grid | None:
    """Grid of one line component (page crop and masks cropped to it; x, y = crop origin)."""
    h, w = hm.shape
    ys = _cluster(np.nonzero(hm.sum(axis=1) / 255 >= 0.15 * w)[0])
    if len(ys) < 3:
        return None
    rows: list[tuple[int, int, list[int]]] = []  # (top line, bottom line, vertical splits)
    for top, bot in zip(ys, ys[1:], strict=False):
        if bot - top < MIN_ROW_PX:
            continue
        band = vm[top + 3 : bot - 2]
        splits = _cluster(np.nonzero(band.sum(axis=0) / 255 >= LINE_COVER * band.shape[0])[0])
        if len(splits) >= 2:
            rows.append((top, bot, splits))
    if len(rows) < 2 or max(len(r[2]) for r in rows) < 3:
        return None
    edges = _cluster(np.array(sorted(s for r in rows for s in r[2])))
    cells: list[dict] = []
    for r, (top, bot, splits) in enumerate(rows):
        for a, b in zip(splits, splits[1:], strict=False):
            c0, c1 = _nearest(edges, a), _nearest(edges, b)
            if c1 <= c0:
                continue
            above = next(
                (c for c in cells if c["col"] == c0 and c["colspan"] == c1 - c0
                 and c["row"] + c["rowspan"] == r),
                None,
            )  # fmt: skip
            ruled = hm[max(top - 2, 0) : top + 3, a:b].max(axis=0) > 0
            if above is not None and ruled.mean() < NO_LINE and not _ridge(gray, top, a, b):
                # no line between: same cell
                above["rowspan"] += 1
                above["y1"] = bot
                continue
            cells.append({"row": r, "col": c0, "colspan": c1 - c0, "rowspan": 1,
                          "x0": a, "y0": top, "x1": b, "y1": bot})  # fmt: skip
    boxes = tuple(
        CellBox(c["row"], c["col"], c["colspan"], c["rowspan"],
                (c["x0"] + x, c["y0"] + y, c["x1"] + x, c["y1"] + y))
        for c in cells
    )  # fmt: skip
    return Grid((x, y, w, h), len(rows), len(edges) - 1, boxes)


@dataclass(frozen=True)
class PageLines:
    bw: np.ndarray  # ink mask
    rules: np.ndarray  # ruling lines (horizontal | vertical)
    grids: tuple[Grid, ...]  # ruled tables, top to bottom


def analyse(gray: np.ndarray) -> PageLines:
    """Ink mask, ruling lines and all ruled tables of a grayscale page."""
    bw = ink(gray)
    hm, vm = line_masks(bw)
    rules = hm | vm
    n, labels, stats, _ = cv2.connectedComponentsWithStats(
        cv2.dilate(rules, np.ones((5, 5), np.uint8)), connectivity=8
    )
    grids = []
    for i in range(1, n):
        x, y, w, h, _ = stats[i]
        if w < 50 or h < 30:
            continue
        own = labels[y : y + h, x : x + w] == i
        g = _grid(gray[y : y + h, x : x + w], np.where(own, hm[y : y + h, x : x + w], 0),
                  np.where(own, vm[y : y + h, x : x + w], 0), int(x), int(y))  # fmt: skip
        if g is not None:
            grids.append(g)
    return PageLines(bw, rules, tuple(sorted(grids, key=lambda g: g.bbox[1])))


def find_grids(gray: np.ndarray) -> list[Grid]:
    """All ruled tables on a grayscale page, top to bottom."""
    return list(analyse(gray).grids)


MARGIN = 12  # white border added around a cell crop


def cell_crop(
    gray: np.ndarray, rules: np.ndarray, box: tuple[int, int, int, int], pad: int = 3
) -> tuple[np.ndarray, tuple[int, int]]:
    """(inside of a cell on a paper-coloured margin, offset of the crop's (0, 0) on the page).
    Ruling-line pixels (page mask) are painted paper colour, so a thick or slightly skewed border
    that survives the padding does not reach Tesseract."""
    x0, y0, x1, y1 = box
    ys, xs = slice(y0 + pad, y1 - pad + 1), slice(x0 + pad, x1 - pad + 1)
    crop = gray[ys, xs].copy()
    if crop.size == 0:
        return crop, (x0, y0)
    paper = int(np.median(crop))
    crop[rules[ys, xs] > 0] = paper
    m = MARGIN
    framed = cv2.copyMakeBorder(crop, m, m, m, m, cv2.BORDER_CONSTANT, value=paper)
    return framed, (x0 + pad - MARGIN, y0 + pad - MARGIN)


def has_text(crop: np.ndarray, min_ink: int = 20) -> bool:
    """Any ink in a cell crop (empty cells are not sent to Tesseract)."""
    return bool(crop.size) and int(np.count_nonzero(ink(crop))) >= min_ink


def _label(s: str) -> str:
    return s.strip().rstrip(":：").strip()


def table_text(t: OCRTable) -> str:
    """Lines for text extractors: a header row (>= 3 cells) over rows of the same shape ->
    `header: value`; 2-cell rows -> `label: value` (two such rows in a row are two pairs, not a
    header and its value); anything else -> cells joined by ' | '."""
    by_row: dict[int, list[OCRCell]] = {}
    for c in t.cells:
        by_row.setdefault(c.row, []).append(c)
    rows = [sorted(by_row[r], key=lambda c: c.col) for r in sorted(by_row)]
    shape = [tuple((c.col, c.colspan) for c in r) for r in rows]
    out: list[str] = []
    header: list[OCRCell] | None = None
    for i, cells in enumerate(rows):
        texts = [c.text.strip() for c in cells]
        if header is not None and shape[i] == tuple((c.col, c.colspan) for c in header):
            out += [f"{_label(h.text)}: {v}" for h, v in zip(header, texts, strict=True) if v]
            continue
        header = None
        nxt = shape[i + 1] if i + 1 < len(rows) else None
        if len(cells) >= 3 and all(texts) and nxt == shape[i]:
            header = cells  # values follow on the next row(s)
        elif len(cells) == 2 and texts[0]:
            out.append(f"{_label(texts[0])}: {texts[1]}")
        elif any(texts):
            out.append(" | ".join(texts))
    return "\n".join(out)
