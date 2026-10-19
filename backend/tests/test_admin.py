# ruff: noqa: E501, F811
import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.user import User
from tests.test_documents import _db, store  # noqa: F401
from tests.test_lands import PW, ROLES, _h, _keys, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401

P = "/api/v1/admin"
NEW = {
    "name": " Nina New ",
    "email": "Nina@X.test",
    "password": "long-enough-1",
    "role": "REVIEWER",
}


def _uid(env, role):
    with _db(env) as s:
        return s.scalar(select(User.id).where(User.email == f"{role.lower()}@x.test"))


def _actions(env):
    with _db(env) as s:
        return [a.action for a in s.scalars(select(AuditLog).order_by(AuditLog.created_at))]


GETS = ["/users", "/land-records", "/documents"]


@pytest.mark.parametrize("path", GETS)
@pytest.mark.parametrize(
    "role,code", [("CITIZEN", 403), ("REVIEWER", 403), ("OFFICER", 403), ("ADMIN", 200)]
)
def test_get_roles(env, path, role, code):
    assert env.get(P + path, headers=_h(env, role)).status_code == code


@pytest.mark.parametrize("path", GETS)
def test_get_anonymous_401(env, path):
    assert env.get(P + path).status_code == 401


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER", "OFFICER"])
def test_writes_forbidden_and_unaudited(env, role):
    h = _h(env, role)
    before = _actions(env)
    assert env.post(P + "/users", json=NEW, headers=h).status_code == 403
    assert (
        env.patch(
            f"{P}/users/{_uid(env, 'CITIZEN')}", json={"role": "ADMIN"}, headers=h
        ).status_code
        == 403
    )
    assert _actions(env) == before
    with _db(env) as s:
        assert s.scalar(select(User.role).where(User.email == "citizen@x.test")) == "CITIZEN"


def test_list_users_shape_search_filter_sort_page(env):
    h = _h(env, "ADMIN")
    r = env.get(P + "/users", headers=h).json()
    assert r["total"] >= 4 + 4  # 4 demo + 4 test users
    assert set(r["items"][0]) == {
        "id",
        "name",
        "email",
        "role",
        "preferred_language",
        "is_active",
        "created_at",
    }
    assert not ({"password_hash", "password"} & set(_keys(r)))
    assert env.get(P + "/users", params={"q": "REVIEWER@x"}, headers=h).json()["total"] == 1
    assert (
        env.get(P + "/users", params={"q": "%"}, headers=h).json()["total"] == 0
    )  # LIKE wildcard escaped
    assert (
        env.get(P + "/users", params={"role": "ADMIN", "is_active": "true"}, headers=h).json()[
            "total"
        ]
        >= 1
    )
    asc = env.get(P + "/users", params={"sort": "email", "order": "asc"}, headers=h).json()["items"]
    assert [u["email"] for u in asc] == sorted(u["email"] for u in asc)
    p2 = env.get(
        P + "/users", params={"limit": 3, "offset": 3, "sort": "email", "order": "asc"}, headers=h
    ).json()
    assert [u["email"] for u in p2["items"]] == [u["email"] for u in asc[3:6]]
    assert env.get(P + "/users", params={"sort": "password_hash"}, headers=h).status_code == 422
    assert env.get(P + "/users", params={"limit": 101}, headers=h).status_code == 422


def test_create_user_happy_audited_and_can_login(env):
    h = _h(env, "ADMIN")
    r = env.post(P + "/users", json=NEW, headers=h)
    assert r.status_code == 201, r.text
    b = r.json()
    assert (
        b["email"] == "nina@x.test"
        and b["name"] == "Nina New"
        and b["role"] == "REVIEWER"
        and b["is_active"]
    )
    assert "password" not in r.text and "hash" not in r.text
    assert _actions(env).count("USER_CREATE") == 1
    with _db(env) as s:
        row = s.scalar(select(AuditLog).where(AuditLog.action == "USER_CREATE"))
        assert row.entity_type == "user" and row.entity_id == b["id"]
        assert (
            "long-enough-1" not in str(row.new_value) and "nina" not in str(row.new_value).lower()
        )
    ok = env.post("/api/v1/auth/login", json={"email": "nina@x.test", "password": "long-enough-1"})
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "REVIEWER"


@pytest.mark.parametrize(
    "patch,code",
    [
        ({"email": "not-an-email"}, 422),
        ({"role": "SUPERUSER"}, 422),
        ({"password": "short"}, 422),
        ({"name": "  "}, 422),
        ({"preferred_language": "fr"}, 422),
        ({"is_admin": True}, 422),  # unknown field rejected
    ],
)
def test_create_user_validation(env, patch, code):
    h = _h(env, "ADMIN")
    before = _actions(env)
    assert env.post(P + "/users", json={**NEW, **patch}, headers=h).status_code == code
    assert _actions(env) == before


def test_create_duplicate_email_409(env):
    h = _h(env, "ADMIN")
    r = env.post(P + "/users", json={**NEW, "email": "citizen@x.test"}, headers=h)
    assert r.status_code == 409 and r.json()["code"] == "EMAIL_TAKEN"
    assert "USER_CREATE" not in _actions(env)


def test_patch_role_and_deactivate_audited_with_old_new(env):
    h = _h(env, "ADMIN")
    cid = _uid(env, "CITIZEN")
    r = env.patch(f"{P}/users/{cid}", json={"role": "OFFICER", "name": "Cit Z"}, headers=h)
    assert r.status_code == 200 and r.json()["role"] == "OFFICER" and r.json()["name"] == "Cit Z"
    r = env.patch(f"{P}/users/{cid}", json={"is_active": False}, headers=h)
    assert r.status_code == 200 and r.json()["is_active"] is False
    with _db(env) as s:
        rows = s.scalars(
            select(AuditLog).where(AuditLog.action == "USER_UPDATE").order_by(AuditLog.created_at)
        ).all()
    assert [(x.old_value, x.new_value) for x in rows] == [
        ({"name": "CITIZEN", "role": "CITIZEN"}, {"name": "Cit Z", "role": "OFFICER"}),
        ({"is_active": True}, {"is_active": False}),
    ]
    # deactivated user can no longer sign in
    bad = env.post("/api/v1/auth/login", json={"email": "citizen@x.test", "password": PW})
    assert bad.status_code == 401
    # reactivate
    assert (
        env.patch(f"{P}/users/{cid}", json={"is_active": True}, headers=h).json()["is_active"]
        is True
    )
    assert (
        env.post("/api/v1/auth/login", json={"email": "citizen@x.test", "password": PW}).status_code
        == 200
    )


def test_deactivated_users_existing_token_stops_working(env):
    ch = _h(env, "CITIZEN")
    assert env.get("/api/v1/auth/me", headers=ch).status_code == 200
    env.patch(
        f"{P}/users/{_uid(env, 'CITIZEN')}", json={"is_active": False}, headers=_h(env, "ADMIN")
    )
    assert env.get("/api/v1/auth/me", headers=ch).status_code == 401


def test_admin_cannot_demote_or_deactivate_self(env):
    h = _h(env, "ADMIN")
    me = _uid(env, "ADMIN")
    before = _actions(env)
    for body in (
        {"role": "OFFICER"},
        {"is_active": False},
        {"role": "CITIZEN", "is_active": False},
    ):
        r = env.patch(f"{P}/users/{me}", json=body, headers=h)
        assert r.status_code == 409 and r.json()["code"] == "CANNOT_CHANGE_OWN_ACCESS", body
    assert _actions(env) == before
    # harmless self edits still work (name, same role)
    ok = env.patch(f"{P}/users/{me}", json={"name": "Boss", "role": "ADMIN"}, headers=h)
    assert ok.status_code == 200 and ok.json()["name"] == "Boss" and ok.json()["role"] == "ADMIN"
    assert _actions(env).count("USER_UPDATE") == 1  # only the name change was audited


