"""P49: ML hint in the risk engine (cap +15, never HIGH alone), LOW_EXTRACTION_CONFIDENCE flag."""

import logging
import sys
from datetime import date

import pytest
from sqlalchemy import select

from app.core.config import Settings
from app.core.db import get_db
from app.core.ratelimit import reset_rate_limits
from app.models.alert import FraudAlert
from app.models.document import Document
from app.models.land_parcel import LandParcel
from app.risk import ml
from app.risk.config import ML_MAX_POINTS, ML_MIN_SCORE
from app.risk.context import DocConfidence, Evidence, LandContext, OwnerPeriod, OwnerRef, TxRecord
from app.risk.rules import extraction as extraction_rule
from app.risk.scoring import level_for, ml_points_for, score_evidence
from tests.test_lands import _h, env  # noqa: F401


def _ev(code, sev="HIGH"):
    return Evidence(code, sev, {})


# ---------- scoring (pure) ----------


@pytest.mark.parametrize(
    "score,points",
    [(None, 0), (0.0, 0), (ML_MIN_SCORE, 0), (1.0, ML_MAX_POINTS), (2.0, ML_MAX_POINTS)],
)
def test_ml_points_bounds(score, points):
    assert ml_points_for(score) == points


def test_ml_points_monotonic_and_capped():
    pts = [ml_points_for(s / 100) for s in range(0, 101)]
    assert pts == sorted(pts) and max(pts) == ML_MAX_POINTS and min(pts) == 0


def test_no_ml_leaves_scoring_unchanged():
    r = score_evidence([_ev("SELLER_MISMATCH")], ml_score=None)
    assert (r.rule_score, r.overall_score, r.level, r.ml_points, r.ml_score) == (
        30, 30, "MEDIUM", 0, None,
    )  # fmt: skip
    assert [e.code for e in r.evidence] == ["SELLER_MISMATCH"]


def test_ml_adds_points_and_info_evidence():
    r = score_evidence([_ev("AREA_MISMATCH", "MEDIUM")], ml_score=1.0)
    assert r.rule_score == 15 and r.overall_score == 15 + ML_MAX_POINTS == 30
    assert r.level == "MEDIUM" and r.ml_points == ML_MAX_POINTS
    ml_ev = r.evidence[-1]
    assert ml_ev.code == "ML_ANOMALY" and ml_ev.severity == "INFO"
    assert ml_ev.params == {"score": 1.0, "points": ML_MAX_POINTS}


def test_low_ml_score_adds_nothing_and_no_evidence():
    r = score_evidence([], ml_score=0.1)
    assert r.overall_score == 0 and r.level == "LOW" and r.ml_points == 0
    assert r.evidence == () and r.ml_score == 0.1


def test_ml_alone_cannot_create_high():
    # 40 + 15 = 55 rule points (MEDIUM); +15 ML would be 70 (HIGH) -> held at 59
    ev = [_ev("POSSIBLE_DUPLICATE_TRANSACTION"), _ev("AREA_MISMATCH", "MEDIUM")]
    r = score_evidence(ev, ml_score=1.0)
    assert r.rule_score == 55 and r.overall_score == 59 and r.level == "MEDIUM"
    assert r.ml_points == 4
    assert r.evidence[-1].params["points"] == 4


def test_ml_alone_cannot_create_high_from_low():
    r = score_evidence([_ev("UNIT_MISMATCH", "INFO")], ml_score=1.0)
    assert r.overall_score == ML_MAX_POINTS and r.level == "LOW"


def test_high_by_rules_stays_high_and_ml_still_counts():
    ev = [_ev("POSSIBLE_DUPLICATE_TRANSACTION"), _ev("REPEATED_SUSPICIOUS_TRANSACTIONS")]
    r = score_evidence(ev, ml_score=1.0)
    assert r.rule_score == 60 and r.level == "HIGH" and r.overall_score == 75
    assert r.ml_points == ML_MAX_POINTS


def test_score_cap_still_100_with_ml():
    ev = [_ev(c) for c in ("POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH", "DUPLICATE_DEED")]
    r = score_evidence(ev, ml_score=1.0)
    assert r.rule_score == 100 and r.overall_score == 100 and r.ml_points == 0


