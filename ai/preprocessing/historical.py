"""Historical-scan clean-up (H2), used by Tesseract's `profile="historical"`.

Old deeds arrive as yellowed or brown paper with blotches, faded ink, red registry seals and
revenue stamps over the text, a faint diagonal watermark, some skew, and (phone photos) a page
that is not square to the camera. Steps, all on numpy arrays:

1. photo only: perspective correction when a page outline (4-corner contour, >= 40 % of the
   image) is found and is not already the whole frame
2. red / magenta ink (seals, stamps) is removed by colour: strongly red pixels become paper in
   the luminance image
3. background flattening: page / blurred background, so yellowing, blotches and shadows become
   white paper
4. watermark suppression: after flattening, anything lighter than WHITE_POINT is paper
5. deskew (`ops.deskew`)

Measured on the H0 scans (gold values found verbatim in the OCR text), each step left out in
turn: a 3x3 median blur and upscaling to 2000 px both made results worse (hd05 typed: 29 -> 8
and -> 21 of 40), and the red channel as grayscale lost contrast on yellow paper (hd05 scan
3 of 40 without flattening), so none of them is used.
"""
from __future__ import annotations

import cv2
import numpy as np

from ai.preprocessing import ops

WHITE_POINT = 215  # after flattening, lighter pixels are paper (faint watermark, paper grain)
BG_KERNEL_FRAC = 0.03  # background blur kernel = 3 % of the page width
RED_SAT, RED_VAL = 70, 60  # HSV saturation / value above which a red hue is stamp ink
PAGE_MIN_AREA = 0.4  # a page outline must cover 40 % of the photo


def _order(pts: np.ndarray) -> np.ndarray:
    """Corners as top-left, top-right, bottom-right, bottom-left."""
    s, d = pts.sum(axis=1), np.diff(pts, axis=1).ravel()
    corners = [pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]]
    return np.array(corners, np.float32)


def page_quad(rgb: np.ndarray) -> np.ndarray | None:
    """Four page corners of a photo, or None (no clear outline, or it is the whole frame)."""
    h, w = rgb.shape[:2]
    scale = 800 / max(h, w)
    scale = min(scale, 1.0)
    small = rgb
    if scale < 1.0:
        small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2GRAY), (5, 5), 0)
    edges = cv2.dilate(cv2.Canny(gray, 50, 150), np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sh, sw = gray.shape
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        if cv2.contourArea(c) < PAGE_MIN_AREA * sh * sw:
            break
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        quad = _order(approx.reshape(4, 2).astype(np.float32))
        frame = np.array([[0, 0], [sw - 1, 0], [sw - 1, sh - 1], [0, sh - 1]], np.float32)
        if np.abs(quad - frame).max() <= 0.02 * max(sh, sw):  # already the whole frame
            return None
        return quad / scale
    return None


def unwarp(rgb: np.ndarray, quad: np.ndarray) -> np.ndarray:
    tl, tr, br, bl = quad
    w = int(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl)))
    h = int(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr)))
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], np.float32)
    m = cv2.getPerspectiveTransform(quad, dst)
    return cv2.warpPerspective(rgb, m, (w, h), flags=cv2.INTER_CUBIC)


def red_mask(rgb: np.ndarray) -> np.ndarray:
    """uint8 mask, 255 on red / magenta ink (registry seals, stamps)."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = ((hue <= 10) | (hue >= 160)) & (sat >= RED_SAT) & (val >= RED_VAL)
    return np.where(red, 255, 0).astype(np.uint8)


def drop_red(rgb: np.ndarray) -> np.ndarray:
    """Luminance with red ink removed: red-mask pixels set to paper level."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = cv2.dilate(red_mask(rgb), np.ones((3, 3), np.uint8))
    if mask.any():
        gray[mask > 0] = int(np.percentile(gray, 90))
    return gray


def flatten(gray: np.ndarray) -> np.ndarray:
    """Divide by the blurred background: uneven, tinted paper becomes white."""
    k = max(15, round(gray.shape[1] * BG_KERNEL_FRAC)) | 1
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
    bg = cv2.GaussianBlur(bg, (k, k), 0)
    out = gray.astype(np.float32) / np.maximum(bg.astype(np.float32), 1.0) * 255.0
    return np.clip(out, 0, 255).astype(np.uint8)


def whiten(gray: np.ndarray, white: int = WHITE_POINT) -> np.ndarray:
    """Levels: WHITE_POINT and lighter -> 255, the rest stretched (faint watermark disappears)."""
    lut = np.clip(np.arange(256, dtype=np.float32) * 255.0 / white, 0, 255).astype(np.uint8)
    return cv2.LUT(gray, lut)


def prepare(img: np.ndarray, photo: bool = False) -> np.ndarray:
    """RGB (or grayscale) page -> cleaned grayscale page for OCR."""
    if img.ndim == 2:
        gray = img
    else:
        rgb = img[..., :3]
        if photo:
            quad = page_quad(rgb)
            if quad is not None:
                rgb = unwarp(rgb, quad)
        gray = drop_red(rgb)
    gray, _ = ops.deskew(whiten(flatten(gray)))
    return gray
