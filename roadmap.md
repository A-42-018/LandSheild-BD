# LandShield BD — LandTech 2026 Roadmap (v2: features + trusted-governance UI)

> Requirements: *LandTech 2026 Rule Book* (Project_Guideline.pdf) · Track: Digital Land Records, Verification & Digitization · **Problem statement: P3** (P1/P2/P4/P5 as supporting modules).
> Tracker: `plan.md` · Old build log: `docs/history/plan-v90.md` · Demo data only, not a government system. Roadmap only — no code here.
>
> **How to use this file in a session:** do NOT read it whole. Run `grep -n "^### " roadmap.md`, then view only the card for your phase (and §4 design spec lines if the card says so).

---

## 1. Dates

| Milestone | Date |
|---|---|
| Registration (choose **P3**) | 06 Oct 2026 |
| Round 1 submission: concept note ≤ 4 p PDF, repo + README, video ≤ 3 min, live link | **16 Oct 2026** (target 15 Oct) |
| Final Round (5 min pitch + demo, 3 min Q&A, pitch deck ≤ 10 slides) | TBA |

---

## 2. Requirement match (audit of v90, 06 Oct)

| Req | Status | Gap → phase |
|---|---|---|
| P3 same plot sold twice | ✅ | — |
| P3 rapid transfers | ✅ | wording only → F6 |
| P3 registration ↔ mutation mismatch | ❌ | F1a–F1c |
| P3 forged documents | 🟡 | F4a–F4c, F6 |
| P2 QR / hash / signature / ledger | 🟡 QR only | F4a–F4c |
| P4 deed → mutation workflow, auto checks, status tracking | ❌ | F2a–F2c |
| P5 ownership | ✅ | — |
| P5 mutation history, pending cases, khas/acquisition, "check before you buy" | ❌ | F1c, F3a, F3b |
| P1 khatian/porcha, CS/SA/RS/BS, Bangla OCR metrics, search | 🟡 | F5a–F5c |
| §8 no real personal data | ⚠️ `backend/tests/data/saf_kabala_ocr.txt` looks real | **G0** |
| §9.2 AI disclosure, §7.2 credits, §12.3 licence | ❌ | G1 |
| §10.1 concept note, video, live link | ❌ / 🟡 | S1–S3 |
| UI credibility as an e-governance product | 🟡 looks like SaaS | U1–U7 |

---

## 3. Session sizing rules (Sonnet 5.5, one 5-hour free-tier window per phase)

- **One phase = one new chat.** Attach the latest zip. Kickoff prompt is in `plan.md`.
- Phase budget: **≤ 6 files changed, ≤ ~200 LOC, ≤ ~25 tool calls.** Every card lists exactly which files to read and touch, so no repo exploration is needed.
- Read only: `plan.md` STATE + this phase's card (+ §4 lines named in the card). Never read `prompt.md`, `docs/history/`, or whole message JSON files (grep keys instead).
- Tests: run only the card's **Test** line. Full suites only in gate phases (🔒).
- If the window is running out: stop at a green state, mark the phase 🟡 in `plan.md` with the exact remaining steps as `<phase>-b`, zip.
- End: update `plan.md` (STATE + status), then one zip (command in `plan.md`).

**Sandbox notes (learned 06 Oct):**
- Backend setup: `cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e ".[dev]"` (~1 min).
- Frontend setup: `cd frontend && npm ci --ignore-scripts` (~10 s).
- Live run for screenshots: backend `JWT_SECRET=<40 chars> DEMO_PASSWORD='LandShield2026!' alembic upgrade head && PYTHONPATH=.. python ../scripts/seed.py && PYTHONPATH=.. uvicorn app.main:app --port 8001`; frontend `.env.local` → `NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api/v1`, `npx next dev -p 3000`.
- Open the site as **`http://localhost:3000`** (not 127.0.0.1) or login fails on CORS.
- Playwright screenshots: launch with `executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'` (full Chromium fails in old headless mode). Never run `playwright install`.
- Delete `frontend/.env.local` and `backend/.env` before zipping.

---

## 4. UI design spec — "Formal Green" trusted-governance style

### 4.1 Diagnosis (current v90 UI)
| Problem | Why it hurts for e-governance |
|---|---|
| Navy→blue gradients, frosted-glass header, soft shadows, 12–20 px radii | Reads as startup/fintech, not public service |
| Glossy 3D logo with laurel wreath + country map + satellite | Clip-art look, unreadable at 40 px; laurel + map resembles an official emblem → conflicts with "not a government system" |
| Hero = half-screen logo card | First screen should be the service (search), not branding |
| Stats "13 fields / 2 languages / 6 steps / 7 parcels" | Developer metrics, no citizen value |
| Every section = identical white rounded cards | No hierarchy, "card fatigue" |
| English default, EN before BN, dark mode follows OS | Government portals are Bangla-first, light by default |
| No page header pattern (breadcrumb, record ID, last updated) | Missing trust signals that official records show |

### 4.2 Principles
1. **Service first:** the first screen lets a citizen start a task (verify land, check before buying, track mutation, verify a document).
2. **Formal, flat, calm:** solid colours, 1 px borders, 4–6 px radii, almost no shadows, no gradients, no glass, no decorative animation.
3. **Bangla first:** `bn` default locale, বাংলা before English in the switcher, Bangla typography tuned.
4. **Status = icon + text + colour,** never colour alone (already an a11y rule; keep it).
5. **Trust signals everywhere:** record/land ID, "data as of" date, verification timestamp, reference number, QR, version + demo notice.
6. **Look e-governance-ready, never official:** NO Government of Bangladesh emblem (Shapla), NO "Government of the People's Republic of Bangladesh" wording, NO gov.bd-like domain, NO laurel/emblem-like logo. Keep the demo notice on every page.

