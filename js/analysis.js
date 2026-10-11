/* AquaGuard AI - transparent rule-based screening, descriptive statistics and robust-statistics outlier detection.
   The tool never states that water is "safe" or "unsafe". Statuses: within | flagged | insufficient | invalid. */
(function () {
  'use strict';
  var AQ = (window.AQ = window.AQ || {});
  var V = function () { return AQ.Validation; };

  var STATUS = {
    within: { label: 'Within configured range', long: 'No configured threshold exceedances detected in the available measurements.' },
    flagged: { label: 'Flagged for review', long: 'Further investigation is recommended.' },
    insufficient: { label: 'Insufficient data', long: 'Insufficient measurements for a meaningful assessment.' },
    invalid: { label: 'Invalid record', long: 'The record could not be validated.' }
  };
  var NO_SAFETY = 'This result does not establish drinking-water safety.';
  var DISCLAIMER = 'AquaGuard AI is an educational, preliminary screening tool. It does not certify water as safe or unsafe. pH, turbidity and TDS alone cannot establish drinking-water safety, and microbial contamination, toxic chemicals and sampling errors cannot be detected from these measurements. Use accredited laboratory testing and official public-health advice.';

  function fmtRange(spec) {
    if (spec.min !== undefined && spec.max !== undefined) return spec.min + ' to ' + spec.max + ' ' + spec.unit;
    if (spec.max !== undefined) return 'at most ' + spec.max + ' ' + spec.unit;
    return 'at least ' + spec.min + ' ' + spec.unit;
  }
  function explain(label, value, unit, dir, ref, ctype) {
    var base = label + ' was ' + value + ' ' + unit + ', ' + dir + ' the configured screening range (' + ref + ').';
    if (ctype === 'aesthetic_or_operational') return base + ' This criterion relates to acceptability or treatment operation, so an exceedance is a prompt for investigation, not a health finding by itself.';
    if (ctype === 'environmental_indicator') return base + ' This is a surface-water environmental indicator, not a drinking-water guideline.';
    return base + ' Further investigation is recommended.';
  }
  var NEXT = 'Repeat the measurement with a calibrated instrument, check sampling and storage, and consider accredited laboratory testing, including microbiological tests where the water is used for drinking.';

  /* Screen one record against a profile object (AQ.REFERENCES.profiles[id]). Limits are inclusive. */
  function screenRecord(rec, profile, minParams) {
    minParams = minParams == null ? AQ.SETTINGS.minParametersForScreening : minParams;
    var chk = V().validateRecord(rec, { futureTolerance: 36500 });
    if (chk.errors.length) return { id: rec.sample_id, status: 'invalid', findings: [], evaluated: [], errors: chk.errors, needed: [], message: STATUS.invalid.label + ': ' + chk.errors.join('; ') };
    var findings = [], evaluated = [], needed = [];
    var src = profile.standard + ' (' + profile.edition + ')';
    Object.keys(profile.parameters).forEach(function (k) {
      var spec = profile.parameters[k], v = chk.clean[k], P = V().PARAMS[k];
      if (v === null || v === undefined) { needed.push(P.label + ' (used by this profile, not provided)'); return; }
      evaluated.push(k);
      var below = spec.min !== undefined && v < spec.min, above = spec.max !== undefined && v > spec.max;
      if (below || above) {
        var dir = below ? 'below' : 'above', ref = fmtRange(spec);
        findings.push({ key: k, label: P.label, value: v, unit: spec.unit, reference: ref, direction: dir, source: src, sourceUrl: profile.source_url,
          criterionType: spec.criterion_type, verification: spec.verification_status, explanation: explain(P.label, v, spec.unit, dir, ref, spec.criterion_type), nextStep: NEXT });
      }
    });
    needed.push('Microbiological results and chemical contaminant tests are not covered by this screening.');
    var res = { id: rec.sample_id, findings: findings, evaluated: evaluated, errors: [], needed: needed };
    if (evaluated.length < minParams) {
      res.status = 'insufficient';
      res.message = STATUS.insufficient.long + ' (only ' + evaluated.length + ' of ' + Object.keys(profile.parameters).length + ' profile parameters available; minimum ' + minParams + '). ' + NO_SAFETY;
    } else if (findings.length) {
      res.status = 'flagged';
      res.message = STATUS.flagged.label + ': ' + findings.length + ' measurement(s) outside configured ranges. ' + STATUS.flagged.long + ' ' + NO_SAFETY;
    } else {
      res.status = 'within';
      res.message = STATUS.within.long + ' ' + NO_SAFETY;
    }
    return res;
  }

  function screenAll(records, profile) {
    var map = {};
    records.forEach(function (r) { map[r.sample_id] = screenRecord(r, profile); });
    return map;
  }

  function countStatuses(records, results) {
    var c = { within: 0, flagged: 0, insufficient: 0, invalid: 0 };
    records.forEach(function (r) { var s = results[r.sample_id]; if (s) c[s.status]++; });
    return c;
  }

  function metrics(records, results) {
    var locs = {}, latest = null, params = 0;
    records.forEach(function (r) { locs[r.location] = true; if (!latest || r.sample_date > latest) latest = r.sample_date; });
    V().PARAM_KEYS.forEach(function (k) { if (records.some(function (r) { return r[k] !== null && r[k] !== undefined; })) params++; });
    var c = countStatuses(records, results);
    return { total: records.length, locations: Object.keys(locs).length, flagged: c.flagged, latest: latest, parametersMonitored: params, statuses: c };
  }

  function values(records, key) { var a = []; records.forEach(function (r) { var v = r[key]; if (v !== null && v !== undefined && !isNaN(v)) a.push(+v); }); return a; }
  function sortNum(a) { return a.slice().sort(function (x, y) { return x - y; }); }
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function median(a) { return quantile(sortNum(a), 0.5); }
  function mean(a) { if (!a.length) return NaN; var s = 0; a.forEach(function (x) { s += x; }); return s / a.length; }

  function paramSummary(records) {
    return V().PARAM_KEYS.map(function (k) {
      var v = values(records, k), s = sortNum(v), P = V().PARAMS[k];
      return { key: k, label: P.label, unit: P.unit, n: v.length, missing: records.length - v.length,
        min: s.length ? s[0] : null, median: s.length ? quantile(s, .5) : null, mean: s.length ? mean(v) : null, max: s.length ? s[s.length - 1] : null };
    });
  }

  function stats5(v) {
    var s = sortNum(v);
    return s.length ? { n: s.length, min: s[0], q1: quantile(s, .25), med: quantile(s, .5), q3: quantile(s, .75), max: s[s.length - 1], mean: mean(v) } : { n: 0 };
  }

  function histogram(v, bins) {
    if (!v.length) return { edges: [], counts: [] };
    var s = sortNum(v), lo = s[0], hi = s[s.length - 1];
    if (lo === hi) { return { edges: [lo - 0.5, hi + 0.5], counts: [v.length] }; }
    bins = bins || Math.min(20, Math.max(5, Math.ceil(Math.sqrt(v.length))));
    var w = (hi - lo) / bins, edges = [], counts = [];
    for (var i = 0; i <= bins; i++) edges.push(lo + w * i);
    for (var j = 0; j < bins; j++) counts.push(0);
    v.forEach(function (x) { var b = Math.min(bins - 1, Math.floor((x - lo) / w)); counts[b]++; });
    return { edges: edges, counts: counts };
  }

  /* ISO week-ish bucket: Monday of the week as YYYY-MM-DD. */
  function weekStart(iso) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return V().todayISO(d);
  }
  function countsByWeek(records) {
    var m = {};
    records.forEach(function (r) { var w = weekStart(r.sample_date); m[w] = (m[w] || 0) + 1; });
    var keys = Object.keys(m).sort();
    return { weeks: keys, counts: keys.map(function (k) { return m[k]; }) };
  }

  /* Robust outlier detection: robust z = 0.6745*(x-median)/MAD, computed per parameter (optionally within each location).
     MAD==0 falls back to 1.2533*mean absolute deviation; if that is also 0 the parameter is skipped.
     Descriptive only: an unusual value is not necessarily contaminated or unsafe. */
  function detectOutliers(records, opts) {
    opts = opts || {};
    var zCut = opts.z || AQ.SETTINGS.outlierZ, minN = opts.minN || AQ.SETTINGS.outlierMinSamples, within = !!opts.withinLocation;
    var groups = {};
    records.forEach(function (r) { var g = within ? r.location : '*'; (groups[g] = groups[g] || []).push(r); });
    var out = {}, skipped = [];
    Object.keys(groups).forEach(function (g) {
      var recs = groups[g];
      V().PARAM_KEYS.forEach(function (k) {
        var v = values(recs, k);
        if (v.length < minN) { if (v.length) skipped.push((within ? g + ': ' : '') + V().PARAMS[k].label + ' (n=' + v.length + ')'); return; }
        var med = median(v), dev = v.map(function (x) { return Math.abs(x - med); }), mad = median(dev), scale;
        if (mad > 0) scale = 0.6745 / mad; else { var mad2 = mean(dev) * 1.2533; if (!(mad2 > 0)) return; scale = 0.6745 / mad2; }
        recs.forEach(function (r) {
          var x = r[k]; if (x === null || x === undefined) return;
          var z = scale * (x - med);
          if (Math.abs(z) >= zCut) {
            var o = out[r.sample_id] = out[r.sample_id] || { id: r.sample_id, contributors: [] };
            o.contributors.push({ key: k, label: V().PARAMS[k].label, value: x, unit: V().PARAMS[k].unit, median: med, z: z });
          }
        });
      });
    });
    var list = Object.keys(out).map(function (id) {
      var o = out[id]; o.contributors.sort(function (a, b) { return Math.abs(b.z) - Math.abs(a.z); });
      o.maxZ = Math.abs(o.contributors[0].z); return o;
    }).sort(function (a, b) { return b.maxZ - a.maxZ; });
    return { list: list, map: out, skipped: skipped, z: zCut, within: within };
  }

  /* Least-squares slope (units per 30 days) for dated values; needs >= 5 points on >= 2 dates. */
  function trendSlope(records, key) {
    var pts = [];
    records.forEach(function (r) { if (r[key] !== null && r[key] !== undefined) pts.push([Date.parse(r.sample_date + 'T00:00:00') / 86400000, +r[key]]); });
    var dates = {}; pts.forEach(function (p) { dates[p[0]] = 1; });
    if (pts.length < 5 || Object.keys(dates).length < 2) return null;
    var mx = mean(pts.map(function (p) { return p[0]; })), my = mean(pts.map(function (p) { return p[1]; })), sxy = 0, sxx = 0;
    pts.forEach(function (p) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); });
    return sxx ? (sxy / sxx) * 30 : null;
  }

  /* Filters: {from, to, locations:[] (empty = all), search, source} */
  function applyFilters(records, f) {
    f = f || {};
    var q = (f.search || '').trim().toLowerCase();
    var locs = f.locations && f.locations.length ? f.locations : null;
    return records.filter(function (r) {
      if (f.from && r.sample_date < f.from) return false;
      if (f.to && r.sample_date > f.to) return false;
      if (locs && locs.indexOf(r.location) < 0) return false;
      if (q && (r.sample_id + ' ' + r.location + ' ' + r.source_type + ' ' + r.sample_date).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  AQ.Analysis = { STATUS: STATUS, NO_SAFETY: NO_SAFETY, DISCLAIMER: DISCLAIMER, screenRecord: screenRecord, screenAll: screenAll, countStatuses: countStatuses,
    metrics: metrics, values: values, quantile: quantile, median: median, mean: mean, paramSummary: paramSummary, stats5: stats5, histogram: histogram,
    countsByWeek: countsByWeek, detectOutliers: detectOutliers, trendSlope: trendSlope, applyFilters: applyFilters, fmtRange: fmtRange };
})();
