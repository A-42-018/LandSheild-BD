from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError


def test_health_ok(client: TestClient) -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_not_found_error_shape(client: TestClient) -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    body = r.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "NOT_FOUND"


def test_method_not_allowed_error_shape(client: TestClient) -> None:
    r = client.post("/api/v1/health")
    assert r.status_code == 405
    assert r.json()["code"] == "METHOD_NOT_ALLOWED"


def test_app_error_and_validation_and_unhandled_shapes(app: FastAPI) -> None:
    class Body(BaseModel):
        n: int

    @app.get("/boom-app")
    def boom_app() -> None:
        raise AppError("CUSTOM_CODE", "custom", status_code=409, details={"k": "v"})

    @app.post("/needs-body")
    def needs_body(body: Body) -> dict[str, int]:
        return {"n": body.n}

    @app.get("/boom-500")
    def boom_500() -> None:
        raise RuntimeError("secret internals")

    c = TestClient(app, raise_server_exceptions=False)

    r = c.get("/boom-app")
    assert r.status_code == 409
    assert r.json() == {"code": "CUSTOM_CODE", "message": "custom", "details": {"k": "v"}}

    r = c.post("/needs-body", json={"n": "x"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert isinstance(body["details"], list) and body["details"][0]["loc"] == ["body", "n"]

    r = c.get("/boom-500")
    assert r.status_code == 500
    assert r.json() == {
        "code": "INTERNAL_ERROR",
        "message": "Internal server error",
        "details": None,
    }
    assert "secret" not in r.text


def test_cors_allows_configured_origin(client: TestClient) -> None:
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    r = client.get("/api/v1/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers
