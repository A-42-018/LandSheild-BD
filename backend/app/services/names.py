"""Fuzzy owner-name matching (P43, R3: similar names are never the same person on their own).

Pipeline: normalise (NFC, Bangla digits -> ASCII, punctuation, honorifics, Bengali -> Latin
romanisation, casefold) then rapidfuzz `token_sort_ratio` (0..1). A name whose tokens are a
subset of the other's ("Rahim" / "Rahim Uddin") scores at least PARTIAL_FLOOR.

Thresholds (documented in docs/ai-pipeline.md):
  * VARIANT_MIN 0.70 - at or above, and no father_name conflict -> "possible name variant".
  * MERGE_MIN   0.90 - an owner record is auto-merged only if name AND father_name both score
    >= MERGE_MIN and both father names exist. No father_name on either side -> never merged.
"""

import unicodedata

from rapidfuzz import fuzz

VARIANT_MIN = 0.70
MERGE_MIN = 0.90
PARTIAL_FLOOR = 0.75

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

HONORIFICS = frozenset(
    {
        "md", "mohammad", "mohammed", "muhammad", "mohamed", "mr", "mrs", "ms", "mst", "late",
        "alhaj", "alhajj", "haji", "hazi", "janab", "mosammat",
        "মোঃ", "মো", "মোহাম্মদ", "মুহাম্মদ", "মুহাম্মাদ", "আলহাজ", "আলহাজ্ব", "হাজী", "হাজি",
        "জনাব", "মরহুম", "মিসেস", "মোসাম্মৎ", "মোছাঃ",
    }
)  # fmt: skip

_CONS = {
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng", "চ": "ch", "ছ": "ch", "জ": "j",
    "ঝ": "jh", "ঞ": "n", "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n", "ত": "t",
    "থ": "th", "দ": "d", "ধ": "dh", "ন": "n", "প": "p", "ফ": "f", "ব": "b", "ভ": "bh",
    "ম": "m", "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh", "স": "s", "হ": "h",
    "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t", "ং": "ng", "ঃ": "h",
}  # fmt: skip
_VOWELS = {
    "অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "ঋ": "ri", "এ": "e",
    "ঐ": "oi", "ও": "o", "ঔ": "ou",
}  # fmt: skip
_SIGNS = {
    "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi",
    "ো": "o", "ৌ": "ou",
}  # fmt: skip
_VIRAMA = "\u09cd"
_NUKTA_CHAR = "\u09bc"  # ড + ় / ঢ + ় / য + ় are composed to precomposed forms by NFC


def _is_bengali(ch: str) -> bool:
    return "\u0980" <= ch <= "\u09ff"


def romanize_bengali(text: str) -> str:
    """Rough Bengali -> Latin romanisation for name comparison only (never stored/shown)."""
    out: list[str] = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch in _CONS and ch not in "ংঃ":
            nxt = text[i + 1] if i + 1 < n else ""
            out.append(_CONS[ch])
            if nxt == _VIRAMA:
                i += 2
                continue
            if nxt in _SIGNS:
                out.append(_SIGNS[nxt])
                i += 2
                continue
            # inherent vowel "o" unless the consonant ends the word
            if nxt and (_is_bengali(nxt) and nxt not in "ংঃঁ"):
                out.append("o")
            i += 1
            continue
        if ch in "ংঃ":
            out.append(_CONS[ch])
        elif ch in _VOWELS:
            out.append(_VOWELS[ch])
        elif ch in _SIGNS:
            out.append(_SIGNS[ch])
        elif ch in (_VIRAMA, "ঁ", _NUKTA_CHAR):
            pass
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def normalize_name(value: str | None) -> str:
    """Comparable form of a person name ('' when nothing is left)."""
    if not value:
        return ""
    s = unicodedata.normalize("NFC", value).translate(_BN_DIGITS)
    s = "".join(c if unicodedata.category(c)[0] in "LMN" else " " for c in s)
    tokens = [t for t in s.casefold().split() if t]
    kept = [t for t in tokens if t not in HONORIFICS] or tokens
    words = [romanize_bengali(t) if any(_is_bengali(c) for c in t) else t for t in kept]
    return " ".join(w for w in words if w)


def owner_similarity(a: str | None, b: str | None) -> float:
    """Name similarity in 0..1 (0 when either side is empty)."""
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    score = fuzz.token_sort_ratio(na, nb) / 100.0
    sa, sb = set(na.split()), set(nb.split())
    if sa <= sb or sb <= sa:
        score = max(score, PARTIAL_FLOOR)
    return round(score, 4)


def _father_conflict(fa: str | None, fb: str | None) -> bool:
    """Both fathers known and clearly different -> different people."""
    if not normalize_name(fa) or not normalize_name(fb):
        return False
    return owner_similarity(fa, fb) < VARIANT_MIN


def is_name_variant(a: str | None, fa: str | None, b: str | None, fb: str | None) -> bool:
    """Possible spelling/format variant of the same person: needs human review, never a merge."""
    return owner_similarity(a, b) >= VARIANT_MIN and not _father_conflict(fa, fb)


def can_auto_merge(a: str | None, fa: str | None, b: str | None, fb: str | None) -> bool:
    """Only when name AND father_name both match at MERGE_MIN (father names must exist)."""
    if not normalize_name(fa) or not normalize_name(fb):
        return False
    return owner_similarity(a, b) >= MERGE_MIN and owner_similarity(fa, fb) >= MERGE_MIN
