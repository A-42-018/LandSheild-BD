# ruff: noqa: E501
"""H4: historical-deed extraction - Bangla parsers, gazetteer, rule parser, LLM tool, fusion, job wiring."""
import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest
from ai.evaluation import historical
from ai.extraction import bangla as bn
from ai.extraction import claude_lhdr, fuse, gazetteer
from ai.extraction.claude import ClaudeDocumentAIProvider, request_options
from ai.extraction.historical_deed import HistoricalDeedProvider, parse
from ai.extraction.lhdr import LHDR, Field, errors, plain
from ai.extraction.mock import MockDocumentAIProvider
from ai.ocr import tesseract as tess
from ai.ocr.base import OCRCell, OCRResult, OCRTable

from app.services import processing
from app.services.providers import Providers
from app.services.storage import LocalStorage
from tests.test_documents import _up, png, store  # noqa: F401
from tests.test_extraction import _get
from tests.test_lands import env  # noqa: F401
from tests.test_processing import _row, _start, jobs  # noqa: F401

DATA = Path(__file__).parent / "data"
SAMPLE_TEXT = (DATA / "historical_deed.tesseract.txt").read_text(encoding="utf-8")  # Tesseract, sample deed
SAMPLE = next(it for it in historical.load_set() if it["file"] == "Historical_Land_Deed.pdf")
GOLD = SAMPLE["gold"]


def _ocr(text: str = SAMPLE_TEXT, **kw) -> OCRResult:
    return OCRResult(text=text, confidence=0.9, provider="tesseract", profile="historical", **kw)


def _correct(rec: LHDR, gold: dict = GOLD) -> int:
    core = rec.core.model_dump() if rec.core else {}
    s = historical.score_doc(core, gold, rec.model_dump(mode="json", by_alias=True, exclude_none=True))
    return sum(v[0] for v in s["sections"].values())


# ---- Bangla parsers -----------------------------------------------------------------------------

@pytest.mark.parametrize(("words", "n"), [
    ("এক হাজার পাঁচশত", 1500), ("তিনশত পঞ্চাশ", 350), ("একশত বাহাত্তর", 172), ("চারশত ছাপ্পান্ন", 456),
    ("দুই হাজার পাঁচশত", 2500), ("আট হাজার", 8000), ("অর্ধ", 0.5), ("পচিশ", 25), ("বারো", 12),
])  # fmt: skip
def test_number_words(words, n):
    assert bn.number_words(words) == n


def test_number_words_reject_other_words():
    assert bn.number_words("দুই stata পাঁচশত") is None and bn.number_words("জমি") is None
    assert bn.canonical_words("পচিশ শতক") == "পঁচিশ শতক" and bn.canonical_words("বারো শতক") == "বারো শতক"


def test_bangla_date_before_1987_is_a_range():
    d = bn.parse_date("তারিখ: ১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ")
    assert (d.day, d.month, d.year) == (15, "ফাল্গুন", 1350)
    assert d.to_gregorian() == (date(1944, 2, 26), date(1944, 2, 28), "day±1")  # roadmap §2.2
    poush = bn.parse_date("২৫শে পৌষ, ১৩৩৮ বঙ্গাব্দ")  # crosses into January
    assert poush.to_gregorian()[0] == date(1932, 1, 8)


def test_bangla_date_after_the_reform_is_exact():
    assert bn.parse_date("১লা বৈশাখ ১৪৩০").to_gregorian() == (date(2023, 4, 14), date(2023, 4, 14), "day")
    assert bn.parse_date("১লা ফাল্গুন ১৪৩০").to_gregorian()[0] == date(2024, 2, 14)  # 2019 revision
    assert bn.parse_date("১লা ফাল্গুন ১৪০০").to_gregorian()[0] == date(1994, 2, 13)  # 1987 calendar


