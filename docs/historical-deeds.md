# Historical land deeds in LandShield

How LandShield reads, keeps and hands out old (pre-1971, also pre-1947) Bangla land deeds.
For reviewers, officers and anyone who checks a printed digital deed. The build history is in
[historical-deed-roadmap.md](historical-deed-roadmap.md). Pipeline internals and measurements are in
[ai-pipeline.md](ai-pipeline.md) and [ocr-accuracy.md](ocr-accuracy.md).

Contents: 1. What happens to an uploaded deed · 2. The digital format (LHDR v1) · 3. Glossary ·
4. Reviewer guide · 5. Document library · 6. Downloads · 7. Checking a printed or downloaded deed ·
8. Limits

---

## 1. What happens to an uploaded deed

1. **Upload.** The officer uploads the deed as an ordinary `DEED`, with no special upload option (decision D1). The
   file is stored once and never changed or deleted. Its SHA-256 is stored with it and checked again on every read.
2. **Reading.** The OCR router uses the PDF's text layer only when it passes the quality gate. A layer
   with lost conjuncts or stray glyph codes is rejected, and the page is read with Tesseract instead
   (ruled tables cell by cell).
3. **Detection.** A keyword classifier decides between `modern` and `historical` and guesses the deed kind and era.
   A deed detected as historical is read again with the historical scan profile.
4. **Extraction.** The rule parser fills a **LHDR record** (section 2). With an API key, Claude reads the
   page images too, and the two readings are fused (decision D3). Nothing is guessed: a value the deed does not show stays empty.
5. **Review.** A reviewer corrects the record in the digital deed form (section 4) and approves it
   (four-eyes rule: the uploader cannot approve their own upload).
6. **Approval** freezes the record as a signed version (SHA-256 + Ed25519). For a historical deed it also adds a
   **past link to the land's chain of title**. The current owner does not change (decision D2).
7. **Afterwards** the deed is in the document library, on the land's Documents section, in archive
   search (party names, mouza, khatian, dag, year range) and can be downloaded (sections 5–6).

## 2. The digital format (LHDR v1)

One JSON document per deed, `"schema": "lhdr/1"`. Models: `ai/extraction/lhdr.py`. JSON Schema:
[lhdr-v1.schema.json](lhdr-v1.schema.json). Example: the gold file
`database/sample_data/historical/Historical_Land_Deed.gold.json` (roadmap §2.2).

**Every value is a Field:**

| Key | Meaning |
|---|---|
| `value` | the normalised value the system uses (`4782/খ`, `1500`, `0.5`) |
| `verbatim` | exactly as written on the deed, never corrected (`৪৭৮২/খ`) |
| `confidence` | 0..1 |
| `source` | `{page, bbox}`: where on the page it was read (click in the form to highlight it) |
| `method` | `text-layer` · `ocr+rules` · `llm` · `fused` · `human` |
| `legibility` | `clear` · `faded` · `damaged` · `illegible` |
| `edited_by_human` | true once a reviewer changed it |
| `candidates`, `flags` | the other reading and `DISAGREE` / `NOT_IN_TEXT` when rules and Claude differ |

**Sections:**

| | Section | Holds |
|---|---|---|
| A | Document | kind (sale, gift, partition, exchange, mortgage, waqf, POA, bainanama), era, languages, pages |
| B | Registration | deed no (verbatim + normalised), volume / book, pages, sub-registry office, year |
| C | Dates | execution and registration date, each `{verbatim, calendar, day, month, year, gregorian_from, gregorian_to, precision}` |
| D | Parties | role, honorific, name, father / husband (+ deceased), mother, address, profession, religion, nationality, share |
| E | Consideration | amount, in words, currency as written, currency of the era (INR < 1948, PKR 1948–71, BDT), payment mode |
| F | Schedule | per plot: district, thana, pargana, mouza, JL, survey (CS/SA/RS/BS/Diara), khatian, dag(s), area `{value, unit, in_words, decimal_equiv}`, land class, boundaries N/S/E/W |
| G | Title recital | how the seller holds the land, nature of transfer, free of encumbrance |
| H | Execution | seller's mark (signature / thumb-print), witnesses, deed writer + licence, stamps, seals |
| I | Modern mapping | computed: the historical thana / district → today's district and upazila (`ঢাকা`, 1944 → Narayanganj, Rupganj) |
| J | Core 13 | derived: seller, buyer, owner, father, khatian, dag, mouza, district, upazila, area, unit, deed no, deed date |

**Rules that matter when reading a record:**
- **Dates before the 1987 calendar reform are a range** (`precision: "day±1"`), never one invented day.
  `deed_date` in the core 13 is only filled when the day is known.
- **Archaic area units** (`কানি`, `গণ্ডা`, `কড়া`) are kept as parts with no decimal equivalent, because the kani
  differed by district.
