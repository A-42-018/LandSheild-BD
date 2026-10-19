# Survey Type + JL No. + Map Sheet — Roadmap (SJ1–SJ8)

Status: **not started (written 2026-10-19).** Roadmap only — no code here.
Trigger: mentor feedback:

1. There is no survey type or sheet reference as input. `survey_type` (CS/SA/RS/BS) and `jl_no` are
   only read out of documents. Map sheet refs (`SheetRef.sheet_no`) exist only in the GIS data and
   are never used to look up or check land.
2. Verify has no survey type field. The same khatian number can exist under different surveys
   (CS, RS, BS) in the same mouza, so the lookup can be ambiguous.
3. `land_parcels` has no `jl_no`. Mouza names repeat in Bangladesh, and mouza + JL no. is what
   identifies a mouza uniquely.

> **How to use this file in a session:** do NOT read it whole. Run `grep -n "^### " docs/survey-jl-roadmap.md`,
> then read §2 (decisions, short) and only the card for your phase. Kickoff prompt is in §5.

---

## 1. What the code does today (checked 2026-10-19)

| Area | Today | Where |
|---|---|---|
| Parcel model | `district, upazila, mouza, khatian_no, dag_no` (+ `union`, `office_id`). No `survey_type`, `jl_no` or sheet. Unique on `(district, upazila, mouza, khatian_no, dag_no)`. | `backend/app/models/land_parcel.py` |
| Lookup | `find_by_location()` matches the 5 fields exactly. Used by the signed-in search and the public search. | `backend/app/services/land.py:52`, `services/public.py:112` |
| Search APIs | `GET /lands/search` and `GET /public/lands/search` take only `district, upazila, mouza, khatian, dag`. | `api/v1/lands.py:24`, `api/v1/public.py:78` |
| Parcel creation | `posting.py` creates or matches a parcel on district/upazila/mouza/khatian/dag. It ignores the survey type and JL no. that the extractor already read. | `backend/app/services/posting.py:87-117` |
| Extraction | Khatian/porcha extraction already gives `survey_type` and `extras.jl_no`. | `schemas/extraction.py:39-40`, `services/extraction.py:79` |
| GIS mouzas | `MouzaOut` has `jl_no` and `sheets: list[SheetRef]` (`sheet_no`, `survey`). The data file `database/gis/mouzas.json` is **not shipped**, so the mouza list is empty by default. | `schemas/gis.py:43-61`, `services/gis.py` header |
| Verify form | Five fields. JL shows only as a label in mouza suggestions (`JL 123 · বাংলা নাম`). Not sent, not checked. | `frontend/features/verify/VerifyForm.tsx`, `schema.ts` |
| Survey constants | Backend `SURVEY_TYPES = ("CS","SA","RS","BS")` in `risk/context.py:250`. Frontend `SURVEYS` + `surveys.*` i18n labels already exist for the archive. | `features/archive/ArchiveSearch.tsx`, `messages/*.json` |
| Seed | 12 lands in `database/seed/data.json`, none with survey or JL. | `database/seed/data.json`, `loader.py` |
| Migrations | Last one is `0018_ownership_kind.py`. | `backend/migrations/versions/` |

---

## 2. Decisions (recommended choices; change them before SJ1 if you disagree)

