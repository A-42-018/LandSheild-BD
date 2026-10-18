# AI pipeline

Upload → (optional OpenCV preprocessing, `PREPROCESS=on`) → OCR (`OCR_PROVIDER`: mock | tesseract) → field extraction (`DOCUMENT_AI_PROVIDER`: mock | rules) → human review → approval/posting → rule-based risk indicators.
Setup for OCR: see `ocr-setup.md`.

## Pipeline overview

| Stage | Code | Switch | Notes |
|---|---|---|---|
| Preprocess (optional) | `ai/preprocessing/` | `PREPROCESS=on` | OpenCV grayscale, denoise, CLAHE, deskew, autocrop; PDFs rendered with PyMuPDF (max 20 pages) |
| OCR | `ai/ocr/` (`auto`, `mock`, `tesseract`) | `OCR_PROVIDER`, `OCR_PROFILE` | `auto` = demo fixture → PDF text layer if it passes the quality gate → Tesseract with ruled-table cells and missed-line recovery (H2, below); `OCR_PROFILE=auto` (default) re-reads a deed the classifier calls historical with the historical scan profile (H3, below); `paddle` is a known name but not implemented (the API answers 503 `PROVIDER_NOT_AVAILABLE`); Tesseract languages from `TESSERACT_LANG` (`ben+eng`), missing ones are dropped with a warning |
| Deed profile | `ai/extraction/classify.py` | — | modern \| historical, deed kind, era, score from the OCR text; stored in `extraction_json` (H3, below) |
| Extraction | `ai/extraction/` (`mock`, `rules`) | `DOCUMENT_AI_PROVIDER` | `rules` = regex/label patterns over OCR text; `vlm`, `remote` are known names but not implemented (503). Each field gets a confidence |
| Review | `backend/app/services/review.py` | `REVIEW_CONF_THRESHOLD` (0.85) | Fields below the threshold, and not corrected by a human, raise `LOW_EXTRACTION_CONFIDENCE` (INFO, 0 points) |
| Posting | `backend/app/services/posting.py` | approval | Creates deed, transaction and ownership history from the **human-approved** values |
| Risk | `backend/app/risk/` | `ML_SCORING` | Rule evidence → points (cap 100) → level; optional ML hint (below) |

**Human in the loop:** extracted values never reach ownership history or the risk engine until a reviewer approves them.

**Offline / mock fallback:** the defaults (`OCR_PROVIDER=mock`, `DOCUMENT_AI_PROVIDER=mock`) return fixed fixtures from `ai/mock_fixtures.json`, so the whole upload-to-approval flow works with no OCR install, no model and no network. If `OCR_PROVIDER=tesseract` is set but Tesseract is not installed, OCR falls back to the mock with a logged warning. The other unimplemented provider names return 503 rather than falling back.

**Rules and levels:** `POSSIBLE_DUPLICATE_TRANSACTION` 40 · `SELLER_MISMATCH` 30 · `DUPLICATE_DEED` 30 · `INCONSISTENT_OWNERSHIP` 20 · `REPEATED_SUSPICIOUS_TRANSACTIONS` 20 · `AREA_MISMATCH` 15 · `DEED_NO_FORMAT_INVALID` 15 · `RAPID_RESALE` 15 · `SURVEY_CHAIN_GAP` 15 · `IMPOSSIBLE_DATE` 30 · `UNIT_MISMATCH`, `POSSIBLE_NAME_VARIANT`, `LOW_EXTRACTION_CONFIDENCE`, `ML_ANOMALY` are informational (0 points). Levels: LOW < 30, MEDIUM 30-59, HIGH >= 60. Source of truth: `backend/app/risk/config.py`.

**Reproduce the evaluation:** `python ai/evaluation/make_synthetic.py` (documents + ground truth), then `python ai/evaluation/run_eval.py --write-docs` (rewrites only the block between the EVAL markers below).

## Limitations

- All evaluation data is synthetic; numbers do not predict accuracy on real scanned deeds.
- Bangla OCR was measured (F5b, `ben+eng`, Tesseract `tessdata_fast` model) on two synthetic khatian/porcha specimens × 3 variants only: mean CER about 17%, so every Bangla document still needs human review. Synthetic data, not real scans; real scans will be worse.
- Noisy synthetic deeds score about 12% on the rules extractor (8% without preprocessing); Bangla-labelled deeds are the weakest group (see tables).
- The Isolation Forest is trained on synthetic data; its score is a relative anomaly hint, not a probability.
- No learned document-understanding model (`vlm`, `remote`) is implemented.

<!-- EVAL:BEGIN -->

## Evaluation results

- Date: 2026-10-07 (UTC)
- Dataset: 20 synthetic documents × 12 fields = 240 field values
- OCR: Tesseract (`--ocr tesseract`, demo fixtures off), languages used: `ben+eng` (installed: ben, eng)
- Extractor: `--extractor rules` (rule-based)
- A field counts only on exact match (trimmed, case-insensitive)
- **Synthetic documents, not real records.**

### A. Per-field accuracy (Tesseract + rules)

| Field | PREPROCESS off | PREPROCESS on |
|---|---|---|
| deed_no | 35.0% (7/20) | 50.0% (10/20) |
| deed_date | 95.0% (19/20) | 95.0% (19/20) |
| district | 85.0% (17/20) | 95.0% (19/20) |
| upazila | 85.0% (17/20) | 95.0% (19/20) |
| mouza | 70.0% (14/20) | 90.0% (18/20) |
| khatian_no | 80.0% (16/20) | 95.0% (19/20) |
| dag_no | 85.0% (17/20) | 85.0% (17/20) |
| land_area | 85.0% (17/20) | 90.0% (18/20) |
| area_unit | 85.0% (17/20) | 95.0% (19/20) |
| seller | 65.0% (13/20) | 90.0% (18/20) |
| father_name | 40.0% (8/20) | 60.0% (12/20) |
| buyer | 70.0% (14/20) | 85.0% (17/20) |
| **All fields** | **73.3% (176/240)** | **85.4% (205/240)** |

By document variant:

