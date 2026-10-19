# LandShield BD

**Digital Land Verification & Risk Intelligence · ডিজিটাল ভূমি যাচাই ও ঝুঁকি বিশ্লেষণ**

> **Demo Dataset — Not an Official Government Land Record.**
> ডেমো ডেটাসেট — সরকারি ভূমি রেকর্ড নয়।

> LandShield provides digital record organization, consistency checks, and risk indicators. It does not establish legal ownership, certify title, or replace official government/legal verification.
>
> ল্যান্ডশিল্ড ডিজিটাল রেকর্ড সংগঠন, সামঞ্জস্য যাচাই ও ঝুঁকি-নির্দেশক প্রদান করে। এটি আইনগত মালিকানা প্রতিষ্ঠা করে না, স্বত্ব প্রত্যয়ন করে না, এবং সরকারি/আইনগত যাচাইয়ের বিকল্প নয়।

**Live demo:** <https://landshield-bd.vercel.app> · **Team:** DEEDGUARD (Alif Mahmud, Ayesha Hamid Mithila) · **Concept note:** [docs/LandShield-BD-Concept-Note.pdf](docs/LandShield-BD-Concept-Note.pdf)

![LandShield BD home page in Bangla](docs/screenshots/home-bn.jpg)

---

## Contents

[Overview](#overview) · [Screenshots](#screenshots) · [Features](#features) · [Risk rules](#risk-rules) · [Historical deeds](#historical-deeds) · [Architecture](#architecture) · [Getting started](#getting-started) · [Demo accounts](#demo-accounts) · [Demo dataset](#demo-dataset) · [Configuration](#configuration) · [Testing](#testing) · [Deployment](#deployment) · [Security and privacy](#security-and-privacy) · [Data sources](#data-sources) · [AI disclosure](#ai-tool-disclosure) · [Limitations](#limitations) · [Documentation](#documentation)

## Overview

Land fraud is hard to catch while records are on paper, spread across offices and checked by hand. Common cases are one plot sold twice, a seller who is not the recorded owner, copied deeds and altered areas.

LandShield BD is a demo of a land-record verification workflow for Bangladesh, built Bangla-first:

1. **Officers upload** deeds, khatians and porchas, both modern and pre-1971 historical deeds. They add the buyer's NID with each deed.
2. **OCR and extraction** read the document (Tesseract `ben+eng`, plus Claude if configured). Every field gets a confidence score, and nothing is guessed.
3. **A reviewer checks and approves** every field against the page. The four-eyes rule applies: an uploader cannot approve their own upload. Approval freezes a **signed digital record** (SHA-256 + Ed25519) and posts it to the ownership history.
4. An **explainable rule-based risk engine** scores each plot from 0 to 100 (LOW / MEDIUM / HIGH) and shows the evidence for every flag.
5. **Citizens** search a plot, see a plain-language verdict ("Be careful before you buy"), track mutations, see the land under their NID and print a bilingual report. The report's QR code opens a public page that shows no personal data.

All data is **synthetic**. Risk wording is always "possible" or "indicator", never "fraud confirmed".

### Problem statement (LandTech 2026 · P3)

**Track:** Digital Land Records, Verification & Digitization. **Chosen problem: P3, Fraud & Double-Selling**, with P1, P2, P4 and P5 as supporting modules.

| P3 scenario | Where it lives |
|---|---|
| Same plot sold twice | `POSSIBLE_DUPLICATE_TRANSACTION` + `SELLER_MISMATCH` (Doc1 → Doc2 = HIGH 70), ownership graph |
| Rapid transfers | `RAPID_RESALE`, `REPEATED_SUSPICIOUS_TRANSACTIONS` |
| Registration ↔ mutation mismatch | `REGISTERED_NOT_MUTATED`, `MUTATION_PARTY_MISMATCH`, `MUTATION_WITHOUT_DEED`, `MUTATION_AREA_EXCEEDS_DEED` |
| Forged / copied documents | `DUPLICATE_DEED`, `DEED_NO_FORMAT_INVALID`, `IMPOSSIBLE_DATE`; signed records + QR; "verify a copy"; hash-chained ledger (`RECORD_INTEGRITY_FAILED`) |

## Screenshots

> Captured from a local seeded build on 18 Oct 2026 (Doc1 approved, Doc2 and the 1944 historical deed waiting for review). All names and numbers are synthetic.

### Citizens and the public

| | |
|---|---|
| ![Home page in English](docs/screenshots/home-en.jpg) **Home.** Tabbed search card (land / mutation status / deed or QR check), notice ticker, Bangla calendar date, text size and contrast controls | ![Verification result, high risk](docs/screenshots/verify-result-high-risk.jpg) **Verification result.** A plain-language verdict with "what to do now" steps, then land information, ownership, transactions, mutation, cases and the evidence for each flag |
| ![Ownership graph](docs/screenshots/ownership-graph.jpg) **Ownership graph.** People, sales, deeds and the plot; flagged links (possible double sale) in red, with a list view as an alternative | ![Public QR verification page](docs/screenshots/qr-public-verify.jpg) **QR page** (`/v/{landId}`). A public summary with risk level and record counts, no names or document details |
| ![Citizen My Land page](docs/screenshots/citizen-my-lands.jpg) **My land.** Every plot recorded under the citizen's NID, now and before. Only the last 4 digits of the NID are shown, and the number is stored as a keyed hash | ![Citizen dashboard](docs/screenshots/citizen-home.jpg) **Citizen area.** Dashboard, saved searches, watched land, reports, notifications, profile and security |
| ![Track a mutation](docs/screenshots/mutation-tracker.jpg) **Mutation tracker** (`/track`). Status sentence and stepper (Applied → Review → Hearing → Decided); no sign-in needed | ![Check before you buy](docs/screenshots/pre-purchase-check.jpg) **Check before you buy.** Plot details plus the seller's name in, a checklist of red flags to raise with a professional out |
| ![Verify a document](docs/screenshots/verify-document.jpg) **Verify a document copy.** Upload the deed copy you were given; it is compared with the recorded deed, then discarded | ![Parcel map](docs/screenshots/parcel-map.jpg) **Bangladesh map.** Division → district → upazila menu, place search, boundaries and parcel outlines |
| ![Inheritance calculator](docs/screenshots/tool-inheritance.jpg) **Citizen tools.** Inheritance shares (faraid), land unit converter, registration/mutation fee estimator | ![Statistics](docs/screenshots/statistics.jpg) **Statistics.** Public infographic of the demo records |
| ![Guide](docs/screenshots/guide.jpg) **Guide.** Picture guides and videos per task, readable offline (PWA) | ![Mobile home](docs/screenshots/mobile-home-bn.jpg) **Mobile, 360 px.** Every page is tested at phone width |

### Officers and reviewers

| | |
|---|---|
| ![Officer dashboard](docs/screenshots/officer-dashboard.jpg) **Officer dashboard.** Records, pending review, high-risk plots, alerts, mutations, cases, hearings, ledger integrity, charts | ![Upload document](docs/screenshots/officer-upload.jpg) **Upload.** Deed / khatian / porcha / mutation, office, the parties' NID + date of birth, built-in demo document picker |
| ![Review a modern deed](docs/screenshots/review-modern-deed.jpg) **Review (modern deed).** Original next to the extracted fields, confidence badges, "only what needs checking" filter, keyboard shortcuts (A approve · R reject · N next) | ![Review a historical deed](docs/screenshots/review-historical-deed.jpg) **Review (historical deed).** The LHDR digital deed form, section by section (registration, dates, parties, schedule…), with the verbatim Bangla text under each normalised value |
| ![Document library](docs/screenshots/document-library.jpg) **Document library.** My uploads / my office / needs my action, with search and filters (status, type, kind of deed, date, area) | ![Document page](docs/screenshots/document-page.jpg) **Document page.** Original upload next to its signed digital version, every version with hashes and signature status, downloads (JSON, original, PDF, ZIP bundle) |
| ![Archive search](docs/screenshots/archive-search.jpg) **Archive search.** Full-text search over approved documents: party, mouza, khatian, dag, survey, year range | ![Admin console](docs/screenshots/admin-console.jpg) **Administration.** Users, officer requests, offices, notices / FAQ / guides, records, audit log, settings, ledger verification |

## Features

### For citizens (public or signed in)

- **Land search and verification** by division, district, upazila, mouza, survey (CS/SA/RS/BS), JL, khatian and dag, with an optional map sheet check, a quick summary before sign-in and the full report after it. The same khatian/dag in two surveys or two same-named mouzas gives a chooser instead of a wrong record.
- **Plain-language result**: a risk verdict, the number of warning signs, "what to do now" steps, then collapsible sections for land information, ownership, transactions, mutation, cases/encumbrance and evidence.
- **Read aloud** (Listen button) on result pages, and the "What to do on this page?" tip on every task page.
- **Ownership graph** (React Flow) with flagged links, and a list view for screen readers.
- **Bilingual verification report** with an A4 print stylesheet and a QR code. The **public QR page** shows counts only (ownership, transactions, flags, open alerts, cases, pending mutations).
- **My land by NID**: register your NID once, then see every plot you own now or owned before.
- **Watchlist and notifications**: watch a plot and get notified when its record changes. Saved searches and reports.
- **Mutation tracker** (`/track`) with no sign-in. It also accepts feedback references (`FB-…`).
- **Check before you buy**: a pre-purchase red-flag checklist for a plot and seller.
- **Verify a document copy**: upload the deed copy you were given and see whether it matches the recorded deed (the file is not stored). A downloaded record JSON can be checked through `POST /public/records/verify` (`VALID` / `INVALID`).
- **Citizen tools**: land unit converter, fee estimator (illustrative rates), inheritance (faraid) calculator.
- **Bangladesh map**: street basemap, division/district/upazila boundaries, place search, synthetic parcel outlines (risk colours after sign-in).
- **Feedback and grievance** form with a trackable reference; FAQ, notices, guide, statistics, site map.

### For officers, reviewers and admins

- **Upload → OCR → extraction → human review → approve / reject**, with per-field confidence, the source of each value (demo sample / PDF text / Tesseract; rules / Claude) and click-to-locate on the page.
- **Four-eyes rule**: the uploader cannot approve their own upload.
- **NID-linked ownership**: a deed is approved only with the new owner's NID, which is stored as a keyed hash.
- **Signed, versioned digital records**: MACHINE → DRAFT → APPROVED → SUPERSEDED, with corrections after approval as a new version. Each version carries a SHA-256 + Ed25519 signature. The original file is stored once, never changed, and its hash is checked on every read.
- **Downloads**: record JSON, the exact original, a **digital deed PDF** (exact Bangla text layer, hashes, signature and a QR code to `/v/r/{recordId}`), or a ZIP bundle with a manifest.
- **Document library** (my uploads / my office / needs my action) and a **document page** with version history.
- **Historical deeds** (pre-1971, pre-1947): automatic detection, a historical scan profile, LHDR extraction and a chain-of-title link (see [Historical deeds](#historical-deeds)).
- **Khatian / porcha parser** (CS, SA, RS, BS) with owners, shares and dag lists. Several owners or dags stay as lists for the reviewer.
- **Archive search** (SQLite FTS5) over approved documents, with filters for survey, district and year.
- **Mutations and hearing calendar**, **risk alerts**, **feedback and grievance** queue, **audit log**.
- **Hash-chained ledger** of approved deeds, transactions, mutations and encumbrances, with a "Verify ledger" check.
- **Admin console**: users and roles, officer sign-up requests, land offices, notices / FAQ / guide content, records and documents, settings.

### Across the site

- **Bangla first, English second** (next-intl). Bangla digits and the Bangla calendar date, with a CI check for untranslated strings.
- **Accessibility**: axe audit, full keyboard use, focus on the first error, Bangla screen-reader labels, 48 px touch targets, text size A− / A / A+, high-contrast and dark themes.
- **Mobile and PWA**: tested at 360 px, installable, guide pages work offline.
- **Performance**: each route is sent only the translation messages it uses (home HTML is 33 % smaller gzipped).
- **Role-aware header and landing pages** for citizen, reviewer, officer and admin.

## Risk rules

Deterministic and explainable. Every flag shows its evidence in English and Bangla. The score is the sum of points, capped at 100. The optional ML hint adds 0–15 points and never makes a plot HIGH on its own.

| Rule | Points | Severity | Rule | Points | Severity |
|---|---|---|---|---|---|
| `POSSIBLE_DUPLICATE_TRANSACTION` | 40 | HIGH | `MUTATION_PARTY_MISMATCH` | 60 | HIGH |
| `SELLER_MISMATCH` | 30 | HIGH | `MUTATION_WITHOUT_DEED` | 60 | HIGH |
| `DUPLICATE_DEED` | 30 | HIGH | `MUTATION_AREA_EXCEEDS_DEED` | 15 | MEDIUM |
| `INCONSISTENT_OWNERSHIP` | 20 | MEDIUM | `REGISTERED_NOT_MUTATED` | 30 | MEDIUM |
| `AREA_MISMATCH` | 15 | MEDIUM | `REPEATED_SUSPICIOUS_TRANSACTIONS` | 20 | MEDIUM |
| `ACTIVE_LITIGATION` | 30 | HIGH | `KHAS_LAND` | 60 | HIGH |
| `UNDER_ACQUISITION` | 60 | HIGH | `ACTIVE_MORTGAGE` | 0 | INFO |
| `DEED_NO_FORMAT_INVALID` | 15 | MEDIUM | `IMPOSSIBLE_DATE` | 30 | HIGH |
| `RAPID_RESALE` | 15 | MEDIUM | `SURVEY_CHAIN_GAP` | 15 | MEDIUM |
| `RECORD_INTEGRITY_FAILED` | 60 | HIGH | `HISTORICAL_CHAIN_GAP` | 15 | MEDIUM |
| `HISTORICAL_SELLER_NOT_OWNER` | 20 | MEDIUM | `HISTORICAL_DAG_CONFLICT` | 25 | MEDIUM |
| `HISTORICAL_CONSIDERATION_IMPLAUSIBLE` | 10 | MEDIUM | `UNIT_MISMATCH`, `POSSIBLE_NAME_VARIANT`, `LOW_EXTRACTION_CONFIDENCE` | 0 | INFO |

Source: `backend/app/risk/config.py` and `backend/app/risk/rules/`.

## Historical deeds

LandShield reads old Bangla deeds (British India, East Bengal / Pakistan era, early Bangladesh) into **LHDR v1**, a structured digital deed format. Each value keeps its normalised form, its verbatim text, a confidence score, its position on the page and its legibility.

- **Pipeline**: text-layer quality gate → Tesseract with ruled-table cell reading → modern/historical classifier → historical scan profile (paper flattening, red seal removal, deskew) → LHDR rule parser (Bangla calendar, numbers, archaic area units, gazetteer). With an API key, Claude also reads the pages and the two readings are fused.
- **Review** in the digital deed form, section by section (registration, dates, parties, consideration, schedule, title recital, execution).
- **Approval** signs the record and adds a past link to the plot's chain of title. The current owner does not change.
- **Measured (rules only, no API key)**: on 12 historical files with 1,064 gold values, accuracy rose from **2.1 % → 85.9 %** of all values (core 13 fields: 7.1 % → 85.7 %). The sample deed now gets 13 of 13 core fields right. Details: [docs/ocr-accuracy.md](docs/ocr-accuracy.md), [docs/historical-deeds.md](docs/historical-deeds.md).

## Architecture

```
Next.js 14 (App Router, next-intl, PWA)  ──►  FastAPI /api/v1  ──►  SQLAlchemy 2 (SQLite or Postgres)
        Vercel                                 Render (Docker)        Alembic migrations
                                                     │
                                                     ├── ai/  preprocessing · OCR router · extraction (rules, LHDR, Claude) · Isolation Forest
                                                     ├── risk engine (rules + ML hint) · hash-chained ledger · Ed25519 signing
                                                     └── storage (local or S3-compatible) · PDF (WeasyPrint + PyMuPDF text layer)
```

Diagrams: [docs/architecture.md](docs/architecture.md). API reference: [docs/api.md](docs/api.md).

| Layer | Stack |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, next-intl, TanStack Query, React Hook Form + Zod, Leaflet, React Flow, Recharts, qrcode.react, Vitest, Playwright |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, PyJWT, cryptography (Ed25519), rapidfuzz, pytest, ruff |
| AI / documents (optional extras) | Tesseract + pytesseract, OpenCV, PyMuPDF, scikit-learn, Anthropic SDK (`llm`), WeasyPrint + segno (`pdf`) |
| Data | SQLite (default) or Postgres (`postgres` extra); local or S3-compatible file storage (`s3` extra) |

## Getting started

Requirements: Python 3.11+, Node 18+ and npm. For real OCR you also need Tesseract with Bangla data ([docs/ocr-setup.md](docs/ocr-setup.md)).

**One command (macOS / Linux):**

```bash
./start.sh
```

This creates `backend/.venv`, installs the backend, copies `.env.example` to `backend/.env`, runs migrations, seeds the database on first run, and starts the API on **:8001** and the site on **:3000**. Then open <http://localhost:3000/bn>.

**Manual:**

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,ai]"          # optional extras: llm (Claude), pdf (deed PDF), postgres, s3
cp ../.env.example .env             # set JWT_SECRET (32+ chars) and DEMO_PASSWORD
alembic upgrade head
PYTHONPATH=.. python ../scripts/seed.py              # add --reset to rebuild
PYTHONPATH=.. uvicorn app.main:app --reload --port 8001

# frontend (second terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1" > .env.local
npm run dev                         # http://localhost:3000/bn  and  /en
```

API docs (dev only): <http://localhost:8001/docs>. Reset the demo between runs with `./scripts/demo_reset.sh`.

## Demo accounts

The password is the value of `DEMO_PASSWORD` (`start.sh` sets a default). Officers can also apply through `/officer-signup`, and an admin approves the request.

| Role | E-mail | Can do |
|---|---|---|
| Citizen | `citizen@demo.landshield.test` | Search, verify, reports, My land, watchlist, check before you buy |
| Reviewer | `reviewer@demo.landshield.test` | + review and approve extractions, alerts, archive, dashboard |
| Officer | `officer@demo.landshield.test` | + upload documents, mutations, hearings, audit log |
| Admin | `admin@demo.landshield.test` | Everything, plus users, offices, content and settings |

## Demo dataset

The table shows what a fresh seed returns (rules only).

| Plot | Scenario | Expected level (score) | Evidence |
|---|---|---|---|
| LP-10001 | CLEAN | LOW (0) | — |
| LP-10100 | NORMAL_CHAIN | LOW (0) | — |
| LP-10234 | LIVE_DEMO (upload target) | LOW (0) → HIGH (70) after Doc1 + Doc2 are approved | SELLER_MISMATCH, POSSIBLE_DUPLICATE_TRANSACTION |
| LP-10240 | DOUBLE_SALE | HIGH (70) | POSSIBLE_DUPLICATE_TRANSACTION, SELLER_MISMATCH |
| LP-10300 | AREA_MISMATCH | LOW until `AreaMismatch.png` is approved | — |
| LP-10400 | SELLER_MISMATCH | LOW until `SellerMismatch.png` is approved | — |
| LP-10500 | DUPLICATE_DEED | MEDIUM (30) | DUPLICATE_DEED |
| LP-10600 | UNMUTATED_SALE | MEDIUM (30) | REGISTERED_NOT_MUTATED |
| LP-10700 | MUTATION_OTHER_PERSON | HIGH (60) | MUTATION_PARTY_MISMATCH |
| LP-10800 | ACTIVE_CASE | MEDIUM (30) | ACTIVE_LITIGATION |
| LP-10900 | KHAS_LAND | HIGH (60) | KHAS_LAND |
| LP-11000 | ACQUISITION | HIGH (60) | UNDER_ACQUISITION |

Sample documents are in `database/sample_data/` (Doc1, Doc2, Clean, AreaMismatch, SellerMismatch, Khatian_RS, Porcha_BS, Verify_*), and historical deeds are in `database/sample_data/historical/`. The upload page has a picker for them. The synthetic owner NIDs are in `database/seed/data.json`; for example, Karim Mia (the Doc1 buyer) is `19809990000000002` / `1980-07-01`.

**Five-minute demo:** sign in as the officer → upload Doc1 with the buyer's NID → as the reviewer, approve it → upload Doc2 → approve → open LP-10234: possible double sale, HIGH 70 → ownership graph → report and QR → as the citizen, link the NID and open My land. Timed script: [docs/demo-script.md](docs/demo-script.md).

## Configuration

All variables are in [`.env.example`](.env.example). Copy it to `backend/.env`. The ones you are most likely to change:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./landshield.db` | Or `postgresql+psycopg://…` (needs the `postgres` extra) |
| `JWT_SECRET` | empty | Required; 32+ chars when `APP_ENV` is not `dev` |
| `APP_ENV` | `dev` | `prod` refuses weak secrets, http cookies and non-https CORS |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` | `true` / `none` when site and API are on different domains |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins |
| `STORAGE_BACKEND` / `STORAGE_PATH` | `local` / `./storage` | `s3` for S3-compatible storage |
| `OCR_PROVIDER` | `auto` | Demo fixture → PDF text (if it passes the quality gate) → Tesseract. No silent mock: no Tesseract means `OCR_UNAVAILABLE` |
| `OCR_PROFILE` | `auto` | Re-read as historical when the deed looks pre-1971; or `modern` / `historical` |
| `DEMO_FIXTURES` | `on` | Saved demo samples (exact SHA-256) return their stored result, labelled "Demo sample" |
| `DOCUMENT_AI_PROVIDER` | `auto` | Claude if `ANTHROPIC_API_KEY` is set, otherwise rules; any failure falls back to rules |
| `ANTHROPIC_API_KEY` / `CLAUDE_MODEL` | empty / `claude-haiku-4-5-20251001` | Optional Claude field reader; never logged or sent to the browser |
| `CLAUDE_DAILY_CAP` / `CLAUDE_TIMEOUT_S` | 100 / 30 | Calls per day and seconds per call before falling back to rules |
| `TESSERACT_LANG` | `ben+eng` | Missing languages are dropped with a warning |
| `REVIEW_CONF_THRESHOLD` | 0.85 | Fields below this always go to the reviewer |
| `ML_SCORING` | `on` | Isolation Forest hint (0–15 points, never HIGH alone) |
| `SIGNING_KEY` / `SIGNING_KEY_PATH` | empty | Ed25519 key for record signatures |
| `HASH_SALT` | empty | Salt for NID, IP and contact hashes; set it outside dev |
| `DEMO_PASSWORD` | empty | Password for the seeded demo users |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Frontend API base (`start.sh` sets :8001) |

## Testing

```bash
cd backend && pytest -q && ruff check .
cd frontend && npm test && npx tsc --noEmit && npm run check:i18n
cd frontend && npm run e2e                    # Playwright; starts its own seeded backend on :8001
cd frontend && npm run e2e:historical         # real OCR on the historical deed (needs Tesseract)
PYTHONPATH=. python ai/evaluation/run_eval.py --set historical --lhdr --profile auto   # OCR accuracy
```

The backend runs in CI (`.github/workflows/backend.yml`) on SQLite and Postgres. Accessibility (axe), keyboard, mobile (360 px) and visual checks are part of the Playwright suite.

## Deployment

- **Frontend:** Vercel, root directory `frontend` ([docs/deploy-vercel.md](docs/deploy-vercel.md)).
- **Backend:** Render with Docker (`render.yaml`, `Dockerfile`) ([docs/deploy-render.md](docs/deploy-render.md)). Use managed Postgres and S3-compatible storage for anything that has to survive a restart.
- The free Render instance sleeps (cold start ~30–60 s), so ping `/health` before a demo.

## Security and privacy

- JWT access token kept in memory; refresh token in an HttpOnly cookie. The role is read from the database, and an RBAC matrix test covers the endpoints.
- Rate limits on login, public endpoints, uploads and downloads. Uploads are validated, security headers are set, and logs are redacted.
- NIDs, IPs and contacts are stored only as keyed hashes. My land shows the last 4 digits only.
- Every approved record is signed with Ed25519, and the ledger is hash-chained. The public QR and record pages re-check the hash and signature on every read and show no personal data.
- An audit trail covers uploads, reviews, approvals, corrections and downloads.

Full notes and open items: [docs/security.md](docs/security.md).

## Data sources

- **All land, deed and person records are synthetic.** Names, NIDs, deed numbers and plots are invented (`database/seed/`, `scripts/seed.py`, `ai/evaluation/make_synthetic.py`).
- **No land records were downloaded or scraped.** An earlier version bundled data collected by script from government land portals. That broke the competition's no-scraping rule, so it was removed, and no government portal is contacted by the app or the scripts.
- Boundaries: geoBoundaries gbOpen ADM3 (CC BY 4.0) via `ifahimreza/bangladesh-geojson` (ODbL), simplified and **not official** ([docs/gis.md](docs/gis.md)). Bangla office names: [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode).
- Basemap tiles: © OpenStreetMap contributors (ODbL), demo traffic only.
- Fonts for generated PDFs and synthetic documents: GNU FreeFont (GPL-3.0 with font exception), see `ai/fonts/`.

## AI tool disclosure

| Tool | Used for | Human review |
|---|---|---|
| Claude (Anthropic), development | Code, tests, docs, roadmaps and requirement audits, phase by phase | The team reviewed, ran and edited everything |
| Tesseract OCR, runtime | Default text extraction from uploads | Every extraction goes through a human reviewer |
| Claude API, runtime, **optional** | Reads deed fields (and historical LHDR) when `ANTHROPIC_API_KEY` is set; off by default | Cross-checked against the OCR text; low-confidence fields and every document go to a reviewer. Only when enabled, the page image and OCR text of that upload are sent to Anthropic |
| scikit-learn Isolation Forest, runtime | Anomaly hint trained on synthetic data | Hint only; never makes a plot HIGH on its own |

Risk scoring is fully rule-based. Generative AI is never used to decide a risk level.

## Limitations

- **Synthetic data only.** This is not a government system and has no link to any real land registry.
- Risk scores are indicators from fixed rules, not findings of fraud or ownership.
- OCR accuracy was measured on synthetic documents and 12 historical files only, so real scans will score lower. Bangla documents always go to human review.
- The Claude extractor's accuracy is not part of the published numbers.
- Rate limits and refresh-token revocation live in memory, per process.
- On the free Render tier, SQLite and local uploads are wiped on restart; the demo data is reseeded.
- Known dependency advisories in `next` 14.2.15 and `next-intl` 3 (breaking upgrades needed); see [docs/security.md](docs/security.md).
- Parcel polygons are a fictional layout, not real boundaries.

## Documentation

| Topic | File |
|---|---|
| Architecture and API | [architecture.md](docs/architecture.md) · [api.md](docs/api.md) |
| AI pipeline, OCR setup and accuracy | [ai-pipeline.md](docs/ai-pipeline.md) · [ocr-setup.md](docs/ocr-setup.md) · [ocr-accuracy.md](docs/ocr-accuracy.md) |
| Historical deeds and the LHDR format | [historical-deeds.md](docs/historical-deeds.md) · [lhdr-v1.schema.json](docs/lhdr-v1.schema.json) · [historical-deed-roadmap.md](docs/historical-deed-roadmap.md) |
| UI, design system and usability | [ui.md](docs/ui.md) · [ui-ux-roadmap.md](docs/ui-ux-roadmap.md) · [usability.md](docs/usability.md) |
| Security, GIS | [security.md](docs/security.md) · [gis.md](docs/gis.md) |
| Demo, presentation, acceptance | [demo-script.md](docs/demo-script.md) · [final-presentation.md](docs/final-presentation.md) · [acceptance.md](docs/acceptance.md) |

Repository layout: `frontend/` · `backend/` · `ai/` · `database/` · `docs/` · `scripts/` · `models/`.

## Credits and licence

Open-source libraries: Next.js, React, Tailwind CSS, next-intl, TanStack Query, React Hook Form, Zod, Leaflet, React Flow, Recharts, qrcode.react, Vitest, Playwright; FastAPI, Uvicorn, Pydantic, SQLAlchemy, Alembic, PyJWT, cryptography, rapidfuzz, Pillow, OpenCV, PyMuPDF (AGPL-3.0, optional), scikit-learn, Tesseract, WeasyPrint, segno. Data: geoBoundaries, ifahimreza/bangladesh-geojson, OpenStreetMap contributors.

Source code: [MIT](LICENSE). Third-party data and fonts keep their own licences.