### 4.3 Colour tokens (light) — existing variable names keep working
| Variable (globals.css) | New value | Hex | Use |
|---|---|---|---|
| `--primary` | `0 106 78` | #006A4E | buttons, header bar, active nav, links on dark |
| `--primary-fg` | `255 255 255` | #FFFFFF | text on primary |
| `--primary-soft` | `230 242 237` | #E6F2ED | selected rows, soft chips |
| new `--primary-hover` | `0 86 63` | #00563F | hover/pressed |
| new `--link` | `15 61 122` | #0F3D7A | inline links (navy keeps links distinct from buttons) |
| `--ink` | `14 31 54` | #0E1F36 | body text (unchanged) |
| `--ink-muted` | `74 93 120` | #4A5D78 | secondary text (unchanged) |
| `--surface` | `255 255 255` | #FFFFFF | cards, page sections |
| `--surface-muted` | `244 247 245` | #F4F7F5 | page background, alternate sections |
| `--line` | `213 222 217` | #D5DED9 | borders, table rules |
| `--verified` / `-soft` | `11 110 52` / `225 244 232` | #0B6E34 | always with ✓ icon + label (close to primary on purpose) |
| `--review` / `-soft` | unchanged | #8F5400 | amber, pending/review |
| `--critical` / `-soft` | unchanged | #C21F26 | high risk / errors ONLY, never decorative |
| `--pending` / `-soft` | unchanged | #4F5F75 | neutral status |
| new `--strip` | `14 31 54` | #0E1F36 | top demo/utility strip |
| new `--accent` | `176 132 20` | #B08414 | thin gold rule under header + focus accents (sparingly) |
| `--header-from/to`, `--glass-*`, `--grad-*` | set all to the flat primary/surface values | — | kept only so old classes don't break; gradients become flat |

**Dark mode (secondary, opt-in only):** surface #121A2B, muted #090E1A, line #2C3952, ink #E8EEF7, primary #4CC38A (on dark), primary-fg #062016, link #8DB8F5; statuses keep current dark values. Header stays solid #00563F in dark.
**Contrast must be checked** (≥ 4.5:1 text, ≥ 3:1 UI borders/icons) with a small script and written to `docs/ui.md`.

### 4.4 Shape, type, spacing
| Item | Spec |
|---|---|
| Radius | `md` 4 px (inputs, buttons, chips), `lg` 6 px (cards, modals), `xl`/`2xl` → 8 px max |
| Shadow | `card`: none (use border); `raised`: `0 2px 8px rgb(ink/0.08)` only for menus, modals, map overlays |
| Borders | 1 px `--line` on every card/table; 3 px `--primary` top rule only on page-level "record" cards (report, result summary) |
| Fonts | Bangla: Noto Sans Bengali (keep); Latin: Inter (keep). Bangla `line-height` 1.7 for body, 1.35 headings; never letter-spacing on Bangla |
| Headings | H1 2rem/700 (BN 1.875rem), H2 1.5rem/700, H3 1.125rem/600; colour `--ink` (not primary) |
| Container | max-width 1200 px, 16 px mobile gutter, 24 px desktop |
| Section rhythm | 48 px vertical padding desktop, 32 px mobile; alternate `--surface` / `--surface-muted` sections instead of cards-in-cards |
| Icons | lucide-react 20 px, stroke 1.75, colour `--ink-muted` (or status colour inside status chips) |
| Motion | none except 150 ms colour transitions; respect reduced motion (already) |

### 4.5 Layout patterns
1. **Top strip (32 px, `--strip`, white 13 px text):** left "ডেমো ই-গভর্নেন্স প্রোটোটাইপ · সরকারি ওয়েবসাইট নয়" / "Demo e-governance prototype · Not a government website"; right: text-size control (A− A A+), language switch (বাংলা | English).
2. **Header (64 px, solid `--primary`, 2 px `--accent` bottom rule):** flat logo mark + "LandShield BD" + Bangla sub-line "ডিজিটাল ভূমি যাচাই"; service nav: Verify land · Check before you buy · Track mutation · Verify document · Map; right: sign-in / user menu. Mobile: hamburger → full-width sheet. No glass, no gradient.
3. **Page header (every inner page):** breadcrumb (Home › Verify land › Result), H1, one-line purpose, right-side meta "Data as of 06 Oct 2026 · Ref LS-2026-000123".
4. **Record card (result/report):** 3 px primary top rule, two-column definition list (label muted, value ink), land ID in mono, status chip top-right, QR bottom-right.
5. **Footer (`--ink` background, white text):** 4 columns — Services, About (how it works, data sources, disclaimer), Help (FAQ, accessibility, contact placeholder `support@landshield.demo`), Legal (privacy, terms, licence); bottom line: version, "Last updated", demo notice. No real phone numbers.
6. **Forms:** labels above inputs, 44 px controls, required `*` + text, inline error under field, primary button full width on mobile.
7. **Tables:** header row `--surface-muted`, 1 px rules, zebra off, numeric right-aligned, Bangla numerals in `bn`.

