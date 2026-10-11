/* Unit tests for the AquaGuard AI logic modules. Run:  node tests/unit.test.js
   Node is used ONLY as a test runner; the app itself needs no Node. No npm packages are required. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['data', 'validation', 'storage', 'analysis', 'charts', 'reports'].map(n => path.join(ROOT, 'js', n + '.js'));

function fakeStorage(init) {
  const m = Object.assign({}, init || {});
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m };
}
function load(storage) {
  const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, isFinite, isNaN, parseFloat, parseInt, setTimeout, RegExp, Error });
  ctx.window = ctx;                       // like a browser: window is the global object
  ctx.localStorage = storage === undefined ? fakeStorage() : storage;
  FILES.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
  return ctx.AQ;
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '\n    ', e.message.split('\n')[0]); }
}
const good = (o) => Object.assign({ sample_id: 'T-1', sample_date: '2026-09-01', location: 'Test', source_type: 'tap', ph: 7.2, turbidity_ntu: 0.5, tds_mg_l: 280, temperature_c: 25, conductivity_us_cm: null, dissolved_oxygen_mg_l: null }, o || {});
const plain = x => JSON.parse(JSON.stringify(x)); const deq = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), m);
const NOW = new Date(2026, 9, 11, 12, 0, 0);
const HEAD = 'sample_id,sample_date,location,source_type,ph,turbidity_ntu,tds_mg_l,temperature_c\n';

const AQ = load(), V = AQ.Validation, A = AQ.Analysis, R = AQ.Reports, C = AQ.Charts;
const PROF = AQ.REFERENCES.profiles.BIS_IS10500_acceptable;

/* ---------- validation ---------- */
test('valid sample input is accepted', () => { const r = V.validateRecord(good(), { now: NOW }); deq(r.errors, []); assert.strictEqual(r.clean.ph, 7.2); });
[['ph', 'abc'], ['ph', 15], ['ph', -1], ['turbidity_ntu', -0.1], ['tds_mg_l', 1e9], ['temperature_c', 200], ['ph', 'NaN'], ['ph', 'Infinity'], ['dissolved_oxygen_mg_l', 99]].forEach(([k, v]) =>
  test(`invalid numeric value rejected: ${k}=${v}`, () => assert.ok(V.validateRecord(good({ [k]: v }), { now: NOW }).errors.length > 0)));
['sample_id', 'sample_date', 'location', 'source_type'].forEach(k =>
  test(`missing required field rejected: ${k}`, () => assert.ok(V.validateRecord(good({ [k]: '' }), { now: NOW }).errors.length > 0)));
test('at least one measurement is required', () => {
  const r = V.validateRecord(good({ ph: null, turbidity_ntu: null, tds_mg_l: null, temperature_c: null }), { now: NOW });
  assert.ok(r.errors.some(e => /At least one measurement/.test(e)));
});
test('optional measurements may be omitted', () => deq(V.validateRecord(good({ ph: null, tds_mg_l: '' }), { now: NOW }).errors, []));
['not a date', '2026-13-45', '2026-02-30', '1980-01-01', '2999-01-01', '01/09/2026'].forEach(d =>
  test(`impossible/invalid date rejected: ${d}`, () => assert.ok(V.validateRecord(good({ sample_date: d }), { now: NOW }).errors.length > 0)));
test('valid date with time part accepted, time ignored', () => assert.strictEqual(V.validateRecord(good({ sample_date: '2026-09-01 10:30' }), { now: NOW }).clean.sample_date, '2026-09-01'));
test('bad sample id rejected', () => assert.ok(V.validateRecord(good({ sample_id: 'a b;<script>' }), { now: NOW }).errors.length));
test('numbers with thousands separators parse', () => assert.strictEqual(V.parseNum('1,200', 'tds_mg_l').value, 1200));

