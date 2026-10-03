from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.config import Settings
from app.core.db import Base, get_db, make_engine
from app.core.passwords import hash_password
from app.core.security import ALGORITHM, create_access_token, get_secret
from app.main import create_app
from app.models.user import User
from app.services import auth as svc

PW = "correct-horse-1"


@pytest.fixture
def env(tmp_path):
    svc.clear_revoked()
    svc.reset_login_limits()
    engine = make_engine(f"sqlite:///{tmp_path / 't.db'}")
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    settings = Settings(_env_file=None, jwt_secret="test-secret")
    app = create_app(settings)

    def _db():
        with maker() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    return TestClient(app, raise_server_exceptions=False), maker, settings


def _register(c, email="a@x.test", **extra):
    return c.post(
        "/api/v1/auth/register", json={"name": "A", "email": email, "password": PW, **extra}
    )


def test_full_flow(env):
    c, _, _ = env
    r = _register(c)
    assert r.status_code == 201
    body = r.json()
    assert body["role"] == "CITIZEN" and "password_hash" not in body

    r = c.post("/api/v1/auth/login", json={"email": "a@x.test", "password": PW})
    assert r.status_code == 200
    tok = r.json()["access_token"]
    assert "ls_refresh" in r.cookies
    assert "httponly" in r.headers["set-cookie"].lower()

    r = c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200 and r.json()["email"] == "a@x.test"

    old_cookie = c.cookies.get("ls_refresh")
    r = c.post("/api/v1/auth/refresh")
    assert r.status_code == 200 and r.json()["access_token"]

    # rotated: old refresh token is revoked
    c.cookies.set("ls_refresh", old_cookie, path="/api/v1/auth")
    assert c.post("/api/v1/auth/refresh").status_code == 401

    c.cookies.clear()
    c.post("/api/v1/auth/login", json={"email": "a@x.test", "password": PW})
    cookie = c.cookies.get("ls_refresh")
    assert c.post("/api/v1/auth/logout").status_code == 204
    c.cookies.set("ls_refresh", cookie, path="/api/v1/auth")
    assert c.post("/api/v1/auth/refresh").status_code == 401


def test_register_forces_citizen_and_rejects_duplicates(env):
    c, _, _ = env
    r = _register(c, role="ADMIN")
    assert r.status_code == 201 and r.json()["role"] == "CITIZEN"
    assert _register(c).status_code == 409
    assert _register(c, email="bad").status_code == 422
    weak = {"name": "A", "email": "b@x.test", "password": "short"}
    r = c.post("/api/v1/auth/register", json=weak)
    assert r.status_code == 422


def test_bad_credentials(env):
    c, maker, _ = env
    _register(c)
    for email, pw in [("a@x.test", "wrong-pass-1"), ("nobody@x.test", PW)]:
        r = c.post("/api/v1/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS"
    with maker() as s:
        u = s.query(User).one()
        u.is_active = False
        s.commit()
    r = c.post("/api/v1/auth/login", json={"email": "a@x.test", "password": PW})
    assert r.status_code == 401


def test_me_requires_valid_token(env):
    c, _, settings = env
    assert c.get("/api/v1/auth/me").status_code == 401
    r = c.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401 and r.json()["code"] == "TOKEN_INVALID"

    expired = jwt.encode(
        {"sub": "x", "type": "access", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        "test-secret",
        algorithm=ALGORITHM,
    )
    r = c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401 and r.json()["code"] == "TOKEN_EXPIRED"

    forged = jwt.encode(
        {"sub": "x", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "other-secret",
        algorithm=ALGORITHM,
    )
    r = c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_token_type_confusion(env):
    c, _, settings = env
    _register(c)
    c.post("/api/v1/auth/login", json={"email": "a@x.test", "password": PW})
    refresh = c.cookies.get("ls_refresh")
    r = c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert r.status_code == 401
    access = create_access_token(settings, "uid", "CITIZEN")
    c.cookies.set("ls_refresh", access, path="/api/v1/auth")
    assert c.post("/api/v1/auth/refresh").status_code == 401


def test_refresh_without_cookie(env):
    c, _, _ = env
    assert c.post("/api/v1/auth/refresh").status_code == 401


def test_seeded_scrypt_user_can_login(env):
    c, maker, _ = env
    with maker() as s:
        s.add(
            User(
                name="O",
                email="officer@demo.landshield.test",
                password_hash=hash_password(PW),
                role="OFFICER",
            )
        )
        s.commit()
    creds = {"email": "Officer@demo.landshield.test", "password": PW}
    r = c.post("/api/v1/auth/login", json=creds)
    assert r.status_code == 200 and r.json()["user"]["role"] == "OFFICER"


def test_missing_secret_fails_fast_outside_dev():
    with pytest.raises(RuntimeError):
        create_app(Settings(_env_file=None, jwt_secret="", app_env="prod"))
    assert get_secret(Settings(_env_file=None, jwt_secret="", app_env="dev"))
