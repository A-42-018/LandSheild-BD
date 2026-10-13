# ruff: noqa: E501
"""scripts/merge_mouzamap_index.py: scan rows are folded into the right mouza, never into a different one."""

import json
import sys

import pytest
from scripts import merge_mouzamap_index as mm

SITE = "https://free.mouzamap.tech"


# ---- name skeleton -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "a, b",
    [
        ("Krishnapur", "KRISNOPUR"),
        ("Krishnapur", "কৃষ্ণপুর"),  # other script
        ("KRISNOPUR", "কৃষ্ণপুর"),
        ("Bisherkhola", "BISERKHULA"),
        ("Dakkhin Atang", "দক্ষিণ আটং"),
        ("127 সি.এস পরাণমণ্ডলটেক", "পরাণমণ্ডলটেক"),  # survey tag and number prefixes are noise
        ("এস.এ ডাউটিয়া", "ডাউটিয়া"),
        ("Paschim Chormonai (B.P.O)", "পশ্চিম চর মোনাই"),  # bracketed notes are dropped
        ("Chhota Baga", "ছোট বগা"),
        ("মঘিয়া", "Maghia"),  # য়/ড়/ঢ় are split by Unicode normalisation; they must still be handled
        ("Chitabari", "ছিটাবাড়ী"),
        ("Lakshmipur", "লক্ষ্মীপুর"),
        ("Dakshin Atang", "দক্ষিণ আটং"),
    ],
)
def test_same_mouza_spelled_differently_matches(a, b):
    assert mm.name_similarity(a, b) >= mm.SAME_NAME
    assert mm.name_similarity(b, a) >= mm.SAME_NAME  # symmetric


@pytest.mark.parametrize(
    "a, b",
    [
        ("Kamarganti", "চর বানিয়ারি"),  # JL 011 is a different mouza in BS and in CS
        ("Sahar Dhaka", "SUNDITARA"),
        ("KALIPUR", "কাবিলাপাড়া"),
        ("রাহাপাড়া", "61 এস.এ সরসপুর"),
        ("উলিপুর", "Alampur"),
        ("রসুলসাপুর", "রসুলপুর"),  # one syllable apart: left separate on purpose
        ("Madhabkathi", "Khalisha khali-2(uttor)"),
    ],
)
def test_different_mouzas_do_not_match(a, b):
    assert mm.name_similarity(a, b) < mm.SAME_NAME


def test_too_little_text_only_matches_exactly():
    assert mm.name_similarity("Baga", "বগা") == 1.0  # both reduce to "bg"
    assert mm.name_similarity("Baga", "বগলা") == 0.0  # "bg" vs "bgl": too short to call similar
    assert mm.name_similarity("", "আলীপুর") == 0.0
    assert mm.name_similarity("123", "456") == 0.0


# ---- the merge ----------------------------------------------------------------------------------


def _off(code, name, bn, jl, sheets, up="9", union="u1"):
    return {
        "id": code, "upazila_id": up, "union_id": union, "code": code, "name": name, "bn_name": bn,
        "jl_no": jl, "lat": 1.0, "long": 2.0, "plot_count": 10, "sheets": sheets,
    }


def _file(name, jl, survey, sheet, folder="Sadar"):
    return {
        "district": "Dhaka", "upazila_folder": folder, "mouza": name, "jl_no": jl, "survey": survey, "sheet_no": sheet,
        "path": f"0:/Dhaka/{folder}/{survey}/{name}-{jl}-{sheet}.pdf", "size": 1,
    }


def _run(tmp_path, monkeypatch, official, files):
    gis = tmp_path / "gis"
    gis.mkdir()
    (gis / "districts.geojson").write_text(json.dumps({"features": [{"properties": {"id": "1", "name": "Dhaka", "division_id": "3"}}]}))
    (gis / "upazilas.geojson").write_text(json.dumps({"features": [{"properties": {"id": "9", "district_id": "1", "division_id": "3", "name": "Sadar", "bn_name": "সদর"}}]}))
    (gis / "mouzamap_index.json").write_text(json.dumps({"source_url": SITE, "files": files}))
    (gis / "mouzas.json").write_text(json.dumps({"note": "x", "sources": [], "mouzas": official}))
    monkeypatch.setattr(mm, "GIS", gis)
    out = tmp_path / "out.json"
    monkeypatch.setattr(sys, "argv", ["merge", "--division", "3", "--out", str(out)])
    mm.main()
    return json.loads(out.read_text()), gis