### 4.6 Brand mark
- Replace the glossy PNG logo with a **flat 2-colour SVG**: simple shield outline + 3×3 parcel grid with one cell ticked (✓), colours `--primary` + white (+ optional `--accent` tick). No map silhouette, no laurel, no satellite, no red dot.
- Files: `frontend/public/brand/logo-mark.svg` (square), `logo-full.svg` (mark + wordmark "LandShield BD" + "ডিজিটাল ভূমি যাচাই"), `app/icon.png` regenerated from the mark. Keep old PNGs in `public/brand/legacy/` (not referenced).

### 4.7 Landing page information architecture (new)
1. **Hero (`--surface-muted`, no image):** H1 "জমি কেনার আগে যাচাই করুন" / "Verify land before you buy" · one-line sub · **inline search form** (District · Upazila · Mouza · Khatian · Dag or Land ID → "যাচাই করুন") · small text link "Track a mutation".
2. **Service tiles (4, icon + title + one line + arrow):** Verify land record · Check before you buy · Track mutation · Verify a document copy. (Tiles for routes not built yet are hidden behind a flag until their F-phase lands.)
3. **What we check (replaces Stats):** 6 checklist items with icons — double sale, seller is recorded owner, mutation status, pending cases, khas/acquisition, document authenticity.
4. **How it works:** 5 numbered steps on one horizontal line (vertical on mobile): Scan → Extract → Human review → Risk check → Report + QR.
5. **For officers:** short band — upload, review queue, e-Mutation, audit log — with "Officer sign-in".
6. **Trust & disclaimer band:** human review, evidence for every score, audit trail, synthetic data, not a legal decision.
7. Footer.

### 4.8 Page-by-page changes
| Page | Change |
|---|---|
| Login | Plain centred form card (no logo card wrapper), small flat mark above, demo-accounts hint box (demo only), notice line |
| Verify | Page header + form card; recent searches optional |
| Result | Record card + risk summary chip + tabs (Ownership · Transactions · Mutation · Cases/Encumbrance · Evidence) |
| Report (print) | Letter-style header: mark, title, ref no, date, QR; sections numbered; footer "Generated by LandShield BD demo — not an official record" |
| Public QR page | Minimal record card: land ID, risk level chip, signature valid/invalid, data-as-of, counts only |
| Officer dashboard | Left sidebar (white, 1 px border, active item green bar), flat KPI tiles (number + label + small status icon), tables per §4.5 |
| Review | Two panes with 1 px divider; confidence chips (icon + %); sticky action bar |
| Map | Overlay panel flat (white, border, 6 px radius), header bar primary, legend bottom-right |
| About | How it works, architecture image, data sources, AI disclosure, limitations |

### 4.9 Accessibility & quality bar
WCAG 2.1 AA: contrast table in `docs/ui.md`; visible focus ring (2 px `--accent` + 2 px offset); 44 px touch targets (keep P54); text-size control works to 125 % without horizontal scroll at 360 px; axe 0 violations (existing `tests/a11y.test.tsx`); EN/BN parity (`npm run check:i18n`).

---

## 5. Phase cards

Legend: **Must** = in minimum submission · **Should** · **Could** · 🔒 gate (full suites).
Common end of every phase: update `plan.md` STATE + status → zip.

### G0 — Replace real-looking deed fixture  [Must · S · backend]
- **Read:** `backend/tests/test_saf_kabala.py`, first 40 lines of `backend/tests/data/saf_kabala_ocr.txt`, `ai/extraction/saf_kabala.py` (regex names only).
- **Do:** rewrite `saf_kabala_ocr.txt` with the same layout/labels but invented content (fictional names e.g. "মোঃ কামাল উদ্দিন" / "শ্রী অনিল কুমার দাস", fictional village, deed no `1234/2001`, khatian `501`, dag `1201`, area `20` decimal); keep OCR-noise lines. Update expected dict in the test. Remove "real PDF / real-layout sample" wording from `ai/extraction/saf_kabala.py` docstring and `docs/ai-pipeline.md` (grep "real").
- **Test:** `cd backend && pytest -q tests/test_saf_kabala.py tests/test_extraction_rules.py && ruff check .`
- **Done when:** tests green; `grep -rni "real-layout\|real pdf" .` (excluding node_modules, docs/history) returns nothing.

### G1 — README compliance + LICENSE  [Must · S · docs only]
- **Read:** `README.md` headings (`grep -n "^#" README.md`), `docs/gis.md` lines 1–20.
- **Do:** add README sections **Problem statement (P3)**, **Data sources** (synthetic seed, `ai/evaluation/make_synthetic.py`, geoBoundaries CC BY 4.0, ifahimreza/bangladesh-geojson ODbL, OSM tiles, FreeSans licence; "no scraping, no government portal access"), **AI tool disclosure** (table: tool · used for · human review — list the assistants you really used), **Credits** (main OSS libs + licences), **Licence**. Add `LICENSE` (MIT, both student names, 2026).
- **Test:** none (docs). Check links with `grep -n "](" README.md`.
- **Done when:** sections present; LICENSE exists.

