/* Checks that every asset referenced by index.html exists and that all JS files have valid syntax. Run: node tests/check-assets.js */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|mailto:)/.test(u));
const problems = [];
refs.forEach(r => { if (!fs.existsSync(path.join(ROOT, r))) problems.push('missing asset: ' + r); });
if (/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/xmlns="[^"]+"/g, ''))) problems.push('index.html references an external URL');
fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => { const r = cp.spawnSync(process.execPath, ['--check', path.join(ROOT, 'js', f)]); if (r.status !== 0) problems.push('syntax error in js/' + f + ': ' + r.stderr); });
['css/styles.css', 'assets/logo.svg', 'data/demo-water-quality.csv', 'config/water-quality-references.json'].forEach(f => { if (!fs.existsSync(path.join(ROOT, f))) problems.push('missing ' + f); });
JSON.parse(fs.readFileSync(path.join(ROOT, 'config/water-quality-references.json'), 'utf8'));
const rp = path.join(__dirname, 'results.json'); let prev = {}; try { prev = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch (e) { /* none */ }
prev.assets = { referenced: refs, jsFiles: fs.readdirSync(path.join(ROOT, 'js')).length, problems, ok: !problems.length }; fs.writeFileSync(rp, JSON.stringify(prev, null, 2));
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : `OK: ${refs.length} referenced assets exist, all JS files have valid syntax, no external URLs`); process.exit(problems.length ? 1 : 0);
