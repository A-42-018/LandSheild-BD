# Security notes (P51 + P52, finished in P58)

Demo dataset only — not an official government system. This file records what P51 checked, what it changed, and what is still open. Nothing here was run against a live deployment.

## Verification status

P51 and P52 suites have been run: backend 470 passed, ruff clean; frontend 183 passed, tsc clean, i18n 480 keys. Still not run: `next build`, a live uvicorn + browser session, Postgres, `pip-audit`/`npm audit` at P58 time (results from P52 are in "Still open"). Commands: `cd backend && pytest -q && ruff check .`, `cd frontend && npm install && npm test && npx tsc --noEmit`.

## Checked and fixed

| # | Finding | Fix |
|---|---|---|
| 1 | API responses had no security headers | `app/core/headers.py` (pure ASGI middleware): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, API-only CSP (`default-src 'none'; frame-ancestors 'none'`), HSTS when `COOKIE_SECURE` or `APP_ENV` is not dev. A route's own value (for example the document preview) wins over the default. |
| 2 | API JSON could be cached by default | `Cache-Control: no-store` is the default for API responses. |
| 3 | Next pages had no security headers | `frontend/security-headers.mjs` wired through `next.config.mjs`: CSP baseline, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, COOP, HSTS only for an https `NEXT_PUBLIC_SITE_URL` in production. `X-Powered-By` removed. |
| 4 | Upload rate limit (R4: 20/hour/user) was not implemented | `POST /documents/upload` checks `UPLOAD_RATE_LIMIT_PER_HOUR` per user id before the body is read; rejected files count too. |
| 5 | `POST /auth/register` was unlimited | Limited to `AUTH_RATE_LIMIT_PER_MIN` (default 10) per IP. |
| 6 | Two separate in-memory limiters | Login now uses the shared `core/ratelimit.py` (`check_login_rate` / `reset_login_limits` keep their names). |
| 7 | CORS used `allow_methods=["*"]` and `allow_headers=["*"]` with credentials | Explicit methods (`GET POST PATCH DELETE OPTIONS`) and headers (`Authorization Content-Type Accept Accept-Language`); a `*` origin is dropped, never echoed. |
| 8 | Nothing stopped a production start with weak settings | With `APP_ENV` other than `dev`, startup fails if `JWT_SECRET` < 32 chars, `COOKIE_SECURE` is false, `HASH_SALT` is the default or < 16 chars, or any CORS origin is `*` or not `https://`. Dev is never blocked. |
| 9 | `.gitignore` gaps | Added `.env.*` (with `!.env.example`), `*.pem`, `*.key`, `docs/backup/`, `venv/`, SQLite journal. |

## Checked, no change needed

- **Refresh cookie:** `HttpOnly`, `SameSite=Lax`, path-scoped to `/api/v1/auth`, `Secure` follows `COOKIE_SECURE`. The access token lives in browser memory only.
- **JWT:** HS256, secret required outside dev, access/refresh tokens are typed (type confusion rejected), role is read from the database, not the token.
- **Upload limits:** 10 MB, 40 MP images, 20 PDF pages, extension and magic bytes must agree, stored names are random UUIDs, path traversal and symlink escapes are rejected (constants are pinned by a test).
- **Secrets grep:** no private-key blocks, cloud or API tokens in the repository text files. `tests/test_security_a.py` repeats the scan. Passwords in `start.sh` (`demo1234`) and `run_eval.py` are demo-only defaults overridable by `DEMO_PASSWORD`.
- **Public and map endpoints:** `/public/verify/{id}` (60/min/IP) and `/lands/map` expose no names, hashes, ids or file paths; both compute risk read-only.

## Still open (not fixed in P51)

- Rate limits and refresh-token revocation are **in memory per process**: they reset on restart and are not shared between workers. Use a shared store (P57 / P2) for a real deployment.
- The client IP is `request.client.host`. Behind a reverse proxy every request looks like one IP unless uvicorn is started with `--proxy-headers --forwarded-allow-ips=<proxy>`.
- `POST /auth/refresh` and `/auth/logout` are not rate limited (the frontend refreshes on every page load).
- CSP `script-src` keeps `'unsafe-inline'` because the App Router emits inline bootstrap scripts; a nonce middleware would remove it. `style-src` keeps `'unsafe-inline'` (Next and Leaflet inline styles).
- `/docs`, `/redoc` and `/openapi.json` are served without the API CSP (Swagger needs a CDN). Disable them in production.
- A 500 raised before the app's own handlers (Starlette's outermost error layer) is returned without these headers.
- No dependency audit (`pip-audit`, `npm audit`) was possible offline.
- **Dependencies (audited in P52, not yet fixed):** `pip-audit` flags pyjwt < 2.15 and pillow < 12.3 (raise the floors in `pyproject.toml`, reinstall in a clean venv, rerun tests). `npm audit --omit=dev` flags next 14.2.15 (critical), next-intl <= 4.9.1 and postcss via next; fixes are major upgrades and need their own phase.

## P52 — authorization, leaks, injection, audit, logs

**Checked (automated, `backend/tests/security/`)**
- Authz matrix: every OpenAPI operation × anonymous / garbage token / CITIZEN / REVIEWER / OFFICER / ADMIN against a hand-written R4 table. A route missing from the table fails the suite. Unlisted methods return 404/405. A validly signed token with a forged `role` claim is still 403 (role read from the DB).
- Leaks: ~120 responses across all roles and all seed parcels contain no `password_hash`, `nid_hash`, `contact_hash`, `file_path`, no stored hash/path value, and no non-null `father_name` for citizens or anonymous callers; the public payload key set and the audit-log row shape are pinned.
- Injection/XSS: SQL, script, traversal, template and 5000-char payloads on every query, path, form and JSON input: no 5xx, JSON + nosniff only, no internals in errors, no row created or changed. Upload names never reach disk. The frontend has no `dangerouslySetInnerHTML`, `.innerHTML`, `document.write` or `eval`.
- Audit: every write route is mapped to its audit action; denied, invalid or conflicting writes leave no audit row; FAILED_LOGIN stores no e-mail or password.
- Logs: the JSON formatter redacts bearer tokens, JWTs, `password=`/`token=`/cookie values, e-mail addresses and sensitive field names (hashes, file paths, father_name) in messages, extras and tracebacks.

**Fixed**
- `POST /auth/register` wrote no audit row → now `REGISTER`.
- Log lines could carry credentials or e-mail addresses → redaction added.

**Deliberately not audited:** `POST /auth/refresh` (runs on every page load).

## Deployment checklist (P58)

- Set `APP_ENV=prod`, a `JWT_SECRET` of 32+ random characters, a real `HASH_SALT` (16+), `COOKIE_SECURE=true`, https-only `CORS_ORIGINS`; the app refuses to start otherwise.
- Serve behind HTTPS; start uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy>` so rate limits see client IPs.
- Disable `/docs`, `/redoc`, `/openapi.json`.
- Replace in-memory rate limits and refresh revocation with a shared store before running more than one worker.
- Raise `pyjwt>=2.15` and `pillow>=12.3` (already in `pyproject.toml`; reinstall in a clean venv) and plan the Next / next-intl major upgrade.
- Never commit `.env`, `storage/` or `*.db`; demo passwords (`demo1234`) are for local demos only.

## Reporting

This is a demo project. Report suspected issues to the project owner privately, not in a public issue.