def _links(data):
    return [s["url"] for m in data["mouzas"] for s in m["sheets"] if s.get("url")]


def test_scan_in_another_spelling_joins_the_official_mouza(tmp_path, monkeypatch):
    official = [_off("o1", "Krishnapur", "কৃষ্ণপুর", "002", [{"sheet_no": "001", "survey": "RS", "plots": 580}])]
    out, _ = _run(tmp_path, monkeypatch, official, [_file("KRISNOPUR", "002", "BS", "001")])
    assert len(out["mouzas"]) == 1
    m = out["mouzas"][0]
    assert (m["name"], m["bn_name"], m["union_id"]) == ("Krishnapur", "কৃষ্ণপুর", "u1")  # official identity untouched
    assert [(s["survey"], s["sheet_no"], bool(s.get("url"))) for s in m["sheets"]] == [("RS", "001", False), ("BS", "001", True)]


def test_same_jl_but_a_different_name_stays_a_separate_mouza(tmp_path, monkeypatch):
    """CS numbered mouzas differently from RS/BS: JL 011 is Kamarganti in BS and another mouza in the CS scans."""
    official = [_off("o1", "Kamarganti", "কামারগাঁতি", "011", [{"sheet_no": "001", "survey": "BS", "plots": 5}])]
    out, _ = _run(tmp_path, monkeypatch, official, [_file("চর বানিয়ারি", "011", "CS", "001")])
    assert sorted(m["name"] for m in out["mouzas"]) == ["Kamarganti", "চর বানিয়ারি"]
    kam = next(m for m in out["mouzas"] if m["id"] == "o1")
    assert not _links({"mouzas": [kam]})  # no foreign map attached to it


def test_similar_name_with_another_jl_is_not_merged_by_the_name_rule(tmp_path, monkeypatch):
    official = [_off("o1", "Krishnapur", "", "002", [{"sheet_no": "001", "survey": "RS", "plots": 1}])]
    out, _ = _run(tmp_path, monkeypatch, official, [_file("KRISNOPUR", "077", "BS", "001")])
    assert len(out["mouzas"]) == 2  # same upazila, similar name, different JL: not enough evidence


def test_scan_rows_in_two_scripts_become_one_bilingual_row(tmp_path, monkeypatch):
    files = [_file("GANOPARA", "031", "CS", "001"), _file("গণপাড়া", "031", "RS", "001"), _file("গণপাড়া", "031", "RS", "002")]
    out, _ = _run(tmp_path, monkeypatch, [], files)
    assert len(out["mouzas"]) == 1
    m = out["mouzas"][0]
    assert (m["name"], m["bn_name"], m["id"]) == ("GANOPARA", "গণপাড়া", "mm-9-CS-031")
    assert sorted((s["survey"], s["sheet_no"]) for s in m["sheets"]) == [("CS", "001"), ("RS", "001"), ("RS", "002")]


def test_bangla_only_row_takes_the_english_spelling_and_keeps_the_bangla(tmp_path, monkeypatch):
    out, _ = _run(tmp_path, monkeypatch, [], [_file("গণপাড়া", "031", "BS", "001"), _file("Ganopara", "031", "CS", "001")])
    m = out["mouzas"][0]
    assert (m["name"], m["bn_name"]) == ("Ganopara", "গণপাড়া")


def test_an_official_sheet_without_a_link_gets_the_scan_link(tmp_path, monkeypatch):
    official = [_off("o1", "Gajalia", "গজালিয়া", "005", [{"sheet_no": "001", "survey": "BS", "plots": 599}])]
    out, _ = _run(tmp_path, monkeypatch, official, [_file("GAJALIA", "005", "BS", "001")])
    (m,) = out["mouzas"]
    (s,) = m["sheets"]
    assert s["plots"] == 599 and s["url"].startswith(SITE) and s["url_source"] == "mouzamap"  # nothing official lost


