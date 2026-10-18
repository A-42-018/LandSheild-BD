# ruff: noqa: E501
"""Historical-deed evaluation set (H0): synthetic deeds, scanned variants and gold LHDR JSON.

    python ai/evaluation/make_historical.py            # writes database/sample_data/historical/
    python ai/evaluation/make_historical.py --out DIR  # everything into DIR (tests)

One spec per deed is the single source of truth: it drives the page (headless Chrome HTML) *and* the
gold JSON, so the gold can never drift from what is printed. Two real deeds (`Historical_Land_Deed.pdf`,
`Historical_Land_Deed_Sample.pdf`) are copied in by hand; the script only writes their gold + renders.

Writes NEW files only: it never touches the committed `database/sample_data/*.png` (their hashes are
fixture keys). Needs Google Chrome/Chromium for Bangla shaping, and the macOS Bangla fonts named in
FONTS. Chrome PDFs embed a creation date and the JPEG scans use seeded noise, so bytes are stable only per
machine; the committed files are the reference, regenerate only to add a deed.

Gold format: the LHDR v1 layout of docs/historical-deed-roadmap.md §2.1, with plain (flattened) values
instead of `Field` objects; absent values are omitted, nothing is guessed. `core` holds the 13 fields the
rest of LandShield uses (rule: first plot, first dag; seller = the transferring party; deed_date = the
middle of the Gregorian range). H1's derive.py must reproduce it.
"""
from __future__ import annotations

import argparse
import html
import io
import json
import shutil
import subprocess
import tempfile
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT_DIR = REPO / "database" / "sample_data" / "historical"
CHROMES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser",
]
FONTS = '"Bangla Sangam MN","Kohinoor Bangla","SolaimanLipi","Noto Sans Bengali",serif'
BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"]
# (gregorian month, day) on which each Bangla month began before the 1987 reform (+-1 day)
MONTH_START = [(4, 14), (5, 15), (6, 15), (7, 16), (8, 16), (9, 16), (10, 17), (11, 16), (12, 16), (1, 14), (2, 13), (3, 14)]
SELLER_ROLES = ("SELLER", "DONOR", "MORTGAGOR")
BUYER_ROLES = ("BUYER", "DONEE", "MORTGAGEE")
ROLE_LABEL = {
    "SELLER": "দাতা / বিক্রেতা", "BUYER": "গ্রহীতা / ক্রেতা", "DONOR": "দাতা", "DONEE": "গ্রহীতা",
    "MORTGAGOR": "রেহেনদাতা", "MORTGAGEE": "রেহেনগ্রহীতা",
}
ORD = ["১ম", "২য়"]


def bn(x) -> str:
    return str(x).translate(BN)


def day_bn(d: int) -> str:
    suffix = {1: "লা", 2: "রা", 3: "রা", 4: "ঠা"}.get(d, "ই" if d <= 18 else "শে")
    return bn(d) + suffix


# ---- the deeds ----------------------------------------------------------------------------------

def P(role, honorific, name, *, father=None, husband=None, mother=None, village, thana, district, profession, religion, nationality="জন্মসূত্রে বাঙ্গালী"):  # noqa: N802
    return dict(role=role, honorific=honorific, name=name, father=father, husband=husband, mother=mother,
                address=dict(village=village, thana=thana, district=district), profession=profession,
                religion=religion, nationality=nationality)


def plot(*, district, thana, mouza, khatian, dags, area, land_class, boundaries, survey="CS", pargana=None, jl=None):
    return dict(district=district, thana=thana, pargana=pargana, mouza=mouza, jl_no=jl, survey=survey,
                khatian_no=khatian, dag_no=dags, area=area, land_class=land_class, boundaries=boundaries)


def B(n, s, e, w):  # noqa: N802
    return dict(north=n, south=s, east=e, west=w)


