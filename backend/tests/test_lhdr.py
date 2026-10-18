# ruff: noqa: E501
"""H1: the LHDR v1 format. Every gold file validates, derives its 13 core fields, and the rules catch bad records."""
import json
from datetime import date

import pytest
from ai.evaluation import historical
from ai.extraction import lhdr
from ai.extraction.base import EXTRACTION_FIELDS
from ai.extraction.derive import derive_core, derive_fields
from pydantic import ValidationError

GOLDS = sorted(historical.HIST_DIR.glob("*.gold.json"))
SAMPLE = historical.HIST_DIR / "Historical_Land_Deed.gold.json"


def _gold(path=SAMPLE) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _codes(rec: dict, today: date | None = None) -> set[str]:
    return {i.code for i in lhdr.check(lhdr.parse(rec), today)}


@pytest.mark.parametrize("path", GOLDS, ids=lambda p: p.stem)
def test_gold_validates_without_issues(path):
    rec = lhdr.parse(path.read_bytes())
    assert lhdr.check(rec) == []


@pytest.mark.parametrize("path", GOLDS, ids=lambda p: p.stem)
def test_derived_core_equals_gold(path):
    gold = _gold(path)
    assert derive_core(lhdr.parse(gold)) == {f: gold["core"].get(f) for f in EXTRACTION_FIELDS}


@pytest.mark.parametrize("path", GOLDS, ids=lambda p: p.stem)
def test_plain_round_trip(path):
    gold = _gold(path)
    assert lhdr.plain(lhdr.parse(gold)) == gold


def test_sample_deed_has_the_roadmap_values():
    rec = lhdr.parse(_gold())
    assert rec.document.kind.value is lhdr.DeedKind.SALE_SAF_KABALA
    assert rec.dates.execution.gregorian_from.value == date(1944, 2, 26)
    assert rec.schedule[0].boundaries.west.value == "রহিম সেখের জমি"
    assert rec.parties[0].father.deceased.value is True
    assert len(historical.flatten(lhdr.plain(rec))) >= 30  # the H4 target


def test_full_field_objects_are_accepted_and_carried_into_core():
    g = _gold()
    g["schedule"][0]["mouza"] = {"value": "ভবানীপুর", "verbatim": "ভবানীপুর", "confidence": 0.81, "method": "ocr+rules",
                                 "source": {"page": 1, "bbox": [10, 20, 30, 8]}, "legibility": "faded"}
    rec = lhdr.parse(g)
    mouza = next(f for f in derive_fields(rec) if f.field == "mouza")
    assert (mouza.value, mouza.confidence, mouza.source_bbox) == ("ভবানীপুর", 0.81, [10, 20, 30, 8])
    seller = next(f for f in derive_fields(rec) if f.field == "seller")
    assert seller.confidence == 1.0  # plain gold value: written by a person
    dumped = rec.model_dump(mode="json", by_alias=True, exclude_none=True)
    assert lhdr.parse(dumped) == rec


def test_machine_value_without_confidence_is_not_trusted():
    g = _gold()
    g["schedule"][0]["mouza"] = {"value": "ভবানীপুর", "method": "llm"}
    assert next(f for f in derive_fields(lhdr.parse(g)) if f.field == "mouza").confidence == 0.0


@pytest.mark.parametrize("mutate", [
    lambda g: g["document"].update(colour="red"),  # unknown key (typo protection)
    lambda g: g["document"].update(kind="SALE"),  # unknown enum value
    lambda g: g["schedule"][0]["area"].update(value="half"),  # not a number
    lambda g: g.update(schema="lhdr/2"),
    lambda g: g["schedule"][0].update(mouza={"value": "x", "confidence": 1.5}),  # confidence > 1
])
def test_wrong_shape_is_rejected(mutate):
    g = _gold()
    mutate(g)
    with pytest.raises(ValidationError):
        lhdr.parse(g)


def test_required_rules():
    g = _gold()
    del g["registration"]["deed_no"]
    del g["dates"]["execution"]["verbatim"]
    g["parties"] = []
    del g["schedule"][0]["area"]
    del g["core"]
    assert {"MISSING_DEED_REF", "MISSING_EXECUTION_DATE", "NO_SELLER", "NO_BUYER", "NO_COMPLETE_PLOT"} <= _codes(g)


def test_registration_volume_counts_as_deed_ref():
    g = _gold()
    del g["registration"]["deed_no"], g["core"]
    g["registration"]["volume"] = "বহি নং ১, জিল্দ ২৩"
    assert "MISSING_DEED_REF" not in _codes(g)


def test_plot_needs_khatian_or_dag():
    g = _gold()
    del g["schedule"][0]["khatian_no"], g["core"]
    assert "NO_COMPLETE_PLOT" not in _codes(g)  # dag is enough
    g["schedule"][0]["dag_no"] = []
    assert "NO_COMPLETE_PLOT" in _codes(g)


