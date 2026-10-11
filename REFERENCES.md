# References

**The build environment had no internet access, so none of these URLs was opened and every threshold is marked `unverified_offline`.** Verify each URL and value before relying on it; then update `config/water-quality-references.json` (and re-run `python3 scripts/build_data.py`).

| Source | Edition / date | URL | Supports |
|---|---|---|---|
| UN, Sustainable Development Goal 6 | current | https://sdgs.un.org/goals/goal6 | Goal 6, targets 6.1 and 6.3 |
| WHO, Guidelines for drinking-water quality, 4th ed. incorporating the 1st and 2nd addenda | 2022 | https://www.who.int/publications/i/item/9789240045064 | No health-based value for pH, TDS, turbidity; operational/acceptability indicators; `WHO_GDWQ_operational` (from authors' knowledge) |
| WHO/UNICEF Joint Monitoring Programme | latest report | https://washdata.org | Global drinking-water access statistics (re-check any figure before quoting) |
| Bureau of Indian Standards, IS 10500 Drinking Water - Specification | IS 10500:2012 assumed; confirm edition/amendments/newer revision | https://www.bis.gov.in | Acceptable and permissible limits for pH, turbidity, TDS (from authors' knowledge) |
| Central Pollution Control Board, Water Quality Criteria (designated best use) | edition unknown | https://cpcb.nic.in | Class A indicators in `CPCB_surface_water_class_A` (exact page URL not confirmed) |
| UN-Water, SDG 6 Synthesis Report 2018 | 2018 | https://www.unwater.org/publications/highlights-sdg-6-synthesis-report-2018-water-and-sanitation | Background on SDG 6 |

Method reference for the outlier statistic: robust z-score using the median absolute deviation (Iglewicz and Hoaglin, 1993, *How to detect and handle outliers*). No public dataset is used; the demo data is synthetic (`data/README.md`).
No claim of endorsement by IBM, the UN, BIS, WHO, CPCB or any government agency is made.
