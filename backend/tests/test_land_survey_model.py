import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models import LandParcel
from app.models.enums import SurveyType
from app.risk.context import SURVEY_TYPES

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "database" / "seed"))
import loader  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def db() -> Session:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


def _parcel(**kw) -> LandParcel:
    base = dict(
        land_id="LS-0001", district="Dhaka", upazila="Savar", mouza="Ashulia", dag_no="101",
        khatian_no="501", area=15, area_unit="decimal", survey_type="RS", jl_no="45",
        map_sheet_no="3",
    )
    base.update(kw)
    return LandParcel(**base)


def test_survey_enum_shared_with_risk():
    assert SURVEY_TYPES == ("CS", "SA", "RS", "BS") == tuple(s.value for s in SurveyType)


def test_same_khatian_dag_other_survey_allowed(db: Session):
    db.add_all([_parcel(), _parcel(land_id="LS-0002", survey_type="CS")])
    db.commit()
    assert db.query(LandParcel).count() == 2


def test_same_mouza_name_other_jl_allowed(db: Session):
    db.add_all([_parcel(), _parcel(land_id="LS-0002", upazila="Dhamrai", jl_no="17")])
    db.add(_parcel(land_id="LS-0003", jl_no="46"))
    db.commit()
    assert db.query(LandParcel).count() == 3


def test_true_duplicate_rejected(db: Session):
    db.add_all([_parcel(), _parcel(land_id="LS-0002")])
    with pytest.raises(IntegrityError):
        db.commit()


def test_legacy_null_rows_do_not_clash(db: Session):
    db.add_all([
        _parcel(survey_type=None, jl_no=None, map_sheet_no=None),
        _parcel(land_id="LS-0002"),
    ])
    db.commit()
    p = db.query(LandParcel).filter_by(land_id="LS-0001").one()
    assert (p.survey_type, p.jl_no, p.map_sheet_no) == (None, None, None)


def test_seed_has_survey_examples(db: Session):
    loader.seed(db, demo_password="pw")
    db.commit()
    rows = db.query(LandParcel).all()
    assert len(rows) == 15
    legacy = [r for r in rows if r.survey_type is None]
    assert [r.land_id for r in legacy] == ["LP-12003"] and legacy[0].jl_no is None
    assert all(r.jl_no and r.map_sheet_no for r in rows if r.land_id != "LP-12003")
    same = [r for r in rows if (r.mouza, r.khatian_no, r.dag_no) == ("Ashulia", "501", "101")]
    assert len(same) == 4
    ashulia_jl = {(r.upazila, r.jl_no) for r in rows if r.mouza == "Ashulia" and r.jl_no}
    assert {("Savar", "45"), ("Dhamrai", "17")} <= ashulia_jl


def _cfg(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def test_migration_0019_up_down_up_and_backfill(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    from app.core.config import get_settings

    get_settings.cache_clear()
    cfg = _cfg(url)
    command.upgrade(cfg, "0018")
    eng = create_engine(url)
    with eng.begin() as c:
        for lid, k in (("a", "1"), ("b", "2")):
            c.execute(text(
                "INSERT INTO land_parcels (id, land_id, district, upazila, mouza, dag_no, khatian_no,"
                " area, area_unit, status, created_at, updated_at) VALUES"
                f" ('{lid}','L-{k}','D','U','M','1','{k}',1,'decimal','ACTIVE',"
                "'2026-01-01','2026-01-01')"
            ))
        c.execute(text(
            "INSERT INTO documents (id, land_id, document_type, file_path, file_hash,"
            " extraction_json, processing_status, created_at) VALUES"
            " ('d1','a','KHATIAN','p','h1','{\"survey_type\": \"CS\", \"extras\": {\"jl_no\": \"012\"}}',"
            "'APPROVED','2026-01-01')"
        ))
        c.execute(text(
            "INSERT INTO documents (id, land_id, document_type, file_path, file_hash,"
            " extraction_json, processing_status, created_at) VALUES"
            " ('d2','a','PORCHA','p','h2','{\"survey_type\": \"RS\", \"extras\": {\"jl_no\": \"45\"}}',"
            "'APPROVED','2026-02-01')"
        ))
    command.upgrade(cfg, "head")
    with eng.connect() as c:
        rows = {r[0]: r[1:] for r in c.execute(text(
            "SELECT id, survey_type, jl_no, map_sheet_no FROM land_parcels"))}
    assert rows["a"] == ("RS", "45", None)  # newest extraction wins
    assert rows["b"] == (None, None, None)
    cols = {c["name"] for c in inspect(eng).get_columns("land_parcels")}
    assert {"survey_type", "jl_no", "map_sheet_no"} <= cols
    command.downgrade(cfg, "-1")
    assert "jl_no" not in {c["name"] for c in inspect(eng).get_columns("land_parcels")}
    command.upgrade(cfg, "head")
    uq = inspect(eng).get_unique_constraints("land_parcels")
    assert any("jl_no" in u["column_names"] for u in uq)

    get_settings.cache_clear()
