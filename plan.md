# LandShield BD — plan.md (lightweight tracker)

> Phase cards (files to read/touch, steps, tests): `roadmap.md` §5 — find with `grep -n "^### " roadmap.md`, view only your card.
> UI design spec: `roadmap.md` §4. Old build log: `docs/history/plan-v90.md`. Never read `prompt.md` whole.
> Demo data only — not a government system.

## STATE
```text
Plan version : 166
CURRENT PHASE: H9e WRITTEN, NOT RUN — H9 complete (archive search over LHDR fields: party names, fathers, villages, mouza, thana, district, khatian, dag, deed no indexed from the approved lhdr/1 record; new filters `year_from` / `year_to` (overlap with the deed's Gregorian years, 422 INVALID_YEARS if reversed); hits carry `year_from`, `year_to`, `historical` and open `/officer/documents/[id]`; SQLite FTS5 columns + Postgres `archive_index` columns added, an old FTS table is rebuilt, a correction re-indexes; UI: two year inputs, Deed year column, Historical tag, Open link; EN+BN (2378 keys); tests: 9 new in backend/tests/test_archive.py, 4 new in features/archive/archive.test.tsx; ran: check:i18n, audit-hardcoded, py_compile, stubbed row build + FTS5 queries on the gold deed; NOT RUN: pytest (no pytest/sqlalchemy), `npx vitest run features/archive`, `npx tsc --noEmit`, Postgres. Next: H10 (hardening, docs, production) after running all owed tests in a networked env: `python -m pytest -q -k archive`, then the full backend suite, `npx vitest run features/archive features/risk features/result features/library`, `npx tsc --noEmit`). Before: H9d WRITTEN (two more risk rules on historical deeds: `HISTORICAL_DAG_CONFLICT` 25 MEDIUM = a later deed claims the same dag/khatian through a seller not linked to the earlier buyer; `HISTORICAL_CONSIDERATION_IMPLAUSIBLE` 10 MEDIUM = sale price in the wrong currency for its era or outside the era's per-decimal range, flag only; `HistoricalDeedInfo` + `LandContext.historical_deeds` loaded from the approved lhdr/1 record in `risk/context.py`, ranges in `risk/config.py`; EN+BN evidence (2369 keys); tests: 10 new in backend/tests/test_risk_historical.py + code-set test updated; ran: the 10 pure rule tests with stubbed imports (pass), check:i18n, audit-hardcoded, py_compile; NOT RUN: pytest (no pytest/sqlalchemy here) incl. the DB loader test and the full backend suite, `npx vitest run features/risk`, `npx tsc --noEmit`. Next: H9e (archive search over LHDR fields), then run all owed tests in a networked env). Before: H9c DONE for the backend (two risk rules on a historical deed vs the CS/SA khatian: `HISTORICAL_SELLER_NOT_OWNER` 20 MEDIUM = seller matches no CS/SA owner by fuzzy name or recorded transfers; `HISTORICAL_CHAIN_GAP` 15 MEDIUM = seller anchored to a CS/SA khatian but the buyer does not lead to the later CS/SA owners; `risk/rules/historical_deed.py`, `HistoricalLink` + `LandContext.historical_links` loaded in `risk/context.py`; EN+BN evidence text (2367 keys); tests: new `backend/tests/test_risk_historical.py` (10) + code-set test updated; ran: pytest on test_risk_historical, test_risk_rules_b, test_chain_of_title, test_archive (51 pass), full backend suite = 13 failures, all environmental in this sandbox except none from H9c (PyMuPDF / Tesseract / WeasyPrint missing, `.env.example` not in the zip); also fixed two wrong H9a tests in test_chain_of_title.py; NOT RUN: `npx vitest run features/risk`, `npx tsc --noEmit`. Next: H9d (risk rules: dag/khatian conflicts, consideration sanity per era). Before: H9b WRITTEN, NOT RUN (chain on the land page: `OwnershipEntry.kind/historical`, `LandDocumentItem.chain_link`; `OwnershipTimeline` marks the 1944 link as historical with its date and, for staff, a link to /officer/documents/[id]; LandDocuments tab badge "In the chain of title"; EN+BN (2365 keys); tests: 3 in backend/tests/test_chain_of_title.py, new frontend/features/result/ownership-timeline.test.tsx (6); checked: py_compile, check:i18n, audit-hardcoded; NOT RUN: `python -m pytest -q tests/test_chain_of_title.py tests/test_lands.py tests/test_library.py`, `npx vitest run features/result features/library`, `npx tsc --noEmit`. Next: run them, then H9c (risk rules: chain gap, seller ≠ khatian owner)). Before: H9a WRITTEN, NOT RUN (chain-of-title link on approval: ownership_history.kind CURRENT|HISTORICAL, migration 0018, services/chain.py; a historical deed no longer replaces the current owner, it adds one past link tied to its transaction, updated in place on correction; current-owner queries + risk context filter kind=CURRENT; tests: new backend/tests/test_chain_of_title.py; checked: py_compile; NOT RUN: pytest tests/test_chain_of_title.py tests/test_records.py tests/test_lands.py, migration up/down, ruff. Next: run them, then H9b (show the link in OwnershipTimeline + Documents tab; add `kind` to OwnershipEntry)). Before: H8e WRITTEN, NOT RUN (Download menu PDF · JSON · Original · Bundle on the document page and each library row: frontend/features/library/DownloadMenu.tsx, library.download.* + library.cols.download EN+BN (2361 keys), vitest download-menu.test.tsx + a row test, e2e step in e2e/library.spec.ts; checked: check:i18n, audit-hardcoded; NOT RUN: vitest, tsc, e2e:library, and everything H8a/H8c/H8d still owe. Next: in a networked env install weasyprint + pymupdf + segno, run `python scripts/pdf_spike.py` (D7), the H8c + H8d backend tests, `npx vitest run features/library features/qr`, `npx tsc --noEmit`, then H9a). Before: H8d WRITTEN, NOT RUN (see log row H8d; next: install weasyprint + pymupdf + segno, run H8c + H8d tests, then H8e). H8d (2026-10-18) 🟡 — QR verify page + bundle: `GET /public/records/{record_id}` (anonymous; VALID|INVALID + deed_no, version, approved_at, superseded; draft/machine/unknown = 404 RECORD_NOT_FOUND; hash + signature re-checked per read), page `/[locale]/v/r/[recordId]` (features/qr/PublicRecordView.tsx, publicRecord.* EN+BN, 2342 keys), QR in the PDF footer (segno SVG data URI -> `{PUBLIC_SITE_URL}/bn/v/r/{record id}`; address as text only if segno is missing; none on a draft; new setting PUBLIC_SITE_URL + render.yaml), `what=bundle` ZIP (original, deed.pdf, record.json, manifest.json `landshield-bundle/1`: file SHA-256 + size, record hash, signature, key id, version history, no names; backend/app/services/bundle.py). Tests written: new tests/test_public_record.py (15), authz matrix entry, vitest features/qr/record.test.tsx (8). Checked: py_compile, check:i18n. **NOT RUN (no pytest / fastapi / segno / WeasyPrint / node_modules, no network): `python -m pytest -q tests/test_public_record.py tests/test_downloads.py tests/test_deed_pdf.py tests/security`, `npx vitest run features/qr`, tsc, ruff.** H8e needs: Download menu (PDF · JSON · Original · Bundle) on the document page and library rows. Before: H8c WRITTEN, NOT RUN (see log row H8c; next: run its tests with WeasyPrint installed, then H8d). Before: H8b download API DONE (next H8c digital deed PDF; H8a spike still not run, D7 open). H8b (2026-10-18) ✅ — GET /documents/{id}/download?what=json|original&version=n (REVIEWER+, scoped, 30/h/user, audit DOCUMENT_DOWNLOAD; JSON envelope landshield-record/1 with integrity hash + Ed25519 signature; original = exact bytes + X-File-SHA256) and POST /public/records/verify (anonymous, VALID|INVALID only, one changed byte -> INVALID). Tests: new test_downloads.py (17) + tests/security, test_records, test_library, test_signing, test_public, test_documents pass; ruff clean on new code. NOT run to completion: full backend suite (first run failed tests/test_classify.py::test_every_historical_file_and_no_modern_sample_is_historical, cause not checked), Postgres, frontend. H8c needs: PDF footer prints record_hash + version; H8d needs a public record id for /v/r/[recordId].
H8c: H8c (2026-10-18) 🟡 — digital deed PDF: `GET /documents/{id}/download?what=pdf&version=n` (backend/app/services/deed_pdf.py: `build_view` sections A–I from the plain LHDR record, `render_html`, `render_pdf` = WeasyPrint assumed as the H8a engine, D7 still OPEN; 503 PDF_ENGINE_UNAVAILABLE without it). Footer block: deed no, version, approved at, approving officer name, record SHA-256, original SHA-256, signature + key id; running page footer; red "DRAFT – NOT APPROVED" banner + every-page header on non-approved versions (file `…-draft.pdf`); NIDs masked to last 4 digits (`mask_nid`; LHDR has no NID field, NIDs are stored as keyed hashes, so nothing is printed today). Dockerfile: libpango + `pdf` extra added. Tests: new tests/test_deed_pdf.py (layout, masking, escaping, draft mark, endpoint with a stubbed engine; real-render + round-trip tests skip without weasyprint / PyMuPDF). **NOT RUN (sandbox: no pytest, fastapi, pydantic, WeasyPrint, no network): `python -m pytest -q tests/test_deed_pdf.py tests/test_downloads.py` — only py_compile done. Open risk: the round-trip (≥ 99 % of gold values) may fail because the PDF is a label/value table, not deed prose the rule parser reads; if so tune the layout or give the parser a PDF-of-ours mode. QR + bundle are H8d.**
PREV: H8a PDF engine spike WRITTEN, NOT RUN (sandbox: no network, no weasyprint/fpdf2/uharfbuzz/PyMuPDF; decision D7 still open). NEXT ROADMAP: (1) in a networked env run `pip install -e "./backend[pdf]" pymupdf && python scripts/pdf_spike.py`, record the numbers under H8 in §3 and as D7 in §5, add libpango1.0-0 libpangoft2-1.0-0 to the Dockerfile only if WeasyPrint wins -> H8b download API (JSON + original + record verify, needs H7a, can be done first) -> H8c digital deed PDF -> H8d QR verify page + bundle ZIP -> H8e download menu in the UI.
H8a (2026-10-18) 🟡 — scripts/pdf_spike.py (candidates weasyprint, fpdf2+uharfbuzz; 8 deed words + 4 sentences incl. Bangla digits; PyMuPDF text extraction (pypdf fallback), exact NFC compare, ai/ocr/quality.assess, render time, PDF size, install size; JSON report scripts/_out/pdf_spike_report.json; exit 0 only if a candidate is exact AND >= THRESHOLD), backend/pyproject.toml optional extra `pdf` (weasyprint, fpdf2, uharfbuzz). Font: ai/fonts/NotoSansBengali-Regular.ttf if present, else the bundled FreeSans subset. Verified: py_compile + dry run (both candidates report not-installed, exit 1). NOT done: the actual comparison, D7, Dockerfile change.
H7d (2026-10-18) ✅ — document page + land Documents section: `/officer/documents/[id]` (REVIEW_UP; frontend/features/library/DocumentPage.tsx, VersionPanel.tsx, VersionHistory.tsx, useDocumentPage.ts): original upload (DocumentPreview) on the left, the digital deed of the chosen version on the right (H6a DeedView with new `readOnly` prop for lhdr/1; the 13 flat fields for core/1), version picker (default = newest approved, else newest), created by / approved by + time, SHA-256 of the original file and of the record, signature badge (VALID "Signature valid ✓" / INVALID / UNSIGNED), per-version history from `GET /documents/{id}/records/history`, and a link + note to `/officer/review/[id]` while the document is UPLOADED / PROCESSING / EXTRACTED / REVIEW_REQUIRED / FAILED. Library rows and the home card now open the document page (`documentHref`). ResultView gets a staff-only "Documents" section (`LandDocuments.tsx`, `GET /lands/{id}/documents`, deed-date order, historical tag, digital version + signature, each row opens the document page; citizens neither see it nor call the endpoint). EN+BN (2329 keys). Tests written: document-page.test.tsx (13), land-documents-section.test.tsx (2), library.test.tsx href updated, e2e/library.spec.ts (`npm run e2e:library`, real OCR). Checked: check:i18n + hardcoded-string audit. NOT RUN: vitest, tsc, Playwright (sandbox has no node_modules and no network).
H7c (2026-10-18) ✅ — "My documents" page: `/officer/documents` (frontend/features/library/: LibraryView, RecentUploads, useLibrary, types) under OfficerShell, menu item `officer.nav.documents` (REVIEW_UP). Table: file-type icon, deed no, mouza, type + Historical tag, deed date, status + "Needs my action", uploaded, digital version (v<n> / Not yet); tabs My uploads / My office / Needs my action; filters status, type, kind of deed, uploaded date range, area, search, sort; all state lives in the URL (`paramsFromUrl` / `paramsToUrl`), 20 per page. Officer home gets "Recently uploaded by me" (last 5, `GET /documents?tab=mine&limit=5`). Rows open `/officer/review/[id]` until H7d adds the document page (`documentHref` in types.ts). EN+BN (2285 keys). New library.test.tsx (13 tests); officer.test + a11y mocks answer `/documents?`. Checked: check:i18n + hardcoded-string audit. NOT RUN: vitest, tsc, Playwright (sandbox has no node_modules and no network).
H7b (2026-10-18) ✅ — land documents + version history: `GET /lands/{land_id}/documents` (REVIEWER+; deed-date order, undated last; scoped like the library; each item = LibraryItem + approved_record {version, schema, approved_at/by, signature_status}; backend/app/services/library.py `land_documents`, schemas LandDocumentItem / LandDocuments) and `GET /documents/{id}/records/history` (per version events CREATED / EDIT with changes [path, op, old, new] / CORRECTION_START / BASELINE / APPROVE, from the audit log; backend/app/services/records.py `history`, schemas RecordHistory*). Authz matrix updated. New tests in test_library.py (land documents: roles, 404, order, scoping, deed link, approved record; history: roles, per-version edits through a correction, flat edits, shortening, scoping). Checked: py_compile only. NOT RUN: pytest (no network in the sandbox), ruff, frontend.
H7a (2026-10-18) ✅ — document library list API: `GET /documents` (REVIEWER+, citizens 403; backend/app/services/library.py, schemas LibraryItem/LibraryList). Scope like the queue (`doc_scope`) plus the user's own uploads; tabs mine / office / action; filters status, type, profile, office/upazila/district/division, date range; search deed no, mouza, party name, land id (Bangla digits folded); sort created_at / status / deed_date; items carry historical, digitised + approved_version + versions, needs_my_action. Tests: new test_library.py (16) + security suites 48 pass, neighbouring suites 112 pass, ruff clean. Not run: full backend suite, Postgres, frontend (unchanged).
H6e (2026-10-18) ✅ — H6 done: e2e frontend/e2e/historical.spec.ts (sample deed PDF → digital deed form → edit + add witness → reload → four-eyes → reviewer approves → APPROVED record, signature VALID, original hash kept); real-OCR mode `npm run e2e:historical` (E2E_REAL_OCR=1 in e2e/start-backend.sh). Backend flow walked locally with real Tesseract (approval needs the buyer NID: OWNER_NID_REQUIRED). Vitest 898, tsc, i18n OK. Not run: Playwright (no Chromium here), backend suites.
H6d (2026-10-18) ✅ — both readings, flags and source highlight of the digital deed: `deed/CandidatePicker.tsx` (flag badges DISAGREE / NOT_IN_TEXT + picker of the other reading → one `replace` op), `FieldValue` "Show on page" for values with `source.bbox`, `highlight.tsx` context, `DocumentPreview` box overlay on images / `#page=N` on PDFs, status + Clear + Escape, phone tab switch; EN+BN (2234 keys). Vitest 898 (new record-readings.test.tsx 8), tsc, i18n OK; Playwright not run.
H6c (2026-10-18) ✅ — lists of the digital deed: party cards (all values editable, role select, add party with role + name, remove with one-step confirm), schedule plots add/remove with every value editable, dag numbers add/remove, boundary compass (N/S/E/W, each side editable), witnesses / stamps / seals add/remove (frontend/features/review/deed/ListControls.tsx, BoundaryCompass.tsx, ExecutionList.tsx; BoundariesList removed). Ops: `add …/-`, `remove …/<i>`, `replace` by pointer through `PATCH /documents/{id}/extraction {record:[…]}`; list-level H1 issues shown at the list (ContainerIssues). Tests: vitest 890 (new record-lists.test.tsx 17), tsc, i18n 2223 keys OK. Not run: Playwright, backend.
H6b (2026-10-18) ✅ — edit single values of the digital deed: FieldValue gets an Edit button when it has a JSON pointer (`path`) and the document is reviewable; save = one `replace` op via `PATCH /documents/{id}/extraction {record:[…]}` (useRecordEdit queues saves, useReviewActions.saveRecord, answer refreshes record + derived 13). Wired: Registration (+kind/era), Dates (execution/registration), Consideration, Title recital, Execution (seller mark, writer, stamps, seals). Text / number / select / yes-no controls, empty = null; H1 issues from record_validation shown under their value (EN+BN review.deed.issues.*), refused saves keep the form open. Tests: vitest 873 (new record-edit.test.tsx 12), tsc, i18n 2203 keys OK. Not run: Playwright, backend.
H6a (2026-10-18) ✅ — read-only digital deed view: when deed_profile = historical and the API returns a record, ExtractionPanel shows frontend/features/review/deed/ (DeedView + Registration, Dates, Parties, Consideration, Schedule + Boundaries, Title recital, Execution sections, FieldValue = value + verbatim + legibility + confidence badge); modern deeds and historical deeds without a record keep the 13 flat rows; historical keeps them in a collapsed "Core fields" block. LHDR TS types in review/types.ts; labels review.deed.* EN+BN. Tests: vitest 861 (new deed-view.test.tsx 10), tsc, i18n 2183 keys OK. Not run: Playwright, backend.
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
Current phase: H7 ✅ (historical-deed roadmap §3b; H6 + H7 done); S2 (2026-10-06) 🟡 — demo video recorded automatically: docs/video/LandShield-BD-demo.mp4 (2:17, 1280×720 H.264, captions burned in + soft EN subtitle track, no audio) + LandShield-BD-demo.en.srt, by scripts/record_demo_video.cjs (Playwright drives the local app as admin on a fresh seed, mock OCR). Story = card S2: problem → Doc1 upload/OCR/confidence → approve (hash, Ed25519, ledger) → e-Mutation fast track → Doc2 → HIGH 70 evidence → mutation to hearing → ownership graph → Check Before You Buy LP-10900 (khas) → verify-a-copy Doc1_altered ALTERED (land area) → tamper_demo BROKEN #7 → restore INTACT → Bangla evidence → public QR → closing. Every scene checked frame by frame. docs/demo-script.md: "Automated recording" section. Video files git-ignored (6 MB; copy in the parent folder).
S2-b (user): watch it; optional voice-over; upload (YouTube unlisted or Drive, "anyone with link") → send the link → VIDEO_URL in docs/concept-note.md + re-export PDF + README.
S1: ✅ (concept note PDF 3 p; only VIDEO_URL left).
OPEN (carried): EN+BN evidence i18n for ACTIVE_LITIGATION/KHAS_LAND/UNDER_ACQUISITION/ACTIVE_MORTGAGE not done; real OCR (tesseract) path of verify-document untested; ML scoring skipped in plain dev venv; Docker image never built locally; `next build` not run. Ledger chain is only as strong as DB write access (anchoring head hash off-DB is a T1 idea).
Citizen tools: C1 ✅ C2 ✅ C5 ✅; left C3 → C4 (backend) (cards in roadmap.md §5 "C —"); suggested pairing C1+C2 in one window.
Auth panel photo (2026-10-15) ✅ — sign in / sign up / officer request left panel now uses the farmer-with-phone photo (public/landing/farmer-480|768.webp, optimised from the supplied JPG) under a deep-green scrim (readable title top, darker bottom for the 3 point cards, face + phone stay visible); old wave SVG removed, point cards get blur. Files: app/globals.css (.auth-panel), features/auth/AuthShell.tsx. Desktop: photo is a flexible .auth-photo block between title and the 3 cards (grows with tall forms like officer request, no empty gap, edges fade into the green; min-h 34rem); checked in headless Chromium at 1280 px EN. NOT checked: phone width (headless window min width), BN, dark mode.
Auth panel v3 (2026-10-16) ✅ — left panel redesigned so the farmer is visible on one screen: desktop panel is now a sticky photo frame (lg:sticky top-20, height min(100dvh − 8.5rem, 50rem), min 34rem) with the photo full-bleed, a green fade top (shield inline with title) and bottom (3 compact point cards), face + phone clear in the middle; fades end in panel green so tall forms (officer request) show no seam and the photo stays in view while the form scrolls; points hidden when viewport height ≤ 700 px. glass-card + aside use overflow-clip (sticky needs it). Files: features/auth/AuthShell.tsx, app/globals.css (.auth-photo). Checked headless Chromium: 1440×900, 1920×1080 (top + scrolled), 1366×768, 1280×680, 1280×800 BN, 390 px phone. Vitest 502, tsc OK.
Map + header fix (2026-10-16) ✅ — parcel map controls missing on some devices: MapView used a 100vw breakout (relative left-1/2 w-[calc(100vw-0.5rem)]); with a classic Windows scrollbar 100vw > page width, so the page scrolled sideways and the search menu, zoom, Fullscreen and legend went off screen. Map now sits in the page column (w-full, rounded border); scrollWidth == clientWidth at 1240–1920 px with real scrollbars. Header: inline nav breakpoint 1120 → 1280 px (HeaderNav, HeaderMenu, UserMenu) because EN with 5 signed-in links wrapped/squeezed between 1120–1200 px and could push "Parcel map" out; below 1280 px the hamburger panel lists every link. Vitest 502, tsc OK.
Map legend toggle (2026-10-16) ✅ — legend can now be hidden at every width like the search menu: "Hide legend" (EyeOff) in the legend header, "Show map legend" glass button bottom-right when hidden; starts closed on phones (< 640 px), open from 640 px. Keys map.hideLegend / map.showLegend EN+BN (1416 keys). New vitest (hide → show). Vitest 503, tsc OK. Checked headless 1280 px EN + BN.
ArtCard fix (2026-10-16) ✅ — landing "Online services" / "Citizen tools" cards (and /tools hub) squeezed the text into a one-word column at 600–900 px (2-up grid + fixed 10rem right padding for the illustration). ArtCard now sizes by its own width (container queries, .art-card in globals.css: 6 / 7.5 / 10 rem art at < 24 / 24–30 / ≥ 30 rem card) and a float spacer keeps text clear of the illustration (wraps beside it, full width below). Checked headless 360, 700, 870, 1024, 1280 EN + 700 BN, no horizontal overflow. Vitest 503, tsc OK.
Auth panel sticky fix (2026-10-16) ✅ — left photo panel moved, stopped, then moved again while scrolling (sticky top was 80 px but the frame rests at 106 px, so it slid 26 px before pinning, then left after ~70 px). Sticky top is now the resting position (lg:top-[6.625rem]) and height min(100dvh − 7.625rem, 52rem): the panel never moves until the card's end reaches it, then leaves with the card. Measured frame position per scroll step on login / signup / officer request at 1440×800, 1920×1080, 1280×680. Vitest 503, tsc OK.
Auth panel seam fix (2026-10-16) ✅ — while scrolling, the strip of panel above the pinned photo frame showed the lighter radial-glow background as a separate band. Desktop panel background is now solid #0A3527 (same as the top of the frame fade): lg:bg-[#0A3527] lg:bg-none on the aside only (.auth-panel CSS unchanged, OfficerShell keeps its glow). Checked 1440×800 at scroll 0 / 40 / 70 (login) and 300 (officer request).
GIS district fix (2026-10-16) ✅ — map search menu: Gazipur listed no Sreepur (and no Kaliakair; Dakshinkhan/Uttar Khan were under it). Cause: the source tags polygons by name, so Gazipur's Sreepur carried Magura's Sreepur id, and the nearest-polygon fallback put 40 untagged polygons in the wrong district (Dhaka city thanas under Kushtia/Magura/Narayanganj, Hatiya/Kabirhat/Senbagh/Subarnachar/Companiganj/Hajiganj/Gangni/Meherpur Sadar/Austagram/Lalmonirhat Sadar/Kanthalia/Roypura/Manoharganj/Narayanganj Sadar elsewhere; Mirpur, Daulatpur, Mohammadpur, Pirganj pairs swapped). Audited every polygon against its district centre; scripts/build_gis_data.py now has a FIXES table and database/gis/{districts,divisions,upazilas}.geojson are regenerated (544 / 64 / 8, ids unique). Gazipur = Sadar, Kaliakair, Kaliganj, Kapasia, Sreepur; Magura = Sadar, Mohammadpur, Shalikha, Sreepur. New test_gis test; backend 737 pass (4 skipped), vitest map 37. NOT touched: officer-request office list (backend/app/data/land_offices.json already has all 5 Gazipur upazilas incl. Sreepur, LO-01544).
UI v2 (2026-10-15) ✅ — UI REDESIGN V2 finished: R0–R12 done, one commit per phase on claude/stoic-edison-l9gpeh (V2.7 decisions: recommended defaults). Vitest 500, tsc, i18n 1408 keys OK; overflow matrix 320–1440 px EN/BN light/dark: none. NOT done: Lighthouse, real devices, `next build` (Google Fonts unreachable in the sandbox), map parcel bottom sheet. docs/ui.md = Design v2.
Next work    : redeploy (Vercel) and recheck /map on the Windows laptop + auth panel v3 on a real screen (dark, Safari sticky), then manual QA of UI v2 on real devices + `next build` + Lighthouse (user/CI); then C3, C4, S2-b, S3 (user).
Next phase   : H10 (H9e written; run the archive tests first; H9d written; run `python -m pytest -q tests/test_risk_historical.py tests/test_risk_rules_b.py` + the full backend suite + `npx vitest run features/risk`); H9a + H9b + H9c frontend verify (pytest tests/test_chain_of_title.py tests/test_records.py tests/test_lands.py tests/test_library.py; vitest features/result features/library; tsc) ; H8 verify (H8a spike, H8c + H8d + H8e tests); H8c + H8d verify (install weasyprint + pymupdf + segno, run their tests) → H8e; H8a PDF engine spike (docs/historical-deed-roadmap.md §3b.5; H8a/H9a can run any time; run `npm run e2e:historical` and `npm run e2e:library` once with Chromium + Tesseract ben) · S2-b upload + VIDEO_URL (user) → S3 submit Round 1 🔒 (both skipped by request; user does them). Re-export the concept note PDF (scripts/export_concept_note.py, needs Chromium): its Bangla-OCR sentence changed.
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
| Next | E5 | Accessibility pass on every route (axe, 125 %, 360 px, keyboard) | Must | ✅ |
| Next | E6 | Officer-side consistency + session-timeout warning | Could | ✅ |
| V2 | R0 | Tokens + utilities (brand colours, radii, fluid type, blur fallback) | Must | ✅ |
| V2 | R1a/b | Core components v2 (Card/Button/Badge · Input/Select/Tabs/Modal) | Must | ✅ |
| V2 | R2 | PageHero band + PageHeader v2 + backdrop on public pages | Must | ✅ |
| V2 | R3 | System states: 404, error, loading skeletons, empty | Must | ✅ |
| V2 | R4a/b | Service pages (verify, check, track · verify-document, feedback) | Must | ✅ |
| V2 | R5a/b/c | Result + report (summary/risk · tables → cards · report, QR, check result) | Must | ✅ |
| V2 | R6 | Tools hub + calculators | Should | ✅ |
| V2 | R7 | Hubs + reading pages (charter, sitemap, about, FAQ, legal) | Should | ✅ |
| V2 | R8a-d | Officer workspace (shell+KPIs · queue/alerts · review/upload · mutations/admin) | Should | ✅ |
| V2 | R9 | Map + graph (glass overlays, mobile bottom sheet) | Could | ✅ |
| V2 | R10 | Motion + feedback (reveal, shimmer, toasts) | Could | ✅ |
| V2 | R11 | Responsive + a11y + performance QA gate 🔒 | Must | ✅ (Lighthouse, real devices, next build not run) |
| V2 | R12 | Cleanup (hex → tokens, dead classes, docs/ui.md v2) | Should | ✅ |

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

## UI REDESIGN V2 — whole site in the landing + sign-in style (roadmap 2026-10-15)
Goal: every page looks and behaves like the new landing page (`/`) and sign-in pages (`/login`, `/signup`, `/officer-signup`), and works well from a 320 px phone up to a 2560 px monitor. Today only those pages, the header and the footer use the new style; every inner page still uses the flat U1–U7 look (bordered white cards, flat grey tabs, plain tables) — checked 2026-10-15 on `/track`, `/services`, `/tools/fees` and the officer area.
Rules for this track: no route, `data-testid`, aria or i18n-key renames without updating tests (RULES 2); EN+BN parity for any new string; demo only (no gov emblem/wording); one phase = one commit on a topic branch, never on `remove-scraped-data`; budget per phase stays RULES 1 (≤ 6 files, ≤ ~200 LOC) — big phases are already split into a/b/c.

### V2.1 Design language (source of truth = what is live on `/` and `/login`)
| Element | Now lives in | Rule for every page |
|---|---|---|
| Deep green brand surface | `.header-glass`, `.auth-panel`, `.hero-banner` (globals.css) — gradient #0A3527 → #0F4A35 | Header, footer, page hero bands, sign-in panel, officer sidebar header. White text only on this surface. |
| Gold accent | #D6B25C / #E9C96F / #F1D88C, `.btn-gold`, active nav underline | One gold touch per view: active nav, accent bar under H1/H2, primary CTA on dark surfaces. Never body text on light surfaces (contrast). |
| Page background | `features/landing/Backdrop.tsx` (contours + plot grid, fades out) | Public pages: backdrop at the top. Officer area: plain `surface-muted` (dense data, no decoration). |
| Glass card | `.glass-card`, `.glass-card-link` (14 px radius, translucent surface, soft lifted shadow, hover lift) | Default container for every card, form, table wrapper, notice and modal. Replaces `rounded-lg border border-line bg-surface`. |
| Section panel | `.section-panel` (20 px radius, tinted green + gold glow) | Groups a whole section (e.g. result "Evidence", FAQ group). Max one or two per page. |
| Icon tile | `.icon-tile` (40 px tinted square) | Every list/feature icon. Lucide icon inside, never bare. |
| 3D illustrations | `features/landing/Illustrations.tsx` (Plot, Checklist, Route, Deed, TapeMeasure, FeeCalculator, Scale, Shield) | One per service page hero + empty/error states. Reuse; new ones only where no fit exists (see V2.5). |
| Headings | Plus Jakarta Sans (H1/H2 via `font-display`), `.section-title` accent bar | H1 once per page in the page hero; H2 = section titles with accent bar; H3 Inter semibold. |
| Body | Inter; Bangla = Noto Sans Bengali | Unchanged. Line length 60–75 ch for reading pages. |
| Radius scale | 8 (inputs/buttons) · 14 (cards) · 20–22 (panels, auth card) · 24 (hero banner) | Tailwind `rounded-2xl` is capped at 8 px in tailwind.config.ts → add named radii in R0. |
| Motion | hover lift 3 px, 200–300 ms, illustration rise; all off under `prefers-reduced-motion` (global rule) | No motion that carries meaning; no parallax. |

