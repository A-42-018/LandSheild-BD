"""NIDs of deed parties (buyer / seller), entered by the office at upload or review.

Stored on the document as keyed hashes until approval; posting then ties each hash to an owner.
An owner found by NID wins over a name match, so spelling variants of one person stay one owner.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.nid import NidError, nid_key
from app.models.document import Document
from app.models.owner import Owner
from app.models.user import User
from app.schemas.document import DocumentOut, PartyNidIn, PartyNidsPatch
from app.services import audit
from app.services.documents import _to_out
from app.services.extraction import EDITABLE_STATUSES, is_survey_doc

PARTIES = ("buyer", "seller")


def key_json(nid: str, dob: date) -> dict[str, str]:
    try:
        return nid_key(nid, dob).to_json()
    except NidError as exc:
        raise AppError(exc.code, "Check the NID number and date of birth", 422) from None


def parse_form(nid: str | None, dob: str | None, party: str) -> dict[str, str] | None:
    """Upload form pair -> stored key. Both blank = not given; one without the other = error."""
    nid, dob = (nid or "").strip(), (dob or "").strip()
    if not nid and not dob:
        return None
    if not nid or not dob:
        raise AppError("NID_DOB_REQUIRED", "Enter both the NID and the date of birth", 422,
                       {"party": party})  # fmt: skip
    try:
        when = date.fromisoformat(dob)
    except ValueError:
        raise AppError("INVALID_DATE_OF_BIRTH", "Date of birth must be YYYY-MM-DD", 422,
                       {"party": party}) from None  # fmt: skip
    return key_json(nid, when)


def _check_distinct(nids: dict[str, dict[str, str]]) -> None:
    b, s = nids.get("buyer"), nids.get("seller")
    if b and s and b["nid_hash"] == s["nid_hash"]:
        raise AppError("SAME_PARTY_NID", "Buyer and seller cannot have the same NID", 422)


def from_upload(
    buyer_nid: str | None, buyer_dob: str | None, seller_nid: str | None, seller_dob: str | None
) -> dict[str, dict[str, str]] | None:
    nids = {
        party: key
        for party, key in (
            ("buyer", parse_form(buyer_nid, buyer_dob, "buyer")),
            ("seller", parse_form(seller_nid, seller_dob, "seller")),
        )
        if key
    }
    _check_distinct(nids)
    return nids or None


def set_party_nids(
    db: Session, user: User, document_id: str, body: PartyNidsPatch, ip: str | None
) -> DocumentOut:
    doc = db.get(Document, document_id)
    if doc is None:
        raise AppError("DOCUMENT_NOT_FOUND", "Document not found", 404)
    if doc.processing_status not in EDITABLE_STATUSES:
        raise AppError("DOCUMENT_NOT_EDITABLE", "Document is not awaiting review", 409,
                       {"status": doc.processing_status})  # fmt: skip
    if is_survey_doc(doc):
        raise AppError("PARTY_NID_NOT_APPLICABLE", "Survey records have no deed parties", 409)
    nids = dict(doc.party_nids or {})
    given: dict[str, PartyNidIn | None] = {
        p: getattr(body, p) for p in PARTIES if p in body.model_fields_set
    }
    if not given:
        raise AppError("NO_CHANGES", "Nothing to update", 422)
    for party, value in given.items():
        if value is None:
            nids.pop(party, None)
        else:
            nids[party] = key_json(value.nid, value.date_of_birth)
    _check_distinct(nids)
    doc.party_nids = nids or None
    # which parties changed, never the numbers or their hashes
    audit.log(db, user, "DOCUMENT_PARTY_NID_SET", "document", doc.id,
              new={"parties": sorted(given)}, ip=ip)  # fmt: skip
    db.commit()
    return _to_out(db, doc)


def has_buyer_nid(doc: Document) -> bool:
    return bool((doc.party_nids or {}).get("buyer"))


def find_owner(db: Session, key: dict[str, str]) -> Owner | None:
    """The owner already on record with this NID. A different date of birth means one of the two
    entries is wrong: stop rather than give the land to whoever typed the number."""
    owner = db.scalar(select(Owner).where(Owner.nid_hash == key["nid_hash"]))
    if owner is None:
        return None
    if owner.dob_hash is not None and owner.dob_hash != key["dob_hash"]:
        raise AppError("NID_DOB_CONFLICT",
                       "This NID is on record with a different date of birth", 409)  # fmt: skip
    owner.dob_hash = key["dob_hash"]
    return owner


def attach(db: Session, owner: Owner, key: dict[str, str], name: str | None,
           father: str | None) -> Owner:  # fmt: skip
    """Give a name-matched owner the NID; if they already carry another NID, it is someone else."""
    if owner.nid_hash is None:
        owner.nid_hash, owner.dob_hash = key["nid_hash"], key["dob_hash"]
        return owner
    if owner.nid_hash == key["nid_hash"]:
        return owner
    other = Owner(name=name or owner.name, father_name=father,
                  nid_hash=key["nid_hash"], dob_hash=key["dob_hash"])  # fmt: skip
    db.add(other)
    db.flush()
    return other
