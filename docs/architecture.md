# Architecture

Demo dataset only. Not an official government system.

## System context

```mermaid
flowchart LR
  C[Citizen] --> FE
  R[Reviewer / Officer / Admin] --> FE
  Q[QR scanner] --> FE
  FE[Next.js frontend<br/>EN + BN] -->|REST /api/v1<br/>Bearer + refresh cookie| API[FastAPI backend]
  API --> DB[(SQLite / SQLAlchemy)]
  API --> ST[(storage/ uploads)]
  API --> AI[ai/ package<br/>preprocess · OCR · extraction · anomaly model]
```

## Backend layers

```mermaid
flowchart TB
  M[main.py<br/>CORS · security headers · rate limit · logging] --> A[api/v1 routers<br/>thin, RBAC via require_roles]
  A --> S[services/<br/>land · ownership · documents · review · posting · risk · audit · public]
  S --> RK[risk/<br/>rules · scoring · ml]
  S --> TR[services/ mutation · pre_purchase<br/>signing · doc_verify · ledger]
  S --> W[workers/jobs.py<br/>background processing]
  S --> MD[models/ + schemas/]
  W --> P[services/providers.py] --> AI[ai/ocr · ai/extraction · ai/preprocessing]
  RK --> ML[ai/fraud_detection<br/>Isolation Forest, optional]
  MD --> DB[(DB)]
```

Rules are pure functions over a `LandContext` dataclass (no DB access inside rules).

## Document to risk flow

```mermaid
sequenceDiagram
  participant O as Officer
  participant API as FastAPI
  participant W as Worker
  participant AI as OCR + extraction
  participant RV as Reviewer
  participant RE as Risk engine
  O->>API: POST /documents/upload
  API-->>O: 201 (validated, stored under a UUID name)
  API->>W: process job
  W->>AI: preprocess (opt) → OCR → extract fields + confidence
  AI-->>W: extraction
  RV->>API: PATCH /documents/{id}/extraction (corrections)
  RV->>API: POST /documents/{id}/approve
  API->>API: posting: deed (hash + Ed25519 signature), transaction, ownership_history, audit row
  API->>API: ledger: append hash-chained entries (deed, transaction)
  API->>API: e-Mutation: auto-create mutation_record, pre-checks → UNDER_REVIEW or HEARING
  API->>RE: assess parcel (incl. mutation + encumbrance rules)
  RE-->>API: score, level, evidence, alerts
```

## Trust layer (F4)

```mermaid
flowchart LR
  D[deed row] -->|SHA-256 canonical fields| H[record_hash]
  H -->|Ed25519 sign| SIG[signature]
  SIG --> QR[signed QR / seal<br/>GET /public/seal/:land_id]
  QR --> PV[public verify page<br/>VALID · INVALID · UNKNOWN]
  COPY[uploaded copy or typed fields] -->|POST /public/verify-document| CMP[compare vs stored record<br/>never stored]
  E[posting: deed + transaction · mutation transition · encumbrance · seed backfill] --> L[ledger_entries<br/>entry_hash = SHA-256 seq·type·id·payload_hash·prev_hash]
  L -->|GET /admin/ledger/verify| V{INTACT / BROKEN<br/>first broken seq}
  V -->|BROKEN| RI[rule RECORD_INTEGRITY_FAILED 60]
```

The chain is only as strong as DB write access; `scripts/tamper_demo.py` breaks and restores it for the demo.

## e-Mutation state machine (F2)

```mermaid
stateDiagram-v2
  [*] --> APPLIED: deed approved (auto-create)
  APPLIED --> UNDER_REVIEW: pre-checks pass (fast_track)
  APPLIED --> HEARING: pre-checks fail (listed)
  APPLIED --> REJECTED
  UNDER_REVIEW --> APPROVED
  UNDER_REVIEW --> HEARING
  UNDER_REVIEW --> REJECTED
  HEARING --> UNDER_REVIEW
  HEARING --> APPROVED
  HEARING --> REJECTED
  APPROVED --> [*]
  REJECTED --> [*]
```

