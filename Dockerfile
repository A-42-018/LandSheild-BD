# Backend image with real OCR (Tesseract + Bangla/English data). Build context = repo root.
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ben tesseract-ocr-eng libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend ./backend
COPY ai ./ai
COPY database ./database
COPY scripts ./scripts
COPY models ./models

# scikit-learn is left out on purpose (heavy for a free instance): run with ML_SCORING=off
RUN pip install --no-cache-dir -e ./backend \
 && pip install --no-cache-dir opencv-python-headless numpy pymupdf pytesseract pillow

ENV PYTHONPATH=/app:/app/backend OCR_PROVIDER=tesseract DOCUMENT_AI_PROVIDER=rules TESSERACT_LANG=ben+eng \
    ML_SCORING=off PREPROCESS=off STORAGE_PATH=/app/storage DATABASE_URL=sqlite:////app/landshield.db

WORKDIR /app/backend
EXPOSE 10000
CMD ["sh", "-c", "alembic upgrade head && python ../scripts/seed.py --reset && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
