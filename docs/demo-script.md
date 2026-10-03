# LandShield BD — Demo script (5 min, offline)

> Demo Dataset — Not an Official Government Land Record. All names/IDs synthetic.

## Before you start
- [ ] `./scripts/demo_reset.sh` (DB reset + seed + uploads cleared), then `./start.sh`
- [ ] `OCR_PROVIDER=mock`, `DOCUMENT_AI_PROVIDER=mock` (defaults); no network needed
- [ ] Tab 1: `http://localhost:3000/en` · accounts `officer@` / `citizen@demo.landshield.test`, password = `DEMO_PASSWORD` (default `demo1234` via start.sh)
- [ ] Files ready: `database/sample_data/Doc1.png`, `Doc2.png`
- [ ] Backup assets saved in `docs/backup/` (git-ignored): screenshots of steps 5, 10, 11, 12, 14, 15 and the exported report PDF (`scripts/export_report_pdf.py`, needs Chromium)

## 15-step flow with timing
| # | Time | Step | Where | Say / show |
|---|------|------|-------|------------|
| 1 | 0:00 | Open LandShield | `/en` | Problem: paper deeds, double sales, slow verification |
| 2 | 0:30 | Bilingual UI | language switch EN ⇄ BN | Same pages, full Bangla |
| 3 | 1:00 | Upload Doc1 (officer) | `/en/officer/upload` | LP-10234 starts with **no transactions** |
| 4 | 1:15 | Show OCR | review screen | Raw text, per-field source |
| 5 | 1:30 | Show AI extraction | review screen | Dag 785 · Khatian 1245 · 10 decimal · Seller Rahim · Buyer Karim |
| 6 | 1:40 | Show confidence | review screen | Low-confidence fields highlighted for human check |
| 7 | 1:50 | Approve | review screen | Human approves; nothing posts without it |
| 8 | 2:00 | Ownership history | `/en/verify` → LP-10234 | Rahim → Karim, periods and transaction recorded; risk LOW (0) |
| 9 | 2:15 | Upload Doc2 | upload page | Same land/dag/khatian/area, Seller Rahim · Buyer Hasan; approve |
| 10 | 2:30 | Conflict alert | alerts / result page | "POSSIBLE CONFLICTING TRANSACTION": same land · Dag · Khatian · seller · overlapping history. Never say "fraud confirmed" |
| 11 | 3:00 | Ownership graph | `/en/verify/graph` | Rahim linked to two buyers |
| 12 | 3:15 | Risk score | result page | HIGH (70), each rule explained with evidence |
| 13 | 3:30 | Verify as citizen | log in as citizen, `/en/verify` | Citizen sees only permitted fields |
| 14 | 3:45 | Bilingual report | `/en/report/<id>` | EN + BN; PDF if Chromium available |
| 15 | 4:00 | QR verification | QR on report → `/en/v/LP-10234` | Public page, no personal data |
| – | 4:15 | Architecture | `docs/architecture.md` diagram | Upload → OCR → extraction → review → rules/ML → report |
| – | 4:40 | Closing | | "Land records should not only be digital. They should be searchable, connected, verifiable, and risk-aware." |

## Pre-baked fallbacks (no upload needed)
| Land ID | Shows | Expected (as seeded) |
|---|---|---|
| LP-10240 | Double sale | HIGH 70: POSSIBLE_DUPLICATE_TRANSACTION + SELLER_MISMATCH |
| LP-10500 | Duplicate deed | MEDIUM 30 rules (+ small ML hint, ~34 with ML_SCORING=on): DUPLICATE_DEED |
| LP-10001 / LP-10100 | Clean / normal chain | LOW 0 |
| LP-10234 / LP-10300 / LP-10400 | Start with no transactions | LOW 0 until their sample doc is uploaded and approved |

Sample docs for the empty parcels: `AreaMismatch.png` (LP-10300, 12 vs recorded 10 decimal), `SellerMismatch.png` (LP-10400, seller Rahim vs recorded Karim), `Clean.png` (LP-10001). Their resulting level after approval is not rehearsed; the area mismatch is expected to appear as an indicator and may FLAG the sale.

If an upload stalls: use LP-10240 for steps 10-15 and say the upload was pre-run.

## Rehearsal checklist (tick after a timed run on a clean copy)
- [ ] reset script runs clean twice in a row
- [ ] Doc1 → approve → LOW (0); Doc2 → approve → HIGH (70) with evidence
- [ ] EN and BN both walked through
- [ ] Graph, QR page, report page open without console errors
- [ ] Airplane mode: everything above still works
- [ ] Total time ≤ 5:00
- [ ] Friction points found (max 5 fixed): ______

Status: script written and statically checked against tests (test_demo_flow: Doc1 -> LOW 0 RECORDED, Doc2 -> HIGH 70 FLAGGED); **not yet rehearsed live** (no browser/network/fastapi in the authoring sandbox).