| Variant | off | on |
|---|---|---|
| labels=bn | 53.6% (45/84) | 77.4% (65/84) |
| labels=both | 75.0% (54/72) | 83.3% (60/72) |
| labels=en | 91.7% (77/84) | 95.2% (80/84) |
| noise=low | 84.0% (131/156) | 89.7% (140/156) |
| noise=yes | 53.6% (45/84) | 77.4% (65/84) |
| skew=!=0 | 68.9% (124/180) | 84.4% (152/180) |
| skew=0 | 86.7% (52/60) | 88.3% (53/60) |

Per document (correct fields of 12):

| Doc | off | on |
|---|---|---|
| eval01.png | 11 | 12 |
| eval02.png | 5 | 10 |
| eval03.png | 7 | 10 |
| eval04.png | 12 | 12 |
| eval05.png | 6 | 9 |
| eval06.png | 10 | 10 |
| eval07.png | 11 | 11 |
| eval08.png | 11 | 12 |
| eval09.png | 10 | 10 |
| eval10.png | 12 | 11 |
| eval11.png | 3 | 6 |
| eval12.png | 10 | 10 |
| eval13.png | 10 | 11 |
| eval14.png | 8 | 11 |
| eval15.png | 8 | 10 |
| eval16.png | 11 | 11 |
| eval17.png | 4 | 9 |
| eval18.png | 9 | 10 |
| eval19.png | 10 | 12 |
| eval20.png | 8 | 8 |

### C. Bangla khatian / porcha specimens (F5a) — CER and parsed fields

Specimens: `Khatian_RS.png`, `Porcha_BS.png` (synthetic Bangla, shaped by headless Chrome). CER = Levenshtein distance / reference length over whitespace-normalised text; the parsed-field check compares the F5a parser output on the OCR text with the specimen's known values (khatian no, mouza, survey type, owner names, dag numbers). A document needs review when any word has confidence < 0.85.

PREPROCESS off:

| Specimen | Variant | CER | Fields correct | Mean word conf | Words < threshold |
|---|---|---|---|---|---|
| Khatian_RS | clean | 25.3% | 4/5 | 0.92 | 4/56 |
| Khatian_RS | noisy | 25.6% | 4/5 | 0.92 | 5/56 |
| Khatian_RS | skewed | 28.8% | 2/5 | 0.91 | 8/56 |
| Porcha_BS | clean | 14.9% | 4/5 | 0.89 | 6/46 |
| Porcha_BS | noisy | 14.9% | 5/5 | 0.90 | 5/46 |
| Porcha_BS | skewed | 21.2% | 4/5 | 0.90 | 8/46 |

**Mean CER 21.8%** · parsed fields 76.7% (23/30) · review rate 100.0% (6/6)

PREPROCESS on:

| Specimen | Variant | CER | Fields correct | Mean word conf | Words < threshold |
|---|---|---|---|---|---|
| Khatian_RS | clean | 25.3% | 4/5 | 0.92 | 5/56 |
| Khatian_RS | noisy | 32.3% | 5/5 | 0.89 | 9/53 |
| Khatian_RS | skewed | 25.3% | 4/5 | 0.92 | 4/56 |
| Porcha_BS | clean | 15.4% | 4/5 | 0.89 | 6/46 |
| Porcha_BS | noisy | 16.2% | 5/5 | 0.90 | 8/46 |
| Porcha_BS | skewed | 14.9% | 5/5 | 0.91 | 6/46 |

**Mean CER 21.6%** · parsed fields 90.0% (27/30) · review rate 100.0% (6/6)


### B. Rule engine precision / recall (seeded R7 scenarios)

| Land | Expected codes | Got | Match |
|---|---|---|---|
| LP-10001 | — | — | yes |
| LP-10100 | — | — | yes |
| LP-10234 | — | — | yes |
| LP-10240 | POSSIBLE_DUPLICATE_TRANSACTION, SELLER_MISMATCH | POSSIBLE_DUPLICATE_TRANSACTION, SELLER_MISMATCH | yes |
| LP-10300 | — | — | yes |
| LP-10400 | — | — | yes |
| LP-10500 | DUPLICATE_DEED | DUPLICATE_DEED | yes |

| Code | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|
| DUPLICATE_DEED | 1 | 0 | 0 | 1.00 | 1.00 |
| POSSIBLE_DUPLICATE_TRANSACTION | 1 | 0 | 0 | 1.00 | 1.00 |
| SELLER_MISMATCH | 1 | 0 | 0 | 1.00 | 1.00 |
| **Overall** | 3 | 0 | 0 | **1.00** | **1.00** |

Scenarios that need uploaded documents (LP-10234 after Doc2, LP-10300, LP-10400) are covered by `backend/tests/integration/test_demo_flow.py`; on the seed alone they expect no codes.

Reproduce: `python ai/evaluation/run_eval.py --write-docs`

<!-- EVAL:END -->

## Khatian / porcha parser (F5a)

`ai/extraction/khatian.py` reads a record of rights (khatian / porcha) in Bangla or English labels. The rule provider picks it by the text itself (a khatian heading, an owner-share section and a dag line, and no seller/purchaser as in a sale deed), so the uploaded document type does not matter; `PORCHA` was added next to `KHATIAN` for uploads and filters.

| Read | Stored as |
|---|---|
| khatian no., district, upazila, mouza | the usual R4 fields |
| survey type `CS` / `SA` / `RS` / `BS` from the "Survey:" line (None when absent or ambiguous, e.g. "CS/SA") | `extraction_json.survey_type` |
| JL no., owners with father and share (`1/2`, `0.5` → `1/2`), dags with area and unit, whether the shares add up to 1 | `extraction_json.extras` |
| owner name + father, dag no. + area + unit | R4 fields **only when there is exactly one owner / one dag**; with several the reviewer picks, the lists stay in `extras` |

Nothing is guessed: a missing, unreadable or ambiguous value is simply absent. Two synthetic specimens with mock ground truth: `database/sample_data/Khatian_RS.png` (2 owners, 2 dags) and `Porcha_BS.png` (1 owner, 1 dag); regenerate with `python ai/evaluation/make_khatian_samples.py` (uses headless Chrome so Bangla is shaped correctly, Pillow without Raqm would garble it). Tests: `backend/tests/test_khatian.py`. **Not measured:** real Tesseract on these pages (see F5b), and the parser is tuned on these synthetic layouts only; real CS/SA/RS/BS pages vary a lot.

