# ruff: noqa: E501
"""H5: LHDR record edits by JSON pointer (ai/extraction/lhdr_patch.py), no database."""
import copy

import pytest
from ai.evaluation import historical
from ai.extraction import lhdr
from ai.extraction import lhdr_patch as P
from ai.extraction.derive import core_paths, derive_core

GOLD = next(it for it in historical.load_set() if it["file"] == "Historical_Land_Deed.pdf")["gold"]


def _rec() -> lhdr.LHDR:
    return lhdr.parse(copy.deepcopy(GOLD))


def test_core_paths_point_at_the_values_derive_uses():
    paths = core_paths(_rec())
    assert paths["seller"] == paths["owner_name"] == "/parties/0/name"
    assert paths["buyer"] == "/parties/1/name" and paths["father_name"] == "/parties/0/father/name"
    assert paths["upazila"] == "/schedule/0/thana" and paths["dag_no"] == "/schedule/0/dag_no/0"
    assert paths["deed_date"] == "/dates/execution"


def test_replace_creates_missing_objects_and_marks_the_value_human():
    rec = _rec()
    out, changes = P.apply(rec, [{"path": "/schedule/0/jl_no", "value": "৪৫"}, {"path": "/document/condition", "value": "ভাঁজে ছেঁড়া"}])
    jl = out.schedule[0].jl_no
    assert jl.value == "৪৫" and jl.method == "human" and jl.edited_by_human
    assert [c["path"] for c in changes] == ["/schedule/0/jl_no", "/document/condition"]
    assert rec.schedule[0].jl_no is None  # the input record is never changed


def test_verbatim_edit_keeps_the_machine_method():
    rec = _rec()
    rec.registration.deed_no.method = "ocr+rules"
    out, _ = P.apply(rec, [{"path": "/registration/deed_no/verbatim", "value": "৪৭৮২ / খ"}])
    f = out.registration.deed_no
    assert f.verbatim == "৪৭৮২ / খ" and f.value == "4782/খ" and f.method == "ocr+rules" and f.edited_by_human


def test_a_value_edit_clears_review_flags_and_keeps_candidates():
    rec = _rec()
    m = rec.schedule[0].mouza
    m.flags, m.candidates = ["DISAGREE"], [lhdr.Candidate(value="ভবানিপুর", method="llm")]
    out, _ = P.apply(rec, [{"path": "/schedule/0/mouza/value", "value": "ভবানিপুর"}])
    m = out.schedule[0].mouza
    assert m.value == "ভবানিপুর" and m.flags == [] and m.candidates[0].value == "ভবানিপুর"


def test_add_into_lists_and_archaic_area_parts():
    out, changes = P.apply(_rec(), [
        {"op": "add", "path": "/execution/stamps/-", "value": {"type": "NON_JUDICIAL", "value": "৫ টাকা"}},
        {"op": "add", "path": "/schedule/0/dag_no/0", "value": "454"},
        {"op": "add", "path": "/schedule/0/area/parts/kani", "value": 1},
    ])
    assert [s.type.value for s in out.execution.stamps] == ["REVENUE", "NON_JUDICIAL"]
    assert [d.value for d in out.schedule[0].dag_no] == ["454", "455"]
    assert out.schedule[0].area.parts["kani"].value == 1
    assert changes[0]["path"] == "/execution/stamps/1"  # "-" is reported as the real index
    assert derive_core(out)["dag_no"] == "454"


def test_remove_list_items_and_optional_values():
    out, changes = P.apply(_rec(), [{"op": "remove", "path": "/parties/1"}, {"op": "remove", "path": "/schedule/0/land_class"}])
    assert len(out.parties) == 1 and out.schedule[0].land_class is None
    assert changes[0]["old"]["name"] == "রামকান্ত দাশ" and changes[0]["new"] is None
    assert derive_core(out)["buyer"] is None


