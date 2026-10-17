#!/bin/bash
# U4.1: rebuild the /guide pictures and videos (frontend/public/guide/, frontend/features/guide/media.json).
# Starts its own fresh seeded backend (:8011) and a production build of the frontend (:3051), records every guide
# with scripts/record_guides.cjs, then stops both. Re-run after a UI change on any guided page.
#
# Needs: the backend venv (PYTHON=… if it is not backend/.venv), ffmpeg, cwebp, Google Chrome, and macOS `say`
# with the Bangla voice "Piya" (System Settings → Accessibility → Spoken Content → System voice → Manage voices).
#   scripts/guide_media.sh            # everything
#   scripts/guide_media.sh track map  # only these guides
#   scripts/guide_media.sh --serve    # just start both servers (to try a flow by hand), Ctrl-C stops them
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${PYTHON:-$ROOT/backend/.venv/bin/python}"
API_PORT="${GUIDE_API_PORT:-8011}"
WEB_PORT="${GUIDE_WEB_PORT:-3051}"
WORK="$(mktemp -d -t ls-guide-media)"
export DEMO_PASSWORD="${DEMO_PASSWORD:-LandShield2026!}"

for tool in ffmpeg ffprobe cwebp say; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 2; }; done
say -v '?' | grep -q '^Piya ' || { echo "the Bangla voice 'Piya' is not installed" >&2; exit 2; }

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "backend: fresh seeded database in $WORK"
(
  cd "$ROOT/backend"
  unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN
  export DATABASE_URL="sqlite:///$WORK/guide.db" STORAGE_PATH="$WORK/storage"
  export APP_ENV=dev COOKIE_SECURE=false CORS_ORIGINS="http://localhost:$WEB_PORT"
  export OCR_PROVIDER=auto DOCUMENT_AI_PROVIDER=rules DEMO_FIXTURES=on
  export AUTH_RATE_LIMIT_PER_MIN=1000 PUBLIC_RATE_LIMIT_PER_MIN=1000 UPLOAD_RATE_LIMIT_PER_HOUR=1000
  export PYTHONPATH=..
  "$PY" -m alembic upgrade head >/dev/null
  "$PY" ../scripts/seed.py >/dev/null
  exec "$PY" -m uvicorn app.main:app --host localhost --port "$API_PORT"
) >"$WORK/backend.log" 2>&1 &
API_PID=$!

echo "frontend: production build (no dev overlay in the pictures)"
cd "$ROOT/frontend"
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api/v1"
npx next build >"$WORK/build.log" 2>&1 || { tail -40 "$WORK/build.log" >&2; exit 1; }
npx next start -p "$WEB_PORT" >"$WORK/web.log" 2>&1 &
WEB_PID=$!

for url in "http://localhost:$API_PORT/api/v1/health" "http://localhost:$WEB_PORT/bn"; do
  for _ in $(seq 1 120); do curl -fs -o /dev/null "$url" && break; sleep 1; done
  curl -fs -o /dev/null "$url" || { echo "not up: $url" >&2; tail -20 "$WORK/backend.log" >&2; exit 1; }
done

if [ "${1:-}" = "--serve" ]; then echo "serving http://localhost:$WEB_PORT (Ctrl-C stops)"; wait "$WEB_PID"; exit 0; fi

WEB="http://localhost:$WEB_PORT" API="$NEXT_PUBLIC_API_URL" node "$ROOT/scripts/record_guides.cjs" "$@"
