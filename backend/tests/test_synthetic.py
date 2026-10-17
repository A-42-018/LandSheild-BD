"""P26: synthetic document generator is deterministic and compatible with the mock providers."""
import json
from pathlib import Path

import pytest

pytest.importorskip("PIL")

from ai.evaluation import make_synthetic as ms  # noqa: E402
from ai.mock_fixtures import find_fixture  # noqa: E402

DEMO_KEYS = ["Doc1", "Doc2", "AreaMismatch", "SellerMismatch", "Clean"]
VERIFY_FILES = [name for name, _ in ms.VERIFY_COPIES.values()]


@pytest.fixture(scope="module")
def two_runs(tmp_path_factory):
    a, b = tmp_path_factory.mktemp("a"), tmp_path_factory.mktemp("b")
    ms.generate(a / "s", a / "e")
    ms.generate(b / "s", b / "e")
    return a, b


def _tree(root: Path) -> dict[str, bytes]:
    files = sorted(p for p in root.rglob("*") if p.is_file())
    return {str(p.relative_to(root)): p.read_bytes() for p in files}


def test_two_runs_identical_bytes(two_runs):
    a, b = two_runs
    ta, tb = _tree(a), _tree(b)
    assert ta.keys() == tb.keys()
    assert all(ta[k] == tb[k] for k in ta)


def test_outputs_and_marker_lookup(two_runs):
    a, _ = two_runs
    for key in DEMO_KEYS:
        data = (a / "s" / f"{key}.png").read_bytes()
        assert data.startswith(b"\x89PNG")
        fx = find_fixture(data)
        assert fx is not None and fx["fields"]["dag_no"]
    for name in VERIFY_FILES:
        assert find_fixture((a / "s" / name).read_bytes()) is not None
    assert len(list((a / "e").glob("eval*.png"))) == 20


def test_ground_truth_shape(two_runs):
    a, _ = two_runs
    gt = json.loads((a / "e" / "ground_truth.json").read_text(encoding="utf-8"))
    assert len(gt["documents"]) == 20
    d0 = gt["documents"][0]
    assert {"file", "marker", "fields", "bboxes", "variant"} <= d0.keys()
    assert any(d["variant"]["bn_digits"] for d in gt["documents"])


def test_committed_repo_outputs_are_current_and_small():
    repo = ms.REPO
    sample = repo / "database" / "sample_data"
    assert sample.exists()
    total = sum(p.stat().st_size for p in [*sample.glob("*"), *(ms.HERE / "data").glob("*")])
    assert total < 2.5 * 1024 * 1024  # 2 MiB + the three verify-a-copy samples
