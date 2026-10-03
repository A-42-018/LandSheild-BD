# GIS map (P61–P66)

Bangladesh map at `/map`: street basemap, Division → District → Upazila boundaries for the whole country,
and a mouza → sheet → plot menu for **one demo division** (`MOUZA_ENABLED_DIVISION_ID`, default `4` = Khulna).
Everything is a **sample**: *Demo Dataset — Not an Official Government Land Record*.

## Decisions (P61)
| Question | Decision |
|---|---|
| Demo division | Khulna → Bagerhat → Kachua (the reference portal's sample). Chosen by setting, never hard-coded. |
| Mouza geometry | Not available yet. The mouza/sheet/plot menu exists but is empty until `database/gis/mouzas.json` is filled (P64). |
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
`GET /gis/capabilities` · `/gis/divisions` · `/gis/districts?division_id=` · `/gis/upazilas?district_id=` · `/gis/mouzas?upazila_id=` (empty + `enabled:false` outside the demo division) · `/gis/search?q=` (English or Bangla, NFC-normalised, max 20 hits).
Never returns more than one level of one parent (largest payload ≈ 0.3 MB).

## Adding mouza maps (P64, next)
1. Put rows in `database/gis/mouzas.json`: `{"id","upazila_id","code","name","bn_name","jl_no","lat","long","sheets":[{"sheet_no","pdf"}]}` (`upazila_id` = id from `/gis/upazilas`).
2. Keep PDFs under the document storage (upload validation applies); link by `sheets[].pdf`.
3. Only rows whose upazila belongs to `MOUZA_ENABLED_DIVISION_ID` are served.

## Not done yet
Mouza layer/polygons, sheet PDF viewer, plot selection, parcel ↔ land-record links on real sheets (P64, P67, P68); `next build` not run (Google Fonts need network); browser walk with real OSM tiles not done.
