"""P30 integration: upload -> process (mock providers) -> approve -> posting (demo checkpoint 2)."""
from datetime import date

from sqlalchemy import func, select

from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.services import posting
from tests.test_documents import _db, _files, _up, png, store  # noqa: F401
from tests.test_extraction import _patch, _ready
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import _actions, _row, jobs  # noqa: F401
from tests.test_review import _post


def _land(s, code):
    return s.scalar(select(LandParcel).where(LandParcel.land_id == code))


def _txs(s, code):
    land = _land(s, code)
    return s.scalars(
        select(Transaction)
        .where(Transaction.land_id == land.id)
        .order_by(Transaction.created_at, Transaction.id)
    ).all()


def _periods(s, code):
    land = _land(s, code)
    rows = s.scalars(
        select(OwnershipHistory).where(OwnershipHistory.land_id == land.id)
    ).all()
    return {(s.get(Owner, r.owner_id).name, r.start_date, r.end_date) for r in rows}


def _count_owners(s, name):
    return s.scalar(select(func.count()).select_from(Owner).where(Owner.name == name))


def _approve(env, marker: bytes, edits: dict | None = None) -> str:
    doc_id = _ready(env, marker)
    if edits:
        assert _patch(env, doc_id, edits).status_code == 200
    r = _post(env, doc_id, "approve")
    assert r.status_code == 200 and r.json()["processing_status"] == "APPROVED", r.text
    return doc_id


def _alerts(env, code):
    r = env.get(f"/api/v1/risk-alerts?land_id={code}", headers=_h(env, "REVIEWER"))
    assert r.status_code == 200
    return r.json()["items"]


def test_demo_flow_doc1_then_doc2_raises_duplicate_alert(env, jobs):
    doc1 = _approve(env, b"Doc1")
    with _db(env) as s:
        (t1,) = _txs(s, "LP-10234")
        assert t1.status == "RECORDED" and t1.risk_score == 0
        assert t1.source_document_id == doc1 and t1.deed_id is not None
        assert _row(env, doc1).land_id == _land(s, "LP-10234").id
        assert _periods(s, "LP-10234") == {
            ("Rahim Uddin", date(2010, 1, 1), date(2024, 2, 12)),
            ("Karim Mia", date(2024, 2, 12), None),
        }
    assert _alerts(env, "LP-10234") == []
    risk = env.get("/api/v1/lands/LP-10234/risk", headers=_h(env, "CITIZEN")).json()
    assert risk["risk_level"] == "LOW" and risk["overall_score"] == 0

    doc2 = _approve(env, b"Doc2")
    with _db(env) as s:
        t1, t2 = _txs(s, "LP-10234")
        assert t1.status == "RECORDED" and t2.status == "FLAGGED" and t2.risk_score == 70
        assert s.get(Deed, t2.deed_id).status == "FLAGGED"
        # ownership NOT updated for the flagged transaction: Karim is still the current owner
        assert _periods(s, "LP-10234") == {
            ("Rahim Uddin", date(2010, 1, 1), date(2024, 2, 12)),
            ("Karim Mia", date(2024, 2, 12), None),
        }
        # exact name + father name reuses the seeded owner (no duplicate Rahim)
        assert _count_owners(s, "Rahim Uddin") == 1
        t2_id = t2.id
    alerts = _alerts(env, "LP-10234")
    dup = [a for a in alerts if a["alert_type"] == "POSSIBLE_DUPLICATE_TRANSACTION"]
    assert len(dup) == 1 and dup[0]["severity"] == "HIGH" and dup[0]["status"] == "OPEN"
    risk = env.get("/api/v1/lands/LP-10234/risk", headers=_h(env, "CITIZEN")).json()
    assert risk["risk_level"] == "HIGH" and risk["overall_score"] == 70
    codes = {e["code"] for e in risk["evidence"]}
    assert {"POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"} <= codes
    assert "transaction_id" not in str(risk) and t2_id not in str(risk)
    with _db(env) as s:
        acts = s.scalars(select(AuditLog.action).where(AuditLog.entity_id.in_([doc1, doc2]))).all()
        tx_acts = s.scalars(
            select(AuditLog.action).where(AuditLog.entity_type == "transaction")
        ).all()
    assert acts.count("DOCUMENT_APPROVE") == 2
    assert sorted(tx_acts) == ["TRANSACTION_FLAGGED", "TRANSACTION_RECORDED"]
    assert "DOCUMENT_APPROVE" in _actions(env, doc2)


def test_clean_record_is_recorded_and_hands_over_ownership(env, jobs):
    _approve(env, b"Clean")
    with _db(env) as s:
        (t,) = _txs(s, "LP-10001")
        assert t.status == "RECORDED" and t.risk_score == 0
        assert t.transaction_date == date(2024, 5, 10)
        assert _periods(s, "LP-10001") == {
            ("Jamal Hossain", date(2008, 1, 10), date(2024, 5, 10)),
            ("Hasan Ali", date(2024, 5, 10), None),
        }
        assert _count_owners(s, "Jamal Hossain") == 1
    assert _alerts(env, "LP-10001") == []
    risk = env.get("/api/v1/lands/LP-10001/risk", headers=_h(env, "CITIZEN")).json()
    assert risk["risk_level"] == "LOW" and risk["evidence"] == []


