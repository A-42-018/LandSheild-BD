# Historical Land Deed Digitisation — Roadmap (H0–H10)

Status: **H0 done (2026-10-18), H1–H10 not started** (updated 2026-10-18; all decisions D1–D6 made, see §5).
Trigger: mentor feedback:
1. LandShield cannot digitise a historical (pre-1971 / pre-1947) land deed. There is no digital
   format for one, and the extractor read only 1 of 13 fields from the sample
   `landshield-sample-documents/New Documents/Historical Land Deed.pdf`.
2. An officer cannot see the documents they uploaded or the digitised version of a land, and
   cannot download the digital version. The system must **keep both the uploaded historical deed
   and its digitised version**.

---

## 1. What went wrong with the sample deed (diagnosis)

I ran the current pipeline on the sample PDF locally. Nothing was changed.

| # | Cause | Evidence | Where in code |
|---|-------|----------|---------------|
| 1 | **The PDF's text layer is used even though its Bangla is corrupt.** The file was printed from Chrome, and its text layer loses the conjuncts. The router still trusts it at 0.99 confidence. | `বিক্রেতা` comes out as `বিেতা`, `সম্পত্তির` as `সম্পির`, `পশ্চিমে` as `পিমে`, `টিপসই` as `িপসই`, `ধর্ম` as `ধম`. Every Bangla label regex fails. | `ai/ocr/router.py` (step 2: "≥ 50 chars → pdf-text") |
| 2 | **The layout detector does not recognise old deed wording.** `saf_kabala.looks_like()` needs `ক্রয়কারী` + `বিক্রয়কারী` + `তফসিল`. Historical deeds say `দাতা / গ্রহীতা`, `বিক্রেতা / ক্রেতা` and spell it `তপশিল`. | `looks_like = False` on both the PDF text and the Tesseract text | `ai/extraction/saf_kabala.py` |
| 3 | **The fallback rules expect `Label: value`.** Old deeds use `পিতা- মৃত X`, `সাং-`, `থানা-` (a dash, no `নাম:`) and run them together in one prose paragraph. | Generic rules found only `দলিল নং: ৪৭৮২/খ`. With Tesseract they even read the footer `ভবানীপুর মৌজা পৃষ্ঠা ১` as mouza = `পৃষ্ঠা ১` (wrong). | `ai/extraction/rules.py`, `patterns.py` |
| 4 | **Tesseract drops the schedule table.** The table text is cleaner than the PDF layer, but the bordered table (জেলা/থানা/মৌজা/খতিয়ান/দাগ) comes out as noise (`[লা [aeees [we`). | Tesseract run, psm 6 | `ai/ocr/tesseract.py` (no table/cell handling) |
| 5 | **The date cannot be stored.** `১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ` is a Bangla-calendar date. The validators accept only Gregorian `YYYY-MM-DD` / `DD/MM/YYYY`, so even a correct read would be dropped. | `_iso_date`, `validate._format`, `services/extraction._parse_date` | rules + validate + backend |
| 6 | **The data model is too small.** There are only 13 single-valued fields. Mother's name, address, religion, profession, consideration money, CS survey type, land class (`শালী`), boundaries (চৌহদ্দি), stamp, witnesses and the deed writer have nowhere to go. The Claude extractor uses the same 13-field tool schema, so it could not return them either. | `EXTRACTION_FIELDS`, Claude `TOOL` | `ai/extraction/base.py`, `claude.py`, `schemas/extraction.py` |
| 7 | **The LLM path was not used.** The screenshot shows "পড়ার পদ্ধতি: নিয়মভিত্তিক" (rules), so either the deployed backend has no `ANTHROPIC_API_KEY` or Claude fell back. | Engine badge in the screenshot | Render env / `providers.py` |

### 1b. Seeing, keeping and downloading documents today (checked in the code)

| Gap | What the code has now |
|---|---|
| **No "my uploaded documents" list** | There is no `GET /documents` list endpoint. An officer reaches a document only via the review queue (`/officer/queue`). The queue is filtered by office scope and status, not "uploaded by me", and it is built for pending work, not as a library. |
| **No view of a land's digitised version** | The only document screen is `/officer/review/[id]`. Archive search (`/officer/archive`) finds **approved** documents by text, but there is no browse view and no "digital deed" page. |
| **No download of the digital version** | `GET /documents/{id}/file` serves the original file, but only to draw the inline preview. There is no download button, no PDF/JSON export of the extracted record, and no bundle. |
| **Nothing is truly kept in production** | `render.yaml`: SQLite and `./storage` sit on Render's free disk, which **is wiped on every redeploy/restart**. The demo is re-seeded each time. Uploaded deeds and their digitised records are lost today. |
| **No versioned digital record** | `extraction_json` is overwritten by edits (only one `original_fields` snapshot is kept). After approval there is no frozen, hashed, signed copy of the digital deed, although Ed25519 signing already exists for `deeds.record_hash`/`signature`. |

