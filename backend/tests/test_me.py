# ruff: noqa: E501, F811
"""U3.2: citizen area `/me/*` — search history, watchlist alerts, reports, inbox, profile."""
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.ratelimit import reset_rate_limits
from app.models.citizen import SearchHistory
from app.models.encumbrance import LandEncumbrance
from app.models.land_parcel import LandParcel
from app.models.mutation import MutationRecord
from app.models.transaction import Transaction
from app.models.user import User
from tests.test_documents import _db
from tests.test_lands import PW, Q, _h, env  # noqa: F401

P = "/api/v1"


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits()


def _land_pk(env, code):
    with _db(env) as s:
        return s.scalar(select(LandParcel.id).where(LandParcel.land_id == code))


def test_citizen_lookups_fill_search_history_once_per_parcel(env):
    h = _h(env, "CITIZEN")
    assert env.get(f"{P}/lands/search", params=Q, headers=h).status_code == 200
    assert env.get(f"{P}/lands/LP-10100", headers=h).status_code == 200  # result page right after: same visit
    assert env.get(f"{P}/lands/LP-10240", headers=h).status_code == 200
    assert env.get(f"{P}/lands/LP-99999", headers=h).status_code == 404  # misses are not history
    body = env.get(f"{P}/me/searches", headers=h).json()
    assert body["total"] == 2
    assert [i["land_id"] for i in body["items"]] == ["LP-10240", "LP-10100"]  # newest first
    first = body["items"][1]
    assert first["search_count"] == 1 and first["mouza"] == "Ashulia" and first["watched"] is False


def test_repeat_lookup_after_the_window_bumps_the_count(env):
    h = _h(env, "CITIZEN")
    env.get(f"{P}/lands/LP-10100", headers=h)
    with _db(env) as s:
        row = s.scalars(select(SearchHistory)).one()
        row.last_searched_at = datetime.now(UTC) - timedelta(minutes=5)
        s.commit()
    env.get(f"{P}/lands/LP-10100", headers=h)
    assert env.get(f"{P}/me/searches", headers=h).json()["items"][0]["search_count"] == 2


def test_staff_lookups_are_not_recorded(env):
    for role in ("REVIEWER", "OFFICER", "ADMIN"):
        h = _h(env, role)
        env.get(f"{P}/lands/LP-10100", headers=h)
        assert env.get(f"{P}/me/searches", headers=h).json() == {"items": [], "total": 0}


def test_history_is_private_and_can_be_cleared(env):
    cit = _h(env, "CITIZEN")
    env.get(f"{P}/lands/LP-10100", headers=cit)
    env.post(f"{P}/auth/register", json={"name": "Other", "email": "other@x.test", "password": PW})
    other = {"Authorization": "Bearer " + env.post(f"{P}/auth/login", json={"email": "other@x.test", "password": PW}).json()["access_token"]}
    assert env.get(f"{P}/me/searches", headers=other).json()["total"] == 0
    assert env.delete(f"{P}/me/searches", headers=other).status_code == 204  # clears only their own
    assert env.get(f"{P}/me/searches", headers=cit).json()["total"] == 1
    assert env.delete(f"{P}/me/searches", headers=cit).status_code == 204
    assert env.get(f"{P}/me/searches", headers=cit).json()["total"] == 0


def test_watch_add_is_idempotent_and_shows_in_history(env):
    h = _h(env, "CITIZEN")
    env.get(f"{P}/lands/LP-10100", headers=h)
    r = env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100", "note": "  Father's plot  "}, headers=h)
    assert r.status_code == 201 and r.json()["note"] == "Father's plot" and r.json()["dag_no"] == "210"
    again = env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=h)
    assert again.status_code == 200 and again.json()["note"] == "Father's plot"
    wl = env.get(f"{P}/me/watchlist", headers=h).json()
    assert [i["land_id"] for i in wl["items"]] == ["LP-10100"] and wl["limit"] == 20
    assert env.get(f"{P}/me/searches", headers=h).json()["items"][0]["watched"] is True


def test_watch_errors(env):
    h = _h(env, "CITIZEN")
    r = env.post(f"{P}/me/watchlist", json={"land_id": "LP-99999"}, headers=h)
    assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
    assert env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100", "x": 1}, headers=h).status_code == 422
    assert env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100", "note": "n" * 101}, headers=h).status_code == 422
    r = env.delete(f"{P}/me/watchlist/LP-10100", headers=h)
    assert r.status_code == 404 and r.json()["code"] == "WATCH_NOT_FOUND"


