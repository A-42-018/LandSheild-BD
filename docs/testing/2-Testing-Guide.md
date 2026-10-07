# LandShield BD — Website Testing Guide (Phase C5)

How to test the whole site, step by step, with the sample documents in `3-Sample-Documents/` and the tick-list in `1-Functionality-Checklist.md`.
All data is synthetic. Not a government system.

---
## 1. What you need
- A Mac/Linux terminal with Python 3.11+, Node 18+ and npm (the project's own requirements)
- The project folder (unzipped `landshield-phase-C5`)
- Chrome (main), plus Firefox/Safari for the cross-browser pass, and a phone
- Internet only for first `npm install`, `next build`, and map street tiles (the app itself runs offline)
- This testing pack

Demo password for all accounts: `LandShield2026!`

| Email | Role |
|---|---|
| citizen@demo.landshield.test | CITIZEN |
| reviewer@demo.landshield.test | REVIEWER |
| officer@demo.landshield.test | OFFICER |
| admin@demo.landshield.test | ADMIN |

## 2. Start a clean environment
From the project root:
```
./scripts/demo_reset.sh      # wipes DB, re-seeds 12 parcels + 4 users, clears uploads
./start.sh                   # backend :8001, frontend :3000
```
Open http://localhost:3000/en/login. Use **a fresh reset before each test round** — uploads change risk results permanently until the next reset.

Tip: keep two browser profiles (or one normal + one private window) so you can be logged in as two roles at once (e.g. officer + admin).

Keep these handy: browser DevTools (F12) → Console and Network tabs. Any red console error = note it.

## 3. How to record results
1. Open `1-Functionality-Checklist.md` in any editor/viewer that shows checkboxes (or print it).
2. For each item write `[x]` pass, or `FAIL: what happened`.
3. For each failure capture: page URL, role, steps, expected vs actual, screenshot, console error, language (EN/BN), browser.
4. Severity: **Blocker** (can't continue/data wrong) · **Major** (feature broken) · **Minor** (cosmetic/wording).

Bug template:
```
ID: BUG-001   Severity: Major   Checklist item: 14.5
Role: officer   Browser: Chrome 130   Lang: EN   Reset state: fresh
Steps: 1) … 2) … 3) …
Expected: …
Actual: …
Evidence: screenshot / console text
```

## 4. Recommended test order (≈ 3–4 hours full pass)
| Round | Time | Covers | Checklist § |
|---|---|---|---|
| 1. Smoke | 10 min | App starts, landing loads, login works | 1, 2, 4.1 |
| 2. Public / citizen | 40 min | Verify, result, check, report, QR, graph, map, tools, track, verify-a-copy | 6–11, 19–21 |
| 3. Officer pipeline | 60 min | Upload → review → approve → double-sale → mutations | 12–18 |
| 4. Admin & integrity | 25 min | Users, ledger, tamper demo, audit | 22–24 |
| 5. Security & RBAC | 30 min | Role matrix, leaks, rate limits, injection | 5, 26 |
| 6. Language/Theme/Responsive/A11y | 40 min | BN pass, dark mode, 375/768/1440, keyboard | 3, 27–29 |
| 7. Automated | 15 min | pytest, vitest, tsc, i18n, e2e | 30 |

---
## 5. Round-by-round instructions

### Round 1 — Smoke test
1. Visit `http://localhost:3000/en`. Page loads, hero + notice visible.
2. Visit `/bn`. Same page in Bangla.
3. Click each nav link; none should 404.
4. Login as officer → header shows name + role badge. Sign out.

### Round 2 — Public & citizen features
**2a. Verify (log in as citizen)**
- `/en/verify` → District `Gazipur`, Upazila `Sreepur`, Mouza `Barmi`, Khatian `1250`, Dag `790` → Search.
- Result page: land info, ownership timeline, transactions, risk card **HIGH 70**. Open the Evidence tab → two rules explained. Open Mutation and Cases tabs.
- Repeat for each seeded parcel; compare with the table in checklist §7. Spot-check at least LP-10001 (LOW), LP-10600 (MEDIUM), LP-10700, LP-10900 (HIGH 60).
- Negative: nonsense mouza → friendly not-found; empty form → validation errors.

**2b. Check Before You Buy** (`/en/check`)
- Land `LP-10240`, seller `Karim` → six rows, verdict INDICATORS FOUND.
- Land `LP-10001`, seller `Jamal Hossain` → clean-looking; seller `Someone Else` → mismatch.
- Confirm the page never shows the recorded owner's name.

**2c. Report + QR**
- From a result page click Generate report → `/en/report/<id>`. Check layout; press Cmd/Ctrl+P → A4 print preview.
- Scan the QR with a phone (or click it) → `/v/LP-10240`. Open it in a private window (not logged in): risk level + counts only; signature chip VERIFIED.
- Look for leaks: no names, NID, phone, hashes, file paths.

**2d. Graph** `/en/verify/graph` → LP-10240: one seller (Rahim) → two buyers. Click nodes, zoom, switch to list view.

**2e. Map** `/en/map` → polygons coloured by risk, popups, legend, fullscreen, search panel, reset.

**2f. Tools** `/en/tools` (no login needed)
| Tool | Input | Expected |
|---|---|---|
| Units | 12.5 decimal | ≈ 5,445 sq ft, ≈ 7.56 katha, 0.125 acre |
| Units | 1 bigha (standard) | 14,400 sq ft; switch to "33 shatangsho" and it changes |
| Units | `abc`, `-5`, empty | error message |
| Fees | Sale · City · 2,500,000 | Reg 25,000; Stamp 37,500; Local tax 75,000; Source tax 37,500; Mutation 1,100; **Total 176,100** |
| Fees | Sale · Pourashava · 2,500,000 | Total 138,600 |
| Fees | Sale · Union · 2,500,000 | Total 101,100 |
| Fees | Gift · any · 2,500,000 | Total 51,100 |
| Fees | Inheritance · any | Total 2,100 |
| Faraid | Husband 1, Son 1, Daughter 1, plot 10 decimal | Husband 1/4 (2.5), Son 1/2 (5), Daughter 1/4 (2.5) |
| Faraid | Wives 5 | rejected (max 4) |
Open DevTools → Network while pressing calculate: no requests should leave the device.

**2g. Mutation tracker** `/en/track` → `MUT-2012-0001` shows stages and dates; `MUT-9999-0000` and `abc` → not found. No names shown.

**2h. Verify a copy** `/en/verify-document` → covered in Round 3 after Doc1 is approved.

### Round 3 — Officer pipeline (the core demo)
Login as **officer**. Fresh reset assumed.

**3a. Doc1**
1. `/en/officer/upload` → choose `01_Doc1…png`, type DEED → Upload. Watch the status change UPLOADED → PROCESSING → REVIEW_REQUIRED.
2. Open the review page. Compare preview with fields: Deed D-2024-0785, 2024-02-12, Gazipur/Sreepur/Barmi, Khatian 1245, Dag 785, 10 decimal, seller Rahim Uddin, buyer Karim Mia. Note fields highlighted as low-confidence (< 0.85).
3. Edit one field (e.g. father name), save, reload → change persisted.
4. Approve. Then open `/en/verify/result` for LP-10234 → ownership Rahim → Karim, **LOW 0**.
5. Check audit log shows upload/edit/approve; Mutations queue has a new mutation for this deed.

**3b. Doc2 (double sale)**
1. Upload `02_Doc2…png` → review → approve.
2. LP-10234 result → **HIGH 70**; Evidence lists conflicting transaction + SELLER_MISMATCH with explanation.
3. Graph shows Rahim with two buyers. Risk alerts list has a HIGH item. Doc2's mutation sits in HEARING.
4. Wording check: nothing says "fraud confirmed".

**3c. Verify a copy** (public, even logged out)
- Upload `01_Doc1…png` → matches the record.
- Upload `03_Doc1_altered…png` → area 15 vs 10 flagged → ALTERED.
- Switch to typed fields and enter area 15 → same verdict.
- Confirm nothing new appears in the storage folder (file is not kept).

**3d. Other fraud samples** (each on a clean parcel)
- `05_AreaMismatch…` → AREA_MISMATCH on LP-10300.
- `06_SellerMismatch…` → SELLER_MISMATCH on LP-10400.
- `04_Clean…` → LP-10001 low risk.

**3e. Rejection flow**: upload `04_Clean…` again if allowed, click Reject with an empty reason → blocked; with a reason → REJECTED; check audit log.

**3f. Khatian parser**: upload `07_Khatian_RS…` and `08_Porcha_BS…`. In review check survey type, two owners with shares ½, two dags (785→10, 786→5.5). Approve one, then `/en/officer/archive` → search `Barmi` / filter survey RS.

**3g. Plausibility rules (manual edits in review before approving a fresh upload)**
| Edit | Rule expected |
|---|---|
| Deed no. → `ABCDEFG-12` (more than 4 letters; `XYZ-1` is a valid format and does NOT trigger it) | DEED_NO_FORMAT_INVALID |
| Deed date → before the seller acquired the land (e.g. 2023-01-01 for Karim on LP-10234). A future date is refused at save (422 DATE_IN_FUTURE) | IMPOSSIBLE_DATE (HIGH) |
| Resale of same parcel within a very short time of previous deed | RAPID_RESALE |

**3h. Negative uploads**: upload every file in `B-invalid-files-negative-tests` → each rejected with a clear message or fails gracefully (see the README in that folder). The app must stay usable after each one.

**3i. e-Mutation** (`/en/officer/mutations`)
- Open Doc2's mutation: pre-checks fail → HEARING path.
- Try transitions as officer: APPLIED → UNDER_REVIEW → APPROVED; try REJECTED/HEARING without a reason (blocked), then with a reason.
- Try an illegal transition (e.g. from APPROVED back to APPLIED) → refused.
- Log in as reviewer: queue visible, no transition buttons.
- Take a mutation number to `/en/track` and watch the stage update.

### Round 4 — Admin & integrity (login as admin)
1. `/en/officer/admin` → Users: search "demo", filter by role, sort.
2. Create `tester1@demo.landshield.test`, role REVIEWER, password `Tester#2026` → appears; log in as that user in another window.
3. Edit the new user → deactivate → login must now fail.
4. Try deactivating yourself / changing own role → blocked.
5. Land records and Documents panels: no owner names, no file paths.
6. Ledger integrity → Verify → **INTACT**.
7. Tamper demo (terminal, project root, venv active):
```
python scripts/tamper_demo.py --land LP-10100
```
   Verify again → **BROKEN at seq N**; LP-10100 now HIGH with RECORD_INTEGRITY_FAILED.
```
python scripts/tamper_demo.py --restore
```
   Verify → INTACT; LP-10100 back to LOW 0.
8. `/en/officer/audit-logs` → every admin action present.

### Round 5 — Security & access control
**RBAC matrix**: log in as each role and visit each URL in checklist §5; note the behaviour. Paste an officer URL while logged out → redirect/blocked.

**API checks** (terminal, needs `jq`; replace tokens):
```
API=http://127.0.0.1:8001/api/v1
CT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"citizen@demo.landshield.test","password":"LandShield2026!"}' | jq -r .access_token)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CT" $API/admin/users        # expect 403
curl -s -o /dev/null -w "%{http_code}\n" $API/lands/LP-10240/risk                                # expect 401
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer garbage" $API/auth/me          # expect 401
curl -s $API/public/verify/LP-10240 | jq                                                          # counts only, no names
```
**Rate limits**: 11 wrong logins within a minute → 429. Spam `/public/verify/LP-10240` 61+ times/min → 429.
**Injection/XSS**: enter `<img src=x onerror=alert(1)>` in Check-Before-You-Buy seller, search fields, and the reject-reason box → shown as plain text, no popup.
**Uploads**: filename `../../evil.png` must not escape storage; log in as a different user and request another user's document file → denied.
**Headers**: DevTools → Network → document → response headers include CSP, X-Frame-Options, X-Content-Type-Options.

### Round 6 — Language, theme, responsive, accessibility
- **BN pass**: repeat a short walk (landing, verify, result, check, report, public QR page, track, tools, login, officer dashboard) in `/bn`. Look for English leftovers, raw keys (`something.title`), broken Bangla shaping, wrong numerals.
- **Theme**: Light/Dark/System; reload; check the print preview stays light.
- **Responsive** (DevTools device toolbar or real phone): 375×812, 768×1024, 1440×900. No horizontal scroll; tables scroll inside their own box; menu works.
- **Keyboard**: Tab through landing, login, verify, upload; focus ring visible; Esc closes menu/modals.
- **Screen reader**: VoiceOver (Cmd+F5) quick pass on login and result pages.
- **Offline**: turn off Wi-Fi after load → core pages and the demo flow still work (map tiles may be blank).

### Round 7 — Automated suites
```
cd backend && source .venv/bin/activate && pytest -q && ruff check .
cd ../frontend && npx vitest run && npx tsc --noEmit && npm run check:i18n
npm run e2e:install && npm run e2e        # Playwright; never executed before — expect to fix selectors
```
Known from `docs/acceptance.md`: Playwright specs, real-browser walk, `next build`, Bangla PDF export and print preview were **never run** — treat these as highest risk.

---
## 6. Edge cases worth trying
- Upload the same document twice; approve twice (second must be blocked)
- Reload mid-processing; open review for a document still processing
- Very long text in every input; Bangla text in English fields; leading/trailing spaces; emojis
- Browser Back/Forward after login/logout
- Session expiry: wait > 15 min (access token) and keep using the page → silent refresh or clean re-login
- Stop the backend while a page is open → friendly error state, then recovery on restart
- Same parcel opened in two tabs, one approving while the other reviews
- Date/number formats in BN (Bangla digits) on report and result

## 7. Known limitations (not bugs)
- All data/areas/polygons are synthetic; no real government link
- The bundled sample files return their stored result (labelled "Demo sample"); any other image or scanned PDF goes through real Tesseract OCR + rules (`OCR_PROVIDER=auto`, see `docs/ocr-setup.md`). Without Tesseract installed the job fails with OCR_UNAVAILABLE. Claude extraction is off unless ANTHROPIC_API_KEY is set
- A khatian / porcha is approved into the archive only; it does not change ownership, ledger or mutations
- Mouza maps have no data yet (database/gis/mouzas.json is empty) and only 7 of the 12 seeded parcels have a polygon
- Fee/inheritance tools use illustrative rates
- Mouza GIS is limited to the demo division
- Postgres, Docker, Paddle/VLM OCR are not built
- Next 14.2.15 has an upstream security advisory — upgrade before real deployment

## 8. Exit criteria
- 0 Blocker and 0 Major failures open
- Checklist §1–§27 ≥ 95 % ticked; every failed item has a bug entry
- Doc1 → LOW 0 and Doc2 → HIGH 70 reproduced twice from a clean reset
- Both languages walked once; public QR page leak-free
- Tamper demo BROKEN → INTACT cycle works