| # | Question | Recommendation | Why |
|---|---|---|---|
| D1 | Where does the survey live? | **Columns on `land_parcels`.** One row = one plot *as recorded in one survey*. A CS plot and its RS successor are two rows. A cross-survey link is optional (SJ9). | Khatian **and** dag numbers are renumbered by each survey, so (khatian, dag) only has a meaning inside one survey. A separate table would cost two extra phases for a demo project. |
| D2 | New columns | `survey_type` (`CS/SA/RS/BS`, nullable for old rows), `jl_no` (string, nullable, stored without leading zeros), `map_sheet_no` (string, nullable). | Nullable lets the migration run on live data without guessing. |
| D3 | New unique key | `(district, upazila, jl_no, mouza, survey_type, khatian_no, dag_no)`. | Same khatian/dag under CS and RS no longer clashes, and neither do two mouzas with the same name. |
| D4 | Is survey required in Verify? | **Required**, with no default. Bangla labels: সিএস / এসএ / আরএস / বিএস. | The citizen's porcha always says which survey it belongs to. A default would hide the ambiguity again. |
| D5 | Is JL required in Verify? | **Optional, auto-filled** when a mouza is picked from the suggestions. Required only when the mouza name is not unique in that upazila. | Most citizens know the mouza name, not the JL. |
| D6 | Sheet no. | **Optional check, not a lookup key.** If given and it differs from the parcel's `map_sheet_no` (or is not one of that mouza's sheets for that survey), show a warning. Do not return 404. | A wrong sheet is a red flag, but it should not hide the record. |
| D7 | Several matches (old rows with no survey/JL) | Return **409 `LAND_AMBIGUOUS`** with a masked list of candidates (`land_id, survey_type, jl_no, mouza`). The UI asks the user to pick one. | This is the bug the mentor described. Never silently pick the first row. |
| D8 | JL source for the demo | A **synthetic** `database/gis/mouzas.json` for the seeded upazilas only, marked "demo data". | The rule book allows no real personal data. Mouza/JL lists are public, but synthetic data keeps the fixtures stable. |

---

## 3. Phases

Phase sizing (same rules as `roadmap.md` §3): **one phase = one new chat**, ≤ 6–8 files, ≤ ~250 LOC,
run only the card's **Test** line (full suites only in 🔒 phases). If the window runs out, stop at a
green state and write the remaining steps as `<phase>-b` in this file's §4 tracker.

| # | Phase | Side | Depends on | Est. |
|---|---|---|---|---|
| SJ1 | Parcel model + migration 0019 + seed | Backend | — | 3–4 h |
| SJ2 | Demo mouza/JL/sheet registry + resolver | Backend | — | 3 h |
| SJ3 | Lookup API: survey, JL, sheet, ambiguity | Backend | SJ1, SJ2 | 4 h |
| SJ4 | Write path: posting + review use survey/JL | Backend | SJ1 | 3–4 h |
| SJ5 | Verify form: survey, JL, sheet inputs | Frontend | SJ3 | 4 h |
| SJ6 | Result pages + ambiguity chooser + sheet warning | Frontend | SJ5 | 4 h |
| SJ7 | Officer/review/admin UI shows and edits survey/JL | Frontend | SJ4 | 3–4 h |
| SJ8 | Gate 🔒 | 🟡 | Done (not run, sandbox has no deps/network): `frontend/e2e/verify-survey.spec.ts` (chooser → result, wrong JL → error, wrong sheet → warning), docs `gis.md` demo-mouza section, README feature line, `demo-script.md` beat D; step 4 re-check done: `docs/api.md` now also lists `MOUZA_AMBIGUOUS` + `LAND_SURVEY_MISMATCH`. Retried 19 Oct: sandbox still has no network (pip/npm fail), so no suite could run. **SJ8-b (needs a machine with deps, no code left to write):** (1) `cd backend && pytest -q` on SQLite, then Postgres (`TEST_DATABASE_URL`); (2) `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint`; (3) `npx playwright test e2e/verify-survey.spec.ts` against the seeded backend with `MOUZA_ENABLED_DIVISION_ID=3` and fix selectors/expectations (the CS clash case assumes 409 `LAND_AMBIGUOUS` for LP-12001 vs legacy LP-12003); (4) Render: migration 0019 backfill on live rows, env var set, live smoke on `/verify`; (5) mark ✅ |
| SJ9 | *(Could)* Cross-survey link CS→SA→RS→BS | Both | SJ8 | 4–5 h |

SJ1 and SJ2 do not touch the same files. They can run on the same day in two separate chats.

---

### SJ1 — Parcel model + migration 0019 + seed (Backend)

**Goal:** `land_parcels` stores `survey_type`, `jl_no` and `map_sheet_no`, and the seed has examples
of the ambiguity.

**Read:** `models/land_parcel.py`, `models/enums.py`, `migrations/versions/0018_ownership_kind.py` (as a template),
`database/seed/loader.py` (the part that builds `LandParcel`), the first 30 lines of `database/seed/data.json`.