def test_date_variants():
    assert bn.parse_date("ইতি সন ১৩৬২ বঙ্গাব্দের ১৫ই বৈশাখ").year == 1362
    assert bn.parse_date("৭ই কাতিক, ১৩৬৯ বঙ্গাব্দ").month == "কার্তিক"  # OCR drops the reph
    fixed = bn.parse_date("১৫ই ফাল্গুন, ৯৩৫০ বঙ্গাব্দ")  # ১ read as ৯
    assert fixed.year == 1350 and fixed.corrected and "১৩৫০" in fixed.verbatim
    assert bn.parse_date("১৫ই ফাল্গুন, ৭৩৫০") is None
    g = bn.find_dates("(ইংরেজি: ২৮শে এপ্রিল, ১৯৫৫ খ্রিঃ)")[0]
    assert g.calendar == "gregorian" and g.to_gregorian()[0] == date(1955, 4, 28)


def test_money_words_win_over_a_misread_figure():
    m = bn.parse_money("এককালীন নগদ ১,৫০০/- (এক হাজার পাঁচশত) টাকা বুঝিয়া")
    assert (m.amount, m.words, m.currency, m.agree) == (1500, "এক হাজার পাঁচশত", "টাকা", True)
    m = bn.parse_money("নিকট হই: ৯৫০০/- €এক হাজার পাঁচশত) টাকা নগদ")
    assert m.amount == 1500 and m.agree is False
    m = bn.parse_money("২,৫০০/- (দুই stata পাঁচশত) রুপি")  # unreadable words never override
    assert m.amount == 2500 and m.words is None and m.currency == "রুপি"


def test_area_modern_words_and_archaic_parts():
    a = bn.parse_area("০.৫০ একর (অর্ধ একর) শালী জমি")
    assert (a.value, a.unit, a.in_words, a.decimal_equiv, a.words_agree) == (0.5, "acre", "অর্ধ একর", 50, True)
    k = bn.parse_area("২ কানি ৫ গণ্ডা ৩ কড়া")
    assert k.unit == "kani" and k.parts == {"kani": 2, "ganda": 5, "kora": 3} and k.value is None
    assert k.decimal_equiv is None  # kani size differs by district: no conversion is claimed


def test_boundaries_including_an_unreadable_direction_word():
    b = bn.parse_boundaries("চৌহদ্দি- উত্তরে- আব্দুল করিমের জমি, দক্ষিণে- সরকারি রাস্তা, পূর্বে- খাল, পশ্চিমে- রহিম সেখের জমি।")
    assert b == {"north": "আব্দুল করিমের জমি", "south": "সরকারি রাস্তা", "east": "খাল", "west": "রহিম সেখের জমি"}
    b = bn.parse_boundaries("দাতার বসতবাড়ি, দক্ষিণে- মনু মিয়ার জমি, gd. ইউনিয়ন বোর্ডের রাস্তা, পশ্চিমে- রাজ্জাক মোল্লার জমি।", by_order=True)
    assert b["north?"] == "দাতার বসতবাড়ি" and b["south"] == "মনু মিয়ার জমি" and b["east?"].endswith("ইউনিয়ন বোর্ডের রাস্তা")


# ---- gazetteer ----------------------------------------------------------------------------------

@pytest.mark.parametrize(("thana", "district", "want"), [
    ("রূপগঞ্জ", "ঢাকা", ("Narayanganj", "Rupganj")), ("নবীনগর", "ত্রিপুরা", ("Brahmanbaria", "Nabinagar")),
    ("কালীগঞ্জ", "ঢাকা", ("Gazipur", "Kaliganj")), ("মানিকগঞ্জ", "ঢাকা", ("Manikganj", "Manikganj Sadar")),
    ("কোতোয়ালী", "ঢাকা", ("Dhaka", "Kotwali")), ("সাভার", "ঢাকা", ("Dhaka", "Savar")),
])  # fmt: skip
def test_historical_place_to_modern(thana, district, want):
    m = gazetteer.modern(thana, district)
    assert (m.district, m.upazila) == want