### U1 — Design tokens "Formal Green"  [Must · S · frontend]
- **Read:** `frontend/app/globals.css` (lines 1–110), `frontend/tailwind.config.ts`, `frontend/tests/ui-regression.test.ts` (find token assertions), roadmap §4.3–4.4.
- **Do:** apply §4.3 values (light + dark + print block); add `--primary-hover`, `--link`, `--strip`, `--accent`; flatten `--header-*`, `--glass-*`, `--grad-*` to solid values; `.header-glass` → solid primary without backdrop-filter; tailwind: add `primary.hover`, `link`, `strip`, `accent` colours, radii per §4.4, `shadow-card: none`-like (border-based) and lighter `raised`; primary 50–900 scale re-derived around #006A4E. Update `ui-regression.test.ts` expectations and the contrast table in `docs/ui.md`.
- **Test:** `cd frontend && npx vitest run tests/ui-regression.test.ts tests/a11y.test.tsx && npx tsc --noEmit`
- **Done when:** tests green; contrast table shows all text pairs ≥ 4.5:1 in light and dark.

### U2 — Flat core components  [Must · S · frontend]
- **Read:** `frontend/components/ui/{Button,Card,Badge,Input,Select,Table,Modal,Tabs}.tsx` (class strings only), roadmap §4.4–4.5.
- **Do:** Button: 4 px radius, solid primary / outline secondary / ghost / danger, hover uses `primary-hover`, no shadows. Card: 6 px radius, 1 px border, no shadow; optional `variant="record"` with 3 px primary top rule. Badge/StatusBadge/RiskBadge: 4 px radius, icon slot kept. Table: muted header, 1 px rules, no zebra. Modal: 6 px radius, `raised` shadow only. Tabs: underline style (2 px primary). Do not change props, roles, aria or testids.
- **Test:** `cd frontend && npx vitest run components && npx tsc --noEmit`
- **Done when:** ui + domain tests green.

### U3 — Top strip, header, footer, light default  [Must · M · frontend]
- **Read:** `frontend/features/landing/{Navbar,Footer}.tsx`, `frontend/components/{HeaderNav,HeaderMenu,LanguageSwitcher,ThemeToggle}.tsx`, `frontend/lib/theme.ts`, `frontend/public/theme-init.js`, `frontend/components/header.test.tsx`; keys via `grep -n '"nav"\|"footer"' frontend/messages/en.json`.
- **Do:** implement §4.5 items 1, 2, 5: new top strip (demo notice + text-size A−/A/A+ stored like theme, try/catch + language switch with বাংলা first); solid primary header with 2 px accent rule, service nav (links only to routes that exist; others added by their F-phase); footer on `--ink` with 4 columns. Theme default = **light** (null → light in `theme.ts` + `theme-init.js`; dark only by explicit toggle; move ThemeToggle into user/overflow menu). Add EN+BN keys.
- **Test:** `cd frontend && npx vitest run components features/landing tests/a11y.test.tsx && npm run check:i18n && npx tsc --noEmit`
- **Done when:** tests green; header usable at 375 px (screenshot optional).

### U4 — Flat logo + Bangla-first  [Must · S · frontend]
- **Read:** `grep -rn "brand/" frontend/features frontend/components frontend/app`, `frontend/i18n/routing.ts`, `frontend/app/[locale]/layout.tsx` (font setup), roadmap §4.4 (fonts) + §4.6.
- **Do:** create `public/brand/logo-mark.svg` + `logo-full.svg` per §4.6 (original design); move old PNGs to `public/brand/legacy/`; replace all references; regenerate `app/icon.png` from the SVG (cairosvg/rsvg or Pillow). Set `defaultLocale: "bn"`. Add Bangla typography rules (`:lang(bn)` line-height 1.7, headings 1.35, no letter-spacing) in globals.css.
- **Test:** `cd frontend && npx vitest run features/landing components tests/a11y.test.tsx && npx tsc --noEmit` (fix tests that assumed `en` default or PNG paths).
- **Done when:** `/` redirects to `/bn`; no reference to legacy PNGs; tests green.

### F1a — Mutation records: model, migration, seed  [Must · M · backend]
- **Read:** `backend/app/models/{transaction,deed,enums,__init__}.py`, newest migration `backend/migrations/versions/0003_*.py` (structure only), `database/seed/loader.py` (how deeds/transactions are inserted), `database/seed/data.json` keys.
- **Do:** `models/mutation.py` → table `mutation_records` (id, mutation_no unique, land_id FK, deed_id FK null, transaction_id FK null, applicant_owner_id FK, previous_khatian_no, new_khatian_no, area, area_unit, ac_land_office, status, checklist JSON null, fast_track bool, applied_at, decided_at null, status_changed_at, source `SEED|WORKFLOW`); `MutationStatus` enum `APPLIED, UNDER_REVIEW, HEARING, APPROVED, REJECTED`. Migration `0004_mutation_records.py` (upgrade + downgrade). Seed: an APPROVED mutation for every existing seeded sale (keeps levels LOW), plus parcels `LP-10600` (sale 2 years ago, no mutation) and `LP-10700` (approved mutation in favour of a third person). Update `seed` test counts.
- **Test:** `cd backend && pytest -q tests/test_seed.py tests/test_models_b.py && alembic upgrade head && alembic downgrade -1 && alembic upgrade head && ruff check .`
- **Done when:** migration round-trips; seed loads; existing tests in the Test line green.