SPECS: list[dict] = [
    dict(  # real sample #1 (Chrome PDF, corrupt text layer); gold = roadmap section 2.2
        stem="Historical_Land_Deed", file="Historical_Land_Deed.pdf", kind="SALE_SAF_KABALA", pages=1,
        deed_no="৪৭৮২/খ", date=(15, 10, 1350, None),
        parties=[
            P("SELLER", "জনাব", "কফিল উদ্দিন", father=("সমসের আলী", "মৃত"), mother="জমিলা খাতুন", village="ভবানীপুর", thana="রূপগঞ্জ", district="ঢাকা", profession="কৃষি", religion="ইসলাম"),
            P("BUYER", "শ্রী", "রামকান্ত দাশ", father=("হরিকান্ত দাশ", "মৃত"), mother="শ্রীমতি সুবালা দাশ", village="ভবানীপুর", thana="রূপগঞ্জ", district="ঢাকা", profession="ব্যবসা", religion="হিন্দু"),
        ],
        money=dict(amount=1500, words="এক হাজার পাঁচশত", currency="টাকা", mode="এককালীন নগদ"),
        plots=[plot(district="ঢাকা", thana="রূপগঞ্জ", mouza="ভবানীপুর", khatian="120", dags=["455"],
                    area=dict(value=0.50, unit="acre", words="অর্ধ একর", decimal_equiv=50), land_class="শালী",
                    boundaries=B("আব্দুল করিমের জমি", "সরকারি রাস্তা", "খাল", "রহিম সেখের জমি"))],
        recital=dict(basis="স্বত্ব দখলীয়", nature="চিরস্থায়ী", free=True),
        mark="টিপসই / স্বাক্ষর", witnesses=[], writer=None, stamps=[("REVENUE", "১ টাকা")],
        modern=("Narayanganj", "Rupganj"), scan=True,
    ),
    dict(  # real sample #2: two pages, with English date, witnesses, deed writer
        stem="Historical_Land_Deed_Sample", file="Historical_Land_Deed_Sample.pdf", kind="SALE_SAF_KABALA", pages=2,
        deed_no="৪৭৮২/খ", office="ঢাকা সদর সাব-রেজিস্ট্রার অফিস", date=(15, 0, 1362, "ইংরেজি: ২৮শে এপ্রিল, ১৯৫৫ খ্রিঃ"),
        parties=[
            P("SELLER", "শ্রী", "ভবতোষ রায়", father=("হরিশ চন্দ্র রায়", "মৃত"), village="কৃষ্ণপুর", thana="কোতোয়ালী", district="ঢাকা", profession="কৃষি", religion="হিন্দু", nationality=None),
            P("BUYER", "জনাব", "আব্দুল মজিদ ব্যাপারী", father=("কলিমুদ্দিন ব্যাপারী", "মৃত"), village="রঘুনাথপুর", thana="কোতোয়ালী", district="ঢাকা", profession="ব্যবসা", religion="ইসলাম", nationality=None),
        ],
        money=dict(amount=1500, words="এক হাজার পাঁচশত", currency="টাকা", mode="নগদ"),
        plots=[plot(district="ঢাকা", thana="কোতোয়ালী", pargana="নওয়াবাদ", mouza="কৃষ্ণপুর", jl="45", khatian="172", dags=["456"],
                    area=dict(value=0.20, unit="acre", words="বিশ শতক", decimal_equiv=20), land_class="নাল",
                    boundaries=B("রহিম খন্দকারের জমি", "সরকারী হালট (রাস্তা)", "গয়ানাথ সাহার বসতভিটা", "প্রথম পক্ষের নিজস্ব জমি"))],
        recital=dict(basis="পৈতৃক সূত্রে প্রাপ্ত", nature="চিরস্থায়ী", free=None),
        mark="স্বাক্ষর (বা টিপসহি)",
        witnesses=[dict(name="করিম বখশ"), dict(honorific="মুন্সী", name="ফজলুর রহমান"), dict(name="নিবারণ চন্দ্র দাস")],
        writer=("রজব আলী", "২৮/ক"), stamps=[("NON_JUDICIAL", "৫/- টাকা")],
        modern=("Dhaka", "Kotwali"),
    ),
    dict(  # gift deed, British India, husband (not father) of the donor, no consideration
        stem="hd02_gift_1938", fmt="png", kind="GIFT_DANPATRA", pages=1, title="দানপত্র দলিল", font="Bangla Sangam MN",
        deed_no="১৮৩৬/গ", office="নবাবগঞ্জ সাব-রেজিস্ট্রি অফিস", date=(12, 2, 1345, None),
        parties=[
            P("DONOR", "শ্রীমতি", "হেমলতা দেবী", husband=("নগেন্দ্রনাথ ঘোষ", "স্বর্গীয়"), village="কলাকোপা", thana="নবাবগঞ্জ", district="ঢাকা", profession="গৃহকর্ম", religion="হিন্দু"),
            P("DONEE", "শ্রী", "সুরেশ চন্দ্র ঘোষ", father=("নগেন্দ্রনাথ ঘোষ", "স্বর্গীয়"), mother="শ্রীমতি হেমলতা দেবী", village="কলাকোপা", thana="নবাবগঞ্জ", district="ঢাকা", profession="শিক্ষকতা", religion="হিন্দু"),
        ],
        money=None,
        plots=[plot(district="ঢাকা", thana="নবাবগঞ্জ", mouza="কলাকোপা", khatian="89", dags=["212"],
                    area=dict(value=0.33, unit="acre", words="তেত্রিশ শতক", decimal_equiv=33), land_class="ভিটা",
                    boundaries=B("সুরেশ চন্দ্র ঘোষের বাগান", "গ্রামের কাঁচা সড়ক", "মধুসূদন পালের ভিটা", "দাতার নিজ পুকুর"))],
        recital=dict(basis="স্বত্ব দখলীয়", nature="চিরস্থায়ী", free=True),
        mark="স্বাক্ষর", witnesses=[dict(honorific="শ্রী", name="যতীন্দ্রনাথ বসাক"), dict(honorific="শ্রী", name="উপেন্দ্র কুমার দে")],
        writer=("কালীপদ সেন", None), stamps=[("NON_JUDICIAL", "৮ আনা")],
        modern=("Dhaka", "Nawabganj"), tint="#f1e6cf",
    ),
    dict(  # East Pakistan, rupees, Chrome PDF (text layer will be corrupt like the real sample)
        stem="hd03_sale_rupee_1962", fmt="pdf", kind="SALE_SAF_KABALA", pages=1, title="সাফ কবলা দলিল", font="Kohinoor Bangla",
        deed_no="৩১২৫/খ", office="সাভার সাব-রেজিস্ট্রি অফিস", volume="বহি নং ১, জিল্দ ২৩", date=(7, 6, 1369, None),
        parties=[
            P("SELLER", "জনাব", "মোঃ ইদ্রিস মিয়া", father=("আব্দুল গফুর", "মরহুম"), mother="রহিমা বেগম", village="নরসিংপুর", thana="সাভার", district="ঢাকা", profession="কৃষি", religion="ইসলাম", nationality="জন্মসূত্রে পাকিস্তানী"),
            P("BUYER", "জনাব", "আবুল হাসেম", father=("মোঃ ছমির উদ্দিন", "মরহুম"), village="আশুলিয়া", thana="সাভার", district="ঢাকা", profession="ব্যবসা", religion="ইসলাম", nationality="জন্মসূত্রে পাকিস্তানী"),
        ],
        money=dict(amount=2500, words="দুই হাজার পাঁচশত", currency="রুপি", mode="এককালীন নগদ"),
        plots=[plot(district="ঢাকা", thana="সাভার", mouza="আশুলিয়া", khatian="345", dags=["678"], survey="SA",
                    area=dict(value=0.15, unit="acre", words="পনের শতক", decimal_equiv=15), land_class="ডাঙ্গা",
                    boundaries=B("মোঃ ছমির উদ্দিনের জমি", "জেলা বোর্ডের রাস্তা", "আবুল কাশেমের বাড়ি", "খাস পুকুর"))],
        recital=dict(basis="স্বত্ব দখলীয়", nature="চিরস্থায়ী", free=True),
        mark="টিপসই", witnesses=[dict(name="মোঃ হাবিবুর রহমান"), dict(name="আব্দুল খালেক")],
        writer=("সিরাজুল ইসলাম", "১১/খ"), stamps=[("NON_JUDICIAL", "৫/- রুপি")],
        modern=("Dhaka", "Savar"), tint="#f3ead6", scan=True,
    ),
    dict(  # three plots in one schedule
        stem="hd04_multiplot_1958", fmt="png", kind="SALE_SAF_KABALA", pages=1, title="সাফ কবলা দলিল", font="SolaimanLipi",
        deed_no="৯০৭/ক", office="কালীগঞ্জ সাব-রেজিস্ট্রি অফিস", date=(20, 9, 1364, None),
        parties=[
            P("SELLER", "জনাব", "আব্দুল কুদ্দুস", father=("মোহাম্মদ আলী", "মরহুম"), mother="ছকিনা খাতুন", village="গোপালপুর", thana="কালীগঞ্জ", district="ঢাকা", profession="কৃষি", religion="ইসলাম", nationality="জন্মসূত্রে পাকিস্তানী"),
            P("BUYER", "শ্রী", "নিতাই চন্দ্র সাহা", father=("গোপাল চন্দ্র সাহা", "স্বর্গীয়"), village="গোপালপুর", thana="কালীগঞ্জ", district="ঢাকা", profession="ব্যবসা", religion="হিন্দু", nationality="জন্মসূত্রে পাকিস্তানী"),
        ],
        money=dict(amount=8000, words="আট হাজার", currency="টাকা", mode="এককালীন নগদ"),
        plots=[
            plot(district="ঢাকা", thana="কালীগঞ্জ", mouza="গোপালপুর", khatian="210", dags=["44", "45"],
                 area=dict(value=0.40, unit="acre", words="চল্লিশ শতক", decimal_equiv=40), land_class="শালী",
                 boundaries=B("নিতাই চন্দ্র সাহার জমি", "আইল", "ফজলু মিয়ার জমি", "সরকারি খাল")),
            plot(district="ঢাকা", thana="কালীগঞ্জ", mouza="গোপালপুর", khatian="210", dags=["52"],
                 area=dict(value=0.12, unit="acre", words="বারো শতক", decimal_equiv=12), land_class="পুকুর",
                 boundaries=B("দাতার বসতবাড়ি", "মনু মিয়ার জমি", "ইউনিয়ন বোর্ডের রাস্তা", "রাজ্জাক মোল্লার জমি")),
            plot(district="ঢাকা", thana="কালীগঞ্জ", mouza="গোপালপুর", khatian="233", dags=["90"],
                 area=dict(value=0.25, unit="acre", words="পঁচিশ শতক", decimal_equiv=25), land_class="ডাঙ্গা",
                 boundaries=B("পতিত জমি", "হাতেম আলীর জমি", "গোপালপুর হাটের রাস্তা", "ক্রেতার নিজ জমি")),
        ],
        recital=dict(basis="স্বত্ব দখলীয়", nature="চিরস্থায়ী", free=True),
        mark="টিপসই / স্বাক্ষর", witnesses=[dict(name="আজিজুর রহমান"), dict(honorific="শ্রী", name="হরিপদ সরকার")],
        writer=("আবুল বাশার", "৭/গ"), stamps=[("NON_JUDICIAL", "১০/- টাকা")],
        modern=("Gazipur", "Kaliganj"), tint="#efe4cc",
    ),
    dict(  # archaic units kani / ganda / kora
        stem="hd05_archaic_units_1931", fmt="png", kind="SALE_SAF_KABALA", pages=1, title="সাফ কবলা দলিল", font="Bangla Sangam MN",
        deed_no="২৭৪১", office="নবীনগর সাব-রেজিস্ট্রি অফিস", date=(10, 8, 1338, None),
        parties=[
            P("SELLER", "জনাব", "মনিরউদ্দিন আহম্মদ", father=("ছমিরউদ্দিন আহম্মদ", "মৃত"), mother="আমেনা খাতুন", village="বিটঘর", thana="নবীনগর", district="ত্রিপুরা", profession="কৃষি", religion="ইসলাম", nationality="জন্মসূত্রে ভারতীয়"),
            P("BUYER", "শ্রী", "রাধামাধব দত্ত", father=("কৃষ্ণমোহন দত্ত", "স্বর্গীয়"), mother="শ্রীমতি বিনোদিনী দত্ত", village="বিটঘর", thana="নবীনগর", district="ত্রিপুরা", profession="মহাজনী", religion="হিন্দু", nationality="জন্মসূত্রে ভারতীয়"),
        ],
        money=dict(amount=350, words="তিনশত পঞ্চাশ", currency="টাকা", mode="নগদ"),
        plots=[plot(district="ত্রিপুরা", thana="নবীনগর", pargana="সরাইল", mouza="বিটঘর", khatian="617", dags=["1203"],
                    area=dict(value=None, unit="kani", parts=dict(kani=2, ganda=5, kora=3), words="দুই কানি পাঁচ গণ্ডা তিন কড়া"),
                    land_class="নাল", boundaries=B("ফকির চাঁদ মিয়ার জমি", "আমিনের খাল", "রাধামাধব দত্তের জমি", "ডহর"))],
        recital=dict(basis="স্বত্ব দখলীয়", nature="চিরস্থায়ী", free=True),
        mark="টিপসই", witnesses=[dict(name="তাজুদ্দিন সরকার"), dict(honorific="শ্রী", name="রামকৃষ্ণ ভৌমিক")],
        writer=("মোঃ আবদুল বারী", None), stamps=[("NON_JUDICIAL", "৩ টাকা")],
        modern=("Brahmanbaria", "Nabinagar"), tint="#eadfc3", scan=True,
    ),
    dict(  # two-page mortgage deed (Chrome PDF), inheritance recital
        stem="hd06_mortgage_2page_1965", fmt="pdf", kind="MORTGAGE_REHEN", pages=2, title="রেহেন বন্ধকী দলিল", font="Kohinoor Bangla",
        deed_no="১৪৫৩/গ", office="মানিকগঞ্জ সাব-রেজিস্ট্রি অফিস", volume="বহি নং ১, জিল্দ ৪৭", date=(3, 1, 1372, None),
        parties=[
            P("MORTGAGOR", "জনাব", "আবু তাহের খান", father=("আব্দুল মান্নান খান", "মরহুম"), mother="সখিনা বেগম", village="বেউথা", thana="মানিকগঞ্জ", district="ঢাকা", profession="কৃষি", religion="ইসলাম", nationality="জন্মসূত্রে পাকিস্তানী"),
            P("MORTGAGEE", "শ্রী", "বিনয় ভূষণ পাল", father=("রমণী মোহন পাল", "স্বর্গীয়"), mother="শ্রীমতি কমলা পাল", village="মানিকগঞ্জ", thana="মানিকগঞ্জ", district="ঢাকা", profession="মহাজনী", religion="হিন্দু", nationality="জন্মসূত্রে পাকিস্তানী"),
        ],
        money=dict(amount=5000, words="পাঁচ হাজার", currency="টাকা", mode="নগদ"),
        plots=[
            plot(district="ঢাকা", thana="মানিকগঞ্জ", pargana="ভাওয়াল", mouza="বেউথা", jl="23", khatian="402", dags=["118"], survey="SA",
                 area=dict(value=0.30, unit="acre", words="ত্রিশ শতক", decimal_equiv=30), land_class="শালী",
                 boundaries=B("কছিম উদ্দিনের জমি", "আব্দুল জব্বারের জমি", "ছোট খাল", "সরকারি রাস্তা")),
            plot(district="ঢাকা", thana="মানিকগঞ্জ", pargana="ভাওয়াল", mouza="বেউথা", jl="23", khatian="402", dags=["121"], survey="SA",
                 area=dict(value=0.18, unit="acre", words="আঠার শতক", decimal_equiv=18), land_class="বাড়ি",
                 boundaries=B("রহমত আলীর বাড়ি", "খোলা মাঠ", "দাতার জমি", "মসজিদের জমি")),
        ],
        recital=dict(basis="পৈতৃক ওয়ারিশসূত্রে প্রাপ্ত", nature="রেহেন", free=True),
        mark="টিপসই / স্বাক্ষর", witnesses=[dict(name="মোঃ আফছার উদ্দিন"), dict(honorific="শ্রী", name="নারায়ণ চন্দ্র শীল")],
        writer=("মোঃ নূরুল হক", "৩৩/ক"), stamps=[("NON_JUDICIAL", "১০/- রুপি")],
        modern=("Manikganj", "Manikganj Sadar"), tint="#f2e8d2",
    ),
]