def test_ambiguous_or_unknown_places_are_not_guessed():
    assert gazetteer.modern("কালীগঞ্জ", None) is None  # four upazilas of that name
    assert gazetteer.snap("ত্রিপুর", "district") == ("ত্রিপুরা", True)
    assert gazetteer.snap("ভবানীপুর", "district") == ("ভবানীপুর", False)


# ---- rule parser --------------------------------------------------------------------------------

def test_rules_read_the_sample_deed_from_ocr_text():
    rec = parse(_ocr())
    assert _correct(rec) >= 30  # roadmap H4 done-criterion, rules only (1 of 13 before H4)
    p = plain(rec)
    seller, buyer = p["parties"]
    assert (seller["role"], seller["honorific"], seller["name"]) == ("SELLER", "জনাব", "কফিল উদ্দিন")
    assert seller["father"] == {"name": "সমসের আলী", "deceased": True} and seller["mother"] == "জমিলা খাতুন"
    assert seller["nationality"] == "জন্মসূত্রে বাঙ্গালী"  # OCR 'জনাসূত্রে' snapped to the vocabulary
    assert buyer["name"] == "রামকান্ত দাশ" and buyer["religion"] == "হিন্দু"
    assert p["consideration"] == {"amount": 1500, "in_words": "এক হাজার পাঁচশত", "currency_written": "টাকা",
                                  "era_currency": "INR", "mode": "এককালীন নগদ"}
    plot = p["schedule"][0]
    assert (plot["khatian_no"], plot["dag_no"], plot["survey"], plot["mouza"]) == ("120", ["455"], "CS", "ভবানীপুর")
    assert plot["thana"] == "রূপগঞ্জ"  # OCR 'রাপগঞ্জ' in the table, outvoted by the party addresses
    assert plot["area"] == {"value": 0.5, "unit": "acre", "in_words": "অর্ধ একর", "decimal_equiv": 50}
    assert plot["boundaries"]["west"] == "রহিম সেখের জমি" and plot["land_class"] == "শালী"
    assert p["dates"]["execution"]["gregorian_from"] == "1944-02-26" and p["document"]["era"] == "BRITISH_INDIA"
    assert p["modern_mapping"] == {"division": "Dhaka", "district": "Narayanganj", "upazila": "Rupganj"}
    assert rec.core.deed_date == "1944-02-27" and rec.core.deed_no == "4782/খ"
    assert not errors(rec, today=date(2026, 10, 18))  # all LHDR required fields present
    verb = rec.parties[1].address.thana
    assert verb.method == "ocr+rules" and 0 < verb.confidence <= 1


def test_rules_read_a_multi_plot_grid():
    hdr = ["জেলা", "থানা", "মৌজা", "সি.এস. খতিয়ান নং", "দাগ নং", "জমির পরিমাণ", "শ্রেণী"]
    rows = [hdr, ["ঢাকা", "কালীগঞ্জ", "গোপালপুর", "২১০", "88, ৪৫", "০.৪০ একর (চল্লিশ শতক)", "শালী"],
            ["চৌহদ্দি- উত্তরে- নিতাই চন্দ্র সাহার জমি, দক্ষিণে- আইল, পূর্বে- ফজলু মিয়ার জমি, পশ্চিমে- সরকারি খাল।"],
            ["ঢাকা", "কালীগঞ্জ", "গোপালপুর", "২৩৩", "৯০", "০.২৫ একর (পচিশ শতক)", "ভাঙ্গা"]]
    cells = tuple(OCRCell(r, c, t, 0.9, (c * 100, r * 40, 100, 40), colspan=7 if len(row) == 1 else 1)
                  for r, row in enumerate(rows) for c, t in enumerate(row))
    table = OCRTable(0, (0, 0, 700, 160), 4, 7, cells)
    plots = plain(parse(_ocr("বিক্রীত সম্পত্তির তপশিল পরিচয়", tables=(table,))))["schedule"]
    assert len(plots) == 2
    assert plots[0]["dag_no"] == ["44", "45"]  # Latin '8' among Bangla digits is ৪
    assert plots[0]["boundaries"]["south"] == "আইল" and plots[0]["area"]["decimal_equiv"] == 40
    assert plots[1]["land_class"] == "ডাঙ্গা" and plots[1]["area"]["in_words"] == "পঁচিশ শতক"