## Fuzzy owner-name matching (P43)

`backend/app/services/names.py` (rapidfuzz). Names are normalised (NFC, Bangla digits to ASCII,
punctuation, honorifics such as Md./Mohammad/মোঃ/আলহাজ, Bengali romanised to Latin for comparison
only, casefolded) and compared with `token_sort_ratio` (0..1). A name whose tokens are a subset of
the other (`Rahim` / `Rahim Uddin`) scores at least 0.75.

| Threshold | Value | Effect |
|---|---|---|
| `VARIANT_MIN` | 0.70 | name similarity at/above this with no father_name conflict = possible name variant |
| `MERGE_MIN` | 0.90 | owner records auto-merge only if name AND father_name both score at/above this and both father names exist |

* `SELLER_MISMATCH` becomes `POSSIBLE_NAME_VARIANT` (INFO, 0 points, review required) when the
  seller resembles a recorded owner at the transaction date; different people (e.g. Rahim / Karim,
  similarity 0.60) or conflicting father names stay a hard HIGH mismatch.
* Approval posting treats a variant as unconfirmed: the transaction and deed are `FLAGGED` and
  ownership is not changed until a human resolves it. No alert is created (0 points).
* Thresholds are heuristic, not calibrated on real data. Romanisation is rough
  (`রহিম` becomes `rohim`, similarity 0.80 with `Rahim`). Similar names are never treated as the
  same person without a supporting identifier.

## Anomaly model: Isolation Forest (P48)

`ai/fraud_detection/`: features (R3), seeded synthetic generator, scikit-learn IsolationForest, `score(features) -> 0..1`. Not yet wired into the risk engine (P49).

<!-- ML:BEGIN -->
Measured on a **held-out synthetic split** (seed 2026, 2000 rows,
200 injected anomalies). Model trained on 5000 synthetic rows
(5% injected anomalies, seed 2025), `IsolationForest(n_estimators=200)`.
Flag threshold = training 95% quantile of the scaled score
= 0.219.

| Metric | Value |
|---|---|
| Precision | 0.974 |
| Recall | 0.935 |
| F1 | 0.954 |
| ROC AUC | 0.998 |
| False positives / negatives | 5 / 13 |

| Injected anomaly type | Rows | Recall |
|---|---|---|
| rapid_flip | 34 | 1.00 |
| area_mismatch | 34 | 0.76 |
| seller_mismatch | 33 | 0.85 |
| duplicate_deed | 33 | 1.00 |
| doc_mismatch | 33 | 1.00 |
| combined | 33 | 1.00 |

Reproduce: `python -m ai.fraud_detection.train --write-docs` (artifact: `models/iforest.joblib`).

These numbers describe how well the model finds anomalies **that this generator injected**. The
generator and the model share the same assumptions, so they say nothing about real land records.
Not a fraud detector; the score is a review hint only.
<!-- ML:END -->

## ML in the risk engine (P49)

The Isolation Forest score is an optional, additive hint on top of the rule engine
(`backend/app/risk/{ml,scoring,assess}.py`). It never decides a level on its own.

- **Features:** one row per non-rejected transaction, built from the parcel context (the 8 R3
  features). `document_similarity` has no parcel-level source yet and is held at the neutral value
  1.0; `ownership_duration` falls back to a neutral 3000 days when the seller's holding period is
  unknown. A parcel without transactions is not scored (`ml_score` = null).
- **Parcel score:** the highest score over its transactions.
- **Points:** 0 at score <= 0.25, rising linearly to +15 at 1.0 (`ML_MIN_SCORE`, `ML_MAX_POINTS` in
  `app/risk/config.py`). The raw score is not a probability.
- **HIGH guard:** if the rule-only level is below HIGH, the total is held at 59, so ML can never
  create HIGH by itself. ML never lowers a score. Rule-HIGH parcels stay HIGH.
- **Evidence:** `ML_ANOMALY` (INFO) with `{score, points}` only when ML adds points; INFO evidence
  never creates an alert. `risk_assessments.ml_score` stores the raw score.
- **Skipped silently (one warning log per process):** `ML_SCORING=off`, scikit-learn not installed,
  model file missing/unreadable, or no transactions. Rules-only results are then unchanged.
- **Review flag:** `LOW_EXTRACTION_CONFIDENCE` (INFO, 0 points) when a document still awaiting
  review has a required field below `REVIEW_CONF_THRESHOLD` and not corrected by a human.

Seed demo parcels (levels are identical with ML on and off; scores measured in this sandbox):

| Parcel | Rules only | With ML | ML score |
|---|---|---|---|
| LP-10240 | HIGH 70 | HIGH 70 | 0.207 (below 0.25, +0) |
| LP-10500 | MEDIUM 30 | MEDIUM 34 | 0.468 (+4) |
| LP-10100 | LOW 0 | LOW 0 | 0.120 (+0) |
| LP-10001 / 10234 / 10300 / 10400 | LOW 0 | LOW 0 | not scored (no transactions) |

Synthetic-model caveat from P48 applies: these scores compare a parcel against the synthetic
training distribution only.

<!-- HIST-EVAL:BEGIN -->

### Historical deeds (H0 baseline)

- Pipeline today: OCR `--ocr tesseract` (PDF text layer, else Tesseract; demo fixtures off) + the generic rule extractor
- Set: `database/sample_data/historical/` — 12 files, gold LHDR per file (`*.gold.json`)
- A value counts only on exact match after normalising Bangla digits, spaces and units
- Core 13 = the fields LandShield uses today; a field with no value on the deed (e.g. area in kani) is not counted
- **Synthetic deeds except the two real samples (`Historical_Land_Deed*.pdf`).**