**Bottom line:** this is not one bug. Fixing the OCR alone would still leave nowhere to store the data,
and a new format alone would still be filled from corrupt text. The plan therefore covers
**format → input quality → detection → extraction → storage & keeping → review UI → document
library → download → approval → evaluation**.

---

## 2. Target: the "LandShield Historical Deed Record" (LHDR v1)

One structured, versioned JSON document per deed (`"schema": "lhdr/1"`). It covers every part of a
Bengal/East-Pakistan/Bangladesh deed. **Every leaf value is a `Field`:**

```jsonc
// Field = how one value is stored
{
  "value": "রূপগঞ্জ",          // normalised value (what the system uses)
  "verbatim": "রূপগঞ্জ",       // exactly as written on the deed (never "corrected")
  "confidence": 0.93,          // 0..1
  "source": { "page": 1, "bbox": [x, y, w, h] },   // click → highlight in preview
  "method": "ocr+rules",       // text-layer | ocr+rules | llm | fused | human
  "legibility": "clear",       // clear | faded | damaged | illegible
  "edited_by_human": false
}
```

### 2.1 Sections

| Section | Contents |
|---|---|
| **A. Document** | deed kind (`সাফ কবলা` sale, `হেবা`/`দানপত্র` gift, `বণ্টননামা` partition, `এওয়াজ` exchange, `রেহেন`/mortgage, `ওয়াকফ`, `আমমোক্তারনামা` POA, `বায়নানামা`, other); language(s)/script; era (British India <1947 · East Bengal/East Pakistan 1947–71 · Bangladesh); page count; physical condition notes |
| **B. Registration** | deed no (verbatim `৪৭৮২/খ` + normalised `4782/খ`); volume/book (`বালাম`/`বহি নং`), pages; sub-registry office; registration year; registrar endorsement |
| **C. Dates** | each date stored as `{verbatim, calendar: bangla\|gregorian\|hijri, day, month, year, gregorian_from, gregorian_to, precision}`. Execution date and registration date are kept separately. |
| **D. Parties** (list) | role (`দাতা`/seller · `গ্রহীতা`/buyer · donor · donee · witness · identifier `সনাক্তকারী` · deed writer `দলিল লেখক`); honorific (`জনাব`, `শ্রী`, `শ্রীমতি`, `বেগম`, `মোসাম্মৎ`); name; father/husband (with "deceased" flag from `মৃত`/`মরহুম`/`স্বর্গীয়`); mother; address (`সাং` village, post, thana, district); profession; religion; nationality; share (`অংশ`) |
| **E. Consideration** | amount (number), amount in words (`এক হাজার পাঁচশত`), currency as written (`টাকা`/`রুপি`) + era currency (INR before 1948, PKR 1948–71, BDT after), payment mode (`এককালীন নগদ`) |
| **F. Schedule (`তপশিল`)** (list of plots) | district, thana/upazila, pargana, mouza, JL no, survey (CS/SA/RS/BS/Diara), khatian no, dag no(s), area `{value, unit, in_words}` + modern conversion to decimal (শতক), land class (`শালী`/`নাল`, `ভিটা`, `বাড়ি`, `পুকুর`, `ডাঙ্গা`, `চালা`…), boundaries `{north, south, east, west}` |
| **G. Title recital** | how the seller got the land (`স্বত্ব দখলীয়`, earlier deed no, inheritance, khatian record); transfer nature (`চিরস্থায়ী`); stated freedom from encumbrance (`নিষ্কণ্টক`) |
| **H. Execution & attestation** | seller signature type (signature / thumb-print `টিপসই`); witnesses (list of parties); deed writer (name, licence no); stamps `{type: revenue\|non-judicial\|court-fee, value}`; seals |
| **I. Modern mapping** (computed, not read) | historical place → today's division/district/upazila. The sample's `থানা রূপগঞ্জ, জেলা ঢাকা` (1944) is now Rupganj, **Narayanganj** district. Area also gets a decimal equivalent. Both the "as written" and "modern" values are kept. |
| **J. Core 13** (derived) | `seller`, `buyer`, `owner_name`, `father_name`, `khatian_no`, `dag_no`, `mouza`, `district`, `upazila`, `land_area`, `area_unit`, `deed_no`, `deed_date`, filled from the sections above. Approval, posting, risk and search keep working unchanged. |

