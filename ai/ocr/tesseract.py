"""Tesseract OCR provider (P39). Lazy imports: the app boots without pytesseract/Tesseract.

Text + per-word boxes + per-word confidence. Requested languages default to `ben+eng`;
languages missing from the local install are dropped (logged) as long as one remains.

O2: psm 6 is tried first, then psm 4, then (images narrower than 1500 px) psm 6 on a bicubic
upscale while the mean confidence is low (best one wins; boxes stay in ORIGINAL coordinates), every page has its own
timeout, and multi-page PDFs (<= max_pages) are concatenated with a vertical page offset on the
word boxes. Pages beyond max_pages are dropped with the warning PAGES_TRUNCATED.
"""
from __future__ import annotations

import io
import logging
from statistics import fmean

from ai.ocr.base import OCRResult, OCRWord, ProviderError

logger = logging.getLogger("landshield.ocr.tesseract")

DEFAULT_LANG = "ben+eng"
MIN_WIDTH = 1500  # px; narrower images are upscaled to this width
RETRY_BELOW = 0.6  # mean confidence under which the second page-segmentation mode is tried
PSM_ORDER = (6, 4)


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
    """Rebuild text lines from word boxes (P41): Tesseract's block order can split a label
    column from its value column; words whose vertical centres fall in the same row belong
    on one line, ordered left to right."""
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
    return "\n".join(" ".join(x.text for x in sorted(r, key=lambda x: x.bbox[0])) for r in rows)


class TesseractOCRProvider:
    name = "tesseract"

    def __init__(
        self,
        lang: str = DEFAULT_LANG,
        preprocess: bool = False,
        timeout_s: int = 30,
        max_pages: int = 5,
    ) -> None:
        self.lang = lang or DEFAULT_LANG
        self.preprocess = preprocess
        self.timeout_s = timeout_s
        self.max_pages = max(1, max_pages)

    def _pages(self, data: bytes, file_type: str) -> tuple[list, list[str]]:
        """Grayscale page arrays (<= max_pages) and warnings."""
        import numpy as np  # noqa: PLC0415

        warnings: list[str] = []
        if file_type.lower() == "pdf":
            from ai.preprocessing.pdf import pdf_page_count, pdf_to_array  # noqa: PLC0415

            n = pdf_page_count(data)
            if n > self.max_pages:
                warnings.append("PAGES_TRUNCATED")
            arrays = [pdf_to_array(data, page=i) for i in range(min(n, self.max_pages))]
        else:
            from PIL import Image  # noqa: PLC0415

            try:
                img = Image.open(io.BytesIO(data))
                img.load()
            except Exception as exc:
                raise ProviderError("IMAGE_DECODE_FAILED", "could not decode image") from exc
            arrays = [np.asarray(img.convert("L"))]
        if self.preprocess:
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

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        pt = _import_pytesseract()
        lang = resolve_lang(self.lang, installed_languages())
        arrays, warnings = self._pages(data, file_type)
        words: list[OCRWord] = []
        texts: list[str] = []
        offset = 0
        for arr in arrays:
            page_words = self._page(pt, arr, lang)
            texts.append(_geometric_text(page_words) if page_words else "")
            words += [
                OCRWord(w.text, w.confidence, (w.bbox[0], w.bbox[1] + offset, w.bbox[2], w.bbox[3]))
                for w in page_words
            ]
            offset += arr.shape[0]
        conf = round(fmean(w.confidence for w in words), 4) if words else 0.0
        return OCRResult(
            text="\n\n".join(t for t in texts if t),
            confidence=conf,
            provider=self.name,
            words=tuple(words),
            warnings=tuple(warnings),
        )
