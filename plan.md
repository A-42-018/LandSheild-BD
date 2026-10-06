# LandShield BD — plan.md (lightweight tracker)

> Phase cards (files to read/touch, steps, tests): `roadmap.md` §5 — find with `grep -n "^### " roadmap.md`, view only your card.
> UI design spec: `roadmap.md` §4. Old build log: `docs/history/plan-v90.md`. Never read `prompt.md` whole.
> Demo data only — not a government system.

## STATE
```text
Plan version : 114
Competition  : LandTech 2026 · P3 Fraud & Double-Selling (P1/P2/P4/P5 supporting) · submit by 15 Oct (deadline 16 Oct)
Current phase: S1 (2026-10-06) ✅ — concept note written + PDF exported (3 pages A4, readable at 100 %). Q2-b live deploy reported done by user. Files: docs/concept-note.md (source; 8 sections: P3 problem, BD context w/ 3 cited public sources [Daily Observer 8 Nov 2025 ~80 % of cases land-related; HiiL/BRAC 2018 land 29 % of legal problems; TIB NHS 2023: 51 % corruption / 32.3 % bribes in land services], Scan→Verify→Detect→Mutate→Citizen pipeline, architecture SVG + stack, 6 screenshots, AI metrics + limitations, countrywide plan §6, team + AI disclosure), docs/concept-note/ (architecture.svg + 6 JPG screenshots from a local seeded run), docs/concept-note.html (generated), docs/LandShield-BD-Concept-Note.pdf, scripts/export_concept_note.py (md → HTML → headless Chrome PDF; `pip install markdown`). Facts checked against code: 14 scored rules (risk/config.py), 6 e-Mutation pre-checks (services/mutation.py), metrics from docs/ai-pipeline.md.
S1-b ✅: team DEEDGUARD (Alif Mahmud, Ayesha Hamid Mithila; mentor not assigned), live https://land-sheild-bd.netlify.app/en, repo github.com/A-42-018/LandSheild-BD filled in concept note + README header; PDF re-exported (3 p). Only VIDEO_URL left → fill after S2, then re-run `python scripts/export_concept_note.py`.
OPEN (carried): EN+BN evidence i18n for ACTIVE_LITIGATION/KHAS_LAND/UNDER_ACQUISITION/ACTIVE_MORTGAGE not done; public QR page does not render encumbrance/mutation counts; real OCR (tesseract) path of verify-document untested; ML scoring skipped in plain dev venv; Docker image never built locally; `next build` not run. Ledger chain is only as strong as DB write access (anchoring head hash off-DB is a T1 idea).
Next phase   : S2 demo video (user, record locally, follow docs/demo-script.md §A) → S3 submit (tag `round1-submission`)
Carried over : reseed for demo password (Q17)
```

## PHASES  (⬜ todo · 🟡 partial · ✅ done · 🔒 gate) — one phase = one Sonnet chat / one 5-h window

| Day | # | Phase | Pri | Status |
|---|---|---|---|---|
| 06 Oct | G0 | Replace real-looking deed fixture | Must | ✅ |
| 06 Oct | G1 | README compliance (P3, data sources, AI disclosure, credits) + LICENSE | Must | ✅ |
| 06 Oct | U1 | Design tokens "Formal Green" | Must | ✅ |
| 07 Oct | U2 | Flat core components | Must | ✅ |
| 07 Oct | U3 | Top strip + header + footer + light default | Must | ✅ |
| 07 Oct | U4 | Flat SVG logo + Bangla-first | Must | ✅ |
| 08 Oct | F1a | Mutation records: model, migration 0004, seed | Must | ✅ |
| 08 Oct | F1b | Registration↔mutation mismatch rules + API | Must | ✅ |
| 08 Oct | F1c | Mutation history UI | Must | ✅ |
| 09 Oct | F2a | e-Mutation workflow backend (auto-create, pre-checks, state machine) | Must | ✅ |
| 09 Oct | F2b | Officer mutation queue + detail UI | Must | ✅ |
| 09 Oct | F3a | Encumbrances: cases, khas, acquisition (migration 0005) | Must | ✅ |
| 10 Oct | F3b | Check Before You Buy | Must | ✅ |
| 10 Oct | F4a | Record hash + Ed25519 signature + signed QR (0006) | Must | ✅ |
| 10 Oct | F4b | Verify a document copy | Must | ✅ |
| 11 Oct | F4c | Hash-chained ledger + tamper demo (0007) | Must | ✅ (F4c-b run + fixed) |
| 11 Oct | U5 | Landing page redesign | Must | ✅ |
| 11 Oct | U6 | Inner pages: login, verify, result, report, QR | Must | ✅ |
| 12 Oct | F2c | Public mutation tracker | Should | ⬜ |
| 12 Oct | U7 | Officer, review, map, admin polish | Should | ⬜ |
| 12 Oct | F5a | Khatian/Porcha parser + samples | Should | ⬜ |
| 13 Oct | F5b | Bangla OCR measurement | Should | ⬜ |
| 13 Oct | F6 / F5c | Plausibility rules / archive search | Could | ⬜ |
| 13 Oct | Q1 | Integration + full regression 🔒 | Must | ✅ |
| 14 Oct | Q2 | Deploy + live smoke + e2e | Must | ✅ (live deploy done by user) |
| 14 Oct | S2 | Demo video ≤ 3 min (user) | Must | ⬜ |
| 15 Oct | S1 | Concept note ≤ 4 p PDF | Must | ✅ (VIDEO_URL after S2) |
| 15 Oct | S3 | Submit Round 1 🔒 | Must | ⬜ |
| TBA | T1 | Final build + "Changes since Round 1" + pitch deck | Should | ⬜ |
| TBA | T2 | Final presentation readiness | Must | ⬜ |

## KICKOFF PROMPT (paste in a new chat with the latest zip)
```text
Unzip the attached project. Read plan.md only, then run `grep -n "^### " roadmap.md` and view ONLY the card for the phase in "Next phase" (plus the roadmap §4 lines it names). Do exactly that card: touch only its files, run only its Test line, no repo exploration. Then update plan.md (STATE + status column) and give me one zip of the whole project.
```

## RULES
1. Budget per phase: ≤ 6 files, ≤ ~200 LOC, ≤ ~25 tool calls. Running out → stop green, mark 🟡, write remaining steps as `<phase>-b` in STATE, zip.
2. Additive only: LP-10001…LP-10500 levels and Doc1→Doc2 HIGH 70 must stay green; no prop/aria/testid renames without updating tests.
3. Zip (repo root): `rm -f frontend/.env.local backend/.env && zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' '*/storage/*' '*.db'`
