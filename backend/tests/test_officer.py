from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.db import get_db
from app.models.alert import FraudAlert
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.land_parcel import LandParcel
from tests.test_lands import FORBIDDEN_KEYS, ROLES, _h, _keys, env  # noqa: F401

P = "/api/v1/officer"
ENDPOINTS = ("stats", "queue", "activity")


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _fields(conf: float, edited: bool = False):
    return {"fields": [{"field": "owner_name", "value": "A", "confidence": conf,
                        "source_bbox": None, "edited_by_human": edited}]}  # fmt: skip


def _add_doc(env, land, status, extraction=None, age_days=0, dtype="DEED", salt=""):
    with _db(env) as s:
        pk = s.scalar(select(LandParcel.id).where(LandParcel.land_id == land)) if land else None
        d = Document(
            land_id=pk, document_type=dtype, file_path=f"documents/x{salt}.png",
            file_hash=f"h{salt}{land}{status}{age_days}", processing_status=status,
            extraction_json=extraction,
            created_at=datetime.now(UTC) - timedelta(days=age_days),
        )  # fmt: skip
        s.add(d)
        s.commit()
        return d.id


def _add_alert(env, land, severity="HIGH", status="OPEN"):
    with _db(env) as s:
        pk = s.scalar(select(LandParcel.id).where(LandParcel.land_id == land))
        s.add(FraudAlert(land_id=pk, alert_type="X", severity=severity, risk_score=70,
                         evidence=[], status=status))  # fmt: skip
        s.commit()


def _get(env, path, role="REVIEWER", **params):
    return env.get(f"{P}/{path}", headers=_h(env, role), params=params)


def test_stats_match_seed(env):
    b = _get(env, "stats").json()
    assert b == {"total_records": 12, "pending_review": 0, "high_risk": 0, "verified": 12}


def test_stats_reflect_documents_and_alerts(env):
    _add_doc(env, "LP-10001", "REVIEW_REQUIRED", _fields(0.95))
    _add_doc(env, "LP-10001", "EXTRACTED", _fields(0.95), salt="b")
    _add_doc(env, "LP-10001", "APPROVED", _fields(0.95), salt="c")
    _add_alert(env, "LP-10240", "HIGH", "OPEN")
    _add_alert(env, "LP-10240", "HIGH", "ESCALATED")  # same land counts once
    _add_alert(env, "LP-10500", "MEDIUM", "OPEN")
    _add_alert(env, "LP-10100", "HIGH", "DISMISSED")  # dismissed: not risky
    b = _get(env, "stats").json()
    assert b == {"total_records": 12, "pending_review": 2, "high_risk": 1, "verified": 10}


def test_queue_filters(env):
    pend = _add_doc(env, "LP-10001", "REVIEW_REQUIRED", _fields(0.95))
    low = _add_doc(env, "LP-10100", "REVIEW_REQUIRED", _fields(0.5), salt="b")
    edited = _add_doc(env, "LP-10234", "REVIEW_REQUIRED", _fields(0.5, True), salt="c")
    risky = _add_doc(env, "LP-10240", "APPROVED", _fields(0.95), age_days=30, salt="d")
    _add_alert(env, "LP-10240")

    def ids(**p):
        return {i["id"] for i in _get(env, "queue", **p).json()["items"]}

    assert ids() == {pend, low, edited, risky}
    assert ids(filter="pending") == {pend, low, edited}
    assert ids(filter="low_confidence") == {low}  # edited fields are not low-confidence
    assert ids(filter="high_risk") == {risky}
    assert ids(filter="recent") == {pend, low, edited}  # risky is 30 days old
    item = next(i for i in _get(env, "queue", filter="low_confidence").json()["items"])
    assert item["low_confidence"] is True and item["min_confidence"] == 0.5
    assert item["land_id"] == "LP-10100" and item["high_risk"] is False


def test_queue_search_sort_pagination(env):
    for i, land in enumerate(["LP-10001", "LP-10100", "LP-10234"]):
        _add_doc(env, land, "REVIEW_REQUIRED", _fields(0.9), age_days=i, salt=str(i))
    _add_doc(env, None, "UPLOADED", None, dtype="KHATIAN", salt="n")
    b = _get(env, "queue", q="lp-10100").json()
    assert b["total"] == 1 and b["items"][0]["land_id"] == "LP-10100"
    assert _get(env, "queue", q="khatian").json()["items"][0]["land_id"] is None
    asc = _get(env, "queue", sort="land_id", order="asc").json()["items"]
    codes = [i["land_id"] for i in asc if i["land_id"]]
    assert codes == sorted(codes)
    p1 = _get(env, "queue", limit=2, offset=0).json()
    p2 = _get(env, "queue", limit=2, offset=2).json()
    assert p1["total"] == 4 and len(p1["items"]) == 2 and len(p2["items"]) == 2
    assert not {i["id"] for i in p1["items"]} & {i["id"] for i in p2["items"]}


def test_queue_validation(env):
    assert _get(env, "queue", filter="bogus").status_code == 422
    assert _get(env, "queue", limit=0).status_code == 422
    assert _get(env, "queue", limit=101).status_code == 422
    assert _get(env, "queue", sort="file_path").status_code == 422


def test_activity_newest_first_and_filter(env):
    with _db(env) as s:
        for i, a in enumerate(["DOCUMENT_UPLOAD", "DOCUMENT_APPROVE", "DOCUMENT_UPLOAD"]):
            s.add(AuditLog(action=a, entity_type="document", ip_hash="secret-hash",
                           created_at=datetime.now(UTC) - timedelta(minutes=10 - i)))  # fmt: skip
        s.commit()
    b = _get(env, "activity").json()
    assert b["total"] >= 3
    stamps = [i["created_at"] for i in b["items"]]
    assert stamps == sorted(stamps, reverse=True)
    f = _get(env, "activity", action="DOCUMENT_APPROVE").json()
    assert f["total"] == 1 and f["items"][0]["actor"] is None


@pytest.mark.parametrize("role", ["REVIEWER", "OFFICER", "ADMIN"])
def test_no_hashes_paths_or_extra_ids(env, role):
    _add_doc(env, "LP-10001", "REVIEW_REQUIRED", _fields(0.9))
    with _db(env) as s:
        s.add(AuditLog(action="X", entity_type="document", ip_hash="secret-hash",
                       old_value={"a": 1}, new_value={"b": 2}))  # fmt: skip
        s.commit()
    for ep in ENDPOINTS:
        body = _get(env, ep, role).json()
        bad = (FORBIDDEN_KEYS - {"id"}) | {"ip_hash", "old_value", "new_value", "extraction_json"}
        assert not set(_keys(body)) & bad
        assert "secret-hash" not in str(body)


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_citizen_forbidden_and_unauthenticated(env, ep):
    r = _get(env, ep, "CITIZEN")
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"
    assert env.get(f"{P}/{ep}").status_code == 401


@pytest.mark.parametrize("role", ROLES[1:])
@pytest.mark.parametrize("ep", ENDPOINTS)
def test_reviewer_up_allowed(env, role, ep):
    assert _get(env, ep, role).status_code == 200
