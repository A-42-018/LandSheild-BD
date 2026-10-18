# ruff: noqa: E501
"""Place names for historical deeds (H4): spelling snap + historical -> modern mapping.

Built from `backend/app/data/land_offices.json` (every division / district / upazila of today, Bangla and
English) plus two small historical tables:

- HISTORICAL_DISTRICTS: the British-India / East-Pakistan district a deed names -> the modern districts
  carved out of it (ঢাকা 1944 covered today's Narayanganj, Gazipur, Manikganj …; ত্রিপুরা is Cumilla,
  Brahmanbaria, Chandpur). A thana is looked up only inside those, so the four কালীগঞ্জ upazilas of
  Bangladesh resolve to the one in the deed's old district.
- HISTORICAL_THANAS: city thanas that are not upazilas today (কোতোয়ালী, ঢাকা -> Dhaka / Kotwali).

`snap(name, kind)` corrects an OCR misspelling to a known name when one candidate is clearly closest
(`রাপগঞ্জ` -> `রূপগঞ্জ`); an unknown name comes back unchanged. `modern(thana, district)` returns the
English division / district / upazila, or None when the place is unknown or ambiguous: nothing is guessed.
"""
from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz, process

OFFICES = Path(__file__).resolve().parents[2] / "backend" / "app" / "data" / "land_offices.json"
SNAP_MIN = 85  # rapidfuzz ratio to accept a correction
SNAP_GAP = 5  # the best candidate must beat the second by this much

HISTORICAL_DISTRICTS: dict[str, tuple[str, ...]] = {
    "ঢাকা": ("Dhaka", "Gazipur", "Narayanganj", "Manikganj", "Munshiganj", "Narsingdi"),
    "ত্রিপুরা": ("Cumilla", "Brahmanbaria", "Chandpur"), "টিপরা": ("Cumilla", "Brahmanbaria", "Chandpur"),
    "কুমিল্লা": ("Cumilla", "Brahmanbaria", "Chandpur"),
    "ময়মনসিংহ": ("Mymensingh", "Jamalpur", "Sherpur", "Netrokona", "Kishoreganj", "Tangail"),
    "বাকেরগঞ্জ": ("Barishal", "Patuakhali", "Barguna", "Bhola", "Jhalakathi", "Pirojpur"),
    "বরিশাল": ("Barishal", "Patuakhali", "Barguna", "Bhola", "Jhalakathi", "Pirojpur"),
    "ফরিদপুর": ("Faridpur", "Gopalganj", "Madaripur", "Shariatpur", "Rajbari"),
    "নোয়াখালী": ("Noakhali", "Feni", "Lakshmipur"), "চট্টগ্রাম": ("Chattogram", "Cox's Bazar"),
    "পার্বত্য চট্টগ্রাম": ("Rangamati", "Khagrachhari", "Bandarban"),
    "সিলেট": ("Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"), "শ্রীহট্ট": ("Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"),
    "রাজশাহী": ("Rajshahi", "Natore", "Naogaon", "Chapainawabganj"), "বগুড়া": ("Bogura", "Joypurhat"),
    "দিনাজপুর": ("Dinajpur", "Thakurgaon", "Panchagarh"), "রংপুর": ("Rangpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari"),
    "পাবনা": ("Pabna", "Sirajganj"), "যশোহর": ("Jashore", "Jhenaidah", "Magura", "Narail"), "যশোর": ("Jashore", "Jhenaidah", "Magura", "Narail"),
    "খুলনা": ("Khulna", "Bagerhat", "Satkhira"), "কুষ্টিয়া": ("Kushtia", "Chuadanga", "Meherpur"), "নদীয়া": ("Kushtia", "Chuadanga", "Meherpur"),
}  # fmt: skip
HISTORICAL_THANAS: dict[tuple[str, str], tuple[str, str, str]] = {  # (thana, old district) -> division, district, upazila
    ("কোতোয়ালী", "ঢাকা"): ("Dhaka", "Dhaka", "Kotwali"), ("কোতোয়ালি", "ঢাকা"): ("Dhaka", "Dhaka", "Kotwali"),
    ("লালবাগ", "ঢাকা"): ("Dhaka", "Dhaka", "Lalbagh"), ("সূত্রাপুর", "ঢাকা"): ("Dhaka", "Dhaka", "Sutrapur"),
}  # fmt: skip


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip()


@dataclass(frozen=True)
class Upazila:
    division: str
    district: str
    district_bn: str
    name: str
    name_bn: str


@lru_cache(maxsize=1)
def _data() -> tuple[tuple[Upazila, ...], dict[str, str]]:
    """(upazilas, district_bn -> district_en)."""
    try:
        rows = json.loads(OFFICES.read_text(encoding="utf-8"))
    except OSError:
        return (), {}
    ups: dict[tuple[str, str], Upazila] = {}
    districts: dict[str, str] = {}
    for o in rows:
        if o.get("district_bn"):
            districts[nfc(o["district_bn"])] = o["district_en"]
        if o.get("upazila_bn") and o.get("upazila_en"):
            u = Upazila(o["division_en"], o["district_en"], nfc(o["district_bn"]), o["upazila_en"], nfc(o["upazila_bn"]))
            ups[(u.district, u.name)] = u
    return tuple(ups.values()), districts


def _division_of(district_en: str) -> str | None:
    return next((u.division for u in _data()[0] if u.district == district_en), None)


def known(kind: str) -> list[str]:
    """Bangla names of a kind: 'thana' (upazilas today + historical thanas) or 'district' (today + historical)."""
    ups, districts = _data()
    if kind == "district":
        return sorted(set(districts) | set(HISTORICAL_DISTRICTS))
    names = {u.name_bn for u in ups} | {u.name_bn.removesuffix(" সদর") for u in ups} | {t for t, _ in HISTORICAL_THANAS}
    return sorted(names)


def snap(name: str | None, kind: str) -> tuple[str | None, bool]:
    """(known spelling, changed?) for an OCR'd place name; unknown names are returned unchanged."""
    if not name:
        return name, False
    n = nfc(name)
    names = known(kind)
    if n in names:
        return n, False
    hits = process.extract(n, names, scorer=fuzz.ratio, limit=2)
    if hits and hits[0][1] >= SNAP_MIN and (len(hits) == 1 or hits[0][1] - hits[1][1] >= SNAP_GAP):
        return hits[0][0], True
    return n, False


@dataclass(frozen=True)
class Modern:
    division: str | None
    district: str | None
    upazila: str | None
    exact: bool  # True: the old district still exists under the same name and holds the thana


def modern(thana: str | None, district: str | None) -> Modern | None:
    """Historical thana + district (Bangla) -> today's division / district / upazila (English)."""
    ups, districts = _data()
    t, d = (nfc(thana) if thana else None), (nfc(district) if district else None)
    if t and d and (hit := HISTORICAL_THANAS.get((t, d))):
        return Modern(*hit, exact=True)
    scope = HISTORICAL_DISTRICTS.get(d or "") or ((districts[d],) if d in districts else None)
    if t:
        cands = [u for u in ups if u.name_bn in (t, f"{t} সদর") and (scope is None or u.district in scope)]
        if len(cands) > 1:  # "মানিকগঞ্জ" thana is Manikganj Sadar, not another upazila of the same name
            cands = [u for u in cands if u.name_bn == t] or cands
        if len(cands) == 1:
            u = cands[0]
            return Modern(u.division, u.district, u.name, exact=d is not None and districts.get(d) == u.district)
    if d in districts and not t:
        return Modern(_division_of(districts[d]), districts[d], None, exact=True)
    return None
