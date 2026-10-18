# ruff: noqa: E501, F811
"""H9c: HISTORICAL_SELLER_NOT_OWNER and HISTORICAL_CHAIN_GAP (historical deed vs CS/SA khatian)."""

from datetime import date

from sqlalchemy import select

from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.risk.config import RULE_POINTS, RULE_SEVERITY
from app.risk.context import (
    HistoricalDeedInfo,
    HistoricalLink,
    LandContext,
    OwnerRef,
    SurveyRecord,
    TxRecord,
    load_land_context,
)
from app.risk.rules import historical_deed, run_rules
from tests.test_archive import _doc
from tests.test_documents import _db
from tests.test_lands import env  # noqa: F401

OWNERS = {
    "s": OwnerRef("রামকান্ত রায়"),
    "b": OwnerRef("ভবানী প্রসাদ দাস"),
    "x": OwnerRef("Karim Mia"),
}
LINK = HistoricalLink("t1", "d9", "s", "b", date(1944, 3, 1))


def _ctx(records, links=(LINK,), owners=OWNERS, txs=()):
    base = [TxRecord("t1", "s", "b", date(1944, 3, 1), 10.0, "decimal", from_document=True)]
    return LandContext(
        "LP-X", 10.0, "decimal", survey_records=tuple(records), historical_links=tuple(links),
        owners=owners, transactions=tuple(base + list(txs)), as_of=date(2000, 1, 1),
    )  # fmt: skip


def _codes(ctx):
    return [e.code for e in historical_deed.evaluate(ctx)]


def test_config_entries():
    for c in ("HISTORICAL_SELLER_NOT_OWNER", "HISTORICAL_CHAIN_GAP"):
        assert RULE_POINTS[c] > 0 and RULE_SEVERITY[c] == "MEDIUM"


def test_seller_is_the_cs_owner_and_buyer_is_the_sa_owner_is_clean():
    recs = [SurveyRecord("k1", "CS", ("রামকান্ত রায়",)), SurveyRecord("k2", "SA", ("ভবানী প্রসাদ দাস",))]
    assert _codes(_ctx(recs)) == []


def test_spelling_variant_and_honorific_still_match():
    recs = [SurveyRecord("k1", "CS", ("রামকান্ত রায",))]  # spelling variant (no ya-phala)
    owners = {**OWNERS, "s": OwnerRef("রামকান্ত রায়")}
    assert _codes(_ctx(recs, owners=owners)) == []
    recs = [SurveyRecord("k1", "CS", ("রামকান্ত রায়",))]
    owners = {**OWNERS, "s": OwnerRef("মো: রামকান্ত রায়")}
    assert _codes(_ctx(recs, owners=owners)) == []


def test_seller_not_the_khatian_owner_is_flagged_without_names():
    recs = [SurveyRecord("k1", "CS", ("Karim Mia",))]
    (e,) = historical_deed.evaluate(_ctx(recs))
    assert (e.code, e.severity) == ("HISTORICAL_SELLER_NOT_OWNER", "MEDIUM")
    p = e.to_dict()["params"]
    assert p["document_id"] == "d9" and p["transaction_date"] == "1944-03-01" and p["surveys"] == ["CS"]
    assert not any(n in str(e.to_dict()) for n in ("Karim", "রামকান্ত", "ভবানী"))


def test_seller_reached_through_a_recorded_transfer_is_not_flagged():
    owners = {**OWNERS, "m": OwnerRef("Salam Mia"), "s": OwnerRef("Salam Mia")}
    txs = [TxRecord("t0", "x", "s", date(1930, 1, 1), 10.0, "decimal")]
    recs = [SurveyRecord("k1", "CS", ("Karim Mia",)), SurveyRecord("k2", "SA", ("ভবানী প্রসাদ দাস",))]
    assert _codes(_ctx(recs, owners=owners, txs=txs)) == []


