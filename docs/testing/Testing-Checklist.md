<mark># LandShield BD — Full Functionality Checklist (Phase C5)</mark> Tick `[x]` when it works, write `FAIL` + a note when it doesn't. Run on a fresh reset (see the Testing Guide, §2). <mark>Demo data only. Login password for all demo accounts: `LandShield2026!`</mark> 

<mark>| Account | Role | |---|---| | citizen@demo.landshield.test | CITIZEN | | reviewer@demo.landshield.test | REVIEWER | | of</mark> fi <mark>cer@demo.landshield.test | OFFICER |</mark> 

<mark>| admin@demo.landshield.test | ADMIN |</mark> 

Tester: ____ __________  Date: ____ __________  Browser/device: ____ __________  Build/commit: ____ __________ **<mark>---</mark>** 

<mark>## 1. Setup & health</mark> 

- <mark>[ ] 1.1 `./scripts/demo_reset.sh` then `./start.sh` run without errors - [ ] 1.2 Backend `http://127.0.0.1:8001/api/v1/health` returns OK</mark> 

- <mark>[ ] 1.3 Frontend `http://localhost:3000/en` loads; `/bn` loads</mark> 

- <mark>[ ] 1.4 API docs open at `http://127.0.0.1:8001/docs` (dev only)</mark> 

- <mark>[ ] 1.5 Browser console has no red errors on landing page</mark> 

<mark>## 2. Landing page `/en`</mark> 

- <mark>[pass ] 2.1 Hero, stats tiles, how-it-works, features, trust sections all render</mark> - [pass ] 2.2 "Demo Dataset — Not an Official Government Land Record" notice visible (hero/footer) 

- <mark>[pass ] 2.3 Top demo strip shows</mark> 

- <mark>[pass ] 2.4 Every header nav link goes to a working page (no 404)</mark> 

- <mark>[pass ] 2.5 Footer links work; disclaimer text present</mark> 

<mark>- [pass ] 2.6 Ofcer quick actions appear only for of</mark> fi <mark>cer-level users</mark> fi 

<mark>## 3. Header, language & theme - [pass ] 3.1 EN → BN switch keeps you on the same page - [pass ] 3.2 BN → EN switch works - [pass ] 3.3 No raw translation keys (e.g. `verify.title`) appear in either language - [pass ] 3.4 Bangla numerals / dates display correctly in BN</mark> 

<mark>- [pass ] 3.5 Theme toggle: Light / Dark / System each work - [pass ] 3.6 Theme choice survives page reload (no f</mark> l <mark>ash of wrong theme) - [pass ] 3.7 Active nav link highlighted for the current page</mark> 

<mark>- [pass ] 3.8 Mobile (375 px): menu button opens/closes panel; Esc closes it</mark> 

<mark>- [pass ] 3.9 Page title / favicon correct</mark> 

<mark>## 4. Authentication - [pass ] 4.1 Login with each of the 4 demo accounts succeeds - [pass ] 4.2 Wrong password shows an error, no crash - [pass ] 4.3 Unknown email shows the same generic error - [pass ] 4.4 Empty f</mark> i <mark>elds show validation messages - [pass ] 4.5 Header shows user name + role badge after login - [pass ] 4.6 Sign-out returns to logged-out state; protected pages redirect to login - [pass ] 4.7 Refresh page while logged in keeps the session - [pass ] 4.8 Register a new account → created as CITIZEN only (cannot pick a role) - [pass ] 4.9 Register with duplicate email is rejected - [fail ] 4.10 Weak/short password rejected (min 8)</mark> - [fail ] 4.11 Login rate limit: 11+ rapid wrong attempts in a minute → "too many requests" (429) <mark>- [pass ] 4.12 Login page respects language (EN/BN) ## 5. Access control (RBAC) | Page | Logged out | Citizen | Reviewer | Ofcer</mark> fi <mark>| Admin | |---|---|---|---|---|---|</mark> 