### V2.2 Page templates (every route maps to one)
| Template | Layout | Routes |
|---|---|---|
| **A · Service page** | Compact green **page hero band** (breadcrumb, H1, purpose, small 3D illustration on the right, gold accent) → two columns ≥ 1024 px: form in a glass card (7/12) + sticky "What you need" glass card (5/12). Below 1024: "What you need" collapses into a `<details>` above the form. Submit = 48 px full-width on phones. | `/verify`, `/check`, `/track`, `/verify-document`, `/tools/units`, `/tools/fees`, `/tools/inheritance`, `/feedback` |
| **B · Result / report** | Summary header glass card (record id, location, big risk badge, "data as of", actions: report, QR, share) → section tabs as a segmented pill bar that turns into a sticky horizontal-scroll chip row on phones → each section a glass card; tables in glass wrappers that become stacked "key: value" cards < 640 px. Print stays flat (no glass, no backdrop). | `/verify/result`, `/check` (result state), `/report/[id]`, `/v/[landId]` (public QR), `/verify/graph` |
| **C · Hub** | Page hero band → grid of `ArtCard`s (same component as landing services/tools). | `/tools`, `/services` (charter: one glass card per service with a "what it costs / how long / who" icon-tile row), `/sitemap` |
| **D · Reading page** | Page hero band → 70 ch column; desktop ≥ 1280: sticky table of contents on the left; FAQ as accordion glass cards; "Last updated" chip. | `/about`, `/faq`, `/accessibility`, `/privacy`, `/terms`, `/data-sources` |
| **E · Workspace (officer)** | Light content area (no backdrop) · sidebar: deep-green header block with office name + glass nav items with gold active bar · KPI tiles = glass cards with icon tiles · tables in glass wrappers with sticky header · review = two panes with sticky glass action bar. Below 1024: sidebar becomes the existing overlay menu pattern (like the header panel); tables → cards < 640. | `/officer`, `/officer/review/[id]`, `/officer/upload`, `/officer/mutations`, `/officer/mutations/[id]`, `/officer/admin`, `/officer/audit-logs`, `/officer/archive`, `/officer/feedback` |
| **F · Map / graph canvas** | Full-width canvas, floating glass panels (search, legend, details). Phones: details become a bottom sheet (drag handle, 40/90 % snap), legend behind a button. | `/map`, `/verify/graph` canvas |
| **G · System states** | Centred glass card with a 3D illustration, H1, one line, one primary + one secondary action. | `not-found.tsx`, `[...rest]`, `error.tsx`, `loading.tsx` (skeletons), `EmptyState`, `ErrorState`, `LoadingState`, `RequireRole` "not allowed" |
| **Done** | — | `/` (landing), `/login`, `/signup`, `/officer-signup`, header, footer |

