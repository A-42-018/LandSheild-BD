"""Q1: each seeded scenario parcel returns the level + score in the README "Demo dataset" table."""

from tests.test_lands import _h, env  # noqa: F401

README_TABLE = {
    "LP-10001": ("LOW", 0, set()),
    "LP-10100": ("LOW", 0, set()),
    "LP-10234": ("LOW", 0, set()),
    "LP-10240": ("HIGH", 70, {"POSSIBLE_DUPLICATE_TRANSACTION", "SELLER_MISMATCH"}),
    "LP-10300": ("LOW", 0, set()),
    "LP-10400": ("LOW", 0, set()),
    "LP-10500": ("MEDIUM", 30, {"DUPLICATE_DEED"}),
    "LP-10600": ("MEDIUM", 30, {"REGISTERED_NOT_MUTATED"}),
    "LP-10700": ("HIGH", 60, {"MUTATION_PARTY_MISMATCH"}),
    "LP-10800": ("MEDIUM", 30, {"ACTIVE_LITIGATION"}),
    "LP-10900": ("HIGH", 60, {"KHAS_LAND"}),
    "LP-11000": ("HIGH", 60, {"UNDER_ACQUISITION"}),
}


def test_every_scenario_matches_readme_table(env):  # noqa: F811
    h = _h(env, "CITIZEN")  # one login: the auth rate limit would trip on 12
    got = {}
    for land in README_TABLE:
        r = env.get(f"/api/v1/lands/{land}/risk", headers=h)
        assert r.status_code == 200, (land, r.text)
        b = r.json()
        codes = {e["code"] for e in b["evidence"] if e["code"] != "ML_ANOMALY"}
        got[land] = (b["risk_level"], b["rule_score"], codes)
    assert got == README_TABLE