def test_patch_noop_unknown_and_invalid(env):
    h = _h(env, "ADMIN")
    cid = _uid(env, "CITIZEN")
    before = _actions(env)
    same = env.patch(f"{P}/users/{cid}", json={"role": "CITIZEN"}, headers=h)
    assert same.status_code == 200 and _actions(env) == before  # no-op writes no audit row
    assert env.patch(f"{P}/users/{cid}", json={}, headers=h).status_code == 422
    assert env.patch(f"{P}/users/{cid}", json={"role": "ROOT"}, headers=h).status_code == 422
    assert env.patch(f"{P}/users/{cid}", json={"email": "x@y.zz"}, headers=h).status_code == 422
    assert env.patch(f"{P}/users/{cid}", json={"password_hash": "x"}, headers=h).status_code == 422
    nf = env.patch(
        f"{P}/users/00000000-0000-0000-0000-000000000000", json={"role": "OFFICER"}, headers=h
    )
    assert nf.status_code == 404 and nf.json()["code"] == "NOT_FOUND"
    assert _actions(env) == before


def test_land_records_search_sort_page_and_no_owner_data(env):
    h = _h(env, "ADMIN")
    r = env.get(P + "/land-records", headers=h).json()
    assert r["total"] == 15  # 12 + the SJ1 survey lands LP-12001..12003
    assert set(r["items"][0]) == {
        "land_id", "district", "upazila", "mouza", "khatian_no", "dag_no", "area", "area_unit", "status", "updated_at",
        "survey_type", "jl_no",
    }  # fmt: skip
    assert not ({"id", "geometry", "owners", "current_owners", "father_name"} & set(_keys(r)))
    assert [i["land_id"] for i in r["items"]] == sorted(i["land_id"] for i in r["items"])
    q = env.get(P + "/land-records", params={"q": "lp-102"}, headers=h).json()
    assert q["total"] == 2 and {i["land_id"] for i in q["items"]} == {"LP-10234", "LP-10240"}
    desc = env.get(P + "/land-records", params={"sort": "area", "order": "desc"}, headers=h).json()[
        "items"
    ]
    assert [i["area"] for i in desc] == sorted((i["area"] for i in desc), reverse=True)
    pg = env.get(P + "/land-records", params={"limit": 3, "offset": 9}, headers=h).json()
    assert pg["total"] == 15 and len(pg["items"]) == 3
    assert env.get(P + "/land-records", params={"status": "ACTIVE"}, headers=h).json()["total"] >= 1
    assert env.get(P + "/land-records", params={"status": "NOPE"}, headers=h).status_code == 422
    assert env.get(P + "/land-records", params={"sort": "geometry"}, headers=h).status_code == 422


def test_documents_list_search_sort_page_no_file_path(env, store, jobs):
    from tests.test_processing import _process, _upload

    ids = [_upload(env, b"Doc1")["id"], _upload(env, None)["id"]]
    assert _process(env, ids[0]).status_code in (200, 202)
    h = _h(env, "ADMIN")
    r = env.get(P + "/documents", headers=h)
    b = r.json()
    assert b["total"] == 2 and {i["id"] for i in b["items"]} == set(ids)
    assert set(b["items"][0]) == {
        "id", "land_id", "document_type", "processing_status", "ocr_confidence", "uploaded_by", "created_at"
    }  # fmt: skip
    assert "file_path" not in r.text and str(store) not in r.text
    assert {i["uploaded_by"] for i in b["items"]} == {"OFFICER"}
    st = b["items"][0]["processing_status"]
    only = env.get(P + "/documents", params={"status": st}, headers=h).json()
    assert 1 <= only["total"] <= 2 and all(i["processing_status"] == st for i in only["items"])
    assert env.get(P + "/documents", params={"q": "officer"}, headers=h).json()["total"] == 2
    assert env.get(P + "/documents", params={"q": "zzz"}, headers=h).json()["total"] == 0
    s = env.get(
        P + "/documents", params={"sort": "processing_status", "order": "asc"}, headers=h
    ).json()["items"]
    assert [i["processing_status"] for i in s] == sorted(i["processing_status"] for i in s)
    assert len(env.get(P + "/documents", params={"limit": 1}, headers=h).json()["items"]) == 1
    assert env.get(P + "/documents", params={"sort": "file_path"}, headers=h).status_code == 422
    assert env.get(P + "/documents", params={"status": "NOPE"}, headers=h).status_code == 422


def test_all_roles_list_exists():
    assert ROLES == ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"]
