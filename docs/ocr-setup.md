# OCR setup (Tesseract)

```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr tesseract-ocr-ben tesseract-ocr-eng
# macOS
brew install tesseract tesseract-lang
# Python side (optional extra: opencv, numpy, pymupdf, pytesseract)
cd backend && pip install -e .[dev,ai]
```

Verify: `tesseract --list-langs` should list `ben` and `eng`.

Defaults (`.env`; the site works with no API key):

```text
OCR_PROVIDER=auto           # demo fixture -> pdf-text -> Tesseract. tesseract | mock (tests) also exist
DEMO_FIXTURES=on            # saved demo samples return their stored result ("Demo sample"); off = real OCR
TESSERACT_LANG=ben+eng      # languages not installed are dropped (logged)
PREPROCESS=on               # OpenCV clean-up before Tesseract
OCR_TIMEOUT_S=30            # per page -> OCR_TIMEOUT (504)
OCR_MAX_PAGES=5             # more pages: first N read + warning PAGES_TRUNCATED
```

- Result: text, per-word boxes (original image coordinates) and confidence; `documents.ocr_text` and `documents.ocr_confidence` (mean word confidence, 0..1) are stored. The extraction JSON records `ocr_source` (`demo` / `pdf-text` / `tesseract`), `extractor` (`rules` / `claude`), `model` and `warnings`.
- Without the Tesseract binary an upload that is not a demo sample ends `FAILED` with `failure_code=OCR_UNAVAILABLE` (verify-document answers 503). There is no fallback to the mock. If none of the requested languages is installed: `TESSERACT_LANG_MISSING`.
- Docker/Render: the image downloads the standard `tessdata` (`tesseract-ocr/tessdata`, branch `main`) `ben` + `eng` into the Tesseract data directory (`tessdata_best` was about 2x slower on the free CPU, see `Dockerfile`).
- Tests force `OCR_PROVIDER=mock` / `DOCUMENT_AI_PROVIDER=mock`; they need neither Tesseract nor the network.

## Optional: Claude field reader

```bash
cd backend && pip install -e ".[llm]"      # anthropic SDK (lazy import: the app boots without it)
```

Set `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`, `CLAUDE_DAILY_CAP`, `CLAUDE_TIMEOUT_S`) and keep `DOCUMENT_AI_PROVIDER=auto`.
Remove the key and the app is back on the rules, no code change. Cache and daily counter live in `<STORAGE_PATH>/claude_cache/`.
Page image and OCR text are sent to Anthropic only while a key is set.

## Measuring Bangla accuracy (F5b)

```bash
# Option A: install the language data system-wide (macOS: brew install tesseract tesseract-lang)
# Option B: project-local (git-ignored) data, no sudo
mkdir -p ai/tessdata && cp "$(brew --prefix)/share/tessdata/eng.traineddata" ai/tessdata/
curl -L -o ai/tessdata/ben.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/ben.traineddata
export TESSDATA_PREFIX="$PWD/ai/tessdata"
cd backend && pip install -e ".[dev,ai]" && cd ..
PYTHONPATH=. backend/.venv/bin/python ai/evaluation/run_eval.py --write-docs   # updates docs/ai-pipeline.md
```

The run reports per-field accuracy on 20 synthetic deeds (A), Bangla specimen CER, parsed khatian
fields and review rate with preprocessing off/on (C), and rule precision/recall (B).
