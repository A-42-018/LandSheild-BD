import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.config import Settings
from app.core.db import Base, get_db, make_engine
from app.core.passwords import hash_password
from app.main import create_app
from app.models.audit import AuditLog
from app.models.user import User
from app.services import auth as svc

PW = "correct-horse-1"
ROLES = ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]
# tier -> roles allowed (R4)
MATRIX = {
    "citizen": {"CITIZEN", "REVIEWER", "OFFICER", "ADMIN"},
    "reviewer": {"REVIEWER", "OFFICER", "ADMIN"},
    "officer": {"OFFICER", "ADMIN"},
    "admin": {"ADMIN"},
}


@pytest.fixture
def env(tmp_path):
    svc.clear_revoked()
    svc.reset_login_limits()
    engine = make_engine(f"sqlite:///{tmp_path / 'r.db'}")
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(_env_file=None, jwt_secret="test-secret")
    app = create_app(settings)

    def _db():
        with maker() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    with maker() as s:
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
    return TestClient(app, raise_server_exceptions=False), maker


def _token(c, role):
    r = c.post("/api/v1/auth/login", json={"email": f"{role.lower()}@x.test", "password": PW})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _audit(maker, action):
    with maker() as s:
        return list(s.scalars(select(AuditLog).where(AuditLog.action == action)))


@pytest.mark.parametrize("role", ROLES)
def test_matrix(env, role):
    c, _ = env
    h = _token(c, role)
    for tier, allowed in MATRIX.items():
        r = c.get(f"/api/v1/rbac/{tier}", headers=h)
        if role in allowed:
            assert r.status_code == 200 and r.json()["role"] == role
        else:
            assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"


def test_no_or_bad_token_is_401(env):
    c, _ = env
    for tier in MATRIX:
        assert c.get(f"/api/v1/rbac/{tier}").status_code == 401
    r = c.get("/api/v1/rbac/admin", headers={"Authorization": "Bearer junk"})
    assert r.status_code == 401


def test_deactivated_user_loses_access(env):
    c, maker = env
    h = _token(c, "ADMIN")
    with maker() as s:
        u = s.scalar(select(User).where(User.role == "ADMIN"))
        u.is_active = False
        s.commit()
    assert c.get("/api/v1/rbac/admin", headers=h).status_code == 401


def test_login_and_logout_audited(env):
    c, maker = env
    _token(c, "OFFICER")
    rows = _audit(maker, "LOGIN")
    assert len(rows) == 1 and rows[0].entity_type == "user" and rows[0].actor_id
    assert rows[0].ip_hash and "testclient" not in rows[0].ip_hash
    assert c.post("/api/v1/auth/logout").status_code == 204
    out = _audit(maker, "LOGOUT")
    assert len(out) == 1 and out[0].actor_id == rows[0].actor_id


def test_failed_login_audited(env):
    c, maker = env
    r = c.post("/api/v1/auth/login", json={"email": "officer@x.test", "password": "wrong-pass-1"})
    assert r.status_code == 401
    r = c.post("/api/v1/auth/login", json={"email": "ghost@x.test", "password": "wrong-pass-1"})
    assert r.status_code == 401
    rows = _audit(maker, "FAILED_LOGIN")
    assert len(rows) == 2
    assert sorted(bool(x.actor_id) for x in rows) == [False, True]
    assert all(x.new_value == {"reason": "INVALID_CREDENTIALS"} for x in rows)
    assert not _audit(maker, "LOGIN")


def test_login_rate_limit(env):
    c, maker = env
    bad = {"email": "officer@x.test", "password": "wrong-pass-1"}
    for _ in range(10):
        assert c.post("/api/v1/auth/login", json=bad).status_code == 401
    r = c.post("/api/v1/auth/login", json=bad)
    assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"
    good = {"email": "officer@x.test", "password": PW}
    assert c.post("/api/v1/auth/login", json=good).status_code == 429
    svc.reset_login_limits()
    assert c.post("/api/v1/auth/login", json=good).status_code == 200
