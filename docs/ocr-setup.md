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

Enable in `.env`:

```text
OCR_PROVIDER=tesseract
TESSERACT_LANG=ben+eng      # languages not installed are dropped (logged)
PREPROCESS=on               # optional OpenCV preprocessing before OCR
```

- Result: text, per-word boxes and confidence; `documents.ocr_text` and `documents.ocr_confidence` (mean word confidence, 0..1) are stored.
- If Tesseract/pytesseract is missing the app logs `ocr_fallback_to_mock` and uses the mock provider. If none of the requested languages is installed, the document ends `FAILED` with code `TESSERACT_LANG_MISSING`.
- Field extraction from the OCR text arrives with the rules extractor (P40); until then `DOCUMENT_AI_PROVIDER` stays `mock`.

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
