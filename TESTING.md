# Testing

Everything below was executed in the build sandbox (Node v22.22.2; Chromium via Playwright, headless shell build 1194, Linux). Raw results: `tests/results.json`.

## Commands and actual results
| Command | Result |
|---|---|
| `node tests/check-assets.js` | OK: 10 referenced assets exist, all JS files have valid syntax, index.html has no external URLs |
| `node tests/unit.test.js` | **75 passed, 0 failed** |
| `node tests/e2e.js` (opens `index.html` via `file://` in headless Chromium) | **46 passed, 0 failed** (46 checks) |

The unit tests load the real `js/*.js` files into a Node `vm` sandbox that mimics a browser global. The browser suite drives the real UI.

## What the unit tests cover (75)
Valid/invalid numbers and dates (impossible dates, future dates, Feb 30), missing required fields, optional fields; CSV parsing (quotes, CRLF, BOM, unterminated quote); empty, header-only, binary, malformed, oversize CSV; missing columns; unit-mismatch refusal; duplicate IDs (in file and existing); "no row silently dropped"; missing-value reporting; screening boundary conditions for every threshold (inclusive limit, just outside, below minimum); insufficient/invalid statuses; wording never says safe/unsafe; threshold provenance fields; all thresholds marked unverified; manual vs imported records screen identically; demo dataset properties (>=100 records, 4 sites, missing values, flagged, insufficient, outliers) and equality of `data/demo-water-quality.csv` with the embedded data; dashboard metrics; filters; outlier detection (planted anomaly, within-location, small sample skip, MAD=0 fallback); trend/histogram/weekly counts; storage (first-run seeding, persistence, add/update/delete, duplicate rejection, demo read-only, reset restores tampered demo and keeps user data, remove demo, corrupt storage, blocked localStorage); CSV quoting and formula-injection neutralisation; export round-trip; template validity; HTML report content and HTML escaping; data-quality summary; chart functions.

## What the browser tests cover (46)
Opens via `file://` and preloads demo data; exact demo label; KPIs equal an independent calculation from the dataset; charts/tables present; all seven sections without console errors; **zero network requests**; add-sample validation errors, valid save, duplicate ID, edit, demo records read-only, delete with cancel/confirm; persistence across refresh and no re-seeding; location, date and search filters; sorting and pagination; profile switch changes results; screening page provenance and no "safe" wording; detail dialog explanation; analytics charts react to parameter changes; outlier detection and threshold control; CSV upload (valid, messy with 5 rejected rows listed, empty, header-only, unit mismatch, missing columns, malformed, binary) and that failed uploads change nothing; template download is importable; filtered CSV export; HTML report preview and download reflect filters and profile; screening/flagged CSV exports; print button runs without error; Reset Demo / Remove demo / Delete my records; keyboard (skip link, Escape closes dialogs, aria-current); accessible labels on all controls; mobile layout at 390 px with no horizontal overflow on all sections; no console errors/warnings during the whole session; app works with blocked `localStorage`.

Real screenshots from these runs are in `screenshots/`.

## NOT verified (known gaps)
- **Safari and Firefox** (and Edge/Chrome desktop builds other than the Chromium engine used) were not run.
- The **live print dialog / PDF output**: the button was exercised but the dialog cannot be verified headless.
- **Real phones/tablets** (only a 390 px emulated viewport); screen-reader and full accessibility audit (only label/keyboard checks).
- Behaviour with very large files (only size-limit logic was tested), and performance.
- **Reference thresholds and URLs** against the live sources (no internet in the build environment).
- No user pilot or real-world evaluation has been done.
- Playwright and Node are developer-only tools; their absence does not affect using the app.

## How to re-run
```bash
node tests/check-assets.js && node tests/unit.test.js
npm i playwright && npx playwright install chromium && node tests/e2e.js   # optional browser suite
```
