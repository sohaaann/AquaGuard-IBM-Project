/* AquaGuard AI - persistence in browser localStorage (key prefix 'aquaguard.v1.').
   Demo rows have origin 'demo' and are read-only; user rows (manual or CSV import) have origin 'user'.
   If localStorage is blocked (some privacy modes) the app falls back to memory and warns the user. */
(function () {
  'use strict';
  var AQ = (window.AQ = window.AQ || {});
  var KEY = 'aquaguard.v1.records', SKEY = 'aquaguard.v1.settings';
  var records = [], settings = {}, persistent = true;

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function lsGet(k) { try { var s = ls(); return s ? s.getItem(k) : null; } catch (e) { persistent = false; return null; } }
  function lsSet(k, v) { try { var s = ls(); if (!s) { persistent = false; return false; } s.setItem(k, v); return true; } catch (e) { persistent = false; return false; } }

  function demoRecords() {
    return AQ.DEMO_ROWS.map(function (r) { var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; }); c.origin = 'demo'; return c; });
  }
  function save() { return lsSet(KEY, JSON.stringify({ version: 1, records: records })); }
  function saveSettings() { return lsSet(SKEY, JSON.stringify(settings)); }

  function init() {
    var raw = lsGet(KEY), loaded = false;
    if (raw) {
      try { var p = JSON.parse(raw); if (p && Array.isArray(p.records)) { records = p.records; loaded = true; } } catch (e) { loaded = false; }
    }
    if (!loaded) { records = demoRecords(); save(); }   // first launch (or unreadable data): preload the synthetic demo
    try { settings = JSON.parse(lsGet(SKEY) || '{}') || {}; } catch (e) { settings = {}; }
    return { firstRun: !loaded, persistent: persistent };
  }

  function all() { return records.slice(); }
  function get(id) { for (var i = 0; i < records.length; i++) if (records[i].sample_id === id) return records[i]; return null; }
  function idSet() { var o = {}; records.forEach(function (r) { o[r.sample_id] = true; }); return o; }

  function add(rec, origin) {
    if (get(rec.sample_id)) return { ok: false, error: "Sample ID '" + rec.sample_id + "' already exists" };
    var c = {}; Object.keys(rec).forEach(function (k) { c[k] = rec[k]; });
    c.origin = origin || 'user'; c.created_at = new Date().toISOString();
    records.push(c); save(); return { ok: true };
  }
  function importMany(list) {
    var ids = idSet(), n = 0;
    list.forEach(function (rec) {
      if (ids[rec.sample_id]) return;
      var c = {}; Object.keys(rec).forEach(function (k) { c[k] = rec[k]; });
      c.origin = 'user'; c.created_at = new Date().toISOString(); records.push(c); ids[c.sample_id] = true; n++;
    });
    save(); return n;
  }
  function update(oldId, rec) {
    var cur = get(oldId);
    if (!cur) return { ok: false, error: 'Record not found' };
    if (cur.origin === 'demo') return { ok: false, error: 'Demo records are read-only. Use Reset Demo to restore them.' };
    if (rec.sample_id !== oldId && get(rec.sample_id)) return { ok: false, error: "Sample ID '" + rec.sample_id + "' already exists" };
    Object.keys(rec).forEach(function (k) { cur[k] = rec[k]; });
    cur.updated_at = new Date().toISOString(); save(); return { ok: true };
  }
  function remove(id) {
    var cur = get(id);
    if (!cur) return { ok: false, error: 'Record not found' };
    if (cur.origin === 'demo') return { ok: false, error: 'Demo records cannot be deleted individually. Use Remove demo data.' };
    records = records.filter(function (r) { return r.sample_id !== id; }); save(); return { ok: true };
  }
  /* Restore the original synthetic dataset. User records are kept (unless an ID collides with a demo ID, which is removed). */
  function resetDemo() {
    var demo = demoRecords(), dids = {};
    demo.forEach(function (r) { dids[r.sample_id] = true; });
    records = records.filter(function (r) { return r.origin !== 'demo' && !dids[r.sample_id]; }).concat(demo);
    save(); return demo.length;
  }
  function removeDemo() { var n = records.length; records = records.filter(function (r) { return r.origin !== 'demo'; }); save(); return n - records.length; }
  function clearUser() { var n = records.length; records = records.filter(function (r) { return r.origin === 'demo'; }); save(); return n - records.length; }

  function getSetting(k, d) { return settings[k] === undefined ? d : settings[k]; }
  function setSetting(k, v) { settings[k] = v; saveSettings(); }

  AQ.Store = { init: init, all: all, get: get, idSet: idSet, add: add, importMany: importMany, update: update, remove: remove,
    resetDemo: resetDemo, removeDemo: removeDemo, clearUser: clearUser, getSetting: getSetting, setSetting: setSetting,
    isPersistent: function () { return persistent; } };
})();
