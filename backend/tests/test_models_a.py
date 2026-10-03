import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models import Document, LandParcel, Owner, User


@pytest.fixture
def db() -> Session:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


def _parcel(**kw) -> LandParcel:
    base = dict(
        land_id="LS-0001",
        district="Dhaka",
        upazila="Savar",
        mouza="Ashulia",
        dag_no="101",
        khatian_no="55",
        area=12.5,
        area_unit="decimal",
    )
    base.update(kw)
    return LandParcel(**base)


def test_user_insert_defaults(db: Session):
    db.add(User(name="A", email="a@x.bd", password_hash="h"))
    db.commit()
    u = db.query(User).one()
    assert len(u.id) == 36 and u.role == "CITIZEN" and u.is_active is True
    assert u.created_at is not None and u.preferred_language == "en"


def test_user_email_unique(db: Session):
    db.add_all(
        [
            User(name="A", email="a@x.bd", password_hash="h"),
            User(name="B", email="a@x.bd", password_hash="h"),
        ]
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_parcel_land_id_unique(db: Session):
    db.add_all([_parcel(), _parcel(dag_no="102")])
    with pytest.raises(IntegrityError):
        db.commit()


def test_parcel_composite_identifiers_unique(db: Session):
    db.add_all([_parcel(), _parcel(land_id="LS-0002")])
    with pytest.raises(IntegrityError):
        db.commit()


def test_parcel_geometry_json_roundtrip(db: Session):
    geo = {"type": "Point", "coordinates": [90.4, 23.8]}
    db.add(_parcel(geometry=geo))
    db.commit()
    p = db.query(LandParcel).one()
    assert p.geometry == geo and p.status == "ACTIVE"


def test_owner_insert(db: Session):
    db.add(Owner(name="Rahim", father_name="Karim", nid_hash="salt$abc"))
    db.commit()
    o = db.query(Owner).one()
    assert o.name == "Rahim" and o.contact_hash is None


def test_document_extraction_json_and_fk(db: Session):
    p = _parcel()
    u = User(name="O", email="o@x.bd", password_hash="h", role="OFFICER")
    db.add_all([p, u])
    db.commit()
    ext = {"khatian_no": {"value": "55", "confidence": 0.93}}
    db.add(
        Document(
            land_id=p.id,
            document_type="DEED",
            file_path="storage/a.png",
            file_hash="deadbeef",
            extraction_json=ext,
            uploaded_by=u.id,
        )
    )
    db.commit()
    d = db.query(Document).one()
    assert d.extraction_json == ext and d.processing_status == "UPLOADED"


def test_alembic_upgrade_head_fresh_sqlite(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    from app.core.config import get_settings

    get_settings.cache_clear()
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    names = set(inspect(make_engine(url)).get_table_names())
    assert {"users", "land_parcels", "owners", "documents"} <= names
    get_settings.cache_clear()