<mark>| /verify, /check, /map, /report | login / blocked | ✔ | ✔ | ✔ | ✔ | | /ofcer (dashboard)</mark> fi <mark>| blocked | blocked | ✔ | ✔ | ✔ | | /ofcer/review/</mark> fi <mark>[id], /of</mark> fi <mark>cer/archive | blocked | blocked | ✔ | ✔ | ✔ | | /ofcer/upload</mark> fi <mark>| blocked | blocked | blocked | ✔ | ✔ | | /ofcer/mutations (view)</mark> fi <mark>| blocked | blocked | ✔ | ✔ | ✔ | | Mutation transition buttons | – | – | hidden/denied | ✔ | ✔ | | /ofcer/audit-logs</mark> fi <mark>| blocked | blocked | blocked | ✔ | ✔ | | /ofcer/admin</mark> fi <mark>| blocked | blocked | blocked | blocked | ✔ |</mark> 

<mark>- [pass ] 5.1 Every cell of the table above matches actual behaviour</mark> 

<mark>- [-----] 5.2 Blocked pages show a clear "not allowed" / redirect, not a blank page</mark> - [pass ] 5.3 Public pages work without login: `/`, `/about`, `/tools/*`, `/track`, `/v/[landId]`, `/verify-document` 

<mark>- [---- ] 5.4 Calling an ofcer API with a citizen token returns 403 (see guide §9)</mark> fi 

<mark>## 6. Verify a parcel `/verify` → `/verify/result` - [pass ] 6.1 Form felds: district, upazila, mouza, khatian, dag</mark> i - [pass ] 6.2 Search with valid details (Gazipur / Sreepur / Barmi / 1250 / 790) opens the result for LP-10240 

<mark>- [pass ] 6.3 Search with non-existent parcel shows a friendly "not found"</mark> 

<mark>- [pass ] 6.4 Empty submit shows validation errors</mark> 

<mark>- [pass ] 6.5 Result: land info card (district, upazila, mouza, dag, khatian, area) correct</mark> 

<mark>- [pass ] 6.6 Ownership timeline: current owner marked, past owners ordered by date</mark> 

<mark>- [pass ] 6.7 Transactions table lists deeds with seller/buyer/date/area</mark> 

<mark>- [pass ] 6.8 Risk card shows score 0–100, level LOW/MEDIUM/HIGH, meter ticks at 30 and 60 - [pass ] 6.9 Evidence tab lists each rule with explanation (EN + BN text)</mark> 

<mark>- [pass ] 6.10 Mutation tab shows mutation history + mismatch notices</mark> 

<mark>- [pass ] 6.11 Cases/Encumbrances tab shows court case / khas / acquisition where seeded</mark> 

<mark>- [pass ] 6.12 Wording is "possible" / "indicator" — never "fraud conf</mark> i <mark>rmed" - [pass ] 6.13 Loading and error states show properly (stop backend → friendly error) ## 7. Seeded scenario expectations (fresh seed) | Land | Scenario | Expected | |---|---|---| | LP-10001 | Clean | LOW 0 | | LP-10100 | Normal chain | LOW 0 | | LP-10234 | Live demo (no transactions) | LOW 0 |</mark> | LP-10240 | Double sale | HIGH 70 — POSSIBLE_DUPLICATE_TRANSACTION + SELLER_MISMATCH | <mark>| LP-10300 | Area mismatch (empty) | LOW 0 until doc uploaded | | LP-10400 | Seller mismatch (empty) | LOW 0 until doc uploaded | | LP-10500 | Duplicate deed no. | MEDIUM 30 — DUPLICATE_DEED | | LP-10600 | Sold, not mutated | MEDIUM 30 — REGISTERED_NOT_MUTATED | | LP-10700 | Mutated to other person | HIGH 60 — MUTATION_PARTY_MISMATCH | | LP-10800 | Active court case | MEDIUM 30 — ACTIVE_LITIGATION | | LP-10900 | Khas land | HIGH 60 — KHAS_LAND | | LP-11000 | Under acquisition | HIGH 60 — UNDER_ACQUISITION |</mark> 

<mark>- [pass ] 7.1 – 7.12 each row above matches (tick per row: 7.1 = LP-10001 … 7.12 = LP-11000)</mark> - [pass ] 7.13 ML hint (if ML_SCORING=on) adds at most 15 points and never makes a parcel HIGH alone 

<mark>## 8. Check Before You Buy `/check` - [pass ] 8.1 Enter land ID (e.g. LP-10240) + seller name "Karim" → six-row checklist appears</mark> - [pass ] 8.2 Rows: seller match, mutation, court case, khas/acquisition, open indicators, verdict - [pass ] 8.3 Verdict shows INDICATORS FOUND on LP-10240; clean on LP-10001 with correct seller (Jamal Hossain) 

