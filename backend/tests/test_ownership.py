import pytest
from sqlalchemy import select

from app.core.db import get_db
from app.models.document import Document
from app.models.land_parcel import LandParcel
from app.models.transaction import Transaction
from tests.test_lands import FORBIDDEN_KEYS, ROLES, _h, _keys, env  # noqa: F401

B = "/api/v1/lands"


def test_chain_order_lp_10100(env):
    h = _h(env, "OFFICER")
    own = env.get(f"{B}/LP-10100/ownership", headers=h).json()
    dates = [e["start_date"] for e in own["entries"]]
    assert dates == sorted(dates) and len(dates) == 3
    assert [e["is_current"] for e in own["entries"]] == [False, False, True]
    tx = env.get(f"{B}/LP-10100/transactions", headers=h).json()["transactions"]
    assert [t["transaction_date"] for t in tx] == ["2012-03-15", "2019-06-20"]
    assert tx[0]["seller"]["name"] == own["entries"][0]["owner"]["name"]
    assert tx[0]["buyer"]["name"] == own["entries"][1]["owner"]["name"]
    assert tx[1]["seller"]["name"] == own["entries"][1]["owner"]["name"]
    assert tx[1]["buyer"]["name"] == own["entries"][2]["owner"]["name"]


def test_names_are_rahim_karim_hasan(env):
    h = _h(env, "CITIZEN")
    names = [
        e["owner"]["name"].lower()
        for e in env.get(f"{B}/LP-10100/ownership", headers=h).json()["entries"]
    ]
    for n, key in zip(names, ("rahim", "karim", "hasan"), strict=True):
        assert key in n


def test_double_sale_lp_10240_ordered(env):
    tx = env.get(f"{B}/LP-10240/transactions", headers=_h(env, "REVIEWER")).json()["transactions"]
    assert [t["transaction_date"] for t in tx] == ["2021-05-10", "2021-08-02"]
    assert tx[0]["seller"]["name"] == tx[1]["seller"]["name"]


def test_land_without_transactions(env):
    h = _h(env, "CITIZEN")
    r = env.get(f"{B}/LP-10234/transactions", headers=h)
    assert r.status_code == 200 and r.json()["transactions"] == []
    assert len(env.get(f"{B}/LP-10234/ownership", headers=h).json()["entries"]) == 1


def test_father_name_masking(env):
    for url in ("ownership", "transactions"):
        cit = env.get(f"{B}/LP-10100/{url}", headers=_h(env, "CITIZEN")).text
        assert '"father_name":null' in cit.replace(" ", "")
        assert '"father_name":"' not in cit.replace(" ", "")
        off = env.get(f"{B}/LP-10100/{url}", headers=_h(env, "OFFICER")).text
        assert '"father_name":"' in off.replace(" ", "")


@pytest.mark.parametrize("role", ROLES)
def test_no_sensitive_fields(env, role):
    h = _h(env, role)
    for url in ("ownership", "transactions"):
        body = env.get(f"{B}/LP-10100/{url}", headers=h).json()
        assert not (set(_keys(body)) & (FORBIDDEN_KEYS | {"seller_id", "buyer_id", "owner_id"}))


def test_document_ref_is_id_and_type_only(env):
    s = next(env.app.dependency_overrides[get_db]())
    land = s.scalar(select(LandParcel).where(LandParcel.land_id == "LP-10100"))
    tx = s.scalars(
        select(Transaction)
        .where(Transaction.land_id == land.id)
        .order_by(Transaction.transaction_date)
    ).first()
    doc = Document(
        land_id=land.id, document_type="DEED", file_path="/srv/secret/x.pdf", file_hash="h" * 64
    )
    s.add(doc)
    s.flush()
    tx.source_document_id = doc.id
    doc_id = doc.id
    s.commit()
    s.close()
    h = _h(env, "OFFICER")
    tx0 = env.get(f"{B}/LP-10100/transactions", headers=h).json()["transactions"][0]
    assert tx0["document"] == {"id": doc_id, "type": "DEED"}
    assert "/srv/secret" not in env.get(f"{B}/LP-10100/transactions", headers=h).text
    own = env.get(f"{B}/LP-10100/ownership", headers=h).json()["entries"]
    assert any(e["document"] == {"id": doc_id, "type": "DEED"} for e in own)


def test_not_found_and_auth(env):
    h = _h(env, "CITIZEN")
    for url in ("ownership", "transactions"):
        r = env.get(f"{B}/LP-99999/{url}", headers=h)
        assert r.status_code == 404 and r.json()["code"] == "LAND_NOT_FOUND"
        assert env.get(f"{B}/LP-10100/{url}").status_code == 401