### 2.2 Expected LHDR output for the sample deed (gold file for tests)

```jsonc
{
  "schema": "lhdr/1",
  "document": { "kind": "SALE_SAF_KABALA", "era": "BRITISH_INDIA", "languages": ["bn", "en"], "pages": 1 },
  "registration": { "deed_no": "4782/খ", "deed_no_verbatim": "৪৭৮২/খ", "office": null },
  "dates": {
    "execution": { "verbatim": "১৫ই ফাল্গুন, ১৩৫০ বঙ্গাব্দ", "calendar": "bangla",
                   "day": 15, "month": "ফাল্গুন", "year": 1350,
                   "gregorian_from": "1944-02-26", "gregorian_to": "1944-02-28", "precision": "day±1" }
  },
  "parties": [
    { "role": "SELLER", "honorific": "জনাব", "name": "কফিল উদ্দিন",
      "father": { "name": "সমসের আলী", "deceased": true }, "mother": "জমিলা খাতুন",
      "address": { "village": "ভবানীপুর", "thana": "রূপগঞ্জ", "district": "ঢাকা" },
      "profession": "কৃষি", "religion": "ইসলাম", "nationality": "জন্মসূত্রে বাঙ্গালী" },
    { "role": "BUYER", "honorific": "শ্রী", "name": "রামকান্ত দাশ",
      "father": { "name": "হরিকান্ত দাশ", "deceased": true }, "mother": "শ্রীমতি সুবালা দাশ",
      "address": { "village": "ভবানীপুর", "thana": "রূপগঞ্জ", "district": "ঢাকা" },
      "profession": "ব্যবসা", "religion": "হিন্দু", "nationality": "জন্মসূত্রে বাঙ্গালী" }
  ],
  "consideration": { "amount": 1500, "in_words": "এক হাজার পাঁচশত", "currency_written": "টাকা",
                     "era_currency": "INR", "mode": "এককালীন নগদ" },
  "schedule": [
    { "district": "ঢাকা", "thana": "রূপগঞ্জ", "mouza": "ভবানীপুর",
      "survey": "CS", "khatian_no": "120", "dag_no": ["455"],
      "area": { "value": 0.50, "unit": "acre", "in_words": "অর্ধ একর", "decimal_equiv": 50 },
      "land_class": "শালী",
      "boundaries": { "north": "আব্দুল করিমের জমি", "south": "সরকারি রাস্তা",
                      "east": "খাল", "west": "রহিম সেখের জমি" } }
  ],
  "title_recital": { "basis": "স্বত্ব দখলীয়", "nature": "চিরস্থায়ী", "encumbrance_free": true },
  "execution": { "seller_mark": "টিপসই / স্বাক্ষর", "witnesses": [], "deed_writer": null,
                 "stamps": [{ "type": "REVENUE", "value": "১ টাকা" }] },
  "modern_mapping": { "district": "Narayanganj", "upazila": "Rupganj" }
}
```
(Each value above is really a `Field` object; it is flattened here for readability. Values the deed does not show stay `null`. Nothing is guessed.)

Target for this one deed: **≥ 30 values read correctly**, up from 1 today.

---

## 3. Phases

Each phase can be merged on its own. Branch per phase: `h<N>-<slug>`, worktree `LandSheild-BD-h<N>`, following the existing U-branch convention.

