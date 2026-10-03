import pytest
from sqlalchemy import func, select

from app.core.db import get_db
from app.models.audit import AuditLog
from app.models.risk import RiskAssessment
from app.models.verification import VerificationRequest
from tests.test_lands import FORBIDDEN_KEYS, ROLES, _h, _keys, env  # noqa: F401

SECTIONS = {
    "verification_id", "land_id", "verification_status", "overall_status", "risk_score",
    "risk_level", "land", "ownership", "document_consistency", "transactions", "evidence",
    "disclaimer_code", "verified_at",
}  # fmt: skip
FORBIDDEN_WORDS = ("fraud confirmed", "proven", "forged", "illegal", "guilty")


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _create(env, land, role="CITIZEN"):
    return env.post("/api/v1/verification", json={"land_id": land}, headers=_h(env, role))


def test_create_runs_analysis_and_completes(env):
    r = _create(env, "LP-10240")
    assert r.status_code == 201
    b = r.json()
    assert (b["land_id"], b["status"], b["risk_score"], b["risk_level"]) == (
        "LP-10240", "COMPLETED", 70, "HIGH",
    )  # fmt: skip
    assert b["completed_at"] and b["id"]
    got = env.get(f"/api/v1/verification/{b['id']}", headers=_h(env, "CITIZEN"))
    assert got.status_code == 200
    g = got.json()  # SQLite drops tz on reload, so compare non-timestamp fields
    assert {k: g[k] for k in ("id", "land_id", "status", "risk_score", "risk_level")} == {
        k: b[k] for k in ("id", "land_id", "status", "risk_score", "risk_level")
    }
    assert g["completed_at"][:19] == b["completed_at"][:19]
    with _db(env) as s:
        a = s.scalars(select(RiskAssessment).where(RiskAssessment.verification_id == b["id"])).all()
        assert len(a) == 1 and a[0].overall_score == 70
        assert s.scalar(select(func.count()).select_from(VerificationRequest)) == 1
        assert s.scalar(select(AuditLog).where(AuditLog.action == "VERIFICATION_CREATE"))


def test_each_request_creates_new_assessment(env):
    ids = {_create(env, "LP-10100").json()["id"] for _ in range(2)}
    assert len(ids) == 2
    with _db(env) as s:
        assert s.scalar(select(func.count()).select_from(RiskAssessment)) == 2


def test_report_sections_double_sale(env):
    vid = _create(env, "LP-10240").json()["id"]
    r = env.get(f"/api/v1/verification/{vid}/report", headers=_h(env, "CITIZEN"))
    assert r.status_code == 200
    b = r.json()
    assert set(b) == SECTIONS
    assert (b["risk_score"], b["risk_level"], b["overall_status"]) == (70, "HIGH", "ACTIVE")
    assert b["verification_status"] == "COMPLETED" and b["verified_at"]
    assert b["land"]["land_id"] == "LP-10240" and len(b["transactions"]) == 2
    assert {e["code"] for e in b["evidence"]} == {
        "POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH",
    }  # fmt: skip
    assert b["document_consistency"]["status"] == "NO_ISSUES"
    assert b["disclaimer_code"] == "DEMO_DECISION_SUPPORT"


def test_report_clean_and_doc_consistency_flag(env):
    clean = env.get(
        f"/api/v1/verification/{_create(env, 'LP-10100').json()['id']}/report",
        headers=_h(env, "CITIZEN"),
    ).json()
    assert clean["risk_level"] == "LOW" and clean["evidence"] == []
    assert [o["owner"]["name"] for o in clean["ownership"]] and len(clean["transactions"]) == 2
    dup = env.get(
        f"/api/v1/verification/{_create(env, 'LP-10500').json()['id']}/report",
        headers=_h(env, "CITIZEN"),
    ).json()
    dc = dup["document_consistency"]
    assert dc["status"] == "INCONSISTENCIES_FOUND"
    assert [i["code"] for i in dc["indicators"]] == ["DUPLICATE_DEED"]