def test_pointer_escapes():
    assert P.pointer("/a~1b/c~0d") == ["a/b", "c~d"]
    with pytest.raises(P.PatchError):
        P.pointer("parties/0")


@pytest.mark.parametrize(
    ("op", "code"),
    [
        ({"path": "/parties/01/name", "value": "x"}, "INVALID_PATH"),
        ({"path": "/parties/-/name", "value": "x"}, "INVALID_PATH"),
        ({"op": "move", "path": "/parties/0"}, "INVALID_OP"),
        ({"path": "", "value": 1}, "INVALID_PATH"),
        ({"path": "/registration/deed_no/method", "value": "human"}, "PATH_NOT_EDITABLE"),
        ({"path": "/registration/deed_no", "value": {"value": "1", "confidence": 1}}, "PATH_NOT_EDITABLE"),
        ({"op": "remove", "path": "/parties/5"}, "NOT_FOUND"),
        ({"op": "add", "path": "/parties/9", "value": {"role": "WITNESS"}}, "NOT_FOUND"),
        ({"path": "/schedule/0/area/value", "value": "অর্ধ"}, "RECORD_INVALID"),
        ({"path": "/parties/0/name", "value": "ক" * 600}, "VALUE_TOO_LARGE"),
        ({"path": "/schedule/0/dag_no", "value": [str(i) for i in range(101)]}, "LIST_TOO_LONG"),
    ],
)
def test_bad_ops(op, code):
    with pytest.raises(P.PatchError) as e:
        P.apply(_rec(), [{"path": "/registration/office", "value": "ok"}, op])
    assert e.value.code == code and e.value.index == 1


def test_a_replace_that_changes_nothing_is_skipped():
    out, changes = P.apply(_rec(), [{"path": "/schedule/0/mouza", "value": " ভবানীপুর "}])
    assert changes == [] and not out.schedule[0].mouza.edited_by_human


def test_core_edits_reach_the_record():
    out, _ = P.apply_core(_rec(), {"seller": "কফিল উদ্দীন", "khatian_no": "121", "land_area": "1", "area_unit": "bigha", "deed_no": "99"})
    core = derive_core(out)
    assert (core["seller"], core["owner_name"], core["khatian_no"]) == ("কফিল উদ্দীন", "কফিল উদ্দীন", "121")
    assert (core["land_area"], core["area_unit"], core["deed_no"]) == ("1.00", "bigha", "99")
    assert out.schedule[0].area.value.value == 1  # int when whole


def test_core_edits_create_what_is_missing():
    rec = lhdr.parse({"schema": "lhdr/1"})
    out, _ = P.apply_core(rec, {"seller": "A", "buyer": "B", "mouza": "M", "dag_no": "7", "deed_date": "1950-01-02"})
    assert [p.role.value for p in out.parties] == ["SELLER", "BUYER"]
    core = derive_core(out)
    assert (core["seller"], core["buyer"], core["mouza"], core["dag_no"]) == ("A", "B", "M", "7")
    assert core["deed_date"] == "1950-01-02" and out.dates.execution.calendar.value == "gregorian"


def test_father_without_a_party_cannot_be_placed():
    with pytest.raises(P.PatchError) as e:
        P.apply_core(lhdr.parse({"schema": "lhdr/1"}), {"father_name": "X"})
    assert e.value.code == "NO_RECORD_TARGET" and e.value.params["field"] == "father_name"


def test_machine_corrections_are_flagged_not_human():
    out, _ = P.apply_core(_rec(), {"mouza": "ভবানিপুর"}, flag="MATCHED_TO_RECORDS")
    m = out.schedule[0].mouza
    assert m.value == "ভবানিপুর" and "MATCHED_TO_RECORDS" in m.flags and not m.edited_by_human
    assert not P.edited(out)


def test_edited_sees_any_human_value():
    out, _ = P.apply(_rec(), [{"path": "/execution/seller_mark", "value": "টিপসই"}])
    assert P.edited(out) and not P.edited(_rec())