def test_provider_without_llm_returns_record_and_core_fields():
    res = HistoricalDeedProvider().extract(b"png", _ocr())
    assert res.provider == "rules" and res.record["schema"] == "lhdr/1"
    by = {f.field: f for f in res.fields}
    assert by["seller"].value == "কফিল উদ্দিন" and by["khatian_no"].value == "120" and by["seller"].confidence > 0.5


@pytest.mark.skipif(not tess.is_available(), reason="needs Tesseract with ben")
def test_sample_pdf_end_to_end_rules_only():
    from ai.ocr.router import AutoOCRProvider

    data = SAMPLE["path"].read_bytes()
    ocr = AutoOCRProvider(demo_fixtures=False, profile="historical").recognize(data, "pdf")
    res = HistoricalDeedProvider().extract(data, ocr)
    s = historical.score_doc({f.field: f.value for f in res.fields}, GOLD, res.record)
    assert sum(v[0] for v in s["sections"].values()) >= 30 and s["core"][0] >= 11


# ---- LLM tool + fusion ----------------------------------------------------------------------------

def _leaf(v, conf=0.9, verbatim=None):
    return {"value": None if v is None else str(v), "verbatim": verbatim, "confidence": conf, "legibility": None}


def _tool_answer() -> dict:
    """A submit_lhdr answer as the model would send it (strings everywhere, every key present)."""
    n = _leaf(None, 0)
    party = lambda role, name, father: {  # noqa: E731
        "role": _leaf(role), "honorific": n, "name": _leaf(name), "father": {"name": _leaf(father), "deceased": _leaf("true")},
        "husband": {"name": n, "deceased": n}, "mother": n,
        "address": {k: n for k in ("village", "post", "union", "thana", "pargana", "district")},
        "profession": n, "religion": n, "nationality": n, "share": n}
    return {
        "document": {"kind": _leaf("SALE_SAF_KABALA"), "languages": ["bn", "en"], "condition": n},
        "registration": {"deed_no": _leaf("4782/খ", verbatim="৪৭৮২/খ"), "volume": n, "pages": n, "office": n, "year": n, "endorsement": n},
        "dates": {"execution": {"verbatim": _leaf("১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ", verbatim="১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ"),
                                "calendar": _leaf("bangla"), "day": _leaf("15"), "month": _leaf("ফাল্গুন"), "year": _leaf("1350")},
                  "registration": {k: n for k in ("verbatim", "calendar", "day", "month", "year")}},
        "parties": [party("SELLER", "কফিল উদ্দিন", "সমসের আলী"), party("BUYER", "রামকান্ত দাশ", "হরিকান্ত দাশ")],
        "consideration": {"amount": _leaf("1500"), "in_words": n, "currency_written": _leaf("টাকা"), "mode": n},
        "schedule": [{"district": _leaf("ঢাকা"), "thana": _leaf("রূপগঞ্জ"), "pargana": n, "mouza": _leaf("ভবানীপুর"), "jl_no": n,
                      "survey": _leaf("CS"), "khatian_no": _leaf("121"), "dag_no": [_leaf("455")],
                      "area": {"value": _leaf("0.5"), "unit": _leaf("acre"), "in_words": n, "parts": {k: n for k in ("kani", "ganda", "kora", "kranti", "til")}},
                      "land_class": _leaf("শালী"), "boundaries": {"north": n, "south": n, "east": _leaf("খাল"), "west": n}}],
        "title_recital": {"basis": n, "prior_deed": n, "nature": n, "encumbrance_free": _leaf("true", 0.8)},
        "execution": {"seller_mark": n, "witnesses": [], "deed_writer": {"name": n, "licence_no": n},
                      "stamps": [{"type": _leaf("REVENUE"), "value": _leaf("১ টাকা", verbatim="১ টাকা")}]},
    }


