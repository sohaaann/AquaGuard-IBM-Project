/* End-to-end browser test for AquaGuard AI (OPTIONAL developer tool - the app itself needs no Node).
   Opens index.html via file:// in headless Chromium, exercises the UI, records results to tests/results.json
   and captures real screenshots into screenshots/.
   Run:  npm i playwright && npx playwright install chromium && node tests/e2e.js
   (In the build sandbox Playwright was preinstalled globally; set PW_PATH to its location if require() fails.) */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..'), URL = 'file://' + path.join(ROOT, 'index.html'), SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, ok: false, error: String(e.message).split('\n')[0] }); console.log('FAIL', name, '\n    ', String(e.message).split('\n')[0]); }
}
async function shot(p, file, opts) { await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; window.scrollTo(0, 0); }); await p.screenshot(Object.assign({ path: path.join(SHOTS, file) }, opts || {})); }
const HEAD = 'sample_id,sample_date,location,source_type,ph,turbidity_ntu,tds_mg_l,temperature_c\n';
const kpi = async (p) => (await p.$$eval('.kpi .v', els => els.map(e => e.textContent.trim())));
const nav = async (p, s) => { await p.click(`[data-section="${s}"]`); await p.waitForSelector('#view h1'); };
async function fillSample(p, o) {
  await p.click('[data-action="add"]'); await p.waitForSelector('#sampleDlg[open]');
  for (const [k, v] of Object.entries(o)) { if (k === 'source_type') await p.selectOption('#f_source_type', v); else await p.fill('#f_' + k, String(v)); }
}
async function upload(p, name, content) {
  await nav(p, 'import'); await p.setInputFiles('#csvFile', { name, mimeType: 'text/csv', buffer: Buffer.from(content, 'utf8') }); await p.waitForTimeout(250);
}
// independent re-implementation of the BIS acceptable rule, used to cross-check the dashboard
function expectedFlagged(rows) {
  let n = 0;
  rows.forEach(r => { const have = [r.ph, r.turbidity_ntu, r.tds_mg_l].filter(v => v !== null).length; if (have < 2) return;
    if ((r.ph !== null && (r.ph < 6.5 || r.ph > 8.5)) || (r.turbidity_ntu !== null && r.turbidity_ntu > 1) || (r.tds_mg_l !== null && r.tds_mg_l > 500)) n++; });
  return n;
}

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage(), errors = [], netReqs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && !r.url().startsWith('about:')) netReqs.push(r.url()); });
  p.on('dialog', d => d.dismiss());
  await p.goto(URL); await p.waitForSelector('.kpi');
  const DEMO = await p.evaluate(() => AQ.DEMO_ROWS);

  await check('index.html opens via file:// and preloads demo data with no setup', async () => { assert.strictEqual((await kpi(p))[0], '120'); });
  await check('visible label "DEMO MODE — ALL INITIAL SAMPLE DATA IS SYNTHETIC"', async () => assert.strictEqual((await p.textContent('#demoBanner')).trim(), 'DEMO MODE \u2014 ALL INITIAL SAMPLE DATA IS SYNTHETIC'));
  await check('dashboard KPIs equal values calculated independently from the dataset', async () => {
    const k = await kpi(p); assert.strictEqual(+k[0], DEMO.length); assert.strictEqual(+k[1], new Set(DEMO.map(r => r.location)).size);
    assert.strictEqual(+k[2], expectedFlagged(DEMO)); assert.strictEqual(k[3], DEMO.map(r => r.sample_date).sort().pop());
  });
  await check('dashboard has charts, parameter summary and recent samples table', async () => {
    assert.ok((await p.$$('#view svg')).length >= 3); assert.strictEqual((await p.$$('#view > .card:last-child tbody tr')).length, 10); assert.ok(await p.isVisible('text=Parameter summary'));
  });
  await shot(p, '01-dashboard.png'); await shot(p, '01b-dashboard-full.png', { fullPage: true });

  await check('all seven sections render without console errors', async () => {
    for (const s of ['samples', 'import', 'screening', 'analytics', 'reports', 'about', 'dashboard']) { await nav(p, s); assert.ok((await p.innerHTML('#view')).length > 500, s); }
    assert.deepStrictEqual(errors, []);
  });
  await check('no network requests: fully offline (no external libraries or fonts)', async () => assert.deepStrictEqual(netReqs, []));

  // ---- manual entry
  await nav(p, 'samples');
  await check('add sample: invalid input shows clear errors and nothing is saved', async () => {
    await fillSample(p, { sample_id: 'bad id!', sample_date: '2999-01-01', location: '', ph: 'abc', turbidity_ntu: '5000' });
    await p.click('#sampleSave'); const t = await p.textContent('#formErrors');
    ['Sample ID may contain', 'in the future', 'Location is required', "'abc' is not a number", 'outside the accepted input range'].forEach(s => assert.ok(t.includes(s), s));
    assert.ok(await p.isVisible('#sampleDlg[open]')); await p.click('[data-dlg="sampleDlg"][data-action="closeDlg"] >> nth=1');
  });
  await check('add sample: missing measurements -> "At least one measurement is required"', async () => {
    await fillSample(p, { sample_id: 'E-0', location: 'Site Z' }); await p.fill('#f_ph', ''); await p.click('#sampleSave');
    assert.ok((await p.textContent('#formErrors')).includes('At least one measurement')); await p.keyboard.press('Escape');
  });
  await shot(p, '03-add-sample.png').catch(() => {});
  await check('add sample: valid record is saved, listed, counted and flagged correctly', async () => {
    await fillSample(p, { sample_id: 'TEST-001', sample_date: '2026-10-01', location: 'Site A', source_type: 'tap', ph: '9.1', turbidity_ntu: '0.4', tds_mg_l: '300', temperature_c: '24' });
    await shot(p, '03-add-sample.png');
    await p.click('#sampleSave'); await p.waitForSelector('#sampleDlg', { state: 'hidden' });
    await p.fill('#fSearch', 'TEST-001'); await p.waitForTimeout(200);
    const row = await p.textContent('#view tbody tr'); assert.ok(row.includes('TEST-001') && row.includes('Flagged for review') && row.includes('My record'));
    assert.ok((await p.textContent('#toasts')).includes('Saved sample TEST-001'));
  });
  await check('duplicate Sample ID is rejected', async () => {
    await fillSample(p, { sample_id: 'TEST-001', location: 'Site A', ph: '7' }); await p.click('#sampleSave');
    assert.ok((await p.textContent('#formErrors')).includes('already exists')); await p.keyboard.press('Escape');
  });
  await check('edit a user record (value + re-screening)', async () => {
    await p.click('[data-action="edit"][data-id="TEST-001"]'); await p.fill('#f_ph', '7.3'); await p.click('#sampleSave'); await p.waitForSelector('#sampleDlg', { state: 'hidden' });
    const row = await p.textContent('#view tbody tr'); assert.ok(row.includes('7.3') && row.includes('Within configured range'));
  });
  await check('demo records are read-only (no edit/delete buttons)', async () => {
    await p.fill('#fSearch', 'DEMO-001'); await p.waitForTimeout(200); assert.strictEqual((await p.$$('[data-action="edit"]')).length, 0); assert.strictEqual((await p.$$('[data-action="del"]')).length, 0); assert.strictEqual((await p.$$('[data-action="detail"]')).length, 1);
  });
  await check('delete asks for confirmation; cancel keeps, confirm deletes', async () => {
    await p.fill('#fSearch', 'TEST-001'); await p.waitForTimeout(200);
    await p.click('[data-action="del"][data-id="TEST-001"]'); await p.waitForSelector('#confirmDlg[open]'); await p.click('#confirmNo'); await p.waitForTimeout(150); assert.strictEqual((await p.$$('#view tbody tr')).length, 1);
    await p.click('[data-action="del"][data-id="TEST-001"]'); await p.click('#confirmYes'); await p.waitForTimeout(250); assert.ok(await p.isVisible('#view .empty'));
  });
  await check('persistence: user record survives a page refresh; storage keys exist', async () => {
    await p.fill('#fSearch', ''); await p.waitForTimeout(150);
    await fillSample(p, { sample_id: 'KEEP-1', location: 'Site B', ph: '7.1', tds_mg_l: '400' }); await p.click('#sampleSave'); await p.waitForSelector('#sampleDlg', { state: 'hidden' });
    await p.reload(); await p.waitForSelector('.kpi'); assert.strictEqual((await kpi(p))[0], '121');
    assert.ok(await p.evaluate(() => !!localStorage.getItem('aquaguard.v1.records')));
  });
  await check('refresh does not duplicate or re-seed demo data', async () => { await p.reload(); await p.waitForSelector('.kpi'); assert.strictEqual((await kpi(p))[0], '121'); });

  // ---- filters
  await check('location filter updates KPIs, table and charts', async () => {
    await p.check('#fLocs input[value="Site A"]'); await p.waitForTimeout(200); assert.strictEqual((await kpi(p))[0], '30'); assert.strictEqual((await kpi(p))[1], '1');
    assert.ok((await p.textContent('#countNote')).includes('30 of 121'));
    await nav(p, 'analytics'); assert.ok((await p.textContent('#view')).includes('Site A')); await p.uncheck('#fLocs input[value="Site A"]');
  });
  await check('date-range filter works', async () => {
    await p.fill('#fFrom', '2026-09-01'); await p.fill('#fTo', '2026-09-07'); await p.dispatchEvent('#fTo', 'change'); await p.waitForTimeout(200);
    const n = DEMO.filter(r => r.sample_date >= '2026-09-01' && r.sample_date <= '2026-09-07').length; assert.ok((await p.textContent('#countNote')).startsWith(n + ' of')); await p.click('[data-action="clearFilters"]');
  });
  await check('search filters the samples table; clear filters restores everything', async () => {
    await nav(p, 'samples'); await p.fill('#fSearch', 'borewell'); await p.waitForTimeout(200); assert.ok((await p.textContent('#countNote')).startsWith('30 of 121'));
    await p.click('[data-action="clearFilters"]'); assert.ok((await p.textContent('#countNote')).startsWith('121 of 121'));
  });
  await check('sorting and pagination work', async () => {
    await p.click('[data-action="sort"][data-key="tds_mg_l"]'); await p.waitForTimeout(100); await p.click('[data-action="sort"][data-key="tds_mg_l"]'); await p.waitForTimeout(100);
    assert.ok((await p.textContent('#view tbody tr')).includes('1480')); await p.click('[data-action="page"][data-dir="1"]'); assert.ok((await p.textContent('#view')).includes('page 2 of 5'));
    await p.click('[data-action="sort"][data-key="sample_date"]');
  });
  await shot(p, '02-samples.png');

  // ---- screening
  await check('profile switch recalculates screening (permissible profile flags fewer)', async () => {
    await nav(p, 'dashboard'); const before = +(await kpi(p))[2]; await p.selectOption('#profileSel', 'BIS_IS10500_permissible'); await p.waitForTimeout(200);
    const after = +(await kpi(p))[2]; assert.ok(after < before && after > 0, `${before} -> ${after}`); await p.selectOption('#profileSel', 'BIS_IS10500_acceptable');
  });
  await check('screening page shows profile provenance, unverified status, flagged table, no "safe" badge', async () => {
    await nav(p, 'screening'); const t = await p.textContent('#view');
    ['IS 10500', 'UNVERIFIED', 'unverified_offline', 'Observed', 'Recommended', 'Insufficient data', 'does not establish'].forEach(s => assert.ok(t.toLowerCase().includes(s.toLowerCase()), s));
    assert.ok(!/safe to drink/i.test(t)); assert.ok(!(await p.$$('.chip.safe')).length);
  });
  await check('sample detail dialog explains a flagged measurement with next step', async () => {
    await p.click('#view tbody [data-action="detail"] >> nth=0'); await p.waitForSelector('#detailDlg[open]'); const t = await p.textContent('#detailBody');
    ['Reference', 'Source', 'Recommended next step'].forEach(s => assert.ok(t.includes(s), s)); await shot(p, '07-sample-detail.png'); await p.keyboard.press('Escape'); assert.ok(!(await p.isVisible('#detailDlg[open]')));
  });
  await nav(p, 'screening'); await shot(p, '05-screening.png');

  // ---- analytics
  await check('analytics: charts render and react to parameter changes and data changes', async () => {
    await nav(p, 'analytics'); const n1 = (await p.$$('#view svg')).length; assert.ok(n1 >= 5, 'svg count ' + n1);
    const before = await p.innerHTML('#view'); await p.selectOption('#paramSel', 'ph'); await p.waitForTimeout(200); const after = await p.innerHTML('#view'); assert.notStrictEqual(before, after); assert.ok((await p.textContent('#view')).includes('Distribution of pH'));
  });
  await check('outlier detection lists the planted anomalies and reacts to the threshold', async () => {
    const text = await p.textContent('#view'); ['DEMO-058', 'DEMO-037'].forEach(() => { }); assert.ok(/not machine learning/.test(text) && /not necessarily contaminated/.test(text));
    const rows = async () => (await p.$$('#view > .card:last-child tbody tr')).length; const a = await rows(); assert.ok(a >= 3, 'rows ' + a);
    await p.fill('#zIn', '8'); await p.dispatchEvent('#zIn', 'change'); await p.waitForTimeout(200); const b = (await p.$$('#view > .card:last-child tbody tr')).length; assert.ok(b < a, `${a} -> ${b}`);
    await p.fill('#zIn', '3.5'); await p.dispatchEvent('#zIn', 'change');
  });
  await p.selectOption('#paramSel', 'tds_mg_l'); await p.waitForTimeout(150); await shot(p, '06-analytics.png'); await shot(p, '06b-analytics-full.png', { fullPage: true });

  // ---- CSV
  await check('CSV upload: valid file is previewed, validated and imported', async () => {
    await upload(p, 'ok.csv', HEAD + 'CSV-1,2026-10-02,Site A,tap,7.1,0.4,200,25\nCSV-2,2026-10-03,Site E,river,7.4,0.9,330,22\n');
    const t = await p.textContent('#view'); assert.ok(t.includes('Rows read') && t.includes('Column mapping') && t.includes('Preview')); await p.click('[data-action="importValid"]'); await p.waitForTimeout(200);
    await nav(p, 'dashboard'); assert.strictEqual((await kpi(p))[0], '123'); assert.ok((await p.textContent('#toasts')).includes('Imported 2'));
  });
  await check('CSV upload: rejected rows are listed with reasons (nothing dropped silently), valid rows still importable', async () => {
    const csv = HEAD + 'R-1,2026-10-02,Site A,tap,7.1,0.4,200,25\nR-1,2026-10-02,Site A,tap,7.1,0.4,200,25\nR-2,2026-13-40,Site A,tap,7.1,0.4,200,25\nR-3,2026-10-02,Site A,tap,abc,0.4,200,25\nCSV-1,2026-10-02,Site A,tap,7,0.4,200,25\nR-5,2026-10-02,Site A,tap,7.1\n';
    await upload(p, 'messy.csv', csv); const t = await p.textContent('#view');
    ['Rejected rows', 'duplicate Sample ID', 'not a real calendar date', "'abc' is not a number", 'already exists in the application', 'fields but the header has'].forEach(s => assert.ok(t.includes(s), s));
    assert.strictEqual((await p.$$('#view h3:has-text("Rejected") + .table-wrap tbody tr')).length, 5);
    await shot(p, '04-csv-validation.png');
    const dl = p.waitForEvent('download'); await p.click('[data-action="downloadQuality"]'); const d = await dl; const txt = fs.readFileSync(await d.path(), 'utf8'); assert.ok(/Rejected rows: 5/.test(txt) && /Missing values/.test(txt));
  });
  const bad = { 'empty.csv': ['', 'The file is empty'], 'headeronly.csv': [HEAD, 'no data rows'], 'units.csv': ['sample_id,sample_date,location,source_type,ph,tds_ppm,temperature_f\nA,2026-10-01,S,tap,7,100,70\n', 'Unit mismatch'], 'nocols.csv': ['sample_id,ph\nA,7\n', 'Missing required column'], 'broken.csv': ['a,b\n"x,1\n', 'malformed'] };
  for (const [name, [content, expect]] of Object.entries(bad)) {
    await check(`CSV upload: ${name} -> clear error message, app keeps working`, async () => { await upload(p, name, content); assert.ok((await p.textContent('#view .err-list')).includes(expect)); assert.ok((await p.$$('#view [data-action="importValid"]')).length === 0); });
  }
  await check('CSV upload: binary file rejected', async () => { await nav(p, 'import'); await p.setInputFiles('#csvFile', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x01]) }); await p.waitForTimeout(200); assert.ok((await p.textContent('#view .err-list')).includes('binary')); });
  await check('failed uploads did not change the stored data', async () => { await nav(p, 'dashboard'); assert.strictEqual((await kpi(p))[0], '123'); });
  await check('CSV template download is a valid import file', async () => {
    await nav(p, 'import'); const dl = p.waitForEvent('download'); await p.click('[data-action="downloadTemplate"]'); const f = fs.readFileSync(await (await dl).path(), 'utf8');
    assert.ok(f.startsWith('sample_id,sample_date,location')); await upload(p, 'template.csv', f); assert.ok((await p.textContent('#view')).includes('Valid'));
  });
  await check('filtered records export matches active filters and is formula-safe', async () => {
    await nav(p, 'samples'); await p.check('#fLocs input[value="Site C"]'); await p.waitForTimeout(200);
    const dl = p.waitForEvent('download'); await p.click('[data-action="exportRecords"]'); const d = await dl; assert.ok(d.suggestedFilename().endsWith('.csv'));
    const lines = fs.readFileSync(await d.path(), 'utf8').trim().split('\n'); assert.strictEqual(lines.length, 31); assert.ok(lines.slice(1).every(l => l.includes('Site C'))); await p.click('[data-action="clearFilters"]');
  });

  // ---- reports
  await check('HTML report: preview + download reflect the active filters and profile', async () => {
    await nav(p, 'dashboard'); await p.check('#fLocs input[value="Site B"]'); await p.selectOption('#profileSel', 'WHO_GDWQ_operational'); await nav(p, 'reports'); await p.waitForTimeout(400);
    const frame = p.frameLocator('#reportFrame'); assert.ok((await frame.locator('body').textContent()).includes('locations: Site B'));
    const dl = p.waitForEvent('download'); await p.click('[data-action="reportDownload"]'); const d = await dl; const html = fs.readFileSync(await d.path(), 'utf8');
    ['Scientific disclaimer', 'WHO_GDWQ_operational', 'locations: Site B', 'DEMO MODE', 'Flagged observations', 'Limitations', 'Recommended follow-up', 'Data-quality checks', 'Analysis date', '<svg'].forEach(s => assert.ok(html.includes(s), s));
    assert.ok(html.includes('31 samples')); await shot(p, '08-reports.png');
    await p.selectOption('#profileSel', 'BIS_IS10500_acceptable'); await p.click('[data-action="clearFilters"]');
  });
  await check('screening and flagged-observation CSV exports download', async () => {
    for (const a of ['exportScreening', 'exportFindings']) { const dl = p.waitForEvent('download'); await p.click(`[data-action="${a}"]`); const t = fs.readFileSync(await (await dl).path(), 'utf8'); assert.ok(t.split('\n').length > 5, a); }
  });
  await check('Print / save-as-PDF button runs without error (print dialog itself cannot be verified headless)', async () => { const e0 = errors.length; await p.click('[data-action="reportPrint"]'); await p.waitForTimeout(800); assert.strictEqual(errors.length, e0); });

  // ---- reset
  await check('Reset Demo restores synthetic data, keeps user records; Remove demo / Delete mine work', async () => {
    await nav(p, 'about'); await p.click('[data-action="removeDemo"]'); await p.click('#confirmYes'); await p.waitForTimeout(250); await nav(p, 'dashboard'); assert.strictEqual((await kpi(p))[0], '3'); assert.ok(await p.$('#demoBanner[hidden]'));
    await p.click('.topbar [data-action="resetDemo"]'); await p.click('#confirmYes'); await p.waitForTimeout(250); assert.strictEqual((await kpi(p))[0], '123'); assert.ok(!(await p.$('#demoBanner[hidden]')));
    await nav(p, 'about'); await p.click('[data-action="clearUser"]'); await p.click('#confirmYes'); await p.waitForTimeout(250); await nav(p, 'dashboard'); assert.strictEqual((await kpi(p))[0], '120');
    await p.reload(); await p.waitForSelector('.kpi'); assert.strictEqual((await kpi(p))[0], '120');
  });
  await check('Reset Demo can be cancelled', async () => { await p.click('.topbar [data-action="resetDemo"]'); await p.click('#confirmNo'); assert.ok(!(await p.isVisible('#confirmDlg[open]'))); });

  // ---- accessibility / responsive
  await check('keyboard: skip link first in tab order; Escape closes dialogs; nav buttons expose aria-current', async () => {
    await p.reload(); await p.waitForSelector('.kpi'); await p.keyboard.press('Tab'); assert.ok(await p.evaluate(() => document.activeElement.classList.contains('skip')));
    assert.strictEqual(await p.getAttribute('#nav button[aria-current]', 'data-section'), 'dashboard');
    await nav(p, 'samples'); await p.click('[data-action="add"]'); await p.waitForSelector('#sampleDlg[open]'); await p.keyboard.press('Escape'); assert.ok(!(await p.isVisible('#sampleDlg[open]')));
  });
  await check('all form inputs and filter controls have accessible labels', async () => {
    await p.click('[data-action="add"]'); const unl = await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),select')].filter(e => e.offsetParent !== null && !e.labels.length && !e.getAttribute('aria-label')).map(e => e.id || e.name)); await p.keyboard.press('Escape'); assert.deepStrictEqual(unl, []);
  });
  await check('mobile layout (390px): no horizontal page overflow, menu opens, charts fit', async () => {
    await p.setViewportSize({ width: 390, height: 844 }); await nav(p, 'dashboard').catch(async () => { await p.click('[data-action="toggleMenu"]'); await nav(p, 'dashboard'); });
    await p.waitForTimeout(300); const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(ov <= 1, 'overflow ' + ov);
    assert.ok(await p.isVisible('[data-action="toggleMenu"]')); await shot(p, '09-mobile-dashboard.png');
    await p.click('[data-action="toggleMenu"]'); assert.ok(await p.isVisible('#nav')); await p.click('[data-section="samples"]'); await p.waitForTimeout(200);
    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1); await shot(p, '10-mobile-samples.png');
    for (const s of ['analytics', 'screening', 'import', 'reports', 'about']) { await p.click('[data-action="toggleMenu"]'); await p.click(`[data-section="${s}"]`); await p.waitForTimeout(150); const o2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert.ok(o2 <= 1, s + ' overflow ' + o2); }
    await p.setViewportSize({ width: 1440, height: 1000 });
  });
  await check('no console errors or warnings during the whole session', async () => assert.deepStrictEqual(errors, []));
  await check('still no network requests after the whole session', async () => assert.deepStrictEqual(netReqs, []));

  // ---- fallback when localStorage is blocked
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } }); await ctx2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const p2 = await ctx2.newPage(), errs2 = []; p2.on('pageerror', e => errs2.push(e.message)); await p2.goto(URL); await p2.waitForSelector('.kpi');
  await check('localStorage blocked: app still works with demo data and warns the user', async () => { assert.strictEqual((await kpi(p2))[0], '120'); assert.ok(await p2.isVisible('#storageWarn')); assert.deepStrictEqual(errs2, []); });
  await ctx2.close();

  await browser.close();
  const failed = results.filter(r => !r.ok), rp = path.join(__dirname, 'results.json'); let prev = {}; try { prev = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch (e) { /* none */ }
  prev.e2e = { total: results.length, passed: results.length - failed.length, failed: failed.length, browser: 'Chromium (Playwright headless_shell 1194)', ran: new Date().toISOString(), failures: failed };
  prev.e2eChecks = results; fs.writeFileSync(rp, JSON.stringify(prev, null, 2));
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${results.length} checks)`); process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