### V2.3 Responsive system (applies to every phase)
- **Breakpoints:** 320 · 360 · 375/390/414 (phones) · 600 · 768 (tablet portrait, `md`) · 1024 (`lg`, tablet landscape / small laptop) · 1120 (header menu switch, keep) · 1280 · 1440 · 1920+. Container stays 1200 px max (E1); on ≥ 1920 the backdrop and hero band stretch, content does not.
- **Fluid type:** H1 `clamp(1.75rem, 1.2rem + 2.2vw, 2.6rem)`, H2 `clamp(1.375rem, 1.1rem + 1vw, 1.75rem)`; Bangla keeps its own sizes/line heights (`:lang(bn)` rules in globals.css).
- **Grids:** cards `1 col < 640 · 2 cols ≥ 640 · 3 cols ≥ 1024` (services/tools hubs keep 2 + centred odd card); forms 1 col < 768, 2 col ≥ 768 for short fields (E1 rule), long fields always full width.
- **Touch:** 44 px minimum targets (already global), 48 px primary buttons, 8 px gap between tappable items, no hover-only information.
- **Tables:** < 640 px every data table renders as stacked cards (`Table` gets a `stackOnMobile` prop — one implementation, used everywhere); ≥ 640 horizontal scroll with sticky first column only when > 5 columns.
- **Sticky UI:** header 64 px; page-level action bars (review approve/reject, result actions) sticky bottom on phones with `padding-bottom: env(safe-area-inset-bottom)`.
- **Viewport units:** use `dvh` for full-height panels (map, auth card on phones) so mobile browser bars do not cut content.
- **Landscape phones (≤ 480 px tall):** page hero band shrinks to title only; bottom sheets max 85 % height.
- **Zoom / text size:** layout must hold at 200 % zoom and 125 % OS text at 360 px (E5 rule) — no fixed heights on text containers, illustrations hide below 360 px when space is short.
- **Long Bangla strings:** test with BN for every phase; buttons/tabs wrap to 2 lines instead of truncating; never `whitespace-nowrap` on translated text except nav links ≥ 1120 px.
- **Dark mode:** every new surface uses tokens; the deep green surfaces stay the same in both themes; check each phase in dark.
- **Performance:** `backdrop-filter` only on cards above the backdrop/photo; add `@supports not (backdrop-filter: blur(1px))` fallback to a solid surface; max ~12 blurred elements per screen (low-end Android); photos as WebP with an 800 px mobile file (as `/landing/hero-*`); illustrations stay inline SVG (no requests); no layout shift (reserve illustration boxes).
- **Print:** report and result pages print flat and light (existing `@media print` block) — glass, backdrop, hero bands hidden.

