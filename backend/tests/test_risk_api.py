import pytest
from sqlalchemy import func, select

from app.core.db import get_db
from app.models.alert import FraudAlert
from app.models.audit import AuditLog
from app.models.risk import RiskAssessment
from app.services import risk as risk_svc
from tests.test_lands import FORBIDDEN_KEYS, ROLES, _h, _keys, env  # noqa: F401

FORBIDDEN_WORDS = ("fraud confirmed", "proven", "forged", "illegal", "guilty")


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _risk(env, land, role="CITIZEN"):
    return env.get(f"/api/v1/lands/{land}/risk", headers=_h(env, role))


def test_double_sale_is_high_70_with_evidence(env):
    r = _risk(env, "LP-10240")
    assert r.status_code == 200
    b = r.json()
    assert (b["overall_score"], b["risk_level"], b["rule_score"]) == (70, "HIGH", 70)
    codes = {e["code"] for e in b["evidence"]}
    assert codes == {"POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"}
    assert all(e["severity"] == "HIGH" for e in b["evidence"])


def test_clean_and_medium_lands(env):
    assert _risk(env, "LP-10001").json()["risk_level"] == "LOW"
    clean = _risk(env, "LP-10100").json()
    assert clean["overall_score"] == 0 and clean["evidence"] == []
    dup = _risk(env, "LP-10500").json()
    # P49: the ML hint may add 0-15 points on top of the 30 rule points; level stays MEDIUM
    assert (dup["rule_score"], dup["risk_level"]) == (30, "MEDIUM")
    assert 30 <= dup["overall_score"] <= 45
    codes = [e["code"] for e in dup["evidence"]]
    assert codes[0] == "DUPLICATE_DEED" and set(codes) <= {"DUPLICATE_DEED", "ML_ANOMALY"}


@pytest.mark.parametrize("role", ROLES)
def test_no_internal_ids_or_forbidden_wording(env, role):
    b = _risk(env, "LP-10240", role).json()
    assert not (set(_keys(b)) & FORBIDDEN_KEYS)
    assert not [k for k in _keys(b) if k.endswith("_id") and k != "land_id"]
    assert not [k for k in _keys(b) if k.endswith("_ids")]
    assert not any(w in str(b).lower() for w in FORBIDDEN_WORDS)


def test_risk_not_found_and_unauthenticated(env):
    assert _risk(env, "LP-99999").status_code == 404
    assert _risk(env, "LP-99999").json()["code"] == "LAND_NOT_FOUND"
    assert env.get("/api/v1/lands/LP-10240/risk").status_code == 401


def test_analysis_is_idempotent(env):
    for _ in range(3):
        assert _risk(env, "LP-10240").status_code == 200
    with _db(env) as s:
        assert s.scalar(select(func.count()).select_from(RiskAssessment)) == 1
        assert s.scalar(select(func.count()).select_from(FraudAlert)) == 2


def test_alerts_persisted_and_deduped_per_code(env):
    _risk(env, "LP-10240")
    _risk(env, "LP-10500")
    h = _h(env, "REVIEWER")
    body = env.get("/api/v1/risk-alerts", headers=h).json()
    assert body["total"] == 3
    types = sorted(a["alert_type"] for a in body["items"])
    assert types == ["DUPLICATE_DEED", "POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"]
    assert all(a["status"] == "OPEN" and a["evidence"] for a in body["items"])
    assert not (set(_keys(body)) & (FORBIDDEN_KEYS - {"id"}))
    f = env.get("/api/v1/risk-alerts?land_id=LP-10500", headers=h).json()
    assert f["total"] == 1 and f["items"][0]["land_id"] == "LP-10500"
    f = env.get("/api/v1/risk-alerts?severity=HIGH&limit=1", headers=h).json()
    assert f["total"] == 3 and len(f["items"]) == 1


def test_alerts_permissions(env):
    assert env.get("/api/v1/risk-alerts", headers=_h(env, "CITIZEN")).status_code == 403
    assert env.get("/api/v1/risk-alerts").status_code == 401
    for role in ("REVIEWER", "OFFICER", "ADMIN"):
        assert env.get("/api/v1/risk-alerts", headers=_h(env, role)).status_code == 200
    r = env.get("/api/v1/risk-alerts?status=BOGUS", headers=_h(env, "OFFICER"))
    assert r.status_code == 422


def _first_alert_id(env):
    _risk(env, "LP-10500")
    return env.get("/api/v1/risk-alerts", headers=_h(env, "REVIEWER")).json()["items"][0]["id"]


