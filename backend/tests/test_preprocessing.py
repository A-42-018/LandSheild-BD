"""P38: OpenCV preprocessing (pure functions, opt-in)."""
import json
from pathlib import Path

import pytest

cv2 = pytest.importorskip("cv2")
np = pytest.importorskip("numpy")

from ai.preprocessing import (  # noqa: E402
    autocrop,
    clahe,
    denoise,
    deskew,
    estimate_skew,
    is_enabled,
    preprocess,
    to_gray,
)

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "ai" / "evaluation" / "data"
CLEAN = REPO / "database" / "sample_data" / "Clean.png"


def _load(path: Path) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(path.read_bytes(), np.uint8), cv2.IMREAD_GRAYSCALE)


def _rotate(img: np.ndarray, angle: float) -> np.ndarray:
    h, w = img.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, m, (w, h), borderValue=250, flags=cv2.INTER_CUBIC)


@pytest.mark.parametrize("angle", [-4.0, -1.5, 0.0, 2.0, 5.0])
def test_estimate_skew_on_rotated_clean_doc(angle):
    est = estimate_skew(_rotate(_load(CLEAN), angle))
    assert abs(est - angle) < 1.0


def test_estimate_skew_on_eval_set_matches_ground_truth():
    docs = json.loads((DATA / "ground_truth.json").read_text())["documents"]
    checked = 0
    for d in docs:
        est = estimate_skew(_load(DATA / d["file"]))
        assert abs(est - d["variant"]["skew"]) < 1.0, d["file"]
        checked += 1
    assert checked == 20


def test_deskew_removes_skew():
    img = _rotate(_load(CLEAN), 3.0)
    fixed, removed = deskew(img)
    assert abs(removed - 3.0) < 1.0
    assert abs(estimate_skew(fixed)) < 0.6


def test_deskew_noop_when_straight():
    img = _load(CLEAN)
    out, angle = deskew(img, angle=0.0)
    assert angle == 0.0 and out is img


def test_blank_page_has_zero_skew():
    assert estimate_skew(np.full((300, 200), 255, np.uint8)) == 0.0


def test_gray_denoise_clahe_shapes_and_dtype():
    bgr = cv2.cvtColor(_load(CLEAN), cv2.COLOR_GRAY2BGR)
    g = to_gray(bgr)
    assert g.ndim == 2 and g.dtype == np.uint8
    assert denoise(g).shape == g.shape
    assert clahe(g).shape == g.shape
    assert to_gray(cv2.cvtColor(g, cv2.COLOR_GRAY2BGRA)).ndim == 2


def test_autocrop_shrinks_margins_and_keeps_content():
    page = np.full((400, 400), 255, np.uint8)
    cv2.rectangle(page, (100, 120), (300, 280), 0, -1)
    out = autocrop(page, margin=5)
    assert out.shape == (171, 211)
    assert (out == 0).sum() == (page == 0).sum()


def test_autocrop_leaves_blank_and_tiny_content_alone():
    blank = np.full((100, 100), 255, np.uint8)
    assert autocrop(blank) is blank
    speck = blank.copy()
    speck[50, 50] = 0
    assert autocrop(speck) is speck


def test_flag_parsing():
    assert is_enabled("on") and is_enabled(" ON ") and is_enabled("true")
    assert not is_enabled("off") and not is_enabled("") and not is_enabled(None)


def test_pipeline_unchanged_when_flag_off():
    data = CLEAN.read_bytes()
    out, ftype = preprocess(data, "png", enabled=False)
    assert out is data and ftype == "png"


def test_pipeline_on_returns_straightened_png():
    skewed = _rotate(_load(CLEAN), 2.5)
    ok, buf = cv2.imencode(".png", skewed)
    assert ok
    out, ftype = preprocess(buf.tobytes(), "png", enabled=True)
    assert ftype == "png" and out.startswith(b"\x89PNG")
    result = cv2.imdecode(np.frombuffer(out, np.uint8), cv2.IMREAD_GRAYSCALE)
    assert result.ndim == 2
    assert abs(estimate_skew(result)) < 1.0


def test_pipeline_bad_image_raises_provider_error():
    from ai.ocr.base import ProviderError

    with pytest.raises(ProviderError) as e:
        preprocess(b"not an image", "png", enabled=True)
    assert e.value.code == "IMAGE_DECODE_FAILED"


