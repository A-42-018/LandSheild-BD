# ruff: noqa: E501
"""P52: authz matrix generated from OpenAPI — every operation x every role vs R4.

EXPECTED is written from the R4 table, NOT read from the code under test. A new route that is
not listed here fails `test_matrix_covers_every_route`, so nothing ships unclassified.
"""
import re

from tests.test_lands import ROLES, _h

PUBLIC, ANY, REVIEW, OFFICER, ADMIN = "PUBLIC", "ANY", "REVIEW", "OFFICER", "ADMIN"
TIER_ROLES = {
    ANY: {"CITIZEN", "REVIEWER", "OFFICER", "ADMIN"},
    REVIEW: {"REVIEWER", "OFFICER", "ADMIN"},
    OFFICER: {"OFFICER", "ADMIN"},
    ADMIN: {"ADMIN"},
}
P = "/api/v1"
EXPECTED = {
    ("GET", f"{P}/health"): PUBLIC,
    ("POST", f"{P}/auth/register"): PUBLIC,
    ("POST", f"{P}/auth/login"): PUBLIC,
    ("POST", f"{P}/auth/refresh"): PUBLIC,
    ("POST", f"{P}/auth/logout"): PUBLIC,
    ("GET", f"{P}/public/verify/{{land_id}}"): PUBLIC,
    ("GET", f"{P}/public/mutation-status/{{mutation_no}}"): PUBLIC,
    ("GET", f"{P}/public/keys"): PUBLIC,
    ("GET", f"{P}/public/seal/{{land_id}}"): PUBLIC,
    ("GET", f"{P}/public/signature"): PUBLIC,
    ("POST", f"{P}/public/verify-document"): PUBLIC,
    ("POST", f"{P}/public/verify-document/fields"): PUBLIC,
    ("GET", f"{P}/offices/divisions"): PUBLIC,
    ("GET", f"{P}/offices/districts"): PUBLIC,
    ("GET", f"{P}/offices/upazilas"): PUBLIC,
    ("GET", f"{P}/offices"): PUBLIC,
    ("POST", f"{P}/offices/officer-requests"): PUBLIC,
    ("GET", f"{P}/auth/me"): ANY,
    ("GET", f"{P}/lands/map"): ANY,
    ("GET", f"{P}/gis/capabilities"): ANY,
    ("GET", f"{P}/gis/divisions"): ANY,
    ("GET", f"{P}/gis/districts"): ANY,
    ("GET", f"{P}/gis/upazilas"): ANY,
    ("GET", f"{P}/gis/unions"): ANY,
    ("GET", f"{P}/gis/mouzas"): ANY,
    ("GET", f"{P}/gis/search"): ANY,
    ("GET", f"{P}/lands/search"): ANY,
    ("GET", f"{P}/lands/{{land_id}}"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/ownership"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/transactions"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/mutations"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/encumbrances"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/pre-purchase-check"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/risk"): ANY,
    ("GET", f"{P}/lands/{{land_id}}/graph"): ANY,
    ("POST", f"{P}/verification"): ANY,
    ("GET", f"{P}/verification/{{verification_id}}"): ANY,
    ("GET", f"{P}/verification/{{verification_id}}/report"): ANY,
    ("GET", f"{P}/documents/{{document_id}}"): REVIEW,
    ("GET", f"{P}/documents/{{document_id}}/file"): REVIEW,
    ("GET", f"{P}/documents/{{document_id}}/extraction"): REVIEW,
    ("PATCH", f"{P}/documents/{{document_id}}/extraction"): REVIEW,
    ("POST", f"{P}/documents/{{document_id}}/approve"): REVIEW,
    ("POST", f"{P}/documents/{{document_id}}/reject"): REVIEW,
    ("POST", f"{P}/documents/{{document_id}}/reprocess"): REVIEW,
    ("GET", f"{P}/archive/search"): REVIEW,
    ("GET", f"{P}/mutations"): REVIEW,
    ("GET", f"{P}/mutations/{{mutation_id}}"): REVIEW,
    ("POST", f"{P}/mutations/{{mutation_id}}/transition"): OFFICER,
    ("POST", f"{P}/mutations/{{mutation_id}}/recommend"): OFFICER,
    ("POST", f"{P}/mutations/{{mutation_id}}/appeal"): OFFICER,
    ("GET", f"{P}/officer/stats"): REVIEW,
    ("GET", f"{P}/officer/queue"): REVIEW,
    ("GET", f"{P}/officer/activity"): REVIEW,
    ("GET", f"{P}/risk-alerts"): REVIEW,
    ("PATCH", f"{P}/risk-alerts/{{alert_id}}"): REVIEW,
    ("POST", f"{P}/documents/upload"): OFFICER,
    ("POST", f"{P}/documents/{{document_id}}/process"): OFFICER,
    ("GET", f"{P}/admin/audit-logs"): OFFICER,
    ("GET", f"{P}/admin/users"): ADMIN,
    ("POST", f"{P}/admin/users"): ADMIN,
    ("PATCH", f"{P}/admin/users/{{user_id}}"): ADMIN,
    ("GET", f"{P}/admin/officer-requests"): ADMIN,
    ("POST", f"{P}/admin/officer-requests/{{request_id}}/approve"): ADMIN,
    ("POST", f"{P}/admin/officer-requests/{{request_id}}/reject"): ADMIN,
    ("GET", f"{P}/admin/land-records"): ADMIN,
    ("GET", f"{P}/admin/documents"): ADMIN,
    ("GET", f"{P}/admin/ledger/verify"): ADMIN,
    ("GET", f"{P}/rbac/citizen"): ANY,
    ("GET", f"{P}/rbac/reviewer"): REVIEW,
    ("GET", f"{P}/rbac/officer"): OFFICER,
    ("GET", f"{P}/rbac/admin"): ADMIN,
}
ZERO = "00000000-0000-0000-0000-000000000000"