<mark>- [pass ] 8.4 Wrong seller name on LP-10001 f</mark> l <mark>ags a mismatch</mark> 

<mark>- [---- ] 8.5 Seller > 120 characters rejected</mark> 

<mark>- [pass ] 8.6 Response/page shows NO owner names of the recorded owner - [pass ] 8.7 Unknown land ID → friendly error</mark> 

<mark>- [pass ] 8.8 Works in BN ## 9. Citizen report & QR - [pass ] 9.1 Create a verifcation request from result page ("Generate report")</mark> i <mark>- [pass ] 9.2 `/report/[id]` opens: letter-style layout, risk summary, document consistency card - [pass ] 9.3 Print preview (Ctrl/Cmd+P) shows A4 layout, light palette, no nav chrome - [pass ] 9.4 QR code visible and scannable (phone) → opens `/v/LP-xxxxx`</mark> 

<mark>- [pass ] 9.5 Public page `/v/[landId]` loads WITHOUT login</mark> - [pass ] 9.6 Public page shows risk level + counts (open cases, pending mutations) and NO names, NID, hashes, file paths 

<mark>- [---- ] 9.7 Ed25519 signature chip shows VERIFIED - [pass ] 9.8 Unknown land ID on public page → clean not-found</mark> 

<mark>- [pass ] 9.9 Report page and public page work in BN ## 10. Ownership graph `/verify/graph` - [pass ] 10.1 Graph renders for LP-10240 (one seller linked to two buyers) - [pass ] 10.2 Clicking a node/edge shows detail panel - [pass ] 10.3 Legend visible; list view alternative works - [pass] 10.4 Zoom / pan / ft controls work</mark> i <mark>- [pass ] 10.5 Empty graph (LP-10234 before upload) shows an empty state, not a crash ## 11. Parcel map `/map` - [pass ] 11.1 Map loads with synthetic parcel polygons coloured by risk - [pass ] 11.2 Legend card shows LOW/MEDIUM/HIGH with text - [pass ] 11.3 Click polygon → popup with land ID and risk - [pass ] 11.4 Parcel list rows match polygons; click row zooms to parcel</mark> - [fail mouza not supported - ] 11.5 Search panel: division → district → upazila → mouza filters work; Reset clears— <mark>- [pass ] 11.6 Fullscreen button works; Esc exits - [pass ] 11.7 Demo-only note shown on page - [fail ] 11.8 Map works with tiles blocked (ofine background / no crash)</mark> fl <mark>- [fail ] 11.9 Mouza level data available only for the demo division (Khulna) ## 12. Of</mark> fi <mark>cer dashboard `/of</mark> fi <mark>cer` - [pass ] 12.1 KPI tiles: total, pending, high risk, verifed — numbers plausible</mark> i <mark>- [pass ] 12.2 Charts render in light and dark themes</mark> - [fail-review queue not working properly ] 12.3 Review queue table lists documents; search/sort/filter work <mark>- [pass ] 12.4 Risk alerts list shows severity edge + level text - [pass ] 12.5 Alert status can be updated (reviewer+) - [pass ] 12.6 Activity feed shows recent actions - [pass ] 12.7 Sidebar links all work; active item highlighted ## 13. Document upload `/of</mark> fi <mark>cer/upload` (ofcer/admin)</mark> fi - [pass ] 13.1 Upload `01_Doc1…png` succeeds; status moves UPLOADED → PROCESSING → NEEDS_REVIEW <mark>- [pass ] 13.2 Land ID optional feld accepted</mark> i <mark>- [pass ] 13.3 Document type selector (DEED etc.) works - [pass ] 13.4 JPG and PDF upload (`09_Doc1_as_PDF_minimal.pdf`) accepted</mark> - [pass ] 13.5 Rejected: `.txt`, fake image, empty file, >10 MB, wrong extension (folder B) with a clear message - [pass ] 13.6 Unknown image with no mock marker fails gracefully (NO_MOCK_FIXTURE), no crash <mark>- [pass ] 13.7 Drag-and-drop and fle picker both work</mark> i <mark>- [---- ] 13.8 Upload limit 20/hour per user enforced (429 message) - [pass ] 13.9 Reviewer / citizen cannot reach the upload page</mark> 