### F1b — Mutation mismatch rules + API  [Must · M · backend]
- **Read:** `backend/app/risk/{context,config}.py`, `backend/app/risk/rules/{__init__,seller}.py` (pattern), `backend/app/api/v1/{__init__,lands}.py`, `backend/tests/security/test_authz_matrix.py` (how routes are listed).
- **Do:** add `mutations` to `LandContext` + loader. `risk/rules/mutation.py`: `REGISTERED_NOT_MUTATED` (15, MEDIUM, sale older than `MUTATION_GRACE_DAYS=180` without approved mutation), `MUTATION_PARTY_MISMATCH` (30, HIGH), `MUTATION_WITHOUT_DEED` (30, HIGH), `MUTATION_AREA_EXCEEDS_DEED` (15, MEDIUM, unit-normalized). Weights in `config.py`. `GET /lands/{land_id}/mutations` (same roles as `/ownership`; citizens get status/dates/khatian only). Add to authz matrix.
- **Test:** `cd backend && pytest -q tests/test_risk_rules_a.py tests/test_risk_rules_b.py tests/test_risk_scoring.py tests/security/test_authz_matrix.py tests/integration && ruff check .` + new `tests/test_mutation_rules.py`.
- **Done when:** LP-10600 MEDIUM, LP-10700 HIGH; LP-10001…LP-10500 levels unchanged; Doc1→Doc2 still HIGH 70.

### F1c — Mutation history UI  [Must · S · frontend]
- **Read:** `frontend/features/result/{ResultView,TransactionsTable,types}.tsx`, `frontend/features/risk/evidence.ts`, `frontend/tests/risk-wording.test.ts`.
- **Do:** `features/result/MutationTable.tsx` (mutation no, status chip with icon, applied/decided dates, khatian old→new, office) + fetch in ResultView (TanStack Query pattern used by TransactionsTable); evidence labels for the 4 new codes EN+BN (wording-safe: "possible", "not yet recorded").
- **Test:** `cd frontend && npx vitest run features/result features/risk tests/risk-wording.test.ts && npm run check:i18n && npx tsc --noEmit`
- **Done when:** result page shows mutation table + new evidence text.

### F2a — e-Mutation workflow backend  [Must · M · backend]
- **Read:** `backend/app/services/posting.py` (`post_document`), `backend/app/services/audit.py`, `backend/app/models/mutation.py`, `backend/app/core/rbac.py` (role helpers).
- **Do:** `services/mutation.py`: `create_from_posting()` called at end of `post_document` → APPLIED, WORKFLOW; `run_prechecks()` → checklist JSON: seller is recorded owner · no open HIGH alert · no active case (`"NOT_CHECKED"` until F3a) · not khas/acquisition (`"NOT_CHECKED"`) · area ≤ seller holding · document human-approved. All pass → `UNDER_REVIEW` + `fast_track=True`; any fail → `HEARING`. `transition(id, to, actor, reason)` with allowed-transition map, reason required for REJECTED/HEARING, audit row each time; APPROVED re-runs risk. Endpoints `api/v1/mutations.py`: `GET /mutations?status=` (REVIEWER+), `GET /mutations/{id}`, `POST /mutations/{id}/transition` (OFFICER+). Register router; authz matrix.
- **Test:** new `tests/test_mutation_workflow.py` + `pytest -q tests/integration tests/security/test_authz_matrix.py tests/security/test_audit_coverage.py && ruff check .`
- **Done when:** Doc1 approve → mutation fast-tracked; Doc2 approve → HEARING with failed checks listed.

### F2b — Officer mutation queue + detail UI  [Must · M · frontend]
- **Read:** `frontend/features/officer/{OfficerShell,QueueTable}.tsx`, `frontend/app/[locale]/officer/review/[id]/page.tsx` (page pattern), `frontend/features/review/{RejectModal,useReviewActions}.ts(x)` (modal + mutation hook pattern).
- **Do:** `features/mutation/` → `MutationQueue.tsx` (status tabs, fast-track badge, days-in-status), `MutationDetail.tsx` (checklist with pass/fail/not-checked icons, linked deed, timeline, Approve / Send to hearing / Reject with reason modal), `useMutations.ts`, `types.ts`; pages `officer/mutations/page.tsx` + `officer/mutations/[id]/page.tsx`; sidebar entry; EN+BN.
- **Test:** new `features/mutation/mutation.test.tsx` + `npx vitest run features/officer features/mutation && npm run check:i18n && npx tsc --noEmit`
- **Done when:** queue and detail render from mocked API; actions call the endpoint.

### F2c — Public mutation tracker  [Should · S · full-stack]
- **Read:** `backend/app/api/v1/public.py`, `backend/app/services/public.py`, `backend/tests/security/test_leaks.py`, `frontend/features/qr/{usePublicVerify,PublicVerifyView}.tsx`.
- **Do:** `GET /public/mutation-status/{mutation_no}` → status, step dates, office, days pending — no names, rate-limited like `/public/verify`. Page `app/[locale]/track/page.tsx` + `features/track/` stepper (Applied → Review → Hearing → Decided). Add header nav link + landing tile flag.
- **Test:** `cd backend && pytest -q tests/test_public.py tests/security/test_leaks.py` · `cd frontend && npx vitest run features/track && npm run check:i18n`
- **Done when:** tracker shows status for a seeded mutation no; leak test covers the new route.

