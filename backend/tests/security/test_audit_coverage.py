# ruff: noqa: E501
"""P52: every write route leaves an audit row; denied or failed attempts leave none."""
from sqlalchemy import select

from app.models.audit import AuditLog
from tests.security.test_authz_matrix import EXPECTED, PUBLIC
from tests.test_documents import _db
from tests.test_extraction import _patch, _ready
from tests.test_lands import ROLES, _h
from tests.test_review import _fill

P = "/api/v1"
WRITE = {"POST", "PUT", "PATCH", "DELETE"}
# write route -> audit action it must produce.  None = deliberately not audited (reason below).
AUDIT = {
    ("POST", f"{P}/auth/register"): "REGISTER",
    ("POST", f"{P}/auth/login"): "LOGIN",
    ("POST", f"{P}/auth/logout"): "LOGOUT",
    ("POST", f"{P}/auth/refresh"): None,  # session plumbing: runs on every page load, would drown the log
    ("POST", f"{P}/public/verify-document"): None,  # F4b: anonymous read-only comparison, nothing written
    ("POST", f"{P}/public/verify-document/fields"): None,  # F4b: same, JSON mode
    ("POST", f"{P}/public/feedback"): "FEEDBACK_SUBMIT",
    ("POST", f"{P}/public/page-rating"): None,  # anonymous one-click rating, stored as its own row; would drown the log
    ("PATCH", f"{P}/feedback/{{feedback_id}}"): "FEEDBACK_UPDATE",
    ("POST", f"{P}/verification"): "VERIFICATION_CREATE",
    ("POST", f"{P}/documents/upload"): "DOCUMENT_UPLOAD",
    ("POST", f"{P}/documents/{{document_id}}/process"): "DOCUMENT_PROCESS",
    ("PATCH", f"{P}/documents/{{document_id}}/extraction"): "DOCUMENT_EXTRACTION_EDIT",
    ("POST", f"{P}/documents/{{document_id}}/approve"): "DOCUMENT_APPROVE",
    ("POST", f"{P}/documents/{{document_id}}/reject"): "DOCUMENT_REJECT",
    ("POST", f"{P}/documents/{{document_id}}/reprocess"): "DOCUMENT_REPROCESS_REQUEST",
    ("PATCH", f"{P}/risk-alerts/{{alert_id}}"): "RISK_ALERT_UPDATE",
    ("POST", f"{P}/mutations/{{mutation_id}}/transition"): "MUTATION_TRANSITION",
    ("POST", f"{P}/mutations/{{mutation_id}}/recommend"): "MUTATION_RECOMMEND",
    ("POST", f"{P}/mutations/{{mutation_id}}/hearing"): "MUTATION_HEARING_SET",
    ("POST", f"{P}/mutations/{{mutation_id}}/appeal"): "MUTATION_TRANSITION",
    ("POST", f"{P}/admin/users"): "USER_CREATE",
    ("PATCH", f"{P}/admin/users/{{user_id}}"): "USER_UPDATE",
    ("POST", f"{P}/offices/officer-requests"): "OFFICER_REQUEST",
    ("POST", f"{P}/admin/officer-requests/{{request_id}}/approve"): "OFFICER_REQUEST_APPROVE",
    ("POST", f"{P}/admin/officer-requests/{{request_id}}/reject"): "OFFICER_REQUEST_REJECT",
    ("DELETE", f"{P}/me/searches"): "SEARCH_HISTORY_CLEAR",
    ("POST", f"{P}/me/watchlist"): "WATCHLIST_ADD",
    ("DELETE", f"{P}/me/watchlist/{{land_id}}"): "WATCHLIST_REMOVE",
    ("POST", f"{P}/me/notifications/read"): None,  # U3.2: own inbox read state, nothing anyone else sees; would drown the log
    ("PATCH", f"{P}/me/profile"): "PROFILE_UPDATE",
    ("POST", f"{P}/me/password"): "PASSWORD_CHANGE",
}


def _ids(env) -> set[str]:
    with _db(env) as s:
        return set(s.scalars(select(AuditLog.id)))


def _new_actions(env, before) -> list[str]:
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.id.not_in(before))).all()
    return [r.action for r in rows]


