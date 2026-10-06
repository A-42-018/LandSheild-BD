#!/bin/bash
# E2E backend: isolated SQLite file, seeded, mock providers. Run from frontend/ (Playwright webServer).
set -e
cd "$(dirname "${BASH_SOURCE[0]}")/../../backend"
[ -f .venv/bin/activate ] && source .venv/bin/activate
rm -f e2e.db
rm -rf e2e-storage
export DATABASE_URL="sqlite:///./e2e.db"
export STORAGE_PATH="./e2e-storage"
export APP_ENV=dev COOKIE_SECURE=false
export CORS_ORIGINS="http://localhost:3000"
export OCR_PROVIDER=mock DOCUMENT_AI_PROVIDER=mock ML_SCORING=on
export DEMO_PASSWORD="${DEMO_PASSWORD:-LandShield2026!}"
export AUTH_RATE_LIMIT_PER_MIN=1000 PUBLIC_RATE_LIMIT_PER_MIN=1000 UPLOAD_RATE_LIMIT_PER_HOUR=1000
export PYTHONPATH=..
alembic upgrade head
python ../scripts/seed.py
exec uvicorn app.main:app --host localhost --port 8001
