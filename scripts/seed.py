#!/usr/bin/env python
"""Seed the demo dataset. Usage: python scripts/seed.py [--reset | --mode MODE]

Modes: add (default: create the demo rows that are missing, keep everything else), reset (delete
all rows first), if-empty (seed only a database without users), auto (reset on SQLite, which on
Render's free disk is wiped on every redeploy anyway; if-empty on any other database, so a
persistent Postgres keeps its real uploads and digital records across restarts; Docker CMD).

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
from sqlalchemy import func, inspect, select  # noqa: E402

from app.core.db import get_engine, get_sessionmaker  # noqa: E402
from app.models.user import User  # noqa: E402

MODES = ("add", "reset", "if-empty", "auto")


def resolve_mode(mode: str, dialect: str) -> str:
    if mode == "auto":
        return "reset" if dialect == "sqlite" else "if-empty"
    return mode


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reset", action="store_true", help="delete all rows first (= --mode reset)")
    ap.add_argument("--mode", choices=MODES, default="add")
    args = ap.parse_args(argv)
    engine = get_engine()
    if "users" not in inspect(engine).get_table_names():
        print("Tables missing: run `cd backend && alembic upgrade head` first.", file=sys.stderr)
        return 2
    mode = resolve_mode("reset" if args.reset else args.mode, engine.dialect.name)
    try:
        with get_sessionmaker()() as db:
            if mode == "if-empty" and db.scalar(select(func.count()).select_from(User)):
                print("seed skipped: the database already has users (mode if-empty)")
                return 0
            result = seed(db, do_reset=mode == "reset")
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"seed ok: {result['created']} rows created (mode={mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
