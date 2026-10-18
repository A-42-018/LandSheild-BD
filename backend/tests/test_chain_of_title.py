# ruff: noqa: E501, F811
"""H9a: approving a historical deed adds a past chain-of-title link (D2); the current owner stays.

One 1944 link per document; a correction updates it in place; current-owner queries ignore it.
"""
from datetime import date

from sqlalchemy import select

from app.models.document import Document
from app.models.enums import OwnershipKind
from app.models.land_parcel import LandParcel
from app.models.owner import Owner
from app.models.ownership import OwnershipHistory
from app.models.transaction import Transaction
from app.services import chain
from app.services import land as land_svc
from tests.test_documents import _db, png, store  # noqa: F401
from tests.test_lands import _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_records import D, _approve_historical, _historical, _patch  # noqa: F401


def _links(env, doc_id) -> list[tuple[OwnershipHistory, str]]:
    with _db(env) as s:
        tx = s.scalar(select(Transaction).where(Transaction.source_document_id == doc_id))
        rows = s.scalars(select(OwnershipHistory).where(OwnershipHistory.land_id == tx.land_id)).all()
        out = [(r, s.get(Owner, r.owner_id).name) for r in rows]
        s.expunge_all()
    return out


def _date_fix(env, doc_id, iso="1944-03-01"):
    assert _patch(env, doc_id, {"deed_date": iso}).status_code == 200