# ---- gold ---------------------------------------------------------------------------------------

def _prune(x):
    if isinstance(x, dict):
        out = {k: _prune(v) for k, v in x.items()}
        return {k: v for k, v in out.items() if v not in (None, {}, [])}
    if isinstance(x, list):
        return [_prune(v) for v in x]
    return x


def bangla_date(day: int, m: int, bs_year: int) -> tuple[date, date]:
    """Gregorian range for a pre-1987 Bangla date (month lengths varied: +-1 day)."""
    gm, gd = MONTH_START[m]
    year = bs_year + (593 if m <= 8 else 594)
    mid = date(year, gm, gd) + timedelta(days=day - 1)
    return mid - timedelta(days=1), mid + timedelta(days=1)


def era_of(d: date) -> tuple[str, str]:
    if d < date(1947, 8, 15):
        return "BRITISH_INDIA", "INR"
    if d <= date(1971, 12, 16):
        return "EAST_BENGAL_PAKISTAN", "PKR"
    return "BANGLADESH", "BDT"


def date_verbatim(spec) -> str:
    day, m, y, english = spec["date"]
    s = f"{day_bn(day)} {MONTHS[m]}, {bn(y)} বঙ্গাব্দ"
    return f"{s} ({english})" if english else s


def _digits_ascii(s: str) -> str:
    return s.translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))


