#!/usr/bin/env python
"""Tamper demo (F4c): edit ONE transaction directly in SQLite, bypassing the app.

Usage: python scripts/tamper_demo.py [--land LP-10100] [--restore]
Then open Admin -> Ledger integrity -> Verify (BROKEN at the entry's seq) and re-check the
parcel (RECORD_INTEGRITY_FAILED, HIGH). --restore puts the original area back.
Demo Dataset — Not an Official Government Land Record.
"""
import argparse
import os
import sqlite3
import sys

STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tamper_demo.json")


def _path(url: str) -> str | None:
    return url.split("sqlite:///", 1)[1] if url.startswith("sqlite:///") else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--land", default="LP-10100", help="land code whose first transaction is edited")
    ap.add_argument("--restore", action="store_true", help="undo the last tamper")
    args = ap.parse_args()
    path = _path(os.environ.get("DATABASE_URL", "sqlite:///./landshield.db"))
    if path is None or not os.path.isfile(path):
        print("error: SQLite database file not found (set DATABASE_URL=sqlite:///...)", file=sys.stderr)
        return 2
    con = sqlite3.connect(path)
    try:
        if args.restore:
            if not os.path.isfile(STATE):
                print("nothing to restore", file=sys.stderr)
                return 2
            import json

            tx_id, area = json.load(open(STATE))
            con.execute("UPDATE transactions SET area = ? WHERE id = ?", (area, tx_id))
            con.commit()
            os.remove(STATE)
            print(f"restored transaction {tx_id} area={area}")
            return 0
        row = con.execute(
            "SELECT t.id, t.area FROM transactions t JOIN land_parcels l ON l.id = t.land_id "
            "WHERE l.land_id = ? ORDER BY t.transaction_date, t.id LIMIT 1", (args.land,),
        ).fetchone()
        if row is None:
            print(f"error: no transaction for {args.land}", file=sys.stderr)
            return 2
        tx_id, area = row
        if not os.path.isfile(STATE):
            import json

            json.dump([tx_id, area], open(STATE, "w"))
        con.execute("UPDATE transactions SET area = ? WHERE id = ?", (area + 5, tx_id))
        con.commit()
        print(f"tampered transaction {tx_id}: area {area} -> {area + 5} (no app, no audit row)")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    raise SystemExit(main())
