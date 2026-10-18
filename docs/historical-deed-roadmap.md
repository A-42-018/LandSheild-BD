# Historical Land Deed Digitisation — Roadmap (H0–H10)

Status: **H0–H9 done; H10 done on the code and docs side (2026-10-18).** Left for you (they need accounts, the Render dashboard or the API key): the D6 accounts + the Render restart test and the production gate check (`docs/deploy-render.md` §6), and the LLM-on eval (`docs/ocr-accuracy.md`). All decisions D1–D7 are made (§5). H6–H9 were built as 19 one-session sub-phases (§3b).
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
H6–H9 below say **what** each phase delivers. **How** they are built is in §3b: one sub-phase per Claude session, each ending with a project zip.

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
- **Done (2026-10-18).** `ai/extraction/lhdr.py` (Pydantic models A–J, `Field` with plain-value shorthand, `check()` content rules → `Issue(path, code, severity)`, CLI `python -m ai.extraction.lhdr schema|check`), `ai/extraction/derive.py` (`derive_core` / `derive_fields`), `docs/lhdr-v1.schema.json`, `backend/tests/test_lhdr.py`. All 7 gold files validate with no issues, derive the expected 13 and round-trip through `plain()`. Additions beyond §2: party roles for POA / waqf / partition / exchange (`SHARER`, `EXCHANGER`: a partition needs 2 co-sharers instead of seller + buyer), archaic units `kranti, til, chatak, dhur, pakhi`, warnings `ERA_MISMATCH` and `CORE_MISMATCH`. Reference in `docs/ai-pipeline.md`.

### H2 — Input quality: stop trusting a broken text layer; read tables
- **Text-layer quality gate** (`ai/ocr/quality.py`). Score Bangla text for orphan vowel signs (`ি`/`ে` at word start, `েত`), a dictionary hit rate for known labels (`বিক্রেতা`, `সম্পত্তি`, `পশ্চিম`, `ধর্ম`), and the share of replacement characters. Below a threshold, OCR the rendered page instead. When both exist, keep the better score. Router order becomes: demo → **checked** text layer → Tesseract.
- **Table reading**: find the table grid with OpenCV line detection, OCR each cell (psm 6/7), and keep `(row, col)` so header → value mapping is exact. This fixes the lost schedule table.
- **Historical-scan preprocessing** (opt-in by profile): 300 dpi render; remove the yellow/brown background; separate red stamps by colour; suppress the faint diagonal watermark; deskew; phone-photo perspective correction for JPG/PNG.
- **Done when:** on the sample PDF, the chosen OCR text contains `বিক্রেতা`, `তপশিল`, `১২০` and `৪৫৫`, and the table cells come back as a grid.
- **Done (2026-10-18).** `ai/ocr/quality.py` (gate: invalid Bangla marks, conjunct dictionary vs dropped-conjunct skeleton, junk share; all 4 historical PDF layers score 0, all modern fixtures 1), router demo → checked layer → Tesseract with `TEXT_LAYER_REJECTED` / `TEXT_LAYER_SUSPECT`, `ai/ocr/table.py` (grid with colspan/rowspan, `OCRResult.tables`, `header: value` text lines; PyMuPDF tables for good text layers), `ai/preprocessing/historical.py` (`OCR_PROFILE=historical`). Sample PDF: done-criteria test in `backend/tests/test_ocr_table.py`, 4×5 grid exact. Found beyond the plan: Tesseract 5.5 silently drops some clean lines (the religion/nationality lines of both parties), fixed by missed-line recovery with strip re-reads and word-gap splits. Deviations after measuring: PDFs stay at 200 dpi (300 dpi lowered results), no median denoise or upscaling in the historical profile. Gold values found in OCR text: 58.4 % → 72.7 % (modern) → 79.2 % (historical); scans 36.2 % → 75.6 %. Core 13 with the unchanged rule extractor: 7.1 % → 40.9 % (sample deed 1/13 → 7/13). Reference and tables in `docs/ai-pipeline.md`.

### H3 — Detecting a historical deed
- `ai/extraction/classify.py` returns `deed_profile: modern | historical`, `deed_kind`, `era`, and a score.
- Signals: `বঙ্গাব্দ`/`সন` dates, `সাং-`, `জনাব/শ্রী/শ্রীমতি`, `দাতা/গ্রহীতা`, `কস্য`, `মিদং`, `তপশিল`, `পরগণা`, CS khatian, `রুপি`, a pre-1971 year, archaic units.
- **D1 = "just DEED":** `document_type` stays `DEED` and the upload form is unchanged. The profile is detected automatically and stored in `extraction_json` (no enum migration). If detection is wrong, the reviewer can switch "modern ↔ historical" on the review screen, which re-runs extraction with the other profile.
- **Done when:** all H0 historical files are detected as historical and all existing modern samples still are not.
- **Done (2026-10-18).** `ai/extraction/classify.py`: `classify(text, tables)` → `DeedClass(deed_profile, deed_kind, era, score, year, signals)`, weighted cues counted once, historical at ≥ 4 points. The deed year dominates (all dated years ≤ 1971 +4, a year ≥ 1972 alone −6, both −2), because the modern 2001 saf-kabala test text has most of the listed words too (`শ্রী`, `সাং`, `দাতা/গ্রহীতা`, `তফসিল`, `সি.এস`, a Bangla date); `কস্য`/`মিদং`, `রুপি`, `পাকিস্তান`/`ভারতীয়` nationality, `পরগণা` and archaic units with a number are +2, `তপশিল` +1, the common words +0.5, `বাংলাদেশ` / NID / RS-BS against. Years need a date cue (bare dag or deed numbers are not years); Bangla years convert +593/+594. Deed kind = earliest title match. Stored per D1 in `extraction_json` (`deed_profile`, `deed_class`, `ocr_profile`; khatian / porcha not classified) and returned by the extraction API. `OCR_PROFILE=auto` is the new default: modern read → classify → historical re-read when historical (warning `HISTORICAL_PROFILE`). Result: 12/12 H0 files historical on both profiles' readings, kinds equal the manifest, all 11 modern samples, their demo-fixture texts and the test OCR texts modern; `backend/tests/test_classify.py`. Additions: `পাকিস্তান` cue beats a misread pre-1947 year for the era; certified-copy / recital case (`MIXED_YEARS`). Reviewer's switch (2026-10-18, branch `h3b-profile-switch`): the review screen shows the detected profile and re-reads the deed with the other one (`POST /reprocess {"profile": …}` → that Tesseract profile instead of `OCR_PROFILE`, `profile_overridden: true`, `deed_class` keeps the detected verdict; no enum migration). Reference in `docs/ai-pipeline.md`.

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
- **Done, rules side (2026-10-18; LLM-on run pending an API key).** Branch `h4-extraction-engine`. `ai/extraction/historical_deed.py` (rule parser + `HistoricalDeedProvider`), `bangla.py` (number words, Bangla-calendar dates with the pre-1987 ±1-day range and the exact 1987 / 2019 calendars, money, area incl. archaic parts, boundaries), `gazetteer.py` (historical thana/district → modern, from `land_offices.json` + old districts + city thanas), `claude_lhdr.py` (strict `submit_lhdr` tool, answer → LHDR), `fuse.py` (agree / disagree → candidate + `DISAGREE` / LLM-only grounded, `NOT_IN_TEXT`). The job uses it when `deed_profile = historical`; the record is stored in `extraction_json.record` and returned by the extraction API (an early piece of H5; versions and LHDR edits stay H5). §7 API fix applied to both Claude calls (auto tool choice + strict, no temperature, effort, streaming, refusal, `fallbacks: "default"` on the first-party API); default model `claude-sonnet-5-5`. Results with rules only (`run_eval.py --set historical --lhdr --profile auto`): sample deed **77/80** values (13/13 core; was 1/13), all files 84.4 % of all gold values (H0: 2.1 %), typed + render 86.4 %, scanned 77.9 %, core 13 at 89.0 %. Additions beyond the plan: `Field.candidates` / `Field.flags` in the LHDR schema; consensus over repeated place names; figure-vs-words checks. Open: the LLM-on eval (`--lhdr --extractor claude`), which decides the 90 % typed target; table detection on the hd05 scan (no grid found) and the multi-column real sample stay weak.

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
- **Done (2026-10-18).** Branch `h5-storage-records`. The LHDR record is the source of truth: `PATCH /extraction` takes `record` ops (`replace` / `add` / `remove` by JSON pointer, `ai/extraction/lhdr_patch.py`) and writes flat field edits into the record (`derive.core_paths()`), then derives the 13 fields again; `extraction_json` keeps H4's names (`deed_profile`, `record`, `record_schema`). `document_records` (migration 0017) with MACHINE (every job run) → DRAFT (first edit) → APPROVED (frozen: SHA-256 over document id + version + schema + approver + time + record + original file hash, Ed25519 with the deed key) → SUPERSEDED; modern deeds and khatians are versioned too (`core/1`). Corrections after approval: `POST /documents/{id}/records`, `PATCH …/records/{n}`, `POST …/records/{n}/approve` (four-eyes; ownership not re-posted, D2). `GET /documents/{id}/records[/{n}]` with `signature_status` (an early piece of H7). `deeds.is_historical` + `deeds.record_id`. Originals: never overwritten; every read re-hashed (`X-File-SHA256`, `DOCUMENT_FILE_CORRUPT`). D6 code: `S3Storage` (`STORAGE_BACKEND=s3`, boto3), Postgres URLs via psycopg 3, archive search on Postgres (`tsvector` + GIN), `SEED_MODE=auto` (reset only on SQLite), CI workflow running migrations + tests on SQLite and Postgres 16, `docs/deploy-render.md` (setup, backups, acceptance). Found beyond the plan: approval checked a historical deed's *written* district against the office (`ঢাকা` 1944 vs Narayanganj today); the office check now also accepts the record's modern mapping. Approval needs a record without H1 content errors. Running the whole suite on Postgres for the first time found two existing incompatibilities, both fixed: timestamps came back in the server's time zone (connections now use UTC), and a NUL character in input was a 500 (Postgres refuses it in text; now 422 `INVALID_INPUT`). Verified locally on SQLite and on a real Postgres 16 (embedded `pgserver`): migrations up / down / up, seed twice, the whole suite. Not done here: the D6 accounts and the Render restart test (H10).

