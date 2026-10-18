# OCR accuracy (O4)

Measured, not estimated. Reproduce: `PYTHONPATH=. python ai/evaluation/run_eval.py --ocr tesseract --extractor rules`
(needs Tesseract with `ben` + `eng`; full report in [ai-pipeline.md](ai-pipeline.md#evaluation-results)).

## Method

- **Data**: 20 synthetic deed images (`ai/evaluation/data`, 12 fields each = 240 values; variants: English / Bangla / both labels, Bangla digits, 0-2.5 degree skew, noise) and 2 synthetic Bangla specimens (khatian RS, porcha BS) in clean / noisy / skewed versions. **All fictional.**
- **Pipeline under test**: the real one - `AutoOCRProvider` internals (Tesseract `ben+eng`, psm 6 -> 4 -> upscale retry, OpenCV clean-up when `PREPROCESS=on`) + the rule-based extractor. **Demo fixtures are never used** (`DEMO_FIXTURES=off` equivalent): the engine reads the pixels.
- **Metric**: a field counts only on an exact match (trimmed, case-insensitive). CER = Levenshtein distance / reference length on the Bangla specimens (whitespace-normalised); the synthetic deeds have no full reference text, so CER is not reported for them.
- Tesseract 5 (Homebrew), `ben` = `tessdata_fast` in this run; the Docker image uses `tessdata_best`, which is expected to be equal or better but **was not measured**.

## Results (2026-10-07)

| Set | PREPROCESS off | PREPROCESS on (default) |
|---|---|---|
| 20 synthetic deeds, all 12 fields | **73.3 %** (176/240) | **85.4 %** (205/240) |
| - English labels | 91.7 % (77/84) | 95.2 % (80/84) |
| - Bangla + English labels | 75.0 % (54/72) | 83.3 % (60/72) |
| - Bangla labels | 53.6 % (45/84) | 77.4 % (65/84) |
| Bangla specimens: mean CER (6 images) | 21.8 % | 21.6 % |
| Bangla specimens: parsed khatian fields | 76.7 % (23/30) | 90.0 % (27/30) |
| Bangla specimens: documents sent to review | 100 % (6/6) | 100 % (6/6) |

Weakest fields (PREPROCESS on): `deed_no` 50 % (letters/hyphens such as `D-2023-0277` are misread), `father_name` 60 %; all others 85-95 % - see the per-field table in ai-pipeline.md.

Before the O track (2026-10-06, same data, same machine): 38.8 % off / **60.0 %** on; Bangla CER 17.1 % / 17.2 %. The gain on deeds comes from psm 6, text normalisation and extra label variants. **CER on the Bangla specimens got slightly worse (17.2 % -> 21.6 %)**; the parsed-field rate is unchanged (90 %). It was not tuned further.

### Claude extractor

**Not measured.** No `ANTHROPIC_API_KEY` was available for this work, so `--extractor claude` has only been exercised with a fake client in `backend/tests/test_claude_extractor.py` (parsing, validation, cache, fallback, cap). With a key: `ANTHROPIC_API_KEY=... python ai/evaluation/run_eval.py --extractor claude` adds the same table for Tesseract + Claude. Do not quote a Claude accuracy number until that run exists.

## Historical deeds (H10)

The mentor's sample deed and 11 more historical files (`database/sample_data/historical/`: the two real
sample PDFs, a render and three scans, five synthetic deeds with fictional people; 1064 gold values, 154 of
them core fields). Every gold value is scored, in every LHDR section, on an exact match after normalising Bangla
digits, spaces and units. Full tables per file and section: [ai-pipeline.md](ai-pipeline.md) (H0 baseline, H2
input quality, H4 extractor).

| | Before (H0, 2026-10-18) | After (H10, 2026-10-18), rules only, no API key |
|---|---|---|
| Pipeline | PDF text layer or Tesseract + the generic 13-field rules | H2 router (text-layer gate, table cells, historical profile) + H4 LHDR rule parser |
| Sample deed (`Historical_Land_Deed.pdf`), core 13 | **1/13** | **13/13** (all values 96.2 %, 77/80) |
| All values, 12 files | **2.1 %** (22/1064) | **85.9 %** (914/1064) · with the other Bangla model 84.4 % (898/1064) |
| typed + render | — | 87.4 % (709/811) · 86.4 % |
| scanned | — | 81.0 % (205/253) · 77.9 % |
| Core 13 | **7.1 %** (11/154) | **85.7 %** (132/154) · 89.0 % (137/154) |

| Section (all values) | Before | After |
|---|---|---|
| A. Document | 0.0 % | 98.1 % |
| B. Registration | 24.3 % | 91.9 % |
| C. Dates | 0.0 % | 76.0 % |
| D. Parties | 0.0 % | 93.9 % |
| E. Consideration | 0.0 % | 94.5 % |
| F. Schedule | 0.8 % | 83.9 % |
| G. Title recital | 0.0 % | 80.0 % |
| H. Execution | 0.0 % | 62.5 % |
| I. Modern mapping | 0.0 % | 100.0 % |

- **The Bangla model changes single files by up to 13 points.** The "After" column used `ai/tessdata/ben.traineddata`
  (11 MB, sha256 `1cd01292…`). The second figure is Homebrew's `tesseract-lang` 4.1.0 `ben` (sha256
  `31163084…`), which is what H4's recorded run used (identical numbers). Neither is proven to be the
  file the Docker image downloads (standard `tessdata`, branch `main`). The totals move by 1.5 points, but single files
  swing: the sample's PNG render 82.5 % vs 95.0 %, its scan 96.2 % vs 88.8 %.
