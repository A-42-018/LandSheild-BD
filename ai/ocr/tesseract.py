"""Tesseract OCR provider (P39). Lazy imports: the app boots without pytesseract/Tesseract.

Text + per-word boxes + per-word confidence. Requested languages default to `ben+eng`;
languages missing from the local install are dropped (logged) as long as one remains.

O2: psm 6 is tried first, then psm 4, then (images narrower than 1500 px) psm 6 on a bicubic
upscale while the mean confidence is low (best one wins; boxes stay in ORIGINAL coordinates), every page has its own
timeout, and multi-page PDFs (<= max_pages) are concatenated with a vertical page offset on the
word boxes. Pages beyond max_pages are dropped with the warning PAGES_TRUNCATED.

H2 (`layout=True`, needs OpenCV):
- ruled tables are found first (`ai.ocr.table`), painted out of the page before the page pass
  and read cell by cell (psm 6; empty cells skipped), so the result carries `tables`
  with exact (row, col) and the text gets the table as `header: value` lines in reading order;
- missed-line recovery: Tesseract 5 sometimes returns nothing for a clean line at one text size
  (the sample deed's `ইসলাম, জাতীয়তা- …` line reads at 0.7x and 1.5x but is empty at 1x) while
  the page confidence stays high. Ink rows that got no word are re-read as a strip at 1.5x, then
  0.7x; a reading is kept only with mean confidence >= RECOVER_MIN_CONF.

`profile="historical"` renders PDFs in colour and uses the historical-scan clean-up
(`ai.preprocessing.historical`) instead of the generic one. PDFs stay at 200 dpi: on the H0 PDFs
300 dpi found fewer gold values with every pipeline (sample deed 33 -> 29 of 37).
"""
from __future__ import annotations

import io
import logging
from statistics import fmean

from ai.ocr.base import OCRCell, OCRResult, OCRTable, OCRWord, ProviderError

logger = logging.getLogger("landshield.ocr.tesseract")

DEFAULT_LANG = "ben+eng"
MIN_WIDTH = 1500  # px; narrower images are upscaled to this width
RETRY_BELOW = 0.6  # mean confidence under which the second page-segmentation mode is tried
PSM_ORDER = (6, 4)
RECOVER_SCALES = (1.5, 0.7)
RECOVER_MIN_CONF = 0.5
RECOVER_MAX = 10  # missed-line spots re-read per page
BANGLA_FIRST_SLACK = 0.03  # `ben`-only cell reading may be this much less confident and still win
SPLIT_DEPTH = 3  # an unreadable strip is cut in half at most this many times (<= 8 pieces)
PROFILES = ("modern", "historical")


def _import_pytesseract():
    try:
        import pytesseract  # noqa: PLC0415
    except ImportError as exc:
        raise ProviderError("TESSERACT_NOT_INSTALLED", "pytesseract is not installed") from exc
    return pytesseract


def installed_languages() -> list[str]:
    """Languages known to the local Tesseract. Raises ProviderError if it cannot run."""
    pt = _import_pytesseract()
    try:
        return list(pt.get_languages(config=""))
    except Exception as exc:  # binary missing / not executable
        raise ProviderError("TESSERACT_NOT_INSTALLED", "Tesseract binary not found") from exc


def is_available() -> bool:
    try:
        return bool(installed_languages())
    except ProviderError:
        return False


def resolve_lang(requested: str, installed: list[str]) -> str:
    wanted = [x for x in requested.replace(",", "+").split("+") if x.strip()]
    have = [x for x in wanted if x in installed]
    if not have:
        raise ProviderError("TESSERACT_LANG_MISSING", f"none of {requested!r} installed")
    if len(have) < len(wanted):
        missing = sorted(set(wanted) - set(have))
        logger.warning("tesseract_lang_missing", extra={"missing": missing})
    return "+".join(have)


def _geometric_text(words: list[OCRWord]) -> str:
    return "\n".join(t for _, t in _geometric_rows(words))