Manual transitions are OFFICER/ADMIN only; HEARING and REJECTED need a reason; each transition is audited and appended to the ledger. Pending mutations (APPLIED, UNDER_REVIEW, HEARING) and registered-but-unmutated transactions feed the risk rules and the "Check Before You Buy" checklist.

## Risk scoring

```mermaid
flowchart LR
  CTX[LandContext] --> RULES[rule set] --> EV[evidence list<br/>code · severity · params]
  EV --> SUM[sum points, cap 100]
  ML[ML anomaly score] -.->|+0..15, never HIGH alone| SUM
  SUM --> LV{level}
  LV -->|>=60| H[HIGH]
  LV -->|30-59| M[MEDIUM]
  LV -->|<30| L[LOW]
```

Rule weights live in `backend/app/risk/config.py` (single source of truth). INFO and 0-point evidence never creates an alert.

## Data model

```mermaid
erDiagram
  USERS ||--o{ DOCUMENTS : uploads
  USERS ||--o{ VERIFICATION_REQUESTS : requests
  USERS ||--o{ AUDIT_LOGS : acts
  LAND_PARCELS ||--o{ DEEDS : has
  LAND_PARCELS ||--o{ TRANSACTIONS : has
  LAND_PARCELS ||--o{ OWNERSHIP_HISTORY : has
  LAND_PARCELS ||--o{ RISK_ASSESSMENTS : scored
  LAND_PARCELS ||--o{ FRAUD_ALERTS : raises
  LAND_PARCELS ||--o{ VERIFICATION_REQUESTS : verified
  OWNERS ||--o{ OWNERSHIP_HISTORY : holds
  OWNERS ||--o{ TRANSACTIONS : "seller / buyer"
  LAND_PARCELS ||--o{ DOCUMENTS : "linked after approval"
  DOCUMENTS ||--o{ DEEDS : "source of"
  DOCUMENTS ||--o{ TRANSACTIONS : "source of"
  DEEDS ||--o{ TRANSACTIONS : "backs"
  TRANSACTIONS ||--o{ FRAUD_ALERTS : "may raise"
  LAND_PARCELS ||--o{ MUTATION_RECORDS : "khatian updates"
  DEEDS |o--o{ MUTATION_RECORDS : "registered by"
  TRANSACTIONS |o--o{ MUTATION_RECORDS : "mutates"
  OWNERS ||--o{ MUTATION_RECORDS : "applicant / new holder"
  LAND_PARCELS ||--o{ LAND_ENCUMBRANCES : "case · khas · acquisition · mortgage"
  LEDGER_ENTRIES ||--o| LEDGER_ENTRIES : "prev_hash"
```

`ledger_entries` has no FK: each row stores `entity_type` + `entity_id` + `payload_hash` so it survives edits to the source row and can detect them. Migrations: 0004 mutation_records · 0005 land_encumbrances · 0006 deed record_hash/signature · 0007 ledger_entries.

Column-level detail: `backend/app/models/` and the Alembic revisions.

## Frontend

App Router under `frontend/app/[locale]/` (`/en`, `/bn`). Pages: landing, login, verify (incl. pre-purchase check and verify-a-copy), verify/result (tabs: ownership · transactions · mutation · cases/encumbrance · evidence), verify/graph, report/[id], v/[landId] (public QR page), map, officer (dashboard, upload, review, mutation queue + detail, audit-logs), admin (users, land records, documents, ledger integrity), about. Feature code in `frontend/features/*`, shared UI in `frontend/components`, strings in `frontend/messages/{en,bn}.json` (parity checked by `npm run check:i18n`). The access token is held in memory; the refresh cookie is HttpOnly.

## Roles

CITIZEN, REVIEWER, OFFICER, ADMIN. Enforced per route by `require_roles`; the whole matrix is tested (`backend/tests/security/test_authz_matrix.py`). The role is read from the database, never from the token.
