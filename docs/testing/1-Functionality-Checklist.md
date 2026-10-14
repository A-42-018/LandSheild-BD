# LandShield BD — Full Functionality Checklist (Phase C5)

Tick `[x]` when it works, write `FAIL` + a note when it doesn't. Run on a fresh reset (see the Testing Guide, §2).
Demo data only. Login password for all demo accounts: `LandShield2026!`

| Account | Role |
|---|---|
| citizen@demo.landshield.test | CITIZEN |
| reviewer@demo.landshield.test | REVIEWER |
| officer@demo.landshield.test | OFFICER |
| admin@demo.landshield.test | ADMIN |

Tester: ____________  Date: ____________  Browser/device: ____________  Build/commit: ____________

---

## 1. Setup & health
- [ ] 1.1 `./scripts/demo_reset.sh` then `./start.sh` run without errors
- [ ] 1.2 Backend `http://127.0.0.1:8001/api/v1/health` returns OK
- [ ] 1.3 Frontend `http://localhost:3000/en` loads; `/bn` loads
- [ ] 1.4 API docs open at `http://127.0.0.1:8001/docs` (dev only)
- [ ] 1.5 Browser console has no red errors on landing page

## 2. Landing page `/en`
- [ ] 2.1 Hero, stats tiles, how-it-works, features, trust sections all render
- [ ] 2.2 "Demo Dataset — Not an Official Government Land Record" notice visible (hero/footer)
- [ ] 2.3 Top demo strip shows
- [ ] 2.4 Every header nav link goes to a working page (no 404)
- [ ] 2.5 Footer links work; disclaimer text present
- [ ] 2.6 Officer quick actions appear only for officer-level users

## 3. Header, language & theme
- [ ] 3.1 EN → BN switch keeps you on the same page
- [ ] 3.2 BN → EN switch works
- [ ] 3.3 No raw translation keys (e.g. `verify.title`) appear in either language
- [ ] 3.4 Bangla numerals / dates display correctly in BN
- [ ] 3.5 Theme toggle: Light / Dark / System each work
- [ ] 3.6 Theme choice survives page reload (no flash of wrong theme)
- [ ] 3.7 Active nav link highlighted for the current page
- [ ] 3.8 Mobile (375 px): menu button opens/closes panel; Esc closes it
- [ ] 3.9 Page title / favicon correct

## 4. Authentication
- [ ] 4.1 Login with each of the 4 demo accounts succeeds
- [ ] 4.2 Wrong password shows an error, no crash
- [ ] 4.3 Unknown email shows the same generic error
- [ ] 4.4 Empty fields show validation messages
- [ ] 4.5 Header shows user name + role badge after login
- [ ] 4.6 Sign-out returns to logged-out state; protected pages redirect to login
- [ ] 4.7 Refresh page while logged in keeps the session
- [ ] 4.8 Register a new account → created as CITIZEN only (cannot pick a role)
- [ ] 4.9 Register with duplicate email is rejected
- [ ] 4.10 Weak/short password rejected (min 8)
- [ ] 4.11 Login rate limit: 11+ rapid wrong attempts in a minute → "too many requests" (429)
- [ ] 4.12 Login page respects language (EN/BN)

## 5. Access control (RBAC)
| Page | Logged out | Citizen | Reviewer | Officer | Admin |
|---|---|---|---|---|---|
| /verify, /check, /map, /report | login / blocked | ✔ | ✔ | ✔ | ✔ |
| /officer (dashboard) | blocked | blocked | ✔ | ✔ | ✔ |
| /officer/review/[id], /officer/archive | blocked | blocked | ✔ | ✔ | ✔ |
| /officer/upload | blocked | blocked | blocked | ✔ | ✔ |
| /officer/mutations (view) | blocked | blocked | ✔ | ✔ | ✔ |
| Mutation transition buttons | – | – | hidden/denied | ✔ | ✔ |
| /officer/audit-logs | blocked | blocked | blocked | ✔ | ✔ |
| /officer/admin | blocked | blocked | blocked | blocked | ✔ |
- [ ] 5.1 Every cell of the table above matches actual behaviour
- [ ] 5.2 Blocked pages show a clear "not allowed" / redirect, not a blank page
- [ ] 5.3 Public pages work without login: `/`, `/about`, `/tools/*`, `/track`, `/v/[landId]`, `/verify-document`
- [ ] 5.4 Calling an officer API with a citizen token returns 403 (see guide §9)

