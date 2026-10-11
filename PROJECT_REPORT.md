# AquaGuard AI - Project Report
IBM academic project | UN SDG 6 | Author: Sohan Manoj, St. Claret College, Bengaluru

## Abstract
AquaGuard AI is a standalone browser application (HTML, CSS, vanilla JavaScript) that validates water-quality measurements, screens them against a selectable and documented reference profile, visualises trends by location and exports reports. It opens by double-clicking `index.html` and ships with a synthetic demonstration dataset. It is a preliminary screening and education tool and never labels water safe or unsafe. 75 unit checks and 46 real-browser checks (Chromium) passed; Safari/Firefox, the live print dialog and the verification of reference thresholds against the live standards remain open.

## 1. Introduction and problem definition
Low-cost meters and school or community monitoring generate readings (pH, turbidity, TDS, temperature) but interpreting them requires context many users lack. Users have no easy overview of abnormal readings, trends or next steps, and risk either ignoring a concern or over-trusting a few in-range numbers. An earlier Streamlit version solved this but required Python and package installation, which blocked its use; this rebuild removes that barrier.

## 2. Objectives
O1 run by double-click with no installs; O2 reject invalid input with clear reasons; O3 transparent screening with source and explanation for every flag; O4 never claim safety; O5 dashboards computed from actual records; O6 work offline; O7 (not measured) deliver real-world value in a pilot.

## 3. Background and SDG alignment
SDG 6 seeks safe water and sanitation for all. Target 6.1 (safe, affordable drinking water) and 6.3 (water quality, less pollution) motivate the tool; it supports interpretation and prioritisation of follow-up testing and does not itself improve water quality. Sources are listed in `REFERENCES.md` - **none were opened during the build** and all thresholds are marked unverified. From the authors' knowledge: WHO's 2022 drinking-water guidelines give no health-based value for pH, TDS or turbidity (they are operational/acceptability indicators); BIS IS 10500 gives acceptable and permissible limits; CPCB designated-best-use classes are surface-water indicators.

## 4. Methodology
Requirements from the brief -> inspect the previous deliverable (reuse reference configuration, validation rules and synthetic-data logic) -> redesign as a static web app -> implement modules -> automated unit and browser tests -> screenshots -> deck and documentation.

## 5. System design
Plain scripts attach to one `window.AQ` namespace: `validation`, `storage`, `analysis`, `charts`, `reports`, `app`, plus generated `data.js`. See `ARCHITECTURE.md`. Persistence is browser `localStorage`; demo rows are read-only; reference thresholds are JSON with provenance fields (`standard`, `edition`, `source_url`, `applicability`, `criterion_type`, `verification_status`).

## 6. Algorithms
**Screening.** Validate; for each parameter configured in the active profile and present in the sample, flag if value < min or > max (inclusive limits). Fewer than 2 evaluated parameters -> *Insufficient data*; any flag -> *Flagged for review*; otherwise *Within configured range*. Every message ends with "This result does not establish drinking-water safety."
**Robust outliers.** Robust z = 0.6745 x (x - median) / MAD per parameter (optionally within each location); |z| >= 3.5 by default; MAD = 0 falls back to 1.2533 x mean absolute deviation; fewer than 8 values -> skipped. This is a statistic, not machine learning; no accuracy is claimed.
**Trend.** Least-squares slope per 30 days (>= 5 points on >= 2 dates), described as descriptive only.

## 7. Implementation highlights
Strict ISO date validation (real calendar dates, not before 1990, not in the future); numeric ranges per parameter; RFC-4180 CSV parser; column aliases; refusal of unit-mismatch headers; every CSV row ends in *valid* or *rejected with reasons*; spreadsheet-formula neutralisation on export; HTML escaping everywhere; custom SVG charts reused in the report; keyboard and screen-reader-friendly markup (labels, skip link, `aria-current`, dialog elements).

## 8. Demonstration dataset (synthetic)
120 fictional records, four fictional sites (Site A-D), 2026-08-01 to 2026-10-10, fixed random seed. Results under the BIS acceptable profile: 84 within configured range, 32 flagged (findings: Total dissolved solids (TDS) 17, Turbidity 14, pH 2), 4 insufficient data. Under BIS permissible: 3 flagged; WHO operational: 16; CPCB class A: 22. Robust outlier detection lists 5 unusual samples. These are demonstration outputs, not research findings.

## 9. Testing and actual results
Unit tests: 75/75 passed. Browser tests (Chromium, `file://`): 46/46 passed, no console errors, zero network requests. Details, commands and gaps are in `TESTING.md`. Not verified: Safari, Firefox, real devices, the live print dialog, thresholds against live sources, any user pilot.

## 10. Advantages
Opens by double-click; private (no data leaves the browser); validation before analysis; transparent, auditable rules; works offline; reproducible demo.

## 11. Limitations / disadvantages
Six parameters; screening against one profile at a time (not a compliance check); thresholds unverified; microbial and toxic hazards undetectable; browser-local storage only (no sharing or multi-user); PDF via the browser print dialog; tested in one browser engine.

## 12. Ethical considerations
No personal data, no accounts, no network calls. Fixed wording prevents "safe" claims; demo data is labelled synthetic everywhere including reports; no endorsement by IBM, the UN or any agency is claimed; users are directed to accredited laboratory testing and public-health authorities.

## 13. SDG impact pathway
Hypothesis only: clearer interpretation -> better decisions about follow-up testing -> earlier attention to problem sources. **No impact has been achieved or measured.** Proposed evaluation: a consented pilot with 2-3 school or community monitors for 8 weeks after expert review of thresholds, measuring time to interpret a dataset, validation errors caught, user comprehension and follow-up tests triggered, against a spreadsheet baseline.

## 14. Future scope
Verify thresholds against sources; test Safari/Firefox and run an accessibility audit; add parameters with documented criteria (nitrate, fluoride, microbiological results); bundled PDF export; import/export of whole projects; multilingual interface.

## 15. Conclusion
AquaGuard AI is a working, tested, transparent screening tool that anyone can open with a double-click. Its value for real users still has to be evaluated.

## 16. References
See `REFERENCES.md` (URLs not re-opened during the build).
