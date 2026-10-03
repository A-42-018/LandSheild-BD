# ruff: noqa: E501
"""Label patterns, unit synonyms and value formats for the rule-based extractor (P40).

Labels are regex fragments (EN + BN). Longest alternatives are tried first. Never add a
pattern that guesses a value: a field is either read next to its label or it is null.
"""
from __future__ import annotations

import re

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

# field -> label regex fragments (spaces as \s+, apostrophe optional)
LABELS: dict[str, tuple[str, ...]] = {
    "owner_name": (r"owner\s+name", r"name\s+of\s+owner", r"owner", r"মালিকের\s+নাম", r"জমির\s+মালিক", r"মালিক"),
    "father_name": (r"father['’`]?s?\s+name", r"father", r"পিতার\s+নাম", r"পিতা"),
    "khatian_no": (r"khatian\s+(?:no\.?|number)", r"khatian", r"খতিয়ান\s+নং", r"খতিয়ান\s+নম্বর", r"খতিয়ান"),
    "dag_no": (r"dag\s+(?:no\.?|number)", r"dag", r"দাগ\s+নং", r"দাগ\s+নম্বর", r"দাগ"),
    "mouza": (r"mouza", r"mouja", r"মৌজা"),
    "district": (r"district", r"(?<!উপ)জেলা"),
    "upazila": (r"upazila", r"upazilla", r"thana", r"উপজেলা"),
    "land_area": (r"land\s+area", r"area", r"জমির\s+পরিমাণ", r"পরিমাণ"),
    "area_unit": (r"unit", r"একক"),
    "deed_no": (r"deed\s+(?:no\.?|number)", r"দলিল\s+নং", r"দলিল\s+নম্বর"),
    "deed_date": (r"deed\s+date", r"date", r"দলিলের\s+তারিখ", r"তারিখ"),
    "seller": (r"seller", r"vendor", r"বিক্রেতা"),
    "buyer": (r"buyer", r"purchaser", r"ক্রেতা"),
}

# plain words used to locate the label among OCR word boxes
LABEL_WORDS: dict[str, frozenset[str]] = {
    f: frozenset(w.lower() for p in ps for w in re.findall(r"[A-Za-z\u0980-\u09FF]{2,}", p.replace("\\s", " ")))
    for f, ps in LABELS.items()
}

_D = "[0-9০-৯]"
VALUE_RE: dict[str, str] = {
    "khatian_no": rf"{_D}+(?:[/-]{_D}+)?",
    "dag_no": rf"{_D}+(?:[/-]{_D}+)?",
    "land_area": rf"{_D}[{_D[1:-1]},]*(?:\.{_D}+)?",
    "deed_no": r"[^\s,;|:]*[0-9০-৯][^\s,;|]*",
    "deed_date": rf"{_D}{{1,4}}[-/.]{_D}{{1,2}}[-/.]{_D}{{1,4}}",
}
TEXT_FIELDS = ("owner_name", "father_name", "mouza", "district", "upazila", "seller", "buyer")

# unit synonym (casefolded) -> canonical unit accepted by the backend (AREA_UNITS)
UNIT_SYNONYMS: dict[str, str] = {
    "decimal": "decimal", "decimals": "decimal", "dec": "decimal", "শতাংশ": "decimal", "শতক": "decimal",
    "katha": "katha", "কাঠা": "katha",
    "bigha": "bigha", "বিঘা": "bigha",
    "acre": "acre", "acres": "acre", "একর": "acre",
    "sqft": "sqft", "sq.ft": "sqft", "sq.ft.": "sqft", "বর্গফুট": "sqft",
    "sqm": "sqm", "sq.m": "sqm", "বর্গমিটার": "sqm",
}
UNIT_RE = "|".join(sorted((re.escape(u) for u in UNIT_SYNONYMS), key=len, reverse=True))

# pattern strength (multiplied by OCR word confidence)
STRENGTH_COLON_FORMAT = 1.0   # "Label: value", value matches its strict format
STRENGTH_COLON_TEXT = 0.95    # "Label: free text"
STRENGTH_INLINE = 0.8         # "Label value" without separator (prose OCR)
STRENGTH_DATE_UNPARSED = 0.6  # date text kept as written (not a valid calendar date)
