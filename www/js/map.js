/* 4TIMER — mapa real bajo el recorrido (teselas CARTO oscuras con datos de OpenStreetMap). Solo se descargan al pedir el mapa. */
(function (root) {
  'use strict';
  var TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
  var ATTR = '© OpenStreetMap contributors © CARTO';
  function wx(lon) { return (lon + 180) / 360; }
  function wy(lat) { var r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; }

  /* Encuadre: devuelve la función proj([lat,lon]) → [px,py] y el zoom, para que todo el recorrido quepa en W×H */
  function view(route, W, H, margin) {
    var mnx = 1, mxx = 0, mny = 1, mxy = 0;
    route.forEach(function (p) { var x = wx(p[1]), y = wy(p[0]); mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); });
    var sx = Math.max(1e-9, mxx - mnx), sy = Math.max(1e-9, mxy - mny), m = margin == null ? 0.12 * Math.min(W, H) : margin;
    var K = Math.min((W - 2 * m) / sx, (H - 2 * m) / sy), KMAX = 256 * Math.pow(2, 17);
    K = Math.min(K, KMAX);
    var cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    return { K: K, cx: cx, cy: cy, W: W, H: H, proj: function (p) { return [W / 2 + (wx(p[1]) - cx) * K, H / 2 + (wy(p[0]) - cy) * K]; } };
  }
  function loadTile(url, ms) {
    return new Promise(function (res) {
      var img = new root.Image(), done = false, t = setTimeout(function () { fin(null); }, ms || 8000);
      function fin(v) { if (done) return; done = true; clearTimeout(t); res(v); }
      img.crossOrigin = 'anonymous'; img.onload = function () { fin(img); }; img.onerror = function () { fin(null); };
      img.src = url;
    });
  }
  /* Dibuja las teselas en un canvas nuevo W×H. Devuelve Promise<{canvas, proj, loaded, total}> */
  function render(route, W, H, o) {
    o = o || {};
    var canvas = root.document.createElement('canvas'); canvas.width = W; canvas.height = H;
    var v = view(route, W, H, o.margin), ctx = canvas.getContext && canvas.getContext('2d');
    var out = { canvas: canvas, proj: v.proj, loaded: 0, total: 0 };
    canvas.proj = v.proj;
    if (!ctx) return Promise.resolve(out);
    ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, W, H);
    var z = Math.max(0, Math.min(18, Math.ceil(Math.log(v.K / 256) / Math.LN2 - 1e-6))), n = Math.pow(2, z), ts = v.K / n;
    var x0 = Math.floor((v.cx - W / 2 / v.K) * n), x1 = Math.floor((v.cx + W / 2 / v.K) * n), y0 = Math.floor((v.cy - H / 2 / v.K) * n), y1 = Math.floor((v.cy + H / 2 / v.K) * n);
    var jobs = [];
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      (function (tx, ty) {
        var xx = ((tx % n) + n) % n, url = (o.url || TILE).replace('{s}', 'abcd'.charAt((xx + ty) % 4)).replace('{z}', z).replace('{x}', xx).replace('{y}', ty);
        var px = W / 2 + (tx / n - v.cx) * v.K, py = H / 2 + (ty / n - v.cy) * v.K;
        jobs.push(loadTile(url).then(function (img) { if (img) { ctx.drawImage(img, px, py, ts + 0.6, ts + 0.6); out.loaded++; } }));
      })(x, y);
    }
    out.total = jobs.length;
    return Promise.all(jobs).then(function () {
      ctx.save(); ctx.font = '600 ' + Math.max(11, Math.round(W / 55)) + 'px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(ATTR, W - 8, H - 6); ctx.restore();
      return out;
    });
  }
  /* Línea roja neón (misma que el recorrido dibujado) con salida verde y llegada blanca */
  function stroke(ctx, proj, route, s) {
    s = s || 1;
    var P = route.map(proj);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [[16 * s, 'rgba(255,45,45,.28)', 24 * s], [5 * s, '#ff2d2d', 12 * s]].forEach(function (L) {
      ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.lineWidth = L[0]; ctx.strokeStyle = L[1]; ctx.shadowColor = '#ff2d2d'; ctx.shadowBlur = L[2]; ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2fbf5b'; ctx.beginPath(); ctx.arc(P[0][0], P[0][1], 9 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P[P.length - 1][0], P[P.length - 1][1], 9 * s, 0, 7); ctx.fill();
    ctx.restore();
  }
  root.RunMap = { view: view, render: render, stroke: stroke, TILE: TILE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RunMap;
})(typeof window !== 'undefined' ? window : globalThis);