## 6. Verify a parcel `/verify` → `/verify/result`
- [ ] 6.1 Form fields: district, upazila, mouza, khatian, dag
- [ ] 6.2 Search with valid details (Gazipur / Sreepur / Barmi / 1250 / 790) opens the result for LP-10240
- [ ] 6.3 Search with non-existent parcel shows a friendly "not found"
- [ ] 6.4 Empty submit shows validation errors
- [ ] 6.5 Result: land info card (district, upazila, mouza, dag, khatian, area) correct
- [ ] 6.6 Ownership timeline: current owner marked, past owners ordered by date
- [ ] 6.7 Transactions table lists deeds with seller/buyer/date/area
- [ ] 6.8 Risk card shows score 0–100, level LOW/MEDIUM/HIGH, meter ticks at 30 and 60
- [ ] 6.9 Evidence tab lists each rule with explanation (EN + BN text)
- [ ] 6.10 Mutation tab shows mutation history + mismatch notices
- [ ] 6.11 Cases/Encumbrances tab shows court case / khas / acquisition where seeded
- [ ] 6.12 Wording is "possible" / "indicator" — never "fraud confirmed"
- [ ] 6.13 Loading and error states show properly (stop backend → friendly error)

## 7. Seeded scenario expectations (fresh seed)
| Land | Scenario | Expected |
|---|---|---|
| LP-10001 | Clean | LOW 0 |
| LP-10100 | Normal chain | LOW 0 |
| LP-10234 | Live demo (no transactions) | LOW 0 |
| LP-10240 | Double sale | HIGH 70 — POSSIBLE_DUPLICATE_TRANSACTION + SELLER_MISMATCH |
| LP-10300 | Area mismatch (empty) | LOW 0 until doc uploaded |
| LP-10400 | Seller mismatch (empty) | LOW 0 until doc uploaded |
| LP-10500 | Duplicate deed no. | MEDIUM 30 — DUPLICATE_DEED |
| LP-10600 | Sold, not mutated | MEDIUM 30 — REGISTERED_NOT_MUTATED |
| LP-10700 | Mutated to other person | HIGH 60 — MUTATION_PARTY_MISMATCH |
| LP-10800 | Active court case | MEDIUM 30 — ACTIVE_LITIGATION |
| LP-10900 | Khas land | HIGH 60 — KHAS_LAND |
| LP-11000 | Under acquisition | HIGH 60 — UNDER_ACQUISITION |
- [ ] 7.1 – 7.12 each row above matches (tick per row: 7.1 = LP-10001 … 7.12 = LP-11000)
- [ ] 7.13 ML hint (if ML_SCORING=on) adds at most 15 points and never makes a parcel HIGH alone

## 8. Check Before You Buy `/check`
- [ ] 8.1 Enter land ID (e.g. LP-10240) + seller name "Karim" → six-row checklist appears
- [ ] 8.2 Rows: seller match, mutation, court case, khas/acquisition, open indicators, verdict
- [ ] 8.3 Verdict shows INDICATORS FOUND on LP-10240; clean on LP-10001 with correct seller (Jamal Hossain)
- [ ] 8.4 Wrong seller name on LP-10001 flags a mismatch
- [ ] 8.5 Seller > 120 characters rejected
- [ ] 8.6 Response/page shows NO owner names of the recorded owner
- [ ] 8.7 Unknown land ID → friendly error
- [ ] 8.8 Works in BN

## 9. Citizen report & QR
- [ ] 9.1 Create a verification request from result page ("Generate report")
- [ ] 9.2 `/report/[id]` opens: letter-style layout, risk summary, document consistency card
- [ ] 9.3 Print preview (Ctrl/Cmd+P) shows A4 layout, light palette, no nav chrome
- [ ] 9.4 QR code visible and scannable (phone) → opens `/v/LP-xxxxx`
- [ ] 9.5 Public page `/v/[landId]` loads WITHOUT login
- [ ] 9.6 Public page shows risk level + counts (open cases, pending mutations) and NO names, NID, hashes, file paths
- [ ] 9.7 Ed25519 signature chip shows VERIFIED
- [ ] 9.8 Unknown land ID on public page → clean not-found
- [ ] 9.9 Report page and public page work in BN

## 10. Ownership graph `/verify/graph`
- [ ] 10.1 Graph renders for LP-10240 (one seller linked to two buyers)
- [ ] 10.2 Clicking a node/edge shows detail panel
- [ ] 10.3 Legend visible; list view alternative works
- [ ] 10.4 Zoom / pan / fit controls work
- [ ] 10.5 Empty graph (LP-10234 before upload) shows an empty state, not a crash