### V2.4 Phases
| # | Phase | Pri | Size | Depends |
|---|---|---|---|---|
| R0 | Tokens + utilities (brand colours, radii, fluid type, blur fallback) | Must | S | — |
| R1a / R1b | Core components v2 (Card/Button/Badge · Input/Select/Tabs/Modal) | Must | M | R0 |
| R2 | PageHero band + PageHeader v2 + backdrop on public pages | Must | S | R0 |
| R3 | System states (404, error, loading skeletons, empty, not-allowed) | Must | S | R1a, R2 |
| R4a / R4b | Service pages (verify, check, track · verify-document, feedback) | Must | M | R1, R2 |
| R5a / R5b / R5c | Result + report (summary/risk · tables → cards · report, QR, check result) | Must | L | R1, R4 |
| R6 | Tools hub + calculators | Should | S | R1, R2 |
| R7 | Hubs + reading pages (services charter, sitemap, about, FAQ, legal) | Should | M | R2 |
| R8a / R8b / R8c / R8d | Officer workspace (shell+KPIs · queue/alerts/charts · review+upload · mutations/admin/audit/archive) | Should | L | R1 |
| R9 | Map + graph (glass overlays, mobile bottom sheet) | Could | M | R1 |
| R10 | Motion + feedback (reveal on scroll, skeleton shimmer, toasts) | Could | S | R1 |
| R11 🔒 | Responsive + a11y + performance QA gate | Must | M | all |
| R12 | Cleanup (dead tokens/classes, docs/ui.md v2) | Should | S | R11 |