def test_tool_answer_becomes_a_typed_record():
    rec = claude_lhdr.to_lhdr(_tool_answer())
    p = plain(rec)
    assert p["consideration"]["amount"] == 1500 and p["schedule"][0]["area"]["value"] == 0.5
    assert p["registration"] == {"deed_no": "4782/খ", "deed_no_verbatim": "৪৭৮২/খ"}
    ex = p["dates"]["execution"]
    assert (ex["gregorian_from"], ex["precision"]) == ("1944-02-26", "day±1")  # computed, not asked
    assert p["document"]["era"] == "BRITISH_INDIA" and p["consideration"]["era_currency"] == "INR"
    assert rec.parties[0].father.deceased.value is True and rec.parties[0].name.method == "llm"
    bad = _tool_answer()
    bad["schedule"][0]["survey"] = _leaf("NOPE")
    bad["parties"][0]["role"] = _leaf("KING")
    assert plain(claude_lhdr.to_lhdr(bad))["schedule"][0].get("survey") is None  # bad codes dropped, rest kept


def test_strict_tool_schema_is_closed():
    def walk(s):
        if isinstance(s, dict):
            if s.get("type") == "object":
                assert s["additionalProperties"] is False and set(s["required"]) == set(s["properties"])
            for v in s.values():
                walk(v)
        elif isinstance(s, list):
            for v in s:
                walk(v)
    walk(claude_lhdr.INPUT_SCHEMA)
    assert claude_lhdr.TOOL["strict"] is True
    assert "minimum" not in json.dumps(claude_lhdr.INPUT_SCHEMA)  # numeric constraints are not allowed


def test_fusion_agrees_disagrees_and_grounds():
    rules = parse(_ocr())
    llm = claude_lhdr.to_lhdr(_tool_answer())
    llm.registration.office = Field(value="ঢাকা সাব-রেজিস্ট্রি অফিস", confidence=0.9, method="llm")  # not printed
    rec = fuse.fuse(rules, llm, SAMPLE_TEXT)
    seller = rec.parties[0].name
    assert seller.method == "fused" and seller.confidence > rules.parties[0].name.confidence  # agreement
    k = rec.schedule[0].khatian_no
    assert "DISAGREE" in k.flags and {c.value for c in k.candidates} == {"121"} and k.value == "120"
    assert k.confidence < rules.schedule[0].khatian_no.confidence  # disagreement goes to review
    office = rec.registration.office
    assert "NOT_IN_TEXT" in office.flags and office.confidence == pytest.approx(0.9 * 0.6)
    assert rec.title_recital.encumbrance_free.value is True  # only the LLM read it (OCR garbled the word)
    assert len(rec.parties) == 2 and len(rec.schedule) == 1  # aligned, not appended


def test_provider_with_llm_fuses_and_falls_back(tmp_path):
    class LLM:
        model = "claude-sonnet-5-5"

        def __init__(self, rec):
            self.rec = rec

        def extract_lhdr(self, data, ocr):
            return (self.rec, []) if self.rec else (None, ["CLAUDE_FALLBACK:timeout"])

    res = HistoricalDeedProvider(LLM(claude_lhdr.to_lhdr(_tool_answer()))).extract(b"x", _ocr())
    assert res.provider == "fused" and res.model == "claude-sonnet-5-5"
    res = HistoricalDeedProvider(LLM(None)).extract(b"x", _ocr())
    assert res.provider == "rules" and res.warnings == ["CLAUDE_FALLBACK:timeout"] and res.record


class _Stream:
    def __init__(self, resp):
        self.resp = resp

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        return self.resp


class StreamClient:
    def __init__(self, tool_input=None, stop="tool_use"):
        self.calls = []
        blocks = [SimpleNamespace(type="tool_use", name="submit_lhdr", input=tool_input)] if tool_input else []
        self.resp = SimpleNamespace(content=blocks, stop_reason=stop)
        self.messages = SimpleNamespace(stream=self._stream, create=None)
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kw):
        self.calls.append(kw)
        return _Stream(self.resp)


