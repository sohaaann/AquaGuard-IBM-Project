# AquaGuard AI

Browser-based water-quality analysis and **preliminary screening**, built for an IBM academic project and aligned to **UN SDG 6: Clean Water and Sanitation** (targets 6.1 and 6.3).

> **AquaGuard AI is an educational screening tool. It never certifies water as safe or unsafe.** pH, turbidity and TDS alone cannot establish drinking-water safety; bacteria, toxic chemicals and sampling errors are invisible to these measurements. Use accredited laboratory testing and official public-health advice. Not endorsed by IBM, the UN, BIS, WHO, CPCB or any government agency.

## Open it (Mac, Windows or Linux)
1. Download and unzip `AquaGuard_AI_IBM_SDG6_HTML_Project.zip` (on a Mac, double-click the zip).
2. Open the `AquaGuard-AI` folder.
3. **Double-click `index.html`.** It opens in your default browser with 120 synthetic sample records already loaded.

No Python, Streamlit, Node.js, npm, server, database or API key is needed. If the default browser misbehaves: right-click `index.html` -> Open With -> Chrome / Edge / Firefox / Safari.

## What you will see
- A purple label **DEMO MODE - ALL INITIAL SAMPLE DATA IS SYNTHETIC** (the data is fictional: Sites A-D).
- Dashboard: total samples, locations, samples flagged for review, latest date, parameter summary, charts, recent samples. All numbers come from the loaded records and the active filters.

## Using the app
| Task | How |
|---|---|
| Use the demo data | Nothing to do - it loads on first launch. |
| Filter | Search box, from/to dates, location tick-boxes (top of each page). Charts, tables and reports follow the filters. |
| Change reference profile | "Reference profile" menu (top right). Thresholds are shown as **UNVERIFIED** (see below). |
| Add a record | Samples -> **+ Add sample**. Optional measurements may be blank. Errors are listed per field. |
| Edit / delete | Samples -> **Edit** / **Delete** on your own records (delete asks for confirmation). Demo records are read-only. |
| Import CSV | CSV import / export -> download the template -> choose your file -> review preview, mapping, missing values and **rejected rows with reasons** -> Import valid rows. |
| Export | Export filtered records / screening results (CSV); flagged observations; data-quality summary. |
| Report | Reports -> **Download HTML report**, or **Print / save as PDF** and choose "Save as PDF" in the print dialog. |
| Reset | **Reset Demo** (top right or About page) restores the original synthetic records and keeps your own. "Remove demo data" and "Delete my records" are also there. Nothing outside the browser is touched. |

## CSV format
Required columns: `sample_id, sample_date (YYYY-MM-DD), location, source_type` plus at least one of `ph, turbidity_ntu, tds_mg_l, temperature_c, conductivity_us_cm, dissolved_oxygen_mg_l`. Headers with other units (e.g. `tds_ppm`, `temperature_f`) are refused - values are never converted silently. See `data/demo-water-quality.csv` and the in-app template.

## Browser compatibility
- **Tested:** Chromium (Playwright headless) via `file://` - see `TESTING.md`.
- **Expected to work, not tested:** current Chrome, Edge, Firefox and Safari 15.4+ (uses `<dialog>`, `localStorage`, SVG, Blob downloads).
- If a browser blocks `localStorage` (some private modes) the app still works from memory and shows a warning; records are then lost on refresh.

## Offline use and limitations of `file://`
Everything (scripts, styles, charts, data) is local; the app makes **no network requests** (verified). Charts are a small built-in SVG library because Chart.js could not be downloaded when this was built. Records live in the browser's localStorage for that file location: opening `index.html` from a different folder, or a different browser, starts a separate store. PDF export uses the browser's print dialog (no PDF library is bundled).

## Scientific limitations
Six parameters only; screening against one reference profile at a time is **not** a compliance check against any full standard. **All reference thresholds are marked `unverified_offline`**: they were entered without internet access and must be checked against the cited sources (`REFERENCES.md`, `config/water-quality-references.json`) before being relied on. Outlier detection is a robust z-score (median/MAD) - not machine learning - and "unusual" does not mean contaminated.

## For developers (optional)
`node tests/unit.test.js` (75 logic checks), `node tests/check-assets.js`, and `node tests/e2e.js` (needs `npm i playwright`) are developer tools only. `python3 scripts/build_data.py` regenerates the synthetic dataset and `js/data.js`; `python3 presentation/presentation_source.py` rebuilds the deck. See `TESTING.md` and `ARCHITECTURE.md`.