**R0 — Tokens + utilities** [Must · S · frontend]
- Files: `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `docs/ui.md`.
- Add CSS variables `--brand-deep` (10 53 39), `--brand-deep-2` (15 74 53), `--gold` (214 178 92), `--gold-strong` (233 201 111), `--gold-soft` (241 216 140); Tailwind colours `brand-deep`, `brand-deep-2`, `gold`, `gold-strong`, `gold-soft` (same `rgb(var(--x) / <alpha-value>)` pattern).
- Named radii `rounded-card` 14 px, `rounded-panel` 20 px, `rounded-hero` 24 px; shadows `shadow-glass`, `shadow-lift`.
- Fluid H1/H2 sizes (V2.3) in the base layer; `@supports not (backdrop-filter…)` fallback for `.glass-card`, `.hero-banner` text panels.
- Do NOT yet replace the hex values already in Navbar/HeaderNav/HeaderMenu/Footer/AuthShell/Hero — that is R12 (keeps R0 inside budget).
- Test: vitest (ui-regression), tsc, visual diff `/` and `/login` unchanged (screenshots before/after at 375 + 1280).

**R1a — Card, Button, Badge v2** [Must · M · frontend]
- Files: `components/ui/Card.tsx`, `Button.tsx`, `Badge.tsx`, `ui.test.tsx`, `ui-b.test.tsx`.
- Card: default = glass (`glass-card rounded-card`), title row with `icon-tile`, optional `tone="panel"` → `.section-panel`; keep `variant="record"` accents as a 3 px left bar; `as` prop unchanged.
- Button: sizes `md` 44 px / `lg` 48 px, `variant="gold"` (`.btn-gold`) for dark surfaces, soft coloured shadow on primary, `fullWidthOnMobile` prop.
- Badge: pill (rounded-full), tones unchanged, optional leading dot/icon (status never colour-only).
- Test: vitest ui suites, tsc; spot-check `/services`, `/track`, `/officer` (they consume Card) at 375 + 1280, light + dark.

**R1b — Input, Select, Tabs, Modal v2** [Must · M · frontend]
- Files: `components/ui/Input.tsx`, `Select.tsx`, `Tabs.tsx`, `Modal.tsx`, `features/auth/PasswordInput.tsx`, `ui-b.test.tsx`.
- Inputs/selects: 48 px on touch, 8 px radius, `bg-surface` on glass, focus = 3 px green glow ring + border-primary, error state with icon + text, hint row; select placeholder never cut (E1 note).
- Tabs: two variants — `segmented` (the sign-in pill switch, for 2–4 options) and `underline` (default, for content tabs); on phones the tab row scrolls horizontally with fade edges, active tab scrolled into view; keyboard behaviour unchanged.
- Modal: glass panel 20 px radius, dimmed blurred scrim (same as header menu scrim); < 640 px = bottom sheet (full width, rounded top, drag handle, safe-area padding); focus trap + Escape unchanged.
- Test: vitest ui + auth suites, axe on `/login` and one modal (dismiss modal on `/officer`).

**R2 — PageHero band + PageHeader v2** [Must · S · frontend]
- Files: `components/PageHeader.tsx`, new `components/PageHero.tsx`, `app/[locale]/layout.tsx` (or a public layout group), `globals.css`.
- PageHero: deep-green rounded band (like the auth panel/hero banner, 20 px radius, contours + gold accent), breadcrumb (white/75 links, gold separator), H1, purpose, meta chips ("Data as of", "Ref", "Last updated"), optional `art` slot for an `Illustrations` component (hidden < 360 px), optional `actions` slot.
- PageHeader keeps its API (title, purpose, crumbs, meta) and renders PageHero → all E1–E6 pages that already use PageHeader upgrade at once; officer pages pass `variant="plain"` (light, no band).
- Backdrop: render once for public routes (not `/officer/*`, not `/map`), not per page; remove the per-page `<Backdrop />` on landing/login/signup/officer-signup in the same phase.
- Test: vitest (header, landing, info), tsc, i18n; screenshots `/services`, `/faq`, `/track` 360/768/1280, BN.

**R3 — System states** [Must · S · frontend]
- Files: `app/[locale]/not-found.tsx`, `error.tsx`, `loading.tsx`, `components/ui/EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`.
- 404/error: Template G with a new small "lost plot" illustration (map pin over an empty plot) — add to Illustrations.tsx only if file budget allows, else reuse `RouteArt`/`PlotSearchArt`.
- Loading: skeletons shaped like the target layout (hero band + 2 cards) with a subtle shimmer (off under reduced motion) instead of a spinner; keep the 300 ms delay (commit b3b4943).
- Empty/Error: glass card, icon tile, one-line reason, action button.
- Test: vitest, tsc; visit `/bn/does-not-exist`, force an error state, throttle network for loading.

**R4a — Service pages: verify, check, track** [Must · M · frontend]
- Files: `features/verify/VerifyForm.tsx`, `features/check/CheckForm.tsx`, `features/track/TrackView.tsx`, `features/services/WhatYouNeed.tsx`, the 3 page files only if layout props change.
- Template A: PageHero with `PlotSearchArt` / `ChecklistArt` / `RouteArt`; form in glass card; "What you need" as sticky right column ≥ 1024, `<details>` above the form < 1024; mouza combobox list in a glass popover; track stepper = icon tiles joined by the dashed connector from "How it works".
- Test: verify/check/track vitest, tsc, i18n; 360 px BN form fit (no cut placeholders), keyboard-only combobox.

**R4b — Service pages: verify-document, feedback** [Must · S · frontend]
- Files: `features/verify-document/VerifyDocumentView.tsx`, `features/feedback/FeedbackForm.tsx`, `features/feedback/PageHelpful.tsx`.
- Upload dropzone = dashed glass area with `DeedArt`, file chip after choose, result banner (MATCH / ALTERED) as a large status card with icon + text.
- "Was this page helpful?" becomes a slim glass bar with two pill buttons; thank-you state inline.
- Test: vitest, tsc; phone camera/file picker on 375 px.

**R5a — Result: summary + risk** [Must · M · frontend]
- Files: `features/result/ResultView.tsx`, `LandInfoCard.tsx`, `features/risk/RiskCard.tsx`, `EvidenceList.tsx`.
- Summary header card (Template B): land id, location, owner, big risk badge (icon + level + score), "data as of", action buttons (report, QR) — stacks on phones, actions become a sticky bottom bar.
- Risk card: level colour as a left band + icon tile, evidence items as expandable glass rows (rule, points, why, source).
- Section tabs → `Tabs variant="underline"` sticky under the header on desktop, scrollable chips on phones.
- Test: result + risk vitest, tsc; LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 unchanged (RULES 2); 360/768/1280, BN, dark.

**R5b — Result tables → responsive** [Must · M · frontend]
- Files: `components/ui/Table.tsx` (`stackOnMobile`), `features/result/TransactionsTable.tsx`, `MutationTable.tsx`, `EncumbranceTable.tsx`, `OwnershipTimeline.tsx`.
- Tables in glass wrappers, sticky header, zebra off, row hover tint; < 640 px stacked cards with label/value pairs; timeline = vertical line with icon-tile nodes (same language as the track stepper).
- Test: result vitest + ui tests, tsc; 320 px no horizontal scroll.

**R5c — Report, public QR, check result** [Must · M · frontend]
- Files: `features/report/ReportView.tsx`, `DocumentConsistencyCard.tsx`, `features/qr/PublicVerifyView.tsx`, `QrCard.tsx`, `features/check/CheckResult.tsx`.
- Report: on screen = Template B; print = existing flat A4 (verify `@media print` still hides glass/backdrop/hero band).
- Public QR page (opened from a phone camera, so mobile-first): signature status as a big card (valid/invalid with icon), record summary, open case / pending mutation counts as icon-tile chips.
- Check result: red-flag list as glass rows with severity icon tiles; overall verdict card on top.
- Test: report/qr/check vitest, tsc; print preview A4; open `/v/<id>` at 360 px.

**R6 — Tools** [Should · S · frontend]
- Files: `features/tools/ToolShell.tsx`, `ToolsHub.tsx`, `UnitConverter.tsx`, `FeeCalculator.tsx`, `InheritanceCalculator.tsx`.
- Hub uses `ArtCard` + `TOOL_ART` (export ArtCard from `features/landing/Sections.tsx` into `components/ArtCard.tsx` first — counts as one file).
- Calculators: inputs left, live result panel right (≥ 1024) / below (< 1024) as a `.section-panel`; big result number in display font; fee breakdown as a mini table that stacks on phones; inheritance shares as a horizontal bar per heir (icon + text + fraction, not colour only).
- Test: tools vitest (units/fees/faraid logic untouched), tsc, i18n.

**R7 — Hubs + reading pages** [Should · M · frontend]
- Files: `features/services/ServicesPage.tsx`, `features/info/InfoPage.tsx`, `features/info/pages.ts` (structure only), `app/[locale]/about/page.tsx`, `app/[locale]/sitemap/page.tsx`.
- Charter: one glass card per service — header with icon tile + name, 4 icon-tile facts (documents, fee, time, office), numbered "how to apply", CTA button.
- Reading pages: Template D (70 ch, sticky TOC ≥ 1280, FAQ accordion, "Last updated" chip). About page: replace the boxed logo image with the hero-banner photo style or the shield art.
- Test: info/services vitest, tsc, i18n, axe on each route.

**R8a — Officer shell + dashboard top** [Should · M · frontend]
- Files: `features/officer/OfficerShell.tsx`, `OfficerPageHeader.tsx`, `KpiCards.tsx`, `DashboardView.tsx`.
- Sidebar: deep-green header block (office, role badge), nav items with icon tiles, gold active bar, collapsible to icons at 1024–1279, overlay panel < 1024 (reuse header-menu pattern + scrim).
- KPI tiles: glass cards, icon tile, big number in display font, trend/subtext; 2 cols phone, 4 cols ≥ 1024, 8 tiles stay.
- Test: officer vitest, tsc; role check as reviewer/officer/admin (demo accounts) at 375/1024/1440.

**R8b — Queue, alerts, activity, charts** [Should · M · frontend]
- Files: `features/officer/QueueTable.tsx`, `Alerts.tsx`, `Activity.tsx`, `Charts.tsx`, `ChartCanvas.tsx`, `DismissModal.tsx`.
- Queue and alerts as glass tables (stack on phones); HIGH alerts with a red left band + icon tile; activity as a timeline; charts use brand colours from tokens (primary/gold/neutral) with legends that are text, not colour only.
- Test: officer vitest, tsc; dark mode charts readable.

**R8c — Review + upload** [Should · M · frontend]
- Files: `features/review/ReviewView.tsx`, `ReviewActions.tsx`, `ExtractionPanel.tsx`, `DocumentPreview.tsx`, `features/upload/UploadForm.tsx`.
- Review: two panes (document preview / extracted fields) with a draggable divider ≥ 1280, tabs (Document | Fields) on phones; sticky glass action bar (Approve / Reject) with safe-area padding; confidence shown as icon + percentage chip.
- Upload: dropzone like R4b, progress steps (Uploaded → OCR → Review) as the stepper.
- Test: review + upload vitest (four-eyes rules unchanged), tsc; 375 px review flow end-to-end.

**R8d — Mutations, admin, audit, archive, feedback admin** [Should · M · frontend]
- Files: `features/mutation/MutationQueue.tsx`, `MutationDetail.tsx`, `features/admin/AdminView.tsx`, `UsersPanel.tsx`, `features/admin/AuditLogs.tsx`, `features/archive/ArchiveSearch.tsx`.
- All on Template E; mutation detail state machine as the stepper; admin panels as glass cards with segmented tabs; audit log table stacks on phones; archive search bar like the landing search style.
- Test: mutation/admin/audit/archive vitest, tsc.

**R9 — Map + graph** [Could · M · frontend]
- Files: `features/map/MapView.tsx`, `ParcelList.tsx`, `popup.ts`, `globals.css` (leaflet popup block), `features/graph/GraphView.tsx`, `GraphLegend.tsx`.
- Floating glass search/legend panels; parcel details as a bottom sheet < 768; Leaflet popups use the glass card + deep-green title bar; 44 px map controls (already) restyled; graph controls in a glass toolbar.
- Test: map/graph vitest, tsc; touch pan/zoom on 375 px, keyboard map (E5).

**R10 — Motion + feedback** [Could · S · frontend]
- Files: new `components/Reveal.tsx` (IntersectionObserver fade/slide, one client component), `globals.css`, `features/landing/Sections.tsx`, a toast helper if any page needs one.
- Cards fade/slide in once; "How it works" connector draws on view; success/error toasts for officer actions. Everything disabled under `prefers-reduced-motion`; no motion on first paint (no CLS).
- Test: vitest, tsc; reduced-motion emulation.

**R11 🔒 — QA gate** [Must · M · QA]
- Files: `frontend/e2e/visual.spec.ts` (new), `frontend/e2e/mobile.spec.ts` (extend), `frontend/tests/a11y.test.tsx`, `docs/ui.md`.
- Playwright screenshot matrix: every public route × {360, 768, 1024, 1440} × {EN, BN} × {light, dark}; officer routes × {375, 1280} as reviewer + admin. Store baselines; fail on unexpected horizontal scroll (`scrollWidth > innerWidth`).
- axe on every route (extend E5 suite); keyboard-only pass of header menu, tabs, modals, combobox, map.
- Lighthouse mobile on `/`, `/verify`, `/verify/result`: LCP < 2.5 s, CLS < 0.05, TBT < 200 ms; no new network requests for decoration.
- Real-device check list: iPhone SE (375), a 360 px Android (Chrome), iPad portrait/landscape, 1366 laptop, 1920 desktop; Safari (backdrop-filter `-webkit-`), Firefox, Brave auto-dark.
- Contrast table for every new surface (white on deep green, gold on deep green, ink on glass over backdrop/photo) ≥ 4.5 : 1 → `docs/ui.md`.
- Gate: all green before R12; full regression (backend + vitest + e2e) like Q1.

**R12 — Cleanup** [Should · S · frontend]
- Files: `globals.css`, `tailwind.config.ts`, `features/landing/Navbar.tsx`, `components/HeaderNav.tsx`, `components/HeaderMenu.tsx`, `features/auth/AuthShell.tsx` (+ Footer/Hero if budget allows, else R12-b).
- Replace remaining hex classes (`text-[#D6B25C]` etc.) with R0 tokens; remove dead tokens (`--grad-*`, `--glass-*`, `brand-gradient`) once nothing uses them; update `docs/ui.md` to "Design v2" (tokens, templates, do/don't, screenshots).
- Test: full vitest, tsc, i18n, `next build`.

### V2.5 Assets needed
- Illustrations to add (inline SVG, same style): "lost plot" (404), "empty folder/search" (empty states), "upload tray" (dropzones), "officer desk/stamp" (officer dashboard empty), "signature seal" (QR verify). Reuse existing ones everywhere else.
- Photos (optional, from the user, like `public/landing/hero-*`): one per major area at most (verify, officer). The current hero photo shows the old UI on its laptop screen — a regenerated version with a blank or new-UI screen would remove the need to mask it.

### V2.6 Order and timing (one phase ≈ one working window)
1. Foundation: R0 → R1a → R1b → R2 → R3 (the whole site already looks ~60 % new after R2 because PageHeader/Card are shared).
2. Citizen journey: R4a → R4b → R5a → R5b → R5c → R6 → R7.
3. Officer side: R8a → R8b → R8c → R8d.
4. Extras: R9, R10 (skip if time is short).
5. Gate + tidy: R11 🔒 → R12.

### V2.7 Decisions to confirm before R0
- Backdrop on all public pages (recommended) or only landing + auth?
- Officer sidebar: deep-green header block + light nav (recommended, dense data stays calm) or fully deep-green sidebar?
- Page hero band on every service page (recommended) or plain PageHeader with accent bar only?
- Header nav items: keep current set, or add "Deed verification" + "Resources" like the earlier reference image (changes header tests)?

## KICKOFF PROMPT (paste in a new chat with the latest zip)
```text
Unzip the attached project. Read plan.md only, then run `grep -n "^### " roadmap.md` and view ONLY the card for the phase in "Next phase" (plus the roadmap §4 lines it names). Do exactly that card: touch only its files, run only its Test line, no repo exploration. Then update plan.md (STATE + status column), give me one zip of the whole project, and commit + push the phase to GitHub (RULES 4).
```

## RULES
1. Budget per phase: ≤ 6 files, ≤ ~200 LOC, ≤ ~25 tool calls. Running out → stop green, mark 🟡, write remaining steps as `<phase>-b` in STATE, zip.
2. Additive only: LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 must stay green; no prop/aria/testid renames without updating tests.
3. Zip (repo root): `rm -f frontend/.env.local backend/.env && zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' '*/storage/*' '*.db'`
4. Commit + push every finished phase (no need to ask): sync the work into the git repo `LandSheild-BD-repo` (exclude node_modules, .venv, .next, storage, *.db, .DS_Store, tsconfig.tsbuildinfo), then `git add -A && git commit` with a real message — first line `<PHASE>: <summary>`, then bullets of the actual changes — and `git push origin main`. A phase is done only when the zip exists and the push succeeded.