## 11. Parcel map `/map`
- [ ] 11.1 Map loads with synthetic parcel polygons coloured by risk
- [ ] 11.2 Legend card shows LOW/MEDIUM/HIGH with text
- [ ] 11.3 Click polygon → popup with land ID and risk
- [ ] 11.4 Parcel list rows match polygons; click row zooms to parcel
- [ ] 11.5 Search panel: division → district → upazila filters work (no union/mouza here); Reset clears
- [ ] 11.6 Fullscreen button works; Esc exits
- [ ] 11.7 Demo-only note shown on page
- [ ] 11.8 Map works with tiles blocked (offline background / no crash)
- [ ] 11.9 Place search lists only divisions, districts and upazilas


## 12. Officer dashboard `/officer`
- [ ] 12.1 KPI tiles: total, pending, high risk, verified — numbers plausible
- [ ] 12.2 Charts render in light and dark themes
- [ ] 12.3 Review queue table lists documents; search/sort/filter work
- [ ] 12.4 Risk alerts list shows severity edge + level text
- [ ] 12.5 Alert status can be updated (reviewer+)
- [ ] 12.6 Activity feed shows recent actions
- [ ] 12.7 Sidebar links all work; active item highlighted

## 13. Document upload `/officer/upload` (officer/admin)
- [ ] 13.1 Upload `01_Doc1…png` succeeds; status moves UPLOADED → PROCESSING → REVIEW_REQUIRED
- [ ] 13.2 Land ID optional field accepted
- [ ] 13.3 Document type selector (DEED etc.) works
- [ ] 13.4 JPG and PDF upload (`09_Doc1_as_PDF_minimal.pdf`) accepted
- [ ] 13.5 Rejected: `.txt`, fake image, empty file, >10 MB, wrong extension (folder B) with a clear message
- [ ] 13.6 Unknown image with no demo marker goes through real OCR: it reaches review with empty/low-confidence fields (no crash; NO_MOCK_FIXTURE no longer exists). With Tesseract missing: FAILED with OCR_UNAVAILABLE
- [ ] 13.7 Drag-and-drop and file picker both work
- [ ] 13.8 Upload limit 20/hour per user enforced (429 message)
- [ ] 13.9 Reviewer / citizen cannot reach the upload page

## 14. OCR → Extraction → Human review `/officer/review/[id]`
- [ ] 14.1 Document preview (image) shows alongside extracted fields
- [ ] 14.2 13 fields extracted for deeds (owner, father, khatian, dag, mouza, district, upazila, area, unit, deed no, date, seller, buyer)
- [ ] 14.3 Per-field confidence shown; fields below 0.85 highlighted for review
- [ ] 14.4 Edit a field and save (PATCH) → value persists after reload
- [ ] 14.5 Approve posts deed + transaction + ownership history to the parcel
- [ ] 14.6 Approve also: hashes + signs the deed, adds a ledger entry, auto-creates an e-Mutation
- [ ] 14.7 Reject requires a reason; status becomes REJECTED
- [ ] 14.8 Reprocess re-runs extraction
- [ ] 14.9 Can't approve twice (second click blocked / 409)
- [ ] 14.10 Audit log records upload, edit, approve, reject

## 15. Fraud scenarios through upload (run in order on a fresh reset)
- [ ] 15.1 Upload+approve Doc1 on LP-10234 → result shows Rahim → Karim, LOW 0
- [ ] 15.2 Upload+approve Doc2 → HIGH 70: conflicting transaction + SELLER_MISMATCH
- [ ] 15.3 Graph for LP-10234 shows Rahim → two buyers
- [ ] 15.4 Doc2's mutation lands in HEARING (failed pre-checks)
- [ ] 15.5 Alert appears in Risk alerts for LP-10234
- [ ] 15.6 `05_AreaMismatch` on LP-10300 → AREA_MISMATCH indicator (12 vs 10 decimal)
- [ ] 15.7 `06_SellerMismatch` on LP-10400 → SELLER_MISMATCH (MEDIUM 30 expected)
- [ ] 15.8 `04_Clean` on LP-10001 → stays low risk
- [ ] 15.9 Plausibility rules: DEED_NO_FORMAT_INVALID (deed no. `ABCDEFG-12`), IMPOSSIBLE_DATE (sale dated before the seller acquired the land), RAPID_RESALE (resale within 60 days) triggered by editing fields in review (see guide §3g)