def party_gold(p: dict) -> dict:
    g = dict(role=p["role"], honorific=p["honorific"], name=p["name"], mother=p["mother"],
             address=p["address"], profession=p["profession"], religion=p["religion"], nationality=p["nationality"])
    for key in ("father", "husband"):
        if p[key]:
            g[key] = dict(name=p[key][0], deceased=True)
    return g


def gold_of(spec: dict) -> dict:
    day, m, y, english = spec["date"]
    lo, hi = bangla_date(day, m, y)
    if english:  # the deed prints the Gregorian date: it sits inside our range, keep the range anyway
        pass
    era, currency = era_of(lo)
    money = spec["money"]
    first = spec["plots"][0]
    seller = next(p for p in spec["parties"] if p["role"] in SELLER_ROLES)
    buyer = next(p for p in spec["parties"] if p["role"] in BUYER_ROLES)
    rel = seller["father"] or seller["husband"]
    area = first["area"]
    schedule = []
    for pl in spec["plots"]:
        a = pl["area"]
        schedule.append(dict(
            district=pl["district"], thana=pl["thana"], pargana=pl["pargana"], mouza=pl["mouza"], jl_no=pl["jl_no"],
            survey=pl["survey"], khatian_no=pl["khatian_no"], dag_no=pl["dag_no"],
            area=dict(value=a["value"], unit=a["unit"], parts=a.get("parts"), in_words=a["words"], decimal_equiv=a.get("decimal_equiv")),
            land_class=pl["land_class"], boundaries=pl["boundaries"]))
    mid = lo + (hi - lo) / 2
    gold = dict(
        schema="lhdr/1",
        document=dict(kind=spec["kind"], era=era, languages=["bn", "en"] if english or spec["stem"] == "Historical_Land_Deed" else ["bn"], pages=spec["pages"]),
        registration=dict(deed_no=_digits_ascii(spec["deed_no"]), deed_no_verbatim=spec["deed_no"],
                          office=spec.get("office"), volume=spec.get("volume")),
        dates=dict(execution=dict(verbatim=date_verbatim(spec), calendar="bangla", day=day, month=MONTHS[m], year=y,
                                  gregorian_from=lo.isoformat(), gregorian_to=hi.isoformat(), precision="day±1")),
        parties=[party_gold(p) for p in spec["parties"]],
        consideration=None if not money else dict(
            amount=money["amount"], in_words=money["words"], currency_written=money["currency"],
            era_currency=currency, mode=money["mode"]),
        schedule=schedule,
        title_recital=dict(basis=spec["recital"]["basis"], nature=spec["recital"]["nature"], encumbrance_free=spec["recital"]["free"]),
        execution=dict(seller_mark=spec["mark"], witnesses=[dict(role="WITNESS", **w) for w in spec["witnesses"]],
                       deed_writer=None if not spec["writer"] else dict(name=spec["writer"][0], licence_no=spec["writer"][1]),
                       stamps=[dict(type=t, value=v) for t, v in spec["stamps"]]),
        modern_mapping=dict(district=spec["modern"][0], upazila=spec["modern"][1]),
        core=dict(
            seller=seller["name"], buyer=buyer["name"], owner_name=seller["name"],
            father_name=rel[0] if rel else None, khatian_no=first["khatian_no"], dag_no=first["dag_no"][0],
            mouza=first["mouza"], district=first["district"], upazila=first["thana"],
            land_area=None if area["value"] is None else f"{area['value']:.2f}", area_unit=area["unit"],
            deed_no=_digits_ascii(spec["deed_no"]), deed_date=mid.isoformat()),
    )
    if area["value"] is None:
        gold["_notes"] = ["archaic area units (kani/ganda/kora): no decimal conversion is claimed; core land_area is null until H4 fixes the table"]
    return _prune(gold)


