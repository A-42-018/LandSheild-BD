# Backend on Render: keeping uploads and digital records (D6)

Render's free web service has no persistent disk: SQLite and `./storage` are wiped on every redeploy or
restart, so every uploaded deed and its digital record would be lost (historical-deed roadmap §1b).
Decision D6: the backend stays on Render; the **database** moves to a free managed Postgres and the
**files** to a free private S3-compatible bucket. The code for this is in place (H5); creating the
accounts and setting the variables is the H10 setup step. Basic Render setup: `deploy-netlify.md` §1.

## 1. Pick the providers

| Option | Database | Files | Notes |
|---|---|---|---|
| Simplest | Supabase Postgres | Supabase Storage (S3 API) | one account; an inactive free project pauses |
| Alternative | Neon | Cloudflare R2 | Neon compute sleeps (cold start of a few seconds) |

Check each free tier's limits when signing up, and wake the services before a presentation.

## 2. Database

1. Create the database and copy its connection string (with SSL), e.g.
   `postgresql://user:password@host/dbname?sslmode=require`. `postgres://` and `postgresql://` are both
   fine: the backend switches them to the psycopg 3 driver itself.
2. Render dashboard > `landshield-api` > Environment: set `DATABASE_URL` to it (`render.yaml` lists it as
   `sync: false`; left empty, the image falls back to SQLite on the wiped disk).
3. On the next start the Docker CMD runs `alembic upgrade head` (all migrations, including 0017
   `document_records`) and `seed.py --mode auto`: on Postgres it seeds **only an empty database**, so later
   restarts keep real uploads. `SEED_MODE=reset` would wipe everything on every boot: do not set it with a
   real database. `SEED_MODE=add` adds missing demo rows and keeps the rest.

## 3. Files

1. Create a **private** bucket (no public access, no public URL). Files are served only through the
   backend's access-checked routes (`/documents/{id}/file`, later the H8 downloads).
2. Create an access key limited to that bucket (read + write).
3. Set in Render:

| Variable | Cloudflare R2 | Supabase Storage |
|---|---|---|
| `STORAGE_BACKEND` | `s3` | `s3` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `S3_REGION` | `auto` | the project's region, e.g. `ap-southeast-1` |
| `S3_BUCKET` | bucket name | bucket name |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | R2 API token | Storage S3 access key |
| `S3_FORCE_PATH_STYLE` | `true` (default) | `true` (default) |

With `APP_ENV=prod` the backend refuses to start when `STORAGE_BACKEND=s3` lacks the bucket or keys.
Objects are stored as `documents/<sha256>.<ext>` and never written twice; every read is checked against
the hash taken at upload.

4. Keep `SIGNING_KEY` set (already required): approved digital records are Ed25519-signed with it, and a
   new key would make every stored signature read as INVALID.

All secrets stay in the Render dashboard (`sync: false`), never in the repo.

## 4. Backups (free tiers have little or no point-in-time restore)

Weekly, by hand or from a scheduled GitHub Action with the URLs as repository secrets:

```bash
pg_dump --no-owner --format=custom "$DATABASE_URL" > landshield-$(date +%F).dump
```

```bash
aws s3 ls "s3://$S3_BUCKET/documents/" --recursive --endpoint-url "$S3_ENDPOINT" > files-$(date +%F).txt
```

Keep the dump and the file listing together; `document_records` and `documents.file_hash` in the dump
say which objects the database expects. A restore is `pg_restore --clean --no-owner -d "$DATABASE_URL"`
plus copying the objects back (`aws s3 sync`).

## 5. Acceptance (H10)

On the deployed site: upload the sample historical deed, approve it, redeploy the backend, then check
that the document is still listed, the original still downloads with the same SHA-256 (`X-File-SHA256`),
and `GET /documents/{id}/records` still shows the approved version with `signature_status: VALID`.

## 6. Go-live checklist (H10)

The code side is done and tested locally (SQLite and a real Postgres 16, S3 through a fake client). These
steps need your accounts and the Render dashboard, so they are yours to run; tick them off here.

1. **Accounts (D6, §1):** create the Postgres database and the private bucket + a bucket-scoped key.
2. **Render > `landshield-api` > Environment:**
   - `DATABASE_URL`, `STORAGE_BACKEND=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY` (§2–3). Since H10 `render.yaml` lists them as `sync: false`, so a Blueprint
     sync never puts the SQLite URL back.
   - `SIGNING_KEY` stays as it is (a new key turns every stored signature INVALID).
   - `PUBLIC_SITE_URL` = the frontend origin, no trailing slash: the PDF's QR code points there.
   - `ANTHROPIC_API_KEY` (D3, optional) and `CLAUDE_DAILY_CAP` (default 100 calls a day). Through a
     gateway also `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH`. Without a key the rules read alone.
3. **Deploy**, then in the logs: `alembic upgrade head` reaches the newest migration and `seed.py --mode
   auto` seeds the empty database once.
4. **Restart test (acceptance, §5):** upload `database/sample_data/historical/Historical_Land_Deed.pdf`,
   approve it (a second officer: four-eyes), then **Manual Deploy > Restart** (or redeploy). Afterwards:
   - it is still under **My documents → My uploads**
   - **Download → Original upload** gives the same SHA-256 as before (`shasum -a 256`)
   - the document page shows **Signature valid ✓**, and the PDF's QR code opens a **Valid** check page
5. **Text-layer gate in production:** on the review screen of that upload the reading method must say the
   page image was read because the PDF's stored text was damaged (`TEXT_LAYER_REJECTED`), not
   "PDF text". Then upload a digital-deed PDF downloaded from the app: it must be read from its text
   layer (no such warning), and the Bangla values must match.
6. **PDF download works:** **Download → Digital deed (PDF)** opens with correct Bangla. A 503
   "cannot be made on this server" means Pango or WeasyPrint is missing from the image (see `Dockerfile`).
7. **Claude on (if a key is set):** the reading method on a new upload says Claude, not rules, and no
   `CLAUDE_FALLBACK` warning appears. Then run the LLM-on eval locally (ocr-accuracy.md) and record it.
8. **Backups (§4):** schedule the weekly dump.
