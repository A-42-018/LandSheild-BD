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
2. Render dashboard > `landshield-api` > Environment: set `DATABASE_URL` to it (replacing the SQLite value
   from `render.yaml`).
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

Not done yet (H10): creating the accounts, setting the variables, the restart test.
