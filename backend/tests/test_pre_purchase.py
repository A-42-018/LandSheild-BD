import pytest

from tests.test_lands import _h, env  # noqa: F401

P = "/api/v1/lands"


def _check(env, land, seller=None, role="CITIZEN"):  # noqa: F811
    q = f"?seller={seller}" if seller else ""
    r = env.get(f"{P}/{land}/pre-purchase-check{q}", headers=_h(env, role))
    assert r.status_code == 200, r.text
    body = r.json()
    return body, {row["code"]: row for row in body["rows"]}


def test_six_rows_in_order(env):  # noqa: F811
    body, rows = _check(env, "LP-10001")
    assert [r["code"] for r in body["rows"]] == [
        "SELLER_MATCHES_OWNER",
        "MUTATION_UP_TO_DATE",
        "NO_PENDING_CASE",
        "NOT_KHAS_OR_ACQUIRED",
        "NO_OPEN_RISK_INDICATORS",
        "DOCUMENT_AUTHENTIC",
    ]
    assert rows["DOCUMENT_AUTHENTIC"]["status"] == "UNKNOWN"


def test_clean_land_all_pass_with_matching_seller(env):  # noqa: F811
    body, rows = _check(env, "LP-10001", seller="Jamal Hossain")
    statuses = {c: r["status"] for c, r in rows.items() if c != "DOCUMENT_AUTHENTIC"}
    assert set(statuses.values()) == {"PASS"}, statuses
    assert body["verdict"] == "NO_INDICATORS"


def test_seller_omitted_is_unknown_and_wrong_seller_fails(env):  # noqa: F811
    _, rows = _check(env, "LP-10001")
    assert rows["SELLER_MATCHES_OWNER"]["status"] == "UNKNOWN"
    body, rows = _check(env, "LP-10001", seller="Totally Different")
    assert rows["SELLER_MATCHES_OWNER"]["status"] == "FAIL"
    assert body["verdict"] == "INDICATORS_FOUND"


def test_khas_land_fails(env):  # noqa: F811
    body, rows = _check(env, "LP-10900")
    assert rows["NOT_KHAS_OR_ACQUIRED"]["status"] == "FAIL"
    assert rows["NOT_KHAS_OR_ACQUIRED"]["detail"]["khas"] == 1
    assert body["verdict"] == "INDICATORS_FOUND"


def test_case_and_acquisition_fail(env):  # noqa: F811
    _, rows = _check(env, "LP-10800")
    assert rows["NO_PENDING_CASE"]["status"] == "FAIL"
    _, rows = _check(env, "LP-11000")
    assert rows["NOT_KHAS_OR_ACQUIRED"]["status"] == "FAIL"


def test_double_sale_land_has_open_indicators(env):  # noqa: F811
    _, rows = _check(env, "LP-10240")
    assert rows["NO_OPEN_RISK_INDICATORS"]["status"] == "FAIL"


@pytest.mark.parametrize("role", ["CITIZEN", "REVIEWER", "OFFICER", "ADMIN"])
def test_no_owner_name_or_ids_in_payload(env, role):  # noqa: F811
    r = env.get(f"{P}/LP-10001/pre-purchase-check?seller=Jamal%20Hossain", headers=_h(env, role))
    text = r.text
    assert "Jamal" not in text and "Sirajul" not in text and "Hossain" not in text


def test_not_found_and_auth(env):  # noqa: F811
    assert env.get(f"{P}/LP-NOPE/pre-purchase-check", headers=_h(env, "CITIZEN")).status_code == 404
    assert env.get(f"{P}/LP-10001/pre-purchase-check").status_code == 401
    long = "x" * 121
    r = env.get(f"{P}/LP-10001/pre-purchase-check?seller={long}", headers=_h(env, "CITIZEN"))
    assert r.status_code == 422


def test_public_counts_include_encumbrance_and_mutation(env):  # noqa: F811
    c = env.get("/api/v1/public/verify/LP-10900").json()["counts"]
    assert c["active_encumbrances"] == 1 and c["pending_mutations"] >= 0
    assert env.get("/api/v1/public/verify/LP-10001").json()["counts"]["active_encumbrances"] == 0
