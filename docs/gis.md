# GIS map (P61–P66)

Bangladesh map at `/map`: street basemap and Division → District → Upazila boundaries for the whole country (map viewing only).
Union and mouza lists are **not included**: they would need a dataset that is not synthetic or organizer-provided, so the `/gis/unions` and `/gis/mouzas` endpoints stay in the API but answer "not enabled" (see "Mouza lists" below).
Everything is a **sample**: *Demo Dataset — Not an Official Government Land Record*.

## Decisions (P61)
| Question | Decision |
|---|---|
| Demo division | Khulna → Bagerhat → Kachua (the reference portal's sample). Chosen by setting, never hard-coded. |
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

## Mouza lists (removed)
An earlier version of this project listed unions, mouzas, JL numbers and survey sheets that had been collected by script from government land portals, plus links to scanned maps on a third-party site. That conflicts with the competition rule *no scraping, automated querying or bulk downloads from government portals*, so all of it was removed:

- the collection scripts and the files they produced (`database/gis/mouzas.json`, `database/gis/mouzamap_index.json`),
- the `/mouza-map` page and its nav links, and the `GET /gis/scan` download proxy (`services/scans.py`),
- the `SCAN_RATE_LIMIT_PER_MIN` setting.

The git history still shows when they were added and removed; nothing was rewritten.

What stays: `/gis/unions` and `/gis/mouzas` read `database/gis/mouzas.json` if it exists. The file is not shipped, and `MOUZA_ENABLED_DIVISION_ID` defaults to empty, so `/gis/capabilities` reports `mouza_enabled: false` and both endpoints return empty lists. The tests build their own tiny synthetic `mouzas.json` in a temp folder. The verify form's mouza suggestions therefore stay empty unless a synthetic or organizer-provided file is added.

## Not done yet
Mouza layer/polygons, plot selection, parcel ↔ land-record links, and a synthetic demo mouza list.