### F3a — Encumbrances: cases, khas, acquisition  [Must · M · backend]
- **Read:** `backend/app/models/mutation.py` (pattern), `backend/app/risk/{context,config}.py`, `backend/app/risk/rules/__init__.py`, `backend/app/services/mutation.py` (`run_prechecks`).
- **Do:** model `land_encumbrances` (id, land_id, type `COURT_CASE|KHAS|ACQUISITION|MORTGAGE`, reference_no synthetic, authority, status `ACTIVE|RESOLVED`, started_at, resolved_at, note); migration `0005`; seed `LP-10800` active case, `LP-10900` khas, `LP-11000` acquisition. Rules `ACTIVE_LITIGATION` (30 HIGH), `KHAS_LAND` (60 HIGH), `UNDER_ACQUISITION` (60 HIGH), `ACTIVE_MORTGAGE` (0 INFO). Fill the two `NOT_CHECKED` pre-checks. `GET /lands/{id}/encumbrances` (+ authz matrix).
- **Test:** new `tests/test_encumbrance.py` + `pytest -q tests/test_seed.py tests/test_risk_scoring.py tests/test_mutation_workflow.py tests/security/test_authz_matrix.py && ruff check .`
- **Done when:** three new parcels HIGH with correct evidence; old levels unchanged.

### F3b — "Check Before You Buy"  [Must · M · full-stack]
- **Read:** `backend/app/services/{land,names,risk}.py` (function names only), `frontend/features/verify/VerifyForm.tsx`, `frontend/features/risk/RiskCard.tsx`.
- **Do:** `GET /lands/{id}/pre-purchase-check?seller=` → 6 checklist rows `{code, status PASS|WARN|FAIL|UNKNOWN, detail}`: seller matches recorded owner (fuzzy via names service) · mutation up to date · pending cases · khas/acquisition · open risk indicators · document authenticity (UNKNOWN until F4b). Page `app/[locale]/check/page.tsx` + `features/check/` (reuses VerifyForm fields + optional seller name; checklist rows with icon + text; verdict "No indicators found in demo records" / "Indicators found — consult the AC Land office or a lawyer"). Nav + landing tile flag. Public QR payload gets encumbrance/mutation counts.
- **Test:** backend new `tests/test_pre_purchase.py` + `tests/security/test_leaks.py`; frontend `npx vitest run features/check tests/risk-wording.test.ts && npm run check:i18n && npx tsc --noEmit`
- **Done when:** LP-10900 shows a FAIL khas row; LP-10001 all PASS.

### F4a — Record hash + Ed25519 signature + signed QR  [Must · M · full-stack]
- **Read:** `backend/app/services/posting.py`, `backend/app/models/deed.py`, `backend/app/core/config.py`, `frontend/features/qr/{QrCard,publicUrl,PublicVerifyView}.tsx`.
- **Do:** add `record_hash`, `signature` columns to deeds (migration `0006`); canonical JSON (sorted keys, normalized fields + file hash) → SHA-256; Ed25519 via `cryptography` (key from `SIGNING_KEY_PATH`/env, dev key auto-generated outside the repo, gitignored); sign on approval; seed signs seeded deeds. `GET /public/keys` (public key). QR URL gains `?d=<deed_id>&h=<hash12>`; public page shows "Signature valid / invalid" chip. `.env.example` + docs/security.md updated.
- **Test:** new `tests/test_signing.py` (determinism, valid, wrong key, tampered payload) + `pytest -q tests/test_public.py tests/integration` · frontend `npx vitest run features/qr`
- **Done when:** approved deeds carry hash + signature; public page shows valid chip.

### F4b — Verify a document copy  [Must · M · full-stack]
- **Read:** `backend/app/services/{upload_validation,storage}.py` (function names), `backend/app/api/v1/public.py`, `backend/app/core/ratelimit.py`.
- **Do:** `POST /public/verify-document` (file upload, validated + rate-limited, not stored) or JSON `{deed_no, fields}` → file hash / canonical hash lookup → `AUTHENTIC` / `ALTERED` (deed no known, list differing fields) / `NOT_FOUND`. Page `app/[locale]/verify-document/page.tsx` + `features/verify-document/`. Pre-purchase row 6 now uses it. Nav + tile flag. Add a sample altered image `database/sample_data/Doc1_altered.png` (area changed; via `make_synthetic.py` option).
- **Test:** new `tests/test_verify_document.py` + `tests/security/test_leaks.py`; frontend `npx vitest run features/verify-document && npm run check:i18n`
- **Done when:** Doc1 → AUTHENTIC, Doc1_altered → ALTERED (area).

### F4c — Hash-chained ledger + tamper demo  [Must · M · backend + small UI]
- **Read:** `backend/app/services/{audit,mutation}.py`, `backend/app/services/posting.py` (approval end), `frontend/features/admin/AdminView.tsx`.
- **Do:** table `ledger_entries` (seq, entity_type, entity_id, payload_hash, prev_hash, entry_hash, created_at), migration `0007`; append on deed approval, mutation transition, encumbrance change; `GET /admin/ledger/verify` → `INTACT` or first broken seq; rule `RECORD_INTEGRITY_FAILED` (60 HIGH) when a parcel's current rows hash differently from the ledger. `scripts/tamper_demo.py` edits one transaction in SQLite. Admin "Ledger integrity" card with Verify button.
- **Test:** new `tests/test_ledger.py` (append, verify, tamper detection) + `pytest -q tests/integration tests/security/test_authz_matrix.py`; frontend `npx vitest run features/admin`
- **Done when:** tamper script → verify shows broken seq; parcel turns HIGH.