def test_ml_never_lowers_a_level():
    for rule_pts_code, base in (("AREA_MISMATCH", 15), ("SELLER_MISMATCH", 30)):
        without = score_evidence([_ev(rule_pts_code)])
        with_ml = score_evidence([_ev(rule_pts_code)], ml_score=0.9)
        assert with_ml.overall_score >= without.overall_score == base
        assert level_for(with_ml.overall_score) == with_ml.level


# ---------- feature builder (pure) ----------


def _ctx(txs, ownership=(), owners=None, area=20.0, unit="decimal"):
    return LandContext(
        land_id="LP-1",
        area=area,
        area_unit=unit,
        ownership=tuple(ownership),
        transactions=tuple(txs),
        owners=owners or {},
    )


def _tx(i, seller, buyer, d, area=20.0, unit="decimal", deed=None, status="RECORDED"):
    return TxRecord(f"t{i}", seller, buyer, d, area, unit, status, deed)


def test_rows_empty_without_transactions():
    assert ml.build_feature_rows(_ctx([])) == []
    rejected = _ctx([_tx(1, "a", "b", date(2020, 1, 1), status="REJECTED")])
    assert ml.build_feature_rows(rejected) == []


def test_rows_values_for_a_double_sale():
    owners = {"a": OwnerRef("Rahim"), "b": OwnerRef("Karim"), "c": OwnerRef("Hasan")}
    own = [OwnerPeriod("a", date(2010, 1, 1), None)]
    txs = [
        _tx(1, "a", "b", date(2020, 1, 1), 20.0, deed="D-1"),
        _tx(2, "a", "c", date(2020, 2, 1), 20.0, deed=" d-1 "),
    ]
    rows = ml.build_feature_rows(_ctx(txs, own, owners))
    assert len(rows) == 2
    r1, r2 = rows
    assert r1["transaction_count"] == r2["transaction_count"] == 2
    assert r1["seller_history_count"] == 0 and r2["seller_history_count"] == 1
    assert r1["buyer_history_count"] == 0 and r2["buyer_history_count"] == 0
    assert r1["duplicate_deed_signal"] == r2["duplicate_deed_signal"] == 1.0
    assert r1["area_difference"] == 0.0 and r2["area_difference"] == 0.0
    assert r1["owner_similarity"] == 1.0
    assert r1["ownership_duration"] == (date(2020, 1, 1) - date(2010, 1, 1)).days
    assert r1["document_similarity"] == 1.0


def test_rows_area_difference_and_seller_similarity():
    owners = {"a": OwnerRef("Rahim Uddin"), "x": OwnerRef("Zubayer Chowdhury")}
    own = [OwnerPeriod("a", date(2015, 1, 1), None)]
    t = _tx(1, "x", "b", date(2020, 1, 1), area=30.0)
    (row,) = ml.build_feature_rows(_ctx([t], own, owners, area=20.0))
    assert row["area_difference"] == pytest.approx(0.5)
    assert row["owner_similarity"] < 0.5
    assert row["ownership_duration"] == ml.ML_NEUTRAL_DURATION_DAYS  # seller holds nothing


def test_rows_other_unit_not_compared_and_undated_is_neutral():
    t = _tx(1, "a", "b", None, area=999.0, unit="katha")
    (row,) = ml.build_feature_rows(_ctx([t]))
    assert row["area_difference"] == 0.0
    assert row["owner_similarity"] == 1.0
    assert row["ownership_duration"] == ml.ML_NEUTRAL_DURATION_DAYS


def test_rows_keys_match_model_features():
    pytest.importorskip("sklearn")
    from ai.fraud_detection import FEATURE_NAMES

    (row,) = ml.build_feature_rows(_ctx([_tx(1, "a", "b", date(2020, 1, 1))]))
    assert tuple(row) == FEATURE_NAMES


# ---------- ml_score_for: skip paths ----------


@pytest.fixture
def one_tx_ctx():
    return _ctx([_tx(1, "a", "b", date(2020, 1, 1))], [OwnerPeriod("a", date(2010, 1, 1), None)])


def _settings(monkeypatch, **kw):
    monkeypatch.setattr(ml, "get_settings", lambda: Settings(_env_file=None, **kw))
    monkeypatch.setattr(ml, "_WARNED", False)


def test_ml_off_returns_none(monkeypatch, one_tx_ctx):
    _settings(monkeypatch, ml_scoring="off")
    assert ml.ml_score_for(one_tx_ctx) is None


def test_no_transactions_returns_none(monkeypatch):
    _settings(monkeypatch)
    assert ml.ml_score_for(_ctx([])) is None


