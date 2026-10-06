# LandShield BD — plan.md (lightweight tracker)

> Phase cards (files to read/touch, steps, tests): `roadmap.md` §5 — find with `grep -n "^### " roadmap.md`, view only your card.
> UI design spec: `roadmap.md` §4. Old build log: `docs/history/plan-v90.md`. Never read `prompt.md` whole.
> Demo data only — not a government system.

## STATE
```text
Plan version : 118
Competition  : LandTech 2026 · P3 Fraud & Double-Selling (P1/P2/P4/P5 supporting) · submit by 15 Oct (deadline 16 Oct)
F5a (2026-10-06) ✅ — khatian/porcha parser ai/extraction/khatian.py (Bangla + English labels; survey type CS|SA|RS|BS, JL no, owners + shares incl. shares-add-up check, dags + areas; R4 owner/dag fields filled only when exactly one owner / one dag, else lists in extras; nothing guessed). Routed by text in the rules provider (not by upload type); ExtractionResult.extras -> extraction_json.survey_type + extras; PORCHA added to DOCUMENT_TYPES (backend + 3 frontend lists + EN/BN label). Specimens database/sample_data/Khatian_RS.png + Porcha_BS.png via ai/evaluation/make_khatian_samples.py (headless Chrome for correct Bangla shaping, quantised to 16 greys to respect the 2 MiB assets cap) + mock fixtures with extras. Tests: new test_khatian.py (17, incl. API upload with mock providers); backend 585 pass, ruff clean; vitest 356, tsc, i18n OK (874). NOT done: real Tesseract on the specimens, review UI does not show survey_type/owners/dags yet (stored only), posting a khatian to ownership is not implemented.
U7 (2026-10-06) ✅ — officer/review/map/admin polish: white 1 px sidebar with green active bar; 8 flat KPI tiles (records, pending review, high-risk, verified + open alerts, pending mutations, active cases/claims, ledger Intact/Broken + entry count; /officer/stats extended, ledger status only, no detail); PageHeader (breadcrumb, purpose) on dashboard, review, mutation queue, admin; review = two panes with 1 px divider + sticky Approve/Reject bar; map overlays flat (white, border, 6 px radius, solid primary header bar, glass blur removed). Tests: backend 568 pass, ruff clean; vitest 356, tsc clean, check:i18n OK (873). Checked in browser desktop + mobile. Not touched: upload, audit-log and graph pages keep card titles (no PageHeader).
F2c (2026-10-06) ✅ — public mutation tracker: GET /public/mutation-status/{no} (status + step dates from MUTATION_TRANSITION audit rows + office + days pending; seeded rows show a skipped hearing; 404 MUTATION_NOT_FOUND; 60/min/IP; no names/land id), page /track (public, 4-step stepper with icon+text, EN+BN, anonymous API call), header nav + landing tile on, QR page now shows open-case and pending-mutation counts. Tests: backend 567 pass (new test_public_mutation.py 14, leak sweep + authz matrix cover the route), ruff clean; vitest 356 pass, tsc clean, check:i18n OK (861). Checked in the browser EN+BN.
Current phase: S2 (2026-10-06) 🟡 — demo video recorded automatically: docs/video/LandShield-BD-demo.mp4 (2:17, 1280×720 H.264, captions burned in + soft EN subtitle track, no audio) + LandShield-BD-demo.en.srt, by scripts/record_demo_video.cjs (Playwright drives the local app as admin on a fresh seed, mock OCR). Story = card S2: problem → Doc1 upload/OCR/confidence → approve (hash, Ed25519, ledger) → e-Mutation fast track → Doc2 → HIGH 70 evidence → mutation to hearing → ownership graph → Check Before You Buy LP-10900 (khas) → verify-a-copy Doc1_altered ALTERED (land area) → tamper_demo BROKEN #7 → restore INTACT → Bangla evidence → public QR → closing. Every scene checked frame by frame. docs/demo-script.md: "Automated recording" section. Video files git-ignored (6 MB; copy in the parent folder).
S2-b (user): watch it; optional voice-over; upload (YouTube unlisted or Drive, "anyone with link") → send the link → VIDEO_URL in docs/concept-note.md + re-export PDF + README.
S1: ✅ (concept note PDF 3 p; only VIDEO_URL left).
OPEN (carried): EN+BN evidence i18n for ACTIVE_LITIGATION/KHAS_LAND/UNDER_ACQUISITION/ACTIVE_MORTGAGE not done; real OCR (tesseract) path of verify-document untested; ML scoring skipped in plain dev venv; Docker image never built locally; `next build` not run. Ledger chain is only as strong as DB write access (anchoring head hash off-DB is a T1 idea).
Next phase   : S2-b upload + VIDEO_URL (user) → S3 submit Round 1 🔒 (tag `round1-submission`)
Carried over : reseed for demo password (Q17)
```

