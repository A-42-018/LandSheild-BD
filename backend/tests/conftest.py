import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.ratelimit import reset_rate_limits
from app.main import create_app


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """The limiter is process-global in memory; no test may inherit another test's hits."""
    reset_rate_limits()


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, cors_origins="http://localhost:3000")


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    # raise_server_exceptions=False so the global 500 handler shape can be asserted
    return TestClient(app, raise_server_exceptions=False)
