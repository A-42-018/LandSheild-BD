# ruff: noqa: E501
"""P52: logs never carry credentials, tokens, e-mail addresses or hashes."""
import io
import json
import logging

import pytest

from app.core.logging import REDACTED, JsonFormatter, redact_text, redact_value
from tests.test_lands import _h

P = "/api/v1"
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLWJ5dGVz"


@pytest.fixture
def logbuf():
    buf = io.StringIO()
    h = logging.StreamHandler(buf)
    h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(h)
    root.setLevel(logging.DEBUG)
    yield buf
    root.removeHandler(h)
    root.setLevel(old_level)


@pytest.mark.parametrize(
    "text",
    [
        "login a.b+c@example.org failed",
        "Authorization: Bearer abc.def.ghi",
        f"token={JWT}",
        "password=hunter2 next",
        'cookie: "ls_refresh=zzz"',
        f"raw {JWT} end",
    ],
)
def test_redact_text_strips_secrets(text):
    out = redact_text(text)
    for secret in ("a.b+c@example.org", "abc.def.ghi", JWT, "hunter2", "zzz"):
        assert secret not in out
    assert REDACTED in out


def test_redact_value_by_key_and_nested():
    out = redact_value("ctx", {"password": "x", "nested": {"nid_hash": "y", "ok": "fine", "list": ["a@b.co"]}})
    assert out["password"] == REDACTED and out["nested"]["nid_hash"] == REDACTED
    assert out["nested"]["ok"] == "fine" and out["nested"]["list"] == [REDACTED]
    assert redact_value("path", "/api/v1/lands/LP-10001") == "/api/v1/lands/LP-10001"


def test_formatter_redacts_msg_extra_and_traceback():
    try:
        raise RuntimeError("boom password=hunter2 for owner@x.test")
    except RuntimeError:
        rec = logging.LogRecord("t", logging.ERROR, "", 0, "failed for owner@x.test", (), __import__("sys").exc_info())
    rec.__dict__.update({"file_path": "/srv/storage/x.png", "doc": "ok"})
    line = JsonFormatter().format(rec)
    assert "hunter2" not in line and "owner@x.test" not in line and "/srv/storage" not in line
    assert json.loads(line)["doc"] == "ok"


def test_unhandled_error_is_logged_redacted_and_response_is_generic(env, logbuf):
    def boom():
        raise RuntimeError(f"db down password=hunter2 user=owner@x.test token={JWT}")

    env.app.add_api_route(f"{P}/_boom", boom, methods=["GET"])
    r = env.get(f"{P}/_boom", headers={"Authorization": f"Bearer {JWT}"})
    assert r.status_code == 500 and r.json()["code"] == "INTERNAL_ERROR"
    assert "hunter2" not in r.text and "RuntimeError" not in r.text
    logs = logbuf.getvalue()
    assert "unhandled_exception" in logs
    for secret in ("hunter2", "owner@x.test", JWT):
        assert secret not in logs


def test_auth_flows_log_no_credentials(env, logbuf):
    env.post(f"{P}/auth/login", json={"email": "citizen@x.test", "password": "definitely-wrong-pw"})
    env.post(f"{P}/auth/register", json={"name": "N", "email": "fresh@x.test", "password": "another-secret-pw1"})
    h = _h(env, "CITIZEN")
    env.get(f"{P}/auth/me", headers=h)
    logs = logbuf.getvalue()
    for secret in ("definitely-wrong-pw", "another-secret-pw1", "fresh@x.test", "citizen@x.test",
                   h["Authorization"].split()[1]):  # fmt: skip
        assert secret not in logs