def _audited(env, action, call, ok=(200, 201, 202, 204)):
    before = _ids(env)
    r = call()
    assert r.status_code in ok, (action, r.status_code, r.text)
    got = _new_actions(env, before)
    assert action in got, f"{action} not written; got {got}"
    return r


def test_every_write_route_is_classified():
    writes = {k for k in EXPECTED if k[0] in WRITE}
    assert writes == set(AUDIT), f"unclassified write routes: {writes ^ set(AUDIT)}"


def test_every_write_route_writes_its_audit_row(env, store, jobs):
    heads = {r: _h(env, r) for r in ROLES}
    off, rev = heads["OFFICER"], heads["REVIEWER"]
    ran: set[tuple[str, str]] = set()

    def mark(m, p):
        ran.add((m, p))

    _audited(env, "REGISTER", lambda: env.post(f"{P}/auth/register", json={
        "name": "Aud", "email": "aud@x.test", "password": "correct-horse-1"}))  # fmt: skip
    mark("POST", f"{P}/auth/register")
    _audited(env, "LOGIN", lambda: env.post(f"{P}/auth/login", json={
        "email": "aud@x.test", "password": "correct-horse-1"}))  # fmt: skip
    mark("POST", f"{P}/auth/login")
    assert env.post(f"{P}/auth/refresh").status_code == 200  # cookie from the login above
    mark("POST", f"{P}/auth/refresh")
    before = _ids(env)
    assert env.post(f"{P}/public/verify-document/fields", json={"deed_no": "D-1", "fields": {}}).status_code == 200
    mark("POST", f"{P}/public/verify-document/fields")
    r = env.post(f"{P}/public/verify-document", files={"file": ("a.png", b"\x89PNG\r\n\x1a\n", "image/png")})
    assert r.status_code in (200, 400, 415, 422)  # route reached; nothing here may write an audit row
    mark("POST", f"{P}/public/verify-document")
    assert _ids(env) == before, "public verify-document must not write audit rows"
    _audited(env, "LOGOUT", lambda: env.post(f"{P}/auth/logout"))
    mark("POST", f"{P}/auth/logout")

    _audited(env, "VERIFICATION_CREATE", lambda: env.post(
        f"{P}/verification", json={"land_id": "LP-10001"}, headers=heads["CITIZEN"]))  # fmt: skip
    mark("POST", f"{P}/verification")

    before = _ids(env)
    from tests.test_processing import _upload

    doc = _upload(env, b"Doc1")["id"]
    assert "DOCUMENT_UPLOAD" in _new_actions(env, before)
    mark("POST", f"{P}/documents/upload")
    _audited(env, "DOCUMENT_PROCESS", lambda: env.post(f"{P}/documents/{doc}/process", headers=off))
    mark("POST", f"{P}/documents/{{document_id}}/process")
    _audited(env, "DOCUMENT_EXTRACTION_EDIT", lambda: _patch(env, doc, {"mouza": "Audit Mouza"}))
    mark("PATCH", f"{P}/documents/{{document_id}}/extraction")
    _audited(env, "DOCUMENT_REPROCESS_REQUEST", lambda: env.post(f"{P}/documents/{doc}/reprocess", headers=rev))
    mark("POST", f"{P}/documents/{{document_id}}/reprocess")
    _fill(env, doc)
    _audited(env, "DOCUMENT_APPROVE", lambda: env.post(f"{P}/documents/{doc}/approve", headers=rev))
    mark("POST", f"{P}/documents/{{document_id}}/approve")

    doc2 = _ready(env, b"Doc2")
    _audited(env, "DOCUMENT_REJECT", lambda: env.post(
        f"{P}/documents/{doc2}/reject", json={"reason": "blurry"}, headers=rev))  # fmt: skip
    mark("POST", f"{P}/documents/{{document_id}}/reject")

    mid = env.get(f"{P}/mutations", headers=off).json()["items"][0]["id"]
    _audited(env, "MUTATION_RECOMMEND", lambda: env.post(
        f"{P}/mutations/{mid}/recommend", json={"decision": "REJECT", "note": "audit"}, headers=off))  # fmt: skip
    mark("POST", f"{P}/mutations/{{mutation_id}}/recommend")
    env.post(f"{P}/mutations/{mid}/transition", json={"to": "HEARING", "reason": "audit"}, headers=off)
    _audited(env, "MUTATION_HEARING_SET", lambda: env.post(
        f"{P}/mutations/{mid}/hearing", json={"hearing_at": "2099-01-01T10:00:00+06:00"}, headers=off))  # fmt: skip
    mark("POST", f"{P}/mutations/{{mutation_id}}/hearing")
    # the recommender may not also decide (four-eyes), so an admin decides; then the appeal
    _audited(env, "MUTATION_TRANSITION", lambda: env.post(
        f"{P}/mutations/{mid}/transition", json={"to": "REJECTED", "reason": "audit"}, headers=heads["ADMIN"]))  # fmt: skip
    mark("POST", f"{P}/mutations/{{mutation_id}}/transition")
    _audited(env, "MUTATION_TRANSITION", lambda: env.post(
        f"{P}/mutations/{mid}/appeal", json={"reason": "audit appeal"}, headers=off))  # fmt: skip
    mark("POST", f"{P}/mutations/{{mutation_id}}/appeal")

    assert env.get(f"{P}/lands/LP-10240/risk", headers=rev).status_code == 200
    alerts = env.get(f"{P}/risk-alerts", headers=rev).json()["items"]
    assert alerts, "LP-10240 must have produced an alert"
    _audited(env, "RISK_ALERT_UPDATE", lambda: env.patch(
        f"{P}/risk-alerts/{alerts[0]['id']}", json={"status": "UNDER_REVIEW"}, headers=rev))  # fmt: skip
    mark("PATCH", f"{P}/risk-alerts/{{alert_id}}")

    adm = heads["ADMIN"]
    created = _audited(env, "USER_CREATE", lambda: env.post(
        f"{P}/admin/users", json={"name": "Aud2", "email": "aud2@x.test", "password": "correct-horse-1"}, headers=adm))  # fmt: skip
    mark("POST", f"{P}/admin/users")
    _audited(env, "USER_UPDATE", lambda: env.patch(
        f"{P}/admin/users/{created.json()['id']}", json={"role": "OFFICER"}, headers=adm))  # fmt: skip
    mark("PATCH", f"{P}/admin/users/{{user_id}}")

    env.get(f"{P}/offices/divisions")  # loads the bundled office list
    from sqlalchemy import select as _select

    from app.models.land_office import LandOffice
    from tests.test_documents import _db as _session

    with _session(env) as s:
        office_id = s.scalar(_select(LandOffice.id).limit(1))
    reqs = []
    for i in range(2):
        reqs.append(_audited(env, "OFFICER_REQUEST", lambda i=i: env.post(
            f"{P}/offices/officer-requests", json={
                "name": f"Off{i}", "email": f"off{i}@x.test", "password": "correct-horse-1",
                "office_id": office_id, "designation": "Tahsildar",
                "phone": "+8801711000000", "employee_id": f"E{i}"})))  # fmt: skip
    mark("POST", f"{P}/offices/officer-requests")
    rid = [r["id"] for r in env.get(f"{P}/admin/officer-requests", headers=adm).json()["items"]]
    _audited(env, "OFFICER_REQUEST_APPROVE", lambda: env.post(
        f"{P}/admin/officer-requests/{rid[0]}/approve", headers=adm))  # fmt: skip
    mark("POST", f"{P}/admin/officer-requests/{{request_id}}/approve")
    _audited(env, "OFFICER_REQUEST_REJECT", lambda: env.post(
        f"{P}/admin/officer-requests/{rid[1]}/reject", json={"reason": "Not verified"}, headers=adm))  # fmt: skip
    mark("POST", f"{P}/admin/officer-requests/{{request_id}}/reject")

    fb = _audited(env, "FEEDBACK_SUBMIT", lambda: env.post(f"{P}/public/feedback", json={
        "kind": "GRIEVANCE", "subject": "Audit subject", "message": "Audit message body"}))  # fmt: skip
    mark("POST", f"{P}/public/feedback")
    before = _ids(env)
    assert env.post(f"{P}/public/page-rating", json={"page": "/faq", "helpful": True}).status_code == 204
    mark("POST", f"{P}/public/page-rating")
    assert _ids(env) == before, "page ratings must not write audit rows"
    fid = env.get(f"{P}/feedback", headers=off).json()["items"][0]["id"]
    assert fb.json()["reference_no"]
    _audited(env, "FEEDBACK_UPDATE", lambda: env.patch(
        f"{P}/feedback/{fid}", json={"status": "IN_REVIEW"}, headers=off))  # fmt: skip
    mark("PATCH", f"{P}/feedback/{{feedback_id}}")

    cit = heads["CITIZEN"]
    _audited(env, "WATCHLIST_ADD", lambda: env.post(f"{P}/me/watchlist", json={"land_id": "LP-10001"}, headers=cit))
    mark("POST", f"{P}/me/watchlist")
    _audited(env, "WATCHLIST_REMOVE", lambda: env.delete(f"{P}/me/watchlist/LP-10001", headers=cit))
    mark("DELETE", f"{P}/me/watchlist/{{land_id}}")
    _audited(env, "SEARCH_HISTORY_CLEAR", lambda: env.delete(f"{P}/me/searches", headers=cit))
    mark("DELETE", f"{P}/me/searches")
    before = _ids(env)
    assert env.post(f"{P}/me/notifications/read", json={}, headers=cit).status_code == 200
    mark("POST", f"{P}/me/notifications/read")
    assert _ids(env) == before, "marking notifications read must not write audit rows"
    _audited(env, "PROFILE_UPDATE", lambda: env.patch(f"{P}/me/profile", json={"phone": "01711000000"}, headers=cit))
    mark("PATCH", f"{P}/me/profile")
    _audited(env, "PASSWORD_CHANGE", lambda: env.post(f"{P}/me/password", json={
        "current_password": "correct-horse-1", "new_password": "correct-horse-2"}, headers=cit))  # fmt: skip
    mark("POST", f"{P}/me/password")

    assert ran == set(AUDIT), f"write routes with no scenario: {set(AUDIT) - ran}"