### H0 — Ground truth & measurement (do first)
- Add `database/sample_data/historical/`: the sample PDF, a PNG render, a "scanned" variant (noise, skew, yellow paper, faded ink, red stamp), and **4–6 more synthetic historical deeds** (a gift deed, an East-Pakistan-era deed with `রুপি`, a multi-plot schedule, a deed with archaic units `কানি/গণ্ডা/কড়া`, a 2-page deed). Use `ai/evaluation/make_synthetic.py` as the base. Generate **new files only** and never regenerate the committed samples, because their hashes are fixture keys.
- Add gold LHDR JSON per file (like §2.2).
- Extend `ai/evaluation/run_eval.py` to score field accuracy per section and per document. Record the **baseline** (sample deed today: 1/13 core fields).
- **Done when:** `run_eval --set historical` prints a baseline table.
- **Done (2026-10-18).** `ai/evaluation/make_historical.py` (specs → page + gold), `ai/evaluation/historical.py` (scorer), `run_eval.py --set historical`, files and gold in `database/sample_data/historical/` (manifest lists 12 files: the 2 real PDFs, a PNG render and 3 scans, 5 synthetic deeds). Baseline: sample deed **1/13** core fields, set overall 7.1 % core (0 % scanned), 2.1 % of all gold values; table in `docs/ai-pipeline.md`. The second real PDF (`Historical_Land_Deed_Sample.pdf`, 2 pages) is in the set too. Gold keeps plain values, not `Field` objects (H1 defines those); a `core` block holds the expected 13 for H1's `derive.py`.

### H1 — The LHDR format (schema + validation)
- `ai/extraction/lhdr.py`: dataclasses / Pydantic models for §2, plus a JSON Schema export (`docs/lhdr-v1.schema.json`).
- `ai/extraction/derive.py`: LHDR → the 13 core fields.
- Validation rules for historical deeds:
  - **required:** deed no OR registration ref; execution date verbatim; ≥ 1 seller; ≥ 1 buyer; ≥ 1 schedule row with mouza + (khatian or dag) + area
  - **format:** area > 0; known or archaic unit; Gregorian range not in the future; numbers only in numeric fields
- **Done when:** the gold JSON validates and the derived core fields equal the expected 13.

### H2 — Input quality: stop trusting a broken text layer; read tables
- **Text-layer quality gate** (`ai/ocr/quality.py`). Score Bangla text for orphan vowel signs (`ি`/`ে` at word start, `েত`), a dictionary hit rate for known labels (`বিক্রেতা`, `সম্পত্তি`, `পশ্চিম`, `ধর্ম`), and the share of replacement characters. Below a threshold, OCR the rendered page instead. When both exist, keep the better score. Router order becomes: demo → **checked** text layer → Tesseract.
- **Table reading**: find the table grid with OpenCV line detection, OCR each cell (psm 6/7), and keep `(row, col)` so header → value mapping is exact. This fixes the lost schedule table.
- **Historical-scan preprocessing** (opt-in by profile): 300 dpi render; remove the yellow/brown background; separate red stamps by colour; suppress the faint diagonal watermark; deskew; phone-photo perspective correction for JPG/PNG.
- **Done when:** on the sample PDF, the chosen OCR text contains `বিক্রেতা`, `তপশিল`, `১২০` and `৪৫৫`, and the table cells come back as a grid.

### H3 — Detecting a historical deed
- `ai/extraction/classify.py` returns `deed_profile: modern | historical`, `deed_kind`, `era`, and a score.
- Signals: `বঙ্গাব্দ`/`সন` dates, `সাং-`, `জনাব/শ্রী/শ্রীমতি`, `দাতা/গ্রহীতা`, `কস্য`, `মিদং`, `তপশিল`, `পরগণা`, CS khatian, `রুপি`, a pre-1971 year, archaic units.
- **D1 = "just DEED":** `document_type` stays `DEED` and the upload form is unchanged. The profile is detected automatically and stored in `extraction_json` (no enum migration). If detection is wrong, the reviewer can switch "modern ↔ historical" on the review screen, which re-runs extraction with the other profile.
- **Done when:** all H0 historical files are detected as historical and all existing modern samples still are not.

### H4 — Extraction engine (hybrid: rules + vision LLM + fusion)
1. **Rule parser** `ai/extraction/historical_deed.py`:
   - section splitter: `১ম পক্ষ (দাতা/বিক্রেতা)`, `২য় পক্ষ (গ্রহীতা/ক্রেতা)`, body, `তপশিল`, `চৌহদ্দি`, signature row
   - person parser for `HONORIFIC NAME, পিতা- [মৃত] X, মাতা- Y, সাং- Z, থানা- …, জেলা- …, পেশা- …, ধর্ম- …, জাতীয়তা- …`
   - money parser (`১,৫০০/- (এক হাজার পাঁচশত) টাকা`); Bangla-number-words parser
   - Bangla-calendar date parser + converter (`১৫ই ফাল্গুন ১৩৫০`). Before the 1987 reform the month lengths varied, so the converter returns a range.
   - area parser: numbers, words (`অর্ধ একর`), archaic units with a conversion table
   - boundary parser for `উত্তরে- … দক্ষিণে- … পূর্বে- … পশ্চিমে- …`
   - schedule parser over the H2 cell grid
