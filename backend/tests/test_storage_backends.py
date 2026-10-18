# ruff: noqa: E501
"""H5 / D6: storage backends (S3-compatible bucket next to the local disk), Postgres URLs, seed
modes, production checks and migration 0017."""
import importlib.util
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import Settings, production_problems
from app.core.db import normalize_url
from app.services.storage import LocalStorage, S3Storage, StorageError, make_storage, sha256_hex

_spec = importlib.util.spec_from_file_location(
    "seed_script", Path(__file__).resolve().parents[2] / "scripts" / "seed.py"
)
seed_script = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seed_script)


class _Missing(Exception):
    def __init__(self) -> None:
        self.response = {"Error": {"Code": "404"}}


class FakeS3:
    """The four boto3 S3 calls S3Storage makes, in memory."""

    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], dict] = {}
        self.puts = 0

    def put_object(self, Bucket, Key, Body, ContentType, Metadata):  # noqa: N803
        self.puts += 1
        self.objects[(Bucket, Key)] = {"body": Body, "type": ContentType, "meta": Metadata}

    def get_object(self, Bucket, Key):  # noqa: N803
        if (Bucket, Key) not in self.objects:
            raise _Missing()
        body = self.objects[(Bucket, Key)]["body"]
        return {"Body": type("B", (), {"read": lambda self: body})()}

    def head_object(self, Bucket, Key):  # noqa: N803
        if (Bucket, Key) not in self.objects:
            raise _Missing()
        return {}

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.objects.pop((Bucket, Key), None)


def test_s3_keys_are_content_addressed_and_never_written_twice():
    fake = FakeS3()
    st = S3Storage(fake, "deeds")
    a = st.save(b"%PDF-1.4 deed", "PDF")
    assert a.key == f"documents/{sha256_hex(b'%PDF-1.4 deed')}.pdf" and a.size == 13
    assert fake.objects[("deeds", a.key)]["type"] == "application/pdf"
    assert fake.objects[("deeds", a.key)]["meta"] == {"sha256": a.sha256}
    assert st.save(b"%PDF-1.4 deed", "pdf") == a and fake.puts == 1
    assert st.read(a.key) == b"%PDF-1.4 deed" and st.exists(a.key)
    st.delete(a.key)
    assert not st.exists(a.key)
    with pytest.raises(StorageError):
        st.read(a.key)


@pytest.mark.parametrize("key", ["", "/abs", "a/../b", "a//b", "a\\b", "./a", "a\x00"])
def test_s3_refuses_unsafe_keys(key):
    st = S3Storage(FakeS3(), "deeds")
    with pytest.raises(StorageError):
        st.read(key)
    assert st.exists(key) is False


def test_s3_refuses_bad_extensions_and_needs_a_bucket():
    with pytest.raises(StorageError):
        S3Storage(FakeS3(), "deeds").save(b"x", "p/df")
    with pytest.raises(StorageError):
        S3Storage(FakeS3(), "")


def test_make_storage_picks_the_backend(tmp_path):
    s = Settings(_env_file=None, storage_path=str(tmp_path))
    assert isinstance(make_storage(s), LocalStorage)
    with pytest.raises(StorageError):
        make_storage(Settings(_env_file=None, storage_backend="ftp"))


def test_production_requires_s3_credentials_when_s3_is_chosen():
    base = dict(
        _env_file=None, jwt_secret="x" * 40, cookie_secure=True, hash_salt="y" * 20,
        cors_origins="https://landshield.example", storage_backend="s3",
    )  # fmt: skip
    problems = production_problems(Settings(**base))
    assert any("S3_BUCKET" in p for p in problems) and any("S3_SECRET_ACCESS_KEY" in p for p in problems)
    ok = Settings(**base, s3_bucket="b", s3_access_key_id="k", s3_secret_access_key="s")
    assert production_problems(ok) == []
    assert "S3_SECRET" not in repr(ok) and "s3_secret_access_key='s'" not in repr(ok)


def test_postgres_urls_use_psycopg():
    assert normalize_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("postgresql://u@h/db?sslmode=require") == "postgresql+psycopg://u@h/db?sslmode=require"
    assert normalize_url("postgresql+psycopg://u@h/db") == "postgresql+psycopg://u@h/db"
    assert normalize_url("sqlite:///./x.db") == "sqlite:///./x.db"


def test_seed_auto_mode_keeps_a_persistent_database():
    assert seed_script.resolve_mode("auto", "sqlite") == "reset"
    assert seed_script.resolve_mode("auto", "postgresql") == "if-empty"
    assert seed_script.resolve_mode("add", "postgresql") == "add"


def _alembic(url: str) -> Config:
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "migrations"))
    cfg.set_main_option("sqlalchemy.url", normalize_url(url).replace("%", "%%"))
    return cfg


def _check_0017(url: str) -> None:
    cfg = _alembic(url)
    command.upgrade(cfg, "head")
    insp = inspect(create_engine(normalize_url(url)))
    cols = {c["name"] for c in insp.get_columns("document_records")}
    assert {"document_id", "version", "status", "schema", "record_json", "record_hash",
            "signature", "approved_by", "approved_at"} <= cols  # fmt: skip
    assert {"is_historical", "record_id"} <= {c["name"] for c in insp.get_columns("deeds")}
    command.downgrade(cfg, "0016")
    insp = inspect(create_engine(normalize_url(url)))
    assert "document_records" not in insp.get_table_names()
    assert "record_id" not in {c["name"] for c in insp.get_columns("deeds")}
    command.upgrade(cfg, "head")


def test_migration_0017_up_down_up_sqlite(tmp_path):
    _check_0017(f"sqlite:///{tmp_path / 'm.db'}")


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="needs TEST_DATABASE_URL (Postgres)")
def test_migrations_run_on_postgres():
    url = os.environ["TEST_DATABASE_URL"]
    engine = create_engine(normalize_url(url))
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    engine.dispose()
    _check_0017(url)


def test_a_value_the_database_rejects_is_a_422_not_a_500(app, client):
    """Postgres refuses NUL characters in text (SQLite stores them): DataError -> 422 INVALID_INPUT."""
    from sqlalchemy.exc import DataError

    @app.get("/boom-data")
    def boom():
        raise DataError("SELECT 1", {}, ValueError("NUL (0x00) bytes"))

    r = client.get("/boom-data")
    assert r.status_code == 422 and r.json()["code"] == "INVALID_INPUT"


def test_postgres_connections_use_utc():
    from app.core.db import make_engine

    pytest.importorskip("psycopg")
    engine = make_engine("postgresql://u@localhost/db")  # no connection is made here
    assert engine.dialect.name == "postgresql" and engine.dialect.driver == "psycopg"
    assert engine.pool._pre_ping is True