def _operations(env):
    spec = env.app.openapi()
    return {
        (m.upper(), path): op
        for path, item in spec["paths"].items()
        for m, op in item.items()
        if m in {"get", "post", "put", "patch", "delete"}
    }


def _url(path: str) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: "LP-10001" if m.group(1) == "land_id" else ZERO, path)


def test_matrix_covers_every_route(env):
    ops = _operations(env)
    assert set(ops) - set(EXPECTED) == set(), "route(s) missing from the authz matrix"
    assert set(EXPECTED) - set(ops) == set(), "matrix lists route(s) that no longer exist"
    for key, tier in EXPECTED.items():
        assert bool(ops[key].get("security")) == (tier != PUBLIC), f"{key}: OpenAPI security flag"


def test_authz_matrix_every_route_every_role(env):
    heads = {r: _h(env, r) for r in ROLES}
    bad: list[str] = []
    for (method, path), tier in sorted(EXPECTED.items()):
        url = _url(path)
        if tier == PUBLIC:
            r = env.request(method, url)
            if r.status_code in (403, 500) or (r.status_code == 401 and not url.endswith("/refresh")):
                bad.append(f"{method} {path} anonymous -> {r.status_code}")
            continue
        for label, headers in (("anonymous", {}), ("garbage-token", {"Authorization": "Bearer x.y.z"})):
            r = env.request(method, url, headers=headers)
            if r.status_code != 401:
                bad.append(f"{method} {path} {label} -> {r.status_code} (want 401)")
        for role in ROLES:
            r = env.request(method, url, headers=heads[role])
            if role in TIER_ROLES[tier]:
                if r.status_code in (401, 403, 500):
                    bad.append(f"{method} {path} {role} -> {r.status_code} (want allowed)")
            elif r.status_code != 403 or r.json().get("code") != "FORBIDDEN":
                bad.append(f"{method} {path} {role} -> {r.status_code} (want 403 FORBIDDEN)")
    assert not bad, "\n".join(bad)


def test_unlisted_methods_are_rejected(env):
    h = _h(env, "ADMIN")
    bad = []
    for _method, path in EXPECTED:
        for other in ("PUT", "DELETE"):
            if (other, path) in EXPECTED:
                continue
            r = env.request(other, _url(path), headers=h)
            if r.status_code not in (404, 405):
                bad.append(f"{other} {path} -> {r.status_code}")
    assert not bad, "\n".join(bad)


def test_role_comes_from_database_not_token(env):
    """A validly signed token whose role claim says ADMIN must not unlock reviewer routes."""
    import jwt

    cit = _h(env, "CITIZEN")["Authorization"].split()[1]
    claims = jwt.decode(cit, options={"verify_signature": False}) | {"role": "ADMIN"}
    forged = jwt.encode(claims, "test-secret", algorithm="HS256")  # env fixture secret
    r = env.get(f"{P}/officer/stats", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 403
    wrong_key = jwt.encode(claims, "wrong-secret", algorithm="HS256")
    assert env.get(f"{P}/officer/stats", headers={"Authorization": f"Bearer {wrong_key}"}).status_code == 401
