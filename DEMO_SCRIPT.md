# Five-minute demo script

Say first: "Screening tool, synthetic data, never says safe."  Expected numbers are for the shipped demo data under the default profile (BIS acceptable); they were verified in the browser test run.

| Time | Action | Expected | Say |
|---|---|---|---|
| 0:00 | Double-click `index.html` | Dashboard with the purple DEMO MODE label; 120 samples, 4 locations, 32 flagged, latest 2026-10-10, 6 parameters | "No installation; data loads automatically." |
| 0:45 | Scroll the dashboard | Samples per week, status donut, TDS over time with dashed limit, parameter summary | "Every number comes from the records." |
| 1:15 | Tick **Site B** in the filters | KPIs change to 30 samples / 1 location; charts follow | "Filters drive everything, including reports." Clear filters. |
| 1:45 | Reference profile -> *BIS permissible* | Flagged falls to 3 | "Assumptions are visible and switchable; all thresholds say UNVERIFIED." Switch back. |
| 2:15 | Screening -> *Details* on a flagged sample | Reference, source, explanation, recommended next step | "Flagged for review, not 'unsafe'." |
| 2:45 | Samples -> + Add sample: ID `LIVE-1`, today's date, any location, pH 9.1, TDS 300 -> Save | Appears, flagged for pH | Then try pH `abc` with a new ID: clear error |
| 3:30 | CSV import: choose a CSV with a duplicate ID and a bad date (or `tests` fixtures) | Rejected rows listed with reasons; valid rows importable | "Nothing is silently dropped; units are never converted." |
| 4:00 | Analytics: TDS | Distribution, trend, location box plot, outlier table (5 unusual samples) | "Robust statistics, not machine learning; unusual is not unsafe." |
| 4:30 | Reports -> Download HTML report | Report with profile, thresholds, flags, charts, limitations | "Reflects the current filters." |
| 4:50 | **Reset Demo** | Confirmation, then demo restored; your record kept | "Reset touches only this browser's data." |
