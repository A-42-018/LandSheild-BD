from datetime import date

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models import Deed, LandParcel, Owner, OwnershipHistory, Transaction


@pytest.fixture
def db() -> Session:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


@pytest.fixture
def world(db: Session):
    land = LandParcel(
        land_id="LP-1", district="Dhaka", upazila="Savar", mouza="Ashulia",
        dag_no="785", khatian_no="1245", area=10, area_unit="decimal",
    )
    rahim, karim, hasan = (Owner(name=n) for n in ("Rahim", "Karim", "Hasan"))
    db.add_all([land, rahim, karim, hasan])
    db.commit()
    return land, rahim, karim, hasan


def _deed(land, seller, buyer, deed_no="D-1", **kw) -> Deed:
    return Deed(
        land_id=land.id, seller_id=seller.id, buyer_id=buyer.id, deed_no=deed_no,
        area=10, area_unit="decimal", transaction_date=date(2024, 1, 5), **kw,
    )


def test_deed_no_not_unique(db: Session, world):
    land, rahim, karim, hasan = world
    db.add_all([_deed(land, rahim, karim), _deed(land, rahim, hasan)])
    db.commit()
    assert db.query(Deed).filter_by(deed_no="D-1").count() == 2


def test_deed_defaults_and_relationships(db: Session, world):
    land, rahim, karim, _ = world
    d = _deed(land, rahim, karim)
    db.add(d)
    db.commit()
    assert d.status == "RECORDED" and d.area_unit == "decimal"
    assert d.seller.name == "Rahim" and d.buyer.name == "Karim" and d.land.land_id == "LP-1"


def test_transaction_links_deed_and_defaults(db: Session, world):
    land, rahim, karim, _ = world
    d = _deed(land, rahim, karim)
    db.add(d)
    db.flush()
    t = Transaction(
        land_id=land.id, seller_id=rahim.id, buyer_id=karim.id, deed_id=d.id,
        area=10, area_unit="decimal", transaction_date=date(2024, 1, 5),
    )
    db.add(t)
    db.commit()
    assert t.status == "RECORDED" and t.transaction_type == "SALE" and t.risk_score is None
    assert t.deed.deed_no == "D-1" and t.seller.name == "Rahim"


def test_double_sale_rows_coexist(db: Session, world):
    land, rahim, karim, hasan = world
    db.add_all(
        [
            Transaction(land_id=land.id, seller_id=rahim.id, buyer_id=b.id, area=10,
                        area_unit="decimal", status="FLAGGED" if b is hasan else "RECORDED")
            for b in (karim, hasan)
        ]
    )
    db.commit()
    rows = db.query(Transaction).filter_by(seller_id=rahim.id).all()
    assert len(rows) == 2 and {r.status for r in rows} == {"RECORDED", "FLAGGED"}


def test_ownership_history_current_owner_and_source(db: Session, world):
    land, rahim, karim, _ = world
    t = Transaction(land_id=land.id, seller_id=rahim.id, buyer_id=karim.id,
                    area=10, area_unit="decimal")
    db.add(t)
    db.flush()
    db.add_all(
        [
            OwnershipHistory(land_id=land.id, owner_id=rahim.id,
                             start_date=date(2000, 1, 1), end_date=date(2024, 1, 5)),
            OwnershipHistory(land_id=land.id, owner_id=karim.id, start_date=date(2024, 1, 5),
                             source_transaction_id=t.id, confidence=0.95),
        ]
    )
    db.commit()
    current = db.query(OwnershipHistory).filter(OwnershipHistory.end_date.is_(None)).one()
    assert current.owner.name == "Karim" and current.source_transaction.id == t.id


def test_fk_enforced(db: Session, world):
    land, rahim, _, _ = world
    db.add(Deed(land_id=land.id, seller_id=rahim.id, buyer_id="missing", deed_no="X",
                area=1, area_unit="decimal"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_migration_chain_and_indexes(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    from app.core.config import get_settings

    get_settings.cache_clear()
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    insp = inspect(make_engine(url))
    assert {"deeds", "transactions", "ownership_history"} <= set(insp.get_table_names())
    for table, col in [("deeds", "land_id"), ("deeds", "seller_id"), ("deeds", "deed_no"),
                       ("transactions", "land_id"), ("transactions", "seller_id"),
                       ("ownership_history", "land_id")]:
        assert any(i["column_names"] == [col] for i in insp.get_indexes(table)), (table, col)
    deed_no_idx = [i for i in insp.get_indexes("deeds") if i["column_names"] == ["deed_no"]]
    assert deed_no_idx and not any(i["unique"] for i in deed_no_idx)
    command.downgrade(cfg, "0001")
    get_settings.cache_clear()
