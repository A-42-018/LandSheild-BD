# ruff: noqa: E501, F811
import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from tests.test_documents import _db  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401

PUB = "/api/v1/content"
ADM = "/api/v1/admin/content"


def _notice(**kw):
    return {
        "kind": "NOTICE", "title_en": "Office closed Friday", "title_bn": "শুক্রবার অফিস বন্ধ",
        "body_en": "The office is closed for the holiday.", "body_bn": "ছুটির কারণে অফিস বন্ধ থাকবে।",
        "published_on": "2026-10-20", "ticker": True, **kw,
    }


def _faq(**kw):
    return {
        "kind": "FAQ", "title_en": "Is it free?", "title_bn": "এটি কি বিনামূল্যে?",
        "body_en": "Yes, the demo is free.", "body_bn": "হ্যাঁ, ডেমোটি বিনামূল্যে।", **kw,
    }


def test_public_list_shows_published_only_newest_first(env):
    h = _h(env, "ADMIN")
    env.post(ADM, json=_notice(published_on="2026-10-01", title_en="Older"), headers=h)
    env.post(ADM, json=_notice(published_on="2026-10-20", title_en="Newer"), headers=h)
    env.post(ADM, json=_notice(title_en="Draft one", published=False), headers=h)
    env.post(ADM, json=_faq(), headers=h)
    items = env.get(PUB, params={"kind": "NOTICE"}).json()["items"]  # no sign-in
    assert [i["title_en"] for i in items] == ["Newer", "Older"]
    assert "published" not in items[0]  # drafts are not even hinted at
    assert env.get(PUB, params={"kind": "FAQ"}).json()["items"][0]["title_bn"]
    assert env.get(PUB, params={"kind": "GUIDE"}).json()["items"] == []
    assert env.get(PUB, params={"kind": "NOPE"}).status_code == 422


def test_admin_list_includes_drafts_and_filters(env):
    h = _h(env, "ADMIN")
    env.post(ADM, json=_notice(published=False), headers=h)
    env.post(ADM, json=_faq(), headers=h)
    allr = env.get(ADM, headers=h).json()
    assert allr["total"] == 2
    one = env.get(ADM, params={"kind": "NOTICE"}, headers=h).json()
    assert one["total"] == 1 and one["items"][0]["published"] is False
    assert env.get(ADM, params={"q": "free"}, headers=h).json()["total"] == 1


def test_validation(env):
    h = _h(env, "ADMIN")
    assert env.post(ADM, json=_notice(published_on=None), headers=h).status_code == 422
    assert env.post(ADM, json=_notice(title_en="x"), headers=h).status_code == 422
    assert env.post(ADM, json=_notice(role="ADMIN"), headers=h).status_code == 422  # unknown field
    faq = env.post(ADM, json=_faq(ticker=True), headers=h).json()
    assert faq["ticker"] is False  # only notices scroll in the ticker


def test_update_and_delete_are_audited(env):
    h = _h(env, "ADMIN")
    cid = env.post(ADM, json=_notice(), headers=h).json()["id"]
    up = env.patch(f"{ADM}/{cid}", json={"ticker": False, "title_en": "Closed on Friday"}, headers=h)
    assert up.status_code == 200 and up.json()["ticker"] is False
    assert env.patch(f"{ADM}/{cid}", json={"published_on": None}, headers=h).status_code == 422
    assert env.patch(f"{ADM}/{cid}", json={"kind": "FAQ"}, headers=h).status_code == 422
    assert env.get(PUB, params={"kind": "NOTICE"}).json()["items"][0]["title_en"] == "Closed on Friday"
    assert env.delete(f"{ADM}/{cid}", headers=h).status_code == 204
    assert env.delete(f"{ADM}/{cid}", headers=h).status_code == 404
    assert env.get(PUB, params={"kind": "NOTICE"}).json()["items"] == []
    with _db(env) as s:
        acts = [a.action for a in s.scalars(select(AuditLog))]
    assert {"CONTENT_CREATE", "CONTENT_UPDATE", "CONTENT_DELETE"} <= set(acts)


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER", "OFFICER"])
def test_only_admin_writes(env, role):
    h = _h(env, role)
    assert env.get(ADM, headers=h).status_code == 403
    assert env.post(ADM, json=_notice(), headers=h).status_code == 403
