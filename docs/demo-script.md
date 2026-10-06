# LandShield BD — Demo scripts (3-min video · 5-min final, offline)

> Demo Dataset — Not an Official Government Land Record. All names/IDs synthetic.

## Before you start
- [ ] `./scripts/demo_reset.sh` (DB reset + seed + uploads cleared), then `./start.sh`
- [ ] `OCR_PROVIDER=mock`, `DOCUMENT_AI_PROVIDER=mock` (defaults); no network needed
- [ ] Tab 1: `http://localhost:3000/en` · accounts `officer@` / `citizen@demo.landshield.test`, password = `DEMO_PASSWORD` (default `LandShield2026!` via start.sh)
- [ ] Files ready: `database/sample_data/Doc1.png`, `Doc2.png`, `Doc1_altered.png`
- [ ] Tab 2 (final only): `admin@demo.landshield.test` on `/en/officer/admin` → Ledger integrity
- [ ] Backup assets saved in `docs/backup/` (git-ignored): screenshots of steps 5, 10, 11, 12, 14, 15 and the exported report PDF (`scripts/export_report_pdf.py`, needs Chromium)

## A. 3-minute video (Round 1, S2) — P3 Fraud & Double-Selling first

Pre-run Doc1 + Doc2 on LP-10234 before recording, or use LP-10240 (identical outcome). Screen-record at 1080p, EN with one BN switch.

| # | Time | Step | Where | Say / show |
|---|------|------|-------|------------|
| 1 | 0:00 | Problem | `/en` landing | Paper deeds, double sales, registration and khatian out of sync |
| 2 | 0:15 | Check Before You Buy | `/en/check` → LP-10240, seller "Karim" | Six-row checklist: seller, mutation, case, khas/acquisition, open indicators → INDICATORS FOUND |
| 3 | 0:40 | Double sale evidence | `/en/verify/result` LP-10240 → Evidence tab | HIGH (70): POSSIBLE_DUPLICATE_TRANSACTION + SELLER_MISMATCH, each rule explained. "Indicator, not a legal finding" |
| 4 | 1:00 | Ownership graph | `/en/verify/graph` | One seller linked to two buyers |
| 5 | 1:15 | Registration ↔ mutation gap | result page, Mutation tab on LP-10600 then LP-10700 | Sold but never mutated (MEDIUM 30) · mutated to a different person (HIGH 60) |
| 6 | 1:35 | Encumbrances | Cases tab on LP-10800 / LP-10900 | Active case MEDIUM 30 · khas land HIGH 60 |
| 7 | 1:50 | Officer e-Mutation | `/en/officer/mutations` → open one | Pre-checks, fast track vs hearing, reason required to reject |
| 8 | 2:10 | Verify a copy | `/en/verify-document` upload `Doc1_altered.png` | Altered field flagged; file compared then discarded |
| 9 | 2:25 | Signed QR | report → `/en/v/LP-10240` | Ed25519 signature chip VERIFIED; no names on the public page |
| 10 | 2:40 | Bangla | switch to `/bn` on the report | Full Bangla, Bangla numerals |
| 11 | 2:50 | Close | | "Searchable, connected, verifiable, risk-aware." Demo data only |

## B. 5-minute final (live, T2) — full pipeline + tamper evidence

