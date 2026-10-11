/* AquaGuard AI - UI controller. Plain script (no ES modules) so index.html works when opened directly (file://). */
(function () {
  'use strict';
  var AQ = window.AQ, V = AQ.Validation, A = AQ.Analysis, C = AQ.Charts, R = AQ.Reports, Store = AQ.Store;
  var esc = C.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = { section: 'dashboard', filters: { from: '', to: '', locations: [], search: '' }, param: 'tds_mg_l', profileId: AQ.SETTINGS.defaultProfile,
    sort: { key: 'sample_date', dir: 'desc' }, page: 0, pageSize: 25, outlier: { z: AQ.SETTINGS.outlierZ, within: false }, imp: null, editing: null };
  var SECTIONS = { dashboard: 'Dashboard', samples: 'Samples', import: 'CSV import / export', screening: 'Screening', analytics: 'Analytics', reports: 'Reports', about: 'About & methodology' };
  var STATUS_COLORS = { within: '#0b6e99', flagged: '#c75f00', insufficient: '#7b8a97', invalid: '#a8231b' };

  /* ---------- helpers ---------- */
  function profile() { return AQ.REFERENCES.profiles[S.profileId]; }
  function allRecords() { return Store.all(); }
  function filtered() { return A.applyFilters(allRecords(), S.filters); }
  function locColor(l) { var locs = {}; allRecords().forEach(function (r) { locs[r.location] = 1; }); var i = Object.keys(locs).sort().indexOf(l); return C.PALETTE[(i < 0 ? 0 : i) % C.PALETTE.length]; }
  function chip(status) { return '<span class="chip ' + status + '">' + esc(A.STATUS[status].label) + '</span>'; }
  function cell(v, out) { return v === null || v === undefined ? '<td class="num missing" title="missing">&ndash;</td>' : '<td class="num' + (out ? ' out' : '') + '"' + (out ? ' title="Outside configured screening range"' : '') + '>' + esc(v) + '</td>'; }
  function toast(msg, type) {
    var t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; $('#toasts').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, type === 'error' ? 7000 : 4000);
  }
  function confirmDlg(msg, okLabel) {
    return new Promise(function (resolve) {
      var d = $('#confirmDlg'); $('#confirmMsg').textContent = msg; $('#confirmYes').textContent = okLabel || 'Confirm';
      var done = function (v) { $('#confirmYes').onclick = $('#confirmNo').onclick = null; d.onclose = null; d.close(); resolve(v); };
      $('#confirmYes').onclick = function () { done(true); }; $('#confirmNo').onclick = function () { done(false); }; d.onclose = function () { resolve(false); };
      d.showModal(); $('#confirmNo').focus();
    });
  }
  function disclaimerBox() { return '<div class="disclaimer" role="note"><strong>Screening tool, not a safety certification.</strong> ' + esc(A.DISCLAIMER) + '</div>'; }
  function unitOf(k) { return V.PARAMS[k].unit; }
  function refsFor(k, axis) {
    var s = profile().parameters[k], r = []; if (!s) return r;
    if (s.min !== undefined) r.push(axis === 'x' ? { x: s.min, label: 'min ' + s.min } : { y: s.min, label: 'min ' + s.min });
    if (s.max !== undefined) r.push(axis === 'x' ? { x: s.max, label: 'max ' + s.max } : { y: s.max, label: 'max ' + s.max });
    return r;
  }
  function seriesByLoc(recs, k) {
    var by = {};
    recs.forEach(function (r) { if (r[k] === null || r[k] === undefined) return; (by[r.location] = by[r.location] || []).push([Date.parse(r.sample_date + 'T00:00:00'), r[k], r.sample_id + ' | ' + r.sample_date + ' | ' + r.location + ': ' + r[k] + ' ' + unitOf(k)]); });
    return Object.keys(by).sort().map(function (l) { return { name: l, color: locColor(l), points: by[l] }; });
  }
  function paramSelect() {
    return '<label class="hint" for="paramSel">Parameter</label> <select id="paramSel" data-input="param">' + V.PARAM_KEYS.map(function (k) { return '<option value="' + k + '"' + (k === S.param ? ' selected' : '') + '>' + esc(V.PARAMS[k].label + ' (' + unitOf(k) + ')') + '</option>'; }).join('') + '</select>';
  }
  function emptyState(msg, actions) { return '<div class="empty"><p>' + esc(msg) + '</p>' + (actions || '') + '</div>'; }

  /* ---------- chrome: banner, profile, filters ---------- */
  function refreshChrome() {
    var recs = allRecords(), hasDemo = recs.some(function (r) { return r.origin === 'demo'; });
    $('#demoBanner').hidden = !hasDemo;
    var p = profile(), ver = Object.keys(p.parameters).every(function (k) { return p.parameters[k].verification_status === 'verified'; });
    var vc = $('#verifChip'); vc.textContent = ver ? 'Thresholds verified' : 'Thresholds UNVERIFIED'; vc.className = 'chip ' + (ver ? 'user' : 'unverified');
    $('#storageWarn').hidden = Store.isPersistent();
    var locs = {}; recs.forEach(function (r) { locs[r.location] = 1; });
    var names = Object.keys(locs).sort();
    S.filters.locations = S.filters.locations.filter(function (l) { return locs[l]; });
    $('#fLocs').innerHTML = names.map(function (l) { return '<label><input type="checkbox" data-input="loc" value="' + esc(l) + '"' + (S.filters.locations.indexOf(l) >= 0 ? ' checked' : '') + '> ' + esc(l) + '</label>'; }).join('') || '<span class="hint">No locations yet</span>';
    var n = filtered().length; $('#countNote').textContent = n + ' of ' + recs.length + ' records shown';
    $('#filters').classList.toggle('hidden', S.section === 'about' || S.section === 'import');
    $$('#nav button').forEach(function (b) { if (b.dataset.section === S.section) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }

  /* ---------- sections ---------- */
  function renderDashboard() {
    var recs = filtered(), res = A.screenAll(recs, profile()), m = A.metrics(recs, res), psum = A.paramSummary(recs);
    if (!allRecords().length) return '<h1 tabindex="-1">Dashboard</h1>' + emptyState('No records yet. Add a sample, import a CSV, or restore the synthetic demo data.', '<p class="row" style="justify-content:center"><button class="btn" data-action="add">Add sample</button><button class="btn secondary" data-action="resetDemo">Restore demo data</button></p>');
    var h = '<h1 tabindex="-1">Dashboard</h1><p class="tabs-note">Every figure below is calculated from the ' + recs.length + ' records matching the current filters. Active profile: <strong>' + esc(profile().label) + '</strong>.</p>';
    h += disclaimerBox();
    h += '<div class="grid kpis" role="list">' +
      kpi('Total samples', m.total, 'matching filters') + kpi('Monitored locations', m.locations, '') + kpi('Flagged for review', m.flagged, 'samples with a configured exceedance') + kpi('Latest sample date', m.latest || 'n/a', '') + kpi('Parameters monitored', m.parametersMonitored, 'of ' + V.PARAM_KEYS.length + ' with data') + '</div>';
    if (!recs.length) return h + emptyState('No records match the current filters.', '<p><button class="btn secondary" data-action="clearFilters">Clear filters</button></p>');
    var wk = A.countsByWeek(recs);
    h += '<div class="grid cols-2">';
    h += '<div class="card"><h2>Samples per week</h2><div class="chart">' + C.bar({ cats: wk.weeks.map(function (w) { return w.slice(5); }), series: [{ name: 'Samples', color: '#0b6e99', values: wk.counts }], yLabel: 'Samples', label: 'Samples per week (week starting)' }) + '</div></div>';
    h += '<div class="card"><h2>Screening status</h2><div class="chart">' + statusDonut(m.statuses) + '</div><p class="hint">Statuses describe configured-range screening only. ' + esc(A.NO_SAFETY) + '</p></div>';
    h += '<div class="card"><h2>' + esc(V.PARAMS[S.param].label) + ' over time</h2><div class="row" style="margin-bottom:.5rem">' + paramSelect() + '</div><div class="chart">' + C.line({ series: seriesByLoc(recs, S.param), refs: refsFor(S.param), yLabel: unitOf(S.param), label: V.PARAMS[S.param].label + ' over time by location' }) + '</div><p class="hint">Dashed line = configured reference limit of the active profile. Gaps in a series are missing measurements.</p></div>';
    h += '<div class="card"><h2>Parameter summary</h2><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Unit</th><th>n</th><th>Missing</th><th>Min</th><th>Median</th><th>Mean</th><th>Max</th></tr></thead><tbody>' +
      psum.map(function (p) { return '<tr><td>' + esc(p.label) + '</td><td>' + esc(p.unit) + '</td><td class="num">' + p.n + '</td><td class="num">' + p.missing + '</td><td class="num">' + f2(p.min) + '</td><td class="num">' + f2(p.median) + '</td><td class="num">' + f2(p.mean) + '</td><td class="num">' + f2(p.max) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    h += '</div>';
    var recent = recs.slice().sort(function (a, b) { return a.sample_date < b.sample_date ? 1 : a.sample_date > b.sample_date ? -1 : a.sample_id < b.sample_id ? 1 : -1; }).slice(0, 10);
    h += '<div class="card" style="margin-top:1rem"><h2>Recent samples <button class="btn secondary small" data-action="nav" data-section="samples">All samples</button></h2>' + samplesTable(recent, res, false) + '</div>';
    return h;
  }
  function kpi(l, v, s) { return '<div class="card kpi" role="listitem"><div class="l">' + esc(l) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>'; }
  function f2(v) { return v === null || v === undefined ? '&ndash;' : esc(+v.toFixed(2)); }
  function statusDonut(st) {
    return C.donut({ slices: [{ label: 'Within configured range', value: st.within, color: STATUS_COLORS.within }, { label: 'Flagged for review', value: st.flagged, color: STATUS_COLORS.flagged },
      { label: 'Insufficient data', value: st.insufficient, color: STATUS_COLORS.insufficient }, { label: 'Invalid record', value: st.invalid, color: STATUS_COLORS.invalid }], label: 'Screening status distribution' });
  }

  function samplesTable(recs, res, withActions) {
    if (!recs.length) return emptyState('No samples to show.');
    var head = [['sample_id', 'Sample ID'], ['sample_date', 'Date'], ['location', 'Location'], ['source_type', 'Source'], ['ph', 'pH'], ['turbidity_ntu', 'Turbidity (NTU)'], ['tds_mg_l', 'TDS (mg/L)'], ['temperature_c', 'Temp (\u00b0C)'], ['conductivity_us_cm', 'Cond. (\u00b5S/cm)'], ['dissolved_oxygen_mg_l', 'DO (mg/L)']];
    var h = '<div class="table-wrap"><table><thead><tr>' + head.map(function (c) {
      if (!withActions) return '<th scope="col">' + esc(c[1]) + '</th>';
      var arrow = S.sort.key === c[0] ? (S.sort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
      return '<th scope="col" aria-sort="' + (S.sort.key === c[0] ? (S.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"><button data-action="sort" data-key="' + c[0] + '" title="Sort by ' + esc(c[1]) + '">' + esc(c[1]) + arrow + '</button></th>';
    }).join('') + '<th scope="col">Status</th><th scope="col">Origin</th>' + (withActions ? '<th scope="col">Actions</th>' : '<th scope="col"></th>') + '</tr></thead><tbody>';
    recs.forEach(function (r) {
      var s = res[r.sample_id], bad = {}; if (s) s.findings.forEach(function (f) { bad[f.key] = 1; });
      h += '<tr><td>' + esc(r.sample_id) + '</td><td>' + esc(r.sample_date) + '</td><td>' + esc(r.location) + '</td><td>' + esc(r.source_type) + '</td>' +
        cell(r.ph, bad.ph) + cell(r.turbidity_ntu, bad.turbidity_ntu) + cell(r.tds_mg_l, bad.tds_mg_l) + cell(r.temperature_c, bad.temperature_c) + cell(r.conductivity_us_cm, bad.conductivity_us_cm) + cell(r.dissolved_oxygen_mg_l, bad.dissolved_oxygen_mg_l) +
        '<td>' + (s ? chip(s.status) : '') + '</td><td><span class="chip ' + (r.origin === 'demo' ? 'demo' : 'user') + '">' + (r.origin === 'demo' ? 'Demo (synthetic)' : 'My record') + '</span></td><td>';
      var id = esc(r.sample_id);
      h += '<button class="btn secondary small" data-action="detail" data-id="' + id + '" aria-label="Details for ' + id + '">Details</button>';
      if (withActions && r.origin !== 'demo') h += ' <button class="btn secondary small" data-action="edit" data-id="' + id + '" aria-label="Edit ' + id + '">Edit</button> <button class="btn danger small" data-action="del" data-id="' + id + '" aria-label="Delete ' + id + '">Delete</button>';
      h += '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function renderSamples() {
    var recs = filtered(), res = A.screenAll(recs, profile()), k = S.sort.key, dir = S.sort.dir === 'asc' ? 1 : -1;
    recs.sort(function (a, b) {
      var x = a[k], y = b[k]; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
      return (x < y ? -1 : x > y ? 1 : a.sample_id < b.sample_id ? -1 : 1) * dir;
    });
    var pages = Math.max(1, Math.ceil(recs.length / S.pageSize)); S.page = Math.min(S.page, pages - 1);
    var slice = recs.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);
    var h = '<h1 tabindex="-1">Samples</h1><p class="tabs-note">Demo records are read-only (use Reset Demo to restore them). Your own records can be edited and deleted and are kept in this browser.</p>';
    h += '<div class="row" style="margin-bottom:.75rem"><button class="btn" data-action="add">+ Add sample</button><button class="btn secondary" data-action="exportRecords">Export filtered records (CSV)</button></div>';
    h += '<div class="card">' + samplesTable(slice, res, true);
    h += '<div class="row" style="margin-top:.6rem;justify-content:space-between"><span class="hint" aria-live="polite">Showing ' + (recs.length ? S.page * S.pageSize + 1 : 0) + '&ndash;' + Math.min(recs.length, (S.page + 1) * S.pageSize) + ' of ' + recs.length + ' (page ' + (S.page + 1) + ' of ' + pages + ')</span>' +
      '<span class="row"><button class="btn secondary small" data-action="page" data-dir="-1"' + (S.page === 0 ? ' disabled' : '') + '>Previous</button><button class="btn secondary small" data-action="page" data-dir="1"' + (S.page >= pages - 1 ? ' disabled' : '') + '>Next</button></span></div></div>';
    return h;
  }

  function renderImport() {
    var h = '<h1 tabindex="-1">CSV import / export</h1><p class="tabs-note">Files are read in your browser only; nothing is uploaded anywhere. If an import fails, the demo data and your records are unaffected.</p>';
    h += '<div class="grid cols-2"><div class="card"><h2>1. Import a CSV</h2><p>Required columns: <code>sample_id, sample_date, location, source_type</code> plus at least one measurement column (<code>ph, turbidity_ntu, tds_mg_l, temperature_c, conductivity_us_cm, dissolved_oxygen_mg_l</code>). Dates use YYYY-MM-DD. Headers with other units (e.g. <code>tds_ppm</code>, <code>temperature_f</code>) are rejected, not converted.</p>' +
      '<div class="row"><button class="btn secondary" data-action="downloadTemplate">Download CSV template</button></div><div class="dropzone" style="margin-top:.75rem"><label for="csvFile"><strong>Choose a CSV file</strong></label><br><input id="csvFile" type="file" accept=".csv,text/csv" data-input="csvfile"></div></div>' +
      '<div class="card"><h2>2. Export</h2><p>Exports use the active filters (' + filtered().length + ' records currently match).</p><div class="row"><button class="btn secondary" data-action="exportRecords">Export filtered records (CSV)</button><button class="btn secondary" data-action="exportScreening">Export screening results (CSV)</button></div>' +
      '<p class="hint">Text cells that start with = + - @ are prefixed with an apostrophe to prevent spreadsheet formula injection.</p></div></div>';
    var s = S.imp;
    if (!s) return h + '<div class="info" style="margin-top:1rem">No file imported yet.</div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Validation result: ' + esc(s.name) + '</h2>';
    if (s.fatal) return h + '<div class="err-list" role="alert"><strong>Import failed.</strong> ' + esc(s.fatal) + '</div></div>';
    h += '<div class="grid kpis">' + kpi('Rows read', s.totalRows, '') + kpi('Valid', s.valid.length, 'will be imported') + kpi('Rejected', s.rejected.length, 'not imported') + '</div>';
    s.warnings.forEach(function (w) { h += '<div class="disclaimer">' + esc(w) + '</div>'; });
    h += '<h3>Column mapping</h3><p>' + Object.keys(s.mapping).map(function (k) { return '<code>' + esc(k) + '</code> &rarr; <code>' + esc(s.mapping[k]) + '</code>'; }).join(' &nbsp; ') + '</p>';
    h += '<h3>Preview (first ' + s.preview.length + ' rows as uploaded)</h3><div class="table-wrap"><table><thead><tr>' + s.header.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + s.preview.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    h += '<h3>Missing values among valid rows</h3><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Missing</th><th>Percent</th></tr></thead><tbody>' + s.missing.map(function (m) { return '<tr><td>' + esc(m.label) + '</td><td class="num">' + m.count + ' of ' + m.total + '</td><td class="num">' + m.pct.toFixed(1) + '%</td></tr>'; }).join('') + '</tbody></table></div>';
    if (s.rejected.length) h += '<h3>Rejected rows (not imported)</h3><div class="table-wrap"><table><thead><tr><th>Row</th><th>Reasons</th><th>Values as uploaded</th></tr></thead><tbody>' + s.rejected.map(function (r) { return '<tr><td class="num">' + r.row + '</td><td class="wrap">' + esc(r.reasons.join('; ')) + '</td><td class="wrap">' + esc(r.raw.join(', ')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="row" style="margin-top:1rem"><button class="btn" data-action="importValid"' + (s.valid.length ? '' : ' disabled') + '>Import ' + s.valid.length + ' valid row(s)</button><button class="btn secondary" data-action="downloadQuality">Download data-quality summary</button></div></div>';
    return h;
  }

  function renderScreening() {
    var p = profile(), recs = filtered(), res = A.screenAll(recs, p), m = A.metrics(recs, res), fr = R.findingsRows(recs, res);
    var h = '<h1 tabindex="-1">Screening</h1>' + disclaimerBox();
    h += '<div class="card"><h2>Active reference profile <span class="chip unverified">' + (Object.keys(p.parameters).every(function (k) { return p.parameters[k].verification_status === 'verified'; }) ? 'Verified' : 'UNVERIFIED thresholds') + '</span></h2>' +
      '<dl class="kv"><dt>Profile</dt><dd>' + esc(p.label) + '</dd><dt>Standard</dt><dd>' + esc(p.standard) + ' &mdash; ' + esc(p.edition) + '</dd><dt>Source</dt><dd>' + esc(p.source_url) + '</dd><dt>Applicability</dt><dd>' + esc(p.applicability) + '</dd></dl>' +
      '<div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Configured range</th><th>Criterion type</th><th>Verification status</th></tr></thead><tbody>' +
      Object.keys(p.parameters).map(function (k) { var s = p.parameters[k]; return '<tr><td>' + esc(V.PARAMS[k].label) + '</td><td>' + esc(A.fmtRange(s)) + '</td><td>' + esc(s.criterion_type) + '</td><td>' + esc(s.verification_status) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="hint">Samples need at least ' + AQ.SETTINGS.minParametersForScreening + ' of these parameters to be screened; otherwise they are &ldquo;Insufficient data&rdquo;. Limits are inclusive: a value exactly on a limit is within range. A &ldquo;Within configured range&rdquo; result is never shown as &ldquo;safe&rdquo;.</p></div>';
    h += '<p class="info">' + esc(A.NO_SAFETY) + ' pH, turbidity and TDS alone cannot establish drinking-water safety.</p>';
    h += '<div class="row" style="margin:1rem 0">' + ['within', 'flagged', 'insufficient', 'invalid'].map(function (k) { return chip(k) + ' <strong>' + m.statuses[k] + '</strong>'; }).join(' &nbsp; ') + '</div>';
    if (!recs.length) return h + emptyState('No records match the current filters.');
    h += '<div class="card"><h2>Flagged measurements (' + fr.length + ')</h2>';
    if (!fr.length) h += '<p>No configured threshold exceedances detected in the selected records. ' + esc(A.NO_SAFETY) + '</p>';
    else h += '<div class="table-wrap"><table><thead><tr><th>Sample</th><th>Location</th><th>Date</th><th>Parameter</th><th>Observed</th><th>Unit</th><th>Reference</th><th>Source / status</th><th>Explanation</th><th>Recommended next step</th><th></th></tr></thead><tbody>' +
      fr.map(function (r) { return '<tr><td>' + esc(r.sample_id) + '</td><td>' + esc(r.location) + '</td><td>' + esc(r.sample_date) + '</td><td>' + esc(r.parameter) + '</td><td class="num out">' + esc(r.observed) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.reference) + '</td><td class="wrap">' + esc(r.source) + '<br><span class="chip unverified">' + esc(r.verification) + '</span></td><td class="wrap">' + esc(r.explanation) + '</td><td class="wrap">' + esc(r.next_step) + '</td><td><button class="btn secondary small" data-action="detail" data-id="' + esc(r.sample_id) + '">Details</button></td></tr>'; }).join('') + '</tbody></table></div>';
    h += '</div>';
    var ins = recs.filter(function (r) { return res[r.sample_id].status === 'insufficient'; });
    if (ins.length) h += '<div class="card" style="margin-top:1rem"><h2>Insufficient data (' + ins.length + ')</h2><p>These samples lack enough of the profile&rsquo;s parameters for a meaningful screening: ' + ins.map(function (r) { return esc(r.sample_id); }).join(', ') + '.</p></div>';
    return h;
  }

  function renderAnalytics() {
    var recs = filtered(), res = A.screenAll(recs, profile());
    var h = '<h1 tabindex="-1">Analytics</h1><p class="tabs-note">Descriptive statistics only. Differences between locations or over time do not explain causes.</p>';
    if (!recs.length) return h + emptyState('No records match the current filters.');
    var k = S.param, vals = A.values(recs, k);
    h += '<div class="card" style="margin-bottom:1rem"><div class="row">' + paramSelect() + '</div></div><div class="grid cols-2">';
    var hg = A.histogram(vals);
    h += '<div class="card"><h2>Distribution of ' + esc(V.PARAMS[k].label) + '</h2><div class="chart">' + (vals.length ? C.hist({ edges: hg.edges, counts: hg.counts, refs: refsFor(k, 'x'), xLabel: V.PARAMS[k].label + ' (' + unitOf(k) + ')', label: 'Distribution of ' + V.PARAMS[k].label }) : '<div class="chart-empty">No measurements of this parameter in the selected records.</div>') + '</div><p class="hint">n = ' + vals.length + ' measurements; ' + (recs.length - vals.length) + ' missing.</p></div>';
    h += '<div class="card"><h2>' + esc(V.PARAMS[k].label) + ' over time</h2><div class="chart">' + C.line({ series: seriesByLoc(recs, k), refs: refsFor(k), yLabel: unitOf(k), label: V.PARAMS[k].label + ' over time' }) + '</div>' + trendText(recs, k) + '</div>';
    var locs = {}; recs.forEach(function (r) { (locs[r.location] = locs[r.location] || []).push(r); });
    var names = Object.keys(locs).sort();
    h += '<div class="card"><h2>Location comparison</h2><div class="chart">' + C.box({ groups: names.map(function (l) { return { name: l, s: A.stats5(A.values(locs[l], k)) }; }), refs: refsFor(k), yLabel: unitOf(k), label: V.PARAMS[k].label + ' by location (box plot)' }) + '</div><p class="hint">Box = quartiles, thick line = median, whiskers = min/max. n shown under each location.</p></div>';
    var sc = names.map(function (l) { return A.countStatuses(locs[l], res); });
    h += '<div class="card"><h2>Flagged vs unflagged by location</h2><div class="chart">' + C.bar({ cats: names, stacked: true, yLabel: 'Samples', label: 'Screening status by location', series: [
      { name: 'Within configured range', color: STATUS_COLORS.within, values: sc.map(function (c) { return c.within; }) }, { name: 'Flagged for review', color: STATUS_COLORS.flagged, values: sc.map(function (c) { return c.flagged; }) },
      { name: 'Insufficient data', color: STATUS_COLORS.insufficient, values: sc.map(function (c) { return c.insufficient; }) }] }) + '</div></div>';
    var miss = V.missingSummary(recs), anyMiss = miss.some(function (x) { return x.count > 0; });
    h += '<div class="card"><h2>Missing data by parameter</h2><div class="chart">' + (anyMiss ? C.bar({ cats: miss.map(function (x) { return x.label.replace(/ \(.*\)/, ''); }), series: [{ name: '% missing', color: '#6a51a3', values: miss.map(function (x) { return +x.pct.toFixed(1); }) }], yLabel: '% of selected samples', label: 'Missing data by parameter' }) : '<div class="chart-empty">No missing values in the selected records.</div>') + '</div></div>';
    h += '</div>';
    h += outlierSection(recs);
    return h;
  }
  function trendText(recs, k) {
    var sl = A.trendSlope(recs, k);
    return '<p class="hint">' + (sl === null ? 'Fewer than 5 dated measurements: no trend estimate.' : 'Straight-line fit changes by about ' + (sl >= 0 ? '+' : '') + sl.toFixed(2) + ' ' + esc(unitOf(k)) + ' per 30 days across all selected locations. Descriptive only; it does not explain cause.') + '</p>';
  }
  function outlierSection(recs) {
    var o = A.detectOutliers(recs, { z: S.outlier.z, withinLocation: S.outlier.within });
    var h = '<div class="card" style="margin-top:1rem"><h2>Statistical outlier detection (robust z-score)</h2>' +
      '<p>For each parameter, a robust z-score = 0.6745 &times; (value &minus; median) / MAD is computed' + (S.outlier.within ? ' within each location' : ' across all selected records') + '. Values with |z| &ge; threshold are listed. <strong>This is a transparent statistic, not machine learning. An unusual measurement is not necessarily contaminated or unsafe</strong>; it may be an instrument error, a real local event, or normal variation.</p>' +
      '<div class="row"><div class="field"><label for="zIn">|z| threshold</label><input id="zIn" type="number" min="2" max="10" step="0.5" value="' + S.outlier.z + '" data-input="z" style="width:90px"></div><label><input type="checkbox" id="withinLoc" data-input="within"' + (S.outlier.within ? ' checked' : '') + '> Compare within each location</label></div>';
    if (!o.list.length) h += '<p>No unusual measurements found at this threshold' + (o.skipped.length ? ' (parameters with fewer than ' + AQ.SETTINGS.outlierMinSamples + ' values were skipped)' : '') + '.</p>';
    else h += '<p><strong>' + o.list.length + '</strong> sample(s) contain unusual measurements.</p><div class="table-wrap"><table><thead><tr><th>Sample</th><th>Location</th><th>Date</th><th>Unusual measurements</th><th></th></tr></thead><tbody>' + o.list.map(function (x) {
      var r = recs.filter(function (q) { return q.sample_id === x.id; })[0];
      return '<tr><td>' + esc(x.id) + '</td><td>' + esc(r.location) + '</td><td>' + esc(r.sample_date) + '</td><td class="wrap">' + x.contributors.map(function (c) { return esc(c.label + ': ' + c.value + ' ' + c.unit + ' (median ' + (+c.median.toFixed(2)) + ', z = ' + c.z.toFixed(1) + ')'); }).join('<br>') + '</td><td><button class="btn secondary small" data-action="detail" data-id="' + esc(x.id) + '">Details</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    if (o.skipped.length) h += '<p class="hint">Skipped (too few values): ' + esc(o.skipped.join('; ')) + '</p>';
    return h + '</div>';
  }

  function reportCtx() {
    var recs = filtered(), res = A.screenAll(recs, profile());
    return { records: recs, results: res, profile: profile(), profileId: S.profileId, filters: S.filters, outliers: A.detectOutliers(recs, { z: S.outlier.z, withinLocation: S.outlier.within }),
      demoPresent: recs.some(function (r) { return r.origin === 'demo'; }), generatedAt: new Date(), quality: S.imp && !S.imp.fatal ? R.qualityText(S.imp, S.imp.name) : '' };
  }
  function renderReports() {
    var recs = filtered(), h = '<h1 tabindex="-1">Reports</h1>' + disclaimerBox();
    if (!recs.length) return h + emptyState('No records match the current filters, so there is nothing to report.', '<p><button class="btn secondary" data-action="clearFilters">Clear filters</button></p>');
    var m = A.metrics(recs, A.screenAll(recs, profile()));
    h += '<div class="card"><h2>Report scope</h2><p>The report reflects exactly the <strong>' + recs.length + '</strong> records matching the active filters (' + m.locations + ' locations, ' + m.flagged + ' flagged) and the active profile <strong>' + esc(profile().label) + '</strong>.</p>' +
      '<div class="row"><button class="btn" data-action="reportDownload">Download HTML report</button><button class="btn secondary" data-action="reportPrint">Print / save as PDF</button><button class="btn secondary" data-action="exportRecords">Records (CSV)</button><button class="btn secondary" data-action="exportScreening">Screening results (CSV)</button><button class="btn secondary" data-action="exportFindings">Flagged observations (CSV)</button></div>' +
      '<p class="hint">PDF: choose &ldquo;Print / save as PDF&rdquo; and pick &ldquo;Save as PDF&rdquo; in your browser&rsquo;s print dialog (no PDF library is bundled).</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Preview</h2><iframe id="reportFrame" title="Report preview" sandbox="" style="width:100%;height:620px;border:1px solid #d3e1ea;border-radius:8px;background:#fff"></iframe></div>';
    return h;
  }

  function renderAbout() {
    var P = V.PARAMS, ref = AQ.REFERENCES;
    var h = '<h1 tabindex="-1">About &amp; methodology</h1><div class="prose">';
    h += disclaimerBox();
    h += '<div class="card"><h2>What AquaGuard AI is</h2><p>A browser-based tool that helps people look at water-quality measurements, spot readings that may need further investigation, review trends, and export reports. It was built for an IBM academic evaluation and is aligned to <strong>UN SDG 6: Clean Water and Sanitation</strong> (target 6.1 safe drinking water; target 6.3 water quality). It is <strong>not endorsed by IBM, the UN, BIS, WHO, CPCB or any government agency</strong>.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>How it works</h2><ol><li>Records come from the built-in synthetic demo dataset, the Add sample form, or a CSV import. Every record is validated (units, plausible ranges, real dates, unique IDs).</li><li>Each record is compared with the thresholds of the <em>active reference profile</em>. Limits are inclusive.</li><li>The result is one of four statuses: <em>Within configured range</em>, <em>Flagged for review</em>, <em>Insufficient data</em> (fewer than ' + AQ.SETTINGS.minParametersForScreening + ' of the profile&rsquo;s parameters measured) or <em>Invalid record</em>.</li><li>Charts, tables, outlier detection and reports are all recalculated from the records that match your filters.</li></ol>' +
      '<p><strong>Why no &ldquo;safe to drink&rdquo; badge?</strong> pH, turbidity, TDS and temperature cannot establish potability. Microbial contamination, toxic chemicals (e.g. arsenic, nitrate, pesticides) and sampling errors are invisible to these measurements.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Parameters</h2><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Unit</th><th>Accepted input range</th><th>Meaning</th></tr></thead><tbody>' + V.PARAM_KEYS.map(function (k) { return '<tr><td>' + esc(P[k].label) + '</td><td>' + esc(P[k].unit) + '</td><td>' + P[k].lo + ' to ' + P[k].hi + '</td><td class="wrap">' + esc(P[k].desc) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="hint">Accepted ranges are technical plausibility limits for data entry, not water-quality thresholds. Values are never converted between units.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Reference profiles</h2><p>' + esc(ref._meta.verification_note) + '</p>';
    Object.keys(ref.profiles).forEach(function (id) { var p = ref.profiles[id]; h += '<details><summary>' + esc(p.label) + (id === S.profileId ? ' (active)' : '') + '</summary><dl class="kv"><dt>Standard</dt><dd>' + esc(p.standard) + ' &mdash; ' + esc(p.edition) + '</dd><dt>Source</dt><dd>' + esc(p.source_url) + '</dd><dt>Applicability</dt><dd>' + esc(p.applicability) + '</dd></dl><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Range</th><th>Type</th><th>Verification</th><th>Note</th></tr></thead><tbody>' + Object.keys(p.parameters).map(function (k) { var s = p.parameters[k]; return '<tr><td>' + esc(P[k].label) + '</td><td>' + esc(A.fmtRange(s)) + '</td><td>' + esc(s.criterion_type) + '</td><td>' + esc(s.verification_status) + '</td><td class="wrap">' + esc(s.note || '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>'; });
    h += '</div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Demo data</h2><p>The initial 120 records are <strong>synthetic</strong>, generated by a script with a fixed random seed for four fictional sites (Site A&ndash;D) between early August and early October 2026. They include ordinary values, missing measurements, values outside the configured ranges and a few deliberately unusual observations. They are not field measurements and must not be presented as research findings.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Outlier detection</h2><p>A robust z-score (median and median absolute deviation) is used because it is not distorted by the outliers it is trying to find. It is a simple statistic, not a machine-learning model, and no accuracy is claimed.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>How data is stored</h2><p>Records are kept in your browser&rsquo;s <code>localStorage</code> for this file/site only, under the keys <code>aquaguard.v1.records</code> and <code>aquaguard.v1.settings</code>. Nothing is sent over the network. Clearing browser data or using private browsing removes them. Storage status: <strong>' + (Store.isPersistent() ? 'persistent' : 'NOT persistent (memory only)') + '</strong>.</p></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Limitations</h2><ul><li>Six parameters only; no microbiology or toxic chemicals.</li><li>Screening is against one profile at a time and is not a compliance check against any full standard.</li><li>Threshold values are marked <em>unverified</em> until checked against the cited sources.</li><li>Trends and location comparisons are descriptive and do not establish cause.</li><li>Opening index.html from different folders creates separate browser storage.</li></ul></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Reset and data management</h2><p>These actions only change AquaGuard&rsquo;s data in this browser; no files on your computer are touched.</p><div class="row"><button class="btn secondary" data-action="resetDemo">Reset Demo (keeps my records)</button><button class="btn danger" data-action="removeDemo">Remove demo data</button><button class="btn danger" data-action="clearUser">Delete my records</button></div></div>';
    return h + '</div>';
  }

  /* ---------- detail dialog ---------- */
  function showDetail(id) {
    var r = Store.get(id); if (!r) return;
    var s = A.screenRecord(r, profile()), o = A.detectOutliers(filtered(), { z: S.outlier.z, withinLocation: S.outlier.within }).map[id];
    var h = '<p>' + chip(s.status) + ' <span class="chip ' + (r.origin === 'demo' ? 'demo' : 'user') + '">' + (r.origin === 'demo' ? 'Demo (synthetic)' : 'My record') + '</span></p><p>' + esc(s.message) + '</p>';
    h += '<dl class="kv"><dt>Sample ID</dt><dd>' + esc(r.sample_id) + '</dd><dt>Date</dt><dd>' + esc(r.sample_date) + '</dd><dt>Location</dt><dd>' + esc(r.location) + '</dd><dt>Source</dt><dd>' + esc(r.source_type) + '</dd>' +
      V.PARAM_KEYS.map(function (k) { return '<dt>' + esc(V.PARAMS[k].label) + '</dt><dd>' + (r[k] === null || r[k] === undefined ? '<span class="missing">not measured</span>' : esc(r[k] + ' ' + unitOf(k))) + '</dd>'; }).join('') + '</dl>';
    s.findings.forEach(function (f) {
      h += '<div class="finding"><strong>' + esc(f.label) + ': ' + esc(f.value) + ' ' + esc(f.unit) + '</strong> (' + esc(f.direction) + ' range)<dl><dt>Reference</dt><dd>' + esc(f.reference) + '</dd><dt>Source</dt><dd>' + esc(f.source) + '</dd><dt>Status</dt><dd>' + esc(f.verification) + ' / ' + esc(f.criterionType) + '</dd></dl><p>' + esc(f.explanation) + '</p><p><strong>Recommended next step:</strong> ' + esc(f.nextStep) + '</p></div>';
    });
    if (o) h += '<div class="info"><strong>Statistically unusual:</strong> ' + o.contributors.map(function (c) { return esc(c.label + ' ' + c.value + ' ' + c.unit + ' (z = ' + c.z.toFixed(1) + ')'); }).join('; ') + '. Unusual does not mean contaminated or unsafe.</div>';
    h += '<p class="hint"><strong>Additional information that may be needed:</strong> ' + esc(s.needed.join(' ')) + '</p>';
    $('#detailTitle').textContent = 'Sample ' + id; $('#detailBody').innerHTML = h; $('#detailDlg').showModal();
  }

  /* ---------- sample form ---------- */
  function openForm(id) {
    var r = id ? Store.get(id) : null; S.editing = id || null;
    $('#sampleDlgTitle').textContent = id ? 'Edit sample ' + id : 'Add sample';
    var locs = {}; allRecords().forEach(function (x) { locs[x.location] = 1; });
    var v = function (k) { return r && r[k] !== null && r[k] !== undefined ? esc(r[k]) : ''; };
    var h = '<div id="formErrors" role="alert"></div><p class="hint"><span class="req">*</span> required. Enter values in the units shown; nothing is converted automatically. Leave optional measurements blank if not measured (at least one measurement is needed).</p><div class="form-grid">' +
      '<div class="field"><label for="f_sample_id">Sample ID <span class="req">*</span></label><input id="f_sample_id" value="' + v('sample_id') + '" autocomplete="off" required></div>' +
      '<div class="field"><label for="f_sample_date">Sample date <span class="req">*</span></label><input id="f_sample_date" type="date" min="1990-01-01" max="' + V.todayISO() + '" value="' + (r ? esc(r.sample_date) : V.todayISO()) + '" required></div>' +
      '<div class="field"><label for="f_location">Location <span class="req">*</span></label><input id="f_location" list="locList" value="' + v('location') + '" autocomplete="off" required><datalist id="locList">' + Object.keys(locs).sort().map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist></div>' +
      '<div class="field"><label for="f_source_type">Water source / type <span class="req">*</span></label><select id="f_source_type">' + V.SOURCE_TYPES.map(function (s) { return '<option' + (r && r.source_type === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
    V.PARAM_KEYS.forEach(function (k) { h += '<div class="field"><label for="f_' + k + '">' + esc(V.PARAMS[k].label) + ' (' + esc(unitOf(k)) + ')</label><input id="f_' + k + '" inputmode="decimal" value="' + v(k) + '" autocomplete="off"><span class="hint">Accepted ' + V.PARAMS[k].lo + '&ndash;' + V.PARAMS[k].hi + '</span></div>'; });
    $('#sampleDlgBody').innerHTML = h + '</div>';
    $('#sampleDlg').showModal(); $('#f_sample_id').focus();
  }
  function submitForm(e) {
    e.preventDefault();
    var raw = {}; ['sample_id', 'sample_date', 'location', 'source_type'].concat(V.PARAM_KEYS).forEach(function (k) { raw[k] = $('#f_' + k).value; });
    var chk = V.validateRecord(raw), box = $('#formErrors');
    if (chk.errors.length) { box.innerHTML = '<div class="err-list"><strong>Please fix the following:</strong><ul>' + chk.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; box.scrollIntoView({ block: 'nearest' }); return; }
    var out = S.editing ? Store.update(S.editing, chk.clean) : Store.add(chk.clean, 'user');
    if (!out.ok) { box.innerHTML = '<div class="err-list">' + esc(out.error) + '</div>'; return; }
    toast((S.editing ? 'Updated sample ' : 'Saved sample ') + chk.clean.sample_id, 'success');
    $('#sampleDlg').close(); render();
  }

  /* ---------- rendering ---------- */
  function render(focus) {
    refreshChrome();
    var fn = { dashboard: renderDashboard, samples: renderSamples, import: renderImport, screening: renderScreening, analytics: renderAnalytics, reports: renderReports, about: renderAbout }[S.section];
    var v = $('#view'); v.innerHTML = fn();
    document.title = SECTIONS[S.section] + ' - AquaGuard AI';
    if (S.section === 'reports' && $('#reportFrame')) $('#reportFrame').srcdoc = R.buildHTML(reportCtx());
    if (focus) { var hd = $('h1', v); if (hd) hd.focus(); }
  }
  function nav(sec) { S.section = sec; S.page = 0; $('#side').classList.remove('open'); render(true); window.scrollTo(0, 0); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]'); if (!t || t.disabled) return;
    var a = t.dataset.action, id = t.dataset.id;
    switch (a) {
      case 'nav': nav(t.dataset.section); break;
      case 'toggleMenu': var o = $('#side').classList.toggle('open'); t.setAttribute('aria-expanded', o); break;
      case 'add': openForm(); break;
      case 'edit': openForm(id); break;
      case 'detail': showDetail(id); break;
      case 'del': confirmDlg("Delete sample '" + id + "'? This cannot be undone.", 'Delete').then(function (ok) { if (!ok) return; var r = Store.remove(id); toast(r.ok ? 'Deleted sample ' + id : r.error, r.ok ? 'success' : 'error'); render(); }); break;
      case 'sort': S.sort = { key: t.dataset.key, dir: S.sort.key === t.dataset.key && S.sort.dir === 'asc' ? 'desc' : 'asc' }; render(); break;
      case 'page': S.page += +t.dataset.dir; render(); break;
      case 'closeDlg': $('#' + t.dataset.dlg).close(); break;
      case 'clearFilters': S.filters = { from: '', to: '', locations: [], search: '' }; $('#fSearch').value = ''; $('#fFrom').value = ''; $('#fTo').value = ''; render(); break;
      case 'resetDemo': confirmDlg('Restore the original synthetic demo dataset? Your own records are kept; any demo records you removed come back.', 'Reset demo').then(function (ok) { if (!ok) return; var n = Store.resetDemo(); toast('Demo data restored (' + n + ' synthetic records).', 'success'); render(); }); break;
      case 'removeDemo': confirmDlg('Remove all synthetic demo records from this browser? Your own records are kept. You can restore the demo later with Reset Demo.', 'Remove demo data').then(function (ok) { if (!ok) return; toast('Removed ' + Store.removeDemo() + ' demo records.', 'success'); render(); }); break;
      case 'clearUser': confirmDlg('Delete ALL of your own records (manual and imported)? Demo records are kept. This cannot be undone.', 'Delete my records').then(function (ok) { if (!ok) return; toast('Deleted ' + Store.clearUser() + ' of your records.', 'success'); render(); }); break;
      case 'downloadTemplate': R.download('aquaguard-template.csv', R.templateCSV(), 'text/csv'); toast('Template downloaded', 'success'); break;
      case 'exportRecords': R.download('aquaguard-records.csv', R.recordsCSV(filtered()), 'text/csv'); toast('Exported ' + filtered().length + ' records', 'success'); break;
      case 'exportScreening': var f1 = filtered(); R.download('aquaguard-screening.csv', R.screeningCSV(f1, A.screenAll(f1, profile())), 'text/csv'); toast('Screening results exported', 'success'); break;
      case 'exportFindings': var f2r = filtered(), fr = R.findingsRows(f2r, A.screenAll(f2r, profile())); R.download('aquaguard-flagged-observations.csv', R.toCSV(fr, ['sample_id', 'location', 'sample_date', 'parameter', 'observed', 'unit', 'reference', 'direction', 'source', 'verification', 'explanation', 'next_step']), 'text/csv'); toast('Flagged observations exported', 'success'); break;
      case 'downloadQuality': if (S.imp && !S.imp.fatal) R.download('aquaguard-data-quality-summary.txt', R.qualityText(S.imp, S.imp.name), 'text/plain'); break;
      case 'importValid': if (S.imp && S.imp.valid.length) { var n = Store.importMany(S.imp.valid); toast('Imported ' + n + ' records', 'success'); S.imp = null; render(); } break;
      case 'reportDownload': R.download('aquaguard-report-' + V.todayISO() + '.html', R.buildHTML(reportCtx()), 'text/html'); toast('Report downloaded', 'success'); break;
      case 'reportPrint': R.printHTML(R.buildHTML(reportCtx())); break;
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.input) return;
    if (t.dataset.input === 'search') { S.filters.search = t.value; S.page = 0; render(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.dataset && t.dataset.input; if (!k) return;
    if (k === 'from' || k === 'to') { S.filters[k] = t.value; S.page = 0; render(); }
    else if (k === 'loc') { S.filters.locations = $$('#fLocs input:checked').map(function (c) { return c.value; }); S.page = 0; render(); }
    else if (k === 'param') { S.param = t.value; render(); }
    else if (k === 'profile') { S.profileId = t.value; Store.setSetting('profile', t.value); render(); toast('Reference profile: ' + profile().label); }
    else if (k === 'z') { var z = parseFloat(t.value); if (isFinite(z) && z >= 2 && z <= 10) { S.outlier.z = z; render(); } else toast('Threshold must be between 2 and 10', 'error'); }
    else if (k === 'within') { S.outlier.within = t.checked; render(); }
    else if (k === 'csvfile') handleFile(t);
  });
  function handleFile(input) {
    var file = input.files && input.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () { S.imp = A_import(String(rd.result), file.name); if (S.imp.fatal) toast('Import failed: ' + S.imp.fatal, 'error'); else toast('Validated ' + S.imp.totalRows + ' rows: ' + S.imp.valid.length + ' valid, ' + S.imp.rejected.length + ' rejected'); render(); };
    rd.onerror = function () { S.imp = { fatal: 'The file could not be read by the browser.', name: file.name }; toast('Could not read the file', 'error'); render(); };
    rd.readAsText(file);
  }
  function A_import(text, name) { var r = V.validateImport(text, Store.idSet(), { futureTolerance: AQ.SETTINGS.futureToleranceDays }); r.name = name; return r; }
  $('#sampleForm').addEventListener('submit', submitForm);
  ['sampleDlg', 'confirmDlg', 'detailDlg'].forEach(function (id) { $('#' + id).addEventListener('click', function (e) { if (e.target === this && id !== 'confirmDlg') this.close(); }); });

  /* ---------- init ---------- */
  function init() {
    var info = Store.init();
    var ps = $('#profileSel'), saved = Store.getSetting('profile', null);
    if (saved && AQ.REFERENCES.profiles[saved]) S.profileId = saved;
    ps.innerHTML = Object.keys(AQ.REFERENCES.profiles).map(function (id) { return '<option value="' + id + '"' + (id === S.profileId ? ' selected' : '') + '>' + esc(AQ.REFERENCES.profiles[id].label) + '</option>'; }).join('');
    render();
    if (info.firstRun) toast('Demo mode: 120 synthetic sample records were loaded automatically.');
  }
  AQ.App = { state: S, render: render };
  init();
})();
