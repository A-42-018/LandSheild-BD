# LandShield BD — Final round readiness (T2)

> Demo Dataset — Not an Official Government Land Record. Format: 5 min pitch + demo, 3 min Q&A, deck ≤ 10 slides ([landshield-pitch-deck.pptx](landshield-pitch-deck.pptx)). Click-by-click demo steps: [demo-script.md](demo-script.md) §B.

## 1. Five-minute script (1.0 pitch · 3.5 demo · 0.5 close)

| Time | Who | Say / do |
|---|---|---|
| 0:00 | A | **Problem (slides 1–2).** "A plot can be sold twice, sold by someone who is no longer the owner, or backed by an altered deed. The deed sits at the Sub-Registry, the ownership record at the AC Land office; nobody checks both." One number: ~80 % of court cases are land disputes. |
| 0:30 | A | **Solution (slide 3).** "LandShield BD: scan → verify → detect → mutate → citizen check. Every score shows its evidence; a human approves every record." |
| 1:00 | B | **Demo — upload.** Officer uploads `Doc1.png` on LP-10234 → OCR, confidence per field, low-confidence highlighted → approve. "Hash, Ed25519 signature, ledger entry, and an e-Mutation application were created automatically." |
| 1:50 | B | **Double sale.** Upload + approve `Doc2.png` (same seller, other buyer) → LP-10234 turns **HIGH 70**, evidence: possible duplicate transaction + seller mismatch. Say "indicator, not a finding". Show the ownership graph. |
| 2:40 | A | **Mutation + citizen.** Mutation queue: Doc2 sent to *hearing* by the pre-checks. `/check` for LP-10900 (khas) → indicators found. QR page: signed, no personal data. |
| 3:30 | A | **Tamper evidence.** `verify-a-copy` with `Doc1_altered.png` → ALTERED: land_area. Run `tamper_demo.py`, show ledger **BROKEN at seq N**, restore → **INTACT**. |
| 4:15 | B | **Bangla + honesty.** Switch to `/bn`. "Bangla OCR: mean CER ≈ 17 % on synthetic specimens, so humans review everything. All data synthetic." |
| 4:35 | A | **Rollout + close (slides 8–9).** Pilot upazila → district → national; permissioned ledger nodes at the three offices. "Land records should be searchable, connected, verifiable and risk-aware." |

## 2. Ownership split (both must be able to explain everything at a high level — Rule Book §9.3)

| | Student A — Alif Mahmud | Student B — Ayesha Hamid Mithila |
|---|---|---|
| Owns | Backend, risk rules + scoring, e-Mutation state machine, signing + ledger, archive search | Frontend, OCR pipeline + evaluation, UI/design system, deploy |
| 60-second explanation | "Rules are pure functions over a read-only context; points sum, cap 100; ML adds ≤ 15 and cannot create HIGH." | "Upload → preprocessing → Tesseract → rules extractor → confidence → review UI; Bangla-first, flat e-governance style." |
| Cross-training | Can walk through the review screen and OCR eval table | Can explain one rule (double sale) and the ledger chain |

## 3. Offline fallback

1. Everything runs locally with no network: `./scripts/demo_reset.sh && ./start.sh` (mock OCR + mock Document AI).
2. If an upload stalls: use pre-seeded LP-10240 for the double-sale steps and say the upload was pre-run.
3. If the tamper script fails: show the ledger card INTACT and explain the chain.
4. If the laptop dies: play `docs/video/LandShield-BD-demo.mp4` (2:17, captions) and talk over it; backup screenshots in `docs/backup/`.
5. Live site (Netlify + Render free tier) is only a bonus: ping `/health` 5 minutes before, expect a 30–60 s cold start.

## 4. Hardware / venue checklist

- [ ] Laptop fully charged + charger; second device with the video and the deck PDF
- [ ] HDMI / USB-C adapter tested; display mirrored at 1080p, browser zoom 110 %
- [ ] Mobile hotspot as network backup; airplane-mode run done once
- [ ] Two browser windows open: officer (`/en/officer/upload`) and admin (`/en/officer/admin`), terminal in repo root with `tamper_demo.py` command typed
- [ ] `database/sample_data/Doc1.png`, `Doc2.png`, `Doc1_altered.png` on the Desktop
- [ ] Notifications off, battery saver off, screen lock off
- [ ] Printed one-page cheat sheet (this script + LP-ids table)
- [ ] Timed rehearsal ×2 on a clean copy (≤ 5:00)

## 5. Q&A bank (3 minutes; 30 questions)