2. **Vision LLM extractor**: a new `submit_lhdr` tool with the full §2 schema. Send all pages (not just page 1) plus OCR text. The prompt gets a glossary of archaic terms and the rules "verbatim + normalised, null if unsure, mark illegible". Reuse the existing Claude provider plumbing (cache, daily cap, fallback). Raise `max_tokens` for the larger output.
3. **Grounding & fusion** `ai/extraction/fuse.py`: every LLM value is cross-checked against the OCR text (extend `validate.py`). Where rules and LLM agree, confidence goes up. Where they disagree, the reviewer sees both as candidates. Where the LLM value is not found in the text, confidence is cut and the value is flagged. Nothing is auto-trusted.
4. **Normaliser / gazetteer**: historical thana/district → modern upazila/district (reuse `land_offices.json` / map data), plus Bangla digits and units.
- **Done when:** the sample deed gives ≥ 30 correct values with rules only (no API key), and the full set with the LLM on. Eval targets: **≥ 90 % field accuracy on typed samples, ≥ 75 % on scanned variants.**

### H5 — Storage, API & permanent keeping
- `extraction_json` gets `profile`, `record` (LHDR) and `schema`. The 13 `fields` are derived from it, so old rows and modern deeds are unaffected.
- `PATCH /documents/{id}/extraction` accepts `{path: "/schedule/0/boundaries/north", value}` (JSON-pointer style) for LHDR edits, plus add/remove for list items (parties, plots, witnesses). Every edit is audited, as today.
- **Keep the original deed forever:** the uploaded file is never deleted or overwritten. Its SHA-256 (`file_hash`, already stored) is shown on every view and printed on every download, so a copy can be checked against it.
- **Keep every digital version:** a new table `document_records` (Alembic migration) with `id, document_id, version, status (MACHINE | DRAFT | APPROVED | SUPERSEDED), schema, record_json, created_by, created_at, record_hash, signature`.
  - v1 = machine output; reviewer edits update a DRAFT row.
  - **Approval freezes** the record: APPROVED, SHA-256 hashed, Ed25519-signed with the existing `signing.py` key.
  - A later correction never overwrites. It creates v(n+1) (DRAFT → APPROVED) and marks the old one SUPERSEDED, so the full history stays readable.
- `deeds.is_historical` + `deeds.record_id` link the posted deed to its approved digital record.
- **Production persistence:** today Render's free disk loses everything on redeploy (§1b). The code gets a storage backend for S3-compatible object storage next to `LocalStorage`, and `DATABASE_URL` points to a managed Postgres. Which provider is used is decision **D6** (open).
- **Done when:** the API tests cover profile detection, nested PATCH, version creation, approval freezing + signature check, and that the original file is still readable after approval and re-correction.

### H6 — Reviewer UI: the "digital deed" form
- When `profile = historical`, `ExtractionPanel` renders a **sectioned form shaped like the paper deed** instead of 13 flat rows: Registration · Dates · Party cards (add/remove) · Consideration · Schedule table (add/remove plots) · Boundaries (N/S/E/W compass) · Title recital · Witnesses & stamps.
- Each value shows verbatim vs normalised, a confidence badge, a "both readings" picker when rules and LLM disagree, and **click → highlight the bbox in `DocumentPreview`**.
- A "modern ↔ historical" switch (D1: the reviewer, not the uploader, corrects a wrong detection).
- Bangla/English labels in `messages/*.json`; keyboard shortcuts (A/R/N) and a11y kept.
- **Done when:** a reviewer can fully correct and approve the sample deed without touching flat fields, and vitest + one Playwright e2e cover it.

### H7 — Document library: see uploaded deeds and their digital versions (new)
**Backend**
- `GET /documents`: a paginated list scoped like the queue (`doc_scope`: own office and the offices below it).
  - Filters: `mine=true` (uploaded by me), status, type, profile (modern/historical), office/upazila/district, date range.
  - Search text: deed no, mouza, party name, land id.
  - Sort: newest, status, deed date.
- `GET /documents/{id}/records`: the version list. `GET /documents/{id}/records/{version}`: one version.
- `GET /lands/{land_id}/documents`: every document of a land, each with its latest approved digital record.

