import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.core.passwords import verify_password
from app.models import (
    ContentItem,
    Deed,
    Document,
    LandParcel,
    MutationRecord,
    Owner,
    OwnershipHistory,
    Transaction,
    User,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "database" / "seed"))
import loader  # noqa: E402

PW = "test-demo-password"


@pytest.fixture
def db() -> Session:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


def _snapshot(db: Session) -> dict:
    out = {}
    for table in Base.metadata.sorted_tables:
        rows = db.execute(select(table)).mappings().all()
        out[table.name] = sorted(
            tuple(
                sorted((k, str(v)) for k, v in r.items() if k not in ("created_at", "updated_at"))
            )
            for r in rows
        )
    return out


def _land(db, land_id):
    return db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))


def _txs(db, land_id):
    return db.scalars(
        select(Transaction).where(Transaction.land_id == _land(db, land_id).id)
    ).all()


def _owner(db, oid):
    return db.get(Owner, oid)


def test_requires_demo_password(db):
    with pytest.raises(ValueError):
        loader.seed(db, demo_password="")


def test_reset_seed_twice_identical(db):
    loader.seed(db, PW, do_reset=True)
    first = _snapshot(db)
    loader.seed(db, PW, do_reset=True)
    assert _snapshot(db) == first
    # plain re-seed (no reset) is idempotent too
    assert loader.seed(db, PW)["created"] == 0
    assert _snapshot(db) == first


def test_reset_seed_keeps_public_notices(db):
    """`seed.py --reset` runs after the migration on Render and wipes content_items."""
    loader.seed(db, PW, do_reset=True)
    notices = db.scalars(select(ContentItem).where(ContentItem.kind == "NOTICE")).all()
    assert len(notices) == 4 and all(n.published for n in notices)
    assert sorted(n.ticker for n in notices) == [False, True, True, True]
    loader.seed(db, PW)  # plain re-seed adds nothing
    assert db.scalar(select(func.count()).select_from(ContentItem)) == 4


def test_seed_does_not_duplicate_migrated_notices(db):
    db.add(ContentItem(
        id="from-migration", kind="NOTICE", title_en="t", title_bn="t", body_en="b", body_bn="b"
    ))
    db.commit()
    loader.seed(db, PW)
    assert db.scalar(select(func.count()).select_from(ContentItem)) == 1


def test_users_and_password(db):
    loader.seed(db, PW)
    users = {u.email: u for u in db.scalars(select(User))}
    assert {e.split("@")[0]: u.role for e, u in users.items()} == {
        "citizen": "CITIZEN", "reviewer": "REVIEWER", "officer": "OFFICER", "admin": "ADMIN",
    }
    assert all(e.endswith("@demo.landshield.test") for e in users)
    u = users["officer@demo.landshield.test"]
    assert verify_password(PW, u.password_hash)
    assert not verify_password("wrong", u.password_hash)
    assert PW not in u.password_hash


def test_owner_hashes_not_raw(db):
    loader.seed(db, PW)
    for o in db.scalars(select(Owner)):
        assert o.nid_hash and "SYN-" not in o.nid_hash
        assert o.contact_hash and "SYN-" not in o.contact_hash


def test_all_scenario_lands_exist(db):
    loader.seed(db, PW)
    ids = {ln.land_id for ln in db.scalars(select(LandParcel))}
    assert ids == {
        "LP-10001", "LP-10100", "LP-10234", "LP-10240", "LP-10300", "LP-10400", "LP-10500",
        "LP-10600", "LP-10700", "LP-10800", "LP-10900", "LP-11000",
    }


def test_live_demo_lp10234(db):
    loader.seed(db, PW)
    land = _land(db, "LP-10234")
    assert (land.dag_no, land.khatian_no, land.area) == ("785", "1245", 10)
    assert land.area_unit == "decimal"
    assert _txs(db, "LP-10234") == []
    cur = db.scalars(
        select(OwnershipHistory).where(
            OwnershipHistory.land_id == land.id, OwnershipHistory.end_date.is_(None)
        )
    ).all()
    assert len(cur) == 1 and _owner(db, cur[0].owner_id).name.startswith("Rahim")


def test_docs_not_loaded(db):
    loader.seed(db, PW)
    assert db.scalar(select(func.count()).select_from(Document)) == 0
    linked = select(func.count()).select_from(Deed).where(Deed.document_id.isnot(None))
    assert db.scalar(linked) == 0


def test_clean_lp10001(db):
    loader.seed(db, PW)
    assert _txs(db, "LP-10001") == []


def test_normal_chain_lp10100(db):
    loader.seed(db, PW)
    txs = sorted(_txs(db, "LP-10100"), key=lambda t: t.transaction_date)
    names = [(_owner(db, t.seller_id).name.split()[0], _owner(db, t.buyer_id).name.split()[0])
             for t in txs]
    assert names == [("Rahim", "Karim"), ("Karim", "Hasan")]
    assert len({t.area for t in txs}) == 1
    assert txs[0].transaction_date < txs[1].transaction_date


def test_double_sale_lp10240(db):
    loader.seed(db, PW)
    txs = _txs(db, "LP-10240")
    assert len(txs) == 2
    assert txs[0].seller_id == txs[1].seller_id
    assert {_owner(db, t.buyer_id).name.split()[0] for t in txs} == {"Karim", "Hasan"}


def test_area_and_seller_mismatch_baselines(db):
    loader.seed(db, PW)
    for lid, area, owner in (("LP-10300", 10, "Hasan"), ("LP-10400", 12, "Karim")):
        land = _land(db, lid)
        assert land.area == area
        assert _txs(db, lid) == []
        cur = db.scalars(
            select(OwnershipHistory).where(
                OwnershipHistory.land_id == land.id, OwnershipHistory.end_date.is_(None)
            )
        ).one()
        assert _owner(db, cur.owner_id).name.startswith(owner)
    # LP-10400 recorded owner is Karim (document seller Rahim is an upload fixture)


def test_duplicate_deed_lp10500(db):
    loader.seed(db, PW)
    txs = _txs(db, "LP-10500")
    assert len(txs) == 2
    deeds = [db.get(Deed, t.deed_id) for t in txs]
    assert deeds[0].deed_no == deeds[1].deed_no
    assert deeds[0].id != deeds[1].id


def test_mutations_seeded(db):
    loader.seed(db, PW)
    muts = db.scalars(select(MutationRecord)).all()
    assert len(muts) == 7 and {m.status for m in muts} == {"APPROVED"}
    assert len({m.mutation_no for m in muts}) == 7
    by_land = {}
    for m in muts:
        by_land.setdefault(db.get(LandParcel, m.land_id).land_id, []).append(m)
    # every seeded sale (except LP-10600) has an approved mutation
    sales = {t.id for t in db.scalars(select(Transaction))}
    assert {m.transaction_id for m in muts} == sales - {_txs(db, "LP-10600")[0].id}
    assert "LP-10600" not in by_land
    # LP-10700: mutation in favour of a third person (not the buyer)
    tx = _txs(db, "LP-10700")[0]
    assert by_land["LP-10700"][0].applicant_owner_id not in (tx.buyer_id, tx.seller_id)
