# Backend image with real OCR (Tesseract + standard tessdata Bangla/English). Build context = repo root.
# Default engine = Tesseract + rules, no API key needed. Claude is optional: set ANTHROPIC_API_KEY.
FROM python:3.12-slim

# Standard tessdata (LSTM, integer) replaces the distro ben/eng data. tessdata_best was ~2x slower and,
# on the free 0.1-CPU instance, pushed one page past OCR_TIMEOUT_S. With ANTHROPIC_API_KEY set, Claude reads the page image itself.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr curl ca-certificates libglib2.0-0 \
 && TD="$(ls -d /usr/share/tesseract-ocr/*/tessdata | head -1)" \
 && for l in ben eng; do \
      curl -fsSL -o "$TD/$l.traineddata" "https://github.com/tesseract-ocr/tessdata/raw/main/$l.traineddata"; \
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
RUN pip install --no-cache-dir -e "./backend[llm,s3,postgres]" \
 && pip install --no-cache-dir opencv-python-headless numpy pymupdf pytesseract pillow

ENV PYTHONPATH=/app:/app/backend OCR_PROVIDER=auto DOCUMENT_AI_PROVIDER=auto DEMO_FIXTURES=on \
    TESSERACT_LANG=ben+eng ML_SCORING=off PREPROCESS=on STORAGE_PATH=/app/storage DATABASE_URL=sqlite:////app/landshield.db \
    OMP_THREAD_LIMIT=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 OPENCV_FOR_THREADS_NUM=1
# One thread each for Tesseract / numpy / OpenCV: they size their pools to the HOST core count, and on a
# CPU-quota container (Render free = 0.1 CPU) the extra threads thrash and one OCR pass took > 120 s.

WORKDIR /app/backend
EXPOSE 10000
# SEED_MODE=auto: reset the demo on SQLite (the free disk is wiped anyway); on a persistent Postgres
# seed only an empty database, so real uploads and digital records survive restarts (H5, D6).
CMD ["sh", "-c", "alembic upgrade head && python ../scripts/seed.py --mode ${SEED_MODE:-auto} && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