def test_partition_needs_two_sharers_not_seller_and_buyer():
    g = _gold()
    del g["core"]
    g["document"]["kind"] = "PARTITION_BANTONNAMA"
    for p in g["parties"]:
        p["role"] = "SHARER"
    assert not {"NO_SELLER", "NO_BUYER"} & _codes(g)
    core = derive_core(lhdr.parse(g))
    assert (core["owner_name"], core["seller"], core["buyer"]) == ("কফিল উদ্দিন", None, None)
    g["parties"] = g["parties"][:1]
    assert {"NO_SELLER", "NO_BUYER"} <= _codes(g)


def test_party_without_a_name_does_not_count():
    g = _gold()
    del g["parties"][1]["name"], g["core"]
    assert "NO_BUYER" in _codes(g)


def test_format_rules():
    g = _gold()
    del g["core"]
    plot = g["schedule"][0]
    plot["area"]["value"] = 0
    plot["khatian_no"] = "একশ"
    plot["dag_no"] = ["৪৫৫/১", "x9"]
    g["registration"]["deed_no"] = "খ/ক"
    g["consideration"]["amount"] = -5
    issues = {(i.path, i.code) for i in lhdr.check(lhdr.parse(g))}
    assert ("/schedule/0/area/value", "AREA_NOT_POSITIVE") in issues
    assert ("/schedule/0/khatian_no", "NOT_NUMERIC") in issues
    assert ("/schedule/0/dag_no/1", "NOT_NUMERIC") in issues
    assert ("/schedule/0/dag_no/0", "NOT_NUMERIC") not in issues  # Bangla digits are numbers
    assert ("/registration/deed_no", "NOT_NUMERIC") in issues
    assert ("/consideration/amount", "AMOUNT_NOT_POSITIVE") in issues


def test_units_known_archaic_or_unknown():
    g = _gold(historical.HIST_DIR / "hd05_archaic_units_1931.gold.json")
    assert lhdr.check(lhdr.parse(g)) == []  # kani / ganda / kora
    g["schedule"][0]["area"]["parts"]["furlong"] = 1
    g["schedule"][0]["area"]["unit"] = "hectare-ish"
    paths = {i.path for i in lhdr.check(lhdr.parse(g)) if i.code == "UNKNOWN_UNIT"}
    assert paths == {"/schedule/0/area/unit", "/schedule/0/area/parts/furlong"}
    assert lhdr.canonical_unit("একর") == "acre" and lhdr.canonical_unit("গণ্ডা") == "ganda"


def test_date_rules():
    g = _gold()
    ex = g["dates"]["execution"]
    ex["gregorian_from"], ex["gregorian_to"] = "1944-03-01", "1944-02-28"
    assert "DATE_RANGE_REVERSED" in _codes(g)
    assert "DATE_IN_FUTURE" in _codes(_gold(), today=date(1944, 2, 27))
    ex["day"] = 40
    assert "BAD_DAY" in _codes(g)


def test_deed_date_only_when_known_to_the_day():
    g = _gold()
    g["dates"]["execution"]["precision"] = "month"
    assert derive_core(lhdr.parse(g))["deed_date"] is None


def test_consistency_warnings():
    g = _gold()
    g["document"]["era"] = "BANGLADESH"
    g["core"]["mouza"] = "অন্য"
    issues = lhdr.check(lhdr.parse(g))
    assert {(i.code, i.severity) for i in issues} == {("ERA_MISMATCH", "warning"), ("CORE_MISMATCH", "warning")}
    assert lhdr.errors(lhdr.parse(g)) == []


def test_era_boundaries():
    assert lhdr.era_of(date(1947, 8, 14)) is lhdr.Era.BRITISH_INDIA
    assert lhdr.era_of(date(1947, 8, 15)) is lhdr.Era.EAST_BENGAL_PAKISTAN
    assert lhdr.era_of(date(1971, 12, 17)) is lhdr.Era.BANGLADESH


def test_committed_json_schema_is_current():
    on_disk = json.loads(lhdr.SCHEMA_FILE.read_text(encoding="utf-8"))
    assert on_disk == lhdr.json_schema(), "run: python -m ai.extraction.lhdr schema"


def test_json_schema_accepts_shorthand_and_field_objects():
    mouza = lhdr.json_schema()["$defs"]["Plot"]["properties"]["mouza"]["anyOf"]
    assert {"type": "string"} in mouza and {"$ref": "#/$defs/Field_str_"} in mouza


def test_cli_check(tmp_path, capsys):
    assert lhdr.main(["check", str(SAMPLE)]) == 0
    bad = _gold()
    bad["parties"] = []
    (tmp_path / "bad.json").write_text(json.dumps(bad, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "broken.json").write_text('{"schema": "lhdr/1", "documnet": {}}', encoding="utf-8")
    assert lhdr.main(["check", str(tmp_path / "bad.json"), str(tmp_path / "broken.json")]) == 1
    out = capsys.readouterr().out
    assert "NO_SELLER" in out and "INVALID" in out