def test_unknown_parcel_is_created_and_buyer_becomes_owner(env, jobs):
    _approve(env, b"Doc1", {"khatian_no": "9999"})
    with _db(env) as s:
        land = _land(s, "LP-10501")
        assert land is not None and land.khatian_no == "9999" and land.status == "ACTIVE"
        assert (land.area, land.area_unit, land.district) == (10.0, "decimal", "Gazipur")
        (t,) = _txs(s, "LP-10501")
        assert t.status == "RECORDED"
        # no recorded predecessor: only the buyer's period is opened
        assert _periods(s, "LP-10501") == {("Karim Mia", date(2024, 2, 12), None)}
        assert _land(s, "LP-10234") is not None and not _txs(s, "LP-10234")


def test_same_name_without_matching_father_is_a_new_owner(env, jobs):
    _approve(env, b"Doc1", {"father_name": "Someone Else"})
    with _db(env) as s:
        names = s.scalars(select(Owner).where(Owner.name == "Rahim Uddin")).all()
        assert len(names) == 2  # never merged without an exact name + father match
        (t,) = _txs(s, "LP-10234")
        assert t.status == "FLAGGED"  # new "Rahim" is not the recorded owner -> SELLER_MISMATCH


def test_posting_failure_rolls_everything_back(env, jobs, monkeypatch):
    with _db(env) as s:
        owners_before = s.scalar(select(func.count()).select_from(Owner))
    doc_id = _ready(env, b"Clean")
    assert _patch(env, doc_id, {"buyer": "Brand New Buyer"}).status_code == 200

    def boom(*a, **k):
        raise RuntimeError("db exploded")

    monkeypatch.setattr(posting, "analyze_land", boom)
    r = _post(env, doc_id, "approve")
    assert r.status_code == 500 and r.json()["code"] == "POSTING_FAILED"
    assert "exploded" not in r.text
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"
    with _db(env) as s:
        assert not _txs(s, "LP-10001")
        assert not s.scalars(select(Deed).where(Deed.document_id == doc_id)).all()
        assert s.scalar(select(func.count()).select_from(Owner)) == owners_before
        approvals = select(AuditLog).where(
            AuditLog.entity_id == doc_id, AuditLog.action == "DOCUMENT_APPROVE"
        )
        assert not s.scalars(approvals).all()
        assert _periods(s, "LP-10001") == {("Jamal Hossain", date(2008, 1, 10), None)}

    monkeypatch.undo()  # the same document can be approved once the fault is gone
    assert _post(env, doc_id, "approve").status_code == 200


def test_land_identifier_mismatch_blocks_posting(env, jobs):
    up = _up(env, "scan.png", png() + b"LSMOCK:Doc1", "OFFICER", land_id="LP-10300")
    assert up.status_code == 201
    doc_id = up.json()["id"]
    proc = env.post(f"/api/v1/documents/{doc_id}/process", headers=_h(env, "OFFICER"))
    assert proc.status_code == 202
    r = _post(env, doc_id, "approve")
    assert r.status_code == 409 and r.json()["code"] == "LAND_IDENTIFIER_MISMATCH"
    assert _row(env, doc_id).processing_status == "REVIEW_REQUIRED"


# ---- P43 fuzzy names ----


def test_name_variant_seller_is_review_not_hard_mismatch(env, jobs):
    # seller "Rahim" (no father) resembles recorded owner "Rahim Uddin": INFO evidence, no alert
    _approve(env, b"Doc1", {"seller": "Rahim"})
    with _db(env) as s:
        (t,) = _txs(s, "LP-10234")
        assert t.status == "FLAGGED"  # held for review, ownership untouched
        assert _count_owners(s, "Rahim") == 1  # similar name never auto-merged
        assert {n for n, _, e in _periods(s, "LP-10234") if e is None} == {"Rahim Uddin"}
    assert _alerts(env, "LP-10234") == []
    risk = env.get("/api/v1/lands/LP-10234/risk", headers=_h(env, "CITIZEN")).json()
    assert [e["code"] for e in risk["evidence"]] == ["POSSIBLE_NAME_VARIANT"]
    assert risk["risk_level"] == "LOW"


def test_matching_name_and_father_is_merged_into_existing_owner(env, jobs):
    before = None
    with _db(env) as s:
        before = s.scalar(select(func.count()).select_from(Owner))
    _approve(env, b"Doc1", {"seller": "Md. Rahim Uddin", "owner_name": "Md. Rahim Uddin"})
    with _db(env) as s:
        assert _count_owners(s, "Md. Rahim Uddin") == 0
        # only the buyer (no father on the deed) is a new owner; the seller was merged
        assert s.scalar(select(func.count()).select_from(Owner)) == before + 1
        (t,) = _txs(s, "LP-10234")
        assert t.status == "RECORDED"
        assert any(n == "Rahim Uddin" and e is not None for n, _, e in _periods(s, "LP-10234"))


def test_similar_name_with_same_father_below_threshold_is_not_merged(env, jobs):
    _approve(env, b"Doc1", {"seller": "Rahim", "owner_name": "Rahim"})  # father Abdul Jabbar kept
    with _db(env) as s:
        assert _count_owners(s, "Rahim") == 1  # 0.75 < MERGE_MIN -> new record