def test_watchlist_is_capped(env, monkeypatch):
    monkeypatch.setattr("app.services.me.WATCH_LIMIT", 1)
    h = _h(env, "CITIZEN")
    assert env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=h).status_code == 201
    r = env.post(f"{P}/me/watchlist", json={"land_id": "LP-10240"}, headers=h)
    assert r.status_code == 409 and r.json()["code"] == "WATCHLIST_FULL" and r.json()["details"] == {"limit": 1}


def test_unwatch(env):
    h = _h(env, "CITIZEN")
    env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=h)
    assert env.delete(f"{P}/me/watchlist/LP-10100", headers=h).status_code == 204
    assert env.get(f"{P}/me/watchlist", headers=h).json()["items"] == []


def test_new_records_on_a_watched_parcel_become_notifications(env):
    h = _h(env, "CITIZEN")
    env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=h)
    assert env.get(f"{P}/me/notifications", headers=h).json()["items"] == []  # existing records are not news
    pk = _land_pk(env, "LP-10100")
    with _db(env) as s:
        tx = s.scalars(select(Transaction).where(Transaction.land_id == pk)).first()
        s.add(Transaction(land_id=pk, seller_id=tx.buyer_id, buyer_id=tx.seller_id, area=5, area_unit=tx.area_unit, transaction_type="GIFT"))
        s.add(LandEncumbrance(land_id=pk, type="CASE", reference_no="CS-1/2026"))
        mut = s.scalars(select(MutationRecord).where(MutationRecord.land_id == pk)).first()
        mut.status, mut.status_changed_at = "HEARING", datetime.now(UTC)
        s.commit()
        mno = mut.mutation_no
    body = env.get(f"{P}/me/notifications", headers=h).json()
    kinds = sorted(n["kind"] for n in body["items"])
    assert kinds == ["WATCH_ENCUMBRANCE", "WATCH_MUTATION_STATUS", "WATCH_TRANSACTION"]
    assert body["unread"] == 3 and all(n["land_id"] == "LP-10100" for n in body["items"])
    by_kind = {n["kind"]: n["data"] for n in body["items"]}
    assert by_kind["WATCH_TRANSACTION"]["type"] == "GIFT"
    assert by_kind["WATCH_MUTATION_STATUS"] == {"mutation_no": mno, "status": "HEARING"}
    # checked once: asking again does not duplicate
    assert env.get(f"{P}/me/notifications", headers=h).json()["total"] == 3
    assert env.get(f"{P}/me/watchlist", headers=h).json()["items"][0]["unread"] == 3


def test_a_watch_window_is_claimed_once(env):
    """The menu badge and the inbox check at the same moment: only one of them may write."""
    from app.models.citizen import WatchlistItem
    from app.services.me import _claim

    env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=_h(env, "CITIZEN"))
    with _db(env) as s:
        w = s.scalars(select(WatchlistItem)).one()
        wid, since = w.id, w.checked_at
        now = datetime.now(UTC)
        assert _claim(s, wid, since, now) is True
        assert _claim(s, wid, since, now) is False  # second request saw the same old window


def test_mark_read_some_then_all(env):
    h = _h(env, "CITIZEN")
    for code in ("LP-10100", "LP-10240"):
        env.post(f"{P}/verification", json={"land_id": code}, headers=h)
    items = env.get(f"{P}/me/notifications", headers=h).json()["items"]
    assert [n["kind"] for n in items] == ["REPORT_READY", "REPORT_READY"]
    r = env.post(f"{P}/me/notifications/read", json={"ids": [items[0]["id"]]}, headers=h)
    assert r.status_code == 200 and r.json() == {"unread": 1}
    assert env.get(f"{P}/me/notifications?unread_only=true", headers=h).json()["total"] == 1
    assert env.post(f"{P}/me/notifications/read", json={}, headers=h).json() == {"unread": 0}


def test_cannot_mark_someone_elses_notification(env):
    cit = _h(env, "CITIZEN")
    env.post(f"{P}/verification", json={"land_id": "LP-10100"}, headers=cit)
    nid = env.get(f"{P}/me/notifications", headers=cit).json()["items"][0]["id"]
    env.post(f"{P}/me/notifications/read", json={"ids": [nid]}, headers=_h(env, "OFFICER"))
    assert env.get(f"{P}/me/notifications", headers=cit).json()["unread"] == 1