| File | Variant | Pages | OCR | Core 13 correct | Missed core fields |
|---|---|---|---|---|---|
| Historical_Land_Deed.pdf | typed | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| Historical_Land_Deed.png | render | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| Historical_Land_Deed_scan.jpg | scanned | 1 | tesseract | 0/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_no, deed_date, seller, buyer |
| Historical_Land_Deed_Sample.pdf | typed | 2 | tesseract | 3/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, deed_date, seller, buyer |
| hd02_gift_1938.png | typed | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| hd03_sale_rupee_1962.pdf | typed | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| hd03_sale_rupee_1962.png | render | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| hd03_sale_rupee_1962_scan.jpg | scanned | 1 | tesseract | 0/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_no, deed_date, seller, buyer |
| hd04_multiplot_1958.png | typed | 1 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |
| hd05_archaic_units_1931.png | typed | 1 | tesseract | 1/12 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, area_unit, deed_date, seller, buyer |
| hd05_archaic_units_1931_scan.jpg | scanned | 1 | tesseract | 0/12 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, area_unit, deed_no, deed_date, seller, buyer |
| hd06_mortgage_2page_1965.pdf | typed | 2 | tesseract | 1/13 | owner_name, father_name, khatian_no, dag_no, mouza, district, upazila, land_area, area_unit, deed_date, seller, buyer |

**Core 13 overall: 7.1% (11/154)**

- typed + render: 9.5% (11/116)
- scanned: 0.0% (0/38)

Accuracy per LHDR section (all gold values; only core fields are extracted today):

| Section | Correct |
|---|---|
| A. Document | 0.0% (0/52) |
| B. Registration | 24.3% (9/37) |
| C. Dates | 0.0% (0/96) |
| D. Parties | 0.0% (0/279) |
| E. Consideration | 0.0% (0/55) |
| F. Schedule | 0.8% (2/236) |
| G. Title recital | 0.0% (0/35) |
| H. Execution | 0.0% (0/96) |
| I. Modern mapping | 0.0% (0/24) |
| J. Core 13 | 7.1% (11/154) |
| **All values** | **2.1% (22/1064)** |

Reproduce: `python ai/evaluation/run_eval.py --set historical`

<!-- HIST-EVAL:END -->

### Historical deed format (LHDR v1, H1)

The digital format of a historical deed is `ai/extraction/lhdr.py` (Pydantic models for roadmap §2,
sections A–J); its JSON Schema is `docs/lhdr-v1.schema.json`.

- **Field:** every leaf is `{value, verbatim, confidence, source {page, bbox}, method, legibility,
  edited_by_human}`. A bare value is shorthand for `{"value": …}`; the gold files use it, and
  `lhdr.plain(record)` turns a record back into it.
- **Shape vs content:** the models reject unknown keys, wrong types and unknown enum values.
  `lhdr.check(record)` returns content `Issue`s `(path, code, severity, message)`, so a half-read
  machine record still loads:
  - errors (required): `MISSING_DEED_REF` (deed no or volume), `MISSING_EXECUTION_DATE`,
    `NO_SELLER` / `NO_BUYER` (a partition / exchange needs 2 co-sharers instead), `NO_COMPLETE_PLOT`
    (mouza + khatian or dag + area)
  - errors (format): `AREA_NOT_POSITIVE`, `UNKNOWN_UNIT` (modern or archaic: kani, ganda, kora…),
    `DATE_IN_FUTURE`, `DATE_RANGE_REVERSED`, `BAD_DAY`, `NOT_NUMERIC` (khatian, dag, JL, deed no),
    `AMOUNT_NOT_POSITIVE`
  - warnings: `ERA_MISMATCH` (era vs execution date), `CORE_MISMATCH` (stored `core` ≠ derived)
- **Core 13:** `ai/extraction/derive.py` fills the 13 fields from the record (first transferring
  party, first plot, first dag; deed_date = middle of the Gregorian range, only when known to the day).
  `derive_fields()` returns `ExtractedField`s with the source Field's confidence and bbox; a machine
  value without a stated confidence gets 0.
- **Check:** `python -m ai.extraction.lhdr check database/sample_data/historical/*.gold.json` (all 7
  gold files: no issues, derived core = gold `core`). After changing a model, regenerate the schema
  with `python -m ai.extraction.lhdr schema`; `backend/tests/test_lhdr.py` fails if it is stale.

### OCR input quality (H2)

The sample deed failed first of all at the input: its PDF text layer had damaged Bangla and was
trusted at 0.99, and page OCR turned the schedule table into noise. H2 fixes the input, not the
extractor.

- **Text-layer gate** (`ai/ocr/quality.py`): `assess(text)` multiplies three 0..1 signals:
  - invalid Bangla mark sequences per Bangla character (vowel sign at word start or after another
    vowel sign, doubled `া`/`ং`/`ঃ`…): up to 0.5 % is free, 2 % scores 0. Measured: Tesseract output
    ≤ 0.4 %, the four Chrome-printed historical PDFs 2.5–3.2 %
  - dictionary: deed words with conjuncts (`বিক্রেতা`, `পশ্চিম`, `ধর্ম`…) found intact versus only as
    their "skeleton" with the conjuncts dropped (`বিেতা`, `পিম`, `ধম`), the exact damage pattern
  - junk: `U+FFFD`, private-use glyphs, control characters

  Threshold 0.8. All four historical PDF layers score 0.0; every modern demo fixture and every
  Tesseract reading of a typed deed scores 1.0.