def test_two_scans_of_one_sheet_number_are_both_kept(tmp_path, monkeypatch):
    """The CS maps of one mouza are filed under JL 026 and under the CS-era number 1645: both stay reachable."""
    files = [_file("GANESHPURA", "026", "CS", "001"), _file("গনেশপুরা", "1645", "CS", "001")]
    official = [_off("o1", "Goneshpura", "গনেশপুরা", "026", [{"sheet_no": "001", "survey": "BS", "plots": 4}])]
    out, _ = _run(tmp_path, monkeypatch, official, files)
    (m,) = out["mouzas"]
    assert len(_links(out)) == 2 and len(set(_links(out))) == 2


def test_no_link_is_lost_or_repeated(tmp_path, monkeypatch):
    official = [_off("o1", "Krishnapur", "কৃষ্ণপুর", "002", [{"sheet_no": "001", "survey": "RS", "plots": 1}])]
    files = [
        _file("KRISNOPUR", "002", "BS", "001"), _file("KRISNOPUR", "002", "BS", "002"), _file("Krisna pur", "002", "SA", "001"),
        _file("Other", "050", "CS", "001"), _file("OTHER", "050", "RS", "001"),
    ]
    out, _ = _run(tmp_path, monkeypatch, official, files)
    links = _links(out)
    assert len(links) == len(set(links)) == len(files)


def test_a_repeated_official_code_becomes_one_row(tmp_path, monkeypatch):
    official = [
        _off("o1", "আমরাতৈল", "আমরাতৈল", "197", [{"sheet_no": "001", "survey": "RS", "plots": 0}]),
        _off("o1", "আমরাতৈল", "আমরাতৈল", "197", [{"sheet_no": "001", "survey": "RS", "plots": 0}, {"sheet_no": "001", "survey": "BDS", "plots": 0}]),
    ]
    out, _ = _run(tmp_path, monkeypatch, official, [])
    (m,) = out["mouzas"]
    assert [(s["survey"], s["sheet_no"]) for s in m["sheets"]] == [("RS", "001"), ("BDS", "001")]


def test_rerunning_on_its_own_output_changes_nothing(tmp_path, monkeypatch):
    official = [
        _off("o1", "Krishnapur", "কৃষ্ণপুর", "002", [{"sheet_no": "001", "survey": "RS", "plots": 580}]),
        _off("o2", "Gajalia", "গজালিয়া", "005", [{"sheet_no": "001", "survey": "BS", "plots": 599}]),
    ]
    files = [_file("KRISNOPUR", "002", "BS", "001"), _file("GAJALIA", "005", "BS", "001"), _file("GANOPARA", "031", "CS", "001"), _file("গণপাড়া", "031", "RS", "001")]
    first, gis = _run(tmp_path, monkeypatch, official, files)
    (gis / "mouzas.json").write_text(json.dumps(first))  # feed the result back in
    second, _ = _run_again(tmp_path, monkeypatch, gis)
    assert second == first
    assert all("url_source" not in s or s["url"] for m in second["mouzas"] for s in m["sheets"])


def _run_again(tmp_path, monkeypatch, gis):
    out = tmp_path / "out2.json"
    monkeypatch.setattr(sys, "argv", ["merge", "--division", "3", "--out", str(out)])
    mm.main()
    return json.loads(out.read_text()), gis


def test_official_rows_are_never_renamed(tmp_path, monkeypatch):
    official = [_off("o1", "Krishnapur", "কৃষ্ণপুর", "002", [])]
    out, _ = _run(tmp_path, monkeypatch, official, [_file("KRISNOPUR", "002", "BS", "001"), _file("কৃষ্ণপুর২", "002", "CS", "001")])
    m = next(m for m in out["mouzas"] if m["id"] == "o1")
    assert (m["name"], m["bn_name"]) == ("Krishnapur", "কৃষ্ণপুর")
