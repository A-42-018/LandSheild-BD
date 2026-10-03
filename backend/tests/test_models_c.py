import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.db import Base, make_engine
from app.models import (
    AuditLog,
    FraudAlert,
    LandParcel,
    RiskAssessment,
    Transaction,
    User,
    VerificationRequest,
)
from app.models.owner import Owner
from app.services import audit

EXPECTED = {
    "users", "land_parcels", "owners", "documents", "deeds", "transactions",
    "ownership_history", "verification_requests", "risk_assessments", "fraud_alerts",
    "audit_logs",
}


@pytest.fixture
def db() -> Session:
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


@pytest.fixture
def world(db: Session):
    land = LandParcel(land_id="LP-1", district="Dhaka", upazila="Savar", mouza="Ashulia",
                      dag_no="785", khatian_no="1245", area=10, area_unit="decimal")
    a, b = Owner(name="Rahim"), Owner(name="Karim")
    user = User(name="Off", email="o@x.test", password_hash="x", role="OFFICER")
    db.add_all([land, a, b, user])
    db.commit()
    txn = Transaction(land_id=land.id, seller_id=a.id, buyer_id=b.id, area=10, area_unit="decimal")
    db.add(txn)
    db.commit()
    return land, user, txn


def test_all_11_tables_from_alembic_chain(tmp_path):
    url = f"sqlite:///{tmp_path / 't.db'}"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    assert EXPECTED <= set(inspect(make_engine(url)).get_table_names())
    command.downgrade(cfg, "0002")
    assert "audit_logs" not in set(inspect(make_engine(url)).get_table_names())
    command.upgrade(cfg, "head")


def test_verification_request_defaults(db: Session, world):
    land, user, _ = world
    v = VerificationRequest(land_id=land.id, requested_by=user.id)
    db.add(v)
    db.commit()
    assert v.status == "PENDING" and v.completed_at is None and v.requester.id == user.id


def test_risk_assessment_json_and_link(db: Session, world):
    land, user, _ = world
    v = VerificationRequest(land_id=land.id, requested_by=user.id)
    db.add(v)
    db.flush()
    r = RiskAssessment(land_id=land.id, verification_id=v.id, overall_score=80,
                       risk_level="HIGH", rule_score=80,
                       evidence_json=[{"code": "DOUBLE_SALE", "params": {"n": 2}}])
    db.add(r)
    db.commit()
    assert r.ml_score is None and r.verification.id == v.id
    assert r.evidence_json[0]["code"] == "DOUBLE_SALE"


def test_fraud_alert_defaults_and_relations(db: Session, world):
    land, user, txn = world
    a = FraudAlert(land_id=land.id, transaction_id=txn.id, alert_type="DOUBLE_SALE",
                   severity="HIGH", risk_score=85, evidence={"k": 1})
    db.add(a)
    db.commit()
    assert a.status == "OPEN" and a.reviewed_by is None and a.transaction.id == txn.id
    a.reviewed_by = user.id
    db.commit()
    assert a.reviewer.email == "o@x.test"


def test_audit_log_stores_hash_never_raw_ip(db: Session, world):
    _, user, _ = world
    row = audit.log(db, user, "land.update", "land_parcels", "abc",
                    old={"status": "ACTIVE"}, new={"status": "REVIEW_REQUIRED"},
                    ip="203.0.113.9")
    db.commit()
    assert row.actor_id == user.id and row.old_value == {"status": "ACTIVE"}
    assert row.ip_hash and "203.0.113.9" not in row.ip_hash and len(row.ip_hash) == 64
    dumped = {c.name: getattr(row, c.name) for c in AuditLog.__table__.columns}
    assert "203.0.113.9" not in str(dumped)


def test_audit_ip_hash_salted_and_optional(db: Session):
    assert audit.hash_ip(None) is None and audit.hash_ip("") is None
    assert audit.hash_ip("1.2.3.4", salt="a") == audit.hash_ip("1.2.3.4", salt="a")
    assert audit.hash_ip("1.2.3.4", salt="a") != audit.hash_ip("1.2.3.4", salt="b")
    row = audit.log(db, None, "auth.login_failed", "users")
    db.commit()
    assert row.actor_id is None and row.ip_hash is None and db.query(AuditLog).count() == 1