**Touch:**
- `backend/app/models/enums.py`: add `SurveyType` enum (CS, SA, RS, BS). Make `risk/context.py`
  `SURVEY_TYPES` reuse it (one-line change).
- `backend/app/models/land_parcel.py`: 3 nullable columns, new `UniqueConstraint` (D3), index on `(mouza, jl_no)`.
- `backend/migrations/versions/0019_parcel_survey_jl.py`: add the columns, drop and recreate the unique
  constraint (use `batch_alter_table` so SQLite works). **Backfill:** for each parcel, take `survey_type`
  and `extras.jl_no` from its newest khatian/porcha document extraction, if there is one. Otherwise leave NULL.
- `database/seed/data.json` + `loader.py`: give all 12 lands a survey + JL + sheet. Add **3 demo lands**:
  (a) same mouza, same khatian/dag as LP-10001 but `CS` (survey clash);
  (b) a second "Ashulia" mouza in another upazila or union with a different JL (name clash);
  (c) one legacy row with survey/JL NULL (shows the 409 chooser later).
- `backend/tests/test_land_survey_model.py`: unique key allows (a) and (b) and rejects a true duplicate.
  The migration upgrades and downgrades on SQLite.

**Done when:** `alembic upgrade head` then `downgrade -1` then `upgrade head` all work, the seed loads,
and the tests are green.
**Test:** `cd backend && pytest tests/test_land_survey_model.py tests/test_seed*.py -q`
(+ the same with `TEST_DATABASE_URL` on local Postgres if there is time).

---

### SJ2 — Demo mouza / JL / sheet registry + resolver (Backend)

**Goal:** the backend can answer "is JL X really mouza Y in upazila Z?" and "which sheets does this
mouza have for survey S?".

**Read:** `services/gis.py` (header, `_mouzas()`, mouza search ~L120–240), `schemas/gis.py:43-90`,
`core/config.py` (`MOUZA_ENABLED_DIVISION_ID`, `gis_data_dir`).

**Touch:**
- `database/gis/mouzas.json`: synthetic rows for the upazilas used in the seed: `id, upazila_id, union_id,
  name, bn_name, jl_no, sheets:[{sheet_no, survey, plots}]`. Include the duplicate "Ashulia" from SJ1(b).
  Add a `"_note": "synthetic demo data"` header field.
- `scripts/build_gis_data.py` *(only if it overwrites the folder)*: leave `mouzas.json` alone.
- `backend/app/services/gis.py`: add `resolve_mouza(district, upazila, mouza, jl_no=None)`. It returns the
  one matching mouza, or raises `MOUZA_NOT_FOUND` (404), `MOUZA_AMBIGUOUS` (409, with the JL options) or
  `JL_MISMATCH` (422). Add `sheets_for(mouza_id, survey)`. Compare JL without leading zeros and with Bangla digits converted.
- `backend/app/api/v1/gis.py` + `schemas/gis.py`: `GET /gis/mouzas/resolve?district&upazila&mouza&jl_no`
  (public, read-only). The frontend uses it in SJ5.
- Demo config: turn on the demo division in `.env.example` / `render.yaml` (document it, do not change secrets).
- `backend/tests/test_gis.py`: add resolver cases (unique, name clash, wrong JL, Bangla digits, leading zeros).

**Done when:** the resolver tests pass and the existing GIS tests still pass with the file present.
**Test:** `cd backend && pytest tests/test_gis.py -q`

---

### SJ3 — Lookup API: survey, JL, sheet, ambiguity (Backend)

**Goal:** Verify searches can no longer be ambiguous (mentor gap 2).

**Read:** `services/land.py`, `services/public.py:100-140`, `api/v1/lands.py:20-40`, `api/v1/public.py:75-100`,
`schemas/land.py`, `schemas/public.py` (`PublicLandSummary`), `core/errors.py`.