/* ---------- CSV parsing and import validation ---------- */
test('parseCSV handles quotes, CRLF, BOM and embedded commas', () => {
  const rows = V.parseCSV('\ufeffa,b\r\n"x, y","he said ""hi"""\r\n');
  deq(rows, [['a', 'b'], ['x, y', 'he said "hi"']]);
});
test('parseCSV rejects unterminated quote', () => assert.throws(() => V.parseCSV('a,b\n"oops,1\n'), /never closed/));
test('empty CSV -> fatal error', () => { assert.ok(V.validateImport('', {}).fatal); assert.ok(V.validateImport('   \n ', {}).fatal); });
test('header-only CSV -> fatal error', () => assert.ok(/no data rows/.test(V.validateImport(HEAD, {}).fatal)));
test('binary/malformed content -> fatal error', () => { assert.ok(V.validateImport('PK\u0000\u0003binary', {}).fatal); assert.ok(V.validateImport('a,b\n"x,1', {}).fatal); });
test('missing required columns reported', () => assert.ok(/Missing required column/.test(V.validateImport('sample_id,sample_date,ph\nA,2026-09-01,7\n', {}).fatal)));
test('missing measurement columns reported', () => assert.ok(/measurement column/.test(V.validateImport('sample_id,sample_date,location,source_type\nA,2026-09-01,x,tap\n', {}).fatal)));
test('unit mismatch headers are refused, not converted', () => {
  const r = V.validateImport(HEAD.replace('tds_mg_l', 'tds_ppm').replace('temperature_c', 'temperature_f') + 'A,2026-09-01,x,tap,7,1,100,70\n', {});
  assert.ok(/Unit mismatch/.test(r.fatal) && /ppm/.test(r.fatal) && /°F/.test(r.fatal));
});
test('duplicate IDs in file and existing IDs are rejected with reasons', () => {
  const body = 'A1,2026-09-01,S,tap,7.1,0.4,200,25\nA1,2026-09-02,S,tap,7.2,0.5,210,25\nB2,2026-09-02,S,tap,7.2,0.5,210,25\n';
  const r = V.validateImport(HEAD + body, { B2: true }, { now: NOW });
  assert.strictEqual(r.valid.length, 1); assert.strictEqual(r.rejected.length, 2);
  assert.ok(/duplicate/.test(r.rejected[0].reasons.join()) && /already exists/.test(r.rejected[1].reasons.join()));
});
test('no row is silently dropped: valid + rejected == total', () => {
  const body = 'A1,2026-09-01,S,tap,7.1,0.4,200,25\nA2,bad,S,tap,x,0.4,200,25\nA3,2026-09-01,S,tap,7.1\nA4,2026-09-01,S,tap,7.0,0.1,100,20\n';
  const r = V.validateImport(HEAD + body, {}, { now: NOW });
  assert.strictEqual(r.valid.length + r.rejected.length, r.totalRows); assert.strictEqual(r.totalRows, 4);
  assert.ok(r.rejected.every(x => x.reasons.length && x.raw.length));
  assert.ok(r.rejected.some(x => /fields but the header has/.test(x.reasons.join())));
});
test('missing values are reported per parameter', () => {
  const r = V.validateImport(HEAD + 'A1,2026-09-01,S,tap,7.1,,200,25\nA2,2026-09-02,S,tap,7.1,0.2,200,25\n', {}, { now: NOW });
  const t = r.missing.find(m => m.key === 'turbidity_ntu'); assert.strictEqual(t.count, 1); assert.strictEqual(t.pct, 50);
});
test('aliases mapped and unsupported columns ignored with warning', () => {
  const r = V.validateImport('ID,Date,Site,Source,pH,Turbidity,TDS,Temp,Notes\nA1,2026-09-01,S,tap,7.1,0.4,200,25,hello\n', {}, { now: NOW });
  assert.strictEqual(r.valid.length, 1); deq(r.ignored, ['Notes']); assert.ok(r.warnings.some(w => /Unsupported/.test(w)));
});
test('file size limit enforced', () => assert.ok(/larger than/.test(V.validateImport(HEAD + 'x'.repeat(2e6), {}, { maxMB: 1 }).fatal)));

