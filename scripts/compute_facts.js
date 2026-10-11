/* Dev tool: computes the figures quoted in the presentation by running the REAL app modules on the demo dataset.
   Usage: node scripts/compute_facts.js  -> writes presentation/facts.json */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, isFinite, isNaN, parseFloat, parseInt, setTimeout, RegExp, Error });
ctx.window = ctx; ctx.localStorage = { getItem: () => null, setItem() {} };
['data', 'validation', 'storage', 'analysis', 'charts', 'reports'].forEach(n => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', n + '.js'), 'utf8'), ctx));
const AQ = ctx.AQ, A = AQ.Analysis, V = AQ.Validation, rows = AQ.DEMO_ROWS, f = {};
f.total = rows.length; f.locations = [...new Set(rows.map(r => r.location))].sort();
const d = rows.map(r => r.sample_date).sort(); f.firstDate = d[0]; f.lastDate = d[d.length - 1];
f.profiles = {};
Object.keys(AQ.REFERENCES.profiles).forEach(id => { const res = A.screenAll(rows, AQ.REFERENCES.profiles[id]); f.profiles[id] = { label: AQ.REFERENCES.profiles[id].label, statuses: A.countStatuses(rows, res) }; });
const o = A.detectOutliers(rows, {}); f.outliers = o.list.length; f.outlierIds = o.list.map(x => x.id);
f.outliersWithin = A.detectOutliers(rows, { withinLocation: true }).list.length;
f.missing = V.missingSummary(rows).map(m => ({ label: m.label, count: m.count, pct: +m.pct.toFixed(1) }));
const bis = A.screenAll(rows, AQ.REFERENCES.profiles.BIS_IS10500_acceptable), fr = {};
rows.forEach(r => bis[r.sample_id].findings.forEach(x => { fr[x.label] = (fr[x.label] || 0) + 1; })); f.bisFindingsByParameter = fr;
fs.writeFileSync(path.join(ROOT, 'presentation', 'facts.json'), JSON.stringify(f, null, 2)); console.log(JSON.stringify(f, null, 1).slice(0, 900));
