# ruff: noqa: F811
import pytest
from sqlalchemy import select

from app.core.db import get_db
from app.models.deed import Deed
from app.models.land_parcel import LandParcel
from app.models.ledger import LedgerEntry
from app.models.mutation import MutationRecord
from app.models.transaction import Transaction
from app.risk.context import LandContext
from app.risk.rules import integrity, run_rules
from app.risk.scoring import score_evidence
from app.services import ledger
from app.services import risk as risk_svc
from tests.test_lands import ROLES, _h, env  # noqa: F401

V = "/api/v1/admin/ledger/verify"


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _tx(db, land_code="LP-10100") -> Transaction:
    land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_code))
    return db.scalars(
        select(Transaction).where(Transaction.land_id == land.id).order_by(Transaction.id)
    ).first()


def test_seed_chains_every_record_and_verifies_intact(env):
    with _db(env) as db:
        n = ledger.count(db)
        assert n > 0 and ledger.backfill(db) == 0  # idempotent
        rows = db.scalars(select(LedgerEntry).order_by(LedgerEntry.seq)).all()
        assert [r.seq for r in rows] == list(range(1, n + 1))
        assert rows[0].prev_hash == ledger.GENESIS
        assert all(b.prev_hash == a.entry_hash for a, b in zip(rows, rows[1:], strict=False))
    r = env.get(V, headers=_h(env, "ADMIN"))
    assert r.status_code == 200 and r.json()["status"] == "INTACT" and r.json()["entries"] == n


def test_append_is_noop_until_the_record_changes(env):
    with _db(env) as db:
        tx = _tx(db)
        before = ledger.count(db)
        assert ledger.append(db, "transaction", tx.id) is not None and ledger.count(db) == before
        tx.status = "FLAGGED"
        row = ledger.append(db, "transaction", tx.id)
        assert row.seq == before + 1 and ledger.count(db) == before + 1
        db.commit()
    assert env.get(V, headers=_h(env, "ADMIN")).json()["status"] == "INTACT"


def test_tampered_transaction_breaks_verify_and_turns_parcel_high(env):
    with _db(env) as db:
        tx = _tx(db)
        entry = db.scalar(
            select(LedgerEntry).where(
                LedgerEntry.entity_type == "transaction", LedgerEntry.entity_id == tx.id
            )
        )
        seq, tx_id = entry.seq, tx.id
        tx.area = tx.area + 5  # what scripts/tamper_demo.py does, but via the ORM
        db.commit()
    body = env.get(V, headers=_h(env, "ADMIN")).json()
    assert body["status"] == "BROKEN" and body["broken_seq"] <= seq
    assert body["reason"] == "RECORD_MODIFIED" or body["broken_seq"] < seq
    with _db(env) as db:
        a = risk_svc.analyze_land(db, "LP-10100", commit=False)
        codes = {e["code"]: e for e in (a.evidence_json or [])}
        assert "RECORD_INTEGRITY_FAILED" in codes
        assert codes["RECORD_INTEGRITY_FAILED"]["severity"] == "HIGH" and a.risk_level == "HIGH"
        assert ("transaction", tx_id) in ledger.integrity_failures(
            db, db.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
        )


def test_deleted_or_rewritten_entry_is_detected(env):
    with _db(env) as db:
        db.delete(db.scalar(select(LedgerEntry).where(LedgerEntry.seq == 2)))
        db.commit()
    b = env.get(V, headers=_h(env, "ADMIN")).json()
    assert (b["status"], b["broken_seq"], b["reason"]) == ("BROKEN", 2, "SEQ_GAP")


def test_rewritten_payload_hash_breaks_chain_at_that_seq(env):
    with _db(env) as db:
        db.scalar(select(LedgerEntry).where(LedgerEntry.seq == 3)).payload_hash = "a" * 64
        db.commit()
    b = env.get(V, headers=_h(env, "ADMIN")).json()
    assert (b["status"], b["broken_seq"], b["reason"]) == ("BROKEN", 3, "ENTRY_HASH_MISMATCH")


def test_mutation_transition_and_unledgered_rows(env):
    with _db(env) as db:
        m = db.scalars(select(MutationRecord).order_by(MutationRecord.id)).first()
        before = ledger.count(db)
        m.status = "HEARING"
        ledger.append(db, "mutation", m.id)
        assert ledger.count(db) == before + 1
        d = db.scalars(select(Deed)).first()
        db.query(LedgerEntry).filter(
            LedgerEntry.entity_type == "deed", LedgerEntry.entity_id == d.id
        ).delete()  # a record with no entry is legacy: ignored by the parcel check
        d.area = d.area + 1
        db.flush()
        land = db.get(LandParcel, d.land_id)
        assert all(k != "deed" or i != d.id for k, i in ledger.integrity_failures(db, land))


def test_rule_is_pure_single_evidence_60_high():
    assert integrity.evaluate(LandContext("LP-X", 1.0, "decimal")) == []
    ctx = LandContext(
        "LP-X", 1.0, "decimal", integrity_failures=(("transaction", "t1"), ("deed", "d1"))
    )
    ev = run_rules(ctx)
    assert [e.code for e in ev] == ["RECORD_INTEGRITY_FAILED"]
    assert ev[0].params["count"] == 2
    r = score_evidence(ev)
    assert r.overall_score == 60 and r.level == "HIGH"


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER", "OFFICER"])
def test_verify_is_admin_only(env, role):
    assert env.get(V, headers=_h(env, role)).status_code == 403
    assert env.get(V).status_code == 401
