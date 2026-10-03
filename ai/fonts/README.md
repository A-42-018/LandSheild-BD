# Fonts for the synthetic document generator

- `FreeSans.ttf` — GNU FreeSans, subset to Basic Latin + Bengali (GPLv3 with font-embedding exception, see `LICENSE-FreeFont.txt`). Fallback used because Noto Sans Bengali could not be downloaded offline.
- To use OFL Noto Sans Bengali: drop `NotoSansBengali-Regular.ttf` into this folder; `make_synthetic.py` prefers it automatically (note: regenerated images will change).
