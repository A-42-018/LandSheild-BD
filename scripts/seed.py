#!/usr/bin/env python
"""Seed the demo dataset. Usage: python scripts/seed.py [--reset]

Requires DATABASE_URL (default sqlite) migrated via `alembic upgrade head`, and DEMO_PASSWORD.
Demo Dataset — Not an Official Government Land Record.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "database" / "seed"))

from loader import seed  # noqa: E402
from sqlalchemy import inspect  # noqa: E402

from app.core.db import get_engine, get_sessionmaker  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reset", action="store_true", help="delete all rows first")
    args = ap.parse_args()
    if "users" not in inspect(get_engine()).get_table_names():
        print("Tables missing: run `cd backend && alembic upgrade head` first.", file=sys.stderr)
        return 2
    try:
        with get_sessionmaker()() as db:
            result = seed(db, do_reset=args.reset)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"seed ok: {result['created']} rows created (reset={args.reset})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
