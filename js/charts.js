/* AquaGuard AI - small dependency-free SVG chart library (returns SVG markup strings).
   Chosen instead of Chart.js because no library could be downloaded when this project was built and
   file:// use must work offline. The same functions feed the on-screen charts and the HTML report. */
(function () {
  'use strict';
  var AQ = (window.AQ = window.AQ || {});
  var PALETTE = ['#0b6e99', '#d95f02', '#6a51a3', '#1b7f5a', '#b8860b', '#a23b72'];
  var INK = '#0d2b3e', MUTED = '#4c6377', GRID = '#dbe6ee';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { if (n === null || n === undefined || isNaN(n)) return ''; var a = Math.abs(n); return a >= 1000 ? String(Math.round(n)) : a >= 100 ? String(+n.toFixed(0)) : a >= 10 ? String(+n.toFixed(1)) : String(+n.toFixed(2)); }

  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = (n * step) / span;
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (var v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function wrapSvg(w, h, inner, label) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif">' +
      '<title>' + esc(label) + '</title><rect width="' + w + '" height="' + h + '" fill="#ffffff"/>' + inner + '</svg>';
  }
  function legend(items, w, y) {
    var x = 52, s = '';
    items.forEach(function (it) {
      var tw = 22 + it.name.length * 6.4;
      if (x + tw > w - 8) { x = 52; y += 16; }
      s += '<rect x="' + x + '" y="' + (y - 9) + '" width="10" height="10" rx="2" fill="' + it.color + '"/><text x="' + (x + 14) + '" y="' + y + '" font-size="11" fill="' + INK + '">' + esc(it.name) + '</text>';
      x += tw;
    });
    return { svg: s, bottom: y };
  }
  function empty(msg) { return '<div class="chart-empty">' + esc(msg || 'No data to display for the current filters.') + '</div>'; }
  function axes(W, H, m, ymin, ymax, yticks, yLabel) {
    var s = '';
    yticks.forEach(function (t) {
      var y = m.t + (1 - (t - ymin) / (ymax - ymin)) * (H - m.t - m.b);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '"/><text x="' + (m.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="' + MUTED + '">' + fmt(t) + '</text>';
    });
    s += '<line x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="#7d93a3"/><line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '" stroke="#7d93a3"/>';
    if (yLabel) s += '<text transform="translate(13 ' + (m.t + (H - m.t - m.b) / 2) + ') rotate(-90)" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + esc(yLabel) + '</text>';
    return s;
  }

  /* opts: {series:[{name,color,points:[[ms,y,label]]}], yLabel, refs:[{y,label}], label, W, H} */
  function line(o) {
    var W = o.W || 640, H = o.H || 300, all = [];
    (o.series || []).forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) return empty();
    var items = o.series.map(function (s, i) { s.color = s.color || PALETTE[i % PALETTE.length]; return { name: s.name, color: s.color }; });
    var rows = 1, cx = 52;
    items.forEach(function (it) { var tw = 22 + it.name.length * 6.4; if (cx + tw > W - 8) { rows++; cx = 52; } cx += tw; });
    var legH = rows * 16 + 6, plotH = H, m = { l: 52, r: 14, t: 14, b: 30 + legH };
    H = plotH + legH;
    var lg = legend(items, W, H - legH + 20);
    var xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; });
    (o.refs || []).forEach(function (r) { ys.push(r.y); });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs); if (xmin === xmax) { xmin -= 86400000; xmax += 86400000; }
    var ticks = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 5), ymin = ticks[0], ymax = ticks[ticks.length - 1];
    var X = function (v) { return m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r); }, Y = function (v) { return m.t + (1 - (v - ymin) / (ymax - ymin)) * (H - m.t - m.b); };
    var s = axes(W, H, m, ymin, ymax, ticks, o.yLabel);
    for (var i = 0; i < 5; i++) {
      var xv = xmin + (xmax - xmin) * i / 4, d = new Date(xv);
      s += '<text x="' + X(xv) + '" y="' + (H - m.b + 15) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + d.toISOString().slice(5, 10) + '</text>';
    }
    (o.refs || []).forEach(function (r) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(r.y) + '" y2="' + Y(r.y) + '" stroke="#c75f00" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (W - m.r - 2) + '" y="' + (Y(r.y) - 4) + '" text-anchor="end" font-size="10.5" fill="#9a5200">' + esc(r.label) + '</text>';
    });
    o.series.forEach(function (ser) {
      var pts = ser.points.slice().sort(function (a, b) { return a[0] - b[0]; });
      s += '<polyline fill="none" stroke="' + ser.color + '" stroke-width="1.6" stroke-opacity=".75" points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
      pts.forEach(function (p) { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="3" fill="' + ser.color + '" data-tip="' + esc(p[2] || '') + '"><title>' + esc(p[2] || '') + '</title></circle>'; });
    });
    return wrapSvg(W, H, s + lg.svg, o.label || 'Line chart');
  }

  /* opts: {cats:[], series:[{name,color,values}], stacked, yLabel, label, W,H, rotate} */
  function bar(o) {
    var W = o.W || 640, H = o.H || 280, n = o.cats.length;
    if (!n || !o.series.some(function (s) { return s.values.some(function (v) { return v > 0; }); })) return empty();
    o.series.forEach(function (s, i) { s.color = s.color || PALETTE[i % PALETTE.length]; });
    var showLegend = o.series.length > 1, lg = showLegend ? legend(o.series.map(function (s) { return { name: s.name, color: s.color }; }), W, H - 8) : { svg: '', bottom: H - 8 };
    var m = { l: 52, r: 14, t: 14, b: 40 + (showLegend ? 18 : 0) };
    var maxV = 0;
    for (var i = 0; i < n; i++) { var t = 0, mx = 0; o.series.forEach(function (s) { t += s.values[i] || 0; mx = Math.max(mx, s.values[i] || 0); }); maxV = Math.max(maxV, o.stacked ? t : mx); }
    var ticks = niceTicks(0, maxV, 5), ymax = ticks[ticks.length - 1], plotW = W - m.l - m.r, band = plotW / n;
    var Y = function (v) { return m.t + (1 - v / ymax) * (H - m.t - m.b); };
    var s = axes(W, H, m, 0, ymax, ticks, o.yLabel), k = o.series.length, bw = o.stacked ? band * 0.7 : band * 0.8 / k;
    var every = Math.ceil(n / Math.floor(plotW / 48));
    for (var c = 0; c < n; c++) {
      var x0 = m.l + c * band + (band - (o.stacked ? bw : bw * k)) / 2, acc = 0;
      o.series.forEach(function (ser, si) {
        var v = ser.values[c] || 0; if (!v) return;
        var x = o.stacked ? x0 : x0 + si * bw, y1 = Y(o.stacked ? acc + v : v), y0 = Y(o.stacked ? acc : 0);
        s += '<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, y0 - y1).toFixed(1) + '" fill="' + ser.color + '"><title>' + esc(o.cats[c] + ' - ' + ser.name + ': ' + v) + '</title></rect>';
        if (o.stacked) acc += v;
      });
      if (c % every === 0) s += '<text x="' + (m.l + c * band + band / 2).toFixed(1) + '" y="' + (H - m.b + 15) + '" text-anchor="middle" font-size="10.5" fill="' + MUTED + '">' + esc(o.cats[c]) + '</text>';
    }
    if (showLegend) s += lg.svg;
    return wrapSvg(W, H, s, o.label || 'Bar chart');
  }

  /* opts: {edges:[], counts:[], xLabel, refs:[{x,label}], label} */
  function hist(o) {
    var W = o.W || 640, H = o.H || 280;
    if (!o.counts.length) return empty();
    var m = { l: 52, r: 14, t: 14, b: 44 }, maxC = Math.max.apply(null, o.counts), ticks = niceTicks(0, maxC, 5), ymax = ticks[ticks.length - 1];
    var xmin = o.edges[0], xmax = o.edges[o.edges.length - 1], refs = o.refs || [];
    refs.forEach(function (r) { xmin = Math.min(xmin, r.x); xmax = Math.max(xmax, r.x); });
    var X = function (v) { return m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r); }, Y = function (v) { return m.t + (1 - v / ymax) * (H - m.t - m.b); };
    var s = axes(W, H, m, 0, ymax, ticks, 'Samples');
    o.counts.forEach(function (c, i) {
      if (!c) return;
      s += '<rect x="' + (X(o.edges[i]) + 0.5).toFixed(1) + '" y="' + Y(c).toFixed(1) + '" width="' + Math.max(1, X(o.edges[i + 1]) - X(o.edges[i]) - 1).toFixed(1) + '" height="' + (Y(0) - Y(c)).toFixed(1) + '" fill="#0b6e99"><title>' + fmt(o.edges[i]) + ' to ' + fmt(o.edges[i + 1]) + ': ' + c + ' samples</title></rect>';
    });
    var xt = niceTicks(xmin, xmax, 6);
    xt.forEach(function (t) { if (t >= xmin && t <= xmax) s += '<text x="' + X(t) + '" y="' + (H - m.b + 15) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + fmt(t) + '</text>'; });
    refs.forEach(function (r) { s += '<line x1="' + X(r.x) + '" x2="' + X(r.x) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="#c75f00" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (X(r.x) + 3) + '" y="' + (m.t + 11) + '" font-size="10.5" fill="#9a5200">' + esc(r.label) + '</text>'; });
    if (o.xLabel) s += '<text x="' + (m.l + (W - m.l - m.r) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + esc(o.xLabel) + '</text>';
    return wrapSvg(W, H, s, o.label || 'Histogram');
  }

  /* opts: {groups:[{name,s:{n,min,q1,med,q3,max}}], yLabel, label} */
  function box(o) {
    var W = o.W || 640, H = o.H || 280, g = o.groups.filter(function (x) { return x.s && x.s.n; });
    if (!g.length) return empty();
    var m = { l: 52, r: 14, t: 14, b: 44 }, lo = Math.min.apply(null, g.map(function (x) { return x.s.min; })), hi = Math.max.apply(null, g.map(function (x) { return x.s.max; }));
    (o.refs || []).forEach(function (r) { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y); });
    var ticks = niceTicks(lo, hi, 5), ymin = ticks[0], ymax = ticks[ticks.length - 1], band = (W - m.l - m.r) / g.length;
    var Y = function (v) { return m.t + (1 - (v - ymin) / (ymax - ymin)) * (H - m.t - m.b); };
    var s = axes(W, H, m, ymin, ymax, ticks, o.yLabel);
    (o.refs || []).forEach(function (r) { s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(r.y) + '" y2="' + Y(r.y) + '" stroke="#c75f00" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (W - m.r - 2) + '" y="' + (Y(r.y) - 4) + '" text-anchor="end" font-size="10.5" fill="#9a5200">' + esc(r.label) + '</text>'; });
    g.forEach(function (x, i) {
      var cx = m.l + band * i + band / 2, bw = Math.min(60, band * 0.5), c = PALETTE[i % PALETTE.length], q = x.s;
      s += '<line x1="' + cx + '" x2="' + cx + '" y1="' + Y(q.min) + '" y2="' + Y(q.max) + '" stroke="' + c + '" stroke-width="1.5"/>' +
        '<rect x="' + (cx - bw / 2) + '" y="' + Y(q.q3) + '" width="' + bw + '" height="' + Math.max(1, Y(q.q1) - Y(q.q3)) + '" fill="' + c + '" fill-opacity=".25" stroke="' + c + '" stroke-width="1.5"><title>' + esc(x.name + ': n=' + q.n + ', min ' + fmt(q.min) + ', Q1 ' + fmt(q.q1) + ', median ' + fmt(q.med) + ', Q3 ' + fmt(q.q3) + ', max ' + fmt(q.max)) + '</title></rect>' +
        '<line x1="' + (cx - bw / 2) + '" x2="' + (cx + bw / 2) + '" y1="' + Y(q.med) + '" y2="' + Y(q.med) + '" stroke="' + c + '" stroke-width="3"/>' +
        '<line x1="' + (cx - bw / 4) + '" x2="' + (cx + bw / 4) + '" y1="' + Y(q.min) + '" y2="' + Y(q.min) + '" stroke="' + c + '"/><line x1="' + (cx - bw / 4) + '" x2="' + (cx + bw / 4) + '" y1="' + Y(q.max) + '" y2="' + Y(q.max) + '" stroke="' + c + '"/>' +
        '<text x="' + cx + '" y="' + (H - m.b + 15) + '" text-anchor="middle" font-size="11" fill="' + INK + '">' + esc(x.name) + '</text><text x="' + cx + '" y="' + (H - m.b + 29) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">n=' + q.n + '</text>';
    });
    return wrapSvg(W, H, s, o.label || 'Box plot');
  }

  /* opts: {slices:[{label,value,color}], label, centerText} */
  function donut(o) {
    var W = o.W || 320, H = o.H || 240, total = 0;
    o.slices.forEach(function (s) { total += s.value; });
    if (!total) return empty();
    var cx = 100, cy = H / 2, R = 88, r = 54, a0 = -Math.PI / 2, s = '';
    o.slices.forEach(function (sl) {
      if (!sl.value) return;
      var a1 = a0 + sl.value / total * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
      if (sl.value === total) { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + sl.color + '" stroke-width="' + (R - r) + '"><title>' + esc(sl.label + ': ' + sl.value) + '</title></circle>'; }
      else {
        var p = function (a, rad) { return (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2); };
        s += '<path d="M ' + p(a0, R) + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p(a1, R) + ' L ' + p(a1, r) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p(a0, r) + ' Z" fill="' + sl.color + '" stroke="#fff" stroke-width="1.5"><title>' + esc(sl.label + ': ' + sl.value + ' (' + Math.round(sl.value / total * 100) + '%)') + '</title></path>';
      }
      a0 = a1;
    });
    s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="24" font-weight="700" fill="' + INK + '">' + total + '</text><text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="11" fill="' + MUTED + '">' + esc(o.centerText || 'samples') + '</text>';
    var y = 30;
    o.slices.forEach(function (sl) { s += '<rect x="212" y="' + (y - 10) + '" width="11" height="11" rx="2" fill="' + sl.color + '"/><text x="228" y="' + y + '" font-size="11.5" fill="' + INK + '">' + esc(sl.label) + ': ' + sl.value + '</text>'; y += 24; });
    return wrapSvg(W + 150, H, s, o.label || 'Donut chart');
  }

  AQ.Charts = { PALETTE: PALETTE, line: line, bar: bar, hist: hist, box: box, donut: donut, esc: esc, fmt: fmt };
})();