def test_gap_when_the_buyer_does_not_lead_to_the_sa_owner():
    recs = [SurveyRecord("k1", "CS", ("রামকান্ত রায়",)), SurveyRecord("k2", "SA", ("Karim Mia",))]
    (e,) = historical_deed.evaluate(_ctx(recs))
    assert (e.code, e.severity) == ("HISTORICAL_CHAIN_GAP", "MEDIUM")
    assert e.params["from_survey"] == "CS" and e.params["to_survey"] == "SA"
    assert not any(n in str(e.to_dict()) for n in ("Karim", "রামকান্ত", "ভবানী"))


def test_no_gap_when_a_later_transfer_links_the_buyer_to_the_sa_owner():
    txs = [TxRecord("t2", "b", "x", date(1950, 1, 1), 10.0, "decimal")]
    recs = [SurveyRecord("k1", "CS", ("রামকান্ত রায়",)), SurveyRecord("k2", "SA", ("Karim Mia",))]
    assert _codes(_ctx(recs, txs=txs)) == []


def test_nothing_later_to_compare_means_no_gap():
    assert _codes(_ctx([SurveyRecord("k1", "CS", ("রামকান্ত রায়",))])) == []
    sa_only = [SurveyRecord("k2", "SA", ("রামকান্ত রায়",))]
    assert _codes(_ctx(sa_only)) == []


def test_rs_bs_khatians_and_missing_inputs_are_ignored():
    rs = [SurveyRecord("k1", "RS", ("Karim Mia",))]
    assert _codes(_ctx(rs)) == []
    assert _codes(_ctx([SurveyRecord("k1", "CS", ("Karim Mia",))], links=())) == []
    assert _codes(_ctx([SurveyRecord("k1", "CS", ("Karim Mia",))], owners={})) == []


def test_loader_reads_the_historical_link_and_the_rules_run(env):
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
        a, b = Owner(name="রামকান্ত রায়"), Owner(name="ভবানী প্রসাদ দাস")
        s.add_all([a, b])
        s.flush()
        tx = Transaction(
            land_id=land.id, seller_id=a.id, buyer_id=b.id, transaction_date=date(1944, 3, 1),
            area=10.0, area_unit="decimal",
        )  # fmt: skip
        s.add(tx)
        s.flush()
        s.add(
            OwnershipHistory(
                land_id=land.id, owner_id=b.id, start_date=date(1944, 3, 1),
                end_date=date(1944, 3, 1), source_transaction_id=tx.id, kind="HISTORICAL",
            )
        )  # fmt: skip
        s.add_all(
            [
                _doc(land.id, "x", "CS", h="hc1", names=("রামকান্ত রায়",)),
                _doc(land.id, "y", "SA", h="hc2", names=("Plokij Mnbvc",)),
            ]
        )
        s.commit()
        ctx = load_land_context(s, land)
        assert [(h.seller_id, h.buyer_id) for h in ctx.historical_links] == [(a.id, b.id)]
        assert a.id in ctx.owners and b.id in ctx.owners
        assert "HISTORICAL_CHAIN_GAP" in [e.code for e in run_rules(ctx)]


# ---- H9d: dag / khatian conflicts and consideration sanity -----------------------------------------

D_OWNERS = {
    "a": OwnerRef("রামকান্ত রায়"),
    "b": OwnerRef("ভবানী প্রসাদ দাস"),
    "c": OwnerRef("Karim Mia"),
    "e": OwnerRef("Salam Mia"),
}


def _deed(tx, doc, seller, buyer, when, dags=("123",), khat=(), **kw):
    return HistoricalDeedInfo(tx, doc, seller, buyer, when, dags=tuple(dags), khatians=tuple(khat), **kw)


def _dctx(deeds, txs=()):
    return LandContext(
        "LP-X", 10.0, "decimal", historical_deeds=tuple(deeds), owners=D_OWNERS,
        transactions=tuple(txs), as_of=date(2000, 1, 1),
    )  # fmt: skip


def _dcodes(ctx, code):
    return [e for e in historical_deed.evaluate(ctx) if e.code == code]


