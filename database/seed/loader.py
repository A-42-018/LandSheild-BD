"""Idempotent demo seed loader (R7). All data is synthetic.

Demo Dataset — Not an Official Government Land Record.
Ids are deterministic (uuid5), so reset + seed always yields an identical state.
"""
import hashlib
import hmac
import json
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import Base
from app.core.passwords import hash_password
from app.models import (
    ContentItem,
    Deed,
    LandEncumbrance,
    LandParcel,
    MutationRecord,
    Owner,
    OwnershipHistory,
    Transaction,
    User,
)

DATA_FILE = Path(__file__).with_name("data.json")
_NS = uuid.UUID("5a1d5e1d-0000-4000-8000-1a4d5b1e1d00")


def load_data() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def load_geometry() -> dict:
    """Synthetic GeoJSON polygons keyed by land_id (P50). Missing file -> no geometry."""
    path = Path(__file__).with_name("geometry.json")
    if not path.exists():
        return {}
    return {k: v for k, v in json.loads(path.read_text(encoding="utf-8")).items() if k[:1] != "_"}


def _dt(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v).replace(tzinfo=UTC) if v else None


def sid(kind: str, key: str) -> str:
    return str(uuid.uuid5(_NS, f"{kind}:{key}"))


def _hash(kind: str, raw: str, salt: str) -> str:
    return hmac.new(salt.encode(), f"{kind}:{raw}".encode(), hashlib.sha256).hexdigest()


def _d(v: str | None) -> date | None:
    return date.fromisoformat(v) if v else None


# The notices the home page and the header ticker show (U3.6). Migration 0015 inserts the same
# four, but `reset` deletes every table, so a deploy that runs `seed.py --reset` after
# `alembic upgrade head` (Render) would serve an empty list and the ticker would vanish.
# (date, ticker, title_en, title_bn, body_en, body_bn)
NOTICES = [
    ("2026-10-14", True, "Check before you buy lists khas land and acquisition",
     "কেনার আগে যাচাইয়ে খাস জমি ও অধিগ্রহণ যুক্ত হয়েছে",
     "Plots on khas land or under acquisition now show as a red flag.",
     "খাস জমি বা অধিগ্রহণাধীন দাগ এখন সতর্ক সংকেত হিসেবে দেখা যায়।"),
    ("2026-10-12", True, "Track a mutation without signing in",
     "সাইন ইন ছাড়াই নামজারির অবস্থা",
     "Anyone can follow an application by its number.",
     "আবেদনের নম্বর দিয়ে যে কেউ অবস্থা অনুসরণ করতে পারেন।"),
    ("2026-10-07", False, "Role-based access reviewed",
     "ভূমিকাভিত্তিক প্রবেশাধিকার পর্যালোচিত",
     "Sign-in roles and the four-eyes approval rule were checked on every page.",
     "প্রতিটি পাতায় কে কী দেখতে পারেন তা পরীক্ষা করা হয়েছে। "
     "অনুমোদনে দুজন আলাদা মানুষ লাগে।"),
    ("2026-10-06", True, "Citizen tools added",
     "নতুন হিসাব-সহায়ক যুক্ত হয়েছে",
     "Land unit converter, fee calculator and inheritance shares.",
     "জমির একক বদল, ফি-র হিসাব ও উত্তরাধিকারের অংশ।"),
]


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()


def _ensure(db: Session, model, kind: str, key: str, **fields) -> bool:
    """Create the row if its deterministic id is absent. Returns True if created."""
    pk = sid(kind, key)
    if db.get(model, pk) is not None:
        return False
    db.add(model(id=pk, **fields))
    db.flush()
    return True


