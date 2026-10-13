"""Rule-based Document-AI provider (P40): label patterns on OCR text, no ML, no guessing.

confidence = mean OCR word confidence of the value tokens x pattern strength (patterns.py).
Without word boxes (mock OCR) the OCR-level confidence is used and bbox is None.
Unknown field -> value None, confidence 0.0.
"""
from __future__ import annotations

import re
from datetime import date
from statistics import fmean

from ai.extraction import khatian, saf_kabala
from ai.extraction import patterns as P
from ai.extraction.base import EXTRACTION_FIELDS, ExtractedField, ExtractionResult
from ai.ocr import normalize
from ai.ocr.base import OCRResult, OCRWord

_FLAGS = re.IGNORECASE | re.MULTILINE
_ALL_LABELS = {
    f: "|".join(sorted(ps, key=len, reverse=True)) for f, ps in P.LABELS.items()
}
_PUNCT = ".,;:|\"'()"


def _label(field: str) -> str:
    alt = _ALL_LABELS[field]
    # optional bilingual partner: "Deed No / দলিল নং"
    return rf"(?<![A-Za-z\u0980-\u09FF])(?:{alt})(?:\s*[/|]\s*(?:{alt}))?"


_COLON = {
    f: re.compile(rf"{_label(f)}(?:[ \t]*[/|][^:：\n]{{0,40}})?\s*[:：][ \t]*(?P<v>[^\n]*)", _FLAGS)
    for f in P.LABELS
}
_INLINE: dict[str, re.Pattern[str]] = {}
for _f in P.LABELS:
    if _f in P.VALUE_RE:
        _val = P.VALUE_RE[_f]
    elif _f == "area_unit":
        _val = rf"(?:{P.UNIT_RE})(?![A-Za-z])"
    else:
        _val = r"[^.,;:\n_]+"
    _INLINE[_f] = re.compile(rf"{_label(_f)}[ \t]+(?![/|])(?P<v>{_val})", _FLAGS)
_UNIT_AFTER_AREA = re.compile(rf"(?<![A-Za-z]){_label('land_area')}[ \t]*[:：]?[ \t]*{P.VALUE_RE['land_area']}[ \t]*(?P<u>{P.UNIT_RE})(?![A-Za-z])", _FLAGS)


def _clean(v: str) -> str:
    return re.sub(r"\s+", " ", v.replace("_", " ")).strip(" \t:-–|")


def _valid_text(v: str) -> bool:
    return bool(re.search(r"[A-Za-z\u0980-\u09FF]", v)) and not v.lower().startswith("signature")


