# Backend image with real OCR (Tesseract + tessdata_best Bangla/English). Build context = repo root.
# Default engine = Tesseract + rules, no API key needed. Claude is optional: set ANTHROPIC_API_KEY.
FROM python:3.12-slim

# tessdata_best (LSTM, more accurate than the apt "fast" models) replaces the distro ben/eng data
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr curl ca-certificates libglib2.0-0 \
 && TD="$(ls -d /usr/share/tesseract-ocr/*/tessdata | head -1)" \
 && for l in ben eng; do \
      curl -fsSL -o "$TD/$l.traineddata" "https://github.com/tesseract-ocr/tessdata_best/raw/main/$l.traineddata"; \
    done \
 && apt-get purge -y --auto-remove curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend ./backend
COPY ai ./ai
COPY database ./database
COPY scripts ./scripts
COPY models ./models

# scikit-learn is left out on purpose (heavy for a free instance): run with ML_SCORING=off
RUN pip install --no-cache-dir -e "./backend[llm]" \
 && pip install --no-cache-dir opencv-python-headless numpy pymupdf pytesseract pillow

ENV PYTHONPATH=/app:/app/backend OCR_PROVIDER=auto DOCUMENT_AI_PROVIDER=auto DEMO_FIXTURES=on \
    TESSERACT_LANG=ben+eng ML_SCORING=off PREPROCESS=on STORAGE_PATH=/app/storage DATABASE_URL=sqlite:////app/landshield.db

WORKDIR /app/backend
EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && python ../scripts/seed.py --reset && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