## 16. Khatian / Porcha parser
- [ ] 16.1 Upload `07_Khatian_RS` → survey type RS, district গাজীপুর, upazila শ্রীপুর, mouza বারমী, khatian 1245
- [ ] 16.2 Two owners with shares ১/২ each kept as a list for the reviewer
- [ ] 16.3 Two dags (785 → 10, 786 → 5.5 decimal) kept as list
- [ ] 16.4 Upload `08_Porcha_BS` → survey BS, Savar/Ashulia, khatian 610, one owner share 1, dag 210 → 12
- [ ] 16.5 Bangla digits are converted/understood; nothing is guessed
- [ ] 16.6 Approving a khatian / porcha works (no deed fields demanded), it appears in the archive, and it does NOT create a deed, transaction, ledger entry or mutation

## 17. Archive search `/officer/archive` (reviewer+)
- [ ] 17.1 Search a word from an approved document (e.g. "Barmi") returns results
- [ ] 17.2 Approve `07_Khatian_RS` first (needs khatian/mouza/district/upazila + survey type only), then filter by survey (CS/SA/RS/BS) and district works
- [ ] 17.3 Empty query → validation error (422 INVALID_QUERY)
- [ ] 17.4 Pagination (limit/offset) works
- [ ] 17.5 Only APPROVED documents appear; unapproved ones don't
- [ ] 17.6 SURVEY_CHAIN_GAP flagged when a later-survey owner has no link to earlier holders

## 18. e-Mutation `/officer/mutations`
- [ ] 18.1 Queue lists mutations with number, land, applicant, status, office
- [ ] 18.2 Open detail → pre-checks displayed
- [ ] 18.3 Valid transitions work: APPLIED → UNDER_REVIEW → HEARING / APPROVED / REJECTED
- [ ] 18.4 HEARING and REJECTED require a reason (modal blocks empty reason)
- [ ] 18.5 Illegal transition (e.g. APPROVED → APPLIED) rejected with 409
- [ ] 18.6 Reviewer sees queue/detail but cannot transition
- [ ] 18.7 Fast-track vs hearing flag visible
- [ ] 18.8 Each transition appears in audit log

## 19. Public mutation tracker `/track`
- [ ] 19.1 Enter `MUT-2012-0001` → timeline Applied → Review → Hearing → Decided with dates and office
- [ ] 19.2 Page shows no personal data and no land ID
- [ ] 19.3 Unknown / malformed number → "not found" (MUTATION_NOT_FOUND)
- [ ] 19.4 Works without login, in EN and BN
- [ ] 19.5 Days pending shown for open cases

## 20. Verify a copy `/verify-document` (public)
- [ ] 20.1 Upload `01_Doc1…png` → fields match the approved record (after Doc1 approved)
- [ ] 20.2 Upload `03_Doc1_altered…png` → area mismatch flagged (15 vs 10) → ALTERED
- [ ] 20.3 Typed-fields mode (manual entry) gives the same verdict
- [ ] 20.4 Uploaded file is NOT stored (check storage folder unchanged)
- [ ] 20.5 Invalid file types rejected
- [ ] 20.6 Stricter rate limit applies
- [ ] 20.7 Works without login

## 21. Citizen tools `/tools`
**Unit converter**
- [ ] 21.1 12.5 shatangsho (decimal) converts to all units; sq ft ≈ 5,445, katha ≈ 7.56
- [ ] 21.2 1 katha = 720 sq ft; 1 bigha = 14,400 sq ft (standard)
- [ ] 21.3 Bigha definition switch (standard / 33 shatangsho) changes the result
- [ ] 21.4 Invalid input (letters, negative, empty) shows error
- [ ] 21.5 Copy results works
**Fee calculator**
- [ ] 21.6 Deed value 2,500,000 BDT, Sale, City corporation → itemised: registration 25,000 · stamp duty 37,500 · local tax 75,000 · source tax 37,500 · mutation 1,100 · total 176,100
- [ ] 21.7 Gift and Inheritance types change the rates
- [ ] 21.8 Location (city/pourashava/union) changes the rates
- [ ] 21.9 Illustrative-rate disclaimer and date visible; Print works
**Inheritance (faraid)**
- [ ] 21.10 Husband + 1 son + 1 daughter → husband 1/4, son 1/2, daughter 1/4 (10 decimal plot → 2.5 / 5 / 2.5)
- [ ] 21.11 Plot area entered → each heir's area shown
- [ ] 21.12 Unsupported combinations show a clear note
- [ ] 21.13 All three tools: nothing leaves the device (no network call on calculate), EN + BN

