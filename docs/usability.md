# LandShield BD — Usability validation kit (U6, Phase 6 of `docs/ui-ux-roadmap.md`)

Phase 6 says: repeat the §7 usability tests with the same tasks, compare with the Phase 0 numbers, and show before/after numbers and screenshots to the mentor. This file is the kit for that. **No session with a real person has been run yet**, and no U0.4 baseline exists in the repo. Both tables below are empty until someone runs them.

## 1. What is done and what is not

| Part | Status |
|---|---|
| Five tasks scripted and driven end to end as an anonymous Bangla visitor at 360 × 800 touch (`frontend/e2e/validate.spec.ts`) | Done, all pass |
| Screenshots of each task's key screen (`docs/usability/after/*.png`) | Done |
| Automatable lines of the §8 checklist (below) | Done, 2 fixes made, 1 finding left |
| Scoring script and template sheets | Done (`frontend/scripts/usability-score.mjs`, `docs/usability/templates/`) |
| U0.4 baseline: 5 participants on the **pre-U1** build | **Not done.** Needs people and the old build (`main` has none of the U0–U5 branches, so it is the "before" build) |
| After run: 5–8 participants on this build | **Not done.** Needs people |
| Mentor hand-off (numbers + screenshots) | Waits for the two rows above |

The automated run proves the tasks can be finished and how many actions they take. It cannot say whether a farmer understands the words. That is what the sessions are for.

## 2. Run the sessions

**Who (5–8):** a farmer or rural landowner, a person aged 60+, a first-time land buyer, a smartphone-only user with low literacy, a law or land-office student who acts as the reviewer (task 5 only).

**Setup:** one phone per participant, Bangla selected, the build under test. Run the baseline on the old build and the after run on this one, with the same task wording, the same data and, where you can, the same people (a new group also works but say so in the report). Seed: `python scripts/seed.py`. Use the data in the table.

| Task | Wording read to the participant (do not say where to tap) | Data | Success when |
|---|---|---|---|
| T1 | "এই খতিয়ান নম্বরের জমির মালিক কে, জমিতে কোনো মামলা আছে কি?" | Dhaka · Savar · Ashulia · khatian 501 · dag 101 | They read out the owner (masked) and the case line, without help |
| T2 | "আপনার নামজারি আবেদন কোন ধাপে আছে?" | `MUT-2023-0007` on a card | They name the current step or say it is decided |
| T3 | "১০ শতাংশ জমি কত কাঠা?" | – | They say about 6 (৬.০৫) |
| T4 | "এই দলিলের QR কোডটি আসল কি না যাচাই করুন।" | Printed QR of `LP-10240` (or its link) | They say whether the seal matches and what the risk level is |
| T5 | Reviewer: "একটি নথি অনুমোদন করুন, আরেকটি কারণ লিখে প্রত্যাখ্যান করুন।" | Two uploaded samples, reviewer account | One approved, one rejected with a reason |

**Per task, the observer writes** (one row per participant per task in `tasks.csv`): `success` (1 or 0), `seconds` (read the task aloud → participant says they are done), `wrong_clicks` (taps that did not move toward the goal), and a `quote` for every word they did not understand. Stop a task at 3 minutes and mark it 0. After task 5 the participant fills the 10 SUS statements (`sus.csv`, 1 = strongly disagree … 5 = strongly agree, in Bangla).

Rules for the observer: say nothing about the screen, never point, write down words not clicks when they speak. A hint ends the task as a fail. Get consent and do not record names; use P1, P2, …

## 3. Score and compare

```bash
mkdir -p docs/usability/baseline            # tasks.csv + sus.csv, copied from docs/usability/templates/ (delete the sample row)
cd frontend && node scripts/usability-score.mjs ../docs/usability/baseline ../docs/usability/after
```

It prints the table below plus the §7 targets (success ≥ 90 %, SUS ≥ 75). Paste its output here.

