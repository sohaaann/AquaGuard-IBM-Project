# User guide

Double-click `index.html`. The left menu (the "Menu" button on small screens) has seven sections. The top bar shows the demo label, the **Reference profile** menu (with a "Thresholds UNVERIFIED" badge) and **Reset Demo**. Filters (search, dates, locations) apply to Dashboard, Samples, Screening, Analytics and Reports.

- **Dashboard** - five KPI cards, samples per week, screening status, a parameter over time (choose the parameter), parameter summary and the ten most recent samples.
- **Samples** - sortable, paged table with status chips. Red-orange values are outside the active profile's range. *Details* explains a sample. *+ Add sample* opens the entry form (Sample ID, date, location, source, six measurements; at least one measurement required). *Edit* and *Delete* work on your own records only.
- **CSV import / export** - download the template; choose a CSV; the app shows rows read/valid/rejected, warnings, column mapping, preview, missing values and every rejected row with reasons. *Import valid rows* adds only valid rows. Download the data-quality summary. Export filtered records or screening results.
- **Screening** - the active profile with source and verification status, status counts, all flagged measurements (observed value, unit, reference, source/status, explanation, recommended next step) and samples with insufficient data.
- **Analytics** - distribution, time series with trend note, location box plot, flagged vs unflagged by location, missing data, and the robust-z outlier table (adjust the threshold, optionally compare within each location).
- **Reports** - preview and download the HTML report for the current filters and profile; print/save as PDF; CSV exports.
- **About & methodology** - how it works, parameters, profiles, data storage, limitations, and data management (Reset Demo, Remove demo data, Delete my records).

Status meanings: **Within configured range** (no configured threshold exceedances in the available measurements - *not* "safe"), **Flagged for review**, **Insufficient data** (fewer than two of the profile's parameters measured), **Invalid record**.

Tips: Escape closes dialogs; Tab reaches a "Skip to main content" link first; if numbers look odd, check the filter counter "N of M records shown".