### H6 — Reviewer UI: the "digital deed" form
- When `profile = historical`, `ExtractionPanel` renders a **sectioned form shaped like the paper deed** instead of 13 flat rows: Registration · Dates · Party cards (add/remove) · Consideration · Schedule table (add/remove plots) · Boundaries (N/S/E/W compass) · Title recital · Witnesses & stamps.
- Each value shows verbatim vs normalised, a confidence badge, a "both readings" picker when rules and LLM disagree, and **click → highlight the bbox in `DocumentPreview`**.
- A "modern ↔ historical" switch (D1: the reviewer, not the uploader, corrects a wrong detection).
- Bangla/English labels in `messages/*.json`; keyboard shortcuts (A/R/N) and a11y kept.
- **Done when:** a reviewer can fully correct and approve the sample deed without touching flat fields, and vitest + one Playwright e2e cover it.
- **Done (2026-10-18).** H6a (read-only view), H6b (edit single values), H6c (lists), H6d (both readings, flags, source highlight) and H6e (end to end). The modern ↔ historical switch (H3b, `DeedProfileSwitch.tsx`) sits at the top of the extraction panel, above the digital deed. H6e: `frontend/e2e/historical.spec.ts` (upload the sample PDF → sectioned form → edit a value + add a witness → reload → four-eyes → reviewer approves → record APPROVED, hashed, signature VALID, original hash intact). It runs only with real OCR (`npm run e2e:historical`, `E2E_REAL_OCR=1` in `e2e/start-backend.sh`: Tesseract + `ai/tessdata/ben` + rules; the deed has no mock fixture). The flow was walked against a real local backend through the API (upload, process, record PATCH, buyer NID, approve → land `LP-11001`, v1 MACHINE row); the browser part was not run (no Chromium in the sandbox). Finding: approval needs the buyer's NID + date of birth (OWNER_NID_REQUIRED), asked on the upload form or in the review screen's NID card; the e2e uses a synthetic NID (`fixtures.ts`).

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
- **Done (2026-10-18).** H7a `GET /documents`, H7b `GET /lands/{id}/documents` + `GET /documents/{id}/records/history`, H7c `/officer/documents` (My uploads · My office · Needs my action, home card), H7d `/officer/documents/[id]` (original left, read-only digital deed right, version picker, history from the audit log, file + record SHA-256, signature state, link to the review screen while under review) and the staff-only **Documents** section on the land result page. Record versions come from H5 (`GET /documents/{id}/records[/{version}]`). Written but not run in the sandbox (no node_modules / network): the H7c and H7d vitest files, `e2e/library.spec.ts` (`npm run e2e:library`) and the H7b backend tests; commands in plan.md STATE.

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
- **Done (2026-10-18, closed in H10).** H8a–H8e. The H8a spike ran in H10: neither engine has an exact Bangla text layer
  (WeasyPrint 3/12 strings, fpdf2 1/12; the same with Noto Sans Bengali). Conjuncts and the pre-base vowel sign come out as
  stray glyph codes. **D7 = WeasyPrint draws, and a PyMuPDF text layer replaces its text:** the drawn content is wrapped in an empty
  `/ActualText` (extractors skip it, viewers still draw it), and every line from WeasyPrint's layout is written
  over it as invisible, unshaped text in the right character order (`deed_pdf.text_layer`). The spike's third candidate
  `weasyprint+layer` gets 12/12. The round-trip test was redefined: the H4 parser reads deed prose, not our label/value
  layout, so the test now requires the H2 router to choose the text layer and ≥ 99 % of the printed values to come
  back unchanged and in order (49/49 on the sample). The H8c/H8d backend tests, vitest `features/library` + `features/qr` and
  `npm run e2e:library` (all four downloads of the approved sample) passed.

### H9 — Approval, chain of title, risk, search
- **D2:** approving a historical deed records a **past link in the chain of title** (ownership history with date ranges). It does **not** replace the current owner, which still changes only through mutation/khatian.
- Risk rules: chain gap between a historical deed and the CS/SA khatian owner; seller name ≠ khatian owner (fuzzy, via `names.py`); dag/khatian conflicts with later deeds; consideration sanity per era.
- Archive search (`features/archive`) indexes LHDR fields (party names, mouza, CS khatian, dag, year range), and each hit opens the H7 document page.
- **Done when:** approving the sample creates a 1944 chain-of-title entry visible on the land's history page and its Documents tab.
- **In progress.** H9a done (written, not run): data shape = `ownership_history` row with `kind=HISTORICAL`, tied to the deed's transaction via `source_transaction_id`; one per document, updated in place on correction. H9b written, not run: the 1944 link shows in `OwnershipTimeline` (Historical link badge, date, link to the document page for staff) and is marked in the land's Documents tab (`chain_link`). H9c done (2026-10-18): rules `HISTORICAL_SELLER_NOT_OWNER` (20) and `HISTORICAL_CHAIN_GAP` (15), see the log row. H9d written (2026-10-18): rules `HISTORICAL_DAG_CONFLICT` (25) and `HISTORICAL_CONSIDERATION_IMPLAUSIBLE` (10), see the log row. H9e written (2026-10-18): archive search indexes the LHDR fields and filters by deed year, hits open the document page, see the log row. **H9 is done; its owed tests ran in H10 (full backend suite and full vitest green).**

### H10 — Hardening, production & docs
- Run the eval on all historical samples and record before/after in `docs/ocr-accuracy.md`.
- `docs/historical-deeds.md`: format reference, glossary, reviewer guide, download/verify guide.
- Production:
  - create the Postgres + object-storage accounts (D6, §5b), set the env vars on Render, and run the restart test (redeploy, then the uploaded deed and its digital record are still there)
  - set `ANTHROPIC_API_KEY` and the daily cap on Render
  - check the text-layer gate there
- Demo script update: upload the historical deed → digital deed → approve → find it in My documents → download PDF → scan QR.
- **Done on the code and docs side (2026-10-18), branch `h10-hardening`.** The tests H6–H9 still owed ran and are green
  (full backend suite 1160 passed / 11 skipped with the real PDF engine; full vitest after 6 fixes; `tsc`;
  `npm run e2e:historical` and `npm run e2e:library`, the first real Playwright runs of both). The PDF text layer
  was fixed (D7, see H8). The text-layer gate was hardened: a layer with stray glyph codes glued to Bangla letters scored
  1.0 and is now rejected. Eval before/after: `docs/ocr-accuracy.md` (sample deed 1/13 → 13/13 core, all values
  2.1 % → 85.9 % with rules only). Added `docs/historical-deeds.md` (format, glossary, reviewer guide, download/verify
  guide) and demo script §C. `render.yaml` now lists the D6 and Claude variables as `sync: false`. Production go-live
  checklist: `docs/deploy-render.md` §6. **Not done (needs you):** the D6 accounts, the Render env vars and the
  restart test, the gate check in production, `ANTHROPIC_API_KEY` + cap, the LLM-on eval. Details in the log row.

---

## 3b. H6–H9 as one-session sub-phases (Sonnet 5.5)

H0–H5 are done. H6–H9 are split into **19 sub-phases**. Each one is sized to finish in **one Claude session
on Sonnet 5.5 within one 5-hour usage window**. Every session ends with a zip of the whole project, and
the next session starts from that zip. The phase descriptions in §3 stay the reference for *what* is
built; the cards below say *how much per session*.

### 3b.1 Session rules (every sub-phase)

1. **One sub-phase per session.** Start a new chat, give it the newest project zip (or the project
   folder), and paste the starter prompt (§3b.3) with the sub-phase id. Do not start the next card in
   the same session, even if time is left. Use the time left for the full test run and the hand-off.
2. **Read narrowly.** Read only §3b.1–3b.3, the one card, and the files under its *Touch* line. Read §2
   (LHDR shape) only when the card says so. Do not scan the whole repo. Open another file only when a
   listed one points to it.
3. **Test narrowly.** While working, run only the tests named in the card. The full backend and frontend
   suites run once at the end, and only if time is left. Otherwise list them as "not run" in the
   progress log.
4. **Zip early, zip often.** After every numbered task in the card, make the checkpoint zip (§3b.2). If
   the usage-limit warning appears, or the user writes **"zip now"**, stop the current task at once. Zip
   and fill in the progress log first; finishing the code can wait.