**Frontend** (officer area, under the existing `OfficerShell`)
- New menu item **"আমার নথি / My documents"** (`/officer/documents`), a table with:
  - thumbnail, deed no, mouza, type, a "historical" tag, status, uploaded on, digitised yes/no
  - tabs: **My uploads** · **My office** · **Needs my action**
- New **document page** (`/officer/documents/[id]`):
  - **left:** the original uploaded file (the existing `DocumentPreview`)
  - **right:** the digital deed (the H6 read-only view) with a version picker (v1 machine → v2 reviewed → v3 approved…), who changed what and when (from the audit log), and the file hash plus "signature valid ✓"
  - while the document is still being reviewed, the page links to `/officer/review/[id]`
- Land page: a **"Documents" tab** listing every deed of the land in date order (the 1944 historical deed → later deeds), each opening the document page. This is where "see the digitised version of the land" lives.
- Officer home: a "Recently uploaded by me" card (last 5) linking to the library.

**Access rules:** uploaders always see their own uploads. Office officers see their office scope, as the queue does today. Admins see all. Reviewers see what they can review. Citizens get nothing new here (citizen access to their own deed is the optional extension in H8).

- **Done when:** an officer uploads the sample deed and finds it under My uploads with status and digitised tag. After approval they open the document page and see the original and digital version side by side, with version history. API tests cover the scoping and vitest + e2e cover the flow.

### H8 — Download the digital deed (new)
- One **Download** menu on the document page and on each library row:
  1. **Digital deed (PDF)**: the deed laid out section by section in Bangla (English labels optional).
     - Footer: deed no, version, approval date, approving officer, SHA-256 of the record and of the original file, and the Ed25519 signature.
     - A **QR code to the public verify page** (`/v/...`, the existing QR + verify routes), so anyone can confirm a printed copy has not been altered.
     - Marked "DRAFT – NOT APPROVED" when downloaded before approval.
  2. **Digital deed (JSON)**: the LHDR record, schema `lhdr/1`, for machine use and long-term archiving.
  3. **Original upload**: the exact file as uploaded, with its stored hash.
  4. **Complete bundle (ZIP)**: original file + PDF + JSON + `manifest.json` (hashes, signature, version history).
- **PDF engine:** server-side, so the file is identical for everyone and can be signed. It must shape Bangla correctly *and* keep a correct text layer, which is the exact bug that broke the sample deed (§1 row 1). Candidate: WeasyPrint (HarfBuzz) + Noto Sans Bengali, to be confirmed in a spike.
  - **Round-trip test:** download our own PDF, feed it back through the H2 pipeline, and require ≥ 99 % of the fields to come back unchanged.
- Endpoints: `GET /documents/{id}/download?what=pdf|json|original|bundle&version=n`. Each download is written to the audit log (who, what, when). Rate-limited like uploads.
- **Optional extension (not v1):** a citizen whose NID is linked to the land (`My Lands`) can download the approved digital deed PDF of their own land.
- **Done when:** all four downloads work for the approved sample deed, the PDF opens with correct Bangla, the QR verify page confirms the signature, and editing one byte of the JSON makes verification fail (test).

### H9 — Approval, chain of title, risk, search
- **D2:** approving a historical deed records a **past link in the chain of title** (ownership history with date ranges). It does **not** replace the current owner, which still changes only through mutation/khatian.
- Risk rules: chain gap between a historical deed and the CS/SA khatian owner; seller name ≠ khatian owner (fuzzy, via `names.py`); dag/khatian conflicts with later deeds; consideration sanity per era.
- Archive search (`features/archive`) indexes LHDR fields (party names, mouza, CS khatian, dag, year range), and each hit opens the H7 document page.
- **Done when:** approving the sample creates a 1944 chain-of-title entry visible on the land's history page and its Documents tab.

### H10 — Hardening, production & docs
- Run the eval on all historical samples and record before/after in `docs/ocr-accuracy.md`.
- `docs/historical-deeds.md`: format reference, glossary, reviewer guide, download/verify guide.
- Production:
  - create the Postgres + object-storage accounts (D6, §5b), set the env vars on Render, and run the restart test (redeploy, then the uploaded deed and its digital record are still there)
  - set `ANTHROPIC_API_KEY` and the daily cap on Render
  - check the text-layer gate there
- Demo script update: upload the historical deed → digital deed → approve → find it in My documents → download PDF → scan QR.

---

## 4. Order & rough size

