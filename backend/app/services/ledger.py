"""Hash-chained ledger (F4c): tamper-evident log of the records a parcel's trust rests on.

Each entry stores the SHA-256 of one record's canonical payload (transaction, deed, mutation,
encumbrance) and chains to the previous entry:
    entry_hash = SHA-256("seq|entity_type|entity_id|payload_hash|prev_hash")
verify() walks the chain (seq gaps, prev/entry hashes) and checks that each record's LATEST
entry still matches the live row. integrity_failures() does the same row check for one parcel
(feeds the RECORD_INTEGRITY_FAILED rule). Records without an entry are ignored (legacy rows).
Flush only; the caller owns the transaction.
"""
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.deed import Deed
from app.models.encumbrance import LandEncumbrance
from app.models.land_parcel import LandParcel
from app.models.ledger import LedgerEntry
from app.models.mutation import MutationRecord
from app.models.transaction import Transaction
from app.services import signing

GENESIS = "0" * 64
INTACT, BROKEN = "INTACT", "BROKEN"
MODELS: dict[str, Any] = {
    "transaction": Transaction,
    "deed": Deed,
    "mutation": MutationRecord,
    "encumbrance": LandEncumbrance,
}


def _fields(kind: str, o: Any) -> dict:
    if kind == "transaction":
        return {
            "land": o.land_id, "seller": o.seller_id, "buyer": o.buyer_id, "deed": o.deed_id,
            "type": o.transaction_type, "area": f"{float(o.area):.4f}", "unit": o.area_unit,
            "date": o.transaction_date.isoformat() if o.transaction_date else "",
            "status": o.status,
        }  # fmt: skip
    if kind == "deed":
        return {"record_hash": signing.compute_hash(o), "status": o.status}
    if kind == "mutation":
        return {
            "no": o.mutation_no, "land": o.land_id, "deed": o.deed_id, "tx": o.transaction_id,
            "applicant": o.applicant_owner_id, "area": f"{float(o.area):.4f}",
            "unit": o.area_unit, "status": o.status,
        }  # fmt: skip
    return {
        "land": o.land_id, "type": o.type, "ref": o.reference_no, "authority": o.authority,
        "status": o.status,
    }  # fmt: skip


def payload_hash(kind: str, obj: Any) -> str:
    body = json.dumps(
        {"k": kind, **_fields(kind, obj)}, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    return hashlib.sha256(body.encode()).hexdigest()


def entry_hash(seq: int, kind: str, entity_id: str, p_hash: str, prev: str) -> str:
    return hashlib.sha256(f"{seq}|{kind}|{entity_id}|{p_hash}|{prev}".encode()).hexdigest()


def _last(db: Session) -> LedgerEntry | None:
    return db.scalar(select(LedgerEntry).order_by(LedgerEntry.seq.desc()).limit(1))


def append(db: Session, kind: str, entity_id: str) -> LedgerEntry | None:
    """Append the record's current state. No-op if its latest entry already matches."""
    obj = db.get(MODELS[kind], entity_id)
    if obj is None:
        return None
    ph = payload_hash(kind, obj)
    own = db.scalar(
        select(LedgerEntry)
        .where(LedgerEntry.entity_type == kind, LedgerEntry.entity_id == entity_id)
        .order_by(LedgerEntry.seq.desc())
        .limit(1)
    )
    if own is not None and own.payload_hash == ph:
        return own
    last = _last(db)
    seq, prev = (last.seq + 1, last.entry_hash) if last else (1, GENESIS)
    eh = entry_hash(seq, kind, entity_id, ph, prev)
    row = LedgerEntry(
        id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"landshield:ledger:{eh}")),  # deterministic (reseed)
        seq=seq, entity_type=kind, entity_id=entity_id, payload_hash=ph, prev_hash=prev,
        entry_hash=eh,
    )  # fmt: skip
    db.add(row)
    db.flush()
    return row


def record_encumbrance(db: Session, enc: LandEncumbrance) -> LedgerEntry | None:
    """Hook for any encumbrance create/update path (seed backfill uses append directly)."""
    return append(db, "encumbrance", enc.id)


def backfill(db: Session) -> int:
    """Append every record that has no entry yet (idempotent; deterministic order)."""
    n = 0
    for kind, model in MODELS.items():
        have = set(db.scalars(select(LedgerEntry.entity_id).where(LedgerEntry.entity_type == kind)))
        for eid in db.scalars(select(model.id).order_by(model.id)):
            if eid not in have:
                n += append(db, kind, eid) is not None
    return n


def verify(db: Session) -> dict:
    """INTACT, or the FIRST broken seq with a reason code."""
    rows = db.scalars(select(LedgerEntry).order_by(LedgerEntry.seq)).all()
    latest = {(r.entity_type, r.entity_id): r.seq for r in rows}
    out: dict[str, Any] = {"status": INTACT, "entries": len(rows), "broken_seq": None,
                           "reason": None, "entity_type": None, "entity_id": None}  # fmt: skip

    def broken(seq: int, reason: str, r: LedgerEntry | None = None) -> dict:
        out.update(status=BROKEN, broken_seq=seq, reason=reason)
        if r is not None:
            out.update(entity_type=r.entity_type, entity_id=r.entity_id)
        return out

    expected, prev = 1, GENESIS
    for r in rows:
        if r.seq != expected:
            return broken(expected, "SEQ_GAP")
        if r.prev_hash != prev:
            return broken(r.seq, "PREV_HASH_MISMATCH", r)
        if r.entry_hash != entry_hash(r.seq, r.entity_type, r.entity_id, r.payload_hash, prev):
            return broken(r.seq, "ENTRY_HASH_MISMATCH", r)
        if latest[(r.entity_type, r.entity_id)] == r.seq:
            obj = db.get(MODELS[r.entity_type], r.entity_id)
            if obj is None:
                return broken(r.seq, "RECORD_MISSING", r)
            if payload_hash(r.entity_type, obj) != r.payload_hash:
                return broken(r.seq, "RECORD_MODIFIED", r)
        expected, prev = r.seq + 1, r.entry_hash
    return out


def integrity_failures(db: Session, land: LandParcel) -> tuple[tuple[str, str], ...]:
    """(entity_type, entity_id) of this parcel's records whose live row no longer matches the
    ledger. Records never entered in the ledger are ignored."""
    bad: list[tuple[str, str]] = []
    for kind, model in MODELS.items():
        objs = {o.id: o for o in db.scalars(select(model).where(model.land_id == land.id))}
        if not objs:
            continue
        seen: dict[str, str] = {}
        for r in db.scalars(
            select(LedgerEntry)
            .where(LedgerEntry.entity_type == kind, LedgerEntry.entity_id.in_(list(objs)))
            .order_by(LedgerEntry.seq)
        ):
            seen[r.entity_id] = r.payload_hash  # last (highest seq) wins
        bad += [(kind, i) for i, h in sorted(seen.items()) if payload_hash(kind, objs[i]) != h]
    return tuple(bad)


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(LedgerEntry)) or 0