def test_reports_list_only_my_verifications(env):
    cit = _h(env, "CITIZEN")
    v = env.post(f"{P}/verification", json={"land_id": "LP-10240"}, headers=cit).json()
    env.post(f"{P}/verification", json={"land_id": "LP-10100"}, headers=_h(env, "OFFICER"))
    body = env.get(f"{P}/me/reports", headers=cit).json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == v["id"] and item["land_id"] == "LP-10240" and item["status"] == "COMPLETED"
    assert item["risk_level"] == v["risk_level"] and item["mouza"]
    n = env.get(f"{P}/me/notifications", headers=cit).json()["items"][0]
    assert n["ref_id"] == v["id"] and n["data"] == {"risk_level": v["risk_level"]}


def test_summary(env):
    h = _h(env, "CITIZEN")
    env.get(f"{P}/lands/LP-10100", headers=h)
    env.post(f"{P}/me/watchlist", json={"land_id": "LP-10100"}, headers=h)
    env.post(f"{P}/verification", json={"land_id": "LP-10100"}, headers=h)
    b = env.get(f"{P}/me/summary", headers=h).json()
    assert (b["searches"], b["watching"], b["reports"], b["unread"]) == (1, 1, 1, 1)
    assert b["recent_searches"][0]["land_id"] == "LP-10100"
    assert b["recent_reports"][0]["land_id"] == "LP-10100"
    assert b["latest_notifications"][0]["kind"] == "REPORT_READY"


def test_profile_update_normalises_phone_and_keeps_it_out_of_the_audit_log(env):
    from app.models.audit import AuditLog

    h = _h(env, "CITIZEN")
    r = env.patch(f"{P}/me/profile", json={"name": "  Rahim   Uddin ", "phone": "+880 ১৭১১-০০০০০০", "preferred_language": "bn"}, headers=h)
    assert r.status_code == 200
    b = r.json()
    assert (b["name"], b["phone"], b["preferred_language"]) == ("Rahim Uddin", "01711000000", "bn")
    assert env.get(f"{P}/auth/me", headers=h).json()["phone"] == "01711000000"
    with _db(env) as s:
        row = s.scalars(select(AuditLog).where(AuditLog.action == "PROFILE_UPDATE")).one()
        assert row.new_value == {"fields": ["name", "phone", "preferred_language"]}
        assert "01711000000" not in str(row.new_value) + str(row.old_value)
    assert env.patch(f"{P}/me/profile", json={"phone": ""}, headers=h).json()["phone"] is None


@pytest.mark.parametrize(
    "body",
    [{}, {"phone": "12345"}, {"phone": "01211000000"}, {"name": "   "}, {"preferred_language": "fr"}, {"role": "ADMIN"}],
)
def test_profile_rejects_bad_input(env, body):
    r = env.patch(f"{P}/me/profile", json=body, headers=_h(env, "CITIZEN"))
    assert r.status_code == 422
    with _db(env) as s:
        assert s.scalar(select(User.role).where(User.email == "citizen@x.test")) == "CITIZEN"


def test_password_change(env):
    h = _h(env, "CITIZEN")
    wrong = env.post(f"{P}/me/password", json={"current_password": "nope", "new_password": "brand-new-pass"}, headers=h)
    assert wrong.status_code == 400 and wrong.json()["code"] == "WRONG_PASSWORD"
    same = env.post(f"{P}/me/password", json={"current_password": PW, "new_password": PW}, headers=h)
    assert same.status_code == 422 and same.json()["code"] == "PASSWORD_UNCHANGED"
    assert env.post(f"{P}/me/password", json={"current_password": PW, "new_password": "short"}, headers=h).status_code == 422
    assert env.post(f"{P}/me/password", json={"current_password": PW, "new_password": "brand-new-pass"}, headers=h).status_code == 204
    assert env.post(f"{P}/auth/login", json={"email": "citizen@x.test", "password": PW}).status_code == 401
    assert env.post(f"{P}/auth/login", json={"email": "citizen@x.test", "password": "brand-new-pass"}).status_code == 200


def test_password_attempts_are_rate_limited(env):
    h = _h(env, "CITIZEN")
    codes = [
        env.post(f"{P}/me/password", json={"current_password": "nope", "new_password": "brand-new-pass"}, headers=h).status_code
        for _ in range(6)
    ]
    assert codes == [400] * 5 + [429]


def test_me_needs_sign_in(env):
    for path in ("summary", "searches", "watchlist", "reports", "notifications"):
        assert env.get(f"{P}/me/{path}").status_code == 401
