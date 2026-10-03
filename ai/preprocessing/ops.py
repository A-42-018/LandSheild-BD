"""Pure image operations on numpy arrays (OpenCV). No I/O, no globals.

Angle convention: positive = counter-clockwise (same as PIL `Image.rotate` and
`cv2.getRotationMatrix2D`). `estimate_skew` returns the angle the content is rotated by;
`deskew` rotates by the opposite angle to undo it.
"""
from __future__ import annotations

import cv2
import numpy as np

MAX_SKEW_DEG = 10.0
_BG_FALLBACK = 255


def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return img.copy()
    if img.shape[2] == 4:
        return cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def denoise(gray: np.ndarray, strength: int = 10) -> np.ndarray:
    return cv2.fastNlMeansDenoising(
        gray, None, h=strength, templateWindowSize=7, searchWindowSize=21
    )


def clahe(gray: np.ndarray, clip_limit: float = 2.0, tile: int = 8) -> np.ndarray:
    return cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile)).apply(gray)


def _ink(gray: np.ndarray) -> np.ndarray:
    """Binary mask, 1 where there is dark content (Otsu)."""
    _, bw = cv2.threshold(gray, 0, 1, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    return bw


def _rotate(
    img: np.ndarray, angle: float, fill: int | tuple, interp: int = cv2.INTER_LINEAR
) -> np.ndarray:
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle, 1.0)
    return cv2.warpAffine(
        img, m, (w, h), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=fill
    )


def _score(ink: np.ndarray, trial: float) -> float:
    rows = _rotate(ink.astype(np.float32), trial, 0).sum(axis=1)
    return float(np.var(rows))


def estimate_skew(gray: np.ndarray, max_angle: float = MAX_SKEW_DEG) -> float:
    """Skew in degrees (CCW positive) via projection-profile search; 0.0 for blank pages."""
    scale = 800.0 / max(gray.shape[:2])
    small = gray
    if scale < 1:
        small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ink = _ink(small)
    if ink.sum() < 20:
        return 0.0
    best_t, best_s = 0.0, -1.0
    for step, span, centre in ((1.0, max_angle, 0.0), (0.1, 1.0, None)):
        c = best_t if centre is None else centre
        t = c - span
        while t <= c + span + 1e-9:
            s = _score(ink, t)
            if s > best_s:
                best_t, best_s = t, s
            t += step
    return round(-best_t, 2)  # corrective trial angle is the opposite of the skew


def background_level(gray: np.ndarray) -> int:
    """Border fill value = median of the image border (white-ish paper)."""
    edge = np.concatenate([gray[0], gray[-1], gray[:, 0], gray[:, -1]])
    return int(np.median(edge)) if edge.size else _BG_FALLBACK


def deskew(img: np.ndarray, angle: float | None = None) -> tuple[np.ndarray, float]:
    """Return (corrected image, skew angle that was removed). Angles under 0.05 deg are ignored."""
    gray = to_gray(img)
    a = estimate_skew(gray) if angle is None else angle
    if abs(a) < 0.05:
        return img, 0.0
    fill = background_level(gray)
    return _rotate(img, -a, fill if img.ndim == 2 else (fill,) * img.shape[2], cv2.INTER_CUBIC), a


def autocrop(img: np.ndarray, margin: int = 10, min_fraction: float = 0.2) -> np.ndarray:
    """Crop to the content bounding box plus margin. Returns the input when the box would be
    smaller than `min_fraction` of the page area (likely noise) or nothing is found."""
    gray = to_gray(img)
    ink = _ink(gray)
    ys, xs = np.nonzero(ink)
    if ys.size == 0:
        return img
    h, w = gray.shape
    y0, y1 = max(int(ys.min()) - margin, 0), min(int(ys.max()) + margin + 1, h)
    x0, x1 = max(int(xs.min()) - margin, 0), min(int(xs.max()) + margin + 1, w)
    if (y1 - y0) * (x1 - x0) < min_fraction * h * w:
        return img
    return img[y0:y1, x0:x1]