- Two runs in a row gave identical numbers. The H10 text-layer gate change does not move them (checked with
  the new signal switched off).
- **Targets** (roadmap H4, *with the LLM on*): ≥ 90 % on typed samples, ≥ 75 % on scans. Rules alone
  reach the scan target and are below the typed one. Weakest: section H (witnesses, deed writer, stamps
  from the signature row), the second real sample (62.1 %, side-by-side parties) and the scanned archaic-unit
  deed (64.4 %).
- **LLM on: not measured.** It needs the API key, so run it yourself:
  `env -u ANTHROPIC_BASE_URL PYTHONPATH=. python ai/evaluation/run_eval.py --set historical --lhdr --profile auto --extractor claude`
  (reads `backend/.env`; about 12 Claude calls), then add its row here.
- **Downloaded digital deeds read back exactly** (H8 round trip, `backend/tests/test_deed_pdf.py`): every value
  printed in our own PDF, 49 of 49 on the sample, comes back unchanged through the H2 router from the PDF's text
  layer (decision D7: WeasyPrint draws, an invisible exact text layer is laid over it).

Reproduce (Tesseract with `ben` + `eng`, about 2 minutes):
`TESSDATA_PREFIX=$PWD/ai/tessdata PYTHONPATH=. python ai/evaluation/run_eval.py --set historical --lhdr --profile auto`;
the "Before" column is the H0 run recorded in ai-pipeline.md (branch `h0-ground-truth`); `--set historical` without `--lhdr` on today's code is not that baseline.

## Known limits and failures

- **Stamps, seals and handwriting** over printed text are read badly or not at all; handwritten deeds are out of scope.
- **Low-resolution photos** (narrow, blurred, perspective-skewed): only 0-2.5 degree skew and mild noise were tested. Strong perspective, shadows and folded pages were not.
- **Noisy Bangla-label deeds** are the weakest class; every field Tesseract is unsure of lands in the review queue (confidence < 0.85), so errors become reviewer work, not silent mistakes.
- Multi-page PDFs: only the first `OCR_MAX_PAGES` (5) pages are read (`PAGES_TRUNCATED`); field extraction merges nothing across pages beyond concatenated text.
- Real-looking deeds beyond the synthetic set (the 3-5 fictional deeds of card O4) were **not** added; the numbers are for synthetic documents only and will be lower on real scans.
- The evaluation set is small (20 + 6 images): one document changes a field rate by 5 points.