<mark>## 14. OCR → Extraction → Human review `/of</mark> fi <mark>cer/review/[id]` - [pass ] 14.1 Document preview (image) shows alongside extracted felds</mark> i - [pass ] 14.2 13 fields extracted for deeds (owner, father, khatian, dag, mouza, district, upazila, area, unit, deed no, date, seller, buyer) <mark>- [pass ] 14.3 Per-feld conf</mark> i <mark>dence shown; f</mark> i i <mark>elds below 0.85 highlighted for review - [pass ] 14.4 Edit a feld and save (PATCH)</mark> i <mark>→ value persists after reload - [pass ] 14.5 Approve posts deed + transaction + ownership history to the parcel</mark> - [fail-not creates a sign  ] 14.6 Approve also: hashes + signs the deed, adds a ledger entry, auto-creates an e-Mutation <mark>- [pass ] 14.7 Reject requires a reason; status becomes REJECTED - [pass ] 14.8 Reprocess re-runs extraction - [pass ] 14.9 Can't approve twice (second click blocked / 409) - [pass ] 14.10 Audit log records upload, edit, approve, reject ## 15. Fraud scenarios through upload (run in order on a fresh reset) - [pass ] 15.1 Upload+approve Doc1 on LP-10234 → result shows Rahim → Karim, LOW 0 - [pass ] 15.2 Upload+approve Doc2 → HIGH 70: conf</mark> l <mark>icting transaction + SELLER_MISMATCH - [pass ] 15.3 Graph for LP-10234 shows Rahim → two buyers - [pass ] 15.4 Doc2's mutation lands in HEARING (failed pre-checks) - [pass ] 15.5 Alert appears in Risk alerts for LP-10234</mark> - [pass ] 15.6 `05_AreaMismatch` on LP-10300 → AREA_MISMATCH indicator (12 vs 10 decimal) <mark>- [pass ] 15.7 `06_SellerMismatch` on LP-10400 → SELLER_MISMATCH (MEDIUM 30 expected) - [pass ] 15.8 `04_Clean` on LP-10001 → stays low risk</mark> - [pass ] 15.9 Plausibility rules: DEED_NO_FORMAT_INVALID, IMPOSSIBLE_DATE, RAPID_RESALE triggered by editing fields in review (see guide §6.4) <mark>## 16. Khatian / Porcha parser</mark> - [pass ] 16.1 Upload `07_Khatian_RS` → survey type RS, district গা�জী�পু�র, upazila শ্রী�পু�র, mouza বা�রমী�, khatian 1245 <mark>- [pass ] 16.2 Two owners with shares ১/২ each kept as a list for the reviewer - [pass ] 16.3 Two dags (785 → 10, 786 → 5.5 decimal) kept as list</mark> - [pass ] 16.4 Upload `08_Porcha_BS` → survey BS, Savar/Ashulia, khatian 610, one owner share 1, dag 210 → 12 <mark>- [pass ] 16.5 Bangla digits are converted/understood; nothing is guessed ## 17. Archive search `/of</mark> fi <mark>cer/archive` (reviewer+)-archive option  not found</mark> - [fail- <mark>archive option not found</mark> ] 17.1 Search a word from an approved document (e.g. "Barmi") returns results <mark>- [---- ] 17.2 Filter by survey (CS/SA/RS/BS) and district works - [---- ] 17.3 Empty query → validation error (422 INVALID_QUERY) - [---- ] 17.4 Pagination (limit/ofset) works</mark> f <mark>- [pass ] 17.5 Only APPROVED documents appear; unapproved ones don't</mark> - [pass ] 17.6 SURVEY_CHAIN_GAP flagged when a later-survey owner has no link to earlier holders 

<mark>## 18. e-Mutation `/of</mark> fi <mark>cer/mutations` - [pass ] 18.1 Queue lists mutations with number, land, applicant, status, ofce</mark> fi <mark>- [pass ] 18.2 Open detail → pre-checks displayed</mark> - [pass ] 18.3 Valid transitions work: APPLIED → UNDER_REVIEW → HEARING / APPROVED / REJECTED - [fail-hearing not required a reason ] 18.4 HEARING and REJECTED require a reason (modal blocks empty reason) 

