from datetime import UTC, datetime, timedelta

import pytest

from app.core.db import get_db
from app.models.audit import AuditLog
from tests.test_lands import ROLES, _h, env  # noqa: F401

URL = "/api/v1/admin/audit-logs"
HASH = "a" * 64


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _add(env, action, entity="document", days_ago=0, ip=HASH):
    with _db(env) as s:
        s.add(AuditLog(action=action, entity_type=entity, ip_hash=ip,
                       old_value={"secret": 1}, new_value={"secret": 2},
                       created_at=datetime.now(UTC) - timedelta(days=days_ago)))  # fmt: skip
        s.commit()


@pytest.mark.parametrize(
    "role,code", [("CITIZEN", 403), ("REVIEWER", 403), ("OFFICER", 200), ("ADMIN", 200)]
)
def test_roles(env, role, code):
    assert env.get(URL, headers=_h(env, role)).status_code == code


def test_anonymous_401(env):
    assert env.get(URL).status_code == 401


def test_shape_and_ip_truncated(env):
    _add(env, "X_ACTION")
    r = env.get(URL, headers=_h(env, "ADMIN"), params={"action": "X_ACTION"})
    b = r.json()
    assert b["total"] == 1
    it = b["items"][0]
    assert it["ip_hash"] == "a" * 8
    assert it["actor"] is None
    assert set(it) == {"id", "action", "entity_type", "entity_id", "actor", "ip_hash", "created_at"}
    assert "secret" not in r.text and HASH not in r.text


def test_filters(env):
    _add(env, "A1", "document", days_ago=10)
    _add(env, "A2", "land", days_ago=0)
    h = _h(env, "OFFICER")
    g = lambda **p: env.get(URL, headers=h, params=p).json()  # noqa: E731
    assert g(entity_type="land", action="A2")["total"] == 1
    assert g(action="A1")["total"] == 1
    assert g(action="A1", entity_type="land")["total"] == 0
    today = datetime.now(UTC).date()
    assert g(action="A1", date_from=str(today - timedelta(days=5)))["total"] == 0
    assert g(action="A1", date_to=str(today - timedelta(days=5)))["total"] == 1
    d10 = str(today - timedelta(days=10))
    assert g(action="A1", date_from=d10, date_to=d10)["total"] == 1


def test_actor_filter_and_wildcards(env):
    h = _h(env, "ADMIN")  # login writes a LOGIN row with actor ADMIN
    b = env.get(URL, headers=h, params={"actor": "admi"}).json()
    assert b["total"] >= 1 and all(i["actor"]["name"] == "ADMIN" for i in b["items"])
    assert env.get(URL, headers=h, params={"actor": "%"}).json()["total"] == 0
    assert env.get(URL, headers=h, params={"actor": "zzz"}).json()["total"] == 0


def test_pagination_and_order(env):
    for i in range(5):
        _add(env, "P", days_ago=i)
    h = _h(env, "ADMIN")
    p1 = env.get(URL, headers=h, params={"action": "P", "limit": 2}).json()
    p3 = env.get(URL, headers=h, params={"action": "P", "limit": 2, "offset": 4}).json()
    assert p1["total"] == 5 and len(p1["items"]) == 2 and len(p3["items"]) == 1
    ts = [i["created_at"] for i in p1["items"]]
    assert ts == sorted(ts, reverse=True)


def test_validation(env):
    h = _h(env, "ADMIN")
    assert env.get(URL, headers=h, params={"limit": 101}).status_code == 422
    assert env.get(URL, headers=h, params={"date_from": "nope"}).status_code == 422
    r = env.get(URL, headers=h, params={"date_from": "2026-02-02", "date_to": "2026-01-01"})
    assert r.status_code == 422 and r.json()["code"] == "INVALID_DATE_RANGE"