def test_denied_and_invalid_writes_leave_no_business_audit_row(env, store, jobs):
    heads = {r: _h(env, r) for r in ROLES}
    doc = _ready(env)
    assert _patch(env, doc, {"seller": None}).status_code == 200  # make approve fail validation
    before = _ids(env)
    cit = heads["CITIZEN"]
    calls = [
        env.post(f"{P}/documents/{doc}/approve", headers=cit),
        env.post(f"{P}/documents/{doc}/reject", json={"reason": "x"}, headers=cit),
        env.post(f"{P}/documents/{doc}/reprocess", headers=cit),
        env.patch(f"{P}/documents/{doc}/extraction", json={"fields": []}, headers=cit),
        env.post(f"{P}/documents/{doc}/process", headers=heads["REVIEWER"]),
        env.post(f"{P}/documents/upload", headers=cit),
        env.patch(f"{P}/risk-alerts/x", json={"status": "OPEN"}, headers=cit),
        env.post(f"{P}/documents/{doc}/reject", json={"reason": ""}, headers=heads["REVIEWER"]),  # 422
        env.post(f"{P}/verification", json={"land_id": "LP-99999"}, headers=cit),  # 404
        env.post(f"{P}/documents/{doc}/approve", headers=heads["REVIEWER"]),  # invalid extraction, 422
    ]
    assert [c.status_code for c in calls][:7] == [403] * 7
    assert [c.status_code for c in calls[7:]] == [422, 404, 422], [(c.status_code, c.text[:120]) for c in calls[7:]]
    assert _new_actions(env, before) == []


def test_failed_login_is_audited_without_the_email(env):
    before = _ids(env)
    r = env.post(f"{P}/auth/login", json={"email": "citizen@x.test", "password": "wrong-password"})
    assert r.status_code == 401
    with _db(env) as s:
        rows = s.scalars(select(AuditLog).where(AuditLog.id.not_in(before))).all()
    assert [x.action for x in rows] == ["FAILED_LOGIN"]
    blob = str(rows[0].new_value) + str(rows[0].old_value) + str(rows[0].entity_id)
    assert "wrong-password" not in blob and "citizen@x.test" not in blob
    assert PUBLIC  # (imported for the matrix; keeps the public-route notion in one place)