def test_h9d_config_entries():
    for c in ("HISTORICAL_DAG_CONFLICT", "HISTORICAL_CONSIDERATION_IMPLAUSIBLE"):
        assert RULE_POINTS[c] > 0 and RULE_SEVERITY[c] == "MEDIUM"


def test_dag_claimed_by_a_later_deed_through_another_seller_is_flagged():
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1))
    d2 = _deed("t2", "d2", "c", "e", date(1950, 5, 1), dags=("123", "999"))
    (e,) = _dcodes(_dctx([d2, d1]), "HISTORICAL_DAG_CONFLICT")
    assert e.severity == "MEDIUM"
    p = e.to_dict()["params"]
    assert p["document_id"] == "d2" and p["earlier_document_id"] == "d1"
    assert p["transaction_date"] == "1950-05-01" and p["earlier_date"] == "1944-03-01"
    assert p["basis"] == "DAG" and p["dags"] == ["123"]
    assert not any(n in str(e.to_dict()) for n in ("Karim", "রামকান্ত", "ভবানী", "Salam"))


def test_later_deed_from_the_earlier_buyer_or_their_buyers_is_clean():
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1))
    assert _dcodes(_dctx([d1, _deed("t2", "d2", "b", "c", date(1950, 1, 1))]), "HISTORICAL_DAG_CONFLICT") == []
    hop = TxRecord("t3", "b", "c", date(1946, 1, 1), 10.0, "decimal")  # b sold to c, c sells later
    assert _dcodes(_dctx([d1, _deed("t2", "d2", "c", "e", date(1950, 1, 1))], txs=[hop]), "HISTORICAL_DAG_CONFLICT") == []


def test_the_original_seller_selling_the_dag_again_is_flagged():
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1))
    d2 = _deed("t2", "d2", "a", "e", date(1950, 1, 1))
    assert len(_dcodes(_dctx([d1, d2]), "HISTORICAL_DAG_CONFLICT")) == 1


def test_other_dags_and_same_day_deeds_do_not_conflict():
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1))
    assert _dcodes(_dctx([d1, _deed("t2", "d2", "c", "e", date(1950, 1, 1), dags=("500",))]), "HISTORICAL_DAG_CONFLICT") == []
    assert _dcodes(_dctx([d1, _deed("t2", "d2", "c", "e", date(1944, 3, 1))]), "HISTORICAL_DAG_CONFLICT") == []
    undated = _deed("t2", "d2", "c", "e", None)
    assert _dcodes(_dctx([d1, undated]), "HISTORICAL_DAG_CONFLICT") == []


def test_khatian_is_the_basis_only_when_a_deed_lists_no_dag():
    k = (("CS", "1245"),)
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1), dags=(), khat=k)
    d2 = _deed("t2", "d2", "c", "e", date(1950, 1, 1), dags=("77",), khat=k)
    (e,) = _dcodes(_dctx([d1, d2]), "HISTORICAL_DAG_CONFLICT")
    assert e.params["basis"] == "KHATIAN" and e.params["dags"] == []
    d1 = _deed("t1", "d1", "a", "b", date(1944, 3, 1), dags=("5",), khat=k)  # both list dags: they differ
    assert _dcodes(_dctx([d1, d2]), "HISTORICAL_DAG_CONFLICT") == []


def _sale(**kw):
    base = dict(kind="SALE_SAF_KABALA", era="BRITISH_INDIA", currency="INR", amount=1000.0, area_decimal=10.0)
    return _deed("t1", "d1", "a", "b", date(1944, 3, 1), **{**base, **kw})


def _price(**kw):
    return _dcodes(_dctx([_sale(**kw)]), "HISTORICAL_CONSIDERATION_IMPLAUSIBLE")


def test_price_inside_the_era_range_is_clean():
    assert _price() == []  # 100 INR per decimal


