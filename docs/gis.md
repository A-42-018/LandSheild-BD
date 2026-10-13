# GIS map (P61–P66)

Bangladesh map at `/map`: street basemap, Division → District → Upazila boundaries for the whole country,
and a union → mouza (JL no.) → survey sheet → plot menu for **one demo division** (`MOUZA_ENABLED_DIVISION_ID`, default `4` = Khulna).
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

## Not done yet
Mouza layer/polygons, sheet PDF viewer, plot selection (the portal has plot numbers; not imported), parcel ↔ land-record links on real sheets (P64, P67, P68); `next build` not run (Google Fonts need network); browser walk with real OSM tiles not done.

## Barishal division (`MOUZA_ENABLED_DIVISION_ID=4,3,1`)
Added the same way as Dhaka: `python scripts/build_mouza_data.py --division 40,30,10 --dlrs-division 020000000,010000000,060000000` (map.land.gov.bd 10 = Barishal, DLRS 060000000 = Barishal), then `python scripts/build_mouzamap_index.py --root 4:/` (free.mouzamap.tech drive `4:/` = Barishal; `--root` is repeatable and only replaces the entries of the given roots) and `python scripts/merge_mouzamap_index.py --division 3,1`. Survey labels from folder names: `DIARA` (দিয়ারা/DIYARA), `PS` (PETY, petty survey); `CSRS` folders are labelled `RS`. Folders filed under the wrong district or spelled differently are mapped in `ALIASES` of `merge_mouzamap_index.py`; `Barishal / পং দক্ষিন সাহাবাজপুর` (56 files) is left unmatched on purpose. About 330 of 8,593 Barishal files have no parseable JL no. or survey and are skipped.