def test_patch_updates_status_and_audits(env):
    aid = _first_alert_id(env)
    h = _h(env, "REVIEWER")
    r = env.patch(f"/api/v1/risk-alerts/{aid}", json={"status": "UNDER_REVIEW"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "UNDER_REVIEW"
    r = env.patch(f"/api/v1/risk-alerts/{aid}", json={"status": "ESCALATED"}, headers=h)
    assert r.json()["status"] == "ESCALATED"
    with _db(env) as s:
        rows = s.scalars(
            select(AuditLog)
            .where(AuditLog.action == "RISK_ALERT_UPDATE")
            .order_by(AuditLog.created_at)
        ).all()
        assert len(rows) == 2
        assert rows[0].entity_id == aid and rows[0].entity_type == "fraud_alert"
        assert rows[0].old_value == {"status": "OPEN"}
        assert rows[0].new_value == {"status": "UNDER_REVIEW"}
        assert rows[0].actor_id is not None
        a = s.get(FraudAlert, aid)
        assert a.status == "ESCALATED" and a.reviewed_by is not None


def test_patch_permission_not_found_validation(env):
    aid = _first_alert_id(env)
    assert (
        env.patch(
            f"/api/v1/risk-alerts/{aid}", json={"status": "DISMISSED"}, headers=_h(env, "CITIZEN")
        ).status_code
        == 403
    )
    assert env.patch(f"/api/v1/risk-alerts/{aid}", json={"status": "DISMISSED"}).status_code == 401
    h = _h(env, "OFFICER")
    nf = env.patch("/api/v1/risk-alerts/does-not-exist", json={"status": "DISMISSED"}, headers=h)
    assert nf.status_code == 404 and nf.json()["code"] == "ALERT_NOT_FOUND"
    bad = env.patch(f"/api/v1/risk-alerts/{aid}", json={"status": "FRAUD_CONFIRMED"}, headers=h)
    assert bad.status_code == 422
    with _db(env) as s:
        n = s.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "RISK_ALERT_UPDATE")
        )
        assert n == 0


def test_reanalysis_keeps_reviewer_decision(env):
    aid = _first_alert_id(env)
    h = _h(env, "OFFICER")
    body = {"status": "DISMISSED", "reason": "checked with sub-registrar"}
    assert env.patch(f"/api/v1/risk-alerts/{aid}", json=body, headers=h).status_code == 200
    _risk(env, "LP-10500")
    body = env.get("/api/v1/risk-alerts?land_id=LP-10500", headers=h).json()
    assert body["total"] == 1 and body["items"][0]["status"] == "DISMISSED"


def test_analyze_land_service_persists_assessment(env):
    with _db(env) as s:
        a = risk_svc.analyze_land(s, "LP-10240")
        assert (a.overall_score, a.risk_level) == (70, "HIGH")
        assert {e["code"] for e in a.evidence_json} == {
            "POSSIBLE_DUPLICATE_TRANSACTION",
            "SELLER_MISMATCH",
        }


def _high_alert_id(env):
    _risk(env, "LP-10500")
    r = env.get("/api/v1/risk-alerts?severity=HIGH", headers=_h(env, "REVIEWER"))
    items = r.json()["items"]
    assert items, "LP-10500 must produce a HIGH alert"
    return items[0]["id"]


def test_dismiss_requires_a_reason(env):
    aid = _high_alert_id(env)
    for body in ({"status": "DISMISSED"}, {"status": "DISMISSED", "reason": "   "}):
        r = env.patch(f"/api/v1/risk-alerts/{aid}", json=body, headers=_h(env, "OFFICER"))
        assert r.status_code == 422 and r.json()["code"] == "REASON_REQUIRED"
    with _db(env) as s:
        assert s.get(FraudAlert, aid).status == "OPEN"


def test_reviewer_cannot_dismiss_high_alert_but_officer_can(env):
    aid = _high_alert_id(env)
    body = {"status": "DISMISSED", "reason": "looks fine"}
    r = env.patch(f"/api/v1/risk-alerts/{aid}", json=body, headers=_h(env, "REVIEWER"))
    assert r.status_code == 403 and r.json()["code"] == "ALERT_DISMISS_FORBIDDEN"
    # reviewer may still triage it
    ok = env.patch(
        f"/api/v1/risk-alerts/{aid}", json={"status": "ESCALATED"}, headers=_h(env, "REVIEWER")
    )
    assert ok.status_code == 200
    r = env.patch(f"/api/v1/risk-alerts/{aid}", json=body, headers=_h(env, "OFFICER"))
    assert r.status_code == 200 and r.json()["status"] == "DISMISSED"
    with _db(env) as s:
        row = s.scalars(
            select(AuditLog)
            .where(AuditLog.action == "RISK_ALERT_UPDATE")
            .order_by(AuditLog.created_at.desc())
        ).first()
        assert row.new_value == {"status": "DISMISSED", "reason": "looks fine"}
