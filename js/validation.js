/* AquaGuard AI - validation and CSV parsing. Plain script (no modules) so it works from file://.
   Rules: values are never converted between units; problem rows are returned, never silently dropped. */
(function () {
  'use strict';
  var AQ = (window.AQ = window.AQ || {});

  var PARAMS = {
    ph: { label: 'pH', unit: 'pH units', lo: 0, hi: 14, desc: 'Acidity/alkalinity on a 0-14 scale.' },
    turbidity_ntu: { label: 'Turbidity', unit: 'NTU', lo: 0, hi: 1000, desc: 'Cloudiness caused by suspended particles.' },
    tds_mg_l: { label: 'Total dissolved solids (TDS)', unit: 'mg/L', lo: 0, hi: 50000, desc: 'Dissolved minerals and salts; an acceptability indicator.' },
    temperature_c: { label: 'Temperature', unit: '\u00b0C', lo: 0, hi: 60, desc: 'Water temperature at sampling.' },
    conductivity_us_cm: { label: 'Electrical conductivity', unit: '\u00b5S/cm', lo: 0, hi: 100000, desc: 'Ability to conduct current; tracks dissolved ions.' },
    dissolved_oxygen_mg_l: { label: 'Dissolved oxygen', unit: 'mg/L', lo: 0, hi: 25, desc: 'Oxygen dissolved in water; relevant to surface-water health.' }
  };
  var PARAM_KEYS = Object.keys(PARAMS);
  var REQUIRED_TEXT = ['sample_id', 'sample_date', 'location', 'source_type'];
  var ALL_COLUMNS = REQUIRED_TEXT.concat(PARAM_KEYS);
  var SOURCE_TYPES = ['tap', 'borewell', 'well', 'tank', 'river', 'lake', 'other'];

  var ALIASES = {
    id: 'sample_id', sampleid: 'sample_id', sample: 'sample_id',
    date: 'sample_date', sampledate: 'sample_date', sample_datetime: 'sample_date', datetime: 'sample_date', timestamp: 'sample_date',
    site: 'location', location_name: 'location', station: 'location',
    source: 'source_type', sample_type: 'source_type', water_source: 'source_type',
    ph_value: 'ph', turbidity: 'turbidity_ntu', tds: 'tds_mg_l', temperature: 'temperature_c', temp: 'temperature_c', temp_c: 'temperature_c',
    conductivity: 'conductivity_us_cm', ec: 'conductivity_us_cm', dissolved_oxygen: 'dissolved_oxygen_mg_l', do: 'dissolved_oxygen_mg_l'
  };
  var UNIT_MISMATCH = {
    turbidity_fnu: ['turbidity_ntu', 'FNU'], turbidity_jtu: ['turbidity_ntu', 'JTU'],
    tds_ppm: ['tds_mg_l', 'ppm'], tds_g_l: ['tds_mg_l', 'g/L'], tds_ppt: ['tds_mg_l', 'ppt'],
    temperature_f: ['temperature_c', '\u00b0F'], temp_f: ['temperature_c', '\u00b0F'], temperature_k: ['temperature_c', 'K'],
    conductivity_ms_cm: ['conductivity_us_cm', 'mS/cm'], conductivity_s_m: ['conductivity_us_cm', 'S/m'], ec_ms_cm: ['conductivity_us_cm', 'mS/cm'],
    dissolved_oxygen_percent: ['dissolved_oxygen_mg_l', '% saturation'], do_percent: ['dissolved_oxygen_mg_l', '% saturation'], dissolved_oxygen_ppm: ['dissolved_oxygen_mg_l', 'ppm']
  };
  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$/;

  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO(now) { now = now || new Date(); return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()); }

  /* Strict ISO date (YYYY-MM-DD, optional time part ignored). Returns {value, error}. */
  function parseDate(v, now, tolDays) {
    if (isBlank(v)) return { value: null, error: 'Sample date is required' };
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.exec(String(v).trim());
    if (!m) return { value: null, error: "Sample date '" + v + "' is not in YYYY-MM-DD format" };
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { value: null, error: "Sample date '" + m[1] + '-' + m[2] + '-' + m[3] + "' is not a real calendar date" };
    var iso = m[1] + '-' + m[2] + '-' + m[3];
    if (y < 1990) return { value: null, error: 'Sample date ' + iso + ' is before 1990' };
    var limit = new Date((now || new Date()).getTime() + (tolDays == null ? 1 : tolDays) * 86400000);
    if (iso > todayISO(limit)) return { value: null, error: 'Sample date ' + iso + ' is in the future' };
    return { value: iso, error: null };
  }

  function parseNum(v, key) {
    var p = PARAMS[key];
    if (isBlank(v)) return { value: null, error: null, blank: true };
    var s = String(v).trim().replace(/,/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return { value: null, error: p.label + " '" + v + "' is not a number" };
    var n = parseFloat(s);
    if (!isFinite(n)) return { value: null, error: p.label + ' must be a finite number' };
    if (n < p.lo || n > p.hi) return { value: null, error: p.label + ' ' + n + ' ' + p.unit + ' is outside the accepted input range ' + p.lo + ' to ' + p.hi + ' ' + p.unit };
    return { value: n, error: null };
  }

  /* Validate one record (canonical field names). Returns {clean, errors}. */
  function validateRecord(raw, opts) {
    opts = opts || {};
    var errors = [], clean = {};
    var sid = isBlank(raw.sample_id) ? '' : String(raw.sample_id).trim();
    if (!sid) errors.push('Sample ID is required');
    else if (!ID_RE.test(sid)) errors.push("Sample ID may contain only letters, digits, '_', '-' and '.' (max 64 characters, starting with a letter or digit)");
    clean.sample_id = sid;
    var d = parseDate(raw.sample_date, opts.now, opts.futureTolerance);
    if (d.error) errors.push(d.error);
    clean.sample_date = d.value;
    ['location', 'source_type'].forEach(function (f) {
      var v = isBlank(raw[f]) ? '' : String(raw[f]).trim();
      if (!v) errors.push((f === 'location' ? 'Location' : 'Water source / type') + ' is required');
      else if (v.length > 100) errors.push((f === 'location' ? 'Location' : 'Water source / type') + ' is longer than 100 characters');
      clean[f] = v;
    });
    if (clean.source_type && SOURCE_TYPES.indexOf(clean.source_type.toLowerCase()) >= 0) clean.source_type = clean.source_type.toLowerCase();
    var any = false;
    PARAM_KEYS.forEach(function (k) {
      var r = parseNum(raw[k], k);
      if (r.error) errors.push(r.error);
      clean[k] = r.value;
      if (r.value !== null) any = true;
    });
    if (!any && !errors.some(function (e) { return /number|range|finite/.test(e); })) errors.push('At least one measurement is required');
    return { clean: clean, errors: errors };
  }

  /* RFC-4180-style CSV parser. Throws Error with a readable message on malformed quoting. */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [], row = [], field = '', i = 0, inQ = false, n = text.length, wasQuoted = false;
    while (i < n) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"' && field === '' && !wasQuoted) { inQ = true; wasQuoted = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; wasQuoted = false; i++; continue; }
      if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; wasQuoted = false;
        if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
        row = []; i++; continue;
      }
      field += c; i++;
    }
    if (inQ) throw new Error('The file is malformed: a quoted field is never closed.');
    if (field !== '' || row.length) { row.push(field); if (!(row.length === 1 && row[0].trim() === '')) rows.push(row); }
    return rows;
  }

  function normHeader(h) { return String(h).replace(/^\ufeff/, '').trim().toLowerCase().replace(/[\s\-]+/g, '_'); }

  /* Map CSV headers to canonical names. Returns {map:{index:canon}, ignored:[], problems:[], missing:[]} */
  function mapColumns(header) {
    var map = {}, used = {}, ignored = [], problems = [];
    header.forEach(function (h, idx) {
      var n = normHeader(h);
      if (UNIT_MISMATCH[n]) {
        var u = UNIT_MISMATCH[n];
        problems.push("Column '" + h + "' appears to use " + u[1] + ", but AquaGuard requires '" + u[0] + "' (" + PARAMS[u[0]].unit + '). Convert the values yourself and rename the column; values are never converted silently.');
        return;
      }
      var canon = ALL_COLUMNS.indexOf(n) >= 0 ? n : ALIASES[n];
      if (canon && !used[canon]) { map[idx] = canon; used[canon] = true; } else ignored.push(h);
    });
    var missing = REQUIRED_TEXT.filter(function (c) { return !used[c]; });
    if (!PARAM_KEYS.some(function (k) { return used[k]; })) missing.push('at least one measurement column (e.g. ph, turbidity_ntu, tds_mg_l)');
    return { map: map, ignored: ignored, problems: problems, missing: missing };
  }

  /* Validate CSV text. Never throws; returns {fatal, valid, rejected, warnings, mapping, ignored, missing, totalRows, preview}. */
  function validateImport(text, existingIds, opts) {
    var out = { fatal: null, valid: [], rejected: [], warnings: [], mapping: {}, ignored: [], missing: [], totalRows: 0, preview: [], header: [] };
    opts = opts || {}; existingIds = existingIds || {};
    var maxBytes = (opts.maxMB || 5) * 1048576, maxRows = opts.maxRows || 20000;
    if (text == null || String(text).trim() === '') { out.fatal = 'The file is empty.'; return out; }
    if (String(text).length > maxBytes) { out.fatal = 'The file is larger than the ' + (opts.maxMB || 5) + ' MB limit.'; return out; }
    if (/\u0000/.test(text)) { out.fatal = 'The file contains binary data and is not a CSV text file.'; return out; }
    var rows;
    try { rows = parseCSV(String(text)); } catch (e) { out.fatal = e.message; return out; }
    if (!rows.length) { out.fatal = 'The file has no readable header row.'; return out; }
    var header = rows[0];
    out.header = header;
    if (header.length < 2) { out.fatal = 'The file has fewer than two columns; check that it is comma-separated.'; return out; }
    var body = rows.slice(1);
    if (!body.length) { out.fatal = 'The file contains a header but no data rows.'; return out; }
    if (body.length > maxRows) { out.fatal = 'The file has ' + body.length + ' rows; the limit is ' + maxRows + '.'; return out; }
    var cm = mapColumns(header);
    if (cm.problems.length) { out.fatal = 'Unit mismatch: ' + cm.problems.join(' | '); return out; }
    if (cm.missing.length) { out.fatal = 'Missing required column(s): ' + cm.missing.join(', ') + '. Download the CSV template to see the expected format.'; return out; }
    out.mapping = {}; Object.keys(cm.map).forEach(function (i) { out.mapping[header[i]] = cm.map[i]; });
    out.ignored = cm.ignored; out.totalRows = body.length;
    out.preview = body.slice(0, 10);
    var seen = {};
    body.forEach(function (cells, i) {
      var rowNo = i + 2, errs = [];
      if (cells.length !== header.length) errs.push('row has ' + cells.length + ' fields but the header has ' + header.length);
      var raw = {};
      Object.keys(cm.map).forEach(function (idx) { raw[cm.map[idx]] = cells[idx]; });
      var r = validateRecord(raw, opts);
      errs = errs.concat(r.errors);
      var sid = r.clean.sample_id;
      if (sid && !r.errors.some(function (e) { return /^Sample ID/.test(e); })) {
        if (seen[sid]) errs.push("duplicate Sample ID '" + sid + "' (first seen on row " + seen[sid] + ')');
        else if (existingIds[sid]) errs.push("Sample ID '" + sid + "' already exists in the application");
        else seen[sid] = rowNo;
      }
      if (errs.length) out.rejected.push({ row: rowNo, raw: cells, reasons: errs });
      else out.valid.push(r.clean);
    });
    if (out.ignored.length) out.warnings.push('Unsupported columns were ignored: ' + out.ignored.join(', '));
    if (out.rejected.length) out.warnings.push(out.rejected.length + ' of ' + out.totalRows + ' rows were rejected (listed below); they will NOT be imported.');
    out.missing = missingSummary(out.valid);
    out.missing.forEach(function (m) { if (m.pct > 50 && m.count) out.warnings.push(PARAMS[m.key].label + ' is missing in ' + Math.round(m.pct) + '% of valid rows.'); });
    return out;
  }

  function missingSummary(records) {
    return PARAM_KEYS.map(function (k) {
      var c = records.filter(function (r) { return r[k] === null || r[k] === undefined; }).length;
      return { key: k, label: PARAMS[k].label, count: c, total: records.length, pct: records.length ? (c / records.length) * 100 : 0 };
    });
  }

  AQ.Validation = { PARAMS: PARAMS, PARAM_KEYS: PARAM_KEYS, ALL_COLUMNS: ALL_COLUMNS, REQUIRED_TEXT: REQUIRED_TEXT, SOURCE_TYPES: SOURCE_TYPES,
    isBlank: isBlank, parseDate: parseDate, parseNum: parseNum, validateRecord: validateRecord, parseCSV: parseCSV,
    mapColumns: mapColumns, validateImport: validateImport, missingSummary: missingSummary, todayISO: todayISO };
})();
