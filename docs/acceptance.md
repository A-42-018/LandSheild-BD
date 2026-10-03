# Final acceptance (P60 / Q13) — 2026-10-03

Honest status of the R10 checklist. Demo data only; not a government system.

## Runs in this session (network available, no browser)
| Check | Result |
|---|---|
| Frontend `npm install && npx vitest run` | 310 passed (30 files) |
| `npx tsc --noEmit` | clean |
| `npm run check:i18n` | parity OK (614 keys), no hard-coded JSX strings |
| Backend `pytest -q` (venv, `.[dev]` + `.[ai]`) | 517 passed |
| `ruff check .` | clean |
| Live uvicorn (SQLite, seeded, mock providers, ML on) driven over HTTP | upload Doc1 → process → approve → upload Doc2 → process → approve: both 200; HIGH alerts on LP-10234 (SELLER_MISMATCH 70, POSSIBLE_DUPLICATE_TRANSACTION); `/lands/LP-10234/risk` HIGH 70 with ml_score 0.2067; citizen verification 201 + report 200; `/public/verify/LP-10234` HIGH, counts only, no names/hashes/paths |
| Playwright e2e | NOT run: Chromium download fails (cdn.playwright.dev blocked) |
| `next build`, real browser walk, print preview, Bangla PDF shaping | NOT run (Google Fonts / no browser) |

## R10
- [~] Landing, verify, result, report pages polished (desktop/tablet/mobile) — built + axe/regression tests green; 375/768/1440 browser walk NOT done (docs/ui.md checklist unticked)
- [x] Upload → OCR → extraction → human review → approve (mock fallback) — run live over HTTP and in integration tests
- [x] Ownership history + transactions correct; double-sale detected with evidence — live: Doc2 on LP-10234 → HIGH 70
- [x] Risk score explainable; wording rules pass — risk-wording test green; evidence codes returned
- [x] Officer dashboard, alerts, audit log work; RBAC matrix test green — backend 517 passed incl. tests/security; dashboard UI covered by vitest only
- [x] QR public page leaks no personal data — leak sweep test green + live payload inspected
- [x] EN + BN complete; no hardcoded strings — check:i18n OK (614); real-browser switch only in unrun e2e
- [~] Loading / empty / error states; a11y — axe 0 violations (jsdom); real contrast/keyboard walk NOT done
- [x] AI metrics measured, documented, synthetic-labelled — docs/ai-pipeline.md
- [~] Demo scenarios + 15-step flow rehearsed — API portion run live; UI rehearsal (docs/demo-script.md) NOT done
- [x] README lets a new developer run the demo — `start.sh`; note: `npm ci` needs a refreshed lockfile (done this session via `npm install`)

## Known limitations (carried)
Playwright specs (Q10–Q12) never executed; no real-browser walk; `next build` unverified (Google Fonts); Bangla PDF export unverified; Postgres/Docker (P57) not built; Paddle/VLM providers (P42) not built; mouza/PDF GIS block (P64/P67/P68/P69) skipped — no mouza PDFs supplied; Next 14.2.15 reports an upstream security advisory (upgrade before any real deployment).

## Verdict
Backend and unit-level acceptance: PASS. Browser-level acceptance (e2e, UI walk, demo rehearsal): PENDING — user runs locally:
`cd frontend && npm install && npm run e2e:install && npm run e2e`, then the docs/ui.md walk and docs/demo-script.md rehearsal.
