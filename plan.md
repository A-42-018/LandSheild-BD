# LandShield BD — plan.md (lightweight tracker)

> Phase cards (files to read/touch, steps, tests): `roadmap.md` §5 — find with `grep -n "^### " roadmap.md`, view only your card.
> UI design spec: `roadmap.md` §4. Old build log: `docs/history/plan-v90.md`. Never read `prompt.md` whole.
> Demo data only — not a government system.

## STATE
```text
Plan version : 113
Competition  : LandTech 2026 · P3 Fraud & Double-Selling (P1/P2/P4/P5 supporting) · submit by 15 Oct (deadline 16 Oct)
Current phase: Q2 (2026-10-06) 🟡 — local part done, live deploy left (Q2-b). Playwright run for the first time: 10/20 failed, all stale specs after U1–U6 → now 20/20. Fixes: e2e/fixtures.ts new apiToken(request) (isolated request context — old apiLogin(page.context()) inside officer.spec silently switched the browser session to reviewer) + openEvidenceTab() (risk card lives in the Evidence tab since U6); risk-score text is "N / 100"; not-found alert locator scoped (Next route announcer is also role=alert). App fix (a11y): login page had no heading → LoginForm title is now an <h1>; Card title wrapper span→div. Local API smoke on a fresh seeded DB (mock OCR): 4 role logins OK; pre-purchase LP-10900 INDICATORS_FOUND; mutations queue 7; Doc1 approve → verify-document Doc1_altered ALTERED (land_area), Doc1 AUTHENTIC; ledger INTACT → tamper_demo BROKEN seq 7 → --restore INTACT; public QR LP-10240 HIGH. render.yaml: SIGNING_KEY (sync:false) added. docs/deploy-netlify.md: env list + key command + §3 live smoke checklist + warm-up. README: e2e line + Limitations (deploy manual, cold start, real Tesseract on Render, verify-copy needs Doc1 approved). Tests: vitest 350/350, tsc clean, check:i18n OK (827), e2e 20/20.
Q2-b (user): push repo → Render Blueprint (set DEMO_PASSWORD, CORS_ORIGINS, SIGNING_KEY) → Netlify (base frontend, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL) → run deploy-netlify.md §3 on the live link; if sample PNGs fail with Tesseract set OCR_PROVIDER=mock DOCUMENT_AI_PROVIDER=mock. Put the live URL in README.
OPEN (carried): EN+BN evidence i18n for ACTIVE_LITIGATION/KHAS_LAND/UNDER_ACQUISITION/ACTIVE_MORTGAGE not done; public QR page does not render encumbrance/mutation counts; real OCR (tesseract) path of verify-document untested; ML scoring skipped in plain dev venv; Docker image never built; `next build` not run this phase. Ledger chain is only as strong as DB write access (anchoring head hash off-DB is a T1 idea).
Next phase   : Q2-b live deploy (user), then S1 Concept note (next Must) — roadmap.md card S1; S2 video can be recorded locally (no cold start)
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
| 12 Oct | F2c | Public mutation tracker | Should | ⬜ |
| 12 Oct | U7 | Officer, review, map, admin polish | Should | ⬜ |
| 12 Oct | F5a | Khatian/Porcha parser + samples | Should | ⬜ |
| 13 Oct | F5b | Bangla OCR measurement | Should | ⬜ |
| 13 Oct | F6 / F5c | Plausibility rules / archive search | Could | ⬜ |
| 13 Oct | Q1 | Integration + full regression 🔒 | Must | ✅ |
| 14 Oct | Q2 | Deploy + live smoke + e2e | Must | 🟡 (e2e + local smoke ✅, live deploy = Q2-b) |
| 14 Oct | S2 | Demo video ≤ 3 min (user) | Must | ⬜ |
| 15 Oct | S1 | Concept note ≤ 4 p PDF | Must | ⬜ |
| 15 Oct | S3 | Submit Round 1 🔒 | Must | ⬜ |
| TBA | T1 | Final build + "Changes since Round 1" + pitch deck | Should | ⬜ |
| TBA | T2 | Final presentation readiness | Must | ⬜ |

## KICKOFF PROMPT (paste in a new chat with the latest zip)
```text
Unzip the attached project. Read plan.md only, then run `grep -n "^### " roadmap.md` and view ONLY the card for the phase in "Next phase" (plus the roadmap §4 lines it names). Do exactly that card: touch only its files, run only its Test line, no repo exploration. Then update plan.md (STATE + status column) and give me one zip of the whole project.
```

## RULES
1. Budget per phase: ≤ 6 files, ≤ ~200 LOC, ≤ ~25 tool calls. Running out → stop green, mark 🟡, write remaining steps as `<phase>-b` in STATE, zip.
2. Additive only: LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 must stay green; no prop/aria/testid renames without updating tests.
3. Zip (repo root): `rm -f frontend/.env.local backend/.env && zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' '*/storage/*' '*.db'`
