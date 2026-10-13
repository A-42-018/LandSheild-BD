# API

Base URL (local, `start.sh`): `http://127.0.0.1:8001/api/v1`. Demo dataset only.

## OpenAPI

Interactive docs while running in dev: `http://127.0.0.1:8001/docs` (Swagger) and `/redoc`; raw schema at `/openapi.json`. These three are served without the API CSP and should be disabled in production.

Export the schema without starting a server:

```bash
cd backend && PYTHONPATH=.. python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > openapi.json
```

## Auth

`POST /auth/login` returns a short-lived bearer `access_token` and sets an HttpOnly refresh cookie. Send the token as `Authorization: Bearer <token>`. Errors are JSON; rate-limited calls return 429.

## Route groups

| Group | Routes | Roles |
|---|---|---|
| health | `GET /health` | none |
| auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` | public / signed-in |
| public | `GET /public/verify/{land_id}` (no names, 60/min/IP) | none |
| public (F2c) | `GET /public/mutation-status/{mutation_no}` → status, step dates (applied · review · hearing · decided), AC Land office, days pending. No names, no land id; unknown/malformed number = 404 `MUTATION_NOT_FOUND` | none, 60/min/IP |
| public (F4a) | `GET /public/keys` (Ed25519 public key), `GET /public/seal/{land_id}` (signed QR payload), `GET /public/signature` (check a seal: VALID · INVALID · UNKNOWN) | none, 60/min/IP |
| public (F4b) | `POST /public/verify-document` (multipart copy, compared then discarded, never stored), `POST /public/verify-document/fields` (typed fields) | none, stricter verify-doc limit |
| gis | `GET /gis/capabilities`, `/gis/divisions`, `/gis/districts`, `/gis/upazilas`, `/gis/mouzas`, `/gis/search`; `GET /gis/scan?url=` (PDF download of a scanned mouza map, see docs/gis.md) | any signed-in |
| lands | `GET /lands/search`, `/lands/{id}`, `/lands/{id}/ownership`, `/lands/{id}/transactions`, `/lands/{id}/graph`, `/lands/map`; `GET /lands/{id}/risk` | any signed-in |
| lands (F1/F3) | `GET /lands/{id}/mutations` (mutation history + registration↔mutation mismatches), `/lands/{id}/encumbrances` (court case · khas · acquisition · mortgage), `/lands/{id}/pre-purchase-check?seller=` (six-row "Check Before You Buy", no owner names in payload; seller ≤ 120 chars) | any signed-in |
| archive (F5c) | `GET /archive/search?q=&survey=CS\|SA\|RS\|BS&district=&limit=&offset=` (full-text over approved documents; FTS5 on SQLite; empty `q` → 422 `INVALID_QUERY`) | REVIEWER and above |
| mutations (F2) | `GET /mutations` (officer queue), `GET /mutations/{id}` (detail + pre-checks) | REVIEWER and above |
| mutations (F2) | `POST /mutations/{id}/transition` (`to`, `reason`; HEARING/REJECTED need a reason; illegal move → 409) | OFFICER, ADMIN |
| verification | `POST /verification`, `GET /verification/{id}`, `GET /verification/{id}/report` | any signed-in |
| documents | `POST /documents/upload`, `POST /documents/{id}/process` | OFFICER, ADMIN |
| documents | `GET /documents/{id}`, `/file`, `/extraction`; `PATCH /extraction`; `POST /approve`, `/reject`, `/reprocess` | REVIEWER and above |
| officer | `GET /officer/stats`, `/officer/queue`, `/officer/activity` | REVIEWER and above |
| risk alerts | `GET /risk-alerts`, `PATCH /risk-alerts/{id}` | REVIEWER and above |
| admin | `GET /admin/audit-logs` | OFFICER, ADMIN |
| admin | `GET /admin/users` (q, role, is_active, sort, order, limit, offset) | ADMIN |
| admin | `POST /admin/users` (name, email, password ≥ 8, role, preferred_language) → 201, audit `USER_CREATE` | ADMIN |
| admin | `PATCH /admin/users/{user_id}` (name, role, is_active, preferred_language) → audit `USER_UPDATE`; changing own role or deactivating self → 409 `CANNOT_CHANGE_OWN_ACCESS`; no-op writes no audit row | ADMIN |
| admin | `GET /admin/land-records` (q, status, sort, order, limit, offset; no owner data) | ADMIN |
| admin | `GET /admin/documents` (q, status, sort, order, limit, offset; no file path) | ADMIN |
| admin (F4c) | `GET /admin/ledger/verify` → `INTACT` or `BROKEN` + first broken `seq` + reason | ADMIN |

The authoritative role table is the hand-written matrix in `backend/tests/security/test_authz_matrix.py`; it must match the OpenAPI schema exactly.

## curl examples

Demo password is `LandShield2026!` when started with `start.sh`. Needs `jq`.

**1. Log in and keep the token**

```bash
API=http://127.0.0.1:8001/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"officer@demo.landshield.test","password":"LandShield2026!"}' | jq -r .access_token)
```

**2. Public QR check (no login, no personal data)**

```bash
curl -s $API/public/verify/LP-10240 | jq
```

**3. Search a parcel**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/lands/search?district=Gazipur&upazila=Sreepur&mouza=Barmi&khatian=1250&dag=790" | jq
```

**4. Risk score and evidence for the double-sale parcel**

```bash
curl -s -H "Authorization: Bearer $TOKEN" $API/lands/LP-10240/risk | jq
```

**5. Create a verification request, then fetch its report**

```bash
VID=$(curl -s -X POST $API/verification -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"land_id":"LP-10240"}' | jq -r .id)
curl -s -H "Authorization: Bearer $TOKEN" $API/verification/$VID/report | jq
```

**6. Check Before You Buy (F3b)**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API/lands/LP-10240/pre-purchase-check?seller=Karim" | jq '.verdict, .rows[] | {code, status}'
```

**7. Verify the ledger chain (ADMIN token)**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $API/admin/ledger/verify | jq
```

**Bonus: upload a document (OFFICER/ADMIN)**

```bash
curl -s -X POST $API/documents/upload -H "Authorization: Bearer $TOKEN" \
  -F "file=@database/sample_data/Doc1.png" -F document_type=DEED | jq
```

> Status: these examples were checked against the route and schema definitions in the code. They were **not** executed against a live server in the P58 sandbox (no installed dependencies, no network).  Upload form fields: `file` (required), `document_type` (default `DEED`), `land_id` (optional).