def test_pdf_to_image_and_pipeline():
    pymupdf = pytest.importorskip("pymupdf")
    from ai.ocr.base import ProviderError
    from ai.preprocessing.pdf import pdf_to_array

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=CLEAN.read_bytes())
    pdf = doc.tobytes()
    doc.close()

    arr = pdf_to_array(pdf)
    assert arr.ndim == 2 and arr.dtype == np.uint8 and arr.shape[0] > 1000
    out, ftype = preprocess(pdf, "pdf", enabled=True)
    assert ftype == "png" and out.startswith(b"\x89PNG")

    with pytest.raises(ProviderError) as e:
        pdf_to_array(pdf, page=5)
    assert e.value.code == "PDF_RENDER_FAILED"
    with pytest.raises(ProviderError) as e:
        pdf_to_array(b"%PDF-garbage")
    assert e.value.code == "PDF_RENDER_FAILED"


# ---- H2: historical-scan clean-up ---------------------------------------------------------------

from ai.preprocessing import historical as hist  # noqa: E402


def _deed_rgb() -> np.ndarray:
    """Yellow paper with a shadow gradient, black 'text' bars and a red seal across them."""
    h, w = 600, 400
    paper = np.zeros((h, w, 3), np.uint8)
    paper[:] = (236, 222, 180)  # RGB yellowed paper
    paper = (paper * np.linspace(0.75, 1.0, w)[None, :, None]).astype(np.uint8)  # shadow
    for y in range(100, 500, 40):
        cv2.rectangle(paper, (60, y), (340, y + 12), (25, 25, 25), -1)
    cv2.circle(paper, (200, 300), 80, (200, 30, 40), 6)
    return paper


def test_red_seal_removed_black_text_kept():
    rgb = _deed_rgb()
    assert hist.red_mask(rgb)[300, 120].item() == 255 and hist.red_mask(rgb)[106, 100].item() == 0
    out = hist.prepare(rgb)
    assert out.ndim == 2 and out.dtype == np.uint8
    assert out[300, 120] > 200  # seal ring (on paper) gone
    assert out[106, 100] < 80  # text bar still dark


def test_flatten_and_whiten_make_paper_white():
    gray = cv2.cvtColor(_deed_rgb(), cv2.COLOR_RGB2GRAY)
    flat = hist.whiten(hist.flatten(gray))
    paper = flat[60:90, 10:390]
    assert paper.min() >= 240  # shadow and yellow gone across the whole width
    assert hist.whiten(np.array([[230, 50]], np.uint8)).tolist() == [[255, 59]]


def test_photo_perspective_corrected():
    page = np.full((560, 400, 3), 240, np.uint8)
    for y in range(80, 480, 40):
        cv2.rectangle(page, (50, y), (350, y + 10), (20, 20, 20), -1)
    canvas = np.full((800, 700, 3), 60, np.uint8)  # dark table under the page
    src = np.float32([[0, 0], [399, 0], [399, 559], [0, 559]])
    dst = np.float32([[120, 90], [560, 140], [600, 720], [80, 680]])
    m = cv2.getPerspectiveTransform(src, dst)
    canvas = cv2.warpPerspective(
        page, m, (700, 800), dst=canvas, borderMode=cv2.BORDER_TRANSPARENT
    )
    quad = hist.page_quad(canvas)
    assert quad is not None and np.abs(quad - dst).max() < 15
    flat = cv2.cvtColor(hist.unwarp(canvas, quad), cv2.COLOR_RGB2GRAY)
    bars = (flat < 100).mean(axis=1) > 0.5  # rows mostly text bar: only if the bars are level
    assert int(np.count_nonzero(bars[1:] & ~bars[:-1])) == 10


def test_whole_frame_is_not_a_page_outline():
    assert hist.page_quad(_deed_rgb()) is None
    assert hist.prepare(cv2.cvtColor(_deed_rgb(), cv2.COLOR_RGB2GRAY)).ndim == 2  # gray input works


def test_unknown_profile_falls_back_to_modern():
    from ai.ocr.tesseract import TesseractOCRProvider

    assert TesseractOCRProvider(profile="bogus").profile == "modern"
    assert TesseractOCRProvider(profile="historical").profile == "historical"