5. **Hand-off.** Before the final zip, update the card's row in the progress log (§3b.6): state (done /
   partial), the last finished task, what is left, which tests ran and which did not. When a phase's last
   card is done, also change that phase's "Not started" line in §3 to "Done" with a short summary, as
   H0–H5 have. A partial card continues in the next session under the same id ("Continue H6b from task
   3").
6. **No scope creep.** Anything found outside the card goes into the progress log's notes, not into
   code. If a card turns out too big, finish the tasks that fit and split the rest into a new card
   (`H6c2`) in the log.
7. **Never regenerate committed samples or fixtures** (§6, fixture hashes). Use test data that already
   exists or create new files.
8. **Git, when the session has the repo with `.git`:** one branch per card (`h6a-deed-view`,
   `h6b-edit-values`, …), each stacked on the previous card's branch, as H0–H5 were. Commit at the end of
   the card. Without `.git`, the zip is the hand-off.

### 3b.2 Checkpoint zip

Run this from the folder that contains the project folder. If the project folder is not called
`LandSheild-BD`, use its name in both places:

```bash
zip -qr -X "LandShield-BD-<id>-$(date +%Y%m%d-%H%M).zip" LandSheild-BD -x '*/node_modules/*' '*/.next/*' '*/__pycache__/*' '*/.pytest_cache/*' '*/.ruff_cache/*' '*/.mypy_cache/*' '*/coverage/*' '*/.DS_Store' '*/.venv/*' '*/venv/*' '*/test-results/*' '*/playwright-report/*' 'LandSheild-BD/backend/storage/*' '*.db' '*/.env' '*/.env.local' '*/.git/*'
```

- `<id>` is the card, e.g. `h6a`. The timestamp keeps every checkpoint, so a broken last step never
  overwrites a good zip.
- The exclusions drop installed packages, build output, caches, local uploads, local databases and
  secrets. `.env.example` stays in.
- In a chat sandbox (claude.ai), save the zip to the outputs folder and give the download link.
- Start the next session from the **newest** zip. Older zips can be deleted once the new one opens.

### 3b.3 Starter prompt

```text
Project: LandShield BD (zip attached / this folder).
Read docs/historical-deed-roadmap.md §3b.1–3b.3 (session rules) and only the card for <ID> in §3b.5.
Implement <ID> and nothing else. Read only the files the card lists, run only its tests,
make the checkpoint zip (§3b.2) after every task, and if I write "zip now" or the usage warning
appears, stop and zip at once. At the end, fill the progress log row (§3b.6) and give me the final zip.
```

For a partial card: `Continue <ID> from task <n>. The progress log says what is left.`

### 3b.4 Order

| # | Card | Needs | # | Card | Needs |
|---|---|---|---|---|---|
| 1 | H6a read-only digital deed view | H5 | 11 | H8b download API: JSON + original + record verify | H7a |
| 2 | H6b edit single values | H6a | 12 | H8c digital deed PDF | H8a, H8b |
| 3 | H6c lists: parties, plots, boundaries | H6b | 13 | H8d QR verify page + bundle ZIP | H8c |
| 4 | H6d both readings, flags, source highlight | H6c | 14 | H8e download menu in the UI | H7d, H8d |
| 5 | H6e approve the sample deed end to end | H6d | 15 | H9a chain-of-title link on approval | H5 |
| 6 | H7a `GET /documents` list API | H5 | 16 | H9b chain on the land page | H9a, H7d |
| 7 | H7b land documents, version history | H7a | 17 | H9c risk: chain gap, seller ≠ khatian owner | H9a |
| 8 | H7c "My documents" page | H7a | 18 | H9d risk: dag/khatian conflicts, consideration | H9c |
| 9 | H7d document page + land Documents tab | H6a, H7b, H7c | 19 | H9e archive search over LHDR fields | H5 |
| 10 | H8a PDF engine spike | — | | | |

H7a and H7b do not need H6 and may be done first, since the library is useful for every document. H8a
does not need anything and may be done whenever a session is free. Otherwise, follow the numbers.

### 3b.5 Cards

Paths are from the project root. Frontend commands run in `frontend/`, backend commands in `backend/`.

#### H6 — Reviewer UI: the digital deed form (5 sessions)

**H6a — Read-only digital deed view**
- **Goal:** when `deed_profile = historical`, the review screen shows the LHDR record in sections shaped
  like the paper deed: Registration · Dates · Parties · Consideration · Schedule · Boundaries · Title
  recital · Execution. Read-only. Modern deeds keep the 13 flat rows.
- **Touch:** `frontend/features/review/ExtractionPanel.tsx`, `types.ts`, `confidence.ts`,
  `frontend/messages/en.json` + `bn.json`; new `frontend/features/review/deed/` (`DeedView.tsx`,
  `FieldValue.tsx`, one file per section). Read `backend/app/schemas/extraction.py` (API shape) and
  `ai/extraction/lhdr.py` (record shape); §2 of this file.
- **Tasks:**
  1. TS types for the LHDR record and `Field` (value, verbatim, confidence, source, method, legibility, candidates, flags).
  2. `FieldValue`: normalised value, the verbatim text under it when different, a confidence badge (reuse `confidence.ts`).
  3. Section components and `DeedView`, switched on in `ExtractionPanel` by `deed_profile`.
  4. Bangla and English labels.
  5. vitest `deed-view.test.tsx` with a fixture built from `database/sample_data/historical/Historical_Land_Deed.gold.json` (values wrapped as `Field`).
- **Tests:** `npx vitest run features/review`
- **Done when:** the sample deed's record renders every section in both languages; modern deeds look unchanged.

**H6b — Edit single values**
- **Goal:** edit any single value in Registration, Dates, Consideration, Title recital and Execution. A
  save sends `replace` record ops (JSON pointer) through `PATCH /documents/{id}/extraction`. Edited
  values show "edited", and H1 content issues from the API appear next to their field.
- **Touch:** `frontend/features/review/deed/*`, new `frontend/features/review/useRecordEdit.ts`,
  `useReviewActions.ts`; read only: `backend/app/schemas/extraction.py`, `ai/extraction/lhdr_patch.py`.
- **Tasks:**
  1. `useRecordEdit`: queue ops, save, show errors, refresh the derived 13.
  2. Inline edit control in `FieldValue` (text, number, verbatim date).
  3. Wire the five sections.
  4. Show API issues by path.
  5. vitest for the ops sent.
- **Tests:** `npx vitest run features/review`. Backend `python -m pytest -q tests/test_lhdr_patch.py tests/test_records.py` only if a backend change was needed.
- **Done when:** a reviewer edits the deed no, the verbatim date and the consideration, reloads, and sees them saved and marked edited.

**H6c — Lists: parties, plots, boundaries, witnesses, stamps**
- **Goal:** party cards with add/remove (role, honorific, name, father + deceased flag, mother,
  address, profession, religion); a schedule table with add/remove plots (mouza, survey, khatian, dag
  list, area value/unit/in words, land class); boundaries as an N/S/E/W compass; witnesses and stamps
  lists. Uses `add` / `remove` ops.
- **Touch:** `frontend/features/review/deed/` (new `PartyCard.tsx`, `ScheduleTable.tsx`,
  `BoundaryCompass.tsx`, `ExecutionList.tsx`), `useRecordEdit.ts`, messages.
- **Tasks:**
  1. Party cards.
  2. Schedule table.
  3. Boundary compass.
  4. Witnesses and stamps.
  5. vitest: each add/remove sends the pointer op `lhdr_patch.py` expects.
- **Tests:** `npx vitest run features/review`
- **Done when:** a plot and a witness can be added and removed, and the saved record matches.

**H6d — Both readings, flags and source highlight**
- **Goal:** where `Field.candidates` exist (rules and LLM disagree, H4 fusion), a picker shows both
  readings and saves the choice as a `replace`. `Field.flags` (`DISAGREE`, `NOT_IN_TEXT`, …) show as
  warnings. Clicking a value with `source.bbox` highlights that box in `DocumentPreview`, switching page
  when needed. The existing `DeedProfileSwitch` gets its place in the new layout.
- **Touch:** `frontend/features/review/DocumentPreview.tsx`, `ReviewView.tsx`, `DeedProfileSwitch.tsx`,
  `useReviewShortcuts.ts`, `deed/*`; read only: `ai/extraction/fuse.py` (flag names).
- **Tasks:**
  1. Candidate picker.
  2. Flag badges.
  3. Bbox overlay and page switch (a value without a bbox simply has no highlight).
  4. Keyboard and a11y: A/R/N still work, the picker and compass can be reached by keyboard, and screen-reader labels are set.
  5. vitest.
- **Tests:** `npx vitest run features/review`
- **Done when:** a disagreeing value is resolved by picking a reading, and a click highlights its box.

**H6e — Approve the sample deed end to end**
- **Goal:** H6's done criterion. A reviewer corrects and approves the sample deed in the digital deed
  form without the flat fields.
- **Touch:** new `frontend/e2e/historical.spec.ts`, `frontend/e2e/fixtures.ts`, and small UI fixes that
  block approval.
- **Tasks:**
  1. Walk the flow against a local backend (upload sample → historical form → fix → approve) and fix blockers.
  2. Write the Playwright e2e.
  3. Run full vitest and `tsc`.
  4. Mark H6 done in §3 and in the log.
- **Tests:** `npx playwright test e2e/historical.spec.ts`, `npx vitest run`, `npx tsc --noEmit`. If the session cannot run a backend and a browser, write the e2e anyway and log it as "not run".
- **Done when:** the e2e passes (or is written and logged as not run), and vitest and tsc are clean.

#### H7 — Document library (4 sessions)

**H7a — `GET /documents` list API**
- **Goal:** a paginated, scoped list. Scoping uses `doc_scope`, like the queue: the user's own office and the
  offices below it. Uploaders always see their own uploads, admins see everything, reviewers see what they
  can review, and citizens get 403. Filters: `mine`, `status`, `type`, `profile`, office/upazila/district,
  date range. Search: deed no, mouza, party name, land id. Sort: newest, status, deed date. Tab presets:
  `tab=mine|office|action`.
- **Touch:** `backend/app/api/v1/documents.py`, new `backend/app/services/library.py`,
  `backend/app/schemas/document.py`; read the queue's scoping in `services/officer.py` /
  `services/review.py`; tests: new `backend/tests/test_library.py`,
  `tests/security/test_authz_matrix.py`, `tests/security/test_audit_coverage.py`.
- **Tasks:**
  1. Schema and scoped service.
  2. Filters, search, sort and pagination.
  3. Route, plus entries in the authz and audit matrices.
  4. Tests: scoping per role, each filter, search, pagination.
- **Tests:** `python -m pytest -q tests/test_library.py tests/security`
- **Done when:** the scoping tests pass for all four roles.

**H7b — Land documents and version history**
- **Goal:** `GET /lands/{land_id}/documents` lists every document of a land in deed-date order, each with its
  latest approved record version and a historical tag. `GET /documents/{id}/records/history` shows who
  changed what and when per version, read from the audit log. The officer-home card uses
  `GET /documents?tab=mine&limit=5` (H7a), so it needs no new route.
- **Touch:** `backend/app/api/v1/lands.py`, `documents.py`, `services/library.py`, `services/records.py`;
  read only: `services/audit_logs.py`; tests in `test_library.py`.
- **Tasks:**
  1. Land documents endpoint with scoping.
  2. Version history from the audit log.
  3. Tests.
- **Tests:** `python -m pytest -q tests/test_library.py tests/test_records.py`
- **Done when:** the sample land lists its documents in date order, and a corrected record shows its edits per version.

**H7c — "My documents" page**
- **Goal:** `/officer/documents` under `OfficerShell`, with a menu item "আমার নথি / My documents". It shows a table (file-type
  icon, deed no, mouza, type, historical tag, status, uploaded on, digitised yes/no) and the tabs My uploads ·
  My office · Needs my action, with filters, search and pagination kept in the URL. The officer home gets a
  "Recently uploaded by me" card (last 5).
- **Touch:** new `frontend/app/[locale]/officer/documents/page.tsx`, new `frontend/features/library/`
  (`LibraryView.tsx`, `useLibrary.ts`, `types.ts`), `frontend/features/officer/OfficerShell.tsx`,
  `DashboardView.tsx`, messages; read `features/officer/QueueTable.tsx` for the table pattern.
- **Tasks:**
  1. Types and hook.
  2. Table and tabs.
  3. Filters, search and pagination.
  4. Menu item and home card.
  5. vitest `library.test.tsx` (tabs, filters, empty and error states).
- **Tests:** `npx vitest run features/library features/officer`
- **Done when:** the page lists the user's uploads with every filter working in vitest.

**H7d — Document page and the land's Documents tab**
- **Goal:** `/officer/documents/[id]` shows the original file on the left (`DocumentPreview`) and the
  digital deed on the right (H6a `DeedView` read-only, or the 13 flat fields for a modern deed). It has a
  version picker, the version history (H7b), the file SHA-256 and "signature valid ✓". While a document is
  under review, the page links to `/officer/review/[id]`. The land result page (`ResultView`, staff only)
  gets a **Documents** tab listing every deed of the land, each one opening the document page.
- **Touch:** new `frontend/app/[locale]/officer/documents/[id]/page.tsx`,
  `frontend/features/library/DocumentPage.tsx`, `features/review/deed/DeedView.tsx` (add a read-only
  prop), `features/result/ResultView.tsx`, messages; e2e.
- **Tasks:**
  1. Page layout and data.
  2. Version picker, history, hash and signature.
  3. Land Documents tab.
  4. vitest.
  5. e2e (upload sample → My uploads → approve → document page with original, digital deed and versions), then mark H7 done in §3 and in the log.
- **Tests:** `npx vitest run features/library features/result`, then `npx playwright test e2e/library.spec.ts` (or log it as "not run")
- **Done when:** H7's done criterion in §3 holds.

#### H8 — Download the digital deed (5 sessions)

**H8a — PDF engine spike (decide before building)**
- **Goal:** choose a server-side PDF engine that shapes Bangla correctly **and** keeps a correct text
  layer. The sample deed broke because its Chrome-printed text layer lost the conjuncts (§1 row 1), so
  Chrome/Playwright printing is out. Candidates:
  - WeasyPrint (Pango + HarfBuzz) with Noto Sans Bengali
  - fpdf2 with `uharfbuzz` text shaping
- **Touch:** new `scripts/pdf_spike.py`, `backend/pyproject.toml` (optional extra `pdf`), `Dockerfile`
  (system libraries, if needed), `ai/fonts/` (font + licence). On macOS WeasyPrint needs `brew install
  pango`.
- **Tasks:**
  1. Render one test page with the sample deed's Bangla (names, `তপশিল`, `বিক্রেতা`, `পশ্চিমে`, `সম্পত্তির`) in each candidate.
  2. Extract the text with PyMuPDF, score it with `ai/ocr/quality.py`, and compare it with the source string exactly.
  3. Check the Docker install size and time.
  4. Record the decision with its numbers under H8 in §3 and as D7 in §5.
- **Tests:** `python scripts/pdf_spike.py`
- **Done when:** one candidate gives an exact text round-trip and passes the quality gate, and the
  decision is recorded. If neither does, record a fallback (for example, an invisible exact text layer or
  the JSON attached inside the PDF) and the reason.

**H8b — Download API: JSON, original and record verify**
- **Goal:** `GET /documents/{id}/download?what=json|original&version=n`.
  - Scoped like viewing (H7a), audit-logged (`DOCUMENT_DOWNLOAD` with what and version), and rate-limited like uploads.
  - JSON: the LHDR record (or `core/1`) plus `record_hash`, `signature` and the key id.
  - Original: the exact bytes with `X-File-SHA256` and a `Content-Disposition` filename.
  - A public record check (`POST /public/records/verify`): send the JSON, get back VALID or INVALID.
- **Touch:** `backend/app/api/v1/documents.py`, `api/v1/public.py`, `services/records.py`, `core/config.py`;
  read only: `services/signing.py`; tests: new `backend/tests/test_downloads.py`, the security matrices.
- **Tasks:**
  1. JSON and original downloads.
  2. Audit and rate limit.
  3. Public record verify.
  4. Tests, including "change one byte of the JSON → INVALID".
- **Tests:** `python -m pytest -q tests/test_downloads.py tests/security`
- **Done when:** the tests pass, including the one-byte tamper test.

**H8c — Digital deed PDF**
- **Goal:** `what=pdf` lays out the deed section by section in Bangla (English labels optional).
  - Footer: deed no, version, approval date, approving officer, SHA-256 of the record and of the original, and the signature.
  - "DRAFT – NOT APPROVED" on anything not yet approved.
  - NIDs printed as the last 4 digits only.
- **Touch:** new `backend/app/services/deed_pdf.py` (+ its template), the H8a engine,
  `api/v1/documents.py`; tests: new `backend/tests/test_deed_pdf.py`.
- **Tasks:**
  1. Layout for sections A–I.
  2. Footer and draft mark.
  3. Endpoint.
  4. Round-trip test: our PDF → the H2 pipeline → ≥ 99 % of the fields unchanged.
- **Tests:** `python -m pytest -q tests/test_deed_pdf.py tests/test_downloads.py`
- **Done when:** the sample deed's PDF passes the round-trip test.

**H8d — QR verify page and bundle ZIP**
- **Goal:** the PDF footer carries a QR code to a public record verify page (`/v/r/[recordId]`, next to
  today's `/v/[landId]`). The page shows valid or invalid, deed no, version and approval date, and no
  personal data. `what=bundle` returns a ZIP with the original, the PDF, the JSON and a `manifest.json`
  (hashes, signature, version history).
- **Touch:** `backend/app/services/deed_pdf.py` (QR, e.g. with `segno`), new
  `backend/app/services/bundle.py`, `api/v1/public.py`; new `frontend/app/[locale]/v/r/[recordId]/page.tsx`,
  reusing `frontend/features/qr/PublicVerifyView.tsx` where possible; messages; tests.
- **Tasks:**
  1. Public verify page.
  2. QR in the PDF.
  3. Bundle and manifest.
  4. Backend tests and vitest.
- **Tests:** `python -m pytest -q tests/test_downloads.py tests/test_deed_pdf.py`, `npx vitest run features/qr`
- **Done when:** the PDF's QR opens the page showing "valid", and the manifest's hashes match the files in the bundle.

**H8e — Download menu in the UI**
- **Goal:** a Download menu (PDF · JSON · Original · Bundle, for the version shown) on the document page and
  on each library row, with disabled states, a rate-limit error message and proper filenames.
- **Touch:** new `frontend/features/library/DownloadMenu.tsx`, `DocumentPage.tsx`, `LibraryView.tsx`, messages; e2e.
- **Tasks:**
  1. Menu and blob download.
  2. Wire it into the page and the rows.
  3. vitest.
  4. e2e (approved sample → each download → the PDF opens), then mark H8 done in §3 and in the log.
- **Tests:** `npx vitest run features/library`, `npx playwright test e2e/library.spec.ts` (or log it as "not run")
- **Done when:** H8's done criterion in §3 holds.

#### H9 — Approval, chain of title, risk, search (5 sessions)

**H9a — Chain-of-title link on approval**
- **Goal (D2):** approving a historical deed adds a *past* link (seller → buyer, with the date range from
  the Bangla-calendar date) to the land's ownership history. It does not change the current owner.
  Approving a corrected version updates that link instead of adding a second one.
- **Touch:** `backend/app/models/ownership.py` (`OwnershipHistory` already has `start_date` /
  `end_date`, with null meaning the current owner; add a `kind` / `record_id` column with migration 0018
  only if it is needed), `services/posting.py`, `services/review.py`, `services/records.py`; tests: new
  `backend/tests/test_chain_of_title.py`.
- **Tasks:**
  1. Read the approval and posting path, choose the data shape, and note it under H9 in §3.
  2. Create or update the link on approval and on correction.
  3. Make sure current-owner queries ignore historical links.
  4. Tests.
- **Tests:** `python -m pytest -q tests/test_chain_of_title.py tests/test_records.py tests/test_lands.py`
- **Done when:** approving the sample creates exactly one 1944 link and the current owner is unchanged.

**H9b — Show the chain on the land page**
- **Goal:** the 1944 link appears in `OwnershipTimeline`, marked historical, with its date range and a
  link to the document page. It is also marked in the land's Documents tab.
- **Touch:** `backend/app/services/ownership.py` + its schema, `frontend/features/result/OwnershipTimeline.tsx`,
  `types.ts`, messages; tests.
- **Tests:** `python -m pytest -q tests/test_chain_of_title.py tests/test_lands.py`, `npx vitest run features/result`
- **Done when:** H9's done criterion in §3 holds.

**H9c — Risk rules 1: chain gap, seller ≠ khatian owner**
- **Goal:** two new rules in `backend/app/risk/rules/`:
  1. A gap between the historical deed's buyer and the CS/SA khatian owner.
  2. A seller name that differs from the khatian owner (fuzzy match via `services/names.py`, allowing for Bangla spelling variants).

  Each rule gives evidence items for the risk UI.
- **Touch:** `backend/app/risk/rules/*`, `risk/context.py` (load the historical links), `risk/config.py`
  (points); tests next to the existing risk tests.
- **Tests:** the risk test files (`python -m pytest -q -k risk`)
- **Done when:** tests with matching and mismatching names and with gaps pass, and the existing risk tests are unchanged.

**H9d — Risk rules 2: dag/khatian conflicts, consideration sanity**
- **Goal:**
  3. The same dag/khatian claimed by a later deed through a different seller chain.
  4. A consideration sanity check per era: INR / PKR / BDT ranges per area unit. This only flags, never blocks.
- **Touch:** as H9c.
- **Tests:** `python -m pytest -q -k risk`, then the full backend suite once at the end
- **Done when:** the rule tests pass and the full backend suite passes on SQLite.

**H9e — Archive search over LHDR fields**
- **Goal:** archive search indexes the LHDR party names, mouza, CS khatian, dag and year range, on both
  SQLite FTS5 and Postgres `tsvector`. It gets a year-range filter, and each hit opens the H7 document
  page.
- **Touch:** `backend/app/services/archive.py`, the archive schema, `frontend/features/archive/*`, messages;
  archive tests and `features/archive/archive.test.tsx`.
- **Tasks:**
  1. Index the LHDR fields.
  2. Add the year filter.
  3. Point hits to the document page.
  4. Tests, then mark H9 done in §3 and in the log.
- **Tests:** `python -m pytest -q -k archive`, `npx vitest run features/archive`. Postgres too, when `TEST_DATABASE_URL` is available.
- **Done when:** searching `রামকান্ত` or `ভবানীপুর` with years 1940–1950 finds the sample deed.

### 3b.6 Progress log

Each session updates only its own row.

| Card | State | Last task done | Zip | Tests run / not run | Notes |
|---|---|---|---|---|---|
| H6a | done | 5 of 5 (types, FieldValue, sections + DeedView + ExtractionPanel switch, EN+BN labels, vitest) | `LandShield-BD-h6a-20261018-0505.zip` | run: `npx vitest run features/review` (70 pass), full `npx vitest run` (861 pass), `npx tsc --noEmit`, `check:i18n` (2183 keys, no hardcoded strings). Not run: Playwright, backend suites (no backend change) | Historical deeds with a record keep the 13 flat rows in a collapsed "Core fields" block under the deed view (editing them still works until H6b), so nothing regresses. Registration section also shows deed kind + era (section A). `modern_mapping` (section I) is not shown yet. Read-only: no edit, candidate picker or bbox highlight (H6b–H6d). Issues from `record_validation` are typed but not shown (H6b task 4). |
| H6b | done | 5 of 5 (`useRecordEdit` queue + `saveRecord`, inline edit in `FieldValue`, five sections wired, issues by path, vitest) | `LandShield-BD-h6b-20261018-0521.zip` | run: `npx vitest run features/review` (82 pass), full `npx vitest run` (873 pass, before the last test-typing fix; review folder re-run after it), `npx tsc --noEmit`, `check:i18n` (2203 keys, no hardcoded strings). Not run: Playwright, backend suites (no backend change), a real backend round trip | Edits send `PATCH /documents/{id}/extraction {record:[{op:replace,path,value}]}`; saves are serialised (`useRecordEdit`), the answer replaces the cached extraction so the record and the derived 13 refresh. Kinds: text, number (`/registration/year`, `/document/pages`, `/dates/*/day|year`, `/consideration/amount`), select (deed kind, era, calendar, precision, era currency, stamp type), boolean (`encumbrance_free`); empty input sends `null`. Issues: `record_validation` errors/warnings are shown under the value whose pointer equals or contains the issue path (`review.deed.issues.<CODE>`, falls back to the API message); refused saves (422 `RECORD_PATCH_FAILED` / `RECORD_VALIDATION_FAILED`, details `[{path, code}]`) keep the form open. Editable only while status is REVIEW_REQUIRED / EXTRACTED, same as the flat rows. Not done (belongs to later cards): witnesses, party fields, plots, boundaries (H6c), candidate picker / flags / bbox (H6d). Issues with a container path (`/parties`, `/schedule`, `/core/*`) have no field to sit next to yet and are not shown (H6c). |
| H6c | done | 5 of 5 (party cards, schedule table + dag list, boundary compass, witnesses/stamps/seals lists, vitest) | `LandShield-BD-h6c-20261018-1135.zip` | run: `npx vitest run features/review` (99 pass; new record-lists.test.tsx 17), full `npx vitest run` (890 pass, before the last comment-only edit), `npx tsc --noEmit`, `check:i18n` (2223 keys, no hardcoded strings). Not run: Playwright, backend suites (no backend change), a real backend round trip | `deed/ListControls.tsx` holds `useListOps`, `RemoveButton` (one-step confirm, `remove` op), `AddItem` (optional select + text, `add` op at `<list>/-`), `ContainerIssues` (issues whose path is the list itself, e.g. `/parties`, `/schedule`, `/execution/witnesses|stamps|seals`). `PartyCard` takes a `path` and now edits role (select), honorific, name, father + deceased (yes/no), husband, mother, address, profession, religion, nationality, share; used for parties and witnesses. `ScheduleSection`: plots add/remove (`add /schedule/-` with `{}`), every plot value editable, dag numbers one value each with add/remove (`/schedule/i/dag_no/-`; test id is now `plot{i}_dag{j}`), `BoundaryCompass` replaces `BoundariesList` (N/S/E/W around the plot, each side editable). `ExecutionList.tsx`: `WitnessList` (add = `{role:WITNESS,name}`), `StampList` (add = `{type,value}`), `SealList`. Party add sends `{role[,name]}`. Same editable rule as H6b (REVIEW_REQUIRED / EXTRACTED). Not done: area `parts` (archaic compound units) stay read-only; `/core/*` issues still have no place; no drag-to-reorder; add-party role defaults to Seller. |
| H6d | done | 5 of 5 (candidate picker, flag badges, bbox highlight + page switch, keyboard/a11y, vitest) | `LandShield-BD-h6d-20261018-1149.zip` | run: `npx vitest run features/review` (107 pass; new record-readings.test.tsx 8), full `npx vitest run` (898 pass), `npx tsc --noEmit`, `check:i18n` (2234 keys, no hardcoded strings). Not run: Playwright, backend suites (no backend change), a real backend round trip, eslint (no flat config in repo) | `highlight.tsx` (`HighlightProvider`, `useHighlight`, `usableBbox`) wraps the review columns; `deed/CandidatePicker.tsx` = `FlagBadges` (DISAGREE, NOT_IN_TEXT, unknown codes shown raw; `review.deed.flags|flagHelp`) + the picker (other readings with engine + confidence; "Use this reading" = one `replace` of the value, refused picks show the API reason and stay open; read-only when not reviewable). `FieldValue` gets a "Show on page" button only when `source.bbox` is a usable x,y,w,h (aria-pressed; clicking again clears). `DocumentPreview`: images get a percent-positioned overlay (OCR pixel box / natural image size, scrolls into view), PDFs switch the iframe to `#page=N` (a PDF viewer cannot be drawn on, said in the status line); a status line + Clear button, Escape clears; on phones the Document tab opens by itself. `review.test.tsx` zoom test now reads the wrapper's width (the image sits in a zoom-sized wrapper). A/R/N untouched (still ignored while typing). Not done: images show page 1 only, so a box on page ≥ 2 of an image is not drawn; no candidate for lists' container paths; unknown API bbox unit assumed = OCR image pixels. |
| H6e | done | 4 of 4 (flow walked on a local backend, e2e written, vitest + tsc run, H6 marked done) | `LandShield-BD-h6e-20261018-0559.zip` | run: full `npx vitest run` (898 pass), `npx tsc --noEmit` (app + e2e project), `check:i18n`; backend walk by API with Tesseract + Bangla data (upload → process → historical record → NID → approve). Not run: `npx playwright test e2e/historical.spec.ts` (Playwright cannot download Chromium here), backend suites (no backend change) | New `e2e/historical.spec.ts`; `fixtures.ts` has a synthetic buyer NID for the sample; `start-backend.sh` + `npm run e2e:historical` switch the e2e backend to real OCR. The spec skips itself without `E2E_REAL_OCR=1`. Locators were checked against the components, not in a browser: run it once and fix any selector. Real OCR on the sample PDF takes ~15 s, the spec allows 240 s. No UI blocker found by code reading; the one hard requirement is the buyer NID (above). |
| H7a | done | 4 of 4 (schema + scoped service, filters / search / sort / paging, route + authz matrix entry, tests) | `LandShield-BD-h7a-20261018-0617.zip` | run: `python -m pytest -q tests/test_library.py tests/security` (48 pass; new test_library.py 16), plus test_documents, test_officer, test_officer_offices, test_records, test_review (112 pass), ruff on the touched files. Not run: the full backend suite, Postgres (`TEST_DATABASE_URL` unset), frontend (no frontend change) | `GET /documents` (REVIEWER+, citizens 403): `services/library.py`, `LibraryItem` / `LibraryList` in `schemas/document.py`. Scope = `doc_scope` OR own uploads; `tab=mine` (uploaded by me) · `office` (scope only) · `action` (pending review I may decide, four-eyes: not my own unless ADMIN, plus my own UPLOADED / FAILED to process or retry); `mine`, `status`, `type`, `profile`, `division/district/upazila/office_id`, `date_from/date_to` (uploaded date, Dhaka days, 422 `INVALID_DATE_RANGE`), `q` (deed no, mouza, party name, land id; Bangla digits folded), `sort=created_at\|status\|deed_date` + `order`, `limit` ≤ 100. Each item: deed no, mouza, deed date, `historical`, `uploaded_by_me`, `digitised` + `approved_version` + `versions` (from `document_records`), `needs_my_action`; no hash, path or uploader identity. `q`, `profile` and the `deed_date` sort run in Python over the SQL-filtered rows (`extraction_json` is not indexed): fine for the demo, add a column / index if it grows. A document not read yet has no profile and matches neither profile filter. GET routes are not in the audit matrix (it lists write routes only); the route is in the authz matrix and in the leak sweep. |
| H7b | done | 3 of 3 (land documents endpoint with scoping, version history from the audit log, tests) | `LandShield-BD-h7b-20261018-0623.zip` | run: `python -m py_compile` on every touched file, an import check by script. **Not run (the sandbox has no network, so no Python packages could be installed): `python -m pytest -q tests/test_library.py tests/test_records.py tests/security`, ruff, the full backend suite, Postgres, frontend (no frontend change). Run the first command once and fix what it shows.** | `GET /lands/{land_id}/documents` (REVIEWER+, citizens 403, unknown land 404 `LAND_NOT_FOUND`): `library.land_documents`. A document belongs to the land by `documents.land_id` or by a deed it posted (`deeds.document_id`). Scope = the library's (own office and beneath, plus own uploads, admins / reviewers / unrestricted officer see all). Order: deed date oldest first, undated last, then upload time. Items are the H7a `LibraryItem` plus `approved_record {version, record_schema, approved_at, approved_by, signature_status}` (`LandDocumentItem`, `LandDocuments`). H7a's row builder is now `library._items`, shared by both. `GET /documents/{id}/records/history` (REVIEWER+, `ensure_doc_access`; declared before `/records/{version}`): `records.history` -> per version `events` oldest first: `CREATED` (actor None = the extraction job), `EDIT` with `changes [{path, op, old, new}]`, `CORRECTION_START`, `BASELINE`, `APPROVE`; actor = name + role at the time. Record edits show JSON pointers; a document without an LHDR record shows flat field names. Values are cut to 200 characters. Pre-approval edits (`DOCUMENT_EXTRACTION_EDIT`) carry no version in the audit row (an existing test pins its exact payload), so they are attached to the newest version that existed when they were saved (timestamps have microsecond precision). Not in the history: reject / reprocess events, and a version's approval of a document approved before H5. Authz matrix has both new routes; GET routes need no audit entry. |
| H7c | done | 5 of 5 (types + hook, table + tabs, filters / search / paging in the URL, menu item + home card, vitest) | `LandShield-BD-h7c-20261018-0633.zip` | run: `node scripts/check-i18n.mjs` (2285 keys) and `audit-hardcoded.mjs` (clean). **Not run (sandbox has no node_modules and no network): `npx vitest run features/library features/officer`, `npx tsc --noEmit`, the full vitest run. Run the first command once and fix what it shows.** | `/officer/documents` (`features/library/LibraryView.tsx`, `useLibrary.ts`, `types.ts`, `RecentUploads.tsx`); `OFFICER_NAV` has the item for REVIEW_UP. The whole page state (tab, status, type, profile, area, date range, q, sort, order, page) is in the URL, read by `paramsFromUrl`, written with `router.replace`; changing any filter resets to page 1. Tabs use the H7a presets `tab=mine|office|action`; limit 20. Rows link through `documentHref()` to `/officer/review/[id]` **until H7d**, which should change that one function to `/officer/documents/[id]`. Thumbnail = file-type icon only (the list API has no thumbnail route use yet; PDF / image icon). Home card sits under the queue. Existing tests: `officer.test.tsx` and `a11y.test.tsx` mocks now answer `/documents?` (the dashboard calls it). No a11y case for the new page yet, no e2e (belongs to H7d). Search box submits on Search / Enter; the area filter uses the queue's `AreaFilter`. |
| H7d | done | 5 of 5 (page layout + data, version picker / history / hash / signature, land Documents section, vitest, e2e) | `LandShield-BD-h7d-20261018-0646.zip` | run: `node scripts/check-i18n.mjs` (2329 keys) and `audit-hardcoded.mjs` (clean); rough bracket-balance check of every new file. **Not run (sandbox has no node_modules and no network): `npx vitest run features/library features/result features/officer`, `npx tsc --noEmit`, `npm run e2e:library`, the H7b backend tests. Run the vitest command once and fix what it shows (selectors in the e2e were checked against the components, not in a browser).** | New `features/library/`: `DocumentPage` (HighlightProvider so "Show on page" still works), `VersionPanel` (picker, who / when, hashes, `SignatureBadge`, `defaultVersion` = newest approved else newest), `VersionHistory` (events CREATED / EDIT with `path: old → new` / CORRECTION_START / BASELINE / APPROVE from H7b), `LandDocuments`, `useDocumentPage` (`useRecordVersions`, `useRecordVersion`, `useRecordHistory`, `useLandDocuments`). `DeedView` got `readOnly` (`ReadOnlyRecord` in `deed/RecordEdit.tsx` forces a null edit context), so no Edit / Add / Remove control appears even below an editing provider. A `core/1` version shows the 13 flat fields with confidence badges. Route `app/[locale]/officer/documents/[id]/page.tsx` (RequireRole REVIEW_UP, max-w-7xl). `documentHref` -> `/officer/documents/[id]`, new `reviewHref`, `UNDER_REVIEW`; library.test href updated. ResultView: the Documents section is added only when `hasRole(user.role, REVIEW_UP)` and the query is disabled for citizens (the endpoint answers them 403). Not done / notes: no thumbnail (the library still shows the file-type icon); no download buttons (H8e); the document page is stacked on phones (no Original / Digital tabs yet); chain-of-title marker in the Documents section is H9b; no a11y (axe) case for the two new pages. |
| H8a | partial | 1 of 4 (spike script + `pdf` extra written; render / score / install-size / D7 not done) | `LandShield-BD-h8a-20261018.zip` | run: `py_compile scripts/pdf_spike.py`, dry run (both engines report not-installed, exit 1). **Not run (sandbox has no network and none of weasyprint / fpdf2 / uharfbuzz / PyMuPDF): `python scripts/pdf_spike.py`. Next session with network: `pip install -e "./backend[pdf]" pymupdf`, run it, read `scripts/_out/pdf_spike_report.json`, then write the numbers under H8 in §3 and as D7 in §5; add `libpango-1.0-0 libpangoft2-1.0-0` to the Dockerfile only if WeasyPrint wins; if neither is exact, record the fallback (invisible exact text layer or JSON attached inside the PDF).** | `scripts/pdf_spike.py` exits 0 only when one engine is exact on all 12 strings and scores >= 0.8; on macOS WeasyPrint needs `brew install pango`. |
| H8b | done | 4 of 4 (JSON + original downloads, audit + rate limit, public record verify, tests incl. the one-byte tamper test) | `LandShield-BD-h8b-20261018-0733.zip` | run: `python -m pytest -q tests/test_downloads.py tests/security` (new test_downloads.py 17), plus test_records, test_library (the H7b tests, first run now), test_signing, test_public, test_documents; ruff on the touched files. Full backend suite: see plan.md STATE. Not run: Postgres (`TEST_DATABASE_URL` unset), frontend (no frontend change), H8a spike (still open) | `GET /documents/{id}/download?what=json\|original&version=n` (REVIEWER+, `ensure_doc_access`, 30/hour/user via `DOWNLOAD_RATE_LIMIT_PER_HOUR`, audit `DOCUMENT_DOWNLOAD` with `what` + `version` only; `pdf` / `bundle` are 422 until H8c / H8d). JSON = envelope `landshield-record/1`: `document {id, document_type, file_hash}`, `version`, `status`, `draft`, `record_schema`, `integrity {payload_version, approved_by, approved_at, record_hash, signature, algorithm, key_id, public_key}`, `record`. Default version = newest APPROVED, else newest; a MACHINE / DRAFT download has null hash + signature and file name `…-draft.json`. Original = exact stored bytes, `X-File-SHA256`, `Content-Disposition: attachment; filename=landshield-original-<id>.<ext>` (re-hashed on every read, as H5). `POST /public/records/verify` (anonymous, 60/min/IP, body ≤ 1 MiB → 413 `RECORD_TOO_LARGE`) takes the downloaded JSON and answers `{state: VALID\|INVALID}` only: it rebuilds the signed payload (`records.payload_bytes`, shared with approval), checks SHA-256, the Ed25519 signature, and that the same hash is stored for that document version; any changed value, wrong type, draft or foreign-key signature is INVALID. `approved_by` in the file is the opaque user id (it is part of the signed payload); no names are exported. Notes for H8c/H8d: the PDF footer should print `integrity.record_hash` and the version; the QR page (`/v/r/[recordId]`) needs a record id — rows have `document_records.id`, not yet exposed by any public route. |
| H8c | partial | 4 of 4 written, none run | `LandShield-BD-h8c-20261018.zip` | py_compile only. Not run: `python -m pytest -q tests/test_deed_pdf.py tests/test_downloads.py` (no pytest / WeasyPrint / network here). Round-trip ≥ 99 % is the open risk. See plan.md STATE. | `what=pdf` in documents.py, `services/deed_pdf.py`, Dockerfile libpango + `pdf` extra |
| H8d | written, not run | 4 of 4 (public verify page, QR in the PDF, bundle + manifest, tests) | `LandShield-BD-h8d-20261018.zip` | NOT RUN (sandbox: no pytest / fastapi / segno / WeasyPrint, no network): `python -m pytest -q tests/test_public_record.py tests/test_downloads.py tests/test_deed_pdf.py tests/security`, `npx vitest run features/qr`. Done here: py_compile of every touched backend file, `npm run check:i18n` (2342 keys). | `GET /public/records/{record_id}` (anonymous, 60/min/IP) -> `{state VALID\|INVALID, deed_no, version, approved_at, superseded}`; only APPROVED / SUPERSEDED rows are public, anything else is the same 404 `RECORD_NOT_FOUND`; hash + signature re-checked each read. Page `/{locale}/v/r/[recordId]` (`features/qr/PublicRecordView.tsx`, `usePublicRecord`, `publicRecord.*` EN+BN). PDF footer: QR (`segno`, SVG data URI; text address only if segno is missing; none on a draft) to `{PUBLIC_SITE_URL}/bn/v/r/{record id}` (`PUBLIC_SITE_URL`, default http://localhost:3000; set it on Render). `what=bundle` = ZIP `original.<ext>`, `deed.pdf`, `record.json`, `manifest.json` (`landshield-bundle/1`: files with SHA-256 + size, record hash, signature, key id, original hash, verify_url, per-version history; no names; deterministic bytes); file `landshield-bundle-<id>-v<n>[-draft].zip`; same scope / rate limit / audit as the other downloads. H8e (UI menu) is next. |
| H8e | done (written, not run) | 4 of 4 (menu + blob download, wired into the document page and each library row, vitest, e2e step) | `LandShield-BD-h8e-20261018.zip` | run: `node scripts/check-i18n.mjs` (2361 keys), `audit-hardcoded.mjs` (clean). **Not run (sandbox: no node_modules, no network): `npx vitest run features/library`, `npx tsc --noEmit`, `npm run e2e:library`; the H8c/H8d backend tests and the H8a spike are still not run either.** | `features/library/DownloadMenu.tsx`: a Download ▾ disclosure (PDF · JSON · Original · Bundle). Each item calls `api.blob(/documents/{id}/download?what=…&version=n)` and saves it through an object URL; file names are rebuilt like the server's (`landshield-deed-<id>-v<n>[-draft].pdf`, …), because `api.blob` returns bytes only. Version = the version shown on the document page (`selected`), on library rows = the approved version (none → the server picks the newest, file marked draft). Without a record (`versions = 0`) only Original is enabled; a not-approved version shows a draft note. One download at a time (other items disabled, `aria-busy`). Errors as toasts: 429 rate limit, 503 `PDF_ENGINE_UNAVAILABLE`, 403/404, other; the menu stays open on an error and closes on success, Escape or an outside click. New column `library.cols.download`, `library.download.*` EN+BN. Tests: new `download-menu.test.tsx` (helpers, 4 downloads, draft, no record, 429, 503/403, busy, Bangla) + one row test in `library.test.tsx`; `e2e/library.spec.ts` gets a step that downloads all four from the approved sample (PDF starts `%PDF-`, JSON is `lhdr/1`, original SHA-256 = the page's, ZIP starts `PK`). Notes: the row menu is an absolutely positioned panel inside a table cell, so check once in a browser that the table's scroll container does not clip it (fix: render in a portal). Filename is not read from `Content-Disposition`. H8 stays *in progress* in §3 until H8a/H8c/H8d are run. |
| H9a | done (written, not run) | 4 of 4 (data shape, link on approval + correction, current-owner queries ignore it, tests) | `LandShield-BD-h9a-20261018.zip` | run: `python -m py_compile` on every touched backend file. **Not run (sandbox has no pytest / fastapi / network): `python -m pytest -q tests/test_chain_of_title.py tests/test_records.py tests/test_lands.py`, migration 0018 up/down, ruff.** | `ownership_history.kind` (CURRENT / HISTORICAL, migration 0018, server default CURRENT); new `services/chain.py` (`record`, `refresh`, `_set_ranges`); `posting.post_document` skips `_update_ownership` for a historical deed and calls `chain.record`; `records.approve_correction` calls `posting.refresh_chain_link` (local import, cycle). Current-owner queries now filter `kind == CURRENT`: `land.current_owners`, `graph`, `pre_purchase`, `my_lands`, `mutation.run_prechecks`, `ownership.is_current`, and the risk `load_land_context` (historical links stay out of INCONSISTENT_OWNERSHIP until H9c loads them). Notes: the link is made even when the sale is FLAGGED (it never changes the owner); `mutation.create_from_posting` still runs for a historical deed (not changed here, review in H9c); `OwnershipEntry` has no `kind` field yet (H9b); `end_date` = start of the next known period, else the deed date (end unknown), null with no deed date. |
| H9b | done (written, not run) | 3 of 3 (API `kind` + `historical`, timeline marker + document link, Documents-tab mark, tests) | `LandShield-BD-h9b-20261018.zip` | run: `check:i18n` (2365 keys), `audit-hardcoded` (clean), `python -m py_compile` on every touched backend file. **Not run (sandbox has no pytest / node_modules / network): `python -m pytest -q tests/test_chain_of_title.py tests/test_lands.py tests/test_library.py`, `npx vitest run features/result features/library`, `npx tsc --noEmit`.** | `OwnershipEntry` gets `kind` (CURRENT/HISTORICAL) + `historical`; `LandDocumentItem` gets `chain_link {start_date, end_date}` (from the historical `ownership_history` row tied to the document's transaction; no names). `OwnershipTimeline` takes `staff`: a HISTORICAL entry shows a "Historical link" badge, never "Current", "From <date> (end not known)" when end = start, else the range; staff get the source document as a link to `/officer/documents/[id]`, citizens plain text. `LandDocuments` shows an "In the chain of title" badge. New `features/result/ownership-timeline.test.tsx` (6) + 3 backend tests in `test_chain_of_title.py`. Note: `ReportView` still renders the timeline without links (public report). |
| H9c | done (rules + tests run) | 4 of 4 (context loader, two rules + config, EN+BN evidence, tests) | `LandShield-BD-h9c-20261018.zip` | run: `python -m pytest -q tests/test_risk_historical.py tests/test_risk_rules_b.py tests/test_chain_of_title.py` (+ the full backend suite, see the plan.md status line), `check:i18n` (2367 keys), `audit-hardcoded`. **Not run (no node_modules): `npx vitest run features/risk`, `npx tsc --noEmit`.** | New `risk/rules/historical_deed.py`, `HistoricalLink` + `LandContext.historical_links` (loaded from `ownership_history` kind HISTORICAL joined to its transaction; rejected sales skipped). **SELLER_NOT_OWNER**: the deed seller matches no CS/SA khatian owner (fuzzy `owner_similarity` ≥ 0.70, honorifics and Bangla spellings allowed) and is not reachable from one through recorded transfers. **CHAIN_GAP**: the seller is anchored to a CS/SA khatian, but the buyer (and whoever they sold to) matches no owner of the *later* CS/SA khatian; nothing later (CS only, or anchored to SA) = no evidence. Params: transaction_id, document_id, transaction_date, surveys / from_survey + to_survey, never a name. RS/BS khatians are left to `SURVEY_CHAIN_GAP`, which can fire on the same parcel (accepted, different question). Also fixed two H9a tests that were wrong when first written (`_land_code` unpack, `_set_ranges` call in `test_current_entries_are_not_marked_historical`). |
| H9d | done (written; rule tests run with stubs, loader test not run) | 4 of 4 (record loader, two rules + config, EN+BN evidence, tests) | `LandShield-BD-h9d-20261018.zip` | run: the 10 pure rule tests (stubbed imports, all pass), `check:i18n` (2369 keys), `audit-hardcoded`, `python -m py_compile`. **Not run (sandbox has no pytest / sqlalchemy / network): `python -m pytest -q tests/test_risk_historical.py tests/test_risk_rules_b.py -k risk`, the full backend suite, `npx vitest run features/risk`, `npx tsc --noEmit`.** | `HistoricalDeedInfo` + `LandContext.historical_deeds` (newest APPROVED lhdr/1 record of each historical deed: dag numbers with Bangla digits folded, (survey, khatian), kind, era, currency, amount, total area in decimal; archaic units give no area, so no price check). **DAG_CONFLICT**: two dated historical deeds on different days share a dag (or the same survey+khatian when one lists no dag) and the later seller is neither the earlier buyer nor reachable from them through recorded transfers (the original seller selling again counts). **CONSIDERATION_IMPLAUSIBLE**: sales only; `reason` CURRENCY_ERA (`ERA_CURRENCIES`) or BELOW/ABOVE_RANGE per decimal (`CONSIDERATION_PER_DECIMAL`, illustrative wide demo ranges). Flag only, 10 points, never blocks. Params: ids, dates, dags, money; no names. Partial sales of one dag can raise a false DAG_CONFLICT (accepted: wording is "possible"). Full-suite run still owed. |
| H9e | done (written, not run; FTS5 queries smoke-tested with plain sqlite3) | 4 of 4 (index LHDR fields, year filter, hits open the document page, tests) | `LandShield-BD-h9e-20261018.zip` | run: `check:i18n` (2378 keys), `audit-hardcoded` (clean), `python -m py_compile` on every touched file, a stubbed run of `_row` on the gold record + FTS5 queries (`রামকান্ত`, `ভবানীপুর`, `455`, `৪৫৫`, `কফিল` all hit with 1940–1950 and miss with 1950–1960). **Not run (no pytest / sqlalchemy / node_modules / network): `python -m pytest -q -k archive` (9 new tests in test_archive.py), the full backend suite, `npx vitest run features/archive` (4 new tests), `npx tsc --noEmit`, Postgres (`TEST_DATABASE_URL`).** | `services/archive.py`: `_records` loads the newest APPROVED lhdr/1 record per document; `_lhdr_facts` collects party names, fathers, mothers, villages, mouza, thana, district, khatian, dag numbers, deed no and the Gregorian year range (`dates.*.gregorian_from/to`, else the flat `deed_date`); they are appended to the indexed body (digits in both Bangla and ASCII) and fill mouza/district/upazila/khatian when no parcel is linked. New columns `year_from`, `year_to`, `historical` (FTS5 UNINDEXED; Postgres `ALTER TABLE … ADD COLUMN IF NOT EXISTS`); an FTS table without them is dropped and rebuilt; the index signature includes the approved record version, so a correction re-indexes. `GET /archive/search` takes `year_from` / `year_to` (1000–2200; both given and reversed = 422 `INVALID_YEARS`); a year overlap test, so undated documents drop out when a year is set. Hits carry `year_from`, `year_to`, `historical`. Frontend: two year inputs with inline errors, Deed year column + Historical tag, Open link to `/officer/documents/[id]` (`archiveHitHref`), EN+BN. Notes: Bangla matching on SQLite is a phrase match over single-letter tokens (unicode61 splits on vowel signs), same as before H9e, so precision is modest; the office-scoped path is a Python scan and gets the same filters; party names are searchable but never returned in a hit. |
| H9f | done (tests run) | 10 of 10 review findings on H6–H9e | branch `h9f-review-fixes` | run: the full backend suite on SQLite (1154 passed, 3 failed: `test_downloads.py::test_who_may_download` and two in `test_public_record.py`, which fail the same way on the H9e import commit), `tests/test_archive.py tests/test_chain_of_title.py tests/test_library.py` on Postgres (`TEST_DATABASE_URL`), `npx vitest run features/archive`, `npx tsc --noEmit`, ruff (no new findings). | **Historical deeds are no modern sale**: `TxRecord.historical` (the tx has a HISTORICAL ownership link); `active_transactions()` leaves them out, so IMPOSSIBLE_DATE / SELLER_MISMATCH / RAPID_RESALE / area / duplicate / ML no longer judge a 1944 deed against today's owners (it was FLAGGED HIGH on any parcel with a later recorded owner); only `survey_chain._reachable` walks them (`include_historical=True`). `posting.post_document` records the chain link **before** `analyze_land` (the H9c/H9d rules now run on the deed being approved) and opens **no mutation case** for a historical deed; `_update_ownership` closes CURRENT periods only (an undated link kept its open end). **Library**: `ensure_doc_access(read=True)` lets the uploader read their own upload (view, file, extraction, versions, history, download), which the library already listed; review actions stay with the holding offices. **Archive**: modern deeds carry the year of their flat `deed_date` (any extractor format, either digit script), so a year filter no longer drops them; the signature reads record versions only and LHDR records are parsed on a rebuild or the office-scoped scan, not on every search; Postgres checks `information_schema` and runs `ALTER TABLE` only for a missing column. **Public verify**: the record body is streamed with a hard 1 MB cap (chunked bodies too) before JSON parsing; bad JSON or shape is still 422. **Frontend**: archive year inputs accept Bangla digits. |
| H10 | done (code + docs); production steps left to you | all code/doc tasks: owed tests, PDF text layer (D7), gate, eval, docs, render.yaml, demo §C | branch `h10-hardening` | run: full backend suite on SQLite with WeasyPrint + PyMuPDF (1160 passed, 11 skipped), `tests/test_deed_pdf.py` 11/11 incl. the real engine, `test_ocr_quality.py` + router + historical (89 passed), full `npx vitest run` (6 failures in never-run H7–H9 tests and copy fixed, then the affected files 79/79), `tsc --noEmit` (app + e2e), `check:i18n`, `audit-hardcoded`, `npm run e2e:historical` and `npm run e2e:library` (pass; run them separately, the second upload of the same deed hits upload dedup), `scripts/pdf_spike.py` (exit 0, winner `weasyprint+layer`), historical eval x3. Full `npx playwright test`: 134 passed, 12 failed, 8 skipped. **Not run:** Postgres (`TEST_DATABASE_URL`), the LLM-on eval, anything on Render. | The 12 e2e failures (`citizen`, `guards`, `session-hint`, `officer`, `visual` admin @1024) are older drift: those specs still expect copy and selectors from before U0.3 / U3.x / U4.5 / U5.4 (`Risk score 0 of 100`, the new not-found and permission copy, a second "Sign in" button in the header). They are not H regressions and were left for their own task. Eval: the Bangla model moves single files by up to 13 points (`ai/tessdata` vs Homebrew `tesseract-lang`), see ocr-accuracy.md. No UI for corrections after approval (API only), noted in historical-deeds.md. WeasyPrint on macOS needs `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`. |

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

The sizes above are for whole phases. H6–H9 are built as 19 one-session cards in the order of §3b.4.

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
| D7 | Which server-side PDF engine for the digital deed? (H8a) | **WeasyPrint for the drawing + an invisible exact PyMuPDF text layer** (H10). Neither WeasyPrint nor fpdf2 alone keeps Bangla text exact; the layered PDF reads back 12/12 in the spike and 49/49 printed values on the sample deed. See H8 in §3. |
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

**Building each phase (Claude sessions).** H0–H5 were built with Opus 5.5 as the default. From H6 on,
every card runs on Sonnet 5.5, one card per session within one 5-hour usage window (§3b). If a card does
not fit, split it in the progress log; do not make the session bigger.

| Phase | Model | Why |
|---|---|---|
| H0 test set + gold JSON | Sonnet 5.5 | Mostly mechanical; you check the Bangla gold values by hand |
| H1 LHDR schema | **Opus 5.5** | Every later phase depends on this design |
| H2 text-layer gate, table OCR | **Opus 5.5** | Tricky Unicode/OpenCV heuristics |
| H3 classifier | Sonnet 5.5 | Small keyword scorer |
| H4 rule parser, LLM, fusion, calendar | **Opus 5.5** (high effort) | Hardest part: Bangla regex, calendar conversion, grounding |
| H5 storage, versions, S3/Postgres, signing | **Opus 5.5** | Data integrity and migrations |
| H6 reviewer form UI (H6a–H6e) | Sonnet 5.5, one card per session (§3b) | Standard React forms on existing components |
| H7 document library (H7a–H7d) | Sonnet 5.5, one card per session | List/detail pages like the existing queue |
| H8 downloads (H8a–H8e) | Sonnet 5.5, one card per session | The PDF engine spike (H8a) and the Bangla round-trip (H8c) were Opus work; they are now separate small cards so Sonnet 5.5 can finish each one |
| H9 chain of title, risk (H9a–H9e) | Sonnet 5.5, one card per session | The ownership rules were Opus work; the chain-of-title design (H9a) now has its own card, and each risk card adds only two rules |
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
