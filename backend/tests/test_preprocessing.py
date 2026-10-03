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