- **Both the written and the modern place** are kept. Risk checks and the office check use the modern one.
- **Required for approval:** a deed no or volume, the execution date as written, at least one seller and one buyer
  (two co-sharers for a partition or exchange), and one plot with mouza + (khatian or dag) + area.
  Check a file by hand: `python -m ai.extraction.lhdr check <file.json>`.

## 3. Glossary

| Word on the deed | Meaning | Where it goes |
|---|---|---|
| সাফ কবলা | outright sale deed | A kind `SALE_SAF_KABALA` |
| হেবা, দানপত্র | gift deed | A kind `GIFT_HEBA`, `GIFT_DANPATRA` |
| বণ্টননামা | partition deed between co-sharers | A kind `PARTITION_BANTONNAMA` |
| এওয়াজ | exchange deed | A kind `EXCHANGE_EWAZ` |
| রেহেন | mortgage | A kind `MORTGAGE_REHEN` |
| আমমোক্তারনামা | power of attorney | A kind `POWER_OF_ATTORNEY` |
| বায়নানামা | agreement to sell | A kind `AGREEMENT_BAINANAMA` |
| বালাম, বহি নং, জিল্দ | registration volume / book | B volume |
| বঙ্গাব্দ, সন | Bangla calendar year | C calendar `bangla` |
| দাতা / গ্রহীতা | giver / receiver (old word for seller / buyer, donor / donee) | D role |
| বিক্রেতা / ক্রেতা | seller / buyer | D role |
| জনাব, শ্রী, শ্রীমতি, বেগম, মোসাম্মৎ | honorifics | D honorific |
| মৃত, মরহুম, স্বর্গীয় | deceased (before the father's name) | D father.deceased |
| সাং | village (সাকিন) | D address.village |
| সনাক্তকারী | identifier of a party at registration | D role `IDENTIFIER` |
| টাকা, রুপি | currency as written | E currency_written |
| এককালীন নগদ | paid at once in cash | E mode |
| তপশিল (তফসিল) | the schedule of land | F |
| পরগণা, জে.এল. নং | old revenue division, jurisdiction list no | F pargana, jl_no |
| সি.এস / এস.এ / আর.এস / বি.এস | cadastral / state acquisition / revisional / Bangladesh survey | F survey |
| খতিয়ান, দাগ | record-of-rights no, plot no | F khatian_no, dag_no |
| শালী, নাল, ভিটা, বাড়ি, পুকুর, ডাঙ্গা, চালা | land classes (paddy land, homestead, pond, high land…) | F land_class |
| চৌহদ্দি | boundaries (north, south, east, west) | F boundaries |
| স্বত্ব দখলীয় | held by title and possession | G basis |
| চিরস্থায়ী | permanent transfer | G nature |
| নিষ্কণ্টক | free of encumbrance | G encumbrance_free |
| টিপসই | thumb-print | H seller_mark |
| দলিল লেখক | licensed deed writer | H deed_writer |
| নন-জুডিশিয়াল / রাজস্ব স্ট্যাম্প | non-judicial / revenue stamp | H stamps |

## 4. Reviewer guide

Open the deed from **Review queue** or **My documents → Needs my action**. The original is on the left and the digital
deed on the right.

1. **Check the deed type** at the top of the extraction panel: "Historical deed — detected automatically".
   If it is wrong, use **Read again as a modern deed** (or the other way round). The document is read again and
   manual edits are discarded, so switch before editing.
2. **Go section by section** (Registration · Dates · Parties · Consideration · Schedule · Boundaries · Title
   recital · Execution and attestation). Each value shows:
   - the value the system uses, with **As written** underneath when the deed's own text differs
   - a confidence badge (High / Medium / Low) and the legibility when it is not clear (Faded, Damaged, Illegible)
   - **Not read** when nothing was found. Fill it in only from the page; do not guess.
3. **Click a value** to highlight where it was read on the page. Press **Esc** to clear the highlight.
4. **Edit** a value with **Edit → Save**. A number field accepts only numbers. Edited values are marked
   "edited", and every edit is written to the audit log.
5. **Lists:** **Add party**, **Add plot**, **Add dag no.**, **Add witness**, **Add stamp**, **Add seal**, and
   **Remove** (asks first).
6. **Two readings:** "Two readings differ" means rules and Claude disagree. Compare both with the page and
   pick **Use this reading** if the other one is right. "Not found in the OCR text" means Claude read
   something the OCR did not see. Look at the page before trusting it.
7. **Dates:** keep the date as written, the calendar and the day, month and year. Fill the Gregorian range only if
   you know it. The system computes it for Bangla-calendar dates.
8. **Buyer's NID:** approval needs the buyer's NID and date of birth in the NID card (when
   `OWNER_NID_REQUIRED` is on). Only the last 4 digits are ever printed.
9. **Approve** (key **A**), **Reject** with a reason (key **R**) or go to the **Next** document (key **N**). The keys
   also work with a Bangla keyboard layout.

On approval the record becomes version *n* APPROVED: hashed, signed and frozen. A later correction does not
overwrite it. It is a new version: `POST /api/v1/documents/{id}/records`, edit it with
`PATCH …/records/{n}`, then `POST …/records/{n}/approve` by someone other than the corrector (four-eyes
again). **There is no button for this yet; it is API only.** The old version is kept as SUPERSEDED, and
the chain-of-title link is updated, not duplicated.

**What approval does to the land:** a historical deed adds a past link (seller → buyer, with the date range)
to the land's ownership history, shown as **Historical link** on the land page. It never replaces the current
owner. The historical risk rules (seller ≠ khatian owner, chain gap, dag conflicts, implausible
consideration for the era) run on approval and show on the land's risk report.

## 5. Document library

**My documents** (`/officer/documents`) has three tabs:

| Tab | Shows |
|---|---|
| My uploads | everything you uploaded, whatever its status |
| My office | documents of your office and the offices below it (same scope as the queue) |
| Needs my action | what you can review now |

Filters cover status, type, historical / modern, division / district / upazila and upload date range. Search matches deed no, mouza, party name and land id.
A "Historical" tag and "digitised yes / no" are on every row. The officer home has a "Recently uploaded by me" card.

The **document page** (`/officer/documents/{id}`) shows the original file on the left and the digital deed
on the right. It also has a version picker (v1 machine → reviewed → approved…), the version history from the audit log,
the SHA-256 of the original file and of the record, and the signature state (**Signature valid ✓**,
**Signature does not match**, **Not signed yet**). While the document is still being reviewed, the page says so and links to the
review screen.

Each land's page has a staff-only **Documents** section with every deed of the land in date order, with the historical
chain link marked.

## 6. Downloads

The **Download** menu on the document page and on each library row:

| Download | What you get |
|---|---|
| Digital deed (PDF) | the deed section by section in Bangla, with English labels. The footer has the deed no, version, approval date, approving officer, the SHA-256 of the record and of the original file, the Ed25519 signature and a **QR code to the public check page** |
| Digital deed (JSON) | the LHDR record (`lhdr/1`) with its hash and signature, for machines and long-term archiving |
| Original upload | the exact uploaded file. Its SHA-256 is sent in the `X-File-SHA256` header |
| Complete bundle (ZIP) | original + PDF + JSON + `manifest.json` (hashes, signature, version history) |

- A version that is not approved yet downloads as **DRAFT – NOT APPROVED**, on every PDF page, with no QR code.
- Downloads follow the same rules as viewing (uploader, office scope, reviewers, admins), are rate-limited and
  are written to the audit log (who, what, which version).
- NIDs are printed as the last 4 digits only.
- **The PDF's text is exact** (decision D7, H10). WeasyPrint draws the page, but its own Bangla text
  layer is not exact: conjuncts and the pre-base vowel sign come out as stray glyph codes. So the drawn
  text is hidden from text extraction, and an invisible copy of every line, in the right character order, is laid over it.
  Copy-paste, search and a second pass through LandShield give back the same Bangla. A test guards this:
  every printed value is read back unchanged.
- The server needs WeasyPrint + Pango + PyMuPDF (`pip install -e "./backend[pdf]"`, already in the Docker
  image). Without them the PDF answers 503 "The PDF cannot be made on this server right now"; JSON and
  the original still work.

## 7. Checking a printed or downloaded deed

- **Printed PDF:** scan the QR code. It opens `/{locale}/v/r/{record id}`, the public **Digital deed check**
  page. It says **Valid** when the stored record still matches its signature, and shows only the deed no,
  version and approval date (no names or plots). It also says when a newer approved version exists.
- **JSON file:** `POST /api/v1/public/records/verify` with the downloaded JSON as the body. The answer is VALID only
  if the file is byte-for-byte what the server signed. One changed character gives INVALID.
- **Original file:** compare its SHA-256 (`shasum -a 256 file.pdf`) with the hash printed in the PDF footer
  and in the bundle manifest.
- The public key for checking signatures yourself: `GET /api/v1/public/keys`.

## 8. Limits

- **Printed and typed deeds only** (decision D4). Handwritten deeds are best effort, and only with Claude on.
- **Accuracy** (rules only, no API key; 12 files, 1064 values): see [ocr-accuracy.md](ocr-accuracy.md#historical-deeds-h10).
  Every machine value still goes through a reviewer.
- **Calendar conversion before 1987 is approximate:** always a range, with the verbatim text kept.
- **Old place names** map to today's district and upazila only when the name is unique. Ambiguous names stay
  unmapped for the reviewer.
- **Production storage:** uploads and digital records survive a redeploy only when the managed Postgres + object storage
  of decision D6 are configured ([deploy-render.md](deploy-render.md)). On the free disk alone they are lost on every restart.
- All test deeds are synthetic, with fictional people, except the two sample PDFs given by the mentor (decision D5).