**Problem and scope**
1. *Why P3?* Fraud is where the cost is: double sales and altered deeds end in court; the other problems feed it.
2. *Is this a government system?* No. Demo prototype, synthetic data, no registry integration, notice on every page.
3. *Who is the user?* Citizens (check before buying), reviewers/officers (approve, mutation), admins (ledger, users).
4. *How is this different from existing land portals (e.g. e-Namjari, land.gov.bd)?* They record and serve; LandShield cross-checks registration against mutation, encumbrances and document integrity, and explains every risk.

**Fraud detection**
5. *How do you detect double sales?* Same parcel, same seller, overlapping or exceeding area within recorded transfers → `POSSIBLE_DUPLICATE_TRANSACTION` (40) + seller mismatch (30).
6. *What if the owner legitimately sells in two halves?* Area is summed; two sales within the recorded area do not trigger it.
7. *False positives?* Seeded scenarios: precision/recall 1.00, but that is synthetic; the output says "possible", needs human review, and never auto-blocks.
8. *Rapid transfers?* `RAPID_RESALE` (seller held < 60 days) and `REPEATED_SUSPICIOUS_TRANSACTIONS` (≥ 3 in 90 days).
9. *Forged dates?* `IMPOSSIBLE_DATE`: future, before seller acquired, before first recorded owner.
10. *Registration vs mutation mismatch?* `REGISTERED_NOT_MUTATED` (> 180 days), `MUTATION_PARTY_MISMATCH`, `MUTATION_WITHOUT_DEED`, `MUTATION_AREA_EXCEEDS_DEED`.
11. *Why a rule engine and not ML?* Explainability and legal defensibility; ML is only a hint (≤ 15 points) and cannot create HIGH.
12. *How was the anomaly model trained?* Isolation Forest on synthetic data (precision 0.974 / recall 0.935 on held-out synthetic); not a probability.
13. *Name variants (Md./Mohammad, spelling)?* rapidfuzz + Bangla romanisation; a variant is INFO and routed to review, never merged automatically.

**Documents, OCR, AI**
14. *Bangla OCR accuracy?* Measured on 2 synthetic specimens × 3 variants: mean CER ≈ 17 %, parsed fields 77 % → 90 % with preprocessing. Real scans will be worse, hence mandatory human review.
15. *Why Tesseract?* Free, offline, supports `ben`; pluggable provider interface for a better model later.
16. *Does generative AI run at runtime?* No. Claude was used to write code/docs (disclosed); all decisions are deterministic rules.
17. *Khatian / porcha (CS, SA, RS, BS)?* Parser extracts survey type, JL, owners + shares, dags; nothing guessed; `SURVEY_CHAIN_GAP` links survey eras.

**Integrity and security**
18. *How do you prove a record was not changed?* SHA-256 record hash, Ed25519 signature, hash-chained ledger; tamper demo shows BROKEN at the changed row.
19. *Who can alter the ledger?* Anyone with raw DB write access can, which is detectable; anchoring the chain head off-database is the next step.
20. *Where are private keys?* Environment-configured signing key; public key served at `/public/keys` for third-party verification.
21. *What personal data is public?* None: the QR page shows land id, level, signature status, counts only.
22. *Authentication and roles?* JWT, four roles read from the DB (not the token), authz matrix test covers every route.
23. *Data protection?* Hashed identifiers, audit log with salted IP hash, rate limits, no real personal data (Rule Book §8).

**Engineering and scale**
24. *Why SQLite?* Demo simplicity; Alembic migrations and the SQLAlchemy layer move to Postgres/PostGIS; FTS archive search falls back to a LIKE scan elsewhere.
25. *Testing?* Backend pytest (600+), Vitest (360+), Playwright e2e, ruff, tsc, i18n parity, axe accessibility.
26. *Performance at national scale?* Rules are per-parcel and stateless; scale horizontally, read replicas, queue OCR jobs.

**Impact and rollout**
27. *Rollout plan?* Pilot upazila (6 mo) → district (12 mo) → national (24–36 mo) with permissioned ledger nodes at Sub-Registry, AC Land and DC offices.
28. *Integration with registry/mutation systems?* Read-only feeds first; live e-Mutation API in the district stage.
29. *Business/governance model?* Government-operated service, open data interfaces; no per-citizen fee for the check.
30. *What would you build next?* Anchor ledger head off-DB, real-scan Bangla OCR fine-tuning with legal approval, court cause-list feed, SMS check-before-you-buy.
