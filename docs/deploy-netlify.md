# Deploy: frontend on Netlify, backend elsewhere

**Netlify Drop cannot host this app.** Drop serves static files only; the frontend needs Next.js middleware
(language routing) and server-rendered pages, and the FastAPI backend (login, uploads, database) cannot run on Netlify.
A Drop upload of this folder gives the "Page not found" you saw because there is no `index.html` at its root.

## 1. Backend (Render, or any host that runs Python)
1. Push the repo to GitHub. Render > New > Blueprint > pick the repo (uses `render.yaml`).
2. Set `DEMO_PASSWORD` and `CORS_ORIGINS=https://<your-site>.netlify.app` in the Render dashboard.
3. Open `https://<service>.onrender.com/api/v1/health` - it must return OK.
The free plan sleeps when idle (first request ~30 s) and its disk is wiped on restart, so demo data is re-seeded each start.
`COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` are required: the site and the API are on different domains, otherwise
a page reload logs the user out.

## 2. Frontend (Netlify, from Git)
1. Netlify > Add new site > Import from Git > pick the repo.
2. Base directory `frontend` (it contains `netlify.toml`). Build command `npm run build` (auto-detected).
3. Environment variables (set BEFORE the first build, they are baked in):
   - `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com/api/v1`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-site>.netlify.app`
4. Deploy. Open `https://<your-site>.netlify.app/en`.

No Git? From `frontend/`: `npm i -g netlify-cli && netlify login && netlify deploy --build --prod` (set the env vars first
with `netlify env:set`).

## Checks done here / not done
- Done: `next build` compiles (Google Fonts mocked, sandbox is offline for fonts); backend tests for the new cookie setting.
- NOT done: a real deploy to Netlify or Render, login across the two domains, the `/en/map` page in a browser.

## Real OCR on Render (Docker)
`render.yaml` now builds the root `Dockerfile` (Tesseract + Bangla/English data, PDF support) instead of the plain Python runtime,
and runs `OCR_PROVIDER=tesseract` with `DOCUMENT_AI_PROVIDER=rules`. The build takes several minutes on first deploy.
- Tested here: real OCR + the new Saf-Kabala parser on a Bangla sale-deed PDF through the API (upload, process, review-required, 13/13 fields correct).
- NOT tested: the Docker build itself on Render (no Docker in the build sandbox), free-instance memory/time limits, or other deed layouts.
- The parser (`ai/extraction/saf_kabala.py`) is tuned on one real-layout sample; other layouts use the generic label rules and may extract little. Every document still needs human review.
- To go back to the demo-only mode (sample files only), set `OCR_PROVIDER=mock` in Render.
- Sample files for the demo mode are in `database/sample_data/` (Clean, Doc1, Doc2, SellerMismatch, AreaMismatch).
