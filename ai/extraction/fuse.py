# ruff: noqa: E501
"""Grounding & fusion (H4): the rule parser's record + the vision LLM's record -> one LHDR record.

Nothing is auto-trusted (roadmap H4.3, D3):
- both read the same value          -> kept, method `fused`, confidence 1 - (1 - a)(1 - b) (max 0.99)
- they disagree                     -> the better-grounded reading is the value, the other one becomes a
                                       `candidate` (the reviewer's "both readings" picker), flag DISAGREE,
                                       confidence x 0.7 so it is reviewed
- only the LLM read it              -> grounded against the OCR text (validate.py's rule: fuzzy >= 85 for
                                       text, exact token for numbers): found -> method `llm`, confidence x 0.9;
                                       not found -> confidence x 0.6 and flag NOT_IN_TEXT
- only the rules read it            -> kept as it is
Values that are not printed (codes, computed dates, the modern mapping) are not grounded, only agreed.
Lists are aligned by content (parties by role + name, plots by dag / mouza, witnesses by name), not by
position, since the model may order them differently.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

from rapidfuzz import fuzz

from ai.extraction.lhdr import LHDR, parse
from ai.ocr import normalize

AGREE_CAP = 0.99
DISAGREE_FACTOR = 0.7
LLM_ONLY_FACTOR = 0.9
UNFOUND_FACTOR = 0.6
FUZZY_MIN = 85
NOT_PRINTED = {"kind", "era", "calendar", "gregorian_from", "gregorian_to", "precision", "role", "survey", "unit",
               "era_currency", "decimal_equiv", "deceased", "encumbrance_free", "type", "languages", "pages"}  # fmt: skip
_FIELD_KEYS = {"value", "verbatim", "confidence", "source", "method", "legibility", "edited_by_human", "candidates", "flags"}


def _is_field(x: Any) -> bool:
    return isinstance(x, dict) and "value" in x and set(x) <= _FIELD_KEYS


def norm(v: Any) -> str:
    s = re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(v if v is not None else "")).strip().lower())
    s = normalize.number(s) if re.fullmatch(r"[\d০-৯.,/ -]+", s) else s
    try:
        return f"{float(s.replace(',', '')):g}"
    except ValueError:
        return s


class Grounder:
    def __init__(self, text: str) -> None:
        self.text = normalize.text(text or "").casefold()
        flat = normalize.number(self.text)
        self.num = re.sub(r"(?<=\d),(?=\d)", "", flat)  # ১,৫০০ -> 1500

    def found(self, f: dict, key: str) -> bool | None:
        """True / False when the value can be checked against the OCR text; None when not printed."""
        if not self.text or key in NOT_PRINTED:
            return None
        v = f.get("verbatim") or f.get("value")
        if isinstance(v, bool) or v is None:
            return None
        s = str(v)
        if re.fullmatch(r"[\d০-৯.,/]+", s) or isinstance(f.get("value"), int | float):
            n = re.sub(r"(?<=\d),(?=\d)", "", normalize.number(s))
            n = n[:-2] if n.endswith(".0") else n
            return re.search(rf"(?<![0-9A-Za-z]){re.escape(n)}(?![0-9A-Za-z])", self.num) is not None
        return fuzz.partial_ratio(normalize.text(s).casefold(), self.text) >= FUZZY_MIN


def _fuse_leaf(r: dict | None, m: dict | None, key: str, g: Grounder) -> dict | None:
    if m is None:
        return r
    m = {**m, "method": m.get("method") or "llm"}
    found = g.found(m, key)
    mc = float(m.get("confidence") or 0.0)
    if found is False:
        mc *= UNFOUND_FACTOR
    if r is None:
        out = {**m, "confidence": round(mc * (LLM_ONLY_FACTOR if found else 1.0), 4)}
        if found is False:
            out["flags"] = [*m.get("flags", []), "NOT_IN_TEXT"]
        return out
    rc = float(r.get("confidence") or 0.0)
    if norm(r.get("value")) == norm(m.get("value")):
        return {**r, "method": "fused" if r.get("method") != "computed" else "computed",
                "confidence": round(min(AGREE_CAP, 1 - (1 - rc) * (1 - mc)), 4),
                "legibility": r.get("legibility") or m.get("legibility")}
    win, lose, wc, lc = (r, m, rc, mc) if rc >= mc else (m, r, mc, rc)
    out = {**win, "confidence": round(wc * DISAGREE_FACTOR, 4),
           "candidates": [*win.get("candidates", []), {"value": lose.get("value"), "method": lose.get("method"), "confidence": round(lc, 4)}],
           "flags": [*win.get("flags", []), "DISAGREE"] + (["NOT_IN_TEXT"] if win is m and found is False else [])}
    if win is m and r.get("source"):
        out.setdefault("source", r["source"])
    return out


def _sim(a: dict, b: dict, keys: tuple[str, ...]) -> float:
    def val(d: dict, k: str) -> str:
        x: Any = d
        for part in k.split("."):
            x = x.get(part) if isinstance(x, dict) else None
        if isinstance(x, list):
            x = x[0] if x else None
        return norm(x.get("value")) if _is_field(x) else ""

    scores = [fuzz.ratio(va, vb) for k in keys if (va := val(a, k)) and (vb := val(b, k))]
    return max(scores, default=0.0)


_ALIGN = {"parties": ("name.value",), "schedule": ("dag_no", "khatian_no", "mouza"), "witnesses": ("name",), "stamps": ("value",)}


def _align(rs: list, ms: list, key: str) -> list[tuple[Any, Any]]:
    """Pairs (rule item, llm item); unmatched items pair with None."""
    if ms and all(_is_field(x) for x in ms + rs):  # a list of leaves (dag_no, languages): by value
        pairs, left = [], list(ms)
        for r in rs:
            hit = next((m for m in left if norm(m.get("value")) == norm(r.get("value"))), None)
            if hit is not None:
                left.remove(hit)
            pairs.append((r, hit))
        if len(rs) == 1 and len(left) == 1 and pairs[0][1] is None:  # one dag each: a disagreement
            return [(rs[0], left[0])]
        return pairs + [(None, m) for m in left]
    keys = tuple(k.replace(".value", "") for k in _ALIGN.get(key, ()))
    pairs, left = [], list(ms)
    for r in rs:
        best = max(left, key=lambda m: _sim(r, m, keys), default=None) if keys else (left[0] if left else None)
        if best is not None and (not keys or _sim(r, best, keys) >= 60 or len(rs) == len(ms) == 1):
            left.remove(best)
            pairs.append((r, best))
        else:
            pairs.append((r, None))
    if not keys:
        return pairs + [(None, m) for m in left]
    # same count, nothing matched by content: keep the printed order
    if all(m is None for _, m in pairs) and len(rs) == len(left):
        return list(zip(rs, left, strict=True))
    return pairs + [(None, m) for m in left]


def _merge(r: Any, m: Any, key: str, g: Grounder) -> Any:
    if _is_field(r) or _is_field(m):
        return _fuse_leaf(r if _is_field(r) else None, m if _is_field(m) else None, key, g)
    if isinstance(r, list) or isinstance(m, list):
        out = []
        for a, b in _align(r or [], m or [], key):
            v = _merge(a, b, key, g)
            if v not in (None, {}, []):
                out.append(v)
        return out
    if isinstance(r, dict) or isinstance(m, dict):
        r, m = r or {}, m or {}
        out = {}
        for k in dict.fromkeys([*r, *m]):
            v = _merge(r.get(k), m.get(k), k, g)
            if v not in (None, {}, []):
                out[k] = v
        return out
    return r if r is not None else m


def fuse(rules: LHDR, llm: LHDR, ocr_text: str) -> LHDR:
    """One record from the two readings; `core` is left for the caller to re-derive."""
    dump = {"by_alias": True, "exclude_none": True, "mode": "json"}
    a = rules.model_dump(**dump, exclude={"core", "notes"})
    b = llm.model_dump(**dump, exclude={"core", "notes", "modern_mapping"})
    merged = _merge(a, b, "", Grounder(ocr_text))
    merged["schema"] = "lhdr/1"
    rec = parse(merged)
    rec.notes = [*rules.notes, *llm.notes]
    return rec