def test_father_name_masked_for_citizen_only(env):
    vid = _create(env, "LP-10100", "CITIZEN").json()["id"]
    rep = env.get(f"/api/v1/verification/{vid}/report", headers=_h(env, "CITIZEN")).json()
    assert all(o["father_name"] is None for o in rep["land"]["current_owners"])
    assert all(e["owner"]["father_name"] is None for e in rep["ownership"])
    vid = _create(env, "LP-10100", "OFFICER").json()["id"]
    rep = env.get(f"/api/v1/verification/{vid}/report", headers=_h(env, "OFFICER")).json()
    assert all(o["father_name"] for o in rep["land"]["current_owners"])


@pytest.mark.parametrize("role", ROLES)
def test_report_leaks_no_internal_data(env, role):
    vid = _create(env, "LP-10240", role).json()["id"]
    b = env.get(f"/api/v1/verification/{vid}/report", headers=_h(env, role)).json()
    keys = set(_keys(b))
    assert not (keys & (FORBIDDEN_KEYS - {"id"}))
    assert not [k for k in keys if k.endswith("_ids")]
    assert not [k for k in keys if k.endswith("_id") and k not in {"land_id", "verification_id"}]
    assert not any(w in str(b).lower() for w in FORBIDDEN_WORDS)


def test_citizen_reads_only_own_request(env):
    vid = _create(env, "LP-10240", "CITIZEN").json()["id"]
    other = env.post(  # second citizen
        "/api/v1/auth/register",
        json={"name": "C2", "email": "c2@x.test", "password": "correct-horse-1"},
    )
    assert other.status_code == 201
    login = env.post(
        "/api/v1/auth/login", json={"email": "c2@x.test", "password": "correct-horse-1"}
    ).json()
    h2 = {"Authorization": f"Bearer {login['access_token']}"}
    for path in (f"/api/v1/verification/{vid}", f"/api/v1/verification/{vid}/report"):
        r = env.get(path, headers=h2)
        assert r.status_code == 404 and r.json()["code"] == "VERIFICATION_NOT_FOUND"
        assert env.get(path, headers=_h(env, "CITIZEN")).status_code == 200
        for role in ("REVIEWER", "OFFICER", "ADMIN"):
            assert env.get(path, headers=_h(env, role)).status_code == 200


def test_errors_and_auth(env):
    assert _create(env, "LP-99999").json()["code"] == "LAND_NOT_FOUND"
    assert _create(env, "LP-99999").status_code == 404
    with _db(env) as s:
        assert s.scalar(select(func.count()).select_from(VerificationRequest)) == 0
    h = _h(env, "CITIZEN")
    assert env.post("/api/v1/verification", json={}, headers=h).status_code == 422
    assert env.post("/api/v1/verification", json={"land_id": "LP-10100"}).status_code == 401
    assert env.get("/api/v1/verification/x").status_code == 401
    assert env.get("/api/v1/verification/nope", headers=h).status_code == 404
    assert env.get("/api/v1/verification/nope/report", headers=h).status_code == 404


def test_report_not_ready_when_pending(env):
    vid = _create(env, "LP-10100").json()["id"]
    with _db(env) as s:
        s.get(VerificationRequest, vid).status = "PENDING"
        s.commit()
    r = env.get(f"/api/v1/verification/{vid}/report", headers=_h(env, "CITIZEN"))
    assert r.status_code == 409 and r.json()["code"] == "VERIFICATION_NOT_READY"


def test_failed_analysis_marks_request_failed(env, monkeypatch):
    from app.services import risk as risk_svc

    def boom(*a, **k):
        raise RuntimeError("x")

    monkeypatch.setattr(risk_svc, "analyze_land", boom)
    r = _create(env, "LP-10100")
    assert r.status_code == 500 and r.json()["code"] == "VERIFICATION_FAILED"
    with _db(env) as s:
        assert s.scalars(select(VerificationRequest)).one().status == "FAILED"
