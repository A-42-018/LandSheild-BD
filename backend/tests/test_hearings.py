# ruff: noqa: E501, F811
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.mutation import MutationRecord
from tests.test_documents import _db  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_mutation_offices import _open_case
from tests.test_officer_offices import RUPGANJ, SAVAR, _approved_officer

M = "/api/v1/mutations"
STATS = "/api/v1/officer/stats"


def _in_days(n: int, hour: int = 10) -> datetime:
    return (datetime.now(UTC) + timedelta(days=n)).replace(hour=hour, minute=0, second=0, microsecond=0)


def _month(when: datetime) -> str:
    # same month the API uses: Dhaka time
    return (when + timedelta(hours=6)).strftime("%Y-%m")


@pytest.fixture
def case(env):
    return _open_case(env, **SAVAR)


def _go(env, mid, hdr, **body):
    return env.post(f"{M}/{mid}/transition", headers=hdr, json={"to": "HEARING", "reason": "needs a hearing", **body})


def test_hearing_date_goes_with_the_hearing_transition(env, case):
    admin = _h(env, "ADMIN")
    when = _in_days(3)
    r = _go(env, case, admin, hearing_at=when.isoformat())
    assert r.status_code == 200 and r.json()["status"] == "HEARING"
    assert datetime.fromisoformat(r.json()["hearing_at"]).timestamp() == when.timestamp()
    cal = env.get(f"{M}/hearings", headers=admin, params={"month": _month(when)}).json()
    assert [i["id"] for i in cal["items"]] == [case] and cal["unscheduled"] == []


def test_hearing_without_a_date_is_listed_as_unscheduled(env, case):
    admin = _h(env, "ADMIN")
    assert _go(env, case, admin).status_code == 200
    cal = env.get(f"{M}/hearings", headers=admin, params={"month": _month(_in_days(0))}).json()
    assert cal["items"] == [] and [i["id"] for i in cal["unscheduled"]] == [case]
    assert cal["unscheduled"][0]["hearing_at"] is None


def test_schedule_and_move_a_hearing_is_audited(env, case):
    admin = _h(env, "ADMIN")
    _go(env, case, admin)
    first, second = _in_days(2), _in_days(9, hour=14)
    for when in (first, second):
        r = env.post(f"{M}/{case}/hearing", headers=admin, json={"hearing_at": when.isoformat()})
        assert r.status_code == 200
        assert datetime.fromisoformat(r.json()["hearing_at"]).timestamp() == when.timestamp()
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.action == "MUTATION_HEARING_SET").order_by(AuditLog.created_at)).all()
    assert len(rows) == 2 and rows[1].old_value["hearing_at"] and rows[0].old_value["hearing_at"] is None


def test_hearing_validation(env, case):
    admin = _h(env, "ADMIN")
    not_yet = env.post(f"{M}/{case}/hearing", headers=admin, json={"hearing_at": _in_days(2).isoformat()})
    assert not_yet.status_code == 409 and not_yet.json()["code"] == "MUTATION_NOT_IN_HEARING"
    past = _go(env, case, admin, hearing_at=_in_days(-1).isoformat())
    assert past.status_code == 422 and past.json()["code"] == "HEARING_DATE_PAST"
    _go(env, case, admin)
    assert env.post(f"{M}/{case}/hearing", headers=admin, json={"hearing_at": _in_days(-2).isoformat()}).json()["code"] == "HEARING_DATE_PAST"
    assert env.post(f"{M}/{case}/hearing", headers=admin, json={"hearing_at": "soon"}).status_code == 422
    other = env.post(f"{M}/{case}/transition", headers=admin, json={"to": "APPROVED", "hearing_at": _in_days(2).isoformat()})
    assert other.status_code == 422 and other.json()["code"] == "HEARING_DATE_UNEXPECTED"


def test_calendar_month_and_roles(env, case):
    admin = _h(env, "ADMIN")
    when = _in_days(40)
    _go(env, case, admin, hearing_at=when.isoformat())
    assert env.get(f"{M}/hearings", headers=admin, params={"month": _month(_in_days(0))}).json()["items"] == []
    assert len(env.get(f"{M}/hearings", headers=admin, params={"month": _month(when)}).json()["items"]) == 1
    for bad in ("2026-13", "26-10", "2026-1"):
        assert env.get(f"{M}/hearings", headers=admin, params={"month": bad}).status_code == 422
    assert env.get(f"{M}/hearings", params={"month": "2026-10"}).status_code == 401
    for role in ("CITIZEN", "REVIEWER"):
        assert env.get(f"{M}/hearings", headers=_h(env, role), params={"month": "2026-10"}).status_code == 403
        assert env.post(f"{M}/{case}/hearing", headers=_h(env, role), json={"hearing_at": when.isoformat()}).status_code == 403


def test_calendar_is_scoped_to_the_officers_offices(env, case):
    when = _in_days(5)
    _go(env, case, _h(env, "ADMIN"), hearing_at=when.isoformat())
    month = _month(when)
    savar, _ = _approved_officer(env, "s@x.office", **SAVAR)
    other, _ = _approved_officer(env, "r@x.office", **RUPGANJ)
    assert len(env.get(f"{M}/hearings", headers=savar, params={"month": month}).json()["items"]) == 1
    assert env.get(f"{M}/hearings", headers=other, params={"month": month}).json()["items"] == []
    denied = env.post(f"{M}/{case}/hearing", headers=other, json={"hearing_at": when.isoformat()})
    assert denied.status_code == 404


def test_stats_are_office_scoped_and_count_settled_and_upcoming(env, case):
    admin = _h(env, "ADMIN")
    savar, _ = _approved_officer(env, "s2@x.office", **SAVAR)
    other, _ = _approved_officer(env, "r2@x.office", **RUPGANJ)
    _go(env, case, admin, hearing_at=_in_days(3).isoformat())
    a, s, o = (env.get(STATS, headers=h).json() for h in (admin, savar, other))
    assert a["total_records"] == 12 and 0 < s["total_records"] < 12 and o["total_records"] == 0
    assert (s["pending_mutations"], s["hearings_upcoming"]) == (1, 1)
    assert (o["pending_mutations"], o["hearings_upcoming"], o["active_encumbrances"]) == (0, 0, 0)
    assert o["ledger_status"] == "INTACT"  # the chain is system-wide
    # settle it: counts this month for the Savar officer only
    with _db(env) as db:
        m = db.get(MutationRecord, case)
        m.status, m.decided_at = "APPROVED", datetime.now(UTC)
        db.commit()
    s2, o2 = (env.get(STATS, headers=h).json() for h in (savar, other))
    assert (s2["settled_this_month"], s2["hearings_upcoming"], s2["pending_mutations"]) == (1, 0, 0)
    assert o2["settled_this_month"] == 0