**Touch:**
- `services/land.py` `find_by_location(..., survey_type=None, jl_no=None, sheet_no=None)`:
  1. If `jl_no` is given, check it with `gis.resolve_mouza` (422 `JL_MISMATCH`).
  2. Query by the 5 old fields + `survey_type` (match the given value **or NULL**) + `jl_no` (the same).
  3. 0 rows → 404. 1 row → return it. More than 1 → 409 `LAND_AMBIGUOUS`, `details.candidates=[{land_id, survey_type, jl_no, mouza}]`
     (no owner names).
  4. `sheet_no` given and different from the parcel's sheet, or not in `sheets_for(...)` → add a
     `warnings: ["SHEET_MISMATCH"]` to the response (D6).
- `api/v1/lands.py` + `api/v1/public.py`: new query params `survey` (enum, required), `jl_no`, `sheet_no`
  (optional). For one release, accept a missing `survey` but return 409 when that makes the result ambiguous.
- `schemas/land.py` (`LandPublic`) + `schemas/public.py` (`PublicLandSummary`): add `survey_type, jl_no, map_sheet_no, warnings`.
- `services/land.py` `_to_public` and the public summary builder: fill the new fields.
- `backend/tests/test_land_search_survey.py`: CS vs RS clash → 409 without a survey, 200 with one; wrong JL → 422;
  the same mouza name with two JLs → 409 with no JL, 200 with JL; wrong sheet → 200 + warning; the public
  endpoint never leaks owners in `candidates`.
- `docs/api.md`: document the params and the error codes.

**Done when:** the new tests and the old search tests are green.
**Test:** `cd backend && pytest tests/test_land_search_survey.py tests/test_public*.py tests/test_land*.py -q`

---

### SJ4 — Write path: posting + review use survey/JL (Backend)

**Goal:** new parcels created from documents get a survey and JL, and a document cannot attach to the
parcel of another survey.

**Read:** `services/posting.py:40-130`, `services/review.py:60-100`, `services/extraction.py:70-100, 195-210`,
`risk/context.py:250-275`.

**Touch:**
- `services/posting.py`: read `survey_type` and `extras.jl_no` from the reviewed extraction. Match candidates on
  survey + JL as well (NULL on the parcel still matches, and the parcel is then **filled in**). Create new
  parcels with both. If a document's survey differs from the target parcel's → 409 `LAND_SURVEY_MISMATCH`.
  For deeds (no survey on the document), take the survey from the parcel the officer chose.
- `services/review.py`: make `survey_type` (and `jl_no` for khatian/porcha) part of the review payload, so an
  officer can correct them before posting.
- `risk/context.py`: use `land.survey_type` as a fallback for documents that have no survey of their own.
- `backend/tests/test_posting_survey.py`: create a parcel with survey/JL, fill in a legacy parcel, the mismatch
  → 409, and a deed inherits the parcel's survey.

**Done when:** the new tests and the existing posting/review tests are green.
**Test:** `cd backend && pytest tests/test_posting_survey.py tests/test_review*.py tests/test_documents.py -q`

---

### SJ5 — Verify form: survey, JL, sheet inputs (Frontend)

**Goal:** the citizen gives the survey (required), the JL (auto-filled) and the sheet (optional) (mentor gaps 1–3).

**Read:** `features/verify/VerifyForm.tsx`, `features/verify/schema.ts`, `features/archive/ArchiveSearch.tsx`
(lines with `SURVEYS`), `features/map/gis/useGis.ts`, `messages/en.json` `verify` + `archive.surveys` blocks.

**Touch:**
- `features/verify/schema.ts`: `survey: z.enum(["CS","SA","RS","BS"])`, `jl_no` (optional, digits, Bangla
  digits converted), `sheet_no` (optional, ≤ 20 chars).
- `features/verify/VerifyForm.tsx`:
  - a **Survey** `<Select>` after Mouza, reusing `SURVEYS` + labels (move `SURVEYS` to `lib/` if it is local to the archive);
  - picking a mouza suggestion sets `jl_no` from `m.jl_no`. Show the JL field read-only with an "edit" link.
    When the typed mouza name matches 2+ suggestions with different JLs, make JL required and list the choices;
  - a **"More details (optional)"** disclosure with the **Map sheet no.** field;
  - add `survey, jl_no, sheet_no` to `FIELDS`, `query()` and the URL prefill / auto-run;
  - compact hero: add only the Survey select (JL is filled from the mouza pick).