| # | Time | Step | Where | Say / show |
|---|------|------|-------|------------|
| 1 | 0:00 | Problem + bilingual UI | `/en` ⇄ `/bn` | Same pages, full Bangla |
| 2 | 0:20 | Upload Doc1 (officer) | `/en/officer/upload` | LP-10234 starts with **no transactions** |
| 3 | 0:35 | OCR + extraction + confidence | review screen | Dag 785 · Khatian 1245 · 10 decimal · Rahim → Karim; low-confidence fields highlighted |
| 4 | 0:55 | Approve | review screen | Human approves; deed hashed + signed, ledger entry, e-Mutation auto-created |
| 5 | 1:10 | Result | `/en/verify/result` LP-10234 | Ownership Rahim → Karim; LOW (0) |
| 6 | 1:25 | Upload + approve Doc2 | upload / review | Rahim → Hasan, same dag/khatian/area |
| 7 | 1:45 | Conflict | alerts / result Evidence tab | HIGH (70): POSSIBLE CONFLICTING TRANSACTION + SELLER_MISMATCH. Never "fraud confirmed" |
| 8 | 2:05 | Graph | `/en/verify/graph` | Rahim linked to two buyers |
| 9 | 2:20 | Mutation queue | `/en/officer/mutations` | Doc2's mutation sent to HEARING by failed pre-checks |
| 10 | 2:40 | Check Before You Buy | `/en/check` LP-10234 | Buyer-side view of the same indicators |
| 11 | 3:00 | Citizen report + QR | citizen login → report → `/en/v/LP-10234` | Letter-style report, signed QR, public page without personal data |
| 12 | 3:25 | Verify a copy | `/en/verify-document` `Doc1_altered.png` | Mismatch on the altered field |
| 13 | 3:45 | Tamper demo | terminal: `python scripts/tamper_demo.py --land LP-10100` | Edit SQLite directly, bypassing the app |
| 14 | 4:00 | Ledger integrity | Tab 2: Admin → Ledger integrity → Verify | BROKEN at seq N; LP-10100 now shows RECORD_INTEGRITY_FAILED (HIGH). Then `--restore` → INTACT |
| 15 | 4:30 | Architecture | `docs/architecture.md` | Upload → OCR → extraction → review → rules/ML → signature + ledger → report |
| – | 4:45 | Closing | | "Land records should not only be digital. They should be searchable, connected, verifiable, and risk-aware." |

## Pre-baked fallbacks (no upload needed)
| Land ID | Shows | Expected (as seeded) |
|---|---|---|
| LP-10240 | Double sale | HIGH 70: POSSIBLE_DUPLICATE_TRANSACTION + SELLER_MISMATCH |
| LP-10500 | Duplicate deed | MEDIUM 30 rules (+ small ML hint with ML_SCORING=on): DUPLICATE_DEED |
| LP-10600 | Registered, not mutated | MEDIUM 30: REGISTERED_NOT_MUTATED |
| LP-10700 | Mutated to another person | HIGH 60: MUTATION_PARTY_MISMATCH |
| LP-10800 | Active court case | MEDIUM 30: ACTIVE_LITIGATION |
| LP-10900 | Khas land | HIGH 60: KHAS_LAND |
| LP-11000 | Under acquisition | HIGH 60: UNDER_ACQUISITION |
| LP-10001 / LP-10100 | Clean / normal chain | LOW 0 |
| LP-10234 / LP-10300 / LP-10400 | Start with no transactions | LOW 0 until their sample doc is uploaded and approved |

Same table as README "Demo dataset"; enforced by `backend/tests/test_scenarios.py`.

Sample docs for the empty parcels: `AreaMismatch.png` (LP-10300, 12 vs recorded 10 decimal), `SellerMismatch.png` (LP-10400, seller Rahim vs recorded Karim), `Clean.png` (LP-10001). Their resulting level after approval is not rehearsed; the area mismatch is expected to appear as an indicator and may FLAG the sale.

If an upload stalls (final): use LP-10240 for steps 7-12 and say the upload was pre-run. If the tamper script fails: show the Ledger integrity card INTACT and explain.

## Rehearsal checklist (tick after a timed run on a clean copy)
- [ ] reset script runs clean twice in a row
- [ ] Doc1 → approve → LOW (0); Doc2 → approve → HIGH (70) with evidence
- [ ] EN and BN both walked through
- [ ] Graph, QR page, report page open without console errors
- [ ] Airplane mode: everything above still works
- [ ] Video ≤ 3:00 · final ≤ 5:00
- [ ] Tamper demo: BROKEN then `--restore` → INTACT
- [ ] Friction points found (max 5 fixed): ______

Status (Q1, 2026-10-06): levels checked against a fresh seed by `test_scenarios.py`; Doc1 → LOW 0, Doc2 → HIGH 70 by `test_demo_flow`. **Not yet rehearsed live in a browser** (→ Q2).
