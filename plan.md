# LandShield BD — plan.md (lightweight tracker)

> Phase cards (files to read/touch, steps, tests): `roadmap.md` §5 — find with `grep -n "^### " roadmap.md`, view only your card.
> UI design spec: `roadmap.md` §4. Old build log: `docs/history/plan-v90.md`. Never read `prompt.md` whole.
> Demo data only — not a government system.

## STATE
```text
Plan version : 123
RBAC audit (2026-10-07) ✅ — every route guard, page guard, nav item and API call checked per role (citizen/reviewer/officer/admin); live API probe 44/44. Fixed + pushed one commit each: four-eyes (uploader cannot approve, ADMIN exempt, SELF_APPROVAL_FORBIDDEN, shown up front via ExtractionOut.self_approval_blocked); review page dead-ends (UPLOADED: officer can start processing, reviewer sees waiting note; FAILED: reason + Reprocess); HIGH alert dismissal officer/admin only + reason required for any dismissal (ALERT_DISMISS_FORBIDDEN / REASON_REQUIRED, dashboard reason modal); /officer/activity scoped to document/mutation/alert events for reviewers (audit trail stays officer+); migration 0008 audit_logs.actor_role (role at the time; old rows backfilled with current role); landing reviewer CTA; stale officer e2e (F6 deed-no rule + four-eyes). "Last admin can be demoted" was a false finding (self-change is blocked, so the acting admin remains). Tests: backend 679 pass (8 skipped), vitest 407, e2e 20/20, tsc, ruff, i18n OK (1029).
O1-O4 (2026-10-07) ✅ real OCR track — OCR_PROVIDER=auto: demo sample (exact SHA-256 in ai/mock_fixtures.json by_hash) -> PDF text layer (>= 50 chars) -> Tesseract; no silent mock (OCR_UNAVAILABLE 503 / OCR_TIMEOUT 504 -> job FAILED + documents.failure_code; verify-document answers 503). Tesseract: psm 6 -> 4 -> upscale retry (upscale is a RETRY only: first-step upscaling dropped deeds to 29 %), per-page timeout, multi-page + PAGES_TRUNCATED, normalize.py, extra BN label variants. Claude (ai/extraction/claude.py + validate.py): dormant without ANTHROPIC_API_KEY, fallback to rules on any failure, cache per sha256+model, daily cap; fake-client tests only, NEVER run against the real API. Extraction JSON + API: ocr_source / extractor / model / warnings; review page badges EN+BN. Eval (Tesseract+rules, demo off): deeds 60.0 % -> 85.4 % (73.3 % preprocess off); Bangla specimens CER 17.2 % -> 21.6 % (worse), parsed fields 90 %. docs/ocr-accuracy.md, README "How OCR works", Dockerfile tessdata_best (NOT built here), pyproject extra llm. Tests: backend 672 pass (8 skipped), ruff clean; vitest 398, tsc clean. NOT done: Claude accuracy (no key), 3-5 real-looking deeds, Docker build, real Render run.
Competition  : LandTech 2026 · P3 Fraud & Double-Selling (P1/P2/P4/P5 supporting) · submit by 15 Oct (deadline 16 Oct)
C1+C2+C5 (2026-10-06) ✅ frontend citizen tools — /tools hub + /tools/units (10 units, bigha standard vs 33-shatangsho variant, katha 720 sqft, chhatak 45 sqft; goncha/kora left out: values disputed), /tools/fees (one config, ILLUSTRATIVE demo rates, sale/gift/inheritance × city/pourashava/union), /tools/inheritance (exact BigInt fractions: fixed, asaba, awl, radd, hajb, umariyyatan; grandchildren/grandparents/half-siblings/wills out of scope, said in UI). EN+BN (1007 keys), landing 'Citizen tools' band + footer link, axe clean. Tests: vitest 393, tsc, i18n OK. C3/C4 (backend + migrations) NOT done.
T1/T2 (2026-10-06) ✅ drafts — docs/landshield-pitch-deck.pptx (10 slides, native chart; NOT visually rendered here: no LibreOffice, open it once and check fit), README "Changes since Round 1", docs/final-presentation.md (5-min script, ownership split, offline fallback, hardware checklist, 30-question Q&A). Pay the 100 BDT fee + judge-feedback fixes stay with the user.
F5c (2026-10-06) ✅ — GET /archive/search (REVIEWER+; FTS5 over approved docs, lazy signature-based rebuild, LIKE fallback off SQLite; survey + district filters), officer page /officer/archive (+ nav), rule SURVEY_CHAIN_GAP (15 MEDIUM, counts only, transitive transfer links, name-variant matching), EN+BN. Tests: backend 639 pass (8 skipped), ruff clean; vitest 360, tsc, i18n OK (904); test_archive.py (10), authz matrix updated.
F6 (2026-10-06) ✅ — rules DEED_NO_FORMAT_INVALID 15, IMPOSSIBLE_DATE 30 HIGH (future / before seller acquired / before record origin), RAPID_RESALE 15 (< 60 d); test_plausibility.py (23); EN+BN evidence incl. the 4 encumbrance codes that had none.
F5b (2026-10-06) ✅ — Tesseract installed (brew) + ben.traineddata (tessdata_fast, git-ignored ai/tessdata, TESSDATA_PREFIX); run_eval.py Part C: Bangla specimens × clean/noisy/skewed, CER, parsed fields, review rate. Result: mean CER ≈ 17 %, parsed fields 77 % (preproc off) / 90 % (on), review rate 100 %; deed set 38.8 % -> 60.0 %. docs/ai-pipeline.md, ocr-setup.md, README limitations updated.
F5a (2026-10-06) ✅ — khatian/porcha parser ai/extraction/khatian.py (Bangla + English labels; survey type CS|SA|RS|BS, JL no, owners + shares incl. shares-add-up check, dags + areas; R4 owner/dag fields filled only when exactly one owner / one dag, else lists in extras; nothing guessed). Routed by text in the rules provider (not by upload type); ExtractionResult.extras -> extraction_json.survey_type + extras; PORCHA added to DOCUMENT_TYPES (backend + 3 frontend lists + EN/BN label). Specimens database/sample_data/Khatian_RS.png + Porcha_BS.png via ai/evaluation/make_khatian_samples.py (headless Chrome for correct Bangla shaping, quantised to 16 greys to respect the 2 MiB assets cap) + mock fixtures with extras. Tests: new test_khatian.py (17, incl. API upload with mock providers); backend 585 pass, ruff clean; vitest 356, tsc, i18n OK (874). NOT done: real Tesseract on the specimens, review UI does not show survey_type/owners/dags yet (stored only), posting a khatian to ownership is not implemented.
U7 (2026-10-06) ✅ — officer/review/map/admin polish: white 1 px sidebar with green active bar; 8 flat KPI tiles (records, pending review, high-risk, verified + open alerts, pending mutations, active cases/claims, ledger Intact/Broken + entry count; /officer/stats extended, ledger status only, no detail); PageHeader (breadcrumb, purpose) on dashboard, review, mutation queue, admin; review = two panes with 1 px divider + sticky Approve/Reject bar; map overlays flat (white, border, 6 px radius, solid primary header bar, glass blur removed). Tests: backend 568 pass, ruff clean; vitest 356, tsc clean, check:i18n OK (873). Checked in browser desktop + mobile. Not touched: upload, audit-log and graph pages keep card titles (no PageHeader).
F2c (2026-10-06) ✅ — public mutation tracker: GET /public/mutation-status/{no} (status + step dates from MUTATION_TRANSITION audit rows + office + days pending; seeded rows show a skipped hearing; 404 MUTATION_NOT_FOUND; 60/min/IP; no names/land id), page /track (public, 4-step stepper with icon+text, EN+BN, anonymous API call), header nav + landing tile on, QR page now shows open-case and pending-mutation counts. Tests: backend 567 pass (new test_public_mutation.py 14, leak sweep + authz matrix cover the route), ruff clean; vitest 356 pass, tsc clean, check:i18n OK (861). Checked in the browser EN+BN.
Current phase: S2 (2026-10-06) 🟡 — demo video recorded automatically: docs/video/LandShield-BD-demo.mp4 (2:17, 1280×720 H.264, captions burned in + soft EN subtitle track, no audio) + LandShield-BD-demo.en.srt, by scripts/record_demo_video.cjs (Playwright drives the local app as admin on a fresh seed, mock OCR). Story = card S2: problem → Doc1 upload/OCR/confidence → approve (hash, Ed25519, ledger) → e-Mutation fast track → Doc2 → HIGH 70 evidence → mutation to hearing → ownership graph → Check Before You Buy LP-10900 (khas) → verify-a-copy Doc1_altered ALTERED (land area) → tamper_demo BROKEN #7 → restore INTACT → Bangla evidence → public QR → closing. Every scene checked frame by frame. docs/demo-script.md: "Automated recording" section. Video files git-ignored (6 MB; copy in the parent folder).
S2-b (user): watch it; optional voice-over; upload (YouTube unlisted or Drive, "anyone with link") → send the link → VIDEO_URL in docs/concept-note.md + re-export PDF + README.
S1: ✅ (concept note PDF 3 p; only VIDEO_URL left).
OPEN (carried): EN+BN evidence i18n for ACTIVE_LITIGATION/KHAS_LAND/UNDER_ACQUISITION/ACTIVE_MORTGAGE not done; real OCR (tesseract) path of verify-document untested; ML scoring skipped in plain dev venv; Docker image never built locally; `next build` not run. Ledger chain is only as strong as DB write access (anchoring head hash off-DB is a T1 idea).
Citizen tools: C1 ✅ C2 ✅ C5 ✅; left C3 → C4 (backend) (cards in roadmap.md §5 "C —"); suggested pairing C1+C2 in one window.
Next work    : E5 → E6 e-governance UI upgrade (section "E-GOV UPGRADE" below). E1 ✅ (2026-10-14); E2 ✅ (/faq, /accessibility, /privacy, /terms, /data-sources, /sitemap + live footer links, axe cases); E3 ✅ (/services citizen charter, "what you need" boxes on verify/check/track/verify-document, landing notice board); E4 ✅ (Bangla district/upazila names + digits on result/QR, /feedback + FB- reference on /track, "helpful?" prompt, officer /officer/feedback, migration 0012; owner and mouza names stay as stored: no Bangla data): localized not-found (+ catch-all)/error/loading, 1200 px container for strip/header/main/footer/result page, verify placeholders "Select", 2-col tablet form, tab scrollbar fixed. vitest 432, tsc, i18n OK (1127); checked 1366 + 375 px, no horizontal scroll; result-page tabs not visually checked (needs login).
Next phase   : S2-b upload + VIDEO_URL (user) → S3 submit Round 1 🔒 (both skipped by request; user does them). Re-export the concept note PDF (scripts/export_concept_note.py, needs Chromium): its Bangla-OCR sentence changed.
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
| 13 Oct | F5b | Bangla OCR measurement | Should | ✅ |
| 13 Oct | F6 / F5c | Plausibility rules / archive search | Could | ✅ |
| 13 Oct | Q1 | Integration + full regression 🔒 | Must | ✅ |
| 14 Oct | Q2 | Deploy + live smoke + e2e | Must | ✅ (live deploy done by user) |
| 14 Oct | S2 | Demo video ≤ 3 min (user) | Must | 🟡 (recorded 2:17; S2-b upload + link) |
| 15 Oct | S1 | Concept note ≤ 4 p PDF | Must | ✅ (VIDEO_URL after S2) |
| 15 Oct | S3 | Submit Round 1 🔒 | Must | ⬜ |
| TBA | T1 | Final build + "Changes since Round 1" + pitch deck | Should | ✅ (draft; fee + feedback user) |
| TBA | T2 | Final presentation readiness | Must | ✅ (docs/final-presentation.md) |
| TBA | C1 | Land unit converter (regional bigha/katha) | Should | ✅ |
| TBA | C2 | Registration + mutation fee calculator | Should | ✅ |
| TBA | C3 | Land-tax status row in Check Before You Buy (0008) | Should | ⬜ |
| TBA | C4 | Watch a plot: in-app change alerts (0009) | Should | ⬜ |
| TBA | C5 | Inheritance share calculator (ফারায়েজ) | Should | ✅ |
| Next | E1 | Fix broken basics: 404/error/loading, one container width, form fit, tab scrollbar | Must | ✅ |
| Next | E2 | Info pages: FAQ, accessibility, privacy, terms, data sources, sitemap + live footer links | Must | ✅ |
| Next | E3 | Citizen charter, "what you need" boxes, notice board | Should | ✅ |
| Next | E4 | Bangla place names/numerals + feedback/grievance form + "helpful?" prompt | Should | ✅ |
| Next | E5 | Accessibility pass on every route (axe, 125 %, 360 px, keyboard) | Must | ⬜ |
| Next | E6 | Officer-side consistency + session-timeout warning | Could | ⬜ |

## E-GOV UPGRADE (next work) — audit 2026-10-14
Verdict: the "Formal Green" spec (roadmap §4) is in place — Bangla-first, light default, demo strip, text-size control, service-first hero, breadcrumbs + "data as of", icon+text statuses, 44 px targets, print styles. Still missing for a full e-governance portal: real info pages, error pages, service transparency, consistent layout, Bangla data. Rules: demo only — no Shapla emblem, no gov.bd wording, no real phone numbers; EN+BN parity for every new string.

**E1 — Fix broken basics** [Must · S · frontend]
- Add `app/[locale]/not-found.tsx`, `error.tsx`, `loading.tsx` (EN+BN, normal header/footer, link home). Today `/bn/<bad-url>` shows the bare English Next.js 404.
- One container width (1200 px, roadmap §4.4) for header (now `max-w-[1600px]`), main + footer (`max-w-6xl`) and the narrower result page.
- Verify form: shorter select placeholders (now cut off: "বিভাগ নির্বাচন ক…"), 2-col on tablet, submit button full width on mobile.
- Result page tabs: remove the stray scrollbar.
- Test: vitest, tsc, check:i18n; browser 1366 px + 375 px, no horizontal scroll.

**E2 — Information pages** [Must · M · frontend + i18n]
- New routes `/faq`, `/accessibility`, `/privacy`, `/terms`, `/data-sources`, `/sitemap`, each with `PageHeader` + "সর্বশেষ হালনাগাদ" date.
- Footer (`features/landing/Footer.tsx`): turn the plain-text items into links.
- Test: axe on each new page, check:i18n.

**E3 — Service transparency** [Should · M · frontend]
- `/services` citizen charter (সেবা প্রদান প্রতিশ্রুতি): table per service — required documents, fee (link to /tools/fees), time limit, responsible office, how to apply.
- "What you need" box above each service form (verify, check, track, verify-document).
- Landing: notice board band (dated demo notices, synthetic).

**E4 — Bangla data + feedback** [Should · M · full-stack]
- Bangla district/upazila/mouza names on result/report/QR pages (from existing mouza/upazila data); owner names in Bangla where the data has them; Bangla numerals in all tables/dates under `bn`.
- `/feedback` grievance form → demo reference no.; status visible on `/track`.
- "Was this page helpful?" on service pages.

**E5 — Accessibility pass** [Must · S · QA]
- axe on every route (extend `tests/a11y.test.tsx`), 125 % text at 360 px, keyboard-only map + mouza combobox; write results to `docs/ui.md`.

**E6 — Officer side** [Could · S–M · frontend]
- PageHeader on upload, audit-log, graph pages (left out in U7); office name in breadcrumb meta; session-timeout warning modal.

## KICKOFF PROMPT (paste in a new chat with the latest zip)
```text
Unzip the attached project. Read plan.md only, then run `grep -n "^### " roadmap.md` and view ONLY the card for the phase in "Next phase" (plus the roadmap §4 lines it names). Do exactly that card: touch only its files, run only its Test line, no repo exploration. Then update plan.md (STATE + status column), give me one zip of the whole project, and commit + push the phase to GitHub (RULES 4).
```

## RULES
1. Budget per phase: ≤ 6 files, ≤ ~200 LOC, ≤ ~25 tool calls. Running out → stop green, mark 🟡, write remaining steps as `<phase>-b` in STATE, zip.
2. Additive only: LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 must stay green; no prop/aria/testid renames without updating tests.
3. Zip (repo root): `rm -f frontend/.env.local backend/.env && zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' '*/storage/*' '*.db'`
4. Commit + push every finished phase (no need to ask): sync the work into the git repo `LandSheild-BD-repo` (exclude node_modules, .venv, .next, storage, *.db, .DS_Store, tsconfig.tsbuildinfo), then `git add -A && git commit` with a real message — first line `<PHASE>: <summary>`, then bullets of the actual changes — and `git push origin main`. A phase is done only when the zip exists and the push succeeded.