def test_approving_the_sample_adds_exactly_one_1944_link_and_no_current_owner(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    links = _links(env, doc_id)
    assert len(links) == 1
    link, name = links[0]
    assert link.kind == OwnershipKind.HISTORICAL.value
    assert link.start_date == date(1944, 3, 1) and link.end_date == date(1944, 3, 1)  # end unknown
    assert link.source_transaction_id is not None and name
    with _db(env) as s:
        land = s.scalar(select(LandParcel).where(LandParcel.id == link.land_id))
        assert land_svc.current_owners(s, land) == []  # the 1944 buyer is not the current owner


def test_a_historical_link_never_replaces_the_current_owner(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    (link, _), = _links(env, doc_id)
    with _db(env) as s:
        land = s.get(LandParcel, link.land_id)
        cur = Owner(name="Present Holder")
        s.add(cur)
        s.flush()
        s.add(OwnershipHistory(land_id=land.id, owner_id=cur.id, start_date=date(2001, 1, 1)))
        s.commit()
        assert [o.name for o in land_svc.current_owners(s, land)] == ["Present Holder"]
    rows = _links(env, doc_id)
    assert sorted(r.kind for r, _ in rows) == ["CURRENT", "HISTORICAL"]


def test_ownership_api_marks_the_link_as_not_current(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    (link, _), = _links(env, doc_id)
    with _db(env) as s:
        code = s.get(LandParcel, link.land_id).land_id
    r = env.get(f"/api/v1/lands/{code}/ownership", headers=_h(env, "OFFICER"))
    assert r.status_code == 200
    entries = r.json()["entries"]
    assert len(entries) == 1 and entries[0]["is_current"] is False
    assert entries[0]["start_date"] == "1944-03-01"
    # H9b: the entry says it is a historical chain-of-title link and points to its source document
    assert entries[0]["kind"] == "HISTORICAL" and entries[0]["historical"] is True
    assert entries[0]["document"]["id"] == doc_id


def test_correction_updates_the_link_instead_of_adding_a_second(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    before, _ = _links(env, doc_id)[0]
    rev, off = _h(env, "REVIEWER"), _h(env, "OFFICER")
    assert env.post(D.format(doc_id) + "/records", headers=rev).status_code == 201
    r = env.patch(
        D.format(doc_id) + "/records/3", headers=rev,
        json={"fields": [{"field": "deed_date", "value": "1944-04-10"}, {"field": "buyer", "value": "রামকান্ত দাস"}]},
    )
    assert r.status_code == 200, r.text
    assert env.post(D.format(doc_id) + "/records/3/approve", headers=off).status_code == 200
    links = _links(env, doc_id)
    assert len(links) == 1
    link, name = links[0]
    assert link.id == before.id and link.start_date == date(1944, 4, 10)
    assert name == "রামকান্ত দাস"


def test_later_known_period_sets_the_end_of_the_link(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    (link, _), = _links(env, doc_id)
    with _db(env) as s:
        from app.services import chain

        owner = Owner(name="Later Holder")
        s.add(owner)
        s.flush()
        s.add(OwnershipHistory(land_id=link.land_id, owner_id=owner.id, start_date=date(1962, 5, 1)))
        s.flush()
        chain._set_ranges(s, link.land_id)
        s.commit()
    assert [r.end_date for r, _ in _links(env, doc_id) if r.kind == "HISTORICAL"] == [date(1962, 5, 1)]


def _land_code(env, doc_id) -> str:
    link, _ = _links(env, doc_id)[0]  # the land's rows all share one land_id
    with _db(env) as s:
        return s.get(LandParcel, link.land_id).land_id


def test_current_entries_are_not_marked_historical(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    (link, _), = _links(env, doc_id)
    with _db(env) as s:
        owner = Owner(name="Present Holder")
        s.add(owner)
        s.flush()
        s.add(OwnershipHistory(land_id=link.land_id, owner_id=owner.id, start_date=date(2001, 1, 1)))
        s.flush()
        chain._set_ranges(s, link.land_id)  # what the next posting / correction does
        s.commit()
    entries = env.get(f"/api/v1/lands/{_land_code(env, doc_id)}/ownership", headers=_h(env, "OFFICER")).json()["entries"]
    assert [(e["kind"], e["historical"], e["is_current"]) for e in entries] == [
        ("HISTORICAL", True, False),  # 1944, first in date order
        ("CURRENT", False, True),
    ]
    assert entries[0]["end_date"] == "2001-01-01"  # ends where the next known holder starts


def test_land_documents_mark_the_document_that_made_the_link(env, jobs):
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    out = env.get(f"/api/v1/lands/{_land_code(env, doc_id)}/documents", headers=_h(env, "REVIEWER")).json()
    item = next(i for i in out["items"] if i["id"] == doc_id)
    assert item["chain_link"] == {"start_date": "1944-03-01", "end_date": "1944-03-01"}


def test_land_documents_without_a_link_have_no_chain_link(env, jobs):
    doc_id = _historical(env, jobs)  # processed, not approved: no link yet
    with _db(env) as s:
        land = s.get(LandParcel, s.get(Document, doc_id).land_id) if s.get(Document, doc_id).land_id else None
    if land is None:
        return  # an unapproved document is not attached to a land yet: nothing to list
    out = env.get(f"/api/v1/lands/{land.land_id}/documents", headers=_h(env, "REVIEWER")).json()
    assert all(i["chain_link"] is None for i in out["items"] if i["id"] == doc_id)


# ---- review fixes (H9f): a historical deed is no modern sale -------------------------------------

MODERN_ONLY = {"IMPOSSIBLE_DATE", "SELLER_MISMATCH", "RAPID_RESALE", "POSSIBLE_NAME_VARIANT", "AREA_EXCEEDED"}


def _tx(env, doc_id) -> Transaction:
    with _db(env) as s:
        tx = s.scalar(select(Transaction).where(Transaction.source_document_id == doc_id))
        s.expunge(tx)
    return tx


def test_approving_a_historical_deed_opens_no_mutation_case(env, jobs):
    from app.models.mutation import MutationRecord

    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    tx = _tx(env, doc_id)
    with _db(env) as s:
        assert s.scalars(select(MutationRecord).where(MutationRecord.transaction_id == tx.id)).all() == []


def test_the_approval_time_risk_run_already_sees_the_link(env, jobs, monkeypatch):
    from app.services import posting

    seen = []
    real = posting.analyze_land

    def spy(db, land_id, *a, **k):
        land = db.scalar(select(LandParcel).where(LandParcel.land_id == land_id))
        seen.append(len(db.scalars(select(OwnershipHistory).where(
            OwnershipHistory.land_id == land.id, OwnershipHistory.kind == OwnershipKind.HISTORICAL.value,
        )).all()))  # fmt: skip
        return real(db, land_id, *a, **k)

    monkeypatch.setattr(posting, "analyze_land", spy)
    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    assert seen == [1]  # H9c/H9d rules run on the deed being approved


def test_modern_rules_skip_a_historical_deed_on_a_parcel_with_a_present_owner(env, jobs):
    from app.risk.context import active_transactions, load_land_context
    from app.services.risk import analyze_land

    doc_id = _historical(env, jobs)
    _date_fix(env, doc_id)
    _approve_historical(env, doc_id)
    tx = _tx(env, doc_id)
    assert tx.status == "RECORDED"
    with _db(env) as s:
        land = s.get(LandParcel, tx.land_id)
        cur = Owner(name="Present Holder")
        s.add(cur)
        s.flush()  # recorded ownership starts in 2010: a 1944 sale is "before the record origin"
        s.add(OwnershipHistory(land_id=land.id, owner_id=cur.id, start_date=date(2010, 1, 1)))
        s.commit()
        ctx = load_land_context(s, land)
        assert [t.historical for t in ctx.transactions if t.id == tx.id] == [True]
        assert tx.id not in {t.id for t in active_transactions(ctx)}
        assert tx.id in {t.id for t in active_transactions(ctx, include_historical=True)}
        evidence = analyze_land(s, land.land_id).evidence_json or []
    hits = [e["code"] for e in evidence if (e.get("params") or {}).get("transaction_id") == tx.id]
    assert not (set(hits) & MODERN_ONLY), hits


def test_a_modern_sale_never_closes_an_undated_historical_link(env, jobs):
    from types import SimpleNamespace

    from app.services import posting

    doc_id = _historical(env, jobs)
    _approve_historical(env, doc_id)
    (link, _), = _links(env, doc_id)
    with _db(env) as s:
        row = s.get(OwnershipHistory, link.id)
        row.start_date = row.end_date = None  # a deed whose date could not be read
        s.flush()
        land = s.get(LandParcel, link.land_id)
        seller = s.get(Owner, link.owner_id)  # the 1944 buyer sells today
        buyer = Owner(name="New Buyer")
        s.add(buyer)
        s.flush()
        sale = SimpleNamespace(id=link.source_transaction_id)
        posting._update_ownership(s, land, seller, buyer, sale, date(2024, 6, 1), SimpleNamespace(fields=[]))
        s.commit()
    (after,) = [r for r, _ in _links(env, doc_id) if r.kind == OwnershipKind.HISTORICAL.value]
    assert after.end_date is None  # still a past link with no known end, not "until 2024"