def test_missing_model_skips_and_logs_once(monkeypatch, caplog, one_tx_ctx, tmp_path):
    pytest.importorskip("sklearn")
    _settings(monkeypatch, ml_model_path=str(tmp_path / "nope.joblib"))
    with caplog.at_level(logging.DEBUG, logger="app.risk.ml"):
        assert ml.ml_score_for(one_tx_ctx) is None
        assert ml.ml_score_for(one_tx_ctx) is None
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1 and "rules only" in warnings[0].getMessage()


def test_missing_scikit_learn_skips(monkeypatch, caplog, one_tx_ctx):
    _settings(monkeypatch)
    monkeypatch.setitem(sys.modules, "ai.fraud_detection", None)  # import raises ImportError
    with caplog.at_level(logging.WARNING, logger="app.risk.ml"):
        assert ml.ml_score_for(one_tx_ctx) is None
    assert any("ML scoring skipped" in r.getMessage() for r in caplog.records)


def test_real_model_scores_in_range(monkeypatch, one_tx_ctx):
    pytest.importorskip("sklearn")
    _settings(monkeypatch)
    s = ml.ml_score_for(one_tx_ctx)
    assert s is not None and 0.0 <= s <= 1.0


def test_unusual_parcel_scores_higher_than_normal(monkeypatch):
    pytest.importorskip("sklearn")
    _settings(monkeypatch)
    owners = {"a": OwnerRef("Rahim"), "x": OwnerRef("Zubayer Chowdhury")}
    normal = _ctx(
        [_tx(1, "a", "b", date(2020, 1, 1), area=20.0)],
        [OwnerPeriod("a", date(2005, 1, 1), None)],
        owners,
    )
    odd_txs = [
        _tx(i, "x", "b", date(2020, 1, 1 + i), area=60.0, deed="D-9") for i in range(1, 9)
    ]
    odd = _ctx(odd_txs, [OwnerPeriod("a", date(2005, 1, 1), None)], owners)
    assert ml.ml_score_for(odd) > ml.ml_score_for(normal)


# ---------- LOW_EXTRACTION_CONFIDENCE rule ----------


def test_extraction_rule_flag_has_no_points():
    ctx = LandContext("LP-1", 1.0, "decimal", low_confidence_docs=(
        DocConfidence("d1", ("land_area", "seller")), DocConfidence("d2", ("seller",)),
    ))  # fmt: skip
    (e,) = extraction_rule.evaluate(ctx)
    assert (e.code, e.severity) == ("LOW_EXTRACTION_CONFIDENCE", "INFO")
    assert e.params == {"document_count": 2, "fields": ["land_area", "seller"]}
    r = score_evidence([e])
    assert r.overall_score == 0 and r.level == "LOW"


def test_extraction_rule_silent_without_docs():
    assert extraction_rule.evaluate(LandContext("LP-1", 1.0, "decimal")) == []


# ---------- API / DB ----------


def _risk(env, land, role="CITIZEN"):
    # log in once per client: the login limiter allows 10 attempts per minute
    if not hasattr(env, "_hdr"):
        env._hdr = _h(env, role)
    return env.get(f"/api/v1/lands/{land}/risk", headers=env._hdr).json()


def _db(env):
    return next(env.app.dependency_overrides[get_db]())


def _doc(land_id, status, fields):
    return Document(
        land_id=land_id,
        document_type="DEED",
        file_path="documents/x.png",
        file_hash="h" * 64,
        processing_status=status,
        extraction_json={"provider": "mock", "fields": fields},
    )


def _field(name, conf, edited=False):
    return {"field": name, "value": "x", "confidence": conf, "edited_by_human": edited}


def _add_doc(env, land_code, status, fields):
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == land_code))
        s.add(_doc(land.id, status, fields))
        s.commit()


def test_low_confidence_pending_doc_adds_review_flag_only(env):
    _add_doc(env, "LP-10100", "REVIEW_REQUIRED", [_field("land_area", 0.4), _field("seller", 0.95)])
    b = _risk(env, "LP-10100")
    flags = [e for e in b["evidence"] if e["code"] == "LOW_EXTRACTION_CONFIDENCE"]
    assert len(flags) == 1 and flags[0]["severity"] == "INFO"
    assert flags[0]["params"] == {"document_count": 1, "fields": ["land_area"]}
    assert b["overall_score"] == b["rule_score"] == 0 and b["risk_level"] == "LOW"
    with _db(env) as s:
        assert s.scalars(select(FraudAlert)).all() == []  # INFO flags never alert


