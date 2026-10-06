#!/bin/bash
# LandShield BD — one-command local start (backend :8001, frontend :3000)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8001
export DEMO_PASSWORD="${DEMO_PASSWORD:-LandShield2026!}"

cd "$ROOT/backend" || exit 1
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
python -c "import fastapi" 2>/dev/null || pip install -e ".[dev]"
[ -f .env ] || cp ../.env.example .env

FIRST_RUN=0
[ -f landshield.db ] || FIRST_RUN=1
alembic upgrade head
[ "$FIRST_RUN" = 1 ] && PYTHONPATH=.. python ../scripts/seed.py

PYTHONPATH=.. uvicorn app.main:app --reload --host localhost --port $PORT &
BACK=$!

cd "$ROOT/frontend" || exit 1
[ -d node_modules ] || npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:$PORT/api/v1" > .env.local
npm run dev &
FRONT=$!

trap 'kill $BACK $FRONT 2>/dev/null; exit 0' INT TERM EXIT
sleep 6
open "http://localhost:3000/en/login" 2>/dev/null
echo "Running. Login: officer@demo.landshield.test / $DEMO_PASSWORD. Ctrl+C to stop."
wait
