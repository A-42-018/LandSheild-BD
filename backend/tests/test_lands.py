import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.config import Settings
from app.core.db import Base, get_db, make_engine
from app.core.passwords import hash_password
from app.main import create_app
from app.models.user import User
from app.services import auth as svc

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "database" / "seed"))
import loader  # noqa: E402

PW = "correct-horse-1"
ROLES = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]
Q = {"district": "Dhaka", "upazila": "Savar", "mouza": "Ashulia", "khatian": "610", "dag": "210"}
FORBIDDEN_KEYS = {"password_hash", "nid_hash", "contact_hash", "file_path", "id", "geometry"}


# TEST_DATABASE_URL=postgresql://... runs the API tests against Postgres (CI job, H5 / D6); the
# tables are dropped and created again for every test. Unset = a fresh SQLite file per test.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")


def _engine(tmp_path):
    if not TEST_DATABASE_URL:
        engine = make_engine(f"sqlite:///{tmp_path / 'l.db'}")
    else:
        engine = make_engine(TEST_DATABASE_URL)
        with engine.begin() as conn:  # leftovers of the last test (and archive search tables)
            # a session another test left open would block the DROP: end those connections first
            conn.exec_driver_sql(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = current_database() AND pid <> pg_backend_pid()"
            )
            conn.exec_driver_sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def env(tmp_path):
    svc.clear_revoked()
    svc.reset_login_limits()
    engine = _engine(tmp_path)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    app = create_app(Settings(_env_file=None, jwt_secret="test-secret"))

    def _db():
        with maker() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    with maker() as s:
        loader.seed(s, demo_password="seed-pw")
        for r in ROLES:
            s.add(
                User(
                    name=r,
                    email=f"{r.lower()}@x.test",
                    password_hash=hash_password(PW),
                    role=r,
                )
            )
        s.commit()
    yield TestClient(app, raise_server_exceptions=False)
    engine.dispose()  # Postgres: give the connections back before the next test drops the schema


def _h(c, role):
    r = c.post("/api/v1/auth/login", json={"email": f"{role.lower()}@x.test", "password": PW})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _keys(v)


def test_get_by_land_id_happy(env):
    r = env.get("/api/v1/lands/LP-10100", headers=_h(env, "CITIZEN"))
    assert r.status_code == 200
    b = r.json()
    assert b["land_id"] == "LP-10100" and b["khatian_no"] == "610" and b["area"] == 20
    assert [o["name"] for o in b["current_owners"]]  # current owner present


def test_search_happy_case_insensitive_and_bangla_digits(env):
    h = _h(env, "CITIZEN")
    assert env.get("/api/v1/lands/search", params=Q, headers=h).json()["land_id"] == "LP-10100"
    q = {**Q, "district": "dhaka", "khatian": "৬১০", "dag": "২১০"}
    r = env.get("/api/v1/lands/search", params=q, headers=h)
    assert r.status_code == 200 and r.json()["land_id"] == "LP-10100"


def test_father_name_masked_for_citizen_only(env):
    cit = env.get("/api/v1/lands/LP-10100", headers=_h(env, "CITIZEN")).json()
    assert all(o["father_name"] is None for o in cit["current_owners"])
    for role in ("REVIEWER", "OFFICER", "ADMIN"):
        b = env.get("/api/v1/lands/LP-10100", headers=_h(env, role)).json()
        assert any(o["father_name"] for o in b["current_owners"]), role


@pytest.mark.parametrize("role", ROLES)
def test_no_sensitive_fields(env, role):
    h = _h(env, role)
    for url, params in (("/api/v1/lands/LP-10100", None), ("/api/v1/lands/search", Q)):
        body = env.get(url, params=params, headers=h).json()
        assert not (set(_keys(body)) & FORBIDDEN_KEYS)


def test_not_found_shape(env):
    h = _h(env, "CITIZEN")
    r = env.get("/api/v1/lands/LP-99999", headers=h)
    assert r.status_code == 404
    assert r.json() == {
        "code": "LAND_NOT_FOUND",
        "message": "Land parcel not found",
        "details": None,
    }
    r = env.get("/api/v1/lands/search", params={**Q, "dag": "999"}, headers=h)
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"


def test_search_requires_all_params(env):
    q = {k: v for k, v in Q.items() if k != "dag"}
    r = env.get("/api/v1/lands/search", params=q, headers=_h(env, "CITIZEN"))
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION_ERROR"


def test_unauthenticated_is_401(env):
    assert env.get("/api/v1/lands/LP-10100").status_code == 401
    assert env.get("/api/v1/lands/search", params=Q).status_code == 401