### U5 — Landing page redesign  [Must · M · frontend]
- **Read:** `frontend/features/landing/{Hero,HeroActions,Stats,Sections}.tsx`, `frontend/features/verify/VerifyForm.tsx` (props), `frontend/features/landing/landing.test.tsx`, roadmap §4.7.
- **Do:** implement §4.7: Hero with inline search (compact VerifyForm variant), 4 service tiles (all routes exist by now), "What we check" list replaces Stats, 5-step horizontal flow, officer band, trust band; alternate section backgrounds; remove the big logo card. EN+BN copy (Bangla written natively, not literal).
- **Test:** `cd frontend && npx vitest run features/landing tests/a11y.test.tsx && npm run check:i18n && npx tsc --noEmit`
- **Done when:** first screen at 1440×900 and 390×844 shows search + tiles; tests green.

### U6 — Inner pages: login, verify, result, report, public QR  [Must · M · frontend]
- **Read:** `frontend/app/[locale]/{login,verify}/page.tsx`, `frontend/features/{auth/LoginForm,result/ResultView,report/ReportView,qr/PublicVerifyView}.tsx`, roadmap §4.5 items 3–4 + §4.8.
- **Do:** shared `components/PageHeader.tsx` (breadcrumb, H1, purpose, meta "Data as of · Ref"); apply to these pages; record-card style for result/report/public; result tabs (Ownership · Transactions · Mutation · Encumbrance · Evidence); report letter-style header; login plain card + demo-accounts hint.
- **Test:** `cd frontend && npx vitest run features/auth features/result features/report features/qr tests/a11y.test.tsx && npm run check:i18n && npx tsc --noEmit`
- **Done when:** tests green; print preview of report still A4 light (screenshot optional).

### U7 — Officer, review, map, admin polish  [Should · M · frontend]
- **Read:** `frontend/features/officer/{OfficerShell,KpiCards,Alerts}.tsx`, `frontend/features/review/{ReviewView,ExtractionPanel,DocumentPreview}.tsx`, `frontend/features/map/{MapView,ParcelList}.tsx`, roadmap §4.8.
- **Do:** white sidebar with green active bar; flat KPI tiles (+ mutation/encumbrance/ledger KPIs); review panes + sticky action bar; map overlay flat; PageHeader on officer pages.
- **Test:** `cd frontend && npx vitest run features/officer features/review features/map features/admin tests/a11y.test.tsx && npx tsc --noEmit`
- **Done when:** tests green; all pages share the same visual language.

### F5a — Khatian / Porcha parser + samples  [Should · M · ai]
- **Read:** `ai/extraction/{saf_kabala,rules,patterns}.py` (structure), `ai/evaluation/make_synthetic.py` (how images are drawn), `backend/app/services/providers.py` (doc-type routing).
- **Do:** `ai/extraction/khatian.py`: khatian no, survey type `CS|SA|RS|BS`, mouza, JL no, owners + shares, dag list + areas; route `KHATIAN`/`PORCHA` types (add `PORCHA` to `DOCUMENT_TYPES`). Generate 2 synthetic Bangla khatian/porcha images into `database/sample_data/`. Store `survey_type` in extraction JSON.
- **Test:** new `backend/tests/test_khatian.py` + `pytest -q tests/test_extraction.py tests/test_saf_kabala.py && ruff check .`
- **Done when:** synthetic khatian text → all fields parsed; nothing guessed when missing.

### F5b — Bangla OCR measurement  [Should · S · ai + docs]
- **Read:** `ai/evaluation/run_eval.py` (CLI flags), `docs/ai-pipeline.md` (results section), `docs/ocr-setup.md`.
- **Do:** install `tesseract-ocr tesseract-ocr-ben` if available (`apt-get`), generate 20 synthetic Bangla docs (clean + noisy), run eval with `ben+eng`, record CER, field accuracy, review rate. If Tesseract cannot be installed in the sandbox: write the exact commands for the user to run locally and leave numbers as TODO.
- **Test:** `python ai/evaluation/run_eval.py ...` output pasted into docs.
- **Done when:** honest Bangla numbers (or exact local instructions) in `docs/ai-pipeline.md` + README Limitations.

### F5c — Archive search + survey-chain rule  [Could · M · full-stack]
- **Do:** SQLite FTS5 virtual table over approved OCR text + fields; `GET /archive/search?q=&survey=&district=` (REVIEWER+); officer page `officer/archive`; rule `SURVEY_CHAIN_GAP` (15 MEDIUM) when a later-survey owner has no recorded link from the earlier-survey holder.
- **Test:** new tests for search + rule; authz matrix.

### F6 — Forged-document plausibility rules  [Could · S · backend]
- **Do:** `DEED_NO_FORMAT_INVALID` (15 MEDIUM), `IMPOSSIBLE_DATE` (30 HIGH: future date, before seller acquired, before record origin), `RAPID_RESALE` (15 MEDIUM, seller held < 60 days); EN+BN evidence labels.
- **Test:** `pytest -q tests/test_risk_rules_*.py tests/test_risk_scoring.py tests/integration`.

### Q1 — Integration + full regression  🔒 [Must · M]
- **Do:** update `docs/architecture.md` (pipeline + ER with mutation_records, land_encumbrances, ledger_entries), `docs/api.md` (new routes), README scenario table (LP-10001…LP-11000 with expected levels), `docs/demo-script.md` → 3-min video flow + 5-min final flow. Run **full** suites and fix only regressions.
- **Test:** `cd backend && pytest -q && ruff check .` · `cd frontend && npx vitest run && npx tsc --noEmit && npm run check:i18n`
- **Done when:** all green; every scenario level matches the README table.

