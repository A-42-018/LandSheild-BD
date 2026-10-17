# ruff: noqa: F811
"""Owner NID: the office records the landowner's NID; only the citizen who proves that NID (with
the matching date of birth) sees the land recorded under it, and only on their own profile."""

from datetime import date

import pytest
from sqlalchemy import select

from app.core.nid import NidError, canonical_nid, nid_key
from app.core.passwords import hash_password
from app.models.audit import AuditLog
from app.models.owner import Owner
from app.models.user import User
from tests.test_documents import _db, _up, png, store  # noqa: F401
from tests.test_extraction import _process
from tests.test_lands import PW, _h, env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401
from tests.test_review import _fill, _post

P = "/api/v1"
RAHIM = {"nid": "19759990000000001", "date_of_birth": "1975-03-12"}  # seed owner, synthetic
RAHIM_CURRENT = {"LP-10234", "LP-10500", "LP-10600", "LP-10800"}
RAHIM_PAST = {"LP-10100", "LP-10240"}
KARIM = {"nid": "19809990000000002", "date_of_birth": "1980-07-01"}  # the Doc1 buyer, "Karim Mia"
BUYER = {"nid": "19859990000000077", "date_of_birth": "1985-05-05"}


def _citizen(env, email="second@x.test"):
    with _db(env) as s:
        s.add(User(name="Second", email=email, password_hash=hash_password(PW), role="CITIZEN"))
        s.commit()
    r = env.post(f"{P}/auth/login", json={"email": email, "password": PW})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _link(env, headers, body=RAHIM):
    return env.post(f"{P}/me/nid", json=body, headers=headers)


def _audit(env, action):
    with _db(env) as s:
        return s.scalars(select(AuditLog).where(AuditLog.action == action)).all()


# ---- NID normalisation -----------------------------------------------------------------------
def test_canonical_nid_accepts_card_formats():
    dob = date(1975, 3, 12)
    assert canonical_nid("1975 9990-000000001", dob) == "19759990000000001"
    assert canonical_nid("৯৯৯০০০০০০০০০১", dob) == "19759990000000001"  # Bangla 13-digit
    assert canonical_nid("1234567890", dob) == "1234567890"  # smart card
    for bad in ("12345", "12345678901", "SYN-NID-0001", ""):
        with pytest.raises(NidError):
            canonical_nid(bad, dob)
    with pytest.raises(NidError):
        nid_key("1234567890", date(2999, 1, 1))  # born in the future


def test_hashes_depend_on_dob_and_never_contain_the_number():
    a = nid_key(RAHIM["nid"], date(1975, 3, 12))
    b = nid_key(RAHIM["nid"], date(1975, 3, 13))
    assert a.nid_hash == b.nid_hash and a.dob_hash != b.dob_hash
    assert RAHIM["nid"] not in a.nid_hash + a.dob_hash and a.last4 == "0001"


# ---- citizen: link own NID, see own land -----------------------------------------------------
def test_unlinked_citizen_sees_no_land(env):
    r = env.get(f"{P}/me/lands", headers=_h(env, "CITIZEN"))
    assert r.status_code == 200
    body = r.json()
    assert body["nid"]["registered"] is False and body["current"] == [] and body["past"] == []
    assert body["total_current"] == 0


def test_link_then_list_own_land(env):
    cit = _h(env, "CITIZEN")
    r = _link(env, cit)
    assert r.status_code == 200, r.text
    assert r.json()["registered"] is True and r.json()["last4"] == "0001"
    body = env.get(f"{P}/me/lands", headers=cit).json()
    assert {x["land_id"] for x in body["current"]} == RAHIM_CURRENT
    assert {x["land_id"] for x in body["past"]} == RAHIM_PAST
    assert body["total_current"] == 4 and body["total_area_decimal"] == 40.0
    assert all(x["until"] for x in body["past"]) and not any(x["until"] for x in body["current"])
    assert RAHIM["nid"] not in r.text + str(body) and "nid_hash" not in str(body)
    assert len(_audit(env, "NID_LINK")) == 1 and len(_audit(env, "MY_LANDS_VIEW")) == 1