| Phase | Depends on | Size |
|---|---|---|
| H0 eval set + baseline | — | S |
| H1 LHDR schema | H0 | M |
| H2 text-layer gate + tables + preprocessing | H0 | M–L |
| H3 classifier + reviewer switch | H1 | S |
| H4 rules + LLM + fusion | H1, H2, H3 | L |
| H5 storage / API / versions / S3 + Postgres support | H1 | M–L |
| H6 reviewer UI + digital deed view | H5 | L |
| **H7 document library (my uploads, document page, land Documents tab)** | H5 (list works for modern deeds too); H6 for the digital view | M |
| **H8 downloads (PDF / JSON / original / bundle, QR verify)** | H5, H6 | M |
| H9 approval / chain of title / risk / search | H5, H6 | M |
| H10 eval report, production, docs | all | S–M |

H1 and H2 can run in parallel. H5 can start as soon as H1 lands. The **H7 list + original-file
download** can ship early, before the historical work, because it is useful for every document.

**Suggested delivery in three milestones:**
1. **M1 "Read it"** (H0 → H1 → H2 gate → H4 rule parser): the sample deed goes from 1 field to about 30. The derived 13 fields already fill today's panel.
2. **M2 "Keep it and find it"** (H5 → H7 → D6 persistence): officers see their uploads and each land's documents, and nothing is lost on redeploy.
3. **M3 "Digital deed"** (H6 → H8 → H9 → H10): full digital deed form, signed PDF/JSON download with QR verify, chain of title.

---

## 5. Decisions

