"""H2: ruled-table grid detection, cell crops, table text and the Tesseract table path."""
from pathlib import Path

import pytest

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")

from ai.ocr import tesseract as tess  # noqa: E402
from ai.ocr.base import OCRCell, OCRTable  # noqa: E402
from ai.ocr.table import _ridge, analyse, cell_crop, find_grids, has_text, table_text  # noqa: E402
from ai.ocr.tesseract import _gap  # noqa: E402

HIST = Path(__file__).resolve().parents[2] / "database" / "sample_data" / "historical"
needs_tesseract = pytest.mark.skipif(not tess.is_available(), reason="tesseract not installed")


def _page(border: bool = True, stamp: bool = True) -> np.ndarray:
    """A4-ish page: page border, a tilted stamp box, a 3-row table (row 3 spans all columns)."""
    page = np.full((1400, 1000), 245, np.uint8)
    if border:
        cv2.rectangle(page, (40, 40), (960, 1360), 30, 3)
    if stamp:
        box = cv2.boxPoints(((160, 160), (140, 120), 4)).astype(np.int32)
        cv2.polylines(page, [box], True, 60, 3)
    x = [100, 300, 500, 900]
    y = [700, 760, 820, 900]
    for yy in y:
        cv2.line(page, (x[0], yy), (x[-1], yy), 40, 2)
    for xx in x:
        cv2.line(page, (xx, y[0]), (xx, y[2] if xx not in (x[0], x[-1]) else y[3]), 40, 2)
    cv2.putText(page, "Mouza", (120, 740), cv2.FONT_HERSHEY_SIMPLEX, 1, 0, 2)
    return page


def test_grid_found_with_spans_and_border_and_stamp_ignored():
    grids = find_grids(_page())
    assert len(grids) == 1
    g = grids[0]
    assert (g.n_rows, g.n_cols) == (3, 3)
    shape = sorted((c.row, c.col, c.colspan, c.rowspan) for c in g.cells)
    assert shape == [
        (0, 0, 1, 1), (0, 1, 1, 1), (0, 2, 1, 1),
        (1, 0, 1, 1), (1, 1, 1, 1), (1, 2, 1, 1),
        (2, 0, 3, 1),
    ]  # fmt: skip


def test_lone_boxes_are_not_tables():
    page = np.full((800, 600), 250, np.uint8)
    cv2.rectangle(page, (20, 20), (580, 780), 0, 3)
    cv2.rectangle(page, (100, 100), (250, 200), 0, 3)
    assert find_grids(page) == []


def test_missing_line_merges_rows_into_rowspan():
    page = np.full((600, 600), 250, np.uint8)
    x, y = [50, 250, 550], [100, 160, 220, 280]
    for yy in y:
        start = x[1] if yy == 160 else x[0]  # no line at 160 under col 0
        cv2.line(page, (start, yy), (x[-1], yy), 0, 2)
    for xx in x:
        cv2.line(page, (xx, y[0]), (xx, y[-1]), 0, 2)
    g = find_grids(page)[0]
    first = next(c for c in g.cells if c.col == 0 and c.row == 0)
    assert first.rowspan == 2 and g.n_rows == 3


def test_ridge_sees_a_faint_line_the_mask_misses():
    strip = np.full((40, 200), 200, np.uint8)
    strip[19:21] = 185  # a line 15 levels darker than the grey fill around it
    assert _ridge(strip, 20, 0, 200)
    assert not _ridge(np.full((40, 200), 200, np.uint8), 20, 0, 200)


def test_cell_crop_paints_rules_and_finds_text():
    page = _page()
    lines = analyse(page)
    cell = next(c for c in lines.grids[0].cells if (c.row, c.col) == (0, 0))
    crop, (ox, oy) = cell_crop(page, lines.rules, cell.box)
    assert crop.shape[0] > 40 and (ox, oy) == (cell.box[0] + 3 - 12, cell.box[1] + 3 - 12)
    assert has_text(crop)
    empty = next(c for c in lines.grids[0].cells if (c.row, c.col) == (1, 1))
    assert not has_text(cell_crop(page, lines.rules, empty.box)[0])  # its borders were painted out


def _t(rows: list[list[tuple[int, int, str]]]) -> OCRTable:
    cells = tuple(
        OCRCell(r, col, text, 0.9, (0, 0, 1, 1), span)
        for r, row in enumerate(rows)
        for col, span, text in row
    )
    return OCRTable(0, (0, 0, 1, 1), len(rows), 5, cells)


def test_table_text_header_values_and_pairs():
    t = _t([
        [(0, 1, "জেলা"), (1, 1, "থানা"), (2, 1, "মৌজা"), (3, 1, "সি.এস. খতিয়ান নং"), (4, 1, "দাগ নং")],
        [(0, 1, "ঢাকা"), (1, 1, "রূপগঞ্জ"), (2, 1, "ভবানীপুর"), (3, 1, "১২০"), (4, 1, "৪৫৫")],
        [(0, 2, "জমির পরিমাণ"), (2, 3, "০.৫০ একর")],
        [(0, 2, "চৌহদ্দি:"), (2, 3, "উত্তরে- খাল")],
    ])  # fmt: skip
    assert table_text(t).splitlines() == [
        "জেলা: ঢাকা", "থানা: রূপগঞ্জ", "মৌজা: ভবানীপুর", "সি.এস. খতিয়ান নং: ১২০", "দাগ নং: ৪৫৫",
        "জমির পরিমাণ: ০.৫০ একর", "চৌহদ্দি: উত্তরে- খাল",
    ]  # fmt: skip
    g = t.grid()
    assert g[1][3] == "১২০" and g[2][1] is None and t.to_dict()["cells"][10]["colspan"] == 2


def test_gap_cuts_between_words_not_in_the_margin():
    strip = np.full((40, 600), 255, np.uint8)
    for x0 in (20, 140, 260):  # three "words", then a wide empty right margin
        strip[10:30, x0 : x0 + 100] = 0
    assert 240 <= _gap(strip) <= 260
    assert _gap(np.full((40, 100), 255, np.uint8)) is None


@needs_tesseract
def test_sample_deed_done_criteria():
    """H2 done: on the sample PDF the chosen text has বিক্রেতা, তপশিল, ১২০, ৪৫৫ and the
    schedule table comes back as a grid."""
    from ai.ocr.router import AutoOCRProvider

    data = (HIST / "Historical_Land_Deed.pdf").read_bytes()
    r = AutoOCRProvider(demo_fixtures=False).recognize(data, "pdf")
    assert r.provider == "tesseract" and "TEXT_LAYER_REJECTED" in r.warnings
    for word in ("বিক্রেতা", "তপশিল", "১২০", "৪৫৫"):
        assert word in r.text
    assert "ইসলাম" in r.text and "হিন্দু" in r.text  # missed-line recovery (religion lines)
    t = r.tables[0]
    g = t.grid()
    assert (t.n_rows, t.n_cols) == (4, 5)
    assert g[0][2] == "মৌজা" and g[1][2] == "ভবানীপুর" and g[1][3] == "১২০" and g[1][4] == "৪৫৫"
    assert "০.৫০ একর" in g[2][2] and g[2][1] is None
    assert "মৌজা: ভবানীপুর" in r.text