def _geometric_rows(words: list[OCRWord]) -> list[tuple[float, str]]:
    """Rebuild text lines from word boxes (P41): Tesseract's block order can split a label
    column from its value column; words whose vertical centres fall in the same row belong
    on one line, ordered left to right. Returns (top of the line, text) per line."""
    rows: list[list[OCRWord]] = []
    for w in sorted(words, key=lambda x: x.bbox[1] + x.bbox[3] / 2):
        cy = w.bbox[1] + w.bbox[3] / 2
        for row in rows:
            ref = row[0]
            if abs(cy - (ref.bbox[1] + ref.bbox[3] / 2)) <= 0.6 * max(w.bbox[3], ref.bbox[3]):
                row.append(w)
                break
        else:
            rows.append([w])
    return [
        (min(x.bbox[1] for x in r), " ".join(x.text for x in sorted(r, key=lambda x: x.bbox[0])))
        for r in rows
    ]


def _shift(words: list[OCRWord], dx: float, dy: float, scale: float = 1.0) -> list[OCRWord]:
    """Word boxes of a (scaled) crop -> page coordinates."""
    return [
        OCRWord(w.text, w.confidence, (round(w.bbox[0] / scale + dx), round(w.bbox[1] / scale + dy),
                                       round(w.bbox[2] / scale), round(w.bbox[3] / scale)))
        for w in words
    ]  # fmt: skip


