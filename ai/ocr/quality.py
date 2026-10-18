"""Text quality score (H2). Pure functions, no dependencies.

Used by the router to decide whether a PDF's embedded text layer can be trusted. A PDF printed
from a browser often keeps the glyph order of the shaped Bangla instead of the characters, so the
text layer loses conjuncts and leaves vowel signs without a consonant:

    বিক্রেতা -> বিেতা     সম্পত্তির -> সম্পির     টিপসই -> িপসই     বঙ্গাব্দ -> বঙ্গাাব্দ

Three signals, each 0..1, multiplied into `score`:

- marks: Bangla vowel signs / ং ঃ ঁ / hasanta in a position no correct text can have them
  (word start, after another vowel sign, doubled). Measured per Bangla character.
- dictionary: for well-known deed words with conjuncts, how often the word itself is found versus
  its "skeleton" with the conjuncts dropped (the exact damage pattern above).
- junk: replacement characters, private-use glyphs and control characters, plus non-ASCII
  letters and symbols glued to a Bangla letter (`দªলল`, `পªЕশ্চি°মে`): a PDF writer that cannot
  map a shaped glyph back to Unicode emits stray code points like these (WeasyPrint, H10), which
  no correct text has.

Text with almost no Bangla is judged on junk only.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

THRESHOLD = 0.8  # below this a PDF text layer is not trusted on its own
MIN_BANGLA = 20  # fewer Bangla characters: the Bangla signals are not applied
# invalid marks per Bangla character: up to MARKS_FREE is free (OCR slips), MARKS_ZERO scores 0.
# Measured: Tesseract output <= 0.4 %, the broken Chrome-printed PDF layers 2.5-3.2 %.
MARKS_FREE, MARKS_ZERO = 0.005, 0.02
JUNK_LIMIT = 0.02  # 2 % junk characters scores 0
MIN_DICT_EVIDENCE = 2  # dictionary signal needs at least this many hits + misses

_CONSONANTS = set(map(chr, range(0x0995, 0x09BA))) | set("ড়ঢ়য়ৰৱ")
_INDEPENDENT_VOWELS = set(map(chr, range(0x0985, 0x0995))) | set("ৠৡ")
_VOWEL_SIGNS = set("ািীুূৃৄেৈোৌৗৢৣ")
_MODIFIERS = set("ঁংঃ")  # ঁ ং ঃ
_NUKTA, _HASANTA = "়", "্"
_JOINERS = set("‌‍")  # ZWNJ, ZWJ

# deed words that contain a conjunct or reph; corruption drops exactly those clusters
PROBES = (
    "বিক্রেতা", "ক্রেতা", "বিক্রয়", "বিক্রীত", "সম্পত্তি", "পশ্চিম", "দক্ষিণ", "উত্তর", "পূর্ব",
    "ধর্ম", "স্বাক্ষর", "সাক্ষী", "জন্মসূত্রে", "উদ্দিন", "খ্রিঃ", "বঙ্গাব্দ", "রেজিস্ট্রি",
    "চৌহদ্দি", "স্বত্ব", "নিষ্কণ্টক", "প্রস্তাব", "দ্বিতীয়", "সনাক্তকারী", "মন্ত্রণালয়",
)  # fmt: skip

_BN_LETTER = re.compile(r"[ঀ-৿]")
_CLUSTER = re.compile(r"[ক-হড়-য়](?:্[ক-হড়-য়])+")
_REPH = re.compile("র্")
_TOKEN = re.compile(r"[ঀ-৿‌‍]+")
_ENDINGS = ("", "ে", "র", "ের", "য়", "কে", "গণ", "ী", "ীর")  # case endings after a probe word
MIN_SKELETON = 3  # shorter skeletons are ordinary words (বঙ্গাব্দ -> বা)


@dataclass(frozen=True)
class Quality:
    score: float  # 0..1, product of the three signals
    bangla_chars: int
    bad_marks: int
    dict_hits: int
    dict_misses: int
    junk_share: float

    @property
    def ok(self) -> bool:
        return self.score >= THRESHOLD


def skeleton(word: str) -> str:
    """The word as a broken text layer shows it: reph removed, conjunct clusters dropped."""
    return _CLUSTER.sub("", _REPH.sub("", word))


def bad_marks(text: str) -> int:
    """Vowel signs, ং ঃ ঁ, nukta or hasanta that cannot follow the character before them."""
    bad = 0
    prev = " "
    for ch in text:
        if ch in _JOINERS:
            continue
        if ch in _VOWEL_SIGNS:
            bad += prev not in _CONSONANTS and prev != _NUKTA
        elif ch in _MODIFIERS:
            bad += prev not in _CONSONANTS | _INDEPENDENT_VOWELS | _VOWEL_SIGNS | {_NUKTA}
        elif ch == _NUKTA:
            bad += prev not in _CONSONANTS
        elif ch == _HASANTA:
            bad += prev not in _CONSONANTS and prev != _NUKTA
        prev = ch
    return bad


def dictionary(text: str) -> tuple[int, int]:
    """(hits, misses): probe words found intact vs only as their skeleton (a whole token equal to
    the skeleton plus a case ending; নিষ্কণ্টক -> নিক must not match নিকট)."""
    tokens = set(_TOKEN.findall(text))
    hits = misses = 0
    for word in PROBES:
        if word in text:
            hits += 1
            continue
        sk = skeleton(word)
        if len(sk) >= MIN_SKELETON and any(sk + e in tokens for e in _ENDINGS):
            misses += 1
    return hits, misses


def _is_junk(ch: str) -> bool:
    o = ord(ch)
    return ch == "�" or 0xE000 <= o <= 0xF8FF or (o < 32 and ch not in "\n\t\r")


def _is_bn_letter(ch: str) -> bool:
    return "\u0980" <= ch <= "\u09e5" or "\u09f0" <= ch <= "\u09ff"  # the block without its digits


def _is_foreign(ch: str) -> bool:
    """A non-ASCII letter or symbol outside the Bangla block (punctuation such as । – · “ is
    fine)."""
    if ord(ch) <= 0x7F or "\u0980" <= ch <= "\u09ff" or ch in _JOINERS:
        return False
    return unicodedata.category(ch)[0] in "LS"


def foreign_in_bangla(text: str) -> int:
    """Foreign letters / symbols directly before or after a Bangla letter."""
    n = 0
    for i, ch in enumerate(text):
        if _is_foreign(ch):
            before = i > 0 and _is_bn_letter(text[i - 1])
            after = i + 1 < len(text) and _is_bn_letter(text[i + 1])
            n += before or after
    return n


def assess(text: str | None) -> Quality:
    text = text or ""
    visible = [c for c in text if not c.isspace()]
    bad_chars = sum(map(_is_junk, visible)) + foreign_in_bangla(text)
    junk = bad_chars / len(visible) if visible else 0.0
    score = max(0.0, 1.0 - junk / JUNK_LIMIT)
    bn = len(_BN_LETTER.findall(text))
    bad, hits, misses = 0, 0, 0
    if bn >= MIN_BANGLA:
        bad = bad_marks(text)
        score *= min(1.0, max(0.0, 1.0 - (bad / bn - MARKS_FREE) / (MARKS_ZERO - MARKS_FREE)))
        hits, misses = dictionary(text)
        if hits + misses >= MIN_DICT_EVIDENCE:
            score *= hits / (hits + misses)
    return Quality(round(score, 4), bn, bad, hits, misses, round(junk, 4))


def better(a: Quality, b: Quality) -> bool:
    """True when `a` is at least as good as `b`: higher score, then more dictionary hits."""
    return (a.score, a.dict_hits) >= (b.score, b.dict_hits)