- **Router** (`ai/ocr/router.py`): demo → text layer if it passes (confidence 0.99 × score, tables
  from PyMuPDF's table finder) → Tesseract. When a layer fails, both are scored and the better kept:
  Tesseract with warning `TEXT_LAYER_REJECTED`, or the layer with `TEXT_LAYER_SUSPECT` (also when
  Tesseract is missing or returns < 50 characters). Both warnings show on the review screen.
- **Tables** (`ai/ocr/table.py`): ruling lines by morphological opening (kernels longer than a
  word's headline), a group with ≥ 3 horizontal and ≥ 3 vertical lines is a table (page border and
  stamp box are not), cells per row band with `colspan`/`rowspan`; a faint line the ink mask misses
  is still seen as a darker ridge in the grayscale. Tables are painted out before the page pass and
  each cell is read alone (psm 6, `ben`-only re-read when Latin letters/digits appear: `0.80` →
  `০.৪০`). `OCRResult.tables` keeps `(row, col, colspan, rowspan, text, confidence, bbox)`; the
  text gets the table as `header: value` lines in reading order (`মৌজা: ভবানীপুর`).
- **Missed-line recovery** (`tesseract.py`): Tesseract 5.5 returns nothing for some clean lines at
  one text size (the sample's `ইসলাম, জাতীয়তা- …` reads at 0.7× and 1.5×, not at 1×) while the page
  confidence stays high. Ink rows with no word are re-read as strips (1.5×, then 0.7×, max 10 per
  page); a strip no scale reads is cut at its middle word gap and the halves are read (one segment,
  `উত্তরে- নিতাই` on hd04, made Tesseract drop the whole line).
- **Historical profile** (`OCR_PROFILE=historical`, `ai/preprocessing/historical.py`; with
  `OCR_PROFILE=auto` H3 chooses it per document): colour render, red seals and stamps removed by colour, background flattening
  (yellowing, blotches, shadow → white), faint watermark faded out (levels, white point 215), deskew;
  phone photos get perspective correction when a page outline is found. Left out after measuring:
  median denoise, upscaling, the red channel as grayscale, and 300 dpi PDF renders (all lowered the
  found values, e.g. sample deed 33 → 29 of 37 at 300 dpi).
- **Effect on today's rule extractor (unchanged):** core 13 on the set 7.1 % → 40.9 %, sample deed
  1/13 → 7/13 (`run_eval.py --set historical --ocr auto`), only from the table lines. `upazila`
  (`থানা`) and the parties need H4's parser.

<!-- HIST-OCR:BEGIN -->

### Historical deeds: input quality (H2)

Share of the gold values (Bangla text and numbers that are printed on the page) found verbatim in the
OCR text, i.e. what any extractor could at best read. Independent of the extractor.

- **before**: pre-H2 router (text layer trusted at >= 50 characters; Tesseract without tables / line recovery)
- **modern**, **historical**: H2 router (checked text layer, table cells, missed-line recovery) with `OCR_PROFILE`

| File | Variant | before | modern | historical | Source (modern) | Tables |
|---|---|---|---|---|---|---|
| Historical_Land_Deed.pdf | typed | 28/39 | 35/39 | 35/39 | tesseract (TEXT_LAYER_REJECTED) | 1 |
| Historical_Land_Deed.png | render | 30/39 | 35/39 | 33/39 | tesseract | 1 |
| Historical_Land_Deed_scan.jpg | scanned | 15/39 | 16/39 | 33/39 | tesseract | 1 |
| Historical_Land_Deed_Sample.pdf | typed | 30/46 | 29/46 | 29/46 | tesseract (TEXT_LAYER_REJECTED) | 1 |
| hd02_gift_1938.png | typed | 25/36 | 30/36 | 30/36 | tesseract | 1 |
| hd03_sale_rupee_1962.pdf | typed | 32/43 | 34/43 | 34/43 | tesseract (TEXT_LAYER_REJECTED) | 1 |
| hd03_sale_rupee_1962.png | render | 21/43 | 34/43 | 37/43 | tesseract | 1 |
| hd03_sale_rupee_1962_scan.jpg | scanned | 9/43 | 20/43 | 31/43 | tesseract | 1 |
| hd04_multiplot_1958.png | typed | 33/61 | 55/61 | 55/61 | tesseract | 1 |
| hd05_archaic_units_1931.png | typed | 27/45 | 33/45 | 32/45 | tesseract | 1 |
| hd05_archaic_units_1931_scan.jpg | scanned | 22/45 | 26/45 | 32/45 | tesseract | 1 |
| hd06_mortgage_2page_1965.pdf | typed | 40/55 | 41/55 | 42/55 | tesseract (TEXT_LAYER_REJECTED) | 1 |

**All files:** before 58.4% (312/534) · modern 72.7% (388/534) · historical 79.2% (423/534)
**Scanned only:** before 36.2% (46/127) · modern 48.8% (62/127) · historical 75.6% (96/127)

Reproduce: `python ai/evaluation/run_eval.py --set historical --input-quality`

<!-- HIST-OCR:END -->

### Deed profile detection (H3)

D1 = "just DEED": the upload form and `document_type` do not change. After OCR, every deed (not a
khatian / porcha) is classified by `ai/extraction/classify.py`, and the verdict is stored in
`extraction_json` (no enum migration) and returned by `GET /documents/{id}/extraction`:

```json
"deed_profile": "historical", "ocr_profile": "historical",
"deed_class": {"deed_profile": "historical", "deed_kind": "SALE_SAF_KABALA", "era": "BRITISH_INDIA",
               "score": 0.999, "year": 1931, "signals": [{"code": "PARGANA", "weight": 2.0, "evidence": "পরগণা"}, …]}
```

**How it decides.** Weighted cues, each counted once; historical at ≥ 4 points
(`score` = logistic of points − 4, so ≥ 0.5 means historical). Modern deeds use most
"old-fashioned" words too (the 2001 saf-kabala test text has `শ্রী`, `সাং`, `দাতা/গ্রহীতা`,
`তফসিল`, `সি.এস` and a Bangla date), so those are weak. The deed year and the truly archaic words decide:

| Signal | Points |
|---|---|
| all dated years ≤ 1971 (`PRE_1971_YEAR`) | +4 |
| `কস্য`, `মিদং` (the old opening formula), `রুপি`, `পাকিস্তান`, `জাতীয়তা … ভারতীয়` / `ব্রিটিশ`, `পরগণা`, number + archaic unit (`কানি`, `গণ্ডা`, `কড়া`, `ক্রান্তি` …; not `ছটাক`, still used with `কাঠা`) | +2 each |
| `তপশিল` spelling, `বঙ্গাব্দ` / `সন ১৩xx`, number + `আনা`, CS khatian with no RS/BS survey | +1 each |
| `সাং-`, `জনাব` / `শ্রী` / `শ্রীমতি` (not inside `শ্রীপুর`), `দাতা` / `গ্রহীতা`, `বাঙ্গালী` | +0.5 each |
| a year ≥ 1972 and none older (`POST_1971_YEAR`) | −6 |
| `জাতীয় পরিচয়` / NID · `বাংলাদেশ` · both old and new years (`MIXED_YEARS`) · RS/BS survey | −3 · −2 · −2 · −1 |

- **Years:** a bare 4-digit number is not a year (dag, deed and amount numbers). Gregorian years
  need a date cue (month name, `dd/mm/`, `/` after a deed number, `তারিখ`, `সাল`/`ইং`/`খ্রি`);
  Bangla years 1100–1450 need `বঙ্গাব্দ`/`সন`/`সাল` or a Bangla month, and convert +593
  (+594 in মাঘ–চৈত্র). Future years are dropped. `MIXED_YEARS` covers a modern deed reciting an old
  one (leans modern) and a recent certified copy of an old deed (the vocabulary wins; the year
  reported is then the old one).
- **Era:** from the year (1947 itself needs a cue); a `পাকিস্তান` cue beats a pre-1947 year (a
  misread digit: hd03 PNG reads `১৩৩৯` for `১৩৬৯`); no year → the nationality cue, else `null`.
  Modern deeds are `BANGLADESH`.
- **Deed kind:** the earliest title match wins (`রেহেন`, `হেবা`, `দানপত্র`, `বণ্টননামা`, `এওয়াজ`,
  `ওয়াকফ`, `আমমোক্তারনামা`, `বায়না`, `কবলা`/`বিক্রয়`), so a sale deed's "not mortgaged" clause or a
  recited gift deed does not change it; nothing found → `OTHER`.
- **Tables:** cell texts of `OCRResult.tables` are scanned too.

**OCR wiring.** `OCR_PROFILE=auto` (new default; `modern` / `historical` still force one): Tesseract
reads with the modern profile, the classifier runs on that text, and a historical verdict triggers a
second read with the historical scan profile, which is returned (warning `HISTORICAL_PROFILE`,
`OCRResult.profile` / `extraction_json.ocr_profile` = `historical`). Demo fixtures and accepted PDF
text layers are never re-read. Cost: one extra Tesseract pass for historical deeds only.

**Results (2026-10-18).** All 12 files of the H0 manifest are historical on both the modern and the
historical reading (24/24), with the manifest's deed kind and, where an era is given, the gold era;
the 5 readings where no year could be read (the 3 scans on the modern profile, 2 sample-deed
readings on the historical one) are found by vocabulary alone (score ≥ 0.91). All 11
modern samples in `database/sample_data` (Tesseract reading and demo-fixture text) and the
saf-kabala / khatian / porcha test OCR texts are modern (score ≤ 0.07). Because every H0 file is
detected on its first reading, `auto` gives the historical column above (79.2 % of gold values,
scans 75.6 %) while modern documents keep the modern reading. Tests: `backend/tests/test_classify.py`
(the Tesseract-backed done-criteria test is skipped where Tesseract is missing).

**Reviewer's switch.** When detection is wrong, the review screen shows the profile ("Deed type:
Historical deed · detected automatically") with a "Read again as a modern / historical deed" button.
It calls `POST /documents/{id}/reprocess` with `{"profile": "modern" | "historical"}` (no body =
detect again, as before). The job then reads with that Tesseract profile instead of `OCR_PROFILE`
(no classifier re-read) and stores `deed_profile` = the chosen profile, `profile_overridden: true`;
`deed_class` keeps the classifier's own verdict and `ocr_profile` the profile Tesseract actually
used (`null` when a demo fixture or an accepted PDF text layer was used, which no profile changes).
Like any reprocess it discards manual edits; the audit trail records the chosen profile
(`DOCUMENT_REPROCESS_REQUEST`, `DOCUMENT_EXTRACTED`). Khatian / porcha have no profile: a
`profile` for them is refused with 422 `PROFILE_NOT_APPLICABLE`. Tests:
`backend/tests/test_profile_switch.py`, `frontend/features/review/deed-profile.test.tsx`.

H4 will use `deed_profile` to pick the historical parser.

### Historical deed extraction (H4)

A deed whose `deed_profile` is `historical` (detected, or forced by the reviewer's switch) no longer goes
to the generic extractor: the job calls `HistoricalDeedProvider` (`ai/extraction/historical_deed.py`),
which returns an LHDR v1 record plus the 13 core fields derived from it (`derive.py`), so review,
approval, posting, risk and search keep working unchanged. Modern deeds, khatian / porcha and demo
fixtures take the old path. The record is stored in `extraction_json.record` (`record_schema:
"lhdr/1"`) and returned by `GET /documents/{id}/extraction`; versions and LHDR edits are H5 (below).

**Rule parser (no API key needed).** The OCR text and the H2 cell grid are cut into header,
১ম / ২য় পক্ষ, body, তপশিল and signature row; each part has its own parser:

| Part | What is read |
|---|---|
| header | `দলিল নং` (verbatim `৪৭৮২/খ` + normalised `4782/খ`), execution date, sub-registry office, `বহি নং …, জিল্দ …` |
| parties | role from the heading word or the deed kind (sale / gift / mortgage / POA / waqf / partition / exchange); `HONORIFIC NAME, পিতা- [মৃত] X, মাতা- …, সাং- …, থানা- …, জেলা- …, পেশা- …, ধর্ম- …, জাতীয়তা- …`; side-by-side parties (the second real sample) from the word boxes |
| body | consideration `১,৫০০/- (এক হাজার পাঁচশত) টাকা` + payment mode; how the seller holds the land; চিরস্থায়ী / রেহেন; নিষ্কণ্টক |
| তপশিল | the grid: a header row names the columns, label rows (`জমির পরিমাণ`), full-width `চৌহদ্দি` rows; else `label: value` lines; পরগণা, জে.এল. |
| signature row | seller's mark; witnesses and deed writer (+ licence) by column from the word boxes |

`ai/extraction/bangla.py` holds the value parsers: Bangla number words (1–99 are a table; শত / হাজার /
লক্ষ / কোটি multiply), Bangla-calendar dates (before the 1987 reform a range of ±1 day from the
traditional month starts; after it the exact 1987 / 2019 calendars), money, area (modern units with a
decimal equivalent; archaic `কানি / গণ্ডা / কড়া …` kept as parts, no decimal claimed because the
kani differs by district), boundaries. `ai/extraction/gazetteer.py` maps the historical thana +
district to today's division / district / upazila (land_offices.json + the old districts and the
city thanas that are not upazilas today; an ambiguous name such as কালীগঞ্জ without a district gives
nothing).

Clean-up is normalisation, never invention; the value as read stays in `verbatim`: closed vocabularies
snap when one entry is clearly closest (religion, nationality, land class, mark, month names, number
words), place names snap to the gazetteer, a place printed several times takes the spelling most of
its readings share (`রাপগঞ্জ` in the table, `রূপগঞ্জ` in both addresses), figure vs words of an amount
or area → the words win (`৯৫০০/- (এক হাজার পাঁচশত)` = 1500), a leading `৯` that makes a Bangla year
impossible is `১` (with a note), Latin `8` among Bangla digits is `৪`. Confidence = mean OCR word
confidence of the value's words × the pattern strength (lower for snapped or partly unreadable values).

**Vision LLM (`submit_lhdr`).** With Claude configured (`DOCUMENT_AI_PROVIDER=auto|claude` and a key),
`ClaudeDocumentAIProvider.extract_lhdr` sends every page image (≤ 5, PDFs rendered so a broken text layer
never reaches the model) plus the OCR text, with a glossary of archaic terms and the rules
"verbatim + normalised, null if unsure, legibility". The strict tool schema is in
`ai/extraction/claude_lhdr.py`; computed values (Gregorian range, era, currency, modern place, core) are
not asked for. Request shape (roadmap §7 fix, also applied to `submit_fields`): `tool_choice: auto` with the
prompt naming the tool and `strict: true`, no `temperature`, `output_config.effort: medium` where the model
takes it, streaming for the large answer, a `refusal` stop reason handled as a fallback, and on the
first-party API `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`; not sent through a
gateway). Default model `claude-sonnet-5-5`. Same per-file cache and daily cap; any failure → the rule
record alone, warning `CLAUDE_FALLBACK:<reason>`.

**Fusion (`ai/extraction/fuse.py`).** Lists are aligned by content (parties by role + name, plots by dag /
khatian / mouza). Both agree → method `fused`, confidence 1 − (1 − a)(1 − b). They disagree → the
better-grounded reading is the value, the other a `candidate`, flag `DISAGREE`, confidence × 0.7.
Only the LLM read it → checked against the OCR text (fuzzy ≥ 85, exact token for numbers): found ×
0.9, not found × 0.6 + flag `NOT_IN_TEXT`. Values that are not printed (codes, computed dates) are only
agreed, not grounded. `Field.candidates` / `Field.flags` are new in the LHDR schema for this.

Tests: `backend/tests/test_historical_deed.py` (parsers, gazetteer, rule parser on the sample deed's OCR
text, grid with several plots, tool answer → record, strict schema, fusion, request shape with a fake
streaming client, job stores the record; the Tesseract end-to-end test is skipped without Tesseract).
Eval below; the LLM-on run needs a key and is not recorded yet.

<!-- HIST-LHDR:BEGIN -->

### Historical deeds: H4 extractor (LHDR)

- Extractor: `ai/extraction/historical_deed.py`, rules only (no API key); OCR `--ocr auto`, profile `auto`
- Every gold value counts (all LHDR sections, not only the 13 core fields), exact match after normalising
  Bangla digits, spaces and units; a value the deed does not print is not in the gold
- **Synthetic deeds except the two real samples (`Historical_Land_Deed*.pdf`).**

| File | Variant | OCR | Extractor | All values | Core 13 |
|---|---|---|---|---|---|
| Historical_Land_Deed.pdf | typed | tesseract | rules | 96.2% (77/80) | 13/13 |
| Historical_Land_Deed.png | render | tesseract | rules | 95.0% (76/80) | 13/13 |
| Historical_Land_Deed_scan.jpg | scanned | tesseract | rules | 88.8% (71/80) | 12/13 |
| Historical_Land_Deed_Sample.pdf | typed | tesseract | rules | 64.4% (56/87) | 10/13 |
| hd02_gift_1938.png | typed | tesseract | rules | 90.1% (73/81) | 13/13 |
| hd03_sale_rupee_1962.pdf | typed | tesseract | rules | 89.5% (77/86) | 13/13 |
| hd03_sale_rupee_1962.png | render | tesseract | rules | 89.5% (77/86) | 12/13 |
| hd03_sale_rupee_1962_scan.jpg | scanned | tesseract | rules | 87.2% (75/86) | 13/13 |
| hd04_multiplot_1958.png | typed | tesseract | rules | 96.6% (113/117) | 13/13 |
| hd05_archaic_units_1931.png | typed | tesseract | rules | 77.0% (67/87) | 10/12 |
| hd05_archaic_units_1931_scan.jpg | scanned | tesseract | rules | 58.6% (51/87) | 4/12 |
| hd06_mortgage_2page_1965.pdf | typed | tesseract | rules | 79.4% (85/107) | 11/13 |

**All values: 84.4% (898/1064)** · typed + render 86.4% (701/811) · scanned 77.9% (197/253)
**Core 13: 89.0% (137/154)**

| Section | Correct |
|---|---|
| A. Document | 100.0% (52/52) |
| B. Registration | 94.6% (35/37) |
| C. Dates | 74.0% (71/96) |
| D. Parties | 88.2% (246/279) |
| E. Consideration | 96.4% (53/55) |
| F. Schedule | 82.6% (195/236) |
| G. Title recital | 71.4% (25/35) |
| H. Execution | 64.6% (62/96) |
| I. Modern mapping | 91.7% (22/24) |
| J. Core 13 | 89.0% (137/154) |

Targets (roadmap H4, with the LLM on): >= 90 % on typed samples, >= 75 % on scanned variants.

Reproduce: `python ai/evaluation/run_eval.py --set historical --lhdr --profile auto`

<!-- HIST-LHDR:END -->

### Digital record: edits, versions, keeping (H5)

**The record is the source of truth.** For a document with an LHDR record the 13 fields are always
derived from it (`derive.py`); `derive.core_paths()` tells which record value each one comes from.
`PATCH /documents/{id}/extraction` takes `record` ops and/or the flat `fields`:

```jsonc
{"record": [
   {"op": "replace", "path": "/schedule/0/boundaries/north", "value": "খাল"},
   {"op": "replace", "path": "/registration/deed_no/verbatim", "value": "৪৭৮২/খ"},
   {"op": "add",     "path": "/execution/witnesses/-", "value": {"role": "WITNESS", "name": "আব্দুল হক"}},
   {"op": "remove",  "path": "/parties/2"}],
 "fields": [{"field": "khatian_no", "value": "121"}]}
```

`ai/extraction/lhdr_patch.py` applies them: JSON pointers (RFC 6901) checked against the LHDR models,
missing objects created on the way, `-` appends; a path at a `Field` (or `/value`) edits the value,
`/verbatim` and `/legibility` those; machine metadata (confidence, source, method, candidates) and
`/schema`, `/core` are refused (`PATH_NOT_EDITABLE`). Every touched value gets `method: human,
edited_by_human: true`; a value edit clears the H4 review flags. Flat field edits become record ops
(`core_ops`): `khatian_no` → `/schedule/0/khatian_no`, `seller` → the first seller's name (a party is
added when there is none), `deed_date` → the execution date's Gregorian range and precision `day`
(the verbatim Bangla date stays). Record ops run first, then the flat fields; the request is all or
nothing. Errors: 422 `RECORD_PATCH_FAILED` (`details[0]`: `index`, `path`, `code`: `INVALID_PATH`,
`PATH_NOT_EDITABLE`, `NOT_FOUND`, `NOT_A_LIST`, `RECORD_INVALID`, `VALUE_TOO_LARGE`, `LIST_TOO_LONG`,
`NO_RECORD_TARGET`), 422 `RECORD_VALIDATION_FAILED` when an edit adds a format error (`NOT_NUMERIC`,
`AREA_NOT_POSITIVE`, …) at a path it touched, 422 `RECORD_NOT_AVAILABLE` for record ops on a document
without a record. `GET /extraction` adds `record_validation` (H1 `check()`: errors block approval,
warnings inform), `file_hash`, `version` and `version_status`. `core` (section J) is derived again on
every save. Values the land records corrected in the job (record_assist) are written into the record
too, flagged `MATCHED_TO_RECORDS`.