def _offset_table(t: OCRTable, dy: int) -> OCRTable:
    """A page's table moved down by the height of the pages above it."""

    def down(b: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        return (b[0], b[1] + dy, b[2], b[3])

    cells = tuple(
        OCRCell(c.row, c.col, c.text, c.confidence, down(c.bbox), c.colspan, c.rowspan)
        for c in t.cells
    )
    return OCRTable(t.page, down(t.bbox), t.n_rows, t.n_cols, cells)


def _resize(arr, scale: float):
    import cv2  # noqa: PLC0415

    interp = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    return cv2.resize(arr, None, fx=scale, fy=scale, interpolation=interp)


def _gap(crop) -> int | None:
    """Column to cut an unreadable strip at: a word gap (blank run between ink, >= 60 % as wide
    as the widest one) in the middle half of the inked span, the one nearest the middle."""
    import numpy as np  # noqa: PLC0415

    from ai.ocr.table import ink  # noqa: PLC0415

    if not crop.size:
        return None
    cols = np.nonzero((ink(crop) > 0).any(axis=0))[0]
    if cols.size < 2:
        return None
    x0, x1 = int(cols[0]), int(cols[-1])
    lo, hi = x0 + (x1 - x0) / 4, x1 - (x1 - x0) / 4
    gaps = [(int(b - a - 1), (int(a) + int(b)) // 2) for a, b in zip(cols, cols[1:], strict=False)
            if b - a - 1 >= 3 and lo <= (a + b) / 2 <= hi]  # fmt: skip
    if not gaps:
        return None
    widest = max(g[0] for g in gaps)
    mid = (x0 + x1) / 2
    return min((g for g in gaps if g[0] >= 0.6 * widest), key=lambda g: abs(g[1] - mid))[1]


def _readable(words: list[OCRWord]) -> bool:
    letters = sum(ch.isalnum() for w in words for ch in w.text)
    return letters >= 2 and fmean(w.confidence for w in words) >= RECOVER_MIN_CONF


class TesseractOCRProvider:
    name = "tesseract"

    def __init__(
        self,
        lang: str = DEFAULT_LANG,
        preprocess: bool = False,
        timeout_s: int = 30,
        max_pages: int = 5,
        layout: bool = True,
        profile: str = "modern",
    ) -> None:
        self.lang = lang or DEFAULT_LANG
        self.preprocess = preprocess
        self.timeout_s = timeout_s
        self.max_pages = max(1, max_pages)
        self.layout = layout
        self.profile = profile if profile in PROFILES else "modern"

    def _pages(self, data: bytes, file_type: str) -> tuple[list, list[str]]:
        """Grayscale page arrays (<= max_pages) and warnings."""
        import numpy as np  # noqa: PLC0415

        warnings: list[str] = []
        historical = self.profile == "historical"
        if file_type.lower() == "pdf":
            from ai.preprocessing.pdf import pdf_page_count, pdf_to_array  # noqa: PLC0415

            n = pdf_page_count(data)
            if n > self.max_pages:
                warnings.append("PAGES_TRUNCATED")
            kw = {"color": True} if historical else {}  # colour for red-seal removal
            arrays = [pdf_to_array(data, page=i, **kw) for i in range(min(n, self.max_pages))]
        else:
            from PIL import Image  # noqa: PLC0415

            try:
                img = Image.open(io.BytesIO(data))
                img.load()
            except Exception as exc:
                raise ProviderError("IMAGE_DECODE_FAILED", "could not decode image") from exc
            arrays = [np.asarray(img.convert("RGB" if historical else "L"))]
        if historical:
            from ai.preprocessing.historical import prepare  # noqa: PLC0415

            arrays = [prepare(a, photo=file_type.lower() != "pdf") for a in arrays]
        elif self.preprocess:
            from ai.preprocessing.pipeline import preprocess_array  # noqa: PLC0415

            arrays = [preprocess_array(a) for a in arrays]
        return arrays, warnings

    @staticmethod
    def _upscale(arr):
        """(array, scale). Upscales with bicubic interpolation when narrower than MIN_WIDTH."""
        h, w = arr.shape[:2]
        if w >= MIN_WIDTH:
            return arr, 1.0
        scale = MIN_WIDTH / w
        try:
            import cv2  # noqa: PLC0415

            return cv2.resize(arr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC), scale
        except ImportError:
            import numpy as np  # noqa: PLC0415
            from PIL import Image  # noqa: PLC0415

            resized = Image.fromarray(arr).resize((MIN_WIDTH, round(h * scale)), Image.BICUBIC)
            return np.asarray(resized), scale

    def _run(self, pt, img, lang: str, psm: int) -> tuple[list[OCRWord], float]:
        try:
            d = pt.image_to_data(
                img,
                lang=lang,
                config=f"--psm {psm}",
                output_type=pt.Output.DICT,
                timeout=self.timeout_s,
            )
        except RuntimeError as exc:  # pytesseract raises RuntimeError("Tesseract process timeout")
            if "timeout" in str(exc).lower():
                raise ProviderError("OCR_TIMEOUT", "Tesseract timed out") from exc
            raise ProviderError("OCR_FAILED", "Tesseract failed") from exc
        except Exception as exc:
            raise ProviderError("OCR_FAILED", "Tesseract failed") from exc
        words: list[OCRWord] = []
        for i, raw in enumerate(d["text"]):
            text = (raw or "").strip()
            conf = float(d["conf"][i])
            if not text or conf < 0:
                continue
            words.append(
                OCRWord(
                    text=text,
                    confidence=round(min(conf, 100.0) / 100.0, 4),
                    bbox=(int(d["left"][i]), int(d["top"][i]), int(d["width"][i]), int(d["height"][i])),
                )
            )
        return words, (fmean(w.confidence for w in words) if words else 0.0)

    def _page(self, pt, arr, lang: str) -> list[OCRWord]:
        """Best of: psm 6; psm 4; psm 6 on an upscaled copy (only narrow images). A later attempt
        runs only while the best mean confidence is still below RETRY_BELOW. Upscaling is a
        retry, not the first step: measured on the 900 px synthetic forms it made good scans
        worse (text is already large enough) and only helps when the first pass is poor."""
        from PIL import Image  # noqa: PLC0415

        plan = [(psm, False) for psm in PSM_ORDER]
        if arr.shape[1] < MIN_WIDTH:
            plan.append((PSM_ORDER[0], True))
        best: tuple[list[OCRWord], float] | None = None
        for psm, up in plan:
            big, scale = self._upscale(arr) if up else (arr, 1.0)
            words, conf = self._run(pt, Image.fromarray(big), lang, psm)
            if scale != 1.0:  # back to ORIGINAL coordinates
                words = [
                    OCRWord(w.text, w.confidence, tuple(round(v / scale) for v in w.bbox))  # type: ignore[arg-type]
                    for w in words
                ]
            if best is None or conf > best[1]:
                best = (words, conf)
            if best[1] >= RETRY_BELOW:
                break
        assert best is not None
        return best[0]

    def _cells(self, pt, arr, rules, grid, lang: str, page: int) -> OCRTable:
        """Read every cell of one grid. Empty cells are not sent to Tesseract."""
        from ai.ocr.table import cell_crop, has_text  # noqa: PLC0415

        cells = []
        for c in grid.cells:
            crop, (ox, oy) = cell_crop(arr, rules, c.box)
            words: list[OCRWord] = []
            if has_text(crop):  # psm 6 even for one line: psm 7 dropped bold `জেলা` at 200 dpi
                words = self._strip(pt, crop, lang, psm=6, scales=(1.0, *RECOVER_SCALES))
                words = _shift(self._bangla_first(pt, crop, lang, words), ox, oy)
            x0, y0, x1, y1 = c.box
            cells.append(OCRCell(
                row=c.row, col=c.col, colspan=c.colspan, rowspan=c.rowspan,
                text=_geometric_text(words) if words else "",
                confidence=round(fmean(w.confidence for w in words), 4) if words else 0.0,
                bbox=(x0, y0, x1 - x0, y1 - y0),
            ))  # fmt: skip
        return OCRTable(page, grid.bbox, grid.n_rows, grid.n_cols, tuple(cells))

    def _bangla_first(self, pt, crop, lang: str, words: list[OCRWord]) -> list[OCRWord]:
        """Mixed `ben+eng` reads Bangla digits/number words as Latin (`০.৪০` -> `0.80`,
        `একশত বাহাত্তর` -> `TRIGA`). A cell with ASCII letters or digits is read again with
        `ben` alone; that reading wins unless it is clearly less confident (real English such
        as `(Boundaries)` comes back as low-confidence Bangla and loses)."""
        langs = lang.split("+")
        if "ben" not in langs or len(langs) == 1 or not any(
            ch.isascii() and ch.isalnum() for w in words for ch in w.text
        ):
            return words
        from PIL import Image  # noqa: PLC0415

        alt, conf = self._run(pt, Image.fromarray(crop), "ben", 6)
        if alt and conf >= fmean(w.confidence for w in words) - BANGLA_FIRST_SLACK:
            return alt
        return words

    def _strip(
        self, pt, crop, lang: str, psm: int, scales: tuple[float, ...], depth: int = SPLIT_DEPTH
    ) -> list[OCRWord]:
        """First readable result over the scales (crop coordinates). When no scale reads it, the
        strip is cut at its widest blank gap near the middle and both halves are read: Tesseract 5
        can drop a whole line because of one segment (`উত্তরে- নিতাই` on hd04), and a cut keeps
        the loss to that segment."""
        from PIL import Image  # noqa: PLC0415

        for sc in scales:
            img = crop if sc == 1.0 else _resize(crop, sc)
            words, _ = self._run(pt, Image.fromarray(img), lang, psm)
            if words and _readable(words):
                return _shift(words, 0, 0, sc)
        cut = _gap(crop) if depth > 0 else None
        if cut is None:
            return []
        left = self._strip(pt, crop[:, :cut], lang, psm, scales, depth - 1)
        right = self._strip(pt, crop[:, cut:], lang, psm, scales, depth - 1)
        return left + _shift(right, cut, 0)

    def _recover(self, pt, arr, bw, words: list[OCRWord], lang: str) -> list[OCRWord]:
        """Re-read text lines that have ink but no word (see module docstring). Ink inside word
        boxes, specks and fragments shorter than a third of a line are ignored; each remaining
        row band is split into ink clusters, and at most RECOVER_MAX clusters (most ink first)
        are read."""
        import cv2  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415

        rest = bw.copy()
        for w in words:
            x, y, ww, hh = w.bbox
            rest[max(y - 4, 0) : y + hh + 4, max(x - 4, 0) : x + ww + 4] = 0
        heights = sorted(w.bbox[3] for w in words)
        mh = heights[len(heights) // 2] if heights else 30
        n, labels, stats, _ = cv2.connectedComponentsWithStats(rest, connectivity=8)
        keep = np.zeros(n, bool)
        keep[1:] = stats[1:, cv2.CC_STAT_HEIGHT] >= mh / 3
        rest = np.where(keep[labels], 255, 0).astype(np.uint8)
        rows = (rest > 0).sum(axis=1) >= max(15, arr.shape[1] // 200)
        runs: list[list[int]] = []
        for y in np.nonzero(rows)[0].tolist():
            if runs and y - runs[-1][1] <= max(2, mh // 3):
                runs[-1][1] = y
            else:
                runs.append([y, y])
        spots: list[tuple[int, int, int, int, int]] = []  # (ink, y0, y1, x0, x1)
        for y0, y1 in runs:
            if not 0.5 * mh <= y1 - y0 + 1 <= 2.5 * mh:
                continue
            ink_cols = rest[y0 : y1 + 1].sum(axis=0) // 255
            cols = np.nonzero(ink_cols)[0]
            for part in np.split(cols, np.nonzero(np.diff(cols) > 2 * mh)[0] + 1):
                if part.size and part[-1] - part[0] >= 2 * mh:
                    spots.append((int(ink_cols[part].sum()), y0, y1, int(part[0]), int(part[-1])))
        found: list[OCRWord] = []
        m = max(6, mh // 3)
        for _, y0, y1, x0, x1 in sorted(spots, reverse=True)[:RECOVER_MAX]:
            top, left = max(y0 - m, 0), max(x0 - m, 0)
            crop = arr[top : y1 + m + 1, left : x1 + m + 1]
            words_ = self._strip(pt, crop, lang, psm=7, scales=RECOVER_SCALES, depth=1)
            found += _shift(words_, left, top)
        return found

    def _read_page(
        self, pt, arr, lang: str, page: int
    ) -> tuple[list[OCRWord], str, list[OCRTable]]:
        """(words, text, tables) of one page in page coordinates."""
        lines = None
        if self.layout:
            try:
                from ai.ocr.table import analyse  # noqa: PLC0415

                lines = analyse(arr)
            except ImportError:  # OpenCV missing: plain page OCR
                lines = None
        body = arr
        if lines is not None and lines.grids:
            body = arr.copy()
            for g in lines.grids:
                x, y, w, h = g.bbox
                body[y : y + h, x : x + w] = int(arr[y : y + h, x : x + w].max())
        words = self._page(pt, body, lang)
        if lines is not None:
            masked = lines.bw & ~lines.rules
            for g in lines.grids:
                x, y, w, h = g.bbox
                masked[y : y + h, x : x + w] = 0
            words += self._recover(pt, body, masked, words, lang)
        tables: list[OCRTable] = []
        parts = _geometric_rows(words)
        if lines is not None:
            from ai.ocr.table import table_text  # noqa: PLC0415

            tables = [self._cells(pt, arr, lines.rules, g, lang, page) for g in lines.grids]
            parts += [(t.bbox[1], table_text(t)) for t in tables]
        text = "\n".join(t for _, t in sorted(parts, key=lambda p: p[0]) if t)
        words += [w for t in tables for w in self._cell_words(t)]
        return words, text, tables

    @staticmethod
    def _cell_words(t: OCRTable) -> list[OCRWord]:
        """One pseudo-word per non-empty cell so callers that locate values by word box
        (rules extractor) find table values too."""
        return [OCRWord(c.text, c.confidence, c.bbox) for c in t.cells if c.text]

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        pt = _import_pytesseract()
        lang = resolve_lang(self.lang, installed_languages())
        arrays, warnings = self._pages(data, file_type)
        words: list[OCRWord] = []
        texts: list[str] = []
        tables: list[OCRTable] = []
        offset = 0
        for i, arr in enumerate(arrays):
            page_words, page_text, page_tables = self._read_page(pt, arr, lang, i)
            texts.append(page_text)
            words += _shift(page_words, 0, offset)
            tables += [_offset_table(t, offset) for t in page_tables]
            offset += arr.shape[0]
        conf = round(fmean(w.confidence for w in words), 4) if words else 0.0
        return OCRResult(
            text="\n\n".join(t for t in texts if t),
            confidence=conf,
            provider=self.name,
            words=tuple(words),
            warnings=tuple(warnings),
            tables=tuple(tables),
        )
