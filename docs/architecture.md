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
  API->>API: posting: deed, transaction, ownership_history, audit row
  API->>RE: assess parcel
  RE-->>API: score, level, evidence, alerts
```

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
```

Column-level detail: `backend/app/models/` and the Alembic revisions.

## Frontend

App Router under `frontend/app/[locale]/` (`/en`, `/bn`). Pages: landing, login, verify, verify/result, verify/graph, report/[id], v/[landId] (public QR page), map, officer (dashboard, upload, review, audit-logs), about. Feature code in `frontend/features/*`, shared UI in `frontend/components`, strings in `frontend/messages/{en,bn}.json` (parity checked by `npm run check:i18n`). The access token is held in memory; the refresh cookie is HttpOnly.

## Roles

CITIZEN, REVIEWER, OFFICER, ADMIN. Enforced per route by `require_roles`; the whole matrix is tested (`backend/tests/security/test_authz_matrix.py`). The role is read from the database, never from the token.
