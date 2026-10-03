# LandShield BD — Master Plan v2 (token-lean · one phase per chat)

> Hackathon track: Digital Land Records, Verification & Digitization.
> Bilingual (EN/BN) platform: scanned land documents → OCR → extraction → human review → ownership/transaction history → explainable risk indicators → bilingual report.
> Demo data only. Not a government system.

---

## 0. STATE  ← Claude updates this block at the end of every phase

```text
Plan version : 2
Current phase: — (nothing started)
Last done    : —
Next phase   : P01
Partial work : none
Deviations   : none
Not-run tests: none

Repo map (P01 fills; keep ≤ 25 lines; update only lines you changed):
  (empty)

Changelog (1 line per phase, newest first):
  (empty)
```

---

## 1. SESSION PROTOCOL (every phase, every chat)

**Human kickoff prompt (paste in a NEW chat; attach latest zip + plan.md):**

```text
Read plan.md. Execute the phase in STATE → Next phase. Follow §1 and §2. Nothing else.
```

**START (≤ 5 tool calls)**
1. Read §0, §1–§4, the tracker row and card of the Next phase, and only the `R*` sections that card cites. Locate them with `grep -n "^## \|^### P" plan.md`, then view a line range. **Never read the whole file.**
2. Read only files named in the card's `Files` + STATE Repo map. No repo-wide audit (P01 is the only audit).
3. If STATE lists Partial work, finish that first.

**WORK**
4. Implement exactly the card's `Do` list. Nothing from later phases.
5. Run targeted checks only (new tests + tests of touched modules). Full suites only on 🔒 phases. Pipe output through `| tail -40`.
6. If something cannot run (no network, missing tool): do **not** claim it passed. Write the test anyway, add `NOT RUN: <reason>` to STATE → Not-run tests, and give the user ≤ 3 shell lines to run locally.

**END**
7. Update §0: mark phase ✅ (or 🟡 + exact remaining steps), set Next phase, add a 1-line Changelog entry, refresh changed Repo-map lines, log deviations, and flip the tracker cell in §4.
8. Deliver **ONE zip of the whole project including the updated plan.md**. Exclude `node_modules`, `.venv`, `__pycache__`, `.next`, `.git`, `storage/`, `*.db`, build caches. Never deliver files separately.
9. Final chat message = status block, ≤ 8 lines: phase · changed files (grouped) · verify commands · NEXT. No introduction, no conclusion, no ethics/disclaimer text. Code goes into files, never pasted into chat.

---

## 2. PHASE BUDGET RULES (free-tier safety)

