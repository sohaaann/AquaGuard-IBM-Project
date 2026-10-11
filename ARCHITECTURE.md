# Architecture

AquaGuard AI is a static web app: HTML + CSS + plain JavaScript, no build step, no server. Diagrams: `assets/diagrams/`.

```
index.html (shell, dialogs) + css/styles.css
js/data.js        GENERATED: AQ.DEMO_ROWS (120 synthetic), AQ.REFERENCES, AQ.SETTINGS
js/validation.js  AQ.Validation  parameters/units/ranges, record validation, CSV parser, import validation
js/storage.js     AQ.Store       localStorage persistence, demo seed/reset
js/analysis.js    AQ.Analysis    screening, metrics, filters, statistics, robust outliers, trends
js/charts.js      AQ.Charts      dependency-free SVG charts (line, bar, histogram, box, donut)
js/reports.js     AQ.Reports     CSV export, HTML report, downloads, print
js/app.js         UI controller: sections, dialogs, events, rendering
```
Scripts are loaded as ordinary `<script>` tags in that order (no ES modules, no `fetch`), so the app works from `file://`. Each module attaches to a single `window.AQ` namespace; only `app.js` touches the DOM (plus download/print helpers in `reports.js`), which keeps logic testable in Node.

## Key decisions
1. **Standalone HTML**: the earlier Streamlit version required Python and package installation; this version opens by double-click.
2. **`data.js` instead of `fetch(JSON)`**: browsers block `fetch` of local files on `file://`. `config/water-quality-references.json` is the human-readable source of truth; `scripts/build_data.py` (developer tool) embeds it and the demo CSV into `js/data.js`.
3. **Custom SVG charts instead of Chart.js**: no library could be downloaded when building (no internet), and the same SVG strings are reused inside the exported report.
4. **localStorage** under `aquaguard.v1.records` / `aquaguard.v1.settings`; demo rows carry `origin: 'demo'` and are read-only, user rows are `origin: 'user'`. If storage is blocked the app falls back to memory and warns.
5. **No stored verdicts**: screening is recomputed from the active profile, so switching profile never leaves stale results.
6. **No unit conversion**: unit-bearing column names are required and mismatches are refused.
7. **Statistical, not ML, outlier detection**: robust z-score from median and MAD; MAD=0 falls back to scaled mean absolute deviation; parameters with fewer than 8 values are skipped.

## Data flow
Input (form or CSV) -> `validateRecord` / `validateImport` -> `Store` -> filters -> `Analysis.screenAll(profile)` -> tables, charts, explanations -> exports / report.

## Security notes
Uploaded files are parsed as text only (size/row limits); all user-controlled text is HTML-escaped before rendering and in reports; exported CSV cells starting with `= + - @` are neutralised; the report preview iframe is sandboxed; no network calls, no `eval`.
