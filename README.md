# LandShield BD

Digital Land Verification & Risk Intelligence · ডিজিটাল ভূমি যাচাই ও ঝুঁকি বিশ্লেষণ

> **Demo Dataset — Not an Official Government Land Record.**
> ডেমো ডেটাসেট — সরকারি ভূমি রেকর্ড নয়।

> LandShield provides digital record organization, consistency checks, and risk indicators. It does not establish legal ownership, certify title, or replace official government/legal verification.
>
> ল্যান্ডশিল্ড ডিজিটাল রেকর্ড সংগঠন, সামঞ্জস্য যাচাই ও ঝুঁকি-নির্দেশক প্রদান করে। এটি আইনগত মালিকানা প্রতিষ্ঠা করে না, স্বত্ব প্রত্যয়ন করে না, এবং সরকারি/আইনগত যাচাইয়ের বিকল্প নয়।

**Live demo:**(https://landshield-bd.vercel.app/en) · **Team:** DEEDGUARD (Alif Mahmud, Ayesha Hamid Mithila) · **Concept note:** [docs/LandShield-BD-Concept-Note.pdf](docs/LandShield-BD-Concept-Note.pdf)

## Overview

LandShield BD is a demo of a land-record verification workflow for Bangladesh. Officers upload deed images, OCR and field extraction run, a human reviews and approves, and the approved data feeds an explainable rule-based risk engine (double-sale, seller mismatch, duplicate deed, area mismatch, and more). Citizens search a parcel and get a bilingual (EN/BN) report with a QR code whose public page exposes no personal data.

All data is **synthetic**. Nothing here is an official record or a government system.

## Problem statement (LandTech 2026 · P3)

**Track:** Digital Land Records, Verification & Digitization · **Chosen problem: P3 — Fraud & Double-Selling**, with P1, P2, P4 and P5 as supporting modules.

| P3 scenario | Where it lives |
|---|---|
| Same plot sold twice | Double-sale rule (Doc1 → Doc2 = HIGH 70) |
| Rapid transfers | Rapid-transfer indicator in the risk engine |
| Registration ↔ mutation mismatch | Planned (roadmap F1a–F1c) |
| Forged / copied documents | Duplicate-deed, deed-number format, impossible-date and rapid-resale rules; record hash + Ed25519 signature + signed QR; verify-a-copy; hash-chained ledger |

Phase status: `plan.md`. Requirement audit and phase cards: `roadmap.md`.

## Problem

Land fraud (one parcel sold twice, a seller who is not the recorded owner, copied deeds, altered areas) is hard to spot when records are paper, scattered, and checked by hand.

## Solution

Structure the records, cross-check them automatically, and show every risk indicator with its evidence so a human can decide. Risk output is wording-safe: "possible", "indicator", never "fraud confirmed".

## Features

- Parcel search and verification (district, upazila, mouza, khatian, dag) with ownership history and transactions
- Risk score 0-100 (LOW / MEDIUM / HIGH) with a per-rule evidence list
- Document upload → OCR → field extraction with per-field confidence → human review → approve / reject → posting to ownership history
- Possible double-sale detection, ownership graph (React Flow), parcel map (Leaflet, polygons are synthetic)
- Bilingual report page (A4 print stylesheet), QR public verification page (counts incl. open cases and pending mutations)
- Khatian / porcha parser (CS, SA, RS, BS survey type, owners with shares, dag list) with two Bangla synthetic specimens; nothing guessed, several owners/dags stay as lists for the reviewer
- Archive search (`/officer/archive`, reviewer+): full-text search (SQLite FTS5) over approved documents, filter by survey and district; rule `SURVEY_CHAIN_GAP` flags later-survey owners with no recorded link to earlier-survey holders
- Forged-document plausibility rules: `DEED_NO_FORMAT_INVALID`, `IMPOSSIBLE_DATE`, `RAPID_RESALE` (wording always "possible")
- Public mutation tracker (`/track`): enter a mutation number, see Applied → Review → Hearing → Decided with dates and office, no sign-in, no personal data
- Officer dashboard, review queue, risk alerts, audit log; RBAC with four roles
- EN + BN UI (next-intl)

## Changes since Round 1

Work added after the Round 1 snapshot (the concept note, demo video and live link describe the earlier build):

- **F5b Bangla OCR measured.** `ai/evaluation/run_eval.py` now also reports Bangla specimen CER, parsed khatian fields and review rate (clean / noisy / skewed, preprocessing off and on). Result with Tesseract `ben+eng`: mean CER ≈ 17 %, parsed fields 77 % (off) / 90 % (on), every Bangla specimen still needs review. Setup: [docs/ocr-setup.md](docs/ocr-setup.md).
- **F5c Archive search.** `GET /archive/search` + officer page `/officer/archive` (reviewer and above); rule `SURVEY_CHAIN_GAP` (15, MEDIUM) for later-survey owners with no recorded link to earlier-survey holders.
- **Citizen tools** (`/tools`): land unit converter, registration/mutation fee estimator (illustrative rates), inheritance share calculator (faraid); public, client-side, EN + BN.
- **F6 Forged-document plausibility rules.** `DEED_NO_FORMAT_INVALID` (15), `IMPOSSIBLE_DATE` (30, HIGH), `RAPID_RESALE` (15); EN + BN evidence text, also added for the four encumbrance codes that had none.
- Judge feedback and any fixes after selection: _to be added here._

## Architecture

Next.js frontend → FastAPI backend (`/api/v1`) → SQLAlchemy (SQLite by default) · `ai/` package for preprocessing, OCR, extraction and the anomaly model. Diagrams: [docs/architecture.md](docs/architecture.md).

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind, next-intl, TanStack Query, React Hook Form, Leaflet, React Flow, qrcode.react, Vitest |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, PyJWT, rapidfuzz, pytest, ruff |
| AI (optional) | Tesseract + pytesseract, OpenCV, PyMuPDF, scikit-learn (Isolation Forest), Pillow |
| Database | SQLite (demo). Postgres is planned (P57), not done |

## AI pipeline

Upload → preprocessing → OCR → field extraction → confidence check → human review → rules + optional ML hint. Details and measured results: [docs/ai-pipeline.md](docs/ai-pipeline.md), [docs/ocr-accuracy.md](docs/ocr-accuracy.md); OCR install: [docs/ocr-setup.md](docs/ocr-setup.md).

### How OCR works

The site works fully with **no API key**: Tesseract + rules is the default path.

1. **Source** (`OCR_PROVIDER=auto`): the saved demo sample files (matched by exact SHA-256 only) return their stored result and are always labelled **"Demo sample"**; a PDF with an embedded text layer is read directly (**"PDF text"**); anything else goes to **Tesseract** (Bangla + English, OpenCV clean-up, upscaling of small images, two page-segmentation modes, per-page timeout, first `OCR_MAX_PAGES` pages). If Tesseract is not installed the job ends `FAILED` with `OCR_UNAVAILABLE`; there is never a silent mock.
2. **Extractor**: rule-based label patterns (EN + BN; unknown → empty, never guessed). Optionally **Claude** (`ANTHROPIC_API_KEY`): one call per file, temperature 0, one tool with the 13 fields; the answer is format-checked and cross-checked against the Tesseract text (a value not found in the text loses 40 % confidence). Any failure (no key, timeout, API error, daily cap) falls back to the rules. Results are cached per file hash + model.
3. **Review**: every result records its source (`demo` / `pdf-text` / `tesseract`), extractor (`rules` / `claude`) and per-field confidence; the review page shows them as badges. Fields below `REVIEW_CONF_THRESHOLD` (0.85) always go to the human reviewer.

Measured accuracy (Tesseract + rules, 20 synthetic deeds, demo fixtures off): see [docs/ocr-accuracy.md](docs/ocr-accuracy.md) — **85.4 %** of 240 field values exact on 20 synthetic deeds (73.3 % without preprocessing; 60.0 % before the O track); Bangla specimens CER 21.6 %, parsed khatian fields 90 %. Claude accuracy is not measured. Synthetic data only; real scans will score lower.

## Database

Tables: `users`, `owners`, `land_parcels`, `deeds`, `transactions`, `ownership_history`, `documents`, `verification_requests`, `risk_assessments`, `fraud_alerts`, `audit_logs`. Migrations: `backend/migrations` (Alembic, 8 revisions). Seed data: `database/seed/` (7 parcels, 4 users).

## Setup

Requirements: Python 3.11+, Node 18+ and npm. No network is needed after dependencies are installed, except `next build` (Google Fonts).

**One command (macOS/Linux, bash):**

```bash
./start.sh
```

It creates `backend/.venv`, installs the backend, copies `.env.example` to `backend/.env`, runs migrations, seeds the database on first run, starts the API on **:8001** and the frontend on **:3000**. Open http://localhost:3000/en/login.

**Manual:**

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"            # add ,ai extras for OCR/ML: pip install -e ".[dev,ai]"
cp ../.env.example .env            # set JWT_SECRET (any 32+ chars) and DEMO_PASSWORD
alembic upgrade head
DEMO_PASSWORD=LandShield2026! PYTHONPATH=.. python ../scripts/seed.py     # add --reset to rebuild
PYTHONPATH=.. uvicorn app.main:app --reload --port 8001

# frontend (second terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api/v1" > .env.local
npm run dev                         # http://localhost:3000/en  and  /bn
```

API docs (dev only): http://127.0.0.1:8001/docs

## Environment variables

Defined in `.env.example` (copy to `backend/.env`).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./landshield.db` | SQLAlchemy URL |
| `JWT_SECRET` | empty | Token signing key; required, 32+ chars when `APP_ENV` is not `dev` |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | 15 / 7 | Token lifetimes |
| `APP_ENV` | `dev` | Anything else enables production start-up checks |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins (https only outside dev) |
| `AUTH_RATE_LIMIT_PER_MIN` | 10 | Login/register per IP |
| `PUBLIC_RATE_LIMIT_PER_MIN` | 60 | Public QR endpoint per IP |
| `UPLOAD_RATE_LIMIT_PER_HOUR` | 20 | Uploads per user |
| `STORAGE_PATH` | `./storage` | Uploaded files |
| `OCR_PROVIDER` | `auto` | `auto` = demo fixture → PDF text → Tesseract; `tesseract`; `mock` (tests only). No silent mock: no Tesseract → `OCR_UNAVAILABLE` (503). `paddle` not implemented |
| `DEMO_FIXTURES` | `on` | `on` = the saved demo samples (exact SHA-256) return their stored result, labelled "Demo sample"; `off` = real OCR on them too |
| `DOCUMENT_AI_PROVIDER` | `auto` | `auto` = Claude if `ANTHROPIC_API_KEY` is set, else rules; `rules`; `claude` (falls back to rules on any failure); `mock` (tests); `vlm`, `remote` not implemented (503) |
| `ANTHROPIC_API_KEY` | empty | Empty = Claude disabled. Never logged, never sent to the frontend |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | Switch to `claude-sonnet-5-5` if accuracy is weak |
| `CLAUDE_DAILY_CAP` / `CLAUDE_TIMEOUT_S` | 100 / 30 | Calls per day (over the cap → rules) / seconds per call (timeout → rules) |
| `OCR_TIMEOUT_S` / `OCR_MAX_PAGES` | 30 / 5 | Tesseract seconds per page (`OCR_TIMEOUT` 504) / PDF pages read (rest dropped, warning `PAGES_TRUNCATED`) |
| `REVIEW_CONF_THRESHOLD` | 0.85 | Fields below this need review |
| `PREPROCESS` | `on` | OpenCV clean-up before Tesseract |
| `ML_SCORING` / `ML_MODEL_PATH` | `on` / empty | Isolation Forest hint (skipped silently if unavailable) |
| `TESSERACT_LANG` | `ben+eng` | Missing languages are dropped with a warning |
| `DEMO_PASSWORD` | empty | Password for seeded demo users |
| `HASH_SALT` | empty | Salt for stored hashes; set a real value outside dev |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Frontend API base (`start.sh` sets :8001) |
| `NEXT_PUBLIC_MAP_TILE_URL` | empty | Optional map tiles; empty = offline blank background |

## Demo accounts

Password is the value of `DEMO_PASSWORD` (`start.sh` uses `LandShield2026!`).

| Role | E-mail | Can do |
|---|---|---|
| Citizen | `citizen@demo.landshield.test` | Search, verify, reports |
| Reviewer | `reviewer@demo.landshield.test` | + review/approve extractions, alerts, dashboard |
| Officer | `officer@demo.landshield.test` | + upload documents, audit logs |
| Admin | `admin@demo.landshield.test` | everything |

## Demo dataset

Levels below are what a fresh seed returns from `GET /lands/{id}/risk` (rules only; the optional ML score adds 0–15 and never changes these levels). Re-checked in phase Q1.

| Parcel | Scenario | Expected level (score) | Evidence |
|---|---|---|---|
| LP-10001 | CLEAN | LOW (0) | — |
| LP-10100 | NORMAL_CHAIN | LOW (0) | — |
| LP-10234 | LIVE_DEMO (upload target) | LOW (0) → HIGH (70) after Doc1 + Doc2 are approved | SELLER_MISMATCH, POSSIBLE_DUPLICATE_TRANSACTION |
| LP-10240 | DOUBLE_SALE | HIGH (70) | POSSIBLE_DUPLICATE_TRANSACTION, SELLER_MISMATCH |
| LP-10300 | AREA_MISMATCH | LOW (0) until `AreaMismatch.png` is uploaded + approved | — |
| LP-10400 | SELLER_MISMATCH | LOW (0) until `SellerMismatch.png` is uploaded + approved | — |
| LP-10500 | DUPLICATE_DEED | MEDIUM (30) | DUPLICATE_DEED |
| LP-10600 | UNMUTATED_SALE | MEDIUM (30) | REGISTERED_NOT_MUTATED |
| LP-10700 | MUTATION_OTHER_PERSON | HIGH (60) | MUTATION_PARTY_MISMATCH |
| LP-10800 | ACTIVE_CASE | MEDIUM (30) | ACTIVE_LITIGATION |
| LP-10900 | KHAS_LAND | HIGH (60) | KHAS_LAND |
| LP-11000 | ACQUISITION | HIGH (60) | UNDER_ACQUISITION |

Sample documents: `database/sample_data/` (Doc1, Doc2, Clean, AreaMismatch, SellerMismatch). Regenerate with `python ai/evaluation/make_synthetic.py`.

## Testing

```bash
cd backend && pytest -q && ruff check .      # last full run (Q1): 558 passed, 13 skipped, ruff clean
cd frontend && npm test && npx tsc --noEmit && npm run check:i18n   # 350 passed, 827 i18n keys
cd frontend && npm run e2e:install && npm run e2e   # Playwright (Q2): 20 passed — starts its own seeded backend on :8001
```

Not covered by automated runs: `next build`, a live deploy walk, Postgres, Chromium PDF export. See [Limitations](#limitations).

## Security

Short list: JWT (access in memory, refresh in an HttpOnly cookie), role read from the database, RBAC matrix test, rate limits, upload validation, security headers, log redaction, audit trail, no personal data on the public QR page. Full notes and open items: [docs/security.md](docs/security.md).

### Bangladesh map
`/map` (**Parcel map**) shows all of Bangladesh (street basemap + division/district/upazila boundaries) and is map viewing only: a Division → District → Upazila menu and place search. There is no mouza list or scanned-map download (see Data sources). Boundary data, licences and API: [docs/gis.md](docs/gis.md).

## Data sources

- **All land, deed and person records are synthetic.** Seed data: `database/seed/`, `scripts/seed.py`; evaluation documents: `ai/evaluation/make_synthetic.py`. Names, deed numbers and plots are invented.
- **No land records were downloaded.** No khatian, deed, owner or plot-ownership data was read from any government land-record system.
- **Removed: government-portal data.** An earlier version of this repo (see the git history) bundled mouza names, JL numbers, survey sheets and union boundaries collected by script from government land portals, plus links to scanned maps on a third-party site. That broke the competition's no-scraping rule, so the scripts, the data files, the `/mouza-map` page and the scan-download endpoint were deleted. Nothing from a government portal remains in the project, and no government portal is contacted by the app or the scripts.
- Boundaries: geoBoundaries gbOpen ADM3 (CC BY 4.0) via `ifahimreza/bangladesh-geojson` (ODbL), simplified and **not official**. Details: [docs/gis.md](docs/gis.md).
- Basemap tiles: © OpenStreetMap contributors (ODbL), demo traffic only.
- Font for generated PDFs and synthetic documents: GNU FreeSans (FreeFont, GPL-3.0 with font exception), see `ai/fonts/LICENSE-FreeFont.txt`.

## AI tool disclosure

| Tool | Used for | Human review |
|---|---|---|
| Claude (Anthropic) | Code generation, tests, docs, roadmap and requirement audit, phase by phase | Team reviewed and ran the code and tests, and edited the output |
| Tesseract OCR (runtime) | Default text extraction from uploaded deed images and scanned PDFs | Every extraction goes through human review before approval |
| Claude (Anthropic API, runtime, **optional**) | Reads the 13 deed fields when `ANTHROPIC_API_KEY` is set; off by default | Output is validated against the OCR text; low-confidence fields and every document go to a human reviewer. **Data sent to Anthropic only when enabled**: the page image (≤ 1568 px) and the OCR text of that upload; nothing otherwise |
| scikit-learn Isolation Forest (runtime) | Anomaly hint trained on synthetic data | Hint only; never creates a HIGH risk alone |

The risk rules are deterministic and explainable. Generative AI is used at runtime only for the optional Claude field reader above, never for risk scoring.

## Credits

Open-source libraries: Next.js, React, Tailwind CSS, next-intl, TanStack Query, React Hook Form, Leaflet, React Flow, Recharts, qrcode.react, Zod (MIT, Leaflet BSD-2); FastAPI, Uvicorn, Pydantic, PyJWT, rapidfuzz (MIT); SQLAlchemy, Alembic (MIT); Pillow (HPND); OpenCV (Apache-2.0); PyMuPDF (AGPL-3.0, optional); scikit-learn (BSD-3); pytesseract and Tesseract (Apache-2.0); Vitest, Playwright (MIT/Apache-2.0).
Data: geoBoundaries (CC BY 4.0), ifahimreza/bangladesh-geojson (ODbL), OpenStreetMap contributors (ODbL); Bangla names for land offices: [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode).

## Licence

Source code: [MIT](LICENSE). Third-party data and fonts keep their own licences (see Data sources).

## Limitations

- **Synthetic data only.** Not a government system; no integration with any real land registry.
- Risk scores are indicators from fixed rules, not findings of fraud or ownership.
- OCR/extraction accuracy was measured on 20 synthetic documents only; Bangla OCR was measured on two synthetic khatian/porcha specimens only (mean CER ≈ 17 %, parsed fields 77–90 %), so Bangla documents always go to human review; noisy documents score poorly. See the [ai-pipeline doc](docs/ai-pipeline.md).
- The anomaly model is trained on synthetic data; its score is not a probability and never creates HIGH alone.
- Rate limits and refresh-token revocation are in-memory per process.
- SQLite only (no Postgres). The Docker image for Render is written but its build/deploy was not run from this repo's sessions.
- Live deploy (Render + Netlify) is a manual step: see docs/deploy-netlify.md §3 for the smoke checklist. The free Render instance sleeps (cold start ~30–60 s; ping `/health` before a demo) and wipes its SQLite on restart (demo data is reseeded, uploaded documents are lost).
- On Render the OCR is real Tesseract; the sample PNGs were only tested end-to-end with the mock provider. "Verify a copy" returns NOT_FOUND until Doc1 has been approved in that instance.
- Known dependency advisories: `next` 14.2.15 and `next-intl` (breaking upgrades needed); see docs/security.md.
- Not verified: PDF export with correct Bangla shaping (needs Chromium), `next build`, QR scan on a real device, real-browser rendering of charts, map and graph.
- Parcel polygons are a fictional layout, not boundaries.

## Roadmap

Next: i18n audit (P53), accessibility + responsive pass (P54), E2E tests (P55-P56), Docker + Postgres (P57), demo script and rehearsal (P59), final acceptance (P60). Later: dependency major upgrades (Next 16, next-intl 4), shared rate-limit store, real-document pilot with legal review. Live status: `plan.md`.

## Demo instructions

Run `./start.sh`, sign in as the officer, then follow the 15-step flow: open LandShield · show the bilingual UI · upload Doc1 · show OCR · show AI extraction · show confidence · approve · show ownership history · upload Doc2 · possible double-sale alert · ownership graph · risk score · verify as citizen · bilingual report · QR verification. Works offline with mock providers. Timed script: [docs/demo-script.md](docs/demo-script.md); reset between runs with `./scripts/demo_reset.sh`.

Repository: `frontend/` · `backend/` · `ai/` · `database/` · `docs/` · `scripts/` · `plan.md` (state) · `prompt.md` (master spec).