- **One phase = one chat.** Size **S** ≈ ≤ 200 new LOC / ≤ 6 files. **M** ≈ ≤ 400 LOC / ≤ 10 files. (Estimates; migrations, seed JSON, lockfiles, generated files don't count.)
- One concern per phase. No "while I'm here" refactors, no early work from later phases.
- Edit with targeted replacements. Don't re-print or rewrite whole files; don't re-read files you just wrote.
- Install only packages named in the card. Heavy installs (OpenCV, Tesseract, scikit-learn, Playwright browsers, Docker) only in the phase that lists them.
- **Stop rule:** if ~70% of the session is used and the phase isn't done → bring code to a green state, mark 🟡 PARTIAL with exact remaining steps, name the remainder `Pnn-b`, deliver the zip. Never end on broken code.
- If a session is cut off mid-phase, the next session resumes by checking which of the card's `Files` already exist.
- **UI-DoD** (applies to every UI phase): loading + empty + error states · EN and BN keys, zero hardcoded strings · keyboard + focus + aria labels · works at 360 / 768 / 1280 px · uses design tokens (R6).
- **API-DoD** (every API phase): Pydantic schemas · RBAC dependency (R4) · audit log on writes · pytest: happy path + permission denied + not found.

---

## 3. CORE RULES

1. Preserve working code. Don't rewrite what works.
2. Never fabricate government API access, official data, legal verification, or accuracy numbers. Measured results only.
3. All data is synthetic; always label: **"Demo Dataset — Not an Official Government Land Record."**
4. AI assists human reviewers; it never makes a legal determination. Wording rules in R3.
5. No secrets in code; env vars only; commit `.env.example`, never `.env`.
6. Backend is language-neutral (codes + params). Translations live only in frontend i18n. Preserve original document values exactly.
7. EN + BN from the first UI phase. Responsive + accessible always.
8. Professional civic-tech look: restrained, no gradients/glass/animation excess.
9. No raw NID/phone/address exposure anywhere (R4).
10. Priority when in conflict: correctness > security > usability > accessibility > maintainability > polish > advanced AI.

---

## 4. DECISIONS (v2) & PHASE TRACKER

**Decisions (override v1 where different):**
- **D1 DB:** SQLAlchemy 2.0 + Alembic with portable types. SQLite for dev/tests; PostgreSQL via `DATABASE_URL` in Docker (smoke-tested in P57). IDs = UUID strings. JSON columns generic.
- **D2 Deferred:** PostGIS and pgvector → P2. Geometry = GeoJSON JSON column. Name similarity = `rapidfuzz` (P43). Embeddings = P2.
- **D3 OCR:** Mock first (P25) → Tesseract `ben+eng` as first real provider (P39). PaddleOCR optional (P42).
- **D4 Document AI:** Mock → deterministic rule-based extractor on OCR text (P40) → optional VLM (P42). VLM is never required.
- **D5 Auth:** JWT access (15 min, `Authorization: Bearer`) + refresh (7 d, httpOnly SameSite=Lax cookie). Passwords: argon2.
- **D6 Jobs:** FastAPI BackgroundTasks behind a `JobRunner` interface. No Celery/Redis.
- **D7 Graph:** server derives nodes/edges from relational tables; frontend uses React Flow.
- **D8 Tests:** pytest + Vitest throughout; Playwright only in P55–P56.
- **D9 UI kit:** Tailwind; shadcn/ui components added one at a time only when needed.
- **D10 PDF:** print stylesheet + Chromium print-to-PDF (correct Bengali shaping). No ReportLab (poor Bengali shaping).
- **D11 Schema additions vs v1:** `area_unit` on deeds/transactions; `extraction_json` on documents.
- **D12 Order:** demo-critical path first (risk engine before OCR; mock pipeline before real AI; landing page after the core demo works).

**Cutline if time is short:** P01–P36 → P38–P41 → P44–P46 → P51 → P58–P60. Skip first: P37, P42, P47–P50, P57.
**Demo checkpoints:** after **P22** (seeded demo works, no upload) · after **P30** (full upload→alert demo with mock pipeline).

Legend: ⬜ todo · 🟡 partial · ✅ done · 🔒 gate (run full test suites).

| ID | Phase | Pri | Size | Status |
|----|-------|-----|------|--------|
| **M1 Foundation** |||||
| P01 | Repo audit + skeleton | P0 | S | ⬜ |
| P02 | Backend skeleton | P0 | S | ⬜ |
| P03 | Models A: users, lands, owners, documents | P0 | M | ⬜ |
| P04 | Models B: deeds, transactions, ownership_history | P0 | S | ⬜ |
| P05 | Models C: verification, risk, alerts, audit | P0 | S | ⬜ |
| P06 | Seed data (all scenarios) | P0 | M | ⬜ |
| P07 | Auth backend | P0 | M | ⬜ |
| P08 | RBAC + auth audit | P0 | S | ⬜ |
| **M2 Frontend foundation** |||||
| P09 | Next.js + Tailwind + i18n + fonts + switcher | P0 | M | ⬜ |
| P10 | UI primitives A | P0 | S | ⬜ |
| P11 | UI primitives B + i18n parity script | P0 | M | ⬜ |
| P12 | API client + login + role guards | P0 | M | ⬜ |
| **M3 Citizen verification** |||||
| P13 | Land lookup API (public-safe) | P0 | S | ⬜ |
| P14 | Ownership + transactions API | P0 | S | ⬜ |
| P15 | Verify Land form | P0 | S | ⬜ |
| P16 | Verification result page | P0 | M | ⬜ |
| **M4 Risk engine** |||||
| P17 | Rules A: double-sale + seller mismatch | P0 | S | ⬜ |
| P18 | Rules B: deed reuse, area, ownership gaps, repeats | P0 | M | ⬜ |
| P19 | Risk score + persistence + alerts API | P0 | M | ⬜ |
| P20 | Risk UI + bilingual evidence | P0 | M | ⬜ |
| P21 | Verification request + report JSON | P0 | S | ⬜ |
| P22 | Report page 🔒 (Demo checkpoint 1) | P0 | M | ⬜ |
| **M5 Ingestion (mock pipeline)** |||||
| P23 | Storage + upload validation + upload API | P0 | M | ⬜ |
| P24 | Upload UI + status polling | P0 | S | ⬜ |
| P25 | Job runner + provider interfaces + mocks | P0 | M | ⬜ |
| P26 | Synthetic document generator | P0 | M | ⬜ |
| P27 | Extraction schema + endpoints + validation | P0 | S | ⬜ |
| P28 | Review screen A (read-only) | P0 | M | ⬜ |
| P29 | Review screen B (edit/approve/reject) | P0 | M | ⬜ |
| P30 | Approval posting + double-sale integration 🔒 (Demo checkpoint 2) | P0 | M | ⬜ |
| **M6 Landing + Officer/Admin** |||||
| P31 | Landing page A | P0 | M | ⬜ |
| P32 | Landing page B + About | P0 | M | ⬜ |
| P33 | Officer stats/queue API | P0 | S | ⬜ |
| P34 | Officer dashboard A (shell, KPIs, queue) | P0 | M | ⬜ |
| P35 | Officer dashboard B (charts, alerts) | P0 | M | ⬜ |
| P36 | Audit log API + viewer | P0 | S | ⬜ |
| P37 | Admin users + records tables | P1 | M | ⬜ |
| **M7 Real AI** |||||
| P38 | OpenCV preprocessing | P0 | S | ⬜ |
| P39 | Tesseract OCR provider | P0 | S | ⬜ |
| P40 | Rule-based field extractor (Bangla-aware) | P0 | M | ⬜ |
| P41 | Evaluation + measured results 🔒 | P0 | S | ⬜ |
| P42 | Optional Paddle / VLM adapters | P2 | S | ⬜ |
| **M8 Differentiators** |||||
| P43 | Fuzzy name matching | P1 | S | ⬜ |
| P44 | Ownership graph API | P1 | S | ⬜ |
| P45 | Ownership graph UI | P1 | M | ⬜ |
| P46 | QR + public verification page | P1 | M | ⬜ |
| P47 | PDF export | P1 | S | ⬜ |
| P48 | Isolation Forest + evaluation | P1 | M | ⬜ |
| P49 | ML into risk engine | P1 | S | ⬜ |
| P50 | GIS map | P1 | M | ⬜ |
| **M9 Hardening + delivery** |||||
| P51 | Security A: headers, rate limits, uploads, secrets | P0 | M | ⬜ |
| P52 | Security B: authz matrix + leak tests | P0 | M | ⬜ |
| P53 | i18n audit | P0 | S | ⬜ |
| P54 | Accessibility + responsive pass | P0 | M | ⬜ |
| P55 | E2E A (Playwright) | P0 | M | ⬜ |
| P56 | E2E B (Playwright) | P0 | M | ⬜ |
| P57 | Docker + Postgres smoke | P1 | M | ⬜ |
| P58 | Documentation | P0 | M | ⬜ |
| P59 | Demo script + reset + rehearsal | P0 | M | ⬜ |
| P60 | Final acceptance 🔒 | P0 | S | ⬜ |

---

## 5. PHASE CARDS

> Format: **Do** (ordered steps) · **Files** (resume check) · **Done** · **Skip** · cites `R*` reference sections.

### M1 — Foundation

### P01 · Repo audit + skeleton
**Do:** `tree -L 3` (ignore deps); read only package.json / pyproject / README; fill STATE Repo map; mark already-satisfied phases ✅ in §4; create missing top dirs (`frontend backend ai database docs scripts`) per R1; `.env.example` (R8); `.gitignore` (.env, storage/, node_modules, .venv, *.db, .next); README stub (title, demo-data label, "setup: see P58").
**Files:** `.env.example`, `.gitignore`, `README.md`, plan.md STATE.
**Done:** Repo map written; deviations recorded; no app code written.
**Skip:** any UI/API code; docs/architecture.md (P58).

### P02 · Backend skeleton
**Do:** FastAPI app factory; `pydantic-settings` config from env; router prefix `/api/v1`; `GET /api/v1/health`; global exception handlers returning `{code, message, details}`; structured logging; CORS from `CORS_ORIGINS`; pytest + httpx client fixture; ruff config.
**Files:** `backend/app/{main.py, core/config.py, core/errors.py, core/logging.py, api/v1/health.py}`, `backend/tests/test_health.py`, `backend/pyproject.toml`.
**Done:** pytest green; server starts; error shape tested.
**Skip:** DB.

### P03 · Models A
**Do:** SQLAlchemy base + session; portable types (R2); models `users, land_parcels, owners, documents` (incl. `extraction_json`); status/role enums as strings (R2, R4); Alembic init + migration #1; tests inserting/reading rows on SQLite.
**Files:** `backend/app/{core/db.py, models/*.py}`, `backend/migrations/`, `backend/tests/test_models_a.py`.
**Done:** `alembic upgrade head` works on fresh SQLite; unique constraint on parcel identifiers tested.
**Skip:** seed, auth.

### P04 · Models B
**Do:** `deeds, transactions, ownership_history` with FKs + indexes (land_id, seller_id, deed_no — deed_no **not** unique, reuse must be detectable); `area_unit` columns; migration #2; relationship tests.
**Files:** `backend/app/models/{deed,transaction,ownership}.py`, migration, tests.
**Done:** migration chain applies cleanly; relationship tests green.

### P05 · Models C
**Do:** `verification_requests, risk_assessments, fraud_alerts, audit_logs`; `audit.log(actor, action, entity_type, entity_id, old, new, ip)` helper (ip → salted hash); migration #3; tests.
**Files:** `backend/app/models/{verification,risk,alert,audit}.py`, `backend/app/services/audit.py`, migration, tests.
**Done:** all 11 tables exist; audit helper tested (ip never stored raw).

### P06 · Seed data
**Do:** implement all scenarios in R7 as Python/JSON under `database/seed/`; `scripts/seed.py [--reset]`, idempotent; demo users with password from `DEMO_PASSWORD`; tests assert key facts per scenario.
**Files:** `database/seed/*`, `scripts/seed.py`, `backend/tests/test_seed.py`.
**Done:** reset+seed twice → identical state; LP-10234 has recorded owner Rahim and **no** transactions; Doc1/Doc2 NOT loaded as DB rows.

### P07 · Auth backend
**Do:** `POST /auth/register` (role forced CITIZEN), `/login`, `/refresh`, `/logout`, `GET /auth/me`; argon2 hashing; JWT per D5; fail fast if `JWT_SECRET` missing outside dev; tests incl. expired/invalid tokens.
**Files:** `backend/app/{api/v1/auth.py, core/security.py, schemas/auth.py, services/auth.py}`, tests.
**Done:** register→login→me→refresh→logout flow green.

### P08 · RBAC + auth audit
**Do:** `require_roles(...)` dependency per matrix R4; apply to a stub protected route per role; audit LOGIN / LOGOUT / FAILED_LOGIN; in-memory login rate limit (R4); tests: citizen→admin 403, officer→admin-only 403, no token 401.
**Files:** `backend/app/core/rbac.py`, `backend/tests/test_rbac.py`.
**Done:** matrix tests green.

### M2 — Frontend foundation

### P09 · Frontend foundation
**Do:** Next.js App Router + TS + Tailwind; `next-intl` with `[locale]` (en, bn), middleware, default `en`; `messages/{en,bn}.json` namespaces `common nav errors status risk`; Inter + Noto Sans Bengali via `next/font`; tokens R6 in Tailwind config; header with language switcher (keeps current path) + 2 placeholder pages; Vitest setup.
**Files:** `frontend/{app/[locale]/layout.tsx, app/[locale]/page.tsx, middleware.ts, i18n/*, messages/*, tailwind.config.ts}`.
**Done:** `/en` and `/bn` render; switch preserves path; Bangla glyphs render.
**Skip:** component library, real pages.

### P10 · UI primitives A
**Do:** Button, Input (label + error + hint), Select, Card, Badge; `StatusBadge` and `RiskBadge` mapping neutral codes → i18n keys (R6); Vitest tests (render, a11y name, variants).
**Files:** `frontend/components/ui/*`, `frontend/components/domain/{StatusBadge,RiskBadge}.tsx`, tests.
**Done:** tests green; EN+BN keys present.
**Skip:** gallery page.

### P11 · UI primitives B + i18n parity
**Do:** Modal (focus trap, Esc), Table (sort/pagination props, responsive scroll), Tabs, EmptyState, LoadingState, ErrorState; `scripts/check-i18n.mjs` fails when en/bn keys differ; wire into `npm run check:i18n`; tests.
**Files:** `frontend/components/ui/*`, `frontend/scripts/check-i18n.mjs`, tests.
**Done:** parity script passes; keyboard test for Modal/Tabs.

### P12 · API client + auth UI
**Do:** typed fetch client (base URL env, bearer, one silent refresh on 401); TanStack Query provider; auth context; login page; `RequireRole` guard; role-aware nav; logout; tests with mocked fetch.
**Files:** `frontend/{lib/api.ts, features/auth/*, app/[locale]/login/page.tsx}`.
**Done:** login with seeded demo officer works against the running backend (or mocked if unrunnable); guard redirects unauthorised users. UI-DoD.

### M3 — Citizen verification

### P13 · Land lookup API
**Do:** `GET /lands/search?district&upazila&mouza&khatian&dag`, `GET /lands/{land_id}`; schema `LandPublic` per R4 masking; 404 shape; tests on seed.
**Files:** `backend/app/{api/v1/lands.py, schemas/land.py, services/land.py}`, tests.
**Done:** API-DoD; no hashes/file paths in payload (tested).

### P14 · Ownership + transactions API
**Do:** `GET /lands/{id}/ownership`, `GET /lands/{id}/transactions` (ordered by date); include document refs `{id, type}` only; tests on seed scenarios.
**Files:** `backend/app/api/v1/lands.py` (extend), `schemas/ownership.py`, tests.
**Done:** API-DoD; LP-10100 returns Rahim→Karim→Hasan chain in order.

### P15 · Verify Land form
**Do:** RHF + Zod form (District, Upazila, Mouza, Khatian, Dag); district/upazila from small static list `lib/geo.ts`; normalize Bangla digits in numeric fields; call P13; loading/empty/error; navigate to result route.
**Files:** `frontend/features/verify/{VerifyForm.tsx, schema.ts}`, `frontend/app/[locale]/verify/page.tsx`, tests.
**Done:** UI-DoD; Bangla digits `১২৪৫` accepted as `1245`.

### P16 · Verification result page
**Do:** land info card, ownership timeline, transactions table, demo banner, disclaimer, placeholder "risk section" (filled in P20); test with mocked API.
**Files:** `frontend/features/result/*`, `frontend/app/[locale]/verify/result/page.tsx`.
**Done:** UI-DoD; renders LP-10100 and LP-10001 correctly.

### M4 — Risk engine

### P17 · Rules A (R3)
**Do:** package `backend/app/risk/rules/`; pure functions over a `LandContext` dataclass (no DB inside rules); evidence schema `{code, severity, params}`; rules `POSSIBLE_DUPLICATE_TRANSACTION`, `SELLER_MISMATCH`; unit tests per scenario in R7.
**Files:** `backend/app/risk/{context.py, rules/duplicate_tx.py, rules/seller.py}`, tests.
**Done:** LP-10240 triggers both; LP-10100 and LP-10001 trigger none.

### P18 · Rules B (R3)
**Do:** `DUPLICATE_DEED`, `AREA_MISMATCH`, `INCONSISTENT_OWNERSHIP` (gaps/overlaps in ownership periods), `REPEATED_SUSPICIOUS_TRANSACTIONS`, `UNIT_MISMATCH` (flag only, no unit conversion); tests each + clean no-alert test.
**Files:** `backend/app/risk/rules/*`, tests.
**Done:** every rule has positive + negative test; every alert has evidence.

### P19 · Risk score + persistence
**Do:** aggregator with weights in one config file (R3); levels LOW/MEDIUM/HIGH; `analyze_land(land_id)` persists `risk_assessments` + deduped `fraud_alerts`; `GET /lands/{id}/risk`, `GET /risk-alerts` (reviewer+), `PATCH /risk-alerts/{id}` (status per R4); audit on PATCH; tests.
**Files:** `backend/app/risk/{scoring.py, config.py}`, `backend/app/services/risk.py`, `api/v1/risk.py`, tests.
**Done:** API-DoD; LP-10234-style double sale → HIGH (70) with evidence list.

### P20 · Risk UI + bilingual evidence
**Do:** `RiskCard` (score, level badge, plain bar — no fancy gauge), `EvidenceList` rendering `risk.evidence.<CODE>` with params in EN+BN; plug into result page; **wording test** greps messages for forbidden phrases (R3).
**Files:** `frontend/features/risk/*`, `messages/{en,bn}.json`, tests.
**Done:** UI-DoD; wording test passes.

### P21 · Verification request + report JSON
**Do:** `POST /verification` (creates request, runs `analyze_land`), `GET /verification/{id}`, `GET /verification/{id}/report` (sections per R5, timestamp); citizens read only their own; tests.
**Files:** `backend/app/{api/v1/verification.py, schemas/report.py, services/verification.py}`, tests.
**Done:** API-DoD; ownership-of-request enforced.

### P22 · Report page 🔒
**Do:** bilingual report page (all R5 sections), print stylesheet (A4), disclaimer, timestamp, link from result page; run **full backend + frontend suites**; walk the seeded flows (clean, double-sale).
**Files:** `frontend/features/report/*`, `frontend/app/[locale]/report/[id]/page.tsx`.
**Done:** UI-DoD; **Demo checkpoint 1 reached** — record in STATE.

### M5 — Ingestion (mock pipeline)

### P23 · Storage + upload API
**Do:** `StorageService` interface + `LocalStorage` (uuid filenames, extension from validated type, path-traversal guard, sha256); validators: extension, magic-byte sniff (`filetype`), size ≤ 10 MB, image pixel cap, PDF header/page cap; `POST /documents/upload` (officer+), `GET /documents/{id}`; statuses R4; same-hash upload → flagged duplicate, not overwritten; tests with renamed exe, oversized, traversal name.
**Files:** `backend/app/{services/storage.py, services/upload_validation.py, api/v1/documents.py, schemas/document.py}`, tests.
**Done:** API-DoD; all malicious-file tests rejected.

### P24 · Upload UI
**Do:** officer page `/officer/upload`: drag-drop + picker, client-side validation, upload progress, `useDocumentStatus` polling hook, status badge.
**Files:** `frontend/features/upload/*`, `frontend/app/[locale]/officer/upload/page.tsx`.
**Done:** UI-DoD; rejected-file error message in EN+BN.

### P25 · Job runner + providers
**Do:** `JobRunner` (BackgroundTasks impl); `POST /documents/{id}/process`; transitions UPLOADED→PROCESSING→EXTRACTED|FAILED; interfaces `OCRProvider`, `DocumentAIProvider`; `MockOCRProvider` + `MockDocumentAIProvider` return ground truth from fixtures keyed by filename marker/hash; env switching (R8); tests incl. failure → FAILED.
**Files:** `ai/{ocr/base.py, ocr/mock.py, extraction/base.py, extraction/mock.py}`, `backend/app/{workers/jobs.py, services/processing.py}`, tests.
**Done:** upload→process→EXTRACTED works end-to-end with mocks.

### P26 · Synthetic document generator
**Do:** `ai/evaluation/make_synthetic.py` — Pillow renders deed-like images (mixed EN/BN labels, Bangla digits, optional skew/noise) + `ground_truth.json`; seeded RNG; outputs Doc1, Doc2 (R7), area-mismatch doc, clean doc, plus ~20 evaluation docs; bundle OFL Noto Sans Bengali under `ai/fonts/`; keep committed outputs < 2 MB.
**Files:** `ai/evaluation/make_synthetic.py`, `ai/fonts/`, `database/sample_data/*`, test for determinism.
**Done:** two runs → identical bytes; Bangla text renders correctly (view one image).

### P27 · Extraction schema + endpoints
**Do:** Pydantic `ExtractedField{field,value,confidence,source_bbox?}` and `Extraction`; store in `documents.extraction_json`; `GET/PATCH /documents/{id}/extraction` (PATCH keeps original + `edited_by_human`); validators (R4: required fields, area numeric > 0, deed date not in future); low-confidence flag from `REVIEW_CONF_THRESHOLD`; set status REVIEW_REQUIRED; tests.
**Files:** `backend/app/{schemas/extraction.py, services/extraction.py}`, `api/v1/documents.py` (extend), tests.
**Done:** API-DoD; invalid area/date rejected with field-level errors.

### P28 · Review screen A (read-only)
**Do:** `/officer/review/[id]`: two columns — document preview (image / PDF page 1, zoom) | extracted fields with confidence badges (bands R4); low-confidence banner; processing-state handling.
**Files:** `frontend/features/review/*`, `frontend/app/[locale]/officer/review/[id]/page.tsx`.
**Done:** UI-DoD; mobile stacks vertically.

### P29 · Review screen B (act)
**Do:** backend `POST /documents/{id}/approve|reject|reprocess` (status only here; reject needs reason; approve blocked if validation fails; reviewer+); UI: inline edit, field-level errors (i18n), Approve disabled while invalid, Reject modal, Request reprocessing; audit on every action.
**Files:** `backend/app/api/v1/documents.py` (extend), `frontend/features/review/*`.
**Done:** API-DoD + UI-DoD; invalid data cannot be approved (backend-enforced).

### P30 · Approval posting + integration 🔒
**Do:** on approve, in **one DB transaction**: resolve/create land + owners (exact normalized name + father name, else create — fuzzy comes in P43); create deed + transaction; run `analyze_land`; if any HIGH evidence → transaction `FLAGGED`, ownership_history **not** updated, alert `OPEN`; else `RECORDED` + close previous ownership + open new; audit. Integration test (mock providers): upload Doc1 → approve → upload Doc2 → approve → alert `POSSIBLE_DUPLICATE_TRANSACTION` HIGH; plus clean-record test. Run **full suites**.
**Files:** `backend/app/services/posting.py`, `backend/tests/integration/test_demo_flow.py`.
**Done:** **Demo checkpoint 2 reached**; transaction rollback on failure tested.

### M6 — Landing + Officer/Admin

### P31 · Landing page A
**Do:** navbar, hero (tagline R9, CTAs Verify Land / Officer Login), footer, demo-notice banner, disclaimer. No animations.
**Files:** `frontend/features/landing/{Navbar,Hero,Footer,DemoBanner}.tsx`, `app/[locale]/page.tsx`.
**Done:** UI-DoD; EN+BN visually checked at 360/768/1280.

### P32 · Landing page B + About
**Do:** sections: problem, how-it-works (Upload→Extract→Review→Verify→Analyze→Report), features, trust/security; About page (purpose, limitations, demo data, non-legal notice).
**Files:** `frontend/features/landing/*`, `app/[locale]/about/page.tsx`.
**Done:** UI-DoD.

### P33 · Officer stats/queue API
**Do:** `GET /officer/stats` (total records, pending review, high risk, verified), `GET /officer/queue` (filters pending / low_confidence / high_risk / recent; pagination, sort, search), `GET /officer/activity` (from audit_logs); tests.
**Files:** `backend/app/api/v1/officer.py`, `schemas/officer.py`, tests.
**Done:** API-DoD; numbers match seed.

### P34 · Officer dashboard A
**Do:** officer layout shell (sidebar; mobile drawer), KPI cards, verification queue table with filters + search + pagination.
**Files:** `frontend/features/officer/*`, `app/[locale]/officer/page.tsx`.
**Done:** UI-DoD; rows link to review screen.

### P35 · Officer dashboard B
**Do:** Recharts (verification status, risk distribution) lazy-loaded; recent activity list; risk alerts list with review actions (`PATCH /risk-alerts/{id}`).
**Files:** `frontend/features/officer/{Charts,Alerts,Activity}.tsx`.
**Done:** UI-DoD; charts have text alternatives.

### P36 · Audit log API + viewer
**Do:** `GET /admin/audit-logs` (filters actor/action/entity/date; pagination; officer+admin read per R4); table UI; ip_hash shown truncated; tests.
**Files:** `backend/app/api/v1/admin_audit.py`, `frontend/features/admin/AuditLogs.tsx`.
**Done:** API-DoD + UI-DoD.

### P37 · Admin users + records (P1)
**Do:** `GET/PATCH /admin/users` (role, is_active; cannot demote/deactivate self); admin tables for land records + documents (search/sort/pagination); UI.
**Files:** `backend/app/api/v1/admin.py`, `frontend/features/admin/*`.
**Done:** API-DoD + UI-DoD; officer gets 403.

### M7 — Real AI

### P38 · OpenCV preprocessing
**Do:** `ai/preprocessing/`: grayscale, denoise, CLAHE, deskew, auto-crop; PDF→image via PyMuPDF; pure functions; opt-in `PREPROCESS=on`; tests on synthetic skewed image (angle error < 1°).
**Files:** `ai/preprocessing/*`, tests.
**Done:** tests green; pipeline unchanged when flag off.

### P39 · Tesseract OCR provider
**Do:** `TesseractOCRProvider` (`ben+eng`) → text, word boxes, per-word confidence; set `OCR_PROVIDER=tesseract`; store `ocr_text`, `ocr_confidence`; document install steps in a short `docs/ocr-setup.md`; tests marked skip if tesseract absent.
**Files:** `ai/ocr/tesseract.py`, tests.
**Done:** runs on P26 images; unavailable → clear error + automatic fallback to mock (logged).

### P40 · Rule-based field extractor
**Do:** `RuleBasedDocumentAIProvider` on OCR text: Bangla→ASCII digit normalization; EN+BN label patterns (খতিয়ান, দাগ, মৌজা, জেলা, উপজেলা, দলিল নং, বিক্রেতা, ক্রেতা, …); area-unit synonyms (শতাংশ/decimal, কাঠা, বিঘা, acre) stored **as written**, never converted; per-field confidence = OCR word confidence × pattern strength; bbox from OCR boxes; tests on ground-truth text.
**Files:** `ai/extraction/rules.py`, `ai/extraction/patterns.py`, tests.
**Done:** all 13 fields (R4) extracted from clean synthetic docs; unknown → null with low confidence (never guessed).

### P41 · Evaluation 🔒
**Do:** `ai/evaluation/run_eval.py`: per-field accuracy (Tesseract + rules) on synthetic set; rule-engine precision/recall on R7 scenarios; write a results table into `docs/ai-pipeline.md` with date, dataset size, and the line "synthetic documents, not real records"; run **full suites**.
**Files:** `ai/evaluation/run_eval.py`, `docs/ai-pipeline.md`.
**Done:** numbers are measured and reproducible by one command. If Tesseract can't run in the sandbox: STATE → Not-run + give the user the one command.

### P42 · Optional adapters (P2)
**Do:** `PaddleOCRProvider`; `LocalVLMProvider` / `RemoteVLMProvider` behind env flags with lazy imports; default stays mock/rules; skip-marked smoke tests; doc notes.
**Files:** `ai/ocr/paddle.py`, `ai/extraction/vlm.py`.
**Done:** app still boots with these deps absent.

### M8 — Differentiators

### P43 · Fuzzy name matching
**Do:** `rapidfuzz` + normalization (honorifics, spacing, Bangla/English digits); `owner_similarity(a, b)`; use in owner resolution (P30) and in `SELLER_MISMATCH` to emit "possible name variant — review" instead of a hard mismatch; similar names never auto-merge unless father_name matches and score ≥ 0.9; tests (Rahim / Rahim Uddin / রহিম).
**Files:** `backend/app/services/names.py`, tests.
**Done:** documented thresholds; no false auto-merge in tests.

### P44 · Ownership graph API
**Do:** `GET /lands/{id}/graph` → `{nodes, edges}` derived from relational data (R5); node types Person/Land/Deed/Transaction; flagged transactions mark edges `flagged:true`; tests.
**Files:** `backend/app/services/graph.py`, `api/v1/lands.py` (extend), tests.
**Done:** LP-10240 graph shows both Rahim→Karim and Rahim→Hasan, flagged.

### P45 · Ownership graph UI
**Do:** React Flow; custom nodes; manual left→right column layout (no layout lib); legend; click node → detail panel; flagged edges red + text label (not color only); mobile: pannable + list fallback.
**Files:** `frontend/features/graph/*`.
**Done:** UI-DoD.

### P46 · QR + public page
**Do:** `GET /public/verify/{land_id}` returning the **PublicSafe** payload only (R4); QR via `qrcode.react` encoding `/{locale}/v/{land_id}` URL only; QR on report page; public page `/[locale]/v/[landId]`; rate limit; tests assert no names/hashes/paths in payload.
**Files:** `backend/app/api/v1/public.py`, `frontend/features/qr/*`, `app/[locale]/v/[landId]/page.tsx`.
**Done:** API-DoD + UI-DoD; leak test green.

### P47 · PDF export
**Do:** "Download PDF" via print stylesheet (D10); `scripts/export_report_pdf.py` using Playwright `page.pdf()` to produce a demo-backup PDF; verify Bengali shaping visually.
**Files:** `scripts/export_report_pdf.py`, report page button.
**Done:** PDF opens with correct Bangla text.

### P48 · Isolation Forest
**Do:** `ai/fraud_detection/`: feature builder (R3 features); seeded synthetic training generator (normal vs injected anomalies); scikit-learn IsolationForest; save `models/iforest.joblib`; `score(features)->0..1`; evaluate precision/recall on held-out synthetic split; append results to `docs/ai-pipeline.md`; no production claims.
**Files:** `ai/fraud_detection/*`, tests.
**Done:** reproducible training command; measured metrics recorded.

### P49 · ML into risk engine
**Do:** add ML contribution (cap +15, cannot alone create HIGH); model missing → skip silently + log; evidence `ML_ANOMALY`; `LOW_EXTRACTION_CONFIDENCE` adds a review flag (no points); store `ml_score`; show ML line in RiskCard (i18n); tests.
**Files:** `backend/app/risk/scoring.py` (extend), `frontend/features/risk/*`.
**Done:** scenarios in R7 keep expected levels with ML on and off.

### P50 · GIS map
**Do:** `geometry` GeoJSON on land_parcels (seed synthetic polygons around a fictional area); `GET /lands/map` → FeatureCollection with public-safe props; Leaflet map (lazy-loaded; works with blank background offline); popup: Land ID, Dag, Khatian, Area, Status, Risk, View Details; risk filter.
**Files:** `backend/app/api/v1/map.py`, `frontend/features/map/*`.
**Done:** UI-DoD; no personal data in popups.

### M9 — Hardening + delivery

### P51 · Security A
**Do:** security headers (CSP baseline, X-Frame-Options, Referrer-Policy) on Next + API; rate limits on auth/upload/public (R4); JWT/cookie flag checks; strict CORS; upload limits review (pixel/page caps); secrets grep + `.gitignore` check; fix findings; tests.
**Files:** `backend/app/core/{ratelimit.py, headers.py}`, `frontend/next.config.*`, tests.
**Done:** findings list in `docs/security.md` (what was checked, what was fixed).

### P52 · Security B
**Do:** authz matrix test auto-generated from OpenAPI (every route × every role vs R4); leak tests (no `nid_hash`, `contact_hash`, `password_hash`, `file_path`, forbidden `father_name`); injection/XSS payload sanity; every write route has an audit entry (test); log redaction.
**Files:** `backend/tests/security/*`.
**Done:** all green; failures fixed, not skipped.

### P53 · i18n audit
**Do:** run parity script; scan JSX for hardcoded user strings; forbidden-wording scan (R3); check Bangla overflow at 360 px; locale-aware dates/numbers (`bn-BD`) for UI numerals while document values stay original.
**Files:** `frontend/scripts/*`, message files.
**Done:** zero missing keys, zero hardcoded strings.

### P54 · Accessibility + responsive
**Do:** axe checks on key pages (home, verify, result, report, login, review, dashboard); fix focus order, labels, contrast, tap targets ≥ 44 px; fix P0/P1 issues only.
**Files:** touched components + a11y test file.
**Done:** no serious/critical axe violations.

### P55 · E2E A
**Do:** Playwright (chromium only); API-login fixtures; tests: citizen verifies clean land · EN↔BN switch · mobile viewport flow · unauthorized access to officer/admin routes.
**Files:** `frontend/e2e/*`, `playwright.config.ts`.
**Done:** `npm run e2e` green (or NOT RUN + command if browser can't install).

### P56 · E2E B
**Do:** officer flow: upload → extraction visible → edit → approve → conflicting upload → alert → risk report.
**Files:** `frontend/e2e/officer.spec.ts`.
**Done:** green using mock providers + seed reset.

### P57 · Docker + Postgres smoke (P1)
**Do:** `docker-compose.yml` (frontend, backend, postgres), Dockerfiles, healthchecks, migrate+seed on start; run backend tests against Postgres via `DATABASE_URL`; fix portability bugs; AI heavy deps excluded from images (documented).
**Files:** `docker-compose.yml`, `*/Dockerfile`.
**Done:** `docker compose up` yields working demo, or NOT RUN + commands.

### P58 · Documentation
**Do:** README per R9 list; `docs/architecture.md` (Mermaid diagrams); `docs/api.md` (link to OpenAPI + 5 curl examples); `docs/security.md`; finish `docs/ai-pipeline.md`; limitations + roadmap.
**Files:** `README.md`, `docs/*`.
**Done:** a new developer can run the demo using README only.

### P59 · Demo script + reset + rehearsal
**Do:** `scripts/demo_reset.sh` (reset DB + seed + clear uploads); `docs/demo-script.md` with the 15-step flow (R7) and 5-minute timing; confirm everything works offline with mock providers; list backup screenshots/PDF; fix the **top 5** friction points only.
**Files:** `scripts/demo_reset.sh`, `docs/demo-script.md`.
**Done:** rehearsal checklist ticked.

### P60 · Final acceptance 🔒
**Do:** full backend + frontend + e2e runs; tick R10; tag version in STATE; final zip.
**Done:** every R10 box ticked or consciously listed under Known Limitations.

---

## R1. Repository layout

```text
landshield/
├── frontend/   (app/[locale]/, components/{ui,domain}/, features/, lib/, messages/{en,bn}.json, e2e/, scripts/)
├── backend/    (app/{api/v1,core,models,schemas,services,risk,workers}/, migrations/, tests/)
├── ai/         (preprocessing/, ocr/, extraction/, fraud_detection/, evaluation/, fonts/)
├── database/   (seed/, sample_data/)
├── docs/  scripts/  docker-compose.yml  .env.example  README.md  plan.md
```
Adapt to the existing repo; record deviations in STATE.

---

## R2. Data model (`*` unique, `→` FK)

```text
users(id, name, email*, password_hash, role, preferred_language, is_active, created_at, updated_at)
land_parcels(id, land_id*, district, upazila, mouza, dag_no, khatian_no, area, area_unit, geometry[JSON GeoJSON, null], status, created_at, updated_at)
   unique(district, upazila, mouza, khatian_no, dag_no)
owners(id, name, father_name, nid_hash, contact_hash, created_at, updated_at)
documents(id, land_id→, document_type, file_path, file_hash, ocr_text, ocr_confidence, extraction_json, processing_status, uploaded_by→, created_at)
deeds(id, land_id→, deed_no, seller_id→, buyer_id→, transaction_date, area, area_unit, document_id→, status, created_at)
transactions(id, land_id→, seller_id→, buyer_id→, transaction_type, transaction_date, area, area_unit, source_document_id→, risk_score, status, created_at)
ownership_history(id, land_id→, owner_id→, start_date, end_date, source_transaction_id→, confidence, created_at)
verification_requests(id, land_id→, requested_by→, status, risk_score, result_summary, created_at, completed_at)
risk_assessments(id, land_id→, verification_id→, overall_score, risk_level, rule_score, ml_score, evidence_json, created_at)
fraud_alerts(id, land_id→, transaction_id→, alert_type, severity, risk_score, evidence[JSON], status, reviewed_by→, created_at)
audit_logs(id, actor_id→, action, entity_type, entity_id, old_value, new_value, ip_hash, created_at)
```
Rules: UUID string ids · UTC timestamps · enums stored as strings · DB values are language-neutral codes · `*_hash` columns are salted hashes, never raw.

---

## R3. Risk engine

**Evidence schema:** `{ "code": "POSSIBLE_DUPLICATE_TRANSACTION", "severity": "HIGH", "params": {...} }` — backend never emits translated text.

| Code | Trigger | Points | Severity |
|------|---------|--------|----------|
| POSSIBLE_DUPLICATE_TRANSACTION | ≥ 2 non-rejected transactions on the same parcel with the same seller where the first conveys the seller's full recorded area, or total conveyed area > seller's recorded area | 40 | HIGH |
| SELLER_MISMATCH | Seller ≠ recorded owner at transaction date (name-variant → review note, P43) | 30 | HIGH |
| DUPLICATE_DEED | Same deed_no used by a different transaction | 30 | HIGH |
| INCONSISTENT_OWNERSHIP | Gaps/overlaps in ownership_history periods | 20 | MEDIUM |
| AREA_MISMATCH | Document area ≠ previous recorded area (same unit) | 15 | MEDIUM |
| REPEATED_SUSPICIOUS_TRANSACTIONS | Repeated transfers of the same parcel in a short window | 20 | MEDIUM |
| UNIT_MISMATCH | Different area units — flag only, no conversion | 0 | INFO |
| LOW_EXTRACTION_CONFIDENCE | Any required field below threshold | 0 | INFO |
| ML_ANOMALY (P49) | Isolation Forest score | 0–15 (cap) | INFO |

**Score:** sum of points, cap 100. `0–29 LOW · 30–59 MEDIUM · 60–100 HIGH`. Weights live in one config file. ML can never alone produce HIGH.
**ML features (P48):** transaction_count, ownership_duration, area_difference, seller_history_count, buyer_history_count, owner_similarity, document_similarity, duplicate_deed_signal.
**Wording (enforced by test):** allowed — "potential inconsistency", "possible duplicate transaction", "review required", "high-risk indicator", "ownership conflict detected". **Forbidden** — "fraud confirmed", "proven", "forged", "illegal", "guilty". Every score shows its evidence.
**Similar names** are never treated as the same person without a supporting identifier.

---

## R4. Security, roles, statuses, thresholds

**Roles:** CITIZEN · REVIEWER · OFFICER · ADMIN.

| Action | CITIZEN | REVIEWER | OFFICER | ADMIN |
|--------|:-:|:-:|:-:|:-:|
| Search/verify land, view own reports | ✓ | ✓ | ✓ | ✓ |
| Upload documents | ✗ | ✗ | ✓ | ✓ |
| Edit/approve/reject extractions | ✗ | ✓ | ✓ | ✓ |
| Dashboard, queue, risk alerts (view + update) | ✗ | ✓ | ✓ | ✓ |
| Audit logs (read) | ✗ | ✗ | ✓ | ✓ |
| Users, all-records admin tables | ✗ | ✗ | ✗ | ✓ |
| Public QR page | no login | | | |

**Data exposure:**
- Never in any API response: `password_hash`, `nid_hash`, `contact_hash`, server `file_path`.
- Authenticated citizen view: land fields, owner display names (synthetic), no `father_name`.
- Officer/reviewer/admin: names + `father_name`; still no hashes.
- **PublicSafe (QR) payload:** land_id, district/upazila/mouza, status, risk level, counts, last-verified timestamp. **No names.**
- NID is not displayed anywhere in the MVP.

**Rate limits (defaults):** auth 10/min/IP · upload 20/hour/user · public 60/min/IP.
**Statuses:**
- document: `UPLOADED PROCESSING EXTRACTED REVIEW_REQUIRED APPROVED REJECTED FAILED`
- transaction: `RECORDED FLAGGED REJECTED`
- alert: `OPEN UNDER_REVIEW DISMISSED ESCALATED`
- verification: `PENDING COMPLETED FAILED`
- land: `ACTIVE REVIEW_REQUIRED`

**Extraction:** 13 fields — owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_no, deed_date, seller, buyer. Required for approval: khatian_no, dag_no, mouza, district, upazila, land_area+area_unit, deed_no, seller, buyer. Confidence bands: `≥ 0.90 green · 0.85–0.90 amber · < 0.85 red/low` (`REVIEW_CONF_THRESHOLD=0.85`). **Every document needs human approval regardless of confidence.**

---

## R5. API (prefix `/api/v1`) & report/graph specs

```text
Auth      POST /auth/register|login|refresh|logout   GET /auth/me
Lands     GET /lands/search   GET /lands/{id}   GET /lands/{id}/ownership|transactions|risk|graph   GET /lands/map
Documents POST /documents/upload   GET /documents/{id}   POST /documents/{id}/process|approve|reject|reprocess
          GET|PATCH /documents/{id}/extraction
Verify    POST /verification   GET /verification/{id}   GET /verification/{id}/report
Risk      GET /risk-alerts   PATCH /risk-alerts/{id}
Officer   GET /officer/stats|queue|activity
Admin     GET /admin/audit-logs   GET|PATCH /admin/users
Public    GET /public/verify/{land_id}
Health    GET /health
```
**Report sections:** overall status · risk score + level · land information · ownership · document consistency · transaction history · risk evidence · disclaimer · verification timestamp · QR (P46).
**Graph:** `nodes[{id,type,label,props}]`, `edges[{source,target,type,flagged}]`; node types Person/Land/Deed/Transaction; edge types OWNS, SOLD, BOUGHT, REFERS_TO, TRANSFERRED.

---

## R6. UI / i18n

- **Look:** modern civic-tech. White/light surfaces; dark navy primary; green = verified, amber = review, red = critical, gray = pending/info; 8–16 px radius; restrained shadows; no gradients/glass/animation excess.
- **Fonts:** Inter (EN), Noto Sans Bengali (BN). Routes `/en/...`, `/bn/...`.
- **i18n:** namespaced keys; `status.*`, `risk.level.*`, `risk.evidence.<CODE>` map backend codes to text (e.g. `HIGH → High / উচ্চ`, `REVIEW_REQUIRED → Review Required / যাচাই প্রয়োজন`). Document values shown exactly as extracted.
- **States everywhere:** loading ("Processing…"), empty ("No records found."), error ("We couldn't process this document. Please check the file and try again."), permission ("You don't have permission to perform this action."), low-confidence ("Low-confidence extraction. Human review required.") — each with a BN key.

---

## R7. Demo dataset & scenario

All names/IDs synthetic. Label everywhere: *Demo Dataset — Not an Official Government Land Record.*

| Land ID | Scenario | Setup | Expected |
|---------|----------|-------|----------|
| LP-10001 | CLEAN | Single owner, no transactions | LOW, no alerts |
| LP-10100 | NORMAL_CHAIN | Rahim → Karim → Hasan, consistent dates/areas | LOW |
| LP-10234 | LIVE_DEMO | Dag 785, Khatian 1245, 10 decimal, recorded owner Rahim, **no transactions**; Doc1/Doc2 are upload fixtures | after Doc1: LOW · after Doc2: HIGH (70) |
| LP-10240 | DOUBLE_SALE (pre-baked) | Rahim → Karim and Rahim → Hasan both present | HIGH: DUPLICATE_TX + SELLER_MISMATCH |
| LP-10300 | AREA_MISMATCH | Recorded 10 decimal, new document 12 decimal | LOW (15) + AREA_MISMATCH |
| LP-10400 | SELLER_MISMATCH | Recorded owner Karim, document seller Rahim | MEDIUM (30) |
| LP-10500 | DUPLICATE_DEED | Same deed_no on two different transactions | MEDIUM (30) |

**Doc1:** LP-10234 · Dag 785 · Khatian 1245 · 10 decimal · Seller Rahim · Buyer Karim.
**Doc2:** same land/dag/khatian/area · Seller Rahim · Buyer Hasan.
**After Doc2 the UI shows** "POSSIBLE CONFLICTING TRANSACTION" with evidence: same land · same Dag · same Khatian · same seller · overlapping transaction history. Never "fraud confirmed."

**Demo accounts:** `citizen@`, `reviewer@`, `officer@`, `admin@demo.landshield.test`; password from `DEMO_PASSWORD` (never committed).

**15-step demo flow:** 1 open LandShield · 2 show bilingual UI · 3 upload Doc1 · 4 show OCR · 5 show AI extraction · 6 show confidence · 7 approve · 8 show ownership history · 9 upload Doc2 · 10 possible double-sale alert · 11 ownership graph · 12 risk score · 13 verify as citizen · 14 bilingual report · 15 QR verification. Must work offline with mock providers.

**5-min pitch:** 0:00 problem · 0:30 LandShield intro · 1:00 paper→OCR→AI→record · 2:00 conflicting transaction · 3:00 graph + risk report + citizen verify · 4:00 architecture · 4:40 closing line: *"Land records should not only be digital. They should be searchable, connected, verifiable, and risk-aware."*

---

## R8. Environment variables (`.env.example`)

```text
DATABASE_URL=sqlite:///./landshield.db
JWT_SECRET=
JWT_ACCESS_MINUTES=15
CORS_ORIGINS=http://localhost:3000
STORAGE_PATH=./storage
OCR_PROVIDER=mock            # mock | tesseract | paddle
DOCUMENT_AI_PROVIDER=mock    # mock | rules | vlm | remote
DOCUMENT_AI_MODEL=
EMBEDDING_MODEL=             # unused until P2
REVIEW_CONF_THRESHOLD=0.85
PREPROCESS=off
DEMO_PASSWORD=
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## R9. Product text & README checklist

**Tagline:** EN *Digital Land Verification & Risk Intelligence* · BN *ডিজিটাল ভূমি যাচাই ও ঝুঁকি বিশ্লেষণ*
**Demo label BN:** *ডেমো ডেটাসেট — সরকারি ভূমি রেকর্ড নয়।*
**Disclaimer EN:** LandShield provides digital record organization, consistency checks, and risk indicators. It does not establish legal ownership, certify title, or replace official government/legal verification.
**Disclaimer BN:** ল্যান্ডশিল্ড ডিজিটাল রেকর্ড সংগঠন, সামঞ্জস্য যাচাই ও ঝুঁকি-নির্দেশক প্রদান করে। এটি আইনগত মালিকানা প্রতিষ্ঠা করে না, স্বত্ব প্রত্যয়ন করে না, এবং সরকারি/আইনগত যাচাইয়ের বিকল্প নয়।
**README sections:** overview · problem · solution · features · architecture · tech stack · AI pipeline · database · setup · env vars · demo accounts · demo dataset · testing · security · limitations · roadmap · demo instructions.

---

## R10. Final acceptance checklist (P60)

- [ ] Landing, verify, result, report pages polished (desktop/tablet/mobile)
- [ ] Upload → OCR → extraction → human review → approve works (real pipeline or mock fallback)
- [ ] Ownership history + transactions correct; double-sale detected with evidence
- [ ] Risk score explainable; wording rules pass
- [ ] Officer dashboard, alerts, audit log work; RBAC matrix test green
- [ ] QR public page leaks no personal data
- [ ] EN + BN complete; no hardcoded strings; switching works
- [ ] Loading / empty / error states present; a11y checks pass
- [ ] AI metrics are measured, documented, synthetic-labelled; no fabricated claims
- [ ] Demo scenarios + 15-step flow rehearsed; works without any external API
- [ ] README lets a new developer run the demo

**Out of scope (P2):** official government API integration, digital signatures, cadastral GIS integration, national-scale graph, mobile app, advanced document models, PostGIS/pgvector, embeddings, analytics page.

---

## Appendix — what changed from v1
- 2,400 lines → compact plan; Claude reads only §0–§4 + the current card + cited `R*` sections.
- 23 coarse phases → 60 small phases, each sized for one free-tier chat; explicit stop/split rule.
- Backend and risk engine moved ahead of OCR; two demo checkpoints (P22, P30).
- Mock pipeline first, real OCR/extraction after; PostGIS/pgvector/embeddings/VLM deferred.
- Added: honest "NOT RUN" handling when the sandbox can't install/run tools, synthetic document generator, approval-posting transaction semantics (`FLAGGED` doesn't update ownership), evidence-code i18n, PublicSafe payload, authz-matrix + leak tests.
