"""Tesseract OCR provider (P39). Lazy imports: the app boots without pytesseract/Tesseract.

Text + per-word boxes + per-word confidence. Requested languages default to `ben+eng`;
languages missing from the local install are dropped (logged) as long as one remains.
"""
from __future__ import annotations

import io
import logging
from statistics import fmean

from ai.ocr.base import OCRResult, OCRWord, ProviderError

logger = logging.getLogger("landshield.ocr.tesseract")

DEFAULT_LANG = "ben+eng"


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

    def __init__(self, lang: str = DEFAULT_LANG, preprocess: bool = False) -> None:
        self.lang = lang or DEFAULT_LANG
        self.preprocess = preprocess

    def _image(self, data: bytes, file_type: str):
        from PIL import Image  # noqa: PLC0415

        if self.preprocess:
            from ai.preprocessing import preprocess as run_pre  # noqa: PLC0415

            data, file_type = run_pre(data, file_type, True)
        if file_type.lower() == "pdf":
            from ai.preprocessing.pdf import pdf_to_array  # noqa: PLC0415

            return Image.fromarray(pdf_to_array(data))
        try:
            img = Image.open(io.BytesIO(data))
            img.load()
        except Exception as exc:
            raise ProviderError("IMAGE_DECODE_FAILED", "could not decode image") from exc
        return img.convert("L")

    def recognize(self, data: bytes, file_type: str) -> OCRResult:
        pt = _import_pytesseract()
        lang = resolve_lang(self.lang, installed_languages())
        img = self._image(data, file_type)
        try:
            d = pt.image_to_data(img, lang=lang, output_type=pt.Output.DICT)
        except Exception as exc:
            raise ProviderError("OCR_FAILED", "Tesseract failed") from exc

        words: list[OCRWord] = []
        lines: dict[tuple[int, int, int], list[str]] = {}
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
            key = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
            lines.setdefault(key, []).append(text)
        text_out = _geometric_text(words) if words else "\n".join(" ".join(v) for v in lines.values())
        conf_out = round(fmean(w.confidence for w in words), 4) if words else 0.0
        return OCRResult(text=text_out, confidence=conf_out, provider=self.name, words=tuple(words))
