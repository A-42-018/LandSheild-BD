"""O3: Claude extractor with a fake client - no network, no cost."""
from types import SimpleNamespace

import pytest
from ai.extraction.base import EXTRACTION_FIELDS
from ai.extraction.claude import ClaudeDocumentAIProvider
from ai.extraction.validate import validate
from ai.ocr.base import OCRResult

from app.core.config import Settings
from app.services.providers import AutoDocumentAIProvider, get_providers
from tests.test_documents import png

OCR_TEXT = (
    "Deed No D-2024-0785 Date 2024-02-12 District Gazipur Upazila Sreepur Mouza Barmi "
    "Khatian 1245 Dag 785 Area 10 decimal Seller Rahim Uddin Buyer Karim Mia"
)
GOOD = {
    "khatian_no": ("১২৪৫", 0.95), "dag_no": ("785", 0.95), "mouza": ("Barmi", 0.9),  # noqa: E501
    "district": ("Gazipur", 0.9), "upazila": ("Sreepur", 0.9), "land_area": ("10", 0.9),
    "area_unit": ("decimal", 0.9), "deed_no": ("D-2024-0785", 0.9),
    "deed_date": ("2024-02-12", 0.9),
    "seller": ("Rahim Uddin", 0.9), "buyer": ("Karim Mia", 0.9),
}  # fmt: skip
OCR = OCRResult(OCR_TEXT, 0.9, "tesseract")


class FakeClient:
    def __init__(self, fields=GOOD, exc=None, blocks=None):
        self.calls = []
        self.exc = exc
        payload = {f: {"value": v, "confidence": c} for f, (v, c) in fields.items()}
        self.blocks = blocks or [
            SimpleNamespace(type="tool_use", name="submit_fields", input={"fields": payload})
        ]
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kw):
        self.calls.append(kw)
        if self.exc:
            raise self.exc
        return SimpleNamespace(content=self.blocks)


class APITimeoutError(Exception):
    pass


def _provider(tmp_path, client, key="sk-fake", cap=100):
    return ClaudeDocumentAIProvider(
        key, "claude-haiku-4-5-20251001", daily_cap=cap, cache_dir=tmp_path, client=client
    )


def _by(res):
    return {f.field: f for f in res.fields}


def test_valid_tool_call_is_parsed(tmp_path):
    client = FakeClient()
    res = _provider(tmp_path, client).extract(png(), OCR)
    assert res.provider == "claude" and res.model == "claude-haiku-4-5-20251001"
    by = _by(res)
    # Bangla digits are converted to ASCII
    assert by["khatian_no"].value == "1245" and by["khatian_no"].confidence == 0.95
    assert by["buyer"].value == "Karim Mia" and len(res.fields) == len(EXTRACTION_FIELDS)
    assert by["owner_name"].value is None and by["owner_name"].confidence == 0.0
    kw = client.calls[0]
    assert kw["extra_body"]["temperature"] == 0 and kw["tool_choice"]["name"] == "submit_fields"
    assert "DATA" in kw["system"] and kw["timeout"] == 30
    assert kw["messages"][0]["content"][0]["type"] == "image"


def test_invented_khatian_gets_reduced_confidence(tmp_path):
    bad = {**GOOD, "khatian_no": ("9999", 0.97)}
    by = _by(_provider(tmp_path, FakeClient(bad)).extract(png(), OCR))
    assert by["khatian_no"].value == "9999" and by["khatian_no"].confidence == pytest.approx(0.582)
    assert by["khatian_no"].confidence < Settings(_env_file=None).review_conf_threshold  # -> review
    assert by["dag_no"].confidence == 0.95  # found in the text: untouched


def test_invalid_formats_are_dropped():
    raw = {
        "khatian_no": ("12A", 0.9), "land_area": ("-5", 0.9), "area_unit": ("furlong", 0.9),
        "deed_date": ("2999-01-01", 0.9), "mouza": ("12345", 0.9),
    }  # fmt: skip
    for f in validate(raw, OCR_TEXT):
        assert f.value is None and f.confidence == 0.0


def test_no_ocr_text_skips_cross_check():
    by = {f.field: f for f in validate({"khatian_no": ("77", 0.9)}, "")}
    assert by["khatian_no"].confidence == 0.9


@pytest.mark.parametrize(
    ("client", "key", "reason"),
    [
        (FakeClient(exc=APITimeoutError("slow")), "sk-fake", "timeout"),
        (FakeClient(exc=RuntimeError("boom")), "sk-fake", "api_error"),
        (FakeClient(blocks=[SimpleNamespace(type="text", text="hi")]), "sk-fake", "bad_response"),
        (None, "", "no_key"),
    ],
)
def test_failures_fall_back_to_rules(tmp_path, client, key, reason):
    res = _provider(tmp_path, client, key=key).extract(png(), OCR)
    assert res.provider == "rules" and res.model is None
    assert f"CLAUDE_FALLBACK:{reason}" in res.warnings


def test_daily_cap_falls_back_then_cache_still_serves(tmp_path):
    client = FakeClient()
    p = _provider(tmp_path, client, cap=1)
    assert p.extract(png(salt=b"1"), OCR).provider == "claude"
    res = p.extract(png(salt=b"2"), OCR)  # second distinct file: cap reached
    assert res.provider == "rules" and "CLAUDE_FALLBACK:cap" in res.warnings
    assert len(client.calls) == 1
    assert p.extract(png(salt=b"1"), OCR).provider == "claude"  # cached: $0, no slot needed


def test_cache_hit_does_not_call_client(tmp_path):
    first, second = FakeClient(), FakeClient(exc=RuntimeError("must not be called"))
    data = png(salt=b"cache")
    _provider(tmp_path, first).extract(data, OCR)
    res = _provider(tmp_path, second).extract(data, OCR)
    assert res.provider == "claude" and second.calls == []
    assert _by(res)["dag_no"].value == "785"


def test_removing_the_key_returns_to_rules_even_for_cached_files(tmp_path):
    data = png(salt=b"k")
    _provider(tmp_path, FakeClient()).extract(data, OCR)
    res = _provider(tmp_path, None, key="").extract(data, OCR)
    assert res.provider == "rules"


def test_provider_selection_follows_key(monkeypatch, tmp_path):
    base = {
        "_env_file": None, "storage_path": str(tmp_path),
        "ocr_provider": "auto", "document_ai_provider": "auto",
    }  # fmt: skip
    p = get_providers(Settings(**base)).ai
    assert isinstance(p, AutoDocumentAIProvider) and p.primary.name == "rules"
    p = get_providers(Settings(**base, anthropic_api_key="sk-x")).ai
    assert p.primary.name == "claude"
    assert get_providers(Settings(**{**base, "document_ai_provider": "claude"})).ai.name == "claude"
    assert "sk-x" not in repr(Settings(**base, anthropic_api_key="sk-x"))  # never in logs/repr
