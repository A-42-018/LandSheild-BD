# GIS map (P61–P66)

Bangladesh map at `/map`: street basemap and Division → District → Upazila boundaries for the whole country (map viewing only).
Unions, mouzas (JL no.) and survey sheets with links to scanned maps are on their own page, `/mouza-map` (see "Mouza map page" below), for the divisions in `MOUZA_ENABLED_DIVISION_ID`.
Everything is a **sample**: *Demo Dataset — Not an Official Government Land Record*.

## Decisions (P61)
| Question | Decision |
|---|---|
| Demo division | Khulna → Bagerhat → Kachua (the reference portal's sample). Chosen by setting, never hard-coded. |
| Union-wise mouza list | Mouza name, JL no. and survey sheet numbers from the Ministry of Land's **Smart Bhumi Naksha** ([map.land.gov.bd](https://map.land.gov.bd)), stored in `database/gis/mouzas.json`. Mouza polygons are not drawn yet. |
| Sample data | Allowed, must be labelled demo. The 7 P50 parcels stay synthetic. |
| Boundary source | `ifahimreza/bangladesh-geojson` (compiled data **ODbL**; polygons derived from **geoBoundaries gbOpen ADM3, CC BY 4.0**). Third-party, simplified, **not official**. |
| Basemap | OpenStreetMap standard tiles by default (demo traffic only; © OpenStreetMap contributors, ODbL). `NEXT_PUBLIC_MAP_TILE_URL=off` gives a blank offline map; set your own tile server for real use. |
| Storage | Static GeoJSON files in `database/gis/` served by `/api/v1/gis/*` (no DB tables, no PostGIS). |

## Data
`python scripts/build_gis_data.py [--src DIR]` (needs `pip install shapely`; downloads the 4 source files when `--src` is empty) writes
`database/gis/{divisions,districts,upazilas}.geojson` (≈1.7 MB total, coordinates rounded to 4 decimals).
Result: 8 divisions, 64 districts (dissolved from upazila polygons), 544 upazila/thana polygons.
**Known gaps:** 88 polygons (mostly city thanas, e.g. Dhaka/Chattogram metropolitan areas) have no Bangla name in the source and show the English name only; their ids are `g<n>`, and their district is the nearest matched polygon's district. Unit boundaries below upazila are not included.

## API (all `ANY_AUTH`, read-only)
`GET /gis/capabilities` · `/gis/divisions` · `/gis/districts?division_id=` · `/gis/upazilas?district_id=` · `/gis/unions?upazila_id=` · `/gis/mouzas?upazila_id=[&union_id=]` (sorted by JL no.; both empty + `enabled:false` outside the demo division) · `/gis/search?q=` (English or Bangla, NFC-normalised, max 20 hits; in the demo division it also matches union names, mouza names and JL numbers).
Never returns more than one level of one parent (largest payload ≈ 0.3 MB).

## Union-wise mouza list (P64)
Source: **Ministry of Land, Government of Bangladesh: Smart Bhumi Naksha, [map.land.gov.bd](https://map.land.gov.bd)**. This is public administrative reference data (no owner or khatian data).

`python scripts/build_mouza_data.py [--division 40] [--cache DIR] [--delay 0.3]` (stdlib only) reads the lookups the portal's own search menu uses:

| Portal call | Gives |
|---|---|
| `POST /getAdminByCode` `level=forThana` / `forUnion` | upazilas and unions with BBS geo codes, English + Bangla names |
| `POST /getGeomByCode` `level=forUnion` | union boundary (WKT) |
| `POST /getAdminByCode` `level=forMauza` | mouzas of an upazila: `"001-Alipur"` = JL no. + name |
| `POST /getGeomByCode` `level=forMauza` | the mouza's plots, each with `jl_no_en`, `sht_no_en` and survey (`…_RS`) |

- **Union of a mouza:** the portal does not link mouzas to unions, so the script puts each mouza in the union that holds most of its plots (point-in-polygon on the portal's union boundaries). A mouza with no digitised plots keeps `union_id: null` and is still listed under its upazila.
- **Sheets:** each `{sheet_no, survey, plots}` is one survey map sheet (e.g. `RS 001`, 40 plots).
- **Upazila match:** portal upazilas are matched to this app's `upazilas.geojson` ids by district + English name.
- **Coverage:** only upazilas the portal has digitised. Run with `--division 10,20,30,40,50,55,60` for every division; the API still serves only `MOUZA_ENABLED_DIVISION_ID`.
- Raw responses are cached in `storage/mouza_cache/` (git-ignored), so reruns don't hit the portal again.

### Second source: DLRS (surveys in progress)
**Directorate of Land Records and Survey, Ministry of Land: Online Land Record and Survey System, [settlement.gov.bd](https://settlement.gov.bd)** (khatian-search menu). `build_mouza_data.py` also reads, for `--dlrs-division 020000000` (Khulna):

| DLRS call (`POST /Khatian/…`) | Gives |
|---|---|
| `getdistrictlistdivisionwise`, `GetSurveyListDistrictWise` | districts and the survey in progress (RS / BRS / BDS) |
| `GetThanaListBySurvey` | upazilas with that survey |
| `GetMouzaListBySurvey` | mouza name (Bangla) and 9-digit code; the last 3 digits are the **JL no.** |
| `GetSheetListBySurvey` | survey sheet numbers of the mouza |

DLRS names **no union** and gives **Bangla names only**, so these mouzas have `union_id: null` and `name == bn_name`, and the menu lists them under the upazila with a note. Each carries `source_url`. Upazilas are matched to this app's ids by Bangla district + upazila name.

### Coverage (Khulna division, `MOUZA_ENABLED_DIVISION_ID=4`)
17 of the division's upazilas, 197 mouzas: Kachua and Dacope with unions (map.land.gov.bd, 106 mouzas); Sreepur, Mohammadpur (Magura), Lohagara, Kalia (Narail), Shailkupa, Maheshpur (Jhenaidah), Shyamnagar, Tala (Satkhira), Morrelganj, Mollahat, Chitalmari (Bagerhat), Batiaghata, Koyra, Paikgachha, Terokhada (Khulna) from DLRS (91 mouzas, 425 sheets: only the mouzas whose survey is in progress, a few per upazila). **No data on either portal** for Jashore, Kushtia, Chuadanga, Meherpur districts or the other upazilas. Both portals were probed; district portals and the web searches found no machine-readable mouza/JL lists.

File shape: `{"source","source_url","sources":[{"name","url"}],"retrieved","unions":[{"id","upazila_id","name","bn_name"}],"mouzas":[{"id","upazila_id","union_id","code","name","bn_name","jl_no","lat","long","plot_count","source_url","sheets":[{"sheet_no","survey","plots"}]}]}`.

## Mouza map page (`/mouza-map`)
Available to every signed-in role (nav item **Mouza map**; the GIS API is `ANY_AUTH`). It uses the same `/gis/*` endpoints as the parcel map; nothing new on the backend.

- **Find:** Division → District → Upazila → Union dropdowns (cascading, each clears the ones below) and a place/mouza/JL search. A mouza search hit selects its upazila and union and opens the mouza.
- **List** (`features/mouza/`): one upazila's mouzas, 25 per page, filtered in the browser (the API sends the whole upazila in one request; the largest has about 1,100 mouzas, under 1 MB).
  - Filter: name (English or Bangla) or exact JL no. (leading zeros and Bangla digits ignored), survey type (CS → SA → RS → BS …, with a mouza count each), and "only mouzas with a scanned map". The survey filter also limits which sheets each row shows.
  - Sort dropdown: JL no., name, number of sheets, each both ways. The column headers sort the same way. Ties fall back to JL no., then name; Bangla names sort by the Bangla name in the Bangla UI.
- **Download PDF:** a sheet with a `url` (a mouzamap.tech scan) is a button that saves the PDF to the device. The page never navigates to the scan site: the button calls `GET /gis/scan?url=` (any signed-in role, bearer token), the backend fetches the file and streams it back as `application/pdf` with `Content-Disposition: attachment`, and the browser saves it as e.g. `Alipur (আলীপুর) JL 001 BS 001.pdf`. A sheet without a `url` (official-portal sheet numbers) shows as plain text. Clicking a mouza name, or "+N more", opens a dialog with every sheet grouped by survey. While a download runs the button is disabled with a spinner; failures show a message (generic, rate limited, or no longer available) and can be retried.
- **How `/gis/scan` gets the file** (`backend/app/services/scans.py`): free.mouzamap.tech is a Google-Drive index, and a plain GET of a file path is not a download. The backend POSTs the file path, which returns JSON with a signed, short-lived `/download.aspx?...` link, then GETs that link and relays the bytes. Nothing is stored or modified. The scan site's own viewer page (`?a=view`, the `url` stored in `mouzas.json`) is accepted as input and its query is dropped.
- **Safeguards:** only `https://free.mouzamap.tech/<drive>:/.../<name>.pdf` is accepted (no other host, port, user info or `..`; 400 `SCAN_URL_INVALID`), redirects are never followed, and the second request must be the site-relative `/download.aspx?` link from the first answer. The response must be `application/pdf`, at most 100 MB (a stream that outgrows the limit is aborted, not truncated). Upstream failures are a clean 502 (`SCAN_UNAVAILABLE`, `SCAN_TOO_LARGE`), a missing file is 404, and each user is limited to `SCAN_RATE_LIMIT_PER_MIN` (default 20) downloads a minute. The scan site is third party and unofficial, so the page says LandShield BD passes the file through unchanged and does not store, check or guarantee it.
- **Phones:** the table shrinks to the screen (`Table compact`) and the union moves under the mouza name.
- **Known data limits:** the scan index and the official lists spell names differently and number mouzas differently in the old surveys; how scans are matched to mouzas, and what still shows as two rows, is described in "Matching scans to mouzas" below. Sheets labelled `Unknown` have a JL no. but no survey type in the source. A mouza can list two scans of one sheet number (302 do); the second is shown as `RS 001 (2)`.

## Not done yet
Mouza layer/polygons, in-page PDF viewer (scans open on mouzamap.tech), plot selection (the portal has plot numbers; not imported), parcel ↔ land-record links on real sheets (P64, P67, P68); `next build` not run (Google Fonts need network); browser walk with real OSM tiles not done.

## Barishal division (`MOUZA_ENABLED_DIVISION_ID=4,3,1`)
Added the same way as Dhaka: `python scripts/build_mouza_data.py --division 40,30,10 --dlrs-division 020000000,010000000,060000000` (map.land.gov.bd 10 = Barishal, DLRS 060000000 = Barishal), then `python scripts/build_mouzamap_index.py --root 4:/` (free.mouzamap.tech drive `4:/` = Barishal; `--root` is repeatable and only replaces the entries of the given roots) and `python scripts/merge_mouzamap_index.py --division 3,1`. Survey labels from folder names: `DIARA` (দিয়ারা/DIYARA), `PS` (PETY, petty survey); `CSRS` folders are labelled `RS`. Folders filed under the wrong district or spelled differently are mapped in `ALIASES` of `merge_mouzamap_index.py`; `Barishal / পং দক্ষিন সাহাবাজপুর` (56 files) is left unmatched on purpose. About 330 of 8,593 Barishal files have no parseable JL no. or survey and are skipped.

## Khulna, Rajshahi and Rangpur scans (`MOUZA_ENABLED_DIVISION_ID=4,3,1,5,6`)
Khulna's official data was already in; its scanned-map links were added with `python scripts/build_mouzamap_index.py --root 3:/` (free.mouzamap.tech drive `3:/` = Khulna). Rajshahi and Rangpur were added with `--root 2:/ --root 6:/` (drive `2:/` = Rajshahi, `6:/` = Rangpur) and `python scripts/build_mouza_data.py --division 40,30,10,50,55 --dlrs-division 020000000,010000000,060000000,030000000,080000000` (map.land.gov.bd 50 = Rajshahi, 55 = Rangpur; DLRS 030000000 = Rajshahi, 080000000 = Rangpur), then `python scripts/merge_mouzamap_index.py --division 3,1,4,5,6`. Note that mouzamap drive numbers and app division ids differ (app ids: 1 Barishal, 2 Chattogram, 3 Dhaka, 4 Khulna, 5 Rajshahi, 6 Rangpur, 7 Sylhet, 8 Mymensingh). The build script is slow for DLRS (one request per mouza; the first run of the two divisions took about 3 hours, later runs read the cache). Site spellings that differ from the app (`Jessore`, `Sirajganj`) are mapped in `DISTRICT_ALIASES`, and misfiled or misspelled upazila folders in `ALIASES`, of `merge_mouzamap_index.py`.

Fixes for folders that did not match at first: `Jessore / নড়াগাতী-CS` (Naragati thana, 52 files) is Kalia, Narail (Baoishona, Bagudanga, Mulshri and Charsinggoti are in Kalia's official list); `Panchagarh / RS` and `bs` (291 files) are Panchagarh Sadar (the folders are named after a survey; their JL 9-13, 21, 22 are exactly the gaps in the official list); `Rajshahi / RS` and `Rajshahi / রাজশাহী` hold one folder per upazila (Paba, Godagari, Puthia, Boalia), listed in `NESTED` so the next path segment is used.

Parser (`build_mouzamap_index.py`) additions, applied to the Khulna, Rajshahi and Rangpur drives only (Dhaka and Barishal were not re-indexed): Bangla survey folder names without dots (`বিএস`, `সিএস`, `আরএস`, `সিএস-এসএ`), `name-JL-sheet` file names in Bangla (`গোপালপুর-৪-১`, `আমডাঙ্গা-৬১ সিট নং ২`), `22Suktiya-1` and `120 SHEKHERHAT` (no hyphen after the JL no) and `Palashpol 94-30 (Shafiq)`. That added about 1,200 files; no file that parsed before changed.

Survey unknown: in the Khulna, Rajshahi and Rangpur drives, 2,472 files have a JL no. but no survey type anywhere in the file or folder name (for example `Chitalmari/05-MOCONDOPUR-1`, Dinajpur `Birganj/ফাইল/…`, Kurigram `Bhurungamari/pdf/…`). They are listed with the survey label `Unknown` (`UNKNOWN_SURVEY` in `scripts/merge_mouzamap_index.py`; the menu shows e.g. "Unknown 001"), so the type is not guessed and may be CS, SA, RS or BS. 892 mouzas have only Unknown sheets.

Still left out on purpose:
- `Khulna / দৌলতপুর-` (360 files): the old Khulna Daulatpur thana. It is not Kushtia's Daulatpur (the mouza names differ), and its mouzas (Debnagar, Filipnagar, Boyra, Teligati, Jugipol, Aranghata) are spread over today's Dighalia and the city thanas, so no single app upazila fits.
- Dhaka and Barishal: files with a JL no. but no survey type (about 4,200 in Dhaka) are still skipped.
- About 500 files have a survey but no JL no.: thana maps (`Thana-…`), `JAMUNA RIVER BLOCK-n`, and `Rajshahi/RS/Poba/prova (n)` (284 scans numbered 71-354 that do not look like JL numbers).

## Matching scans to mouzas (duplicate rows)
`python scripts/merge_mouzamap_index.py --division 3,1,4,5,6` rebuilds every `source: "mouzamap"` row and sheet from `mouzas.json`'s official rows plus `mouzamap_index.json`, so it can be rerun at any time (the result of a rerun is byte-identical; `--out FILE` writes elsewhere to compare). A scan group `(upazila, survey, JL no.)` joins an existing mouza when, in this order:

1. its name equals the mouza's Bangla or English name (anywhere in the upazila); or
2. the mouza has the same JL no. and already has a sheet of that survey; or
3. the mouza has the same JL no. **and a similar name** (`SAME_NAME = 0.92`).

Otherwise it becomes a new scan row. **A JL no. alone is not identity.** CS and SA numbered mouzas differently from RS and BS, so one number in one upazila can be two different mouzas (JL 011 is Kamarganti in BS and a different mouza in the CS scans); those stay separate rows.

*Similar name* compares a consonant skeleton that is the same for Latin and Bangla (`Krishnapur`, `KRISNOPUR` and `কৃষ্ণপুর` all reduce to `krsnpr`; survey tags such as `সি.এস`, numbers and `(…)` notes are ignored; `ড়`, `য়`, `ৃ` and `ক্ষ`/`kkh` are handled). The cut-off was chosen on the data, not guessed:

| Check | Result |
|---|---|
| Official English vs their own Bangla name (1,677 pairs, should match) | 94% score at least 0.92 (98.7% at 0.8) |
| Different mouzas of one upazila (1,675 random pairs, should not match) | 0 score 0.92 or more |
| Scan-involved pairs sharing an upazila and JL no. (5,179) | 1,955 at 0.92 or more (merged), 2,976 below 0.7 (different mouzas, kept apart), 248 in between |

Pairs between 0.7 and 0.92 are a mix of real matches (`Baragaon` / `বারাগাঁও`) and different mouzas (`উলিপুর` / `Alampur`), so they are **left as separate rows on purpose**: a leftover duplicate is harmless, a wrong merge would attach the wrong PDF to a mouza. Official names, ids, unions and coordinates are never changed; a scan row that gains a spelling in the other script keeps both (`MODUPUR (মধুপুর)`).

Other rules in the same step:
- A scan whose survey and sheet number already exist on the mouza **without** a link (an official sheet with plots) gives that sheet the link (`url`, `url_source: "mouzamap"`; reruns remove it again). Before this, 994 scanned sheets never got a link.
- A scan whose sheet number already has a **different** link (the same mouza's CS maps filed under JL 026 and under the CS-era number 1645) is added as a second sheet, never dropped.
- Official rows with the same code are one row (the sources listed `আমরাতৈল` twice with different sheets).
- Scan row ids are `mm-<upazila>-<survey>-<JL no.>` (unique, and unchanged when matching improves).

Result on the current data: 33,490 → 31,600 rows, 53,095 → 54,089 scan links (none lost, none repeated), and of the pairs that still share an upazila and JL no.: 0 with the same name, 2,834 different mouzas, 231 in the grey zone, 84 official-only (the official portal itself lists three `Gajalia` codes for JL 005). `backend/tests/test_merge_mouzamap.py` covers the rules.

`mouzas.json` is about 24 MB with five divisions (about 31,600 mouzas); the API reads it once and caches it.