def _iso_date(raw: str) -> str | None:
    s = raw.translate(P.BN_DIGITS).strip().rstrip(".")
    m = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", s)
    if m:
        y, mo, d = (int(x) for x in m.groups())
    else:
        m = re.fullmatch(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", s)
        if not m:
            return None
        d, mo, y = (int(x) for x in m.groups())
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def _unit(raw: str) -> str | None:
    return P.UNIT_SYNONYMS.get(raw.strip().casefold())


def _first(field: str, text: str, norm: str) -> tuple[str, float] | None:
    """Return (raw matched value, strength) or None. `norm` is `text` with Bangla digits -> ASCII (1:1)."""
    numeric = field in P.VALUE_RE
    src = norm if numeric else text
    for m in _COLON[field].finditer(src):
        rest = m.group("v").strip()
        if field in P.VALUE_RE:
            vm = re.match(P.VALUE_RE[field], rest)
            if vm:
                return vm.group(0).rstrip(".,"), P.STRENGTH_COLON_FORMAT
        elif field == "area_unit":
            um = re.match(rf"({P.UNIT_RE})(?![A-Za-z])", rest, re.IGNORECASE)
            if um:
                return um.group(1), P.STRENGTH_COLON_FORMAT
        else:
            v = _clean(rest)
            if _valid_text(v):
                return v, P.STRENGTH_COLON_TEXT
    for m in _INLINE[field].finditer(src):
        v = _clean(m.group("v")) if not numeric and field != "area_unit" else m.group("v").strip()
        if numeric or field == "area_unit" or _valid_text(v):
            return v.rstrip(".,") if numeric else v, P.STRENGTH_INLINE
    return None


_UNIT_LABEL_LINE = re.compile(rf"^\W*{_label('area_unit')}\W*$", _FLAGS)
_UNIT_ONLY_LINE = re.compile(rf"^\W*(?P<u>{P.UNIT_RE})\W*$", _FLAGS)


def _unit_next_to_label(text: str) -> tuple[str, str] | None:
    """(unit, raw) when a label line with no value has a bare unit word on the line before or after it."""
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        if not _UNIT_LABEL_LINE.match(ln):
            continue
        for j in (i - 1, i + 1):
            if 0 <= j < len(lines) and (m := _UNIT_ONLY_LINE.match(lines[j])) and (u := _unit(m.group("u"))):
                return u, m.group("u")
    return None


def _norm_word(t: str) -> str:
    return normalize.number(normalize.text(t)).strip(_PUNCT).casefold()


def _locate(field: str, raw: str, words: tuple[OCRWord, ...]) -> list[OCRWord] | None:
    """Words (a consecutive run) that spell `raw`; prefer a run right after the field's label."""
    toks = [_norm_word(t) for t in raw.split()]
    toks = [t for t in toks if t]
    if not toks or not words:
        return None
    nw = [_norm_word(w.text) for w in words]
    runs = [i for i in range(len(words) - len(toks) + 1) if nw[i : i + len(toks)] == toks]
    if not runs:
        return None
    lw = P.LABEL_WORDS[field]
    for i in runs:
        if any(_norm_word(x) in lw for x in nw[max(0, i - 6) : i]):
            return list(words[i : i + len(toks)])
    return list(words[runs[0] : runs[0] + len(toks)])


def _bbox(ws: list[OCRWord]) -> list[float]:
    left = min(w.bbox[0] for w in ws)
    top = min(w.bbox[1] for w in ws)
    right = max(w.bbox[0] + w.bbox[2] for w in ws)
    bottom = max(w.bbox[1] + w.bbox[3] for w in ws)
    return [float(left), float(top), float(right - left), float(bottom - top)]


class RuleBasedDocumentAIProvider:
    name = "rules"

    def extract(self, data: bytes, ocr: OCRResult) -> ExtractionResult:
        text = normalize.text(ocr.text)  # NFC, zero-width chars, common label slips (O2)
        if saf_kabala.looks_like(text):
            return self._from_layout(text, ocr, saf_kabala.parse)
        if khatian.looks_like(text):
            return self._from_layout(text, ocr, khatian.parse, extras=khatian.extras(text))
        norm = text.translate(P.BN_DIGITS)
        found: dict[str, tuple[str, float]] = {}
        for f in EXTRACTION_FIELDS:
            hit = _first(f, text, norm)
            if hit is None:
                continue
            raw, strength = hit
            value: str | None = raw
            if f == "area_unit":
                value = _unit(raw)
            elif f == "deed_date":
                value = _iso_date(raw)
                if value is None:
                    value, strength = raw, P.STRENGTH_DATE_UNPARSED
            elif f == "land_area":
                value = raw.replace(",", "")
            if value:
                found[f] = (value, strength)
                found[f + "#raw"] = (raw, strength)

        # unit written next to the area ("Area 10 decimal") when there is no unit label
        if "area_unit" not in found:
            m = _UNIT_AFTER_AREA.search(norm)
            if m and (u := _unit(m.group("u"))):
                found["area_unit"] = (u, P.STRENGTH_INLINE)
                found["area_unit#raw"] = (m.group("u"), P.STRENGTH_INLINE)

        # unit printed on the line above/below its label (OCR reads a stylised value line out of order)
        if "area_unit" not in found:
            u = _unit_next_to_label(text)
            if u:
                found["area_unit"] = (u[0], P.STRENGTH_INLINE)
                found["area_unit#raw"] = (u[1], P.STRENGTH_INLINE)

        fields: list[ExtractedField] = []
        for f in EXTRACTION_FIELDS:
            if f not in found:
                fields.append(ExtractedField(field=f, value=None, confidence=0.0))
                continue
            value, strength = found[f]
            raw = found[f + "#raw"][0]
            ws = _locate(f, raw, ocr.words)
            if ws:
                base, bbox = fmean(w.confidence for w in ws), _bbox(ws)
            else:
                base, bbox = ocr.confidence, None
            fields.append(
                ExtractedField(field=f, value=value, confidence=round(min(1.0, base * strength), 4), source_bbox=bbox)
            )
        return ExtractionResult(provider=self.name, fields=fields)

    def _from_layout(self, text: str, ocr: OCRResult, parse, extras: dict | None = None) -> ExtractionResult:
        """Known Bangla layouts (saf kabala, khatian): structured section parse, no generic label guessing."""
        hits = parse(text)
        fields: list[ExtractedField] = []
        for f in EXTRACTION_FIELDS:
            if f not in hits:
                fields.append(ExtractedField(field=f, value=None, confidence=0.0))
                continue
            value, strength, raw = hits[f]
            ws = _locate(f, raw, ocr.words)
            base, bbox = (fmean(w.confidence for w in ws), _bbox(ws)) if ws else (ocr.confidence, None)
            fields.append(
                ExtractedField(field=f, value=value, confidence=round(min(1.0, base * strength), 4), source_bbox=bbox)
            )
        return ExtractionResult(provider=self.name, fields=fields, extras=extras or {})