/* ---------- screening ---------- */
const range = { ph: [6.5, 8.5], turbidity_ntu: [null, 1.0], tds_mg_l: [null, 500] };
Object.keys(range).forEach(k => {
  const [lo, hi] = range[k], top = hi, bottom = lo;
  test(`boundary is inclusive (within): ${k} at limit`, () => { [top, bottom].filter(x => x !== null).forEach(v => assert.strictEqual(A.screenRecord(good({ [k]: v }), PROF).status, 'within')); });
  test(`just outside limit is flagged: ${k}`, () => {
    const v = top + (k === 'tds_mg_l' ? 0.5 : 0.01), r = A.screenRecord(good({ [k]: v }), PROF);
    assert.strictEqual(r.status, 'flagged'); assert.strictEqual(r.findings[0].key, k); assert.strictEqual(r.findings[0].direction, 'above');
  });
});
test('below minimum pH flagged with direction below', () => { const f = A.screenRecord(good({ ph: 6.49 }), PROF).findings[0]; assert.strictEqual(f.direction, 'below'); });
test('flagged finding carries value, unit, reference, source, status, explanation, next step', () => {
  const f = A.screenRecord(good({ ph: 9 }), PROF).findings[0];
  ['label', 'value', 'unit', 'reference', 'source', 'verification', 'explanation', 'nextStep'].forEach(k => assert.ok(f[k] !== undefined && f[k] !== '', k));
  assert.strictEqual(f.value, 9); assert.strictEqual(f.unit, 'pH units'); assert.ok(/6.5 to 8.5/.test(f.reference));
});
test('insufficient data when fewer than 2 profile parameters are measured', () => {
  assert.strictEqual(A.screenRecord(good({ turbidity_ntu: null, tds_mg_l: null }), PROF).status, 'insufficient');
  assert.strictEqual(A.screenRecord(good({ turbidity_ntu: null }), PROF).status, 'within');
});
test('invalid record status for bad values', () => assert.strictEqual(A.screenRecord(good({ ph: 'x' }), PROF).status, 'invalid'));
test('never says safe/unsafe; always carries the no-safety statement', () => {
  ['within', 'flagged', 'insufficient'].forEach((st, i) => {
    const rec = [good(), good({ ph: 9 }), good({ turbidity_ntu: null, tds_mg_l: null })][i], m = A.screenRecord(rec, PROF).message;
    assert.strictEqual(A.screenRecord(rec, PROF).status, st);
    assert.ok(m.includes('does not establish drinking-water safety'));
    assert.ok(!/\bunsafe\b/i.test(m) && !/safe to drink/i.test(m));
  });
  assert.ok(!/\bsafe\b/i.test(A.STATUS.within.label + A.STATUS.within.long));
});
test('every configured threshold has provenance and applicability', () => {
  Object.keys(AQ.REFERENCES.profiles).forEach(id => {
    const p = AQ.REFERENCES.profiles[id];
    assert.ok(p.standard && p.edition && /^https?:\/\//.test(p.source_url) && p.applicability, id);
    Object.keys(p.parameters).forEach(k => { const s = p.parameters[k]; assert.ok(s.unit && s.criterion_type && s.verification_status, id + '/' + k); assert.ok(s.min !== undefined || s.max !== undefined); assert.ok(V.PARAMS[k], 'unknown parameter ' + k); });
  });
});
test('all thresholds are honestly marked unverified', () => Object.values(AQ.REFERENCES.profiles).forEach(p => Object.values(p.parameters).forEach(s => assert.strictEqual(s.verification_status, 'unverified_offline'))));
test('manual and imported records screen identically', () => {
  const manual = A.screenRecord(good({ ph: 9, turbidity_ntu: 2 }), PROF);
  const imp = V.validateImport(HEAD + 'T-1,2026-09-01,Test,tap,9,2,280,25\n', {}, { now: NOW });
  const viaCsv = A.screenRecord(imp.valid[0], PROF);
  assert.strictEqual(viaCsv.status, manual.status); deq(viaCsv.findings.map(f => f.key), manual.findings.map(f => f.key));
});

/* ---------- demo data ---------- */
const DEMO = AQ.DEMO_ROWS;
test('demo dataset: >=100 records, >=4 fictional locations, several weeks', () => {
  assert.ok(DEMO.length >= 100); const locs = new Set(DEMO.map(r => r.location)); assert.ok(locs.size >= 4); assert.ok([...locs].every(l => /^Site [A-D]$/.test(l)));
  const dates = DEMO.map(r => r.sample_date).sort(); assert.ok((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 864e5 >= 42);
});
test('demo dataset: all records valid, IDs unique and synthetic-tagged', () => {
  assert.strictEqual(new Set(DEMO.map(r => r.sample_id)).size, DEMO.length); assert.ok(DEMO.every(r => /^DEMO-\d{3}$/.test(r.sample_id)));
  DEMO.forEach(r => deq(V.validateRecord(r, { now: NOW }).errors, [], r.sample_id));
});
test('demo dataset contains missing values, flagged, insufficient and unusual observations', () => {
  assert.ok(DEMO.some(r => r.conductivity_us_cm === null) && DEMO.some(r => r.ph === null));
  const res = A.screenAll(DEMO, PROF), c = A.countStatuses(DEMO, res); assert.ok(c.flagged > 5 && c.within > 5 && c.insufficient >= 1 && c.invalid === 0);
  assert.ok(A.detectOutliers(DEMO, {}).list.length >= 3);
});
test('data/demo-water-quality.csv matches the embedded demo dataset', () => {
  const imp = V.validateImport(fs.readFileSync(path.join(ROOT, 'data', 'demo-water-quality.csv'), 'utf8'), {}, { now: NOW });
  assert.strictEqual(imp.rejected.length, 0); deq(JSON.parse(JSON.stringify(imp.valid)), JSON.parse(JSON.stringify(DEMO)));
});

/* ---------- analytics ---------- */
test('dashboard metrics are computed from the records', () => {
  const recs = DEMO, res = A.screenAll(recs, PROF), m = A.metrics(recs, res);
  assert.strictEqual(m.total, recs.length); assert.strictEqual(m.locations, new Set(recs.map(r => r.location)).size);
  assert.strictEqual(m.latest, recs.map(r => r.sample_date).sort().pop()); assert.strictEqual(m.flagged, recs.filter(r => res[r.sample_id].status === 'flagged').length);
  assert.strictEqual(m.statuses.within + m.statuses.flagged + m.statuses.insufficient + m.statuses.invalid, m.total);
  assert.strictEqual(A.metrics([], {}).total, 0);
});
test('filters: date range, location, search, combined', () => {
  assert.strictEqual(A.applyFilters(DEMO, { locations: ['Site A'] }).length, 30);
  assert.ok(A.applyFilters(DEMO, { from: '2026-09-01', to: '2026-09-07' }).every(r => r.sample_date >= '2026-09-01' && r.sample_date <= '2026-09-07'));
  assert.strictEqual(A.applyFilters(DEMO, { search: 'demo-005' }).length, 1);
  assert.strictEqual(A.applyFilters(DEMO, { search: 'BOREWELL', locations: ['Site B'] }).length, 30);
  assert.strictEqual(A.applyFilters(DEMO, { search: 'nothing-matches' }).length, 0);
});
test('outliers: planted value found; within-location mode works; small samples skipped', () => {
  const recs = []; for (let i = 0; i < 20; i++) recs.push(good({ sample_id: 'S' + i, ph: 7 + (i % 5) * 0.05 })); recs[7].ph = 11;
  const o = A.detectOutliers(recs, { z: 3.5 }); assert.ok(o.map.S7 && o.map.S7.contributors[0].key === 'ph');
  assert.ok(A.detectOutliers(recs, { withinLocation: true }).map.S7);
  assert.strictEqual(A.detectOutliers(recs.slice(0, 5), {}).list.length, 0);
  const flat = []; for (let i = 0; i < 10; i++) flat.push(good({ sample_id: 'F' + i })); flat[3].ph = 9; assert.ok(A.detectOutliers(flat, {}).map.F3); // MAD = 0 fallback
});
test('trend slope, histogram and weekly counts', () => {
  const recs = [0, 1, 2, 3, 4, 5].map(i => good({ sample_id: 'D' + i, sample_date: '2026-09-0' + (i + 1), ph: 7 + i * 0.1 }));
  assert.ok(Math.abs(A.trendSlope(recs, 'ph') - 3) < 1e-6); assert.strictEqual(A.trendSlope(recs.slice(0, 3), 'ph'), null);
  const h = A.histogram([1, 2, 2, 3, 9], 4); assert.strictEqual(h.counts.reduce((a, b) => a + b, 0), 5);
  const w = A.countsByWeek(DEMO); assert.strictEqual(w.counts.reduce((a, b) => a + b, 0), DEMO.length);
});

/* ---------- storage ---------- */
test('first launch preloads the demo dataset and it persists across reloads', () => {
  const st = fakeStorage(), a1 = load(st); const info = a1.Store.init(); assert.ok(info.firstRun); assert.strictEqual(a1.Store.all().length, 120);
  const a2 = load(st); assert.ok(!a2.Store.init().firstRun); assert.strictEqual(a2.Store.all().length, 120);
});
test('add / update / delete user records persist; duplicates rejected', () => {
  const st = fakeStorage(), a = load(st); a.Store.init();
  assert.ok(a.Store.add(good({ sample_id: 'U-1' }), 'user').ok); assert.ok(!a.Store.add(good({ sample_id: 'U-1' }), 'user').ok); assert.ok(!a.Store.add(good({ sample_id: 'DEMO-001' }), 'user').ok);
  assert.ok(a.Store.update('U-1', Object.assign(good({ sample_id: 'U-1' }), { ph: 8 })).ok);
  const b = load(st); b.Store.init(); assert.strictEqual(b.Store.get('U-1').ph, 8); assert.strictEqual(b.Store.all().length, 121);
  assert.ok(b.Store.remove('U-1').ok); assert.ok(!b.Store.remove('U-1').ok); assert.strictEqual(load(st).Store.init() && 0, 0);
  const c = load(st); c.Store.init(); assert.strictEqual(c.Store.all().length, 120);
});
test('demo records are read-only', () => { const a = load(); a.Store.init(); assert.ok(!a.Store.update('DEMO-001', good({ sample_id: 'DEMO-001' })).ok); assert.ok(!a.Store.remove('DEMO-001').ok); });
test('reset demo restores tampered demo data and keeps user records', () => {
  const st = fakeStorage(), a = load(st); a.Store.init(); a.Store.add(good({ sample_id: 'U-9' }), 'user');
  const raw = JSON.parse(st._m['aquaguard.v1.records']); raw.records[0].ph = 99; raw.records.splice(5, 3); st._m['aquaguard.v1.records'] = JSON.stringify(raw);
  const b = load(st); b.Store.init(); assert.strictEqual(b.Store.all().length, 118); assert.strictEqual(b.Store.resetDemo(), 120);
  assert.strictEqual(b.Store.all().length, 121); assert.notStrictEqual(b.Store.get('DEMO-001').ph, 99); assert.ok(b.Store.get('U-9'));
});
test('remove demo data / delete my records', () => {
  const a = load(); a.Store.init(); a.Store.add(good({ sample_id: 'U-2' }), 'user'); assert.strictEqual(a.Store.removeDemo(), 120); assert.strictEqual(a.Store.all().length, 1);
  a.Store.resetDemo(); assert.strictEqual(a.Store.clearUser(), 1); assert.strictEqual(a.Store.all().length, 120);
});
test('removed demo data is not silently re-seeded on reload', () => { const st = fakeStorage(), a = load(st); a.Store.init(); a.Store.removeDemo(); const b = load(st); b.Store.init(); assert.strictEqual(b.Store.all().length, 0); });
test('corrupt storage falls back to demo data', () => { const b = load(fakeStorage({ 'aquaguard.v1.records': '{not json' })); assert.ok(b.Store.init().firstRun); assert.strictEqual(b.Store.all().length, 120); });
test('blocked localStorage falls back to memory and reports non-persistent', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, a = load(blocked); const i = a.Store.init();
  assert.strictEqual(a.Store.all().length, 120); assert.strictEqual(a.Store.isPersistent(), false); assert.ok(i.firstRun);
});

/* ---------- reports / export ---------- */
test('CSV cells are quoted and formula-injection is neutralised', () => {
  assert.strictEqual(R.csvCell('a,b'), '"a,b"'); assert.strictEqual(R.csvCell('say "hi"'), '"say ""hi"""'); assert.strictEqual(R.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.strictEqual(R.csvCell('+cmd'), "'+cmd"); assert.strictEqual(R.csvCell(-5), '-5'); assert.strictEqual(R.csvCell(null), '');
});
test('records CSV export round-trips through the importer', () => {
  const csv = R.recordsCSV(DEMO.slice(0, 40)), back = V.validateImport(csv, {}, { now: NOW });
  assert.strictEqual(back.rejected.length, 0); deq(JSON.parse(JSON.stringify(back.valid)), JSON.parse(JSON.stringify(DEMO.slice(0, 40))));
});
test('template CSV is itself a valid import', () => { const r = V.validateImport(R.templateCSV(), {}, { now: NOW }); assert.strictEqual(r.rejected.length, 0); assert.strictEqual(r.valid.length, 2); });
test('screening CSV and findings rows reflect the results', () => {
  const recs = DEMO.slice(0, 30), res = A.screenAll(recs, PROF), fr = R.findingsRows(recs, res);
  assert.strictEqual(fr.length, recs.reduce((n, r) => n + res[r.sample_id].findings.length, 0)); assert.strictEqual(R.screeningCSV(recs, res).trim().split('\n').length, 31);
});
test('HTML report reflects selection, filters, profile; escapes content; has required sections', () => {
  const recs = A.applyFilters(DEMO, { locations: ['Site B'] }).concat([good({ sample_id: 'X-1', location: '<img src=x onerror=alert(1)>', ph: 9.9 })]);
  const prof = AQ.REFERENCES.profiles.BIS_IS10500_permissible, res = A.screenAll(recs, prof);
  const html = R.buildHTML({ records: recs, results: res, profile: prof, profileId: 'BIS_IS10500_permissible', filters: { locations: ['Site B'], from: '2026-08-01' }, outliers: A.detectOutliers(recs, {}), demoPresent: true, generatedAt: new Date(2026, 9, 11) });
  assert.ok(!html.includes('<img src=x') && html.includes('&lt;img src=x'));
  ['Scientific disclaimer', 'does not establish drinking-water safety', 'BIS_IS10500_permissible', 'locations: Site B', 'from 2026-08-01', 'DEMO MODE', 'Flagged observations', 'Limitations', 'Recommended follow-up', 'Reference profile used', 'Data-quality checks', '31 samples', 'Analysis date: 2026-10-11', '<svg'].forEach(s => assert.ok(html.includes(s), 'missing: ' + s));
});
test('data-quality summary text lists rejected rows and reasons', () => {
  const r = V.validateImport(HEAD + 'A1,2026-09-01,S,tap,7.1,0.4,200,25\nA2,bad,S,tap,7.1,0.4,200,25\n', {}, { now: NOW }), t = R.qualityText(r, 'x.csv');
  assert.ok(/Rows read: 2/.test(t) && /Rejected rows: 1/.test(t) && /row 3:/.test(t));
});

/* ---------- charts ---------- */
test('charts return SVG, show empty states, and escape labels', () => {
  assert.ok(C.line({ series: [{ name: 'A<b>', points: [[1e12, 1, 't'], [1e12 + 864e5, 2, 't']] }] }).startsWith('<svg')); assert.ok(!C.line({ series: [{ name: 'A<b>', points: [[1e12, 1, 't']] }] }).includes('A<b>'));
  assert.ok(C.line({ series: [] }).includes('chart-empty')); assert.ok(C.bar({ cats: [], series: [] }).includes('chart-empty')); assert.ok(C.donut({ slices: [{ label: 'a', value: 0, color: '#000' }] }).includes('chart-empty'));
  assert.ok(C.hist({ edges: [0, 1], counts: [3] }).startsWith('<svg')); assert.ok(C.box({ groups: [{ name: 'A', s: { n: 2, min: 1, q1: 1, med: 2, q3: 3, max: 3 } }] }).startsWith('<svg'));
});

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${results.length} total)`);
const rp = path.join(__dirname, 'results.json'); let prev = {}; try { prev = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch (e) { /* none */ }
prev.unit = { total: results.length, passed: results.length - failed.length, failed: failed.length, ran: new Date().toISOString(), node: process.version };
fs.writeFileSync(rp, JSON.stringify(prev, null, 2));
process.exit(failed.length ? 1 : 0);
