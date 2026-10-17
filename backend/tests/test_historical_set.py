# ruff: noqa: E501
"""H0: the historical-deed evaluation set is complete, its gold is self-consistent, and the scorer works."""
import json
from datetime import date

from ai.evaluation import historical
from ai.evaluation import make_historical as mh


def test_manifest_files_and_gold_exist():
    items = historical.load_set()
    assert len(items) >= 10
    for it in items:
        assert it["path"].exists() and it["gold"]["schema"] == "lhdr/1"
    variants = {it["variant"] for it in items}
    assert {"typed", "render", "scanned"} <= variants
    assert sum(1 for p in historical.HIST_DIR.glob("*.gold.json")) >= 7  # 2 real + 5 synthetic deeds


def test_committed_gold_matches_specs():
    for spec in mh.SPECS:
        on_disk = json.loads((historical.HIST_DIR / f"{spec['stem']}.gold.json").read_text(encoding="utf-8"))
        assert on_disk == mh.gold_of(spec)


def test_sample_deed_gold_follows_roadmap():
    g = mh.gold_of(mh.SPECS[0])
    ex = g["dates"]["execution"]
    assert (ex["gregorian_from"], ex["gregorian_to"]) == ("1944-02-26", "1944-02-28")
    assert g["core"]["deed_no"] == "4782/খ" and g["consideration"]["era_currency"] == "INR"
    assert len(historical.flatten(g)) >= 30


def test_bangla_date_and_era():
    lo, hi = mh.bangla_date(15, 10, 1350)
    assert (lo, hi) == (date(1944, 2, 26), date(1944, 2, 28))
    assert mh.era_of(date(1962, 10, 23)) == ("EAST_BENGAL_PAKISTAN", "PKR")
    assert mh.era_of(date(1931, 12, 25)) == ("BRITISH_INDIA", "INR")


def test_scoring_perfect_and_empty():
    gold = mh.gold_of(mh.SPECS[0])
    perfect = historical.score_doc(dict(gold["core"]), gold)
    assert perfect["core"] == (13, 13) and not perfect["missed_core"]
    empty = historical.score_doc({}, gold)
    assert empty["core"][0] == 0 and sum(v[0] for v in empty["sections"].values()) == 0


def test_norm_handles_bangla_digits_units_numbers():
    assert historical.norm("৪৭৮২/খ") == historical.norm("4782/খ")
    assert historical.norm("0.50") == historical.norm("0.5") and historical.norm("একর") == "acre"