def test_old_13_digit_number_links_the_same_card(env):
    r = _link(env, _h(env, "CITIZEN"), {"nid": "9990000000001", "date_of_birth": "1975-03-12"})
    assert r.status_code == 200 and r.json()["last4"] == "0001"


@pytest.mark.parametrize(
    "body",
    [
        {"nid": RAHIM["nid"], "date_of_birth": "1975-03-13"},  # right NID, wrong birthday
        {"nid": "19759990000009999", "date_of_birth": "1975-03-12"},  # nobody's NID
    ],
)
def test_wrong_pair_gets_one_answer_and_is_audited(env, body):
    cit = _h(env, "CITIZEN")
    r = _link(env, cit, body)
    assert r.status_code == 422 and r.json()["code"] == "NID_NOT_MATCHED"
    assert env.get(f"{P}/me/nid", headers=cit).json()["registered"] is False
    rows = _audit(env, "NID_LINK_FAILED")
    assert len(rows) == 1 and body["nid"] not in str(rows[0].new_value)


def test_invalid_format_is_422(env):
    r = _link(env, _h(env, "CITIZEN"), {"nid": "12345", "date_of_birth": "1975-03-12"})
    assert r.status_code == 422 and r.json()["code"] == "INVALID_NID"


def test_one_nid_one_account(env):
    assert _link(env, _h(env, "CITIZEN")).status_code == 200
    r = _link(env, _citizen(env))
    assert r.status_code == 409 and r.json()["code"] == "NID_IN_USE"


def test_another_citizen_cannot_see_my_land(env):
    assert _link(env, _h(env, "CITIZEN")).status_code == 200
    other = _citizen(env)
    # no route takes an NID: a query parameter is ignored and the other profile stays empty
    body = env.get(f"{P}/me/lands", params={"nid": RAHIM["nid"]}, headers=other).json()
    assert body["nid"]["registered"] is False and body["current"] == []


def test_relink_needs_unlink_first(env):
    cit = _h(env, "CITIZEN")
    assert _link(env, cit).status_code == 200
    r = _link(env, cit, {"nid": "19809990000000002", "date_of_birth": "1980-07-01"})
    assert r.status_code == 409 and r.json()["code"] == "NID_ALREADY_REGISTERED"
    assert env.delete(f"{P}/me/nid", headers=cit).status_code == 204
    assert env.get(f"{P}/me/lands", headers=cit).json()["current"] == []
    assert env.delete(f"{P}/me/nid", headers=cit).status_code == 404


def test_guessing_is_rate_limited(env):
    cit = _h(env, "CITIZEN")
    for day in range(1, 6):
        assert _link(env, cit, {**RAHIM, "date_of_birth": f"1975-01-0{day}"}).status_code == 422
    assert _link(env, cit).status_code == 429  # even the right pair, once the budget is spent


@pytest.mark.parametrize("role", ["REVIEWER", "OFFICER", "ADMIN"])
def test_staff_have_no_my_lands(env, role):
    h = _h(env, role)
    assert env.get(f"{P}/me/lands", headers=h).status_code == 403
    assert _link(env, h).status_code == 403


# ---- office: NID entered at upload / review, required to approve ----------------------------
@pytest.fixture
def strict(env):
    env.app.state.settings.owner_nid_required = True
    return env


def _upload(env, **form) -> str:
    r = _up(env, "scan.png", png() + b"LSMOCK:Doc1", **form)
    assert r.status_code == 201, r.text
    assert _process(env, r.json()["id"]).status_code == 202
    return r.json()["id"]


def test_upload_rejects_half_a_pair(strict, store):
    r = _up(strict, "scan.png", png() + b"x", buyer_nid=BUYER["nid"])
    assert r.status_code == 422 and r.json()["code"] == "NID_DOB_REQUIRED"
    r = _up(strict, "scan.png", png() + b"x", buyer_nid="123", buyer_dob="1985-05-05")
    assert r.status_code == 422 and r.json()["code"] == "INVALID_NID"