## PHASES  (⬜ todo · 🟡 partial · ✅ done · 🔒 gate) — one phase = one Sonnet chat / one 5-h window

| Day | # | Phase | Pri | Status |
|---|---|---|---|---|
| 06 Oct | G0 | Replace real-looking deed fixture | Must | ✅ |
| 06 Oct | G1 | README compliance (P3, data sources, AI disclosure, credits) + LICENSE | Must | ✅ |
| 06 Oct | U1 | Design tokens "Formal Green" | Must | ✅ |
| 07 Oct | U2 | Flat core components | Must | ✅ |
| 07 Oct | U3 | Top strip + header + footer + light default | Must | ✅ |
| 07 Oct | U4 | Flat SVG logo + Bangla-first | Must | ✅ |
| 08 Oct | F1a | Mutation records: model, migration 0004, seed | Must | ✅ |
| 08 Oct | F1b | Registration↔mutation mismatch rules + API | Must | ✅ |
| 08 Oct | F1c | Mutation history UI | Must | ✅ |
| 09 Oct | F2a | e-Mutation workflow backend (auto-create, pre-checks, state machine) | Must | ✅ |
| 09 Oct | F2b | Officer mutation queue + detail UI | Must | ✅ |
| 09 Oct | F3a | Encumbrances: cases, khas, acquisition (migration 0005) | Must | ✅ |
| 10 Oct | F3b | Check Before You Buy | Must | ✅ |
| 10 Oct | F4a | Record hash + Ed25519 signature + signed QR (0006) | Must | ✅ |
| 10 Oct | F4b | Verify a document copy | Must | ✅ |
| 11 Oct | F4c | Hash-chained ledger + tamper demo (0007) | Must | ✅ (F4c-b run + fixed) |
| 11 Oct | U5 | Landing page redesign | Must | ✅ |
| 11 Oct | U6 | Inner pages: login, verify, result, report, QR | Must | ✅ |
| 12 Oct | F2c | Public mutation tracker | Should | ✅ |
| 12 Oct | U7 | Officer, review, map, admin polish | Should | ✅ |
| 12 Oct | F5a | Khatian/Porcha parser + samples | Should | ✅ |
| 13 Oct | F5b | Bangla OCR measurement | Should | ⬜ |
| 13 Oct | F6 / F5c | Plausibility rules / archive search | Could | ⬜ |
| 13 Oct | Q1 | Integration + full regression 🔒 | Must | ✅ |
| 14 Oct | Q2 | Deploy + live smoke + e2e | Must | ✅ (live deploy done by user) |
| 14 Oct | S2 | Demo video ≤ 3 min (user) | Must | 🟡 (recorded 2:17; S2-b upload + link) |
| 15 Oct | S1 | Concept note ≤ 4 p PDF | Must | ✅ (VIDEO_URL after S2) |
| 15 Oct | S3 | Submit Round 1 🔒 | Must | ⬜ |
| TBA | T1 | Final build + "Changes since Round 1" + pitch deck | Should | ⬜ |
| TBA | T2 | Final presentation readiness | Must | ⬜ |

## KICKOFF PROMPT (paste in a new chat with the latest zip)
```text
Unzip the attached project. Read plan.md only, then run `grep -n "^### " roadmap.md` and view ONLY the card for the phase in "Next phase" (plus the roadmap §4 lines it names). Do exactly that card: touch only its files, run only its Test line, no repo exploration. Then update plan.md (STATE + status column), give me one zip of the whole project, and commit + push the phase to GitHub (RULES 4).
```

## RULES
1. Budget per phase: ≤ 6 files, ≤ ~200 LOC, ≤ ~25 tool calls. Running out → stop green, mark 🟡, write remaining steps as `<phase>-b` in STATE, zip.
2. Additive only: LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 must stay green; no prop/aria/testid renames without updating tests.
3. Zip (repo root): `rm -f frontend/.env.local backend/.env && zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' '*/storage/*' '*.db'`
4. Commit + push every finished phase (no need to ask): sync the work into the git repo `LandSheild-BD-repo` (exclude node_modules, .venv, .next, storage, *.db, .DS_Store, tsconfig.tsbuildinfo), then `git add -A && git commit` with a real message — first line `<PHASE>: <summary>`, then bullets of the actual changes — and `git push origin main`. A phase is done only when the zip exists and the push succeeded.