# ---- rendering ----------------------------------------------------------------------------------

def person_text(p: dict) -> str:
    parts = [f"{p['honorific']} {p['name']}"]
    if p["father"]:
        parts.append(f"পিতা- {p['father'][1]} {p['father'][0]}")
    if p["husband"]:
        parts.append(f"স্বামী- {p['husband'][1]} {p['husband'][0]}")
    if p["mother"]:
        parts.append(f"মাতা- {p['mother']}")
    a = p["address"]
    parts += [f"সাং- {a['village']}", f"থানা- {a['thana']}", f"জেলা- {a['district']}", f"পেশা- {p['profession']}", f"ধর্ম- {p['religion']}"]
    if p["nationality"]:
        parts.append(f"জাতীয়তা- {p['nationality']}")
    return ", ".join(parts) + "।"


def money_text(m: dict) -> str:
    return f"{bn(format(m['amount'], ','))}/- ({m['words']}) {m['currency']}"


def body_text(spec: dict) -> list[str]:
    m, basis = spec["money"], spec["recital"]["basis"]
    if spec["kind"] == "GIFT_DANPATRA":
        return [
            "কস্য দানপত্র দলিল মিদং কার্যনঞ্চাগে। আমি দাতা আপনার প্রতি আমার অকৃত্রিম স্নেহ ও ভালবাসার বশবর্তী হইয়া আমার "
            f"{basis} নিম্ন তপশিল বর্ণিত নিষ্কণ্টক জমি কোনরূপ মূল্য বা পণ গ্রহণ ব্যতিরেকে আপনার বরাবরে চিরস্থায়ীভাবে দান করিলাম।",
            "অদ্য হইতে উক্ত জমিতে আমার বা আমার ওয়ারিশগণের কোনপ্রকার স্বত্ব, দাবি বা অধিকার থাকিল না। আপনি গ্রহীতা অদ্য হইতে উক্ত জমির "
            "নিরঙ্কুশ মালিকানা লাভ করিয়া পুত্রপৌত্রাদিক্রমে ভোগদখল করিতে পারিবেন।",
        ]
    if spec["kind"] == "MORTGAGE_REHEN":
        return [
            f"কস্য রেহেন বন্ধকী দলিল মিদং কার্যনঞ্চাগে। আমার নগদ টাকার বিশেষ আবশ্যক হওয়ায় আমি দাতা অদ্য তারিখে আপনার নিকট হইতে {m['mode']} {money_text(m)} কর্জ গ্রহণ করিয়া "
            f"তাহার জামানত স্বরূপ আমার {basis} নিম্ন তপশিল বর্ণিত নিষ্কণ্টক জমি আপনার নিকট রেহেন আবদ্ধ রাখিলাম।",
            "উক্ত টাকা পরিশোধ করিলে আপনি গ্রহীতা জমি আমাকে ফেরত দিতে বাধ্য থাকিবেন। টাকা পরিশোধ না হওয়া পর্যন্ত আপনি জমির ফসল ভোগ করিতে পারিবেন, কিন্তু উক্ত জমি অন্যত্র হস্তান্তর করিতে পারিবেন না।",
        ]
    return [
        f"কস্য সাফ কবলা বিক্রীত দলিল মিদং কার্যনঞ্চাগে। আমার নগদ টাকার বিশেষ আবশ্যক হওয়ায় আমার {basis} নিম্ন তপশিল বর্ণিত নিষ্কণ্টক জমি বিক্রয়ের প্রস্তাব করিলে পর আপনি গ্রহীতা উক্ত জমি খরিদ করিতে সম্মত হন।",
        f"আমি দাতা অদ্য তারিখে আপনার নিকট হইতে {m['mode']} {money_text(m)} বুঝিয়া পাইয়া নিম্ন তপশিল বর্ণিত জমি আপনার বরাবরে চিরস্থায়ীভাবে বিক্রয় করিলাম। "
        "অদ্য হইতে উক্ত জমিতে আমার বা আমার ওয়ারিশগণের কোনপ্রকার স্বত্ব, দাবি বা অধিকার থাকিল না। আপনি গ্রহীতা অদ্য হইতে উক্ত জমির নিরঙ্কুশ মালিকানা লাভ করিয়া যথেচ্ছ ব্যবহার ও ভোগদখল করিতে পারিবেন।",
    ]