- <mark>[pass ] 18.5 Illegal transition (e.g. APPROVED → APPLIED) rejected with 409</mark> 

- <mark>[pass ] 18.6 Reviewer sees queue/detail but cannot transition</mark> 

<mark>- [pass ] 18.7 Fast-track vs hearing f</mark> l <mark>ag visible</mark> 

<mark>- [pass ] 18.8 Each transition appears in audit log ## 19. Public mutation tracker `/track`</mark> - [pass ] 19.1 Enter `MUT-2012-0001` → timeline Applied → Review → Hearing → Decided with dates and office <mark>- [pass ] 19.2 Page shows no personal data and no land ID - [pass ] 19.3 Unknown / malformed number → "not found" (MUTATION_NOT_FOUND)</mark> 

- <mark>[pass ] 19.4 Works without login, in EN and BN</mark> 

<mark>- [---- ] 19.5 Days pending shown for open cases ## 20. Verify a copy `/verify-document` (public)</mark> - [pass ] 20.1 Upload `01_Doc1…png` → fields match the approved record (after Doc1 approved) <mark>- [pass ] 20.2 Upload `03_Doc1_altered…png` → area mismatch f</mark> l <mark>agged (15 vs 10) → ALTERED - [pass ] 20.3 Typed-felds mode (manual entry) gives the same verdict</mark> i i 

- i 

- <mark>- [pass ] 20.4 Uploaded fle is NOT stored (check storage folder unchanged)</mark> i i 

i <mark>- [pass ] 20.5 Invalid fle types rejected</mark> i <mark>- [---- ] 20.6 Stricter rate limit applies - [pass ] 20.7 Works without login ## 21. Citizen tools `/tools`</mark> **<mark>**Unit converter**-not found</mark>** <mark>- [fail ] 21.1 12.5 shatangsho (decimal) converts to all units; sq ft ≈ 5,445, katha ≈ 7.56 - [fail ] 21.2 1 katha = 720 sq ft; 1 bigha = 14,400 sq ft (standard) - [fail ] 21.3 Bigha defnition switch (standard / 33 shatangsho) changes the result</mark> i <mark>- [---- ] 21.4 Invalid input (letters, negative, empty) shows error - [---- ] 21.5 Copy results works</mark> **<mark>**Fee calculator**-not found</mark>** - [fail ] 21.6 Deed value 2,500,000 BDT, Sale, City corporation → itemised: registration 25,000 · stamp duty 37,500 · local tax 75,000 · source tax 37,500 · mutation 1,100 · total 176,100 <mark>- [fail ] 21.7 Gift and Inheritance types change the rates - [fail ] 21.8 Location (city/pourashava/union) changes the rates - [fail ] 21.9 Illustrative-rate disclaimer and date visible; Print works</mark> **<mark>**Inheritance (faraid)**-not found</mark>** 

- [-- ] 21.10 Husband + 1 son + 1 daughter → husband 1/4, son 1/2, daughter 1/4 (10 decimal plot → 2.5 / 5 / 2.5) <mark>- [-- ] 21.11 Plot area entered → each heir's area shown - [-- ] 21.12 Unsupported combinations show a clear note - [-- ] 21.13 All three tools: nothing leaves the device (no network call on calculate), EN + BN ## 22. Admin `/of</mark> fi <mark>cer/admin` - [pass ] 22.1 Users list: search, role flter, active f</mark> i <mark>lter, sort, pagination</mark> i - [---- ] 22.2 Create user (name, email, password ≥ 8, role, language) → appears in list; audit USER_CREATE <mark>- [ pass] 22.3 Edit user role / active / language → audit USER_UPDATE - [pass ] 22.4 Admin cannot change own role or deactivate self (409) - [fail-deactivated users can login ] 22.5 Deactivated user cannot log in - [pass ] 22.6 Land records panel lists parcels with no owner data - [pass ] 22.7 Documents panel lists documents with no fle path shown</mark> i <mark>- [not found  ] 22.8 Ledger integrity card → Verify → INTACT on clean DB ## 23. Tamper evidence (ledger + signatures) - [ ] 23.1 Run `python scripts/tamper_demo.py --land LP-10100` - [ ] 23.2 Admin → Ledger integrity → Verify → BROKEN with frst broken seq + reason</mark> i <mark>- [ ] 23.3 LP-10100 result now shows RECORD_INTEGRITY_FAILED (HIGH) - [ ] 23.4 Run `--restore` → Verify → INTACT; LP-10100 back to LOW 0</mark> 

