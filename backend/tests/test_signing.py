# ruff: noqa: F811
from datetime import date
from types import SimpleNamespace

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.config import Settings
from app.core.db import get_db
from app.models.deed import Deed
from app.services import signing
from tests.test_lands import ROLES, _h, env  # noqa: F401

B = "/api/v1/public"


def _deed(**over):
    land = SimpleNamespace(land_id="LP-10100", khatian_no="610", dag_no="210")
    base = dict(
        land=land, seller=SimpleNamespace(name="A  Seller"), buyer=SimpleNamespace(name="B Buyer"),
        deed_no="D-1", transaction_date=date(2024, 1, 2), area=5.0, area_unit="Decimal",
        document=SimpleNamespace(file_hash="f" * 64),
    )  # fmt: skip
    base.update(over)
    return SimpleNamespace(**base)


def test_hash_is_deterministic_and_normalised():
    a = signing.compute_hash(_deed())
    assert a == signing.compute_hash(_deed(seller=SimpleNamespace(name="A Seller")))
    assert len(a) == 64 and a == signing.compute_hash(_deed())


@pytest.mark.parametrize(
    "change",
    [{"deed_no": "D-2"}, {"area": 5.5}, {"buyer": SimpleNamespace(name="C")},
     {"document": SimpleNamespace(file_hash="e" * 64)}, {"transaction_date": None}],
)  # fmt: skip
def test_any_payload_change_changes_hash(change):
    assert signing.compute_hash(_deed(**change)) != signing.compute_hash(_deed())


def test_signature_valid_wrong_key_and_tampered_hash():
    key, other = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
    h = signing.compute_hash(_deed())
    sig = signing.sign_hash(h, key)
    assert signing.verify_hash(h, sig, key.public_key())
    assert not signing.verify_hash(h, sig, other.public_key())
    assert not signing.verify_hash("0" * 64, sig, key.public_key())
    assert not signing.verify_hash(h, "not-a-signature", key.public_key())


def test_key_file_persists_and_env_seed_wins(tmp_path):
    signing.clear_key_cache()
    s = Settings(_env_file=None, signing_key_path=str(tmp_path / "k.pem"))
    first = signing.key_info(s)
    signing.clear_key_cache()
    assert signing.key_info(s) == first and (tmp_path / "k.pem").is_file()
    seed = signing._b64(Ed25519PrivateKey.generate().private_bytes_raw())
    s2 = Settings(_env_file=None, signing_key=seed, signing_key_path=str(tmp_path / "k.pem"))
    assert signing.key_info(s2)["public_key"] != first["public_key"]
    signing.clear_key_cache()


def _session(env):
    return next(env.app.dependency_overrides[get_db]())


def test_seeded_deeds_signed_and_public_chip_states(env):
    seal = env.get(f"{B}/seal/LP-10100")
    assert seal.status_code == 200, seal.text
    d, h12 = seal.json()["deed_id"], seal.json()["hash12"]
    assert set(seal.json()) == {"deed_id", "hash12"} and len(h12) == 12
    assert env.get(f"{B}/signature", params={"d": d, "h": h12}).json() == {"state": "VALID"}
    assert env.get(f"{B}/signature", params={"d": d, "h": "0" * 12}).json()["state"] == "INVALID"
    assert env.get(f"{B}/signature", params={"d": "x", "h": h12}).json()["state"] == "NOT_FOUND"
    keys = env.get(f"{B}/keys").json()
    assert keys["algorithm"] == "Ed25519" and len(keys["key_id"]) == 12
    assert "private" not in str(keys).lower()


def test_tampered_deed_is_invalid(env):
    d, h12 = (env.get(f"{B}/seal/LP-10100").json()[k] for k in ("deed_id", "hash12"))
    with _session(env) as db:
        db.get(Deed, d).area = 999.0
        db.commit()
    assert env.get(f"{B}/signature", params={"d": d, "h": h12}).json()["state"] == "INVALID"


def test_unsigned_deed_reported(env):
    d, h12 = (env.get(f"{B}/seal/LP-10100").json()[k] for k in ("deed_id", "hash12"))
    with _session(env) as db:
        row = db.get(Deed, d)
        row.record_hash = row.signature = None
        db.commit()
    assert env.get(f"{B}/signature", params={"d": d, "h": h12}).json()["state"] == "UNSIGNED"
    assert env.get(f"{B}/seal/LP-99999").status_code == 404