### Q2 — Deploy + live smoke + browser walk  [Must · S · user + Sonnet]
- **Do:** Render (Docker) + Netlify: env `DEMO_PASSWORD`, `JWT_SECRET`, `HASH_SALT`, signing key secret, `CORS_ORIGINS`; migrate 0004–0007 + reseed. Smoke: 4 roles login, Doc1→Doc2, track mutation, check-before-you-buy LP-10900, verify-document altered, ledger verify, BN switch. Run Playwright locally (`npm run e2e`). Warm-up ping before recording.
- **Done when:** live link works end-to-end; issues listed in README Limitations.

### S1 — Concept note (≤ 4 pages PDF)  [Must · M · docs]
- **Do:** write `docs/concept-note.md` then export PDF (pandoc/Chrome print). Sections: 1 Problem statement P3 (+ supporting P1/P2/P4/P5) · 2 Bangladesh context (land disputes, CS/SA/RS/BS conflicts, Sub-Registry vs AC Land split; cite public sources) · 3 Solution (pipeline Scan → Verify → Detect → Mutate → Citizen check) · 4 Architecture + tech stack (diagram) · 5 Key features (4–6 screenshots) · 6 Countrywide plan (§6) · 7 Team + mentors · AI metrics + limitations.
- **Done when:** PDF ≤ 4 pages, readable at 100 %.

### S2 — Demo video (≤ 3:00)  [Must · user]
- **Flow:** 0:00 problem · 0:15 Doc1 upload → OCR → extraction → confidence · 0:45 approve → mutation fast-track · 1:00 Doc2 → double-sale HIGH + mutation to hearing · 1:30 graph + evidence · 1:45 Check before you buy on khas/case parcel · 2:10 verify-a-copy ALTERED + ledger tamper · 2:35 Bangla UI + QR public page · 2:50 closing line. Record locally (no cold start); subtitles EN or BN.

### S3 — Submit Round 1  🔒 [Must · user]
- Repo public/shared with full commit history; README final; concept note PDF; video link; live link. Submit on the LandTech platform by **15 Oct**. Tag `round1-submission`.

### T1 — Final round build (after selection)  [Should]
- Pay 100 BDT confirmation within 3 days. Fix feedback; do cut items (U7, F5c, F6, Docker/Postgres, Next.js security upgrade). README **"Changes since Round 1"**. Pitch deck PDF ≤ 10 slides: Problem · BD context · Solution · Demo map · Architecture · AI/OCR results · Integrity (hash/signature/ledger) · Countrywide rollout · Impact/governance model · Team.

### T2 — Final presentation readiness  [Must after selection]
- 5-min script (1 pitch, 3.5 demo, 0.5 close) + offline fallback (local run + video). Ownership split: Student A backend/risk/mutation/ledger, Student B frontend/OCR/UI/deploy; both can explain everything at a high level (§9.3). Q&A bank ≥ 25 questions. Hardware checklist.

---

## 6. Countrywide implementation plan (for S1)

| Stage | Scope | Integration |
|---|---|---|
| Pilot (6 mo) | 1 upazila: 1 Sub-Registry + 1 AC Land office | Read-only registration + mutation feeds; digitize pilot mouza khatians |
| District (12 mo) | 1 district | Live e-Mutation API, court cause-list feed, DC office khas register |
| National (24–36 mo) | 64 districts | Permissioned ledger nodes at Sub-Registry / AC Land / DC offices; national search; mobile + SMS "check before you buy"; bank API for collateral checks |

Cross-cutting: Postgres/PostGIS, horizontal scaling, Bangla OCR fine-tuned on anonymized archives (with legal approval), data protection, officer training.

---

## 7. Order, schedule, cut line

| Day | Sessions (one 5-h window each) |
|---|---|
| Mon 06 Oct | G0 · G1 · U1 |
| Tue 07 Oct | U2 · U3 · U4 |
| Wed 08 Oct | F1a · F1b · F1c |
| Thu 09 Oct | F2a · F2b · F3a |
| Fri 10 Oct | F3b · F4a · F4b |
| Sat 11 Oct | F4c · U5 · U6 |
| Sun 12 Oct | F2c · U7 · F5a |
| Mon 13 Oct | F5b · (F6 / F5c) · Q1 🔒 |
| Tue 14 Oct | Q2 · S2 recording |
| Wed 15 Oct | S1 · S3 submit |
| Thu 16 Oct | buffer (official deadline) |

**Why UI first:** U1–U4 change tokens, components and shell, so every new F-page is built in the final style and never restyled twice. Landing (U5) waits until all service routes exist.

**Priority if behind** (most important first; drop from the right end): G0 → G1 → U1 → U2 → U3 → F1a → F1b → F3a → F3b → F4a → F4b → F2a → U5 → U4 → F1c → Q1 → Q2 → S1–S3 → F4c → F2b → U6 → F2c → U7 → F5a → F5b → F6 → F5c.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Real-looking data → disqualification | G0 first |
| Free-tier window runs out mid-phase | Cards are ≤ 6 files; stop green, mark `-b`, zip |
| Sonnet re-reads big files and burns usage | Cards list exact files + grep commands; never open `prompt.md` / history |
| UI looks "official" → misrepresentation | §4.2 rule 6; demo strip on every page |
| New rules shift existing demo levels | Scoring regression in F1b/F3a; Q1 scenario table |
| Render cold start during recording/judging | Record locally; warm-up ping; local fallback |
| Students can't explain AI-written code (§9.3) | Each student commits own phases; T2 walkthroughs |