def area_text(a: dict) -> str:
    if a.get("parts"):
        p = a["parts"]
        return f"{bn(p['kani'])} কানি {bn(p['ganda'])} গণ্ডা {bn(p['kora'])} কড়া"
    value = bn(format(a["value"], ".2f"))
    return f"{value} একর ({a['words']})"


def survey_label(s: str) -> str:
    return {"CS": "সি.এস.", "SA": "এস.এ.", "RS": "আর.এস.", "BS": "বি.এস."}[s]


def page_html(spec: dict, page: int) -> str:
    """HTML of one page (1-based). Single-page deeds put everything on page 1."""
    e = html.escape
    two = spec["pages"] == 2
    stamp = "<br>".join(e(x) for x in ("স্ট্যাম্প", bn(spec["stamps"][0][1])))
    head = (
        f'<div class="stamp">{stamp}</div>'
        f'<div class="meta">দলিল নং: {e(spec["deed_no"])}<br>তারিখ: {e(date_verbatim(spec))}'
        + (f'<br>{e(spec["office"])}' if spec.get("office") else "")
        + (f'<br>{e(spec["volume"])}' if spec.get("volume") else "") + "</div>"
        f'<h1>{e(spec["title"])}</h1><p class="sub">মিদং কার্যনঞ্চাগে</p>'
    )
    parties = "".join(
        f'<div class="party"><h3>{ORD[i]} পক্ষ ({e(ROLE_LABEL[p["role"]])}):</h3><p>{e(person_text(p))}</p></div>'
        for i, p in enumerate(spec["parties"]))
    body = "".join(f"<p class='body'>{e(t)}</p>" for t in body_text(spec))
    rows = ""
    for pl in spec["plots"]:
        a, b = pl["area"], pl["boundaries"]
        rows += (
            f"<tr><td>{e(pl['district'])}</td><td>{e(pl['thana'])}</td><td>{e(pl['mouza'])}</td>"
            f"<td>{bn(pl['khatian_no'])}</td><td>{e(', '.join(bn(d) for d in pl['dag_no']))}</td>"
            f"<td>{e(area_text(a))}</td><td>{e(pl['land_class'])}</td></tr>"
            f"<tr><td class='bd' colspan='7'>চৌহদ্দি- উত্তরে- {e(b['north'])}, দক্ষিণে- {e(b['south'])}, পূর্বে- {e(b['east'])}, পশ্চিমে- {e(b['west'])}।</td></tr>")
    sv = survey_label(spec["plots"][0]["survey"])
    pargana = spec["plots"][0].get("pargana")
    table = (
        f"<h2>{ {'GIFT_DANPATRA': 'দানকৃত', 'MORTGAGE_REHEN': 'রেহেনকৃত'}.get(spec['kind'], 'বিক্রীত') } সম্পত্তির তপশিল পরিচয়</h2>" + (f"<p class='sub'>পরগণা- {e(pargana)}</p>" if pargana else "")
        + f"<table><tr><th>জেলা</th><th>থানা</th><th>মৌজা</th><th>{sv} খতিয়ান নং</th><th>দাগ নং</th><th>জমির পরিমাণ</th><th>শ্রেণী</th></tr>{rows}</table>")
    if spec["witnesses"]:
        wit = "<br>".join(f"{bn(i + 1)}। {e(((w.get('honorific') or '') + ' ' + w['name']).strip())}" for i, w in enumerate(spec["witnesses"]))
    else:
        wit = "&nbsp;"
    writer = spec["writer"]
    sig = (
        f"<div class='sig'><div><hr>{e('দাতার ' + spec['mark'])}</div>"
        f"<div><hr>সাক্ষীগণের স্বাক্ষর<br><span class='w'>{wit}</span></div>"
        f"<div><hr>দলিল লেখকের স্বাক্ষর"
        + (f"<br><span class='w'>{e(writer[0])}" + (f" (লাইসেন্স নং {e(writer[1])})" if writer[1] else "") + "</span>" if writer else "")
        + "</div></div>")
    first = head + parties + body
    if two:
        content = first if page == 1 else table + sig
        foot = f"<small class='ft'>{e(spec['title'])} — পৃষ্ঠা {bn(page)}</small>"
    else:
        content, foot = first + table + sig, f"<small class='ft'>{e(spec['title'])} - {e(spec['plots'][0]['mouza'])} মৌজা &nbsp; পৃষ্ঠা ১</small>"
    font = spec.get("font", "Bangla Sangam MN")
    tint = spec.get("tint", "#f4ecd8")
    return f"""<!doctype html><meta charset="utf-8"><style>
@page{{size:A4;margin:0}} html,body{{margin:0}}
.page{{width:794px;height:1123px;box-sizing:border-box;background:{tint};position:relative;overflow:hidden;page-break-after:always;
 font:15px/2 "{font}",{FONTS};color:#2a2420;padding:56px 70px}}
.page:before{{content:"";position:absolute;inset:26px;border:2px solid #4a3f35}}
.stamp{{position:absolute;left:84px;top:86px;border:2px solid #8a1c1c;color:#8a1c1c;padding:6px 12px;font-weight:700;line-height:1.5;transform:rotate(-4deg);text-align:center}}
.meta{{text-align:right;font-size:12px;line-height:1.7}} h1{{text-align:center;font-size:26px;margin:36px 0 0;text-decoration:underline}}
h2{{text-align:center;font-size:17px;margin:14px 0 6px}} h3{{font-size:15px;margin:10px 0 0;text-decoration:underline}}
.sub{{text-align:center;font-size:13px;margin:0}} .party{{background:#ffffff40;border-left:4px solid #6b5b4b;padding:2px 14px;margin:12px 0}}
.party p,.body{{margin:4px 0;text-align:justify}} .body{{text-indent:28px}}
table{{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}} th,td{{border:1px solid #5b4d40;padding:2px 8px;line-height:1.7}}
th{{background:#00000012}} td.bd{{font-size:13px}}
.sig{{display:flex;justify-content:space-between;margin-top:46px;text-align:center;font-size:13px}} .sig>div{{width:30%}}
.sig hr{{border:0;border-top:1px dashed #333;margin:0 0 4px}} .w{{font-size:12px;line-height:1.8}}
.ft{{position:absolute;left:44px;right:44px;bottom:30px;font-size:11px;color:#6b6b6b;text-align:left}}
</style><body><div class="page">{content}{foot}</div></body>"""