def seed(db: Session, demo_password: str | None = None, do_reset: bool = False) -> dict:
    password = demo_password if demo_password is not None else get_settings().demo_password
    if not password:
        raise ValueError("DEMO_PASSWORD is not set (env var only; never committed).")
    salt = get_settings().hash_salt
    data = load_data()
    geometry = load_geometry()
    if do_reset:
        reset(db)

    created = 0
    for u in data["users"]:
        pw_salt = hashlib.sha256(f"{u['email']}:{salt}".encode()).digest()[:16]
        created += _ensure(
            db, User, "user", u["key"],
            name=u["name"], email=u["email"], role=u["role"],
            preferred_language=u["preferred_language"], is_active=True,
            password_hash=hash_password(password, pw_salt),
        )
    for o in data["owners"]:
        created += _ensure(
            db, Owner, "owner", o["key"],
            name=o["name"], father_name=o["father_name"],
            nid_hash=_hash("nid", o["nid"], salt),
            contact_hash=_hash("contact", o["contact"], salt),
        )
    for ln in data["lands"]:
        created += _ensure(
            db, LandParcel, "land", ln["key"],
            land_id=ln["key"], district=ln["district"], upazila=ln["upazila"],
            mouza=ln["mouza"], dag_no=ln["dag_no"], khatian_no=ln["khatian_no"],
            area=ln["area"], area_unit=ln["area_unit"], status="ACTIVE",
            geometry=geometry.get(ln["key"]),
        )
        # databases seeded before P50 have no polygon yet: backfill only when still empty
        row = db.get(LandParcel, sid("land", ln["key"]))
        if row is not None and row.geometry is None and ln["key"] in geometry:
            row.geometry = geometry[ln["key"]]
            db.flush()
    for d in data["deeds"]:
        created += _ensure(
            db, Deed, "deed", d["key"],
            land_id=sid("land", d["land"]), deed_no=d["deed_no"],
            seller_id=sid("owner", d["seller"]), buyer_id=sid("owner", d["buyer"]),
            transaction_date=_d(d["date"]), area=d["area"], area_unit=d["area_unit"],
            status="RECORDED",
        )
    for t in data["transactions"]:
        created += _ensure(
            db, Transaction, "tx", t["key"],
            land_id=sid("land", t["land"]), deed_id=sid("deed", t["deed"]),
            seller_id=sid("owner", t["seller"]), buyer_id=sid("owner", t["buyer"]),
            transaction_type=t["type"], transaction_date=_d(t["date"]),
            area=t["area"], area_unit=t["area_unit"], status="RECORDED",
        )
    for h in data["ownership"]:
        created += _ensure(
            db, OwnershipHistory, "own", h["key"],
            land_id=sid("land", h["land"]), owner_id=sid("owner", h["owner"]),
            start_date=_d(h["start"]), end_date=_d(h["end"]),
            source_transaction_id=sid("tx", h["tx"]) if h["tx"] else None,
            confidence=1.0,
        )
    for m in data.get("mutations", []):
        applied, decided = _dt(m["applied"]), _dt(m.get("decided"))
        created += _ensure(
            db, MutationRecord, "mut", m["key"],
            mutation_no=m["no"], land_id=sid("land", m["land"]),
            deed_id=sid("deed", m["deed"]) if m.get("deed") else None,
            transaction_id=sid("tx", m["tx"]) if m.get("tx") else None,
            applicant_owner_id=sid("owner", m["applicant"]),
            previous_khatian_no=m.get("prev_khatian"), new_khatian_no=m.get("new_khatian"),
            area=m["area"], area_unit=m["area_unit"], ac_land_office=m.get("office"),
            status=m["status"], fast_track=m.get("fast_track", False),
            applied_at=applied, decided_at=decided,
            status_changed_at=decided or applied, source=m.get("source", "SEED"),
        )
    for e in data.get("encumbrances", []):
        created += _ensure(
            db, LandEncumbrance, "enc", e["key"],
            land_id=sid("land", e["land"]), type=e["type"], reference_no=e["ref"],
            authority=e.get("authority"), status=e["status"],
            started_at=_d(e.get("started")), resolved_at=_d(e.get("resolved")),
            note=e.get("note"),
        )
    # Only when there are no notices at all: migration 0015 already inserted them (random ids) on a
    # database that was not reset, and an admin who edited or removed them must not get them back.
    if db.scalar(select(ContentItem.id).where(ContentItem.kind == "NOTICE").limit(1)) is None:
        for d, tk, te, tb, be, bb in NOTICES:
            db.add(ContentItem(
                id=sid("notice", d), kind="NOTICE", title_en=te, title_bn=tb,
                body_en=be, body_bn=bb, published_on=_d(d), ticker=tk, published=True, position=0,
            ))
            created += 1
        db.flush()
    from app.services import signing  # F4a: sign seeded deeds (idempotent)

    signing.seal_unsigned(db)
    from app.services import ledger  # F4c: chain every seeded record (idempotent)

    ledger.backfill(db)
    db.commit()
    return {"created": created}
