"""National ID (NID) handling (R2): only keyed hashes and the last four digits are ever stored.

Bangladesh issues 10-digit smart-card numbers and 13- or 17-digit older numbers; a 17-digit number
is the holder's birth year followed by the 13-digit one. With the date of birth known, a 13-digit
number is widened to its 17-digit form so both spellings of the same card hash alike.
"""

import hashlib
import hmac
from dataclasses import dataclass
from datetime import date

from app.core.config import get_settings

_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
NID_LENGTHS = (10, 13, 17)
MIN_BIRTH_YEAR = 1900


class NidError(ValueError):
    """The value is not a usable NID / date of birth. `code` is a stable error code."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def canonical_nid(raw: str, dob: date) -> str:
    digits = "".join(raw.translate(_BN_DIGITS).split()).replace("-", "")
    if not digits.isdigit() or len(digits) not in NID_LENGTHS:
        raise NidError("INVALID_NID")
    if len(digits) == 13:
        digits = f"{dob.year:04d}{digits}"
    return digits


def check_dob(dob: date, today: date | None = None) -> date:
    today = today or date.today()
    if dob.year < MIN_BIRTH_YEAR or dob > today:
        raise NidError("INVALID_DATE_OF_BIRTH")
    return dob


def _hmac(message: str) -> str:
    key = get_settings().hash_salt.encode()
    return hmac.new(key, message.encode(), hashlib.sha256).hexdigest()


@dataclass(frozen=True)
class NidKey:
    nid_hash: str  # identifies the card holder
    dob_hash: str  # proves the date of birth that goes with that card
    last4: str  # shown back as "•••• 4821"

    def to_json(self) -> dict[str, str]:
        return {"nid_hash": self.nid_hash, "dob_hash": self.dob_hash, "last4": self.last4}


def nid_key(raw: str, dob: date) -> NidKey:
    """Normalise and hash an NID with its date of birth. Raises NidError."""
    check_dob(dob)
    nid = canonical_nid(raw, dob)
    return NidKey(
        nid_hash=_hmac(f"nid:{nid}"),  # same scheme as the seed loader's owner hashes
        dob_hash=_hmac(f"nid-dob:{nid}:{dob.isoformat()}"),
        last4=nid[-4:],
    )