def _chrome() -> str:
    c = next((c for c in CHROMES if Path(c).exists() or shutil.which(c)), None)
    if not c:
        raise SystemExit("Chrome/Chromium is required to shape Bangla (see ai/evaluation/make_khatian_samples.py)")
    return c


def render_png(spec: dict, page: int = 1) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        src, shot = Path(tmp, "p.html"), Path(tmp, "s.png")
        src.write_text(page_html(spec, page), encoding="utf-8")
        subprocess.run([_chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=794,1123",
                        "--force-device-scale-factor=1.6", f"--screenshot={shot}", src.as_uri()], check=True, capture_output=True)
        img = Image.open(shot).convert("RGB").crop((0, 0, 1270, 1797)).quantize(colors=32)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def render_pdf(spec: dict) -> bytes:
    """Chrome 'Save as PDF': keeps a text layer whose Bangla conjuncts are broken, like the real sample."""
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp, "p.html"), Path(tmp, "o.pdf")
        pages = [page_html(spec, i + 1) for i in range(spec["pages"])]
        head, tail = pages[0].split("<body>")[0], "</body>"
        inner = "".join(p.split("<body>")[1].replace("</body>", "") for p in pages)
        src.write_text(f"{head}<body>{inner}{tail}", encoding="utf-8")
        subprocess.run([_chrome(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out}", src.as_uri()],
                       check=True, capture_output=True)
        return out.read_bytes()


def first_page_png(data: bytes, suffix: str, dpi: int = 200) -> Image.Image:
    if suffix == ".pdf":
        import pymupdf
        pix = pymupdf.open(stream=data, filetype="pdf")[0].get_pixmap(dpi=dpi)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return Image.open(io.BytesIO(data)).convert("RGB")


def scan_variant(img: Image.Image, seed: int) -> bytes:
    """Deterministic 'old scan': yellowed paper, blotches, faded ink, red seal, skew, noise, JPEG."""
    rng = np.random.default_rng(seed)
    a = np.asarray(img, dtype=np.float32)
    h, w, _ = a.shape
    a = 255 - (255 - a) * 0.74  # faded ink
    a *= np.array([0.97, 0.90, 0.70], dtype=np.float32)  # yellow paper
    blot = np.asarray(Image.fromarray(rng.uniform(0, 255, (h // 90 + 2, w // 90 + 2)).astype("uint8")).resize((w, h), Image.BICUBIC), dtype=np.float32)
    a *= (0.90 + 0.10 * blot / 255)[..., None]
    yy, xx = np.mgrid[0:h, 0:w]
    a *= (1 - 0.28 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / 2)[..., None]  # vignette
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))
    d = ImageDraw.Draw(im, "RGBA")  # red registry seal over the text
    cx, cy, r = int(w * 0.72), int(h * 0.62), int(w * 0.09)
    for k in (0, 6, 20):
        d.ellipse([cx - r + k, cy - r + k, cx + r - k, cy + r - k], outline=(170, 40, 40, 120), width=4)
    d.line([cx - r + 30, cy, cx + r - 30, cy], fill=(170, 40, 40, 90), width=5)
    im = im.rotate(1.6, resample=Image.BICUBIC, fillcolor=(222, 205, 160))
    a = np.asarray(im, dtype=np.float32) + rng.normal(0, 9, (im.height, im.width, 1))
    buf = io.BytesIO()
    Image.fromarray(np.clip(a, 0, 255).astype("uint8")).save(buf, "JPEG", quality=68)
    return buf.getvalue()


def generate(out: Path, samples_src: Path | None = None) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    manifest = []

    def put(name: str, data: bytes) -> Path:
        p = out / name
        p.write_bytes(data)
        written.append(p)
        return p

    for i, spec in enumerate(SPECS):
        stem = spec["stem"]
        gold = gold_of(spec)
        put(f"{stem}.gold.json", (json.dumps(gold, ensure_ascii=False, indent=2) + "\n").encode())
        if spec.get("file"):  # real deed: expected to be copied in by hand
            main = out / spec["file"]
            if not main.exists() and samples_src and (samples_src / spec["file"]).exists():
                shutil.copy(samples_src / spec["file"], main)
            if not main.exists():
                raise SystemExit(f"missing real sample {main}: copy it from landshield-sample-documents/New Documents")
        else:
            main = put(f"{stem}.{spec['fmt']}", render_pdf(spec) if spec["fmt"] == "pdf" else render_png(spec))
        manifest.append(dict(file=main.name, gold=f"{stem}.gold.json", pages=spec["pages"], variant="typed", kind=spec["kind"]))
        if main.suffix == ".pdf" and spec["pages"] == 1:  # PNG render of a one-page PDF
            img = first_page_png(main.read_bytes(), ".pdf", 150)
            buf = io.BytesIO()
            img.quantize(colors=32).save(buf, "PNG", optimize=True)
            png = put(f"{stem}.png", buf.getvalue())
            manifest.append(dict(file=png.name, gold=f"{stem}.gold.json", pages=1, variant="render", kind=spec["kind"]))
        if spec.get("scan"):
            sc = put(f"{stem}_scan.jpg", scan_variant(first_page_png(main.read_bytes(), main.suffix), seed=900 + i))
            manifest.append(dict(file=sc.name, gold=f"{stem}.gold.json", pages=1, variant="scanned", kind=spec["kind"]))
    put("manifest.json", (json.dumps({"schema": "lhdr/1", "files": manifest}, ensure_ascii=False, indent=2) + "\n").encode())
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    ap.add_argument("--samples", type=Path, help="folder holding the two real PDFs (copied if absent)")
    a = ap.parse_args()
    files = generate(a.out, a.samples)
    print(f"wrote {len(files)} files, {sum(f.stat().st_size for f in files) / 1024:.0f} KiB into {a.out}")


if __name__ == "__main__":
    main()