<mark>## 24. Audit logs `/of</mark> fi <mark>cer/audit-logs`</mark> 

- <mark>[pass ] 24.1 Login, upload, approve, reject, transition, user create/update events listed</mark> 

- <mark>[pass ] 24.2 Entries show time, actor, action, entity</mark> 

<mark>- [pass ] 24.3 Filter/pagination works</mark> 

<mark>- [pass ] 24.4 Reviewer/citizen cannot open it</mark> 

<mark>## 25. About page `/about`</mark> 

<mark>- [fail ] 25.1 Content, team, disclaimer render in EN and BN</mark> 

<mark>## 26. Security checks - [ ] 26.1 Security headers present (CSP, X-Frame-Options, nosnif) on pages</mark> f <mark>- [ ] 26.2 Public payloads leak no names/NID/phone/hash/path (`/public/verify/LP-10240`) - [ ] 26.3 Expired/garbage bearer token → 401</mark> 

- <mark>[ ] 26.4 Role from DB, not token: editing JWT role claim doesn't grant access - [ ] 26.5 Refresh cookie is HttpOnly; logout clears it</mark> 

- <mark>[ ] 26.6 Rate limits: public 60/min/IP, auth 10/min, uploads 20/hour - [ ] 26.7 Path traversal flename (</mark> i <mark>`../../x.png`) doesn't write outside storage</mark> 

- [ ] 26.8 `<script>alert(1)</script>` in search/seller/rejection reason is rendered as text, not executed 

<mark>- [ ] 26.9 Uploaded fle can't be fetched by another citizen / logged-out user</mark> i 

<mark>## 27. Language & wording</mark> 

- <mark>[pass ] 27.1 Every page checked once in BN: no English leftovers except proper nouns/IDs - [pass ] 27.2 Risk wording: "possible", "indicator", never "fraud confrmed" / "guilty"</mark> i 

- <mark>[pass ] 27.3 Disclaimer ("does not establish legal ownership") present on report and result</mark> 

- <mark>## 28. Responsive & accessibility</mark> - [pass ] 28.1 375 px (phone): no horizontal scroll on landing, verify, result, report, officer pages <mark>- [pass ] 28.2 768 px (tablet) layout OK - [pass ] 28.3 1440 px (desktop) layout OK</mark> - [pass ] 28.4 Keyboard only: Tab reaches every control, visible focus ring, Esc closes modals/menus <mark>- [pass ] 28.5 Status never colour-only (text/icon accompanies colour) - [ pass] 28.6 Contrast readable in light and dark - [pass ] 28.7 Screen reader names on buttons/inputs (spot check with VoiceOver) - [---- ] 28.8 Reduced-motion setting stops spinners/animations ## 29. Browser matrix</mark> 

- [ ] 29.1 Chrome  - [ ] 29.2 Edge  - [ ] 29.3 Firefox  - [ ] 29.4 Safari  - [ ] 29.5 Android Chrome  - [ ] 29.6 iPhone Safari <mark>## 30. Automated suites (developer sanity) - [ ] 30.1 Backend: `cd backend && pytest -q` all pass - [ ] 30.2 `ruf check .</mark> f <mark>` clean - [ ] 30.3 Frontend: `npx vitest run` all pass; `npx tsc --noEmit` clean - [ ] 30.4 `npm run check:i18n` parity OK</mark> - [ ] 30.5 Playwright: `npm run e2e:install && npm run e2e` pass (never run before — expect to triage) <mark>- [ ] 30.6 `next build` succeeds (needs internet for Google Fonts)</mark> **<mark>---</mark>** <mark>## Result summary</mark> 

<mark>Total items:</mark> _<mark>__</mark>_ <mark>__  Passed:</mark> _<mark>__</mark>_ <mark>__  Failed:</mark> _<mark>__</mark>_ <mark>__  Blocked:</mark> _<mark>__</mark>_ <mark>__ Blocking bugs:</mark> _<mark>__</mark>_ <mark>____________________________________________ Sign-of:</mark> f _<mark>__</mark>_ <mark>__________  Date:</mark> _<mark>__</mark>_ <mark>__________</mark> 