## 22. Admin `/officer/admin`
- [ ] 22.1 Users list: search, role filter, active filter, sort, pagination
- [ ] 22.2 Create user (name, email, password ≥ 8, role, language) → appears in list; audit USER_CREATE
- [ ] 22.3 Edit user role / active / language → audit USER_UPDATE
- [ ] 22.4 Admin cannot change own role or deactivate self (409)
- [ ] 22.5 Deactivated user cannot log in
- [ ] 22.6 Land records panel lists parcels with no owner data
- [ ] 22.7 Documents panel lists documents with no file path shown
- [ ] 22.8 Ledger integrity card → Verify → INTACT on clean DB

## 23. Tamper evidence (ledger + signatures)
- [ ] 23.1 Run `python scripts/tamper_demo.py --land LP-10100`
- [ ] 23.2 Admin → Ledger integrity → Verify → BROKEN with first broken seq + reason
- [ ] 23.3 LP-10100 result now shows RECORD_INTEGRITY_FAILED (HIGH)
- [ ] 23.4 Run `--restore` → Verify → INTACT; LP-10100 back to LOW 0

## 24. Audit logs `/officer/audit-logs`
- [ ] 24.1 Login, upload, approve, reject, transition, user create/update events listed
- [ ] 24.2 Entries show time, actor, action, entity
- [ ] 24.3 Filter/pagination works
- [ ] 24.4 Reviewer/citizen cannot open it

## 25. About page `/about`
- [ ] 25.1 Content, team, disclaimer render in EN and BN

## 26. Security checks
- [ ] 26.1 Security headers present (CSP, X-Frame-Options, nosniff) on pages
- [ ] 26.2 Public payloads leak no names/NID/phone/hash/path (`/public/verify/LP-10240`)
- [ ] 26.3 Expired/garbage bearer token → 401
- [ ] 26.4 Role from DB, not token: editing JWT role claim doesn't grant access
- [ ] 26.5 Refresh cookie is HttpOnly; logout clears it
- [ ] 26.6 Rate limits: public 60/min/IP, auth 10/min, uploads 20/hour
- [ ] 26.7 Path traversal filename (`../../x.png`) doesn't write outside storage
- [ ] 26.8 `<script>alert(1)</script>` in search/seller/rejection reason is rendered as text, not executed
- [ ] 26.9 Uploaded file can't be fetched by another citizen / logged-out user

## 27. Language & wording
- [ ] 27.1 Every page checked once in BN: no English leftovers except proper nouns/IDs
- [ ] 27.2 Risk wording: "possible", "indicator", never "fraud confirmed" / "guilty"
- [ ] 27.3 Disclaimer ("does not establish legal ownership") present on report and result

## 28. Responsive & accessibility
- [ ] 28.1 375 px (phone): no horizontal scroll on landing, verify, result, report, officer pages
- [ ] 28.2 768 px (tablet) layout OK
- [ ] 28.3 1440 px (desktop) layout OK
- [ ] 28.4 Keyboard only: Tab reaches every control, visible focus ring, Esc closes modals/menus
- [ ] 28.5 Status never colour-only (text/icon accompanies colour)
- [ ] 28.6 Contrast readable in light and dark
- [ ] 28.7 Screen reader names on buttons/inputs (spot check with VoiceOver)
- [ ] 28.8 Reduced-motion setting stops spinners/animations

## 29. Browser matrix
- [ ] 29.1 Chrome  - [ ] 29.2 Edge  - [ ] 29.3 Firefox  - [ ] 29.4 Safari  - [ ] 29.5 Android Chrome  - [ ] 29.6 iPhone Safari

## 30. Automated suites (developer sanity)
- [ ] 30.1 Backend: `cd backend && pytest -q` all pass
- [ ] 30.2 `ruff check .` clean
- [ ] 30.3 Frontend: `npx vitest run` all pass; `npx tsc --noEmit` clean
- [ ] 30.4 `npm run check:i18n` parity OK
- [ ] 30.5 Playwright: `npm run e2e:install && npm run e2e` pass (never run before — expect to triage)
- [ ] 30.6 `next build` succeeds (needs internet for Google Fonts)

---
## Result summary
Total items: ____  Passed: ____  Failed: ____  Blocked: ____
Blocking bugs: ______________________________________________
Sign-off: ____________  Date: ____________
