"""Preprocessing pipeline, opt-in via PREPROCESS=on (R8). Off => bytes returned untouched."""
from __future__ import annotations

import cv2
import numpy as np

from ai.ocr.base import ProviderError
from ai.preprocessing import ops
from ai.preprocessing.pdf import pdf_to_array

_ON = {"on", "true", "1", "yes"}


def is_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in _ON


def decode(data: bytes, file_type: str) -> np.ndarray:
    if file_type.lower() == "pdf":
        return pdf_to_array(data)
    img = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ProviderError("IMAGE_DECODE_FAILED", "could not decode image")
    return img


def preprocess_array(img: np.ndarray) -> np.ndarray:
    """grayscale -> denoise -> CLAHE -> deskew -> auto-crop."""
    gray = ops.clahe(ops.denoise(ops.to_gray(img)))
    gray, _ = ops.deskew(gray)
    return ops.autocrop(gray)


def preprocess(data: bytes, file_type: str, enabled: bool) -> tuple[bytes, str]:
    """(bytes, file_type) for the OCR stage. Flag off => input returned unchanged."""
    if not enabled:
        return data, file_type
    ok, buf = cv2.imencode(".png", preprocess_array(decode(data, file_type)))
    if not ok:
        raise ProviderError("PREPROCESS_FAILED", "could not encode image")
    return buf.tobytes(), "png"