| Task | Success before → after | Median s before → after | Wrong clicks before → after |
|---|---|---|---|
| T1 | _to fill_ | _to fill_ | _to fill_ |
| T2 | | | |
| T3 | | | |
| T4 | | | |
| T5 | | | |

SUS before → after: _to fill_. Words they did not understand: add to the glossary in `docs/ui.md` and fix in `messages/bn.json`.

## 4. Automated pass (2026-10-17, build = `u6-validate`, 360 × 800, touch, Bangla)

```bash
cd frontend && USABILITY=1 PW_CHANNEL=chrome PATH="<repo>/backend/.venv/bin:$PATH" npx playwright test validate.spec.ts
```

Output: `docs/usability/after/automated.json` and the screenshots. "Actions" = taps, typed fields and picked options on the shortest path. "Seconds" is script time, not human time.

| Task | Result | Actions | Screenshot |
|---|---|---|---|
| T1 public search from the home page | masked summary, sign-in prompt for the full report | 6 | `t1-search-summary.png` |
| T2 track from the home page | status + stepper | 3 | `t2-track-status.png` |
| T3 units | "কাঠা ৬.০৫০০১" | 2 | `t3-units-table.png` |
| T4 QR link | public QR page with the risk word | 3 | `t4-qr-verdict.png` |
| T5 reviewer | one approved, one rejected with a reason | 4 | `t5-review-review-screen.png`, `t5-review-reject-dialog.png` |

### §8 checklist, automatable lines

| Line | Result |
|---|---|
| A visitor can search, track and verify a QR from the home page without logging in | Pass (T1, T2, T4 ran anonymously) |
| No Latin digits or jargon in the Bangla UI | 12 public pages: pass after the fix below. Map scale bar still shows "100 km" (known, see below) |
| Every page works at 360 px, no sideways scroll, 48 px targets | 12 public pages: pass after the fixes below |
| Each role lands on its own home; every result shows "এখন আপনার করণীয়"; notices and FAQ editable by admin; WCAG 2.2 AA audit; text-size control | Not covered here. Covered by U2.4, U3.x, U5.4 and their tests |
| Usability success ≥ 90 % and SUS ≥ 75 | **Open**: needs the sessions in §2 |

### Findings from the pass, and what was done

| Finding | Where | Fix |
|---|---|---|
| The hero's track tab landed on `/track?no=…`, the API answered 200 and nothing showed. React Strict Mode (dev) drops the first request's result | `features/track/TrackView.tsx` | The arrival effect now re-arms in its cleanup. Dev only; production ran the effect once |
| Home "ধাপ 1:" and the 1–5 step badges used Latin digits in Bangla | `features/landing/Sections.tsx` | `localDigits` |
| Top-strip buttons (A− A A+, contrast) were 32 px on touch: `min-h-8` outranked the global 48 px net | `components/TopStrip.tsx` | `[@media(pointer:coarse)]:min-h-touch`, same pattern as the notice ticker |
| Three "more" links on the home page were 29 px, footer brand link 40 px | `features/landing/Sections.tsx`, `Footer.tsx` | `min-h-touch` |
| Verify-document file button was 44 px (`file:min-h-11`; the net skips file inputs) | `VerifyDocumentView.tsx`, `UploadForm.tsx` | `file:min-h-touch` |
| Leaflet zoom buttons were 30 px on touch: `leaflet.css` won on cascade order | `app/globals.css` | Selector now `.leaflet-container.leaflet-touch …` |
| **Open:** map scale bar "100 km" uses Latin digits in Bangla | `/map` | Already fixed on branches `u4.2-map-bn-digits` and `u4.3-map-readout-bn-digits`, which are not in this base. Merge them |
| **Open, low:** mouza names stay Latin in Bangla ("Ashulia" on the T1 summary) | seed data | Names come from the data. Needs Bangla names in the seed or a name map |

## 5. Hand-off to the mentor

When §3 is filled: attach the table, the screenshots in `docs/usability/after/`, the SUS before → after, and the list of words people did not understand with what changed. State plainly if any target was missed.
