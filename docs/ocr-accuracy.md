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

## Known limits and failures

- **Stamps, seals and handwriting** over printed text are read badly or not at all; handwritten deeds are out of scope.
- **Low-resolution photos** (narrow, blurred, perspective-skewed): only 0-2.5 degree skew and mild noise were tested. Strong perspective, shadows and folded pages were not.
- **Noisy Bangla-label deeds** are the weakest class; every field Tesseract is unsure of lands in the review queue (confidence < 0.85), so errors become reviewer work, not silent mistakes.
- Multi-page PDFs: only the first `OCR_MAX_PAGES` (5) pages are read (`PAGES_TRUNCATED`); field extraction merges nothing across pages beyond concatenated text.
- Real-looking deeds beyond the synthetic set (the 3-5 fictional deeds of card O4) were **not** added; the numbers are for synthetic documents only and will be lower on real scans.
- The evaluation set is small (20 + 6 images): one document changes a field rate by 5 points.