**Versions (`document_records`, migration 0017).** Rows are never deleted.

| Status | Made by | Changes? |
|---|---|---|
| MACHINE | the extraction job (every run) | never |
| DRAFT | the first reviewer edit; later edits update it | until approved |
| APPROVED | approval (the DRAFT itself, or a new version after an unedited MACHINE one) | never (frozen) |
| SUPERSEDED | an APPROVED version replaced by an approved correction; MACHINE / DRAFT discarded by reprocess | never |

`record_json` is the LHDR record (`lhdr/1`) or, for modern deeds and khatian / porcha, `core/1` (the 13
fields with confidence + bbox, survey type, khatian extras). Freezing sets `approved_by`, `approved_at`
(whole seconds), `record_hash` = SHA-256 over canonical JSON of `{v, document_id, file_hash, version,
schema, approved_by, approved_at, record}` and `signature` = Ed25519 over the hash with the deed key
(`signing.py`, `SIGNING_KEY`). `signature_status` is checked on every read: VALID only when the stored
record still hashes to `record_hash` and the signature verifies, so changing one byte gives INVALID.
Approval needs a record without errors (422 `RECORD_INVALID`) and links the posted deed:
`deeds.record_id` (approved version) and `deeds.is_historical`. A historical deed's written places
(থানা রূপগঞ্জ, জেলা ঢাকা) may lie in another office's district today; the office check also accepts
the record's computed modern mapping (Narayanganj / Rupganj).

