# AI pipeline

Upload → (optional OpenCV preprocessing, `PREPROCESS=on`) → OCR (`OCR_PROVIDER`: mock | tesseract) → field extraction (`DOCUMENT_AI_PROVIDER`: mock | rules) → human review → approval/posting → rule-based risk indicators.
Setup for OCR: see `ocr-setup.md`.

## Pipeline overview

| Stage | Code | Switch | Notes |
|---|---|---|---|
| Preprocess (optional) | `ai/preprocessing/` | `PREPROCESS=on` | OpenCV grayscale, denoise, CLAHE, deskew, autocrop; PDFs rendered with PyMuPDF (max 20 pages) |
| OCR | `ai/ocr/` (`mock`, `tesseract`) | `OCR_PROVIDER` | `paddle` is a known name but not implemented (the API answers 503 `PROVIDER_NOT_AVAILABLE`); Tesseract languages from `TESSERACT_LANG` (`ben+eng`), missing ones are dropped with a warning |
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