- `messages/en.json` + `messages/bn.json`: labels, hints ("Printed at the top of your khatian: আর.এস. খতিয়ান"),
  errors (`surveyRequired`, `jlMismatch`, `jlNeeded`).
- `features/verify/verify.test.tsx`: survey required; picking a mouza fills JL; a name clash forces JL;
  query string contains the new params; prefill from the URL.

**Done when:** the vitest file is green and `tsc --noEmit` has no new errors.
**Test:** `cd frontend && npx vitest run features/verify && npx tsc --noEmit`

---

### SJ6 — Result pages + ambiguity chooser + sheet warning (Frontend)

**Goal:** the user sees which survey/JL the record is from, and is never shown the wrong one silently.

**Read:** `features/verify/PublicSummary.tsx`, `features/result/LandInfoCard.tsx`, `features/result/types.ts`,
`lib/api.ts` (`ApiError` shape), the `onError` handling in `VerifyForm.tsx`.

**Touch:**
- `features/verify/AmbiguousChooser.tsx` (new): on `409 LAND_AMBIGUOUS` / `MOUZA_AMBIGUOUS`, show the
  candidates ("This khatian exists in CS and RS. Which one is on your document?"). Picking one re-runs the
  search with that survey/JL, or goes straight to `land_id` when signed in.
