#!/bin/bash
# LandShield BD — reset demo state: wipe DB rows, re-seed, clear uploads. Offline. Run with servers stopped or running.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEMO_PASSWORD="${DEMO_PASSWORD:-demo1234}"

cd "$ROOT/backend"
[ -d .venv ] && source .venv/bin/activate
[ -f .env ] || cp ../.env.example .env

STORAGE="${STORAGE_PATH:-./storage}"
case "$STORAGE" in /|""|.|..) echo "refusing to clear STORAGE_PATH='$STORAGE'" >&2; exit 2;; esac

alembic upgrade head
PYTHONPATH=.. python ../scripts/seed.py --reset

if [ -d "$STORAGE" ]; then
  find "$STORAGE" -mindepth 1 -delete
fi
mkdir -p "$STORAGE"

echo "Demo reset done. LP-10234 has no transactions; Doc1/Doc2: database/sample_data/. Login: officer@demo.landshield.test / $DEMO_PASSWORD"