| # | Question | Decision (2026-10-18) |
|---|---|---|
| D1 | New `document_type = HISTORICAL_DEED`, or keep `DEED`? | **Just `DEED`.** No new type and no new upload option. Historical is an auto-detected profile inside the extraction, and the reviewer can switch it. |
| D2 | Does approving a historical deed change the **current** owner? | **No.** It is recorded as a chain-of-title link; current ownership changes only through mutation/khatian. |
| D3 | Is the LLM (Claude vision) allowed for production extraction? | **Yes, as a hybrid.** Claude is one input fused with the rule parser and always checked against the OCR text. Reviewer approval is still required, and the rules-only path must work without an API key. |
| D4 | Which deeds are in scope for v1? | **Printed/typed** sale (সাফ কবলা), gift (হেবা/দানপত্র) and partition (বণ্টননামা) deeds, from the British-India era to today. Handwritten deeds come later (best effort through Claude only). |
| D5 | Where do the extra test deeds come from? | **Generated synthetic deeds with fictional people**, like the existing samples. Real scanned deeds only with the owner's written consent. |
| D6 | Where do uploaded deeds and digital records live in production? (Render's free disk is wiped on every redeploy) | **Option (b): free managed Postgres (Neon or Supabase) + free S3-compatible object storage (Cloudflare R2 or Supabase Storage).** The backend stays on Render; only the database and files move out. Details in §5b. |

### 5b. D6 in practice (part of H5 code + H10 setup)

- **Provider pick:** made at H10 setup time; the code works with any of them.
  - **Simplest:** Supabase for both (one account; Postgres + Storage through its S3-compatible API).
  - **Alternative:** Neon (Postgres) + Cloudflare R2 (files).
  - Check each free tier's limits when signing up (inactive Supabase projects pause; Neon compute sleeps and has a cold start). Both are fine for a demo but should be woken before a presentation.
- **Files (code, H5):** add `S3Storage` next to `LocalStorage` in `backend/app/services/storage.py`, using the same `save/read/exists/delete` interface. It is picked by env: `STORAGE_BACKEND=local|s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`.
  - The bucket is **private**. Files are served only through the backend's access-checked routes (preview, H8 downloads), never via public bucket URLs.
  - Object keys are `documents/<sha256>.<ext>`. The upload code already dedupes on `file_hash`.
  - Local development and tests keep `LocalStorage`, so nothing changes for them.
- **Database (code, H5):** `DATABASE_URL=postgresql+psycopg://…` (add the `psycopg` driver).
  - Alembic migrations, including the new `document_records` table, must run on Postgres. Add a CI job that runs migrations + the backend tests against a Postgres container, next to the existing SQLite runs.
  - Archive search uses SQLite FTS5 and falls back to a slow `LIKE` scan elsewhere. Add a Postgres full-text path (`tsvector` + GIN index) so search stays fast.
- **Seeding:** today Render re-seeds the demo on every start because the disk is wiped. With a persistent DB, `start.sh` must seed **only when the DB is empty** (or behind a flag). Otherwise each restart would duplicate or reset real uploads.
- **Secrets:** the DB URL and storage keys go in Render's environment (`sync: false` in `render.yaml`), set by you in the dashboard, never committed.
- **Backups:** a weekly `pg_dump` + bucket listing export (manual or GitHub Action), described in `docs/deploy-render.md`, because free tiers have little or no point-in-time restore.
- **Acceptance (H10):** upload the sample deed on the deployed site, approve it, redeploy the backend, and confirm that:
  - the document is still in My documents
  - the original still downloads with the same SHA-256
  - the approved digital record's signature still verifies

---

## 6. Risks
- **Bangla-calendar conversion before 1987 is approximate.** Always keep the verbatim text and a date range, never a single invented date.
- **Old place names and boundaries changed** (Dhaka → Narayanganj). Keep both the written and the modern value, and flag low-confidence mappings.
- **The LLM may hallucinate.** Grounding against OCR text, reviewer approval always required (already the R4 rule), and confidence penalties.
- **Fixture hashes:** never regenerate committed samples (see `ai/mock_fixtures.json` `by_hash`).
- **Cost/latency:** the larger LLM schema and multi-page input mean more tokens. The cache per file hash and the daily cap already exist.
- **Data loss in production:** until D6 is done, every upload and digital record on Render disappears on redeploy. The H7/H8 features would look broken in a demo after a restart.
- **Downloaded PDFs must not repeat the broken-Bangla-text bug:** the H8 round-trip test guards this.
- **Privacy of downloads:** deeds hold names, parents and addresses. Downloads are scoped like viewing, audit-logged and rate-limited, and NIDs are never printed (only the last 4 digits, as today).

---

## 7. Which Claude model for what

**Building each phase (Claude Code sessions).** Opus 5.5 is the default; Sonnet 5.5 is enough where the work follows existing patterns.

| Phase | Model | Why |
|---|---|---|
| H0 test set + gold JSON | Sonnet 5.5 | Mostly mechanical; you check the Bangla gold values by hand |
| H1 LHDR schema | **Opus 5.5** | Every later phase depends on this design |
| H2 text-layer gate, table OCR | **Opus 5.5** | Tricky Unicode/OpenCV heuristics |
| H3 classifier | Sonnet 5.5 | Small keyword scorer |
| H4 rule parser, LLM, fusion, calendar | **Opus 5.5** (high effort) | Hardest part: Bangla regex, calendar conversion, grounding |
| H5 storage, versions, S3/Postgres, signing | **Opus 5.5** | Data integrity and migrations |
| H6 reviewer form UI | Sonnet 5.5 | Standard React forms on existing components |
| H7 document library | Sonnet 5.5 | List/detail pages like the existing queue |
| H8 downloads | Opus 5.5 for the PDF engine spike and Bangla round-trip; Sonnet 5.5 for the rest | |
| H9 chain of title, risk | **Opus 5.5** | Ownership/business rules |
| H10 docs, deploy, demo script | Sonnet 5.5 | |

**Inside the app at runtime (the H4 extractor).**
- **Primary: `claude-sonnet-5-5`** (already configured). It has vision and reads Bangla well, at $2 in / $10 out per million tokens, which is a few US cents per deed page. The per-file-hash cache and the daily cap keep the cost bounded.
- **Escalation: `claude-opus-5-5`** ($4 / $20). Use it only for a re-read when rules and Sonnet disagree on key fields or confidence is low, and later for handwritten deeds.
- **Not needed:** Fable 5.1 (most capable, but $10 / $50; overkill for extraction). Haiku 5.5 ($0.10 / $0.50) could pre-classify pages, but the H3 rules already do that.

**API fix required before any of this works (add to H4).** `ai/extraction/claude.py` sends `tool_choice={"type": "tool", …}` and `temperature: 0`.
- On Sonnet 5.5 and Opus 5.5, forced `tool_choice` and non-default `temperature` both return **HTTP 400**, so every call falls back to the rules.
- Local evidence: `backend/storage/claude_cache` has a usage counter from 2026-10-13 but no cached result, so calls were made and none succeeded. This matches §1 row 7.
- The fix:
  - use `tool_choice: auto` with `strict: true` on the tool (or structured outputs)
  - drop `temperature`
  - set `output_config.effort` explicitly
  - stream larger outputs
  - handle the `refusal` stop reason with the server-side `fallbacks: "default"`