def test_price_far_above_or_below_the_range_is_flagged_with_numbers_only():
    (hi,) = _price(amount=100_000.0)  # 10 000 per decimal, range 0.5 - 600
    p = hi.to_dict()["params"]
    assert (p["reason"], p["per_decimal"], p["range_low"], p["range_high"]) == ("ABOVE_RANGE", 10000.0, 0.5, 600.0)
    assert p["era"] == "BRITISH_INDIA" and p["currency"] == "INR" and p["document_id"] == "d1"
    (lo,) = _price(amount=1.0)  # 0.1 per decimal
    assert lo.params["reason"] == "BELOW_RANGE"


def test_currency_that_does_not_fit_the_era_is_flagged_once():
    (e,) = _price(currency="BDT", amount=100_000.0)
    assert e.params["reason"] == "CURRENCY_ERA" and "per_decimal" not in e.params
    assert _price(era="EAST_BENGAL_PAKISTAN", currency="PKR") == []
    assert _price(era="EAST_BENGAL_PAKISTAN", currency="INR") == []
    assert len(_price(era="BANGLADESH", currency="INR", amount=1_000_000.0)) == 1


def test_price_check_skips_what_it_cannot_judge():
    assert _price(kind="GIFT_HEBA", amount=100_000.0) == []  # gifts have no price
    assert _price(amount=None) == [] and _price(amount=0.0) == []
    assert _price(area_decimal=None, amount=100_000.0) == []  # unit could not be converted
    assert _price(era=None, amount=100_000.0) == []
    assert _price(currency=None, amount=100_000.0)[0].params["reason"] == "ABOVE_RANGE"


def test_loader_reads_the_approved_record_and_both_rules_run(env):
    import json

    from app.models.document_record import DocumentRecord

    rec = {
        "schema": "lhdr/1",
        "document": {"kind": "SALE_SAF_KABALA", "era": "BRITISH_INDIA"},
        "consideration": {"amount": 500000, "era_currency": "INR"},
        "schedule": [
            {"khatian_no": "১২৪৫", "survey": "CS", "dag_no": ["১২৩", "124"],
             "area": {"value": 2, "unit": "bigha"}},
        ],
    }  # fmt: skip
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
        a, b, c, e = (Owner(name=n) for n in ("রামকান্ত রায়", "ভবানী প্রসাদ দাস", "Karim Mia", "Salam Mia"))
        s.add_all([a, b, c, e])
        s.flush()
        docs = []
        for i, (seller, buyer, when) in enumerate(
            [(a, b, date(1944, 3, 1)), (c, e, date(1950, 5, 1))]
        ):
            doc = _doc(land.id, "x", "CS", h=f"hd{i}", names=())
            doc.document_type = "DEED"
            s.add(doc)
            s.flush()
            tx = Transaction(
                land_id=land.id, seller_id=seller.id, buyer_id=buyer.id, transaction_date=when,
                area=2.0, area_unit="bigha", source_document_id=doc.id,
            )  # fmt: skip
            s.add(tx)
            s.flush()
            s.add(
                OwnershipHistory(
                    land_id=land.id, owner_id=buyer.id, start_date=when, end_date=when,
                    source_transaction_id=tx.id, kind="HISTORICAL",
                )
            )  # fmt: skip
            s.add(
                DocumentRecord(
                    document_id=doc.id, version=1, status="APPROVED", record_schema="lhdr/1",
                    record_json=json.loads(json.dumps(rec)),
                )
            )  # fmt: skip
            docs.append(doc)
        s.commit()
        ctx = load_land_context(s, land)
        assert len(ctx.historical_deeds) == 2
        d = ctx.historical_deeds[0]
        assert d.dags == ("123", "124") and d.khatians == (("CS", "1245"),)
        assert d.kind == "SALE_SAF_KABALA" and d.era == "BRITISH_INDIA" and d.currency == "INR"
        assert d.amount == 500000 and d.area_decimal == 66.0  # 2 bigha = 66 decimal
        codes = [x.code for x in run_rules(ctx)]
        assert "HISTORICAL_DAG_CONFLICT" in codes
        assert "HISTORICAL_CONSIDERATION_IMPLAUSIBLE" in codes  # 7 575 INR per decimal in 1944
