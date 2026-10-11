/* AquaGuard AI - CSV export and self-contained HTML report generation (client-side only). */
(function () {
  'use strict';
  var AQ = (window.AQ = window.AQ || {});
  var esc = function (s) { return AQ.Charts.esc(s === null || s === undefined ? '' : s); };

  /* CSV: quote fields; neutralise spreadsheet formula injection for text cells starting with = + - @ */
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
    var s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows, columns) {
    var out = [columns.join(',')];
    rows.forEach(function (r) { out.push(columns.map(function (c) { return csvCell(r[c]); }).join(',')); });
    return out.join('\n') + '\n';
  }
  function recordsCSV(records) { return toCSV(records, AQ.Validation.ALL_COLUMNS); }
  function templateCSV() {
    return AQ.Validation.ALL_COLUMNS.join(',') + '\nEXAMPLE-001,2026-09-01,Example Site (fictional),tap,7.2,0.5,280,25.0,430,\nEXAMPLE-002,2026-09-02,Example Site (fictional),tap,7.4,0.7,300,25.5,,7.1\n';
  }
  function screeningCSV(records, results) {
    var rows = [];
    records.forEach(function (r) {
      var s = results[r.sample_id]; if (!s) return;
      rows.push({ sample_id: r.sample_id, sample_date: r.sample_date, location: r.location, status: AQ.Analysis.STATUS[s.status].label, flagged_parameters: s.findings.map(function (f) { return f.label; }).join('; '), message: s.message });
    });
    return toCSV(rows, ['sample_id', 'sample_date', 'location', 'status', 'flagged_parameters', 'message']);
  }
  function findingsRows(records, results) {
    var rows = [];
    records.forEach(function (r) {
      var s = results[r.sample_id]; if (!s) return;
      s.findings.forEach(function (f) { rows.push({ sample_id: r.sample_id, location: r.location, sample_date: r.sample_date, parameter: f.label, observed: f.value, unit: f.unit, reference: f.reference, direction: f.direction, source: f.source, verification: f.verification, explanation: f.explanation, next_step: f.nextStep }); });
    });
    return rows;
  }
  function qualityText(summary, label) {
    var L = ['AquaGuard AI - data-quality summary', 'Source: ' + (label || 'imported file'), 'Generated: ' + new Date().toISOString(), '',
      'Rows read: ' + summary.totalRows, 'Valid rows: ' + summary.valid.length, 'Rejected rows: ' + summary.rejected.length, ''];
    L.push('Column mapping: ' + (Object.keys(summary.mapping).map(function (k) { return k + ' -> ' + summary.mapping[k]; }).join(', ') || 'none'));
    if (summary.ignored.length) L.push('Ignored (unsupported) columns: ' + summary.ignored.join(', '));
    summary.warnings.forEach(function (w) { L.push('WARNING: ' + w); });
    L.push('', 'Missing values among valid rows:');
    summary.missing.forEach(function (m) { L.push('  ' + m.label + ': ' + m.count + ' of ' + m.total + ' (' + m.pct.toFixed(1) + '%)'); });
    if (summary.rejected.length) { L.push('', 'Rejected rows and reasons:'); summary.rejected.forEach(function (r) { L.push('  row ' + r.row + ': ' + r.reasons.join('; ')); }); }
    return L.join('\n') + '\n';
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }
  function printHTML(html) {
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(function () { document.body.removeChild(f); }, 2000); }, 300);
  }

  function table(headers, rows, cls) {
    if (!rows.length) return '<p><em>None.</em></p>';
    return '<table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function n(v) { return v === null || v === undefined ? '' : v; }

  /* ctx: {records, results, profile, profileId, filters, outliers, generatedAt, demoPresent, quality} */
  function buildHTML(ctx) {
    var A = AQ.Analysis, V = AQ.Validation, C = AQ.Charts, recs = ctx.records, res = ctx.results, prof = ctx.profile;
    var now = ctx.generatedAt || new Date(), m = A.metrics(recs, res), st = m.statuses;
    var dates = recs.map(function (r) { return r.sample_date; }).sort();
    var f = ctx.filters || {};
    var filt = [f.from ? 'from ' + f.from : '', f.to ? 'to ' + f.to : '', f.locations && f.locations.length ? 'locations: ' + f.locations.join(', ') : '', f.search ? "search: '" + f.search + "'" : ''].filter(Boolean).join('; ') || 'none (all records)';
    var thr = Object.keys(prof.parameters).map(function (k) {
      var s = prof.parameters[k]; return [V.PARAMS[k].label, A.fmtRange(s), s.criterion_type, s.verification_status, s.note || ''];
    });
    var psum = A.paramSummary(recs).map(function (p) { return [p.label, p.unit, p.n, p.missing, n(p.min), p.median === null ? '' : +p.median.toFixed(3), p.mean === null ? '' : +p.mean.toFixed(3), n(p.max)]; });
    var fr = findingsRows(recs, res).map(function (r) { return [r.sample_id, r.location, r.sample_date, r.parameter, r.observed, r.unit, r.reference, r.source, r.verification, r.explanation, r.next_step]; });
    var qual = V.missingSummary(recs).map(function (x) { return [x.label, x.count + ' of ' + x.total, x.pct.toFixed(1) + '%']; });
    var insuff = recs.filter(function (r) { return res[r.sample_id] && res[r.sample_id].status === 'insufficient'; }).map(function (r) { return r.sample_id; });
    var byLoc = {}; recs.forEach(function (r) { (byLoc[r.location] = byLoc[r.location] || []).push(r); });
    var locs = Object.keys(byLoc).sort();
    var charts = '';
    ['ph', 'turbidity_ntu', 'tds_mg_l'].forEach(function (k) {
      var series = locs.map(function (l, i) { return { name: l, color: C.PALETTE[i % C.PALETTE.length], points: byLoc[l].filter(function (r) { return r[k] !== null && r[k] !== undefined; }).map(function (r) { return [Date.parse(r.sample_date + 'T00:00:00'), r[k], r.sample_id + ' ' + r.sample_date + ': ' + r[k]]; }) }; });
      var refs = []; var s = prof.parameters[k];
      if (s) { if (s.min !== undefined) refs.push({ y: s.min, label: 'min ' + s.min }); if (s.max !== undefined) refs.push({ y: s.max, label: 'max ' + s.max }); }
      charts += '<figure><figcaption>' + esc(V.PARAMS[k].label + ' over time (' + V.PARAMS[k].unit + ')') + '</figcaption>' + C.line({ series: series, refs: refs, yLabel: V.PARAMS[k].unit, label: V.PARAMS[k].label + ' over time' }) + '</figure>';
    });
    charts += '<figure><figcaption>Screening status distribution</figcaption>' + C.donut({ slices: [
      { label: 'Within configured range', value: st.within, color: '#0b6e99' }, { label: 'Flagged for review', value: st.flagged, color: '#c75f00' },
      { label: 'Insufficient data', value: st.insufficient, color: '#7b8a97' }, { label: 'Invalid record', value: st.invalid, color: '#a8231b' }], label: 'Screening status distribution' }) + '</figure>';
    var unusual = ctx.outliers ? ctx.outliers.list.map(function (o) { return [o.id, o.contributors.map(function (c) { return c.label + ' ' + c.value + ' ' + c.unit + ' (robust z ' + c.z.toFixed(1) + ')'; }).join('; ')]; }) : [];
    var sampleRows = recs.slice(0, 500).map(function (r) { var s = res[r.sample_id]; return [r.sample_id, r.sample_date, r.location, r.source_type, n(r.ph), n(r.turbidity_ntu), n(r.tds_mg_l), n(r.temperature_c), n(r.conductivity_us_cm), n(r.dissolved_oxygen_mg_l), s ? A.STATUS[s.status].label : '']; });
    var css = 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0d2b3e;max-width:1000px;margin:2rem auto;padding:0 1rem;line-height:1.5}h1,h2{color:#0b6e99}h2{border-bottom:1px solid #d3e1ea;padding-bottom:.2rem;margin-top:1.6rem}' +
      'table{border-collapse:collapse;width:100%;font-size:.78rem;margin:.5rem 0}th,td{border:1px solid #c5dde8;padding:3px 6px;text-align:left;vertical-align:top}th{background:#e4f1f7}' +
      '.disc{background:#fff1dc;border-left:6px solid #e08a00;padding:.6rem 1rem}.demo{background:#ece5fa;border-left:6px solid #59349a;padding:.6rem 1rem;font-weight:700}figure{margin:.8rem 0;break-inside:avoid}figcaption{font-weight:700;font-size:.9rem}svg{max-width:100%;height:auto}' +
      '@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}';
    var h = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AquaGuard AI screening report</title><style>' + css + '</style></head><body>';
    h += '<h1>AquaGuard AI - water-quality screening report</h1><p>Analysis date: ' + esc(now.toISOString().slice(0, 16).replace('T', ' ')) + ' UTC &nbsp;|&nbsp; Project: AquaGuard AI (IBM Social Impact Innovation project, UN SDG 6)</p>';
    if (ctx.demoPresent) h += '<p class="demo">DEMO MODE - the initial sample data is SYNTHETIC (fictional). It is not field research.</p>';
    h += '<div class="disc"><strong>Scientific disclaimer.</strong> ' + esc(A.DISCLAIMER) + ' ' + esc(A.NO_SAFETY) + '</div>';
    h += '<h2>1. Sample details</h2><p>' + recs.length + ' samples from ' + locs.length + ' location(s) (' + esc(locs.join(', ')) + '). Period: ' + esc(dates[0] || 'n/a') + ' to ' + esc(dates[dates.length - 1] || 'n/a') + '.<br>Active filters: ' + esc(filt) + '.</p>';
    h += table(['Sample ID', 'Date', 'Location', 'Source', 'pH', 'Turbidity (NTU)', 'TDS (mg/L)', 'Temp (\u00b0C)', 'Conductivity (\u00b5S/cm)', 'DO (mg/L)', 'Screening status'], sampleRows);
    if (recs.length > 500) h += '<p><em>Table shows the first 500 of ' + recs.length + ' selected samples; the CSV export contains all.</em></p>';
    h += '<h2>2. Reference profile used</h2><p><strong>' + esc(prof.label) + '</strong> (id: ' + esc(ctx.profileId) + ')<br>Standard: ' + esc(prof.standard) + '; edition: ' + esc(prof.edition) + '<br>Source: ' + esc(prof.source_url) + '<br>Applicability: ' + esc(prof.applicability) + '</p>' +
      table(['Parameter', 'Configured range', 'Criterion type', 'Verification status', 'Note'], thr) + '<p><strong>Threshold status:</strong> values marked unverified_offline have not been checked against the cited source and must not be treated as officially validated.</p>';
    h += '<h2>3. Data-quality checks</h2>' + table(['Parameter', 'Missing', 'Percent missing'], qual) + '<p>Samples with insufficient data for this profile: ' + (insuff.length ? esc(insuff.join(', ')) : 'none') + '.</p>' + (ctx.quality ? '<pre>' + esc(ctx.quality) + '</pre>' : '');
    h += '<h2>4. Available measurements and units</h2>' + table(['Parameter', 'Unit', 'n', 'Missing', 'Min', 'Median', 'Mean', 'Max'], psum);
    h += '<h2>5. Screening results</h2>' + table(['Status', 'Samples'], [['Within configured range', st.within], ['Flagged for review', st.flagged], ['Insufficient data', st.insufficient], ['Invalid record', st.invalid]]) + '<p>' + esc(A.NO_SAFETY) + '</p>';
    h += '<h2>6. Flagged observations</h2>' + table(['Sample', 'Location', 'Date', 'Parameter', 'Observed', 'Unit', 'Reference', 'Source', 'Verification', 'Explanation', 'Recommended next step'], fr);
    h += '<h2>7. Charts</h2>' + charts;
    h += '<h2>8. Statistically unusual observations</h2><p>Robust z-score (median and MAD) screening' + (ctx.outliers ? ' at |z| &ge; ' + ctx.outliers.z + (ctx.outliers.within ? ', within each location' : ', across all selected records') : '') + '. Unusual does not mean contaminated or unsafe.</p>' + table(['Sample', 'Unusual measurements'], unusual);
    h += '<h2>9. Recommended follow-up</h2><ul><li>Repeat flagged measurements with calibrated instruments and documented sampling.</li><li>Where water is used for drinking, arrange accredited laboratory testing, including microbiological tests.</li><li>Consult local public-health authorities for official advice.</li></ul>';
    h += '<h2>10. Limitations</h2><ul><li>Screening covers only the listed parameters against one reference profile; it is not a compliance check against a full standard.</li><li>pH, turbidity and TDS alone cannot establish drinking-water safety. Microbial contamination, toxic chemicals and sampling errors are not detected.</li><li>Threshold values are marked unverified until confirmed against the cited sources.</li><li>Descriptive trends and location comparisons do not explain causes.</li><li>This report is not endorsed by IBM, the UN, BIS, WHO, CPCB or any government agency.</li></ul>';
    h += '<p style="margin-top:2rem;color:#4c6377;font-size:.8rem">Generated by AquaGuard AI in the browser. No data left your computer.</p></body></html>';
    return h;
  }

  AQ.Reports = { toCSV: toCSV, csvCell: csvCell, recordsCSV: recordsCSV, templateCSV: templateCSV, screeningCSV: screeningCSV, findingsRows: findingsRows, qualityText: qualityText, buildHTML: buildHTML, download: download, printHTML: printHTML };
})();