- `features/verify/VerifyForm.tsx`: send those errors to the chooser. Show `JL_MISMATCH` next to the JL field.
- `features/verify/PublicSummary.tsx` + `features/result/LandInfoCard.tsx` + `types.ts`: show
  Survey · JL · Sheet. If `warnings` has `SHEET_MISMATCH`, show an amber notice ("The sheet number you gave
  does not match this plot. Check the document.").
- `messages/*.json`: chooser and warning strings.
- Tests: `features/verify/verify.test.tsx` (chooser flow), `features/result/result.test.tsx` (new fields + warning).

**Done when:** both test files are green, and a manual run against the seed shows the chooser for LP-10001
when no survey is given.
**Test:** `cd frontend && npx vitest run features/verify features/result`

---

### SJ7 — Officer / review / admin UI shows and edits survey/JL (Frontend)

**Goal:** officers can see and fix the survey and JL before a record is posted, so the data stays clean.

**Read:** `features/review/types.ts` (has `jl_no?: Leaf<string>`), the khatian review section component,
`features/review/deed/ScheduleSection.tsx`, `features/admin/RecordsPanels.tsx`, `features/mutation/MutationDetail.tsx` (header only).

**Touch:**
- The khatian/porcha review section: an editable **Survey** select + **JL** input with a check against
  `/gis/mouzas/resolve` (green tick or an error).
- `features/review/deed/ScheduleSection.tsx`: show the chosen parcel's survey/JL (read-only).
- `features/admin/RecordsPanels.tsx` + `features/mutation/MutationDetail.tsx`: add Survey + JL columns or labels.
- `messages/*.json`.
- Tests: the review test file + `features/admin/admin.test.tsx` (new columns).

**Done when:** an officer can correct the survey on a khatian and post it, and the parcel gets that survey.
**Test:** `cd frontend && npx vitest run features/review features/admin features/mutation`

---

### SJ8 — Gate: e2e, Postgres, docs, deploy check 🔒 (Both)

**Goal:** everything works together on both databases and on the live site.

**Steps:**
1. Full backend suite on SQLite, then on local Postgres (`TEST_DATABASE_URL`, see the memory notes / `docs/testing`).
2. Full frontend suite + `tsc` + lint.
3. Playwright: add `e2e/verify-survey.spec.ts` covering a clash → chooser → result, a wrong JL → error,
   and a wrong sheet → warning.
4. Docs: `docs/api.md` (already done in SJ3, re-check), `docs/gis.md` (demo mouza file), `README.md`
   feature list, `docs/demo-script.md` (a 20-second "same khatian, two surveys" demo beat).
5. Deploy: confirm that migration 0019 runs on Render (backfill on live rows) and that the demo division
   env var is set. Live smoke on `/verify`.
6. Update the §4 tracker below.

**Test:** `cd backend && pytest -q` · `cd frontend && npx vitest run && npx playwright test e2e/verify-survey.spec.ts`

---

### SJ9 — *(Could)* Cross-survey link CS → SA → RS → BS (Both)

**Goal:** show that RS dag 245 came from CS dag 112, so the chain of title can go across surveys.

**Sketch:** a `parcel_survey_links(from_land_id, to_land_id, kind=successor|split|merge)` table (migration 0020).
Officers add links from the parcel page. The `survey_chain` risk rule uses linked parcels as well as the
owner names. The result page gets a "Previous surveys" strip. Do this only if SJ1–SJ8 are done and there
is time before the final round.

---

## 4. Tracker

| # | Phase | Status | Notes |
|---|---|---|---|
| SJ1 | Model + migration 0019 + seed | ✅ | `survey_type/jl_no/map_sheet_no` on `land_parcels` + `SurveyType` enum, migration 0019 (backfill from khatian/porcha extractions, new unique key D3), 12 lands tagged + 3 demo lands (LP-12001..3); tests: test_land_survey_model + test_seed* + test_models_a (30 passed, SQLite; Postgres not run) |
| SJ2 | Mouza/JL/sheet registry + resolver | ✅ | synthetic `database/gis/mouzas.json` (5 mouzas incl. both Ashulias, sheets per survey), `gis.resolve_mouza/sheets_for/norm_jl`, `GET /gis/mouzas/resolve`, `MOUZA_ENABLED_DIVISION_ID=3` in .env.example + render.yaml; tests: test_gis.py (24 passed, 7 new resolver cases, SQLite) |
| SJ3 | Lookup API + ambiguity | ✅ | `find_by_location` takes survey/JL/sheet (409 `LAND_AMBIGUOUS` with owner-free candidates, 422 `JL_MISMATCH`, `SHEET_MISMATCH` warning), public + signed-in endpoints and schemas carry `survey_type/jl_no/map_sheet_no/warnings`, `docs/api.md` updated; SJ3-b: tests set `MOUZA_ENABLED_DIVISION_ID=3`, `test_public_land_search.py` KEYS extended and LP-10001 (same khatian/dag as demo lands LP-12001/12003) now expects 409; tests: `pytest tests/test_land_search_survey.py tests/test_public*.py tests/test_land*.py` → 76 passed, 2 skipped (SQLite) |
| SJ4 | Posting + review write path | ✅ | `posting._resolve_land` matches on survey + JL (NULL still matches and is filled in, exact survey beats legacy, several → 409 `LAND_AMBIGUOUS`), new parcels get both, other survey/JL → 409 `LAND_SURVEY_MISMATCH`, deed inherits the parcel's survey; `ExtractionPatch` accepts `survey_type` + `jl_no` for officer correction; risk context falls back to `land.survey_type`; tests: `pytest tests/test_posting_survey.py tests/test_review*.py tests/test_documents.py` → 46 passed (SQLite) |
| SJ5 | Verify form inputs | ✅ | Survey select (required, no default; `SURVEYS` moved to `lib/surveys.ts`), JL auto-filled from the mouza pick (read-only + edit link; required Select when a name has 2+ JLs), "More details" disclosure with sheet no.; `survey/jl_no/sheet_no` in schema, `FIELDS`, query string, URL prefill/auto-run; hero shows Survey only; `JL_MISMATCH` message; en + bn strings; also updated `features/landing/landing.test.tsx` hero test (survey now required); tests: `vitest run features/verify features/landing` → 44 passed, `tsc --noEmit` clean; e2e specs not run (SJ8 gate) |
| SJ6 | Result pages + chooser + warning | ✅ | new `features/verify/AmbiguousChooser.tsx` (LAND_AMBIGUOUS candidates / MOUZA_AMBIGUOUS options; signed in → opens `land_id`, visitor → re-runs public search with survey/JL), `VerifyForm` routes both 409s to it, `PublicSummary` + `LandInfoCard` show Survey · JL · Sheet and an amber `SHEET_MISMATCH` notice (`SheetWarning`), `types.ts` + en/bn strings; note: the signed-in search redirect to `/verify/result?land_id=` does not carry `warnings`, so the notice shows only where the response has it; tests: `vitest run features/verify features/result` → 58 passed, `tsc --noEmit` clean; manual seed run not done (SJ8 gate) |
| SJ7 | Officer/review/admin UI | ✅ | new `features/review/SurveyJlPanel.tsx` on khatian/porcha review (survey select + JL input, JL checked via `/gis/mouzas/resolve`, saves `survey_type`/`jl_no` through the extraction PATCH); deed `ScheduleSection` shows the linked parcel's survey/JL read-only; Survey + JL columns in admin land records and on the mutation detail; en + bn strings; backend gap closed with additive optional fields `survey_type`/`jl_no` on `ExtractionOut`, `AdminLandRecord`, `MutationDetail` (backend only compiled, pytest not run: deps missing); tests: `vitest run features/review features/admin features/mutation` → 160 passed, `tsc --noEmit` clean |
| SJ8 | Gate 🔒 | 🟡 | Done (not run, sandbox has no deps/network): `frontend/e2e/verify-survey.spec.ts` (chooser → result, wrong JL → error, wrong sheet → warning), docs `gis.md` demo-mouza section, README feature line, `demo-script.md` beat D; step 4 re-check done: `docs/api.md` now also lists `MOUZA_AMBIGUOUS` + `LAND_SURVEY_MISMATCH`. Retried 19 Oct: sandbox still has no network (pip/npm fail), so no suite could run. **SJ8-b (needs a machine with deps, no code left to write):** (1) `cd backend && pytest -q` on SQLite, then Postgres (`TEST_DATABASE_URL`); (2) `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint`; (3) `npx playwright test e2e/verify-survey.spec.ts` against the seeded backend with `MOUZA_ENABLED_DIVISION_ID=3` and fix selectors/expectations (the CS clash case assumes 409 `LAND_AMBIGUOUS` for LP-12001 vs legacy LP-12003); (4) Render: migration 0019 backfill on live rows, env var set, live smoke on `/verify`; (5) mark ✅ |
| SJ9 | Cross-survey link (Could) | ⬜ | |

---

## 5. Kickoff prompt (same text every session; attach the latest zip)

```text
Unzip the attached LandShield BD project. Work from docs/survey-jl-roadmap.md only. Do NOT read plan.md, roadmap.md or the whole roadmap file.
1. Pick the phase: run `grep -nE "^\| SJ[0-9]+ .*(⬜|🟡|✅)" docs/survey-jl-roadmap.md` to see the §4 tracker. If a row is 🟡, continue it (do the SJ<n>-b steps written in its Notes). Otherwise take the first ⬜ row from top to bottom. If only SJ9 (optional) is left, ask me before starting it. Tell me which phase you picked before starting.
2. Run `grep -n "^### \|^## " docs/survey-jl-roadmap.md`, then read only §2 (Decisions) and that phase's card.
3. Do exactly that card: read only its Read list, change only its Touch list, no other repo exploration. Run only its Test line (set up the backend/frontend as in roadmap.md §3 "Sandbox notes" only if the test needs it).
4. If the session is running out: stop at a green state, mark the phase 🟡 in §4 and write the remaining steps in its Notes as SJ<n>-b.
5. When done: mark the phase ✅ in §4 with a one-line note of what changed and what tests ran, then give me ONE zip of the whole project, made from the project root with:
zip -qr ../landshield.zip . -x 'node_modules/*' '*/node_modules/*' '*/.venv/*' '*__pycache__*' '*/.next/*' '.git/*' 'storage/*' '*/storage/*' '*/e2e-storage/*' '*.db' '*.env' '*/.env.local' '*.DS_Store' '*/test-results/*' '*.tsbuildinfo' '*.egg-info/*' 'ai/tessdata/*'
6. Finish with the list of files you changed and a suggested commit message "SJ<n>: <summary>".
```