@pytest.mark.parametrize(
    "status,fields",
    [
        ("APPROVED", [_field("land_area", 0.2)]),  # already decided by a human
        ("REVIEW_REQUIRED", [_field("land_area", 0.2, edited=True)]),  # corrected
        ("REVIEW_REQUIRED", [_field("father_name", 0.1)]),  # not a required field
        ("REVIEW_REQUIRED", [_field("land_area", 0.95)]),  # above threshold
    ],
)
def test_no_flag_when_not_low_confidence_required(env, status, fields):
    _add_doc(env, "LP-10100", status, fields)
    codes = [e["code"] for e in _risk(env, "LP-10100")["evidence"]]
    assert "LOW_EXTRACTION_CONFIDENCE" not in codes


def test_response_has_ml_score_and_evidence_is_public_safe(env):
    pytest.importorskip("sklearn")
    b = _risk(env, "LP-10240")
    assert isinstance(b["ml_score"], float) and 0.0 <= b["ml_score"] <= 1.0
    for e in b["evidence"]:
        if e["code"] == "ML_ANOMALY":
            assert e["severity"] == "INFO" and set(e["params"]) == {"score", "points"}
            assert 0 <= e["params"]["points"] <= ML_MAX_POINTS


def test_land_without_transactions_has_null_ml_score(env):
    assert _risk(env, "LP-10001")["ml_score"] is None


EXPECTED_LEVELS = {
    "LP-10240": "HIGH",
    "LP-10500": "MEDIUM",
    "LP-10001": "LOW",
    "LP-10100": "LOW",
    "LP-10234": "LOW",
    "LP-10300": "LOW",
    "LP-10400": "LOW",
}


def test_r7_levels_identical_with_ml_on_and_off(env, monkeypatch):
    pytest.importorskip("sklearn")
    on = {k: _risk(env, k) for k in EXPECTED_LEVELS}
    monkeypatch.setattr(ml, "get_settings", lambda: Settings(_env_file=None, ml_scoring="off"))
    off = {k: _risk(env, k) for k in EXPECTED_LEVELS}
    for land, level in EXPECTED_LEVELS.items():
        assert on[land]["risk_level"] == level, land
        assert off[land]["risk_level"] == level, land
        assert off[land]["ml_score"] is None
        assert off[land]["overall_score"] == off[land]["rule_score"]
        assert "ML_ANOMALY" not in [e["code"] for e in off[land]["evidence"]]
        assert on[land]["rule_score"] == off[land]["rule_score"]
        extra = on[land]["overall_score"] - off[land]["overall_score"]
        assert 0 <= extra <= ML_MAX_POINTS, land
    assert off["LP-10240"]["overall_score"] == 70
    assert off["LP-10500"]["overall_score"] == 30


def test_ml_never_creates_alerts(env):
    pytest.importorskip("sklearn")
    for land in EXPECTED_LEVELS:
        _risk(env, land)
    with _db(env) as s:
        assert {a.alert_type for a in s.scalars(select(FraudAlert))} <= {
            "POSSIBLE_DUPLICATE_TRANSACTION",
            "SELLER_MISMATCH",
            "DUPLICATE_DEED",
        }


def test_model_missing_api_still_works(env, monkeypatch, tmp_path):
    monkeypatch.setattr(
        ml,
        "get_settings",
        lambda: Settings(_env_file=None, ml_model_path=str(tmp_path / "missing.joblib")),
    )
    monkeypatch.setattr(ml, "_WARNED", False)
    b = _risk(env, "LP-10240")
    assert (b["overall_score"], b["risk_level"], b["ml_score"]) == (70, "HIGH", None)


def test_public_level_matches_officer_level(env):
    reset_rate_limits()  # the public limiter is process-global
    for land in ("LP-10240", "LP-10500", "LP-10100"):
        lvl = _risk(env, land)["risk_level"]
        assert env.get(f"/api/v1/public/verify/{land}").json()["risk_level"] == lvl


def test_analysis_still_idempotent_with_ml(env):
    for _ in range(3):
        _risk(env, "LP-10500")
    with _db(env) as s:
        from app.models.risk import RiskAssessment

        assert len(s.scalars(select(RiskAssessment)).all()) == 1