def test_approval_needs_buyer_nid_then_citizen_sees_the_land(strict, jobs):
    doc = _upload(strict)
    _fill(strict, doc)
    r = _post(strict, doc, "approve")
    assert r.status_code == 422 and r.json()["code"] == "OWNER_NID_REQUIRED"

    rev = _h(strict, "REVIEWER")
    saved = strict.patch(f"{P}/documents/{doc}/party-nids", json={"buyer": BUYER}, headers=rev)
    assert saved.status_code == 200 and saved.json()["party_nids"] == {"buyer": "0077"}
    assert BUYER["nid"] not in saved.text
    r = _post(strict, doc, "approve")
    assert r.status_code == 200, r.text
    land = r.json()["land_id"]

    with _db(strict) as s:
        buyer = s.scalars(select(Owner).where(Owner.nid_hash.is_not(None))).all()
    key = nid_key(BUYER["nid"], date(1985, 5, 5))
    assert any(o.nid_hash == key.nid_hash and o.dob_hash == key.dob_hash for o in buyer)

    cit = _h(strict, "CITIZEN")
    assert _link(strict, cit, BUYER).status_code == 200
    body = strict.get(f"{P}/me/lands", headers=cit).json()
    assert land in {x["land_id"] for x in body["current"]}


def test_upload_form_nid_is_used_and_same_nid_twice_is_refused(strict, jobs):
    r = _up(strict, "scan.png", png() + b"y", buyer_nid=BUYER["nid"],
            buyer_dob=BUYER["date_of_birth"], seller_nid=BUYER["nid"],
            seller_dob=BUYER["date_of_birth"])  # fmt: skip
    assert r.status_code == 422 and r.json()["code"] == "SAME_PARTY_NID"
    doc = _upload(strict, buyer_nid=BUYER["nid"], buyer_dob=BUYER["date_of_birth"])
    _fill(strict, doc)
    assert _post(strict, doc, "approve").status_code == 200


def test_nid_on_record_with_other_birthday_blocks_approval(strict, jobs):
    # Karim's NID typed with the wrong date of birth: stop, do not hand the land to anyone
    doc = _upload(strict, buyer_nid=KARIM["nid"], buyer_dob="1980-07-02")
    _fill(strict, doc)
    r = _post(strict, doc, "approve")
    assert r.status_code == 409 and r.json()["code"] == "NID_DOB_CONFLICT"


def _rename_buyer(env, doc, name):
    from tests.test_extraction import _patch

    assert _patch(env, doc, {"buyer": name}).status_code == 200


def test_buyer_nid_matches_existing_owner_despite_spelling(strict, jobs):
    doc = _upload(strict, buyer_nid=KARIM["nid"], buyer_dob=KARIM["date_of_birth"])
    _fill(strict, doc)
    _rename_buyer(strict, doc, "Md. Karim Miah")  # a spelling variant of the owner on record
    r = _post(strict, doc, "approve")
    assert r.status_code == 200, r.text
    land = r.json()["land_id"]
    with _db(strict) as s:
        assert s.scalar(select(Owner).where(Owner.name == "Md. Karim Miah")) is None  # no new owner
    cit = _h(strict, "CITIZEN")
    assert _link(strict, cit, KARIM).status_code == 200
    body = strict.get(f"{P}/me/lands", headers=cit).json()
    assert land in {x["land_id"] for x in body["current"]}


def test_nid_of_someone_else_entirely_blocks_approval(strict, jobs):
    hasan = {"buyer_nid": "19689990000000003", "buyer_dob": "1968-11-23"}  # deed buyer is Karim
    doc = _upload(strict, **hasan)
    _fill(strict, doc)
    r = _post(strict, doc, "approve")
    assert r.status_code == 409 and r.json()["code"] == "NID_NAME_MISMATCH"
    assert r.json()["details"] == {"party": "buyer"}


def test_citizen_cannot_set_party_nids(strict, jobs):
    doc = _upload(strict)
    r = strict.patch(f"{P}/documents/{doc}/party-nids", json={"buyer": BUYER},
                   headers=_h(strict, "CITIZEN"))  # fmt: skip
    assert r.status_code == 403