def test_extract_lhdr_request_shape_and_cache(tmp_path):
    client = StreamClient(_tool_answer())
    p = ClaudeDocumentAIProvider("sk-fake", "claude-sonnet-5-5", cache_dir=tmp_path, client=client)
    rec, warnings = p.extract_lhdr(png(), _ocr())
    assert warnings == [] and rec.parties[0].name.value == "কফিল উদ্দিন"
    kw = client.calls[0]
    assert kw["tool_choice"] == {"type": "auto"} and "temperature" not in kw
    assert kw["tools"][0]["name"] == "submit_lhdr" and kw["tools"][0]["strict"] and kw["tools"][0]["eager_input_streaming"]
    assert kw["output_config"] == {"effort": "medium"} and kw["fallbacks"] == "default"  # first-party API
    assert kw["messages"][0]["content"][0]["type"] == "image" and "DATA" in kw["system"]
    assert p.extract_lhdr(png(), _ocr())[0] is not None and len(client.calls) == 1  # cached per file


def test_extract_lhdr_all_pdf_pages_are_sent(tmp_path):
    two = next(it for it in historical.load_set() if it["file"] == "hd06_mortgage_2page_1965.pdf")
    client = StreamClient(_tool_answer())
    p = ClaudeDocumentAIProvider("sk-fake", "claude-sonnet-5-5", cache_dir=tmp_path, client=client, base_url="https://gw.example")
    p.extract_lhdr(two["path"].read_bytes(), _ocr())
    kw = client.calls[0]
    assert sum(1 for c in kw["messages"][0]["content"] if c["type"] == "image") == 2
    assert "fallbacks" not in kw and "betas" not in kw  # gateways: no server-side fallback beta


@pytest.mark.parametrize(("client", "reason"), [
    (StreamClient(None, stop="refusal"), "refusal"), (StreamClient(None, stop="max_tokens"), "max_tokens"),
    (StreamClient({"document": "junk"}), "bad_response"),
])  # fmt: skip
def test_extract_lhdr_failures_fall_back(tmp_path, client, reason):
    p = ClaudeDocumentAIProvider("sk-fake", "claude-sonnet-5-5", cache_dir=tmp_path, client=client)
    assert p.extract_lhdr(png(), _ocr()) == (None, [f"CLAUDE_FALLBACK:{reason}"])


def test_request_options_follow_the_model():
    assert request_options("claude-haiku-4-5-20251001", "") == {}
    assert request_options("claude-opus-5-5", "https://gw") == {"output_config": {"effort": "medium"}}
    assert request_options("claude-sonnet-5-5", "")["betas"] == ["server-side-fallback-2026-07-01"]


# ---- background job -------------------------------------------------------------------------------

class _TextOCR:
    name = "fake"
    profile = "historical"

    def recognize(self, data, file_type):
        return _ocr()


def test_job_stores_the_record_for_a_historical_deed(env, jobs, store):  # noqa: F811
    r = _up(env, "deed.png", png() + b"H4")
    doc_id = r.json()["id"]
    _start(env, doc_id)
    providers = Providers(_TextOCR(), MockDocumentAIProvider(), HistoricalDeedProvider())
    processing.run_processing(jobs, LocalStorage(store), providers, doc_id)
    ex = _row(env, doc_id).extraction_json
    assert ex["deed_profile"] == "historical" and ex["provider"] == "rules"
    assert ex["record_schema"] == "lhdr/1" and ex["record"]["parties"][0]["name"]["value"] == "কফিল উদ্দিন"
    by = {f["field"]: f["value"] for f in ex["fields"]}
    assert by["khatian_no"] == "120" and by["deed_date"] == "1944-02-27"
    out = _get(env, doc_id).json()  # the API returns the record too
    assert out["record_schema"] == "lhdr/1" and out["record"]["schedule"][0]["mouza"]["value"] == "ভবানীপুর"
