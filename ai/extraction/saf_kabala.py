# ruff: noqa: E501
"""Saf-Kabala (sale deed) layout parser for Bangla deeds.

Reads the numbered sections of a Saf-Kabala (1 purchaser, 2 seller, 3 schedule of property)
and the header line (deed no, English date, sub-registry office). A field that is not found is
None: nothing is guessed. Tuned on one fictional sample deed in the standard layout; other layouts fall back to
the generic label rules in rules.py.
"""
from __future__ import annotations

import re
from datetime import date

from ai.extraction import patterns as P

_B = r"\u0980-\u09FF"
_MONTHS = {
    "জানুয়ারি": 1, "জানুয়ারী": 1, "ফেব্রুয়ারি": 2, "ফেব্রুয়ারী": 2, "মার্চ": 3, "এপ্রিল": 4,
    "মে": 5, "জুন": 6, "জুলাই": 7, "আগস্ট": 8, "আগষ্ট": 8, "সেপ্টেম্বর": 9, "অক্টোবর": 10,
    "নভেম্বর": 11, "ডিসেম্বর": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7,
    "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}  # fmt: skip
_PURCHASER = re.compile(r"ক্রয়কারী|Purchaser", re.I)
_SELLER = re.compile(r"বিক্রয়কারী|Seller", re.I)
_SCHEDULE = re.compile(r"Schedule\s+of\s+Property|তফছিল|তফসিল", re.I)
_BOUNDS = re.compile(r"Boundaries|চৌহদ্দি|চতু\S*সীমা")
_HONORIFIC_DEAD = re.compile(r"^(?:মৃত|মৃত্|স্বর্গীয়|মরহুম)\s+")


def looks_like(text: str) -> bool:
    return bool(_PURCHASER.search(text) and _SELLER.search(text) and _SCHEDULE.search(text))


def _ascii(s: str) -> str:
    return s.translate(P.BN_DIGITS)


def _blocks(text: str) -> dict[str, str]:
    """Slice the text into purchaser / seller / schedule blocks by their headings."""
    marks = []
    for key, rx in (("purchaser", _PURCHASER), ("seller", _SELLER), ("schedule", _SCHEDULE), ("end", _BOUNDS)):
        m = rx.search(text)
        if m:
            marks.append((m.start(), key))
    marks.sort()
    out: dict[str, str] = {}
    for i, (pos, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        if key != "end":
            out[key] = text[pos:end]
    return out


def _person(block: str) -> tuple[str | None, str | None]:
    name = father = None
    m = re.search(r"নাম\s*[ঃ:]\s*(.+?)\s*[,،]\s*পিতা", block)
    if m:
        name = re.sub(r"\s+", " ", m.group(1)).strip(" .,:")
    m = re.search(r"পিতা\s*[ঃ:]\s*([^\n]+)", block)
    if m:
        father = _HONORIFIC_DEAD.sub("", re.sub(r"\s+", " ", m.group(1)).strip(" .,:।"))
    return name or None, father or None


def _place(pattern: str, text: str) -> str | None:
    m = re.search(rf"(?:{pattern})\s*[-–:ঃ]\s*([{_B}A-Za-z]+)", text)
    return m.group(1) if m else None


def parse(text: str) -> dict[str, tuple[str, float, str]]:
    """field -> (value, strength 0..1, raw text as read). Only fields actually found."""
    found: dict[str, tuple[str, float, str]] = {}
    blocks = _blocks(text)
    norm = _ascii(text)

    def put(field: str, value: str | None, strength: float, raw: str | None = None) -> None:
        if value:
            found[field] = (value, strength, raw if raw is not None else value)

    # header: deed number, English date, sub-registry office
    m = re.search(r"দলিল\s*(?:নম্বর|নং)\s*[ঃ:]\s*([0-9/.\-]+)", norm)
    if m:
        put("deed_no", m.group(1).strip(".-/"), 1.0)
    m = re.search(rf"ইংরেজি\s*তারিখ\s*[ঃ:]\s*(\d{{1,2}})\s+([{_B}A-Za-z]+),?\s*(\d{{4}})", norm)
    if m and (mo := _MONTHS.get(m.group(2).casefold())):
        try:
            put("deed_date", date(int(m.group(3)), mo, int(m.group(1))).isoformat(), 0.95, m.group(0))
        except ValueError:
            pass
    office = re.search(rf"সাব-?\s*রেজিস্ট্রি\s*অফিস\s*[ঃ:]\s*([{_B}]+)\s*[,،]\s*([{_B}]+)", text)

    # parties: the seller is the current owner of record
    seller, seller_father = _person(blocks.get("seller", ""))
    buyer, _ = _person(blocks.get("purchaser", ""))
    put("seller", seller, 0.95)
    put("owner_name", seller, 0.9, seller)
    put("father_name", seller_father, 0.9)
    put("buyer", buyer, 0.95)

    # place: sub-registry office first, otherwise the seller's address
    upazila = office.group(1) if office else _place("থানা|উপজেলা", blocks.get("seller", ""))
    district = office.group(2) if office else _place("জিলা|জেলা", blocks.get("seller", ""))
    put("upazila", upazila, 0.85 if office else 0.8)
    put("district", district, 0.85 if office else 0.8)

    # schedule of property
    sched = blocks.get("schedule", "")
    sched_n = _ascii(sched)
    nums = re.findall(r"সি\.?\s*এস\s*/\s*এস\.?\s*এ\s*[ঃ:]\s*(\d+)", sched_n)
    if len(nums) < 2:
        nums = re.findall(r"আর\.?\s*এস\s*[ঃ:]\s*(\d+)", sched_n) if not nums else nums
    if nums:
        put("khatian_no", nums[0], 0.9)
    if len(nums) > 1:
        put("dag_no", nums[1], 0.9)
    m = re.search(rf"([{_B}]{{2,}})\s*[,،]\s*জে\.?\s*এল\.?\s*(?:নং)?\s*[০-৯0-9]", sched)
    if m:
        put("mouza", m.group(1), 0.9)
    m = re.search(rf"জে\.?\s*এল\.?\s*(?:নং)?\s*\d+\s*[{_B}]*\s*/\s*(\d+(?:\.\d+)?)", sched_n)
    if m:
        put("land_area", m.group(1), 0.85)
    um = re.search(rf"(?<![{_B}A-Za-z])({P.UNIT_RE})(?![{_B}A-Za-z])", sched, re.I)
    if um and (u := P.UNIT_SYNONYMS.get(um.group(1).casefold())):
        put("area_unit", u, 0.9, um.group(1))
    return found