**Corrections after approval** never overwrite: `POST /documents/{id}/records` opens DRAFT v(n+1) as a
copy of the approved version (the open one if it exists: 200), `PATCH /documents/{id}/records/{n}`
takes the same body as the extraction PATCH, `POST /documents/{id}/records/{n}/approve` freezes it
(four-eyes: not by whoever opened the correction, ADMIN exempt; 409 `RECORD_UNCHANGED` without a
change), marks the old APPROVED version SUPERSEDED (still readable and verifiable), points the deed at
the new version and copies the corrected record into the working copy (GET extraction, archive
search). Ownership, deeds and the ledger stay as posted (D2). A document approved before H5 gets its
working copy saved as a signed baseline v1 (no approver) when the first correction opens.
`GET /documents/{id}/records` lists the versions (no record body), `GET …/records/{n}` returns one
with its record.

**The original file is kept.** Uploads are never overwritten or deleted after the upload transaction
(a failed upload removes its file only when no document points to it). Every `GET /documents/{id}/file`
re-hashes the bytes against `documents.file_hash` (500 `DOCUMENT_FILE_CORRUPT` instead of serving a
changed file) and sends the hash as `X-File-SHA256`; the extraction and every version show it too.

**Production storage (D6).** `STORAGE_BACKEND=s3` keeps files in a private S3-compatible bucket
(`S3Storage`, boto3, `pip install -e ".[s3]"`; keys `documents/<sha256>.<ext>`, an existing key is
never written again); `DATABASE_URL=postgres(ql)://…` uses psycopg 3 (`.[postgres]`, `pool_pre_ping`).
Archive search gets a Postgres path (`archive_index`, `tsvector` + GIN, rebuilt like the FTS5 table;
Bangla digits indexed as ASCII). Postgres connections use UTC (`-c timezone=UTC`), and a value Postgres
cannot store (a NUL character in text) is a 422 `INVALID_INPUT`, not a 500. The Docker start seeds with `SEED_MODE=auto`: reset on SQLite, only an
empty database on Postgres. Setup: `docs/deploy-render.md`.

Tests: `backend/tests/test_records.py` (API: profile + record + versions, nested PATCH, add / remove,
flat write-through, refused ops, approval freeze + signature, one changed byte → INVALID, record errors
block approval, reprocess, corrections + four-eyes + ownership untouched, legacy baseline, original
file after approval and correction, changed original refused), `test_lhdr_patch.py` (the engine),
`test_storage_backends.py` (S3 with a fake client, settings, URLs, seed modes, migration 0017 up / down /
up on SQLite and on Postgres when `TEST_DATABASE_URL` is set). With `TEST_DATABASE_URL=postgresql://…`
every test using the shared `env` fixture runs on Postgres (CI job `.github/workflows/backend.yml`).
