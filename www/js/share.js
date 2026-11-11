/* 4TIMER — tarjeta para compartir (Instagram, etc.) y envío con el menú de compartir del móvil */
(function (root) {
  'use strict';
  var FORMATS = {
    story: { w: 1080, h: 1920, label: 'Story' },
    post: { w: 1080, h: 1350, label: 'Publicación' }
  };
  var F = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var RED = '#ff2d2d', BLUE = '#3a74ff', ORANGE = '#f5921e', MUTED = '#a3a3aa';

  function fontsReady() {
    var d = root.document;
    if (!d || !d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all([
      d.fonts.load('800 italic 80px "Barlow Condensed"'),
      d.fonts.load('700 40px "Barlow Condensed"'),
      d.fonts.load('600 40px "Barlow Condensed"')
    ]).catch(function () {});
  }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function imgSize(img) { return { w: img.naturalWidth || img.videoWidth || img.width, h: img.naturalHeight || img.videoHeight || img.height }; }
  function cover(ctx, img, x, y, w, h) {
    var s = imgSize(img), k = Math.max(w / s.w, h / s.h), dw = s.w * k, dh = s.h * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  /* Dibuja una línea de ejercicio: nº, y para cada ejercicio cantidad en negrita + nombre. Corta con … si no cabe. */
  function drawExercise(ctx, ln, x, y, maxW) {
    var cx = x, limit = x + maxW;
    function put(text, font, color) {
      ctx.font = font; ctx.fillStyle = color;
      var w = ctx.measureText(text).width;
      if (cx + w > limit) {
        var t = text;
        while (t.length > 1 && cx + ctx.measureText(t + '…').width > limit) t = t.slice(0, -1);
        ctx.fillText(t + '…', cx, y); cx = limit + 1; return false;
      }
      ctx.fillText(text, cx, y); cx += w; return true;
    }
    if (ln.num && !put(ln.num + ' ', '800 46px ' + F, ORANGE)) return;
    for (var i = 0; i < ln.parts.length; i++) {
      var pt = ln.parts[i];
      if (i > 0 && !put(' + ', '600 46px ' + F, MUTED)) return;
      if (pt.qty && !put(pt.qty + ' ', '800 46px ' + F, '#ffffff')) return;
      if (!put(pt.name, '600 46px ' + F, '#e9e9ec')) return;
    }
    if (ln.note) put('  ' + ln.note, 'italic 600 38px ' + F, MUTED);
  }

  /* Marcador: recuadro oscuro con etiqueta y LED (rondas/tiempo) o texto grande (EMOM, otros). */
  function drawStat(ctx, r, x, y, w, u, digitsH, mode) {
    var h = 56 + digitsH + 44;
    if (mode !== 2) { ctx.save(); rr(ctx, x, y, w, h, 30); ctx.fillStyle = mode === 1 ? 'rgba(10,10,14,.42)' : 'rgba(0,0,0,.74)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke(); ctx.restore(); }
    ctx.font = '700 40px ' + F; ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText(r.label, x + 34, y + 54);
    if (r.kind === 'text') {
      ctx.textAlign = 'center'; ctx.fillStyle = RED; ctx.shadowColor = RED; ctx.shadowBlur = 18;
      var fs = Math.min(190, Math.round(digitsH * 1.25)); ctx.font = '800 italic ' + fs + 'px ' + F;
      while (fs > 60 && ctx.measureText(r.value).width > w - 80) { fs -= 6; ctx.font = '800 italic ' + fs + 'px ' + F; }
      ctx.fillText(r.value, x + w / 2, y + 70 + digitsH / 2 + fs * 0.34);
      ctx.shadowBlur = 0; ctx.textAlign = 'left';
    } else if (r.kind === 'run') {
      var rt = String(r.value), rw2 = root.LED.measure(rt, u);
      root.LED.draw(ctx, rt, x + (w - rw2) / 2 - 8, y + 70, u, RED, 18);
      ctx.font = '700 40px ' + F; ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.fillText('km', x + w - 34, y + 54); ctx.textAlign = 'left';
    } else {
      var text = r.kind === 'rounds' ? ('0' + r.value).slice(-2) : fmt(r.value);
      var dw = root.LED.measure(text, u);
      root.LED.draw(ctx, text, x + (w - dw) / 2 - 8, y + 70, u, r.kind === 'rounds' ? BLUE : RED, 18);
    }
    return h;
  }
  /* Insignia "NUEVO PR" junto al chip del modo */
  function drawPR(ctx, x, y, h) {
    ctx.font = '800 italic 38px ' + F;
    var t = 'NUEVO PR', w = ctx.measureText(t).width + 44;
    ctx.fillStyle = '#2fbf5b'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#04200d'; ctx.fillText(t, x + 22, y + 42);
    return w;
  }

  function placeholder(ctx, x, y, w, h, label, r, cyf) {
    ctx.save(); rr(ctx, x, y, w, h, r || 0); ctx.fillStyle = '#2b2b30'; ctx.fill();
    ctx.setLineDash([14, 12]); ctx.lineWidth = 3; ctx.strokeStyle = '#5b5b63'; ctx.stroke(); ctx.setLineDash([]);
    var cx = x + w / 2, cy = y + h * (cyf || 0.5), rad = Math.max(18, Math.min(46, Math.min(w, h) * 0.16));
    ctx.fillStyle = '#5a5a5f'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, rad / 6); ctx.beginPath(); ctx.moveTo(cx - rad * .45, cy); ctx.lineTo(cx + rad * .45, cy); ctx.moveTo(cx, cy - rad * .45); ctx.lineTo(cx, cy + rad * .45); ctx.stroke();
    ctx.fillStyle = '#9b9ba3'; ctx.font = '700 ' + Math.max(22, Math.min(34, Math.round(h * 0.12))) + 'px ' + F; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + rad + 40); ctx.textAlign = 'left';
    ctx.restore();
  }
  /* Recorrido dibujado sin mapa (privacidad): línea neón normalizada al recuadro */
  function drawRoute(ctx, route, x, y, w, h, map) {
    ctx.save(); rr(ctx, x, y, w, h, 26); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke(); ctx.clip();
    if (map) {                                   // mapa real debajo; la línea se dibuja con la misma proyección
      ctx.drawImage(map.canvas, x, y, w, h);
      ctx.translate(x, y); root.RunMap.stroke(ctx, map.proj, route, Math.max(1, w / 700));
      ctx.restore(); ctx.save(); rr(ctx, x, y, w, h, 26); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke(); ctx.restore();
      return;
    }
    var lat0 = route[0][0], kx = Math.cos(lat0 * Math.PI / 180), mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    var P = route.map(function (p) { var px = p[1] * kx, py = -p[0]; if (px < mnx) mnx = px; if (px > mxx) mxx = px; if (py < mny) mny = py; if (py > mxy) mxy = py; return [px, py]; });
    var m = 46, sw = Math.max(1e-9, mxx - mnx), sh = Math.max(1e-9, mxy - mny), k = Math.min((w - 2 * m) / sw, (h - 2 * m) / sh);
    var ox = x + (w - sw * k) / 2, oy = y + (h - sh * k) / 2;
    function X(p) { return ox + (p[0] - mnx) * k; } function Y(p) { return oy + (p[1] - mny) * k; }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [[16, 'rgba(255,45,45,.25)', 30], [6, RED, 18]].forEach(function (L) {
      ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(X(p), Y(p)); else ctx.moveTo(X(p), Y(p)); });
      ctx.lineWidth = L[0]; ctx.strokeStyle = L[1]; ctx.shadowColor = RED; ctx.shadowBlur = L[2]; ctx.stroke();
    });
    ctx.shadowBlur = 0;
    var a = P[0], b = P[P.length - 1];
    ctx.fillStyle = '#2fbf5b'; ctx.beginPath(); ctx.arc(X(a), Y(a), 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(b), Y(b), 11, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ---------- Escena editable: la tarjeta es una lista de elementos (de atrás hacia delante) ----------
     elemento: { id, type, x, y, w, h (fracciones del lienzo, esquina sup. izq.), rot (rad), style (0..2), media:{el,kind,url}|null, fixed (fondo fijo) }
     tipos: media · title · stat · exercises · logo · brand · footer · route */
  var seqId = 0;
  var TYPE_LABEL = { media: 'Foto / vídeo', title: 'Cartel del entreno', stat: 'Marcador', exercises: 'Ejercicios', logo: 'Logo', brand: '4TIMER', footer: 'Fecha y pie', route: 'Recorrido' };
  var STYLES = { media: ['Recto', 'Redondeado', 'Polaroid'], title: ['Cartel', 'Cristal', 'Solo texto'], stat: ['Marcador', 'Cristal', 'Solo cifras'], exercises: ['Texto', 'Cristal', 'Oscuro'], route: ['Línea', 'Mapa real'] };
  function mk(type, px, extra) {                                  // px = [x, y, w, h] sobre un lienzo Story de 1080×1920
    var e = { id: 'e' + (++seqId), type: type, x: px[0] / 1080, y: px[1] / 1920, w: px[2] / 1080, h: px[3] / 1920, rot: 0, style: 0, media: null, fixed: false };
    for (var k in extra) e[k] = extra[k];
    return e;
  }
  function bg(rect, label) { return mk('media', rect || [0, 0, 1080, 1920], { fixed: true, label: label || 'Fondo' }); }
  function std(run, o) {                                          // logo + marca arriba, bloque de resultado abajo
    o = o || {};
    var L = [mk('logo', [64, 64, 160, 160]), mk('brand', [600, 64, 416, 112])];
    if (run && o.route) L.push(mk('route', o.route));
    return L;
  }
  function bottom(o) {
    o = o || {}; var L = [];
    L.push(mk('title', [64, o.ty || 1140, 952, 196]));
    L.push(mk('stat', [64, o.sy || 1350, 952, 414]));
    L.push(mk('footer', [64, 1790, 952, 66]));
    return L;
  }
  var TEMPLATES = [
    { id: 'clasica', name: 'Clásica', make: function (run) {
      var L = [bg()].concat(std(run, { route: [64, 250, 952, 460] }));
      L.push(mk('title', [64, 760, 952, 190]), mk('stat', [64, 960, 952, 414]), mk('exercises', [64, 1400, 952, 360]), mk('footer', [64, 1790, 952, 66]));
      return L; } },
    { id: 'pizarra', name: 'Foto frontal', make: function () {
      var L = [bg()].concat(std(false));
      L.push(mk('media', [64, 250, 952, 480], { style: 1, label: 'Foto frontal' }), mk('title', [64, 760, 952, 190]), mk('stat', [64, 960, 952, 414]), mk('exercises', [64, 1400, 952, 360]), mk('footer', [64, 1790, 952, 66]));
      return L; } },
    { id: 'arriba', name: 'Ejercicios arriba', make: function (run) {
      var L = [bg()].concat(std(run, { route: [64, 720, 952, 400] }));
      L.push(mk('exercises', [64, 260, 790, 420], { style: 1 }));
      return L.concat(bottom()); } },
    { id: 'limpia', name: 'Solo resultado', make: function (run) {
      return [bg()].concat(std(run, { route: [64, 250, 952, 460] }), bottom()); } },
    { id: 'carrete3', name: 'Carrete 3 + fondo', make: function () {
      var L = [bg()].concat(std(false));
      for (var i = 0; i < 3; i++) L.push(mk('media', [680, 280 + i * 290, 340, 255], { style: 2, rot: 0.05, label: 'Carrete ' + (i + 1) }));
      return L.concat(bottom()); } },
    { id: 'carrete4', name: 'Carrete 4 + 2 fondos', make: function () {
      var L = [bg([0, 0, 1080, 960], 'Fondo arriba'), bg([0, 960, 1080, 960], 'Fondo abajo')].concat(std(false));
      for (var i = 0; i < 4; i++) L.push(mk('media', [70, 270 + i * 215, 290, 190], { style: 2, rot: -0.12, label: 'Carrete ' + (i + 1) }));
      return L.concat(bottom()); } },
    { id: 'collage', name: 'Collage 3 + fondo', make: function () {
      var L = [bg()].concat(std(false));
      L.push(mk('media', [640, 250, 380, 490], { style: 2, rot: 0.03, label: 'Foto 1' }), mk('media', [290, 520, 380, 490], { style: 2, rot: -0.03, label: 'Foto 2' }), mk('media', [620, 760, 380, 360], { style: 2, rot: 0.02, label: 'Foto 3' }));
      return L.concat(bottom()); } }
  ];
  /* Escena nueva: plantilla + datos. pool: medios ya cargados que se reparten por los huecos libres (en orden) */
  function makeScene(tplIdx, format, data) {
    var t = TEMPLATES[tplIdx] || TEMPLATES[0], sc = { tpl: tplIdx, format: format === 'post' ? 'post' : 'story', r: data.r, logo: data.logo || null, gymName: data.gymName || '', elements: t.make(!!data.isRun) };
    var pool = (data.pool || []).slice();
    sc.elements.forEach(function (e) { if (e.type === 'media' && !e.media && pool.length) e.media = pool.shift(); });
    sc.spare = pool;
    return sc;
  }
  function mediaOf(sc) { return sc.elements.filter(function (e) { return e.type === 'media' && e.media; }).map(function (e) { return e.media; }); }
  function newElement(type, sc) {
    var e = mk(type, { media: [260, 700, 560, 560], title: [64, 800, 952, 190], stat: [64, 700, 952, 414], exercises: [64, 700, 952, 360], logo: [64, 64, 160, 160], brand: [600, 64, 416, 112], footer: [64, 1790, 952, 66], route: [64, 600, 952, 460] }[type]);
    return e;
  }

  function mediaDims(m) { var el = m.el; return { w: el.naturalWidth || el.videoWidth || el.width, h: el.naturalHeight || el.videoHeight || el.height }; }
  function drawMediaFill(ctx, m, x, y, w, h) { try { cover(ctx, m.el, x, y, w, h); } catch (e) {} }
  function scrim(ctx, w, h, part) {                                // oscurece arriba y/o abajo para que se lea el texto sobre la foto
    if (part === 'bottom') { var bb = ctx.createLinearGradient(0, h * 0.4, 0, h); bb.addColorStop(0, 'rgba(0,0,0,0)'); bb.addColorStop(1, 'rgba(0,0,0,.85)'); ctx.fillStyle = bb; ctx.fillRect(0, h * 0.4, w, h * 0.6); return; }
    var th = Math.min(360, h * 0.2), top = ctx.createLinearGradient(0, 0, 0, th); top.addColorStop(0, 'rgba(0,0,0,.65)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, w, th);
    if (part === 'top') return;
    var bot = ctx.createLinearGradient(0, h * 0.3, 0, h); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(0.55, 'rgba(0,0,0,.78)'); bot.addColorStop(1, 'rgba(0,0,0,.93)');
    ctx.fillStyle = bot; ctx.fillRect(0, h * 0.3, w, h * 0.7);
  }
  function drawMedia(ctx, e, w, h, o) {
    var m = e.media, st = e.style | 0;
    if (!m) {
      if (!o.placeholders) return;
      if (o.ghost) { ctx.fillStyle = '#2b2b30'; ctx.fillRect(0, 0, w, h); return; }
      placeholder(ctx, 0, 0, w, h, e.label || 'Foto o vídeo', st === 1 ? 26 : 0, e.fixed && e.h > 0.9 ? 0.2 : 0.5); return;
    }
    if (st === 2) {                                                // polaroid
      var pd = Math.max(8, Math.min(w, h) * 0.045);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; ctx.fillStyle = '#f4f3ee'; ctx.fillRect(0, 0, w, h); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(pd, pd, w - 2 * pd, h - 2 * pd); ctx.clip(); drawMediaFill(ctx, m, pd, pd, w - 2 * pd, h - 2 * pd); ctx.restore();
    } else if (st === 1) {                                         // redondeado con sombra y borde fino
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = '#000'; rr(ctx, 0, 0, w, h, 26); ctx.fill(); ctx.restore();
      ctx.save(); rr(ctx, 0, 0, w, h, 26); ctx.clip(); drawMediaFill(ctx, m, 0, 0, w, h); ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.28)'; rr(ctx, 0, 0, w, h, 26); ctx.stroke();
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); drawMediaFill(ctx, m, 0, 0, w, h);
      if (e.fixed) scrim(ctx, w, h, e.h > 0.9 ? '' : e.y < 0.01 ? 'top' : 'bottom');   // fondo: sombreado para leer el texto
      ctx.restore();
    }
  }
  function chipAt(ctx, r, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.font = '800 italic 38px ' + F;
    var cwid = ctx.measureText(r.modeName).width + 44;
    ctx.fillStyle = ORANGE; rr(ctx, 0, 0, cwid, 60, 30); ctx.fill();
    ctx.fillStyle = '#1b1203'; ctx.fillText(r.modeName, 22, 42);
    if (r.pr) drawPR(ctx, cwid + 16, 0, 60);
    ctx.restore();
  }
  function drawTitle(ctx, r, w, h, st) {
    var box = st === 1, pad = box ? Math.min(26, h * 0.12) : 0, iw = w - 2 * pad, ih = h - 2 * pad, chip = st !== 2, name = String(r.name || '').replace(/\s+/g, ' ').trim() || r.modeName;
    if (box) { ctx.save(); rr(ctx, 0, 0, w, h, 26); ctx.fillStyle = 'rgba(0,0,0,.52)'; ctx.fill(); ctx.restore(); }
    var fs = Math.min(150, ih), lines = [name], chH;
    for (; fs >= 22; fs -= 4) {
      ctx.font = '800 italic ' + fs + 'px ' + F; lines = wrap(ctx, name, iw, 2);
      chH = chip ? fs * 0.62 + fs * 0.16 : 0;
      if (chH + lines.length * fs * 1.02 <= ih + 1 && lines.join(' ') === name) break;
    }
    chH = chip ? fs * 0.62 + fs * 0.16 : 0;
    if (chip) chipAt(ctx, r, pad, pad, (fs * 0.62) / 60);
    ctx.font = '800 italic ' + fs + 'px ' + F; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    lines.forEach(function (t, i) { ctx.fillText(t, pad, pad + chH + fs * 0.84 + i * fs * 1.02); });
  }
  function statLedW(r) { var p = r.kind === 'rounds' ? '00' : r.kind === 'run' ? '00.00' : '00:00'; return root.LED.measure(p, 2.6); }
  function drawStatEl(ctx, r, w, h, st) {
    var REFH = 349.6 + 64, k = h / REFH;
    if (r.kind !== 'text') k = Math.min(k, w / (statLedW(r) + 110));
    var rw = w / k;
    ctx.save(); ctx.scale(k, k);
    drawStat(ctx, r, 0, 0, rw, 2.6, 96 * 2.6, st);
    ctx.font = '700 44px ' + F; ctx.fillStyle = '#e9e9ec'; ctx.textAlign = 'center'; ctx.fillText(r.sub || '', rw / 2, 349.6 + 54); ctx.textAlign = 'left';
    ctx.restore();
  }
  function drawExEl(ctx, r, w, h, st, o) {
    var lines = r.lines || [], n = lines.length;
    if (!n) { if (o.placeholders && !o.ghost) { ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.setLineDash([14, 12]); ctx.lineWidth = 3; ctx.strokeStyle = '#8a8a92'; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#9b9ba3'; ctx.font = '700 36px ' + F; ctx.textAlign = 'center'; ctx.fillText('Ejercicios', w / 2, h / 2 + 12); ctx.restore(); } return; }
    var pad = st ? 22 : 0, avail = h - 2 * pad, s = Math.min(1.25, avail / (n * 62)), cnt = n;
    if (s < 0.5) { s = 0.5; cnt = Math.max(1, Math.floor(avail / (62 * s)) - 1); }
    var shown = lines.slice(0, cnt), more = n - shown.length, ch = Math.min(h, (shown.length * 62 + (more > 0 ? 62 : 0)) * s + 2 * pad + (st ? 4 : 0));
    if (st) { ctx.save(); rr(ctx, 0, 0, w, ch, 26); ctx.fillStyle = st === 1 ? 'rgba(0,0,0,.46)' : 'rgba(10,10,12,.88)'; ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.translate(pad, pad); ctx.scale(s, s); var iw = (w - 2 * pad) / s;
    if (st === 1) ctx.globalAlpha = 0.95;
    shown.forEach(function (ln, i) { drawExercise(ctx, ln, 0, 44 + i * 62, iw); });
    if (more > 0) { ctx.font = 'italic 600 40px ' + F; ctx.fillStyle = MUTED; ctx.fillText('+ ' + more + ' más', 0, 44 + shown.length * 62); }
    ctx.restore();
  }
  function drawLogoEl(ctx, sc, w, h) {
    var lg = sc.logo;
    if (lg) {
      var ls = imgSize(lg), k = Math.min(w / ls.w, h / ls.h), lw = ls.w * k, lh = ls.h * k, lx = (w - lw) / 2, ly = (h - lh) / 2;
      if (lg.__round) ctx.drawImage(lg, lx, ly, lw, lh);
      else { ctx.save(); rr(ctx, lx, ly, lw, lh, 22); ctx.clip(); ctx.fillStyle = '#000'; ctx.fillRect(lx, ly, lw, lh); ctx.drawImage(lg, lx, ly, lw, lh); ctx.restore(); }
    } else if (sc.gymName) {
      var fs = Math.min(96, h * 0.7); ctx.font = '800 italic ' + fs + 'px ' + F;
      while (fs > 20 && ctx.measureText(sc.gymName).width > w) { fs -= 4; ctx.font = '800 italic ' + fs + 'px ' + F; }
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(sc.gymName, 0, h * 0.7);
    }
  }
  function drawBrandEl(ctx, w, h) {
    var fs = Math.min(h / 1.2, 140); ctx.font = '800 italic ' + fs + 'px ' + F;
    var tw = ctx.measureText('TIMER').width;
    while (fs > 20 && tw + fs * 0.9 > w) { fs -= 4; ctx.font = '800 italic ' + fs + 'px ' + F; tw = ctx.measureText('TIMER').width; }
    var by = Math.min(h, fs * 0.98);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText('TIMER', w, by);
    ctx.lineWidth = Math.max(3, fs / 23); ctx.strokeStyle = ORANGE; ctx.lineJoin = 'round'; ctx.strokeText('4', w - tw - fs * 0.04, by);
    ctx.textAlign = 'left';
  }
  function drawFooterEl(ctx, r, w, h) {
    var fs = Math.min(38, h * 0.62); ctx.font = '600 ' + fs + 'px ' + F; ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText(r.date || '', 0, h * 0.72);
    ctx.textAlign = 'right'; ctx.fillText('Hecho con 4TIMER', w, h * 0.72); ctx.textAlign = 'left';
  }
  function rectPx(e, W, H) { return { x: e.x * W, y: e.y * H, w: e.w * W, h: e.h * H }; }
  function drawElement(ctx, sc, e, W, H, o) {
    var R = rectPx(e, W, H), r = sc.r;
    ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); if (e.rot) ctx.rotate(e.rot); ctx.translate(-R.w / 2, -R.h / 2);
    ctx.textBaseline = 'alphabetic';
    if (e.type === 'media') drawMedia(ctx, e, R.w, R.h, o);
    else if (e.type === 'title') drawTitle(ctx, r, R.w, R.h, e.style | 0);
    else if (e.type === 'stat') drawStatEl(ctx, r, R.w, R.h, e.style | 0);
    else if (e.type === 'exercises') drawExEl(ctx, r, R.w, R.h, e.style | 0, o);
    else if (e.type === 'logo') drawLogoEl(ctx, sc, R.w, R.h);
    else if (e.type === 'brand') drawBrandEl(ctx, R.w, R.h);
    else if (e.type === 'footer') drawFooterEl(ctx, r, R.w, R.h);
    else if (e.type === 'route' && r.route && r.route.length > 1) drawRoute(ctx, r.route, 0, 0, R.w, R.h, (e.style | 0) === 1 && e.__map && e.__map.m && e.__map.m.loaded ? e.__map.m : null);
    ctx.restore();
  }
  function drawSel(ctx, e, W, H, px) {
    var R = rectPx(e, W, H);
    ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); if (e.rot) ctx.rotate(e.rot); ctx.translate(-R.w / 2, -R.h / 2);
    ctx.lineWidth = 2.5 * px; ctx.strokeStyle = ORANGE; ctx.setLineDash([9 * px, 6 * px]); ctx.strokeRect(0, 0, R.w, R.h); ctx.setLineDash([]);
    if (!e.fixed) {                                                 // tirador de tamaño (esquina inferior derecha)
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(R.w, R.h, 13 * px, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5 * px; ctx.strokeStyle = '#1b1203'; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(R.w - 6 * px, R.h + 6 * px); ctx.lineTo(R.w + 6 * px, R.h - 6 * px); ctx.moveTo(R.w + 6 * px, R.h - 1 * px); ctx.lineTo(R.w + 6 * px, R.h - 6 * px); ctx.lineTo(R.w + 1 * px, R.h - 6 * px);
      ctx.moveTo(R.w - 6 * px, R.h + 1 * px); ctx.lineTo(R.w - 6 * px, R.h + 6 * px); ctx.lineTo(R.w - 1 * px, R.h + 6 * px); ctx.stroke();
    }
    ctx.restore();
  }
  /* Dibuja la escena entera en ctx. o: { scale, placeholders, ghost, sel (id), pxs (px de lienzo por px de pantalla) } */
  function drawScene(ctx, sc, o) {
    o = o || {}; var fm = FORMATS[sc.format] || FORMATS.story, W = fm.w, H = fm.h, k = o.scale || 1;
    ctx.save(); ctx.scale(k, k);
    if (!o.noBg) {
      ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H);
      var g = ctx.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.2, H * 0.25, W * 0.9); g.addColorStop(0, 'rgba(255,45,45,.16)'); g.addColorStop(1, 'rgba(255,45,45,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(W * 0.9, H * 0.7, 0, W * 0.9, H * 0.7, W * 0.9); g2.addColorStop(0, 'rgba(58,116,255,.14)'); g2.addColorStop(1, 'rgba(58,116,255,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    }
    sc.elements.forEach(function (e) { drawElement(ctx, sc, e, W, H, o); });
    if (o.sel) sc.elements.forEach(function (e) { if (e.id === o.sel) drawSel(ctx, e, W, H, o.pxs || 3); });
    ctx.restore();
  }
  /* Mapas reales (solo recorrido con estilo «Mapa real»): se descargan una vez por tamaño */
  function prepMaps(sc) {
    var jobs = [];
    sc.elements.forEach(function (e) {
      if (e.type !== 'route' || (e.style | 0) !== 1 || !root.RunMap || !sc.r.route || sc.r.route.length < 2) return;
      var fm = FORMATS[sc.format], w = Math.round(e.w * fm.w), h = Math.round(e.h * fm.h), key = w + 'x' + h + ':' + sc.r.route.length;
      if (e.__map && e.__map.key === key) return;
      jobs.push(root.RunMap.render(sc.r.route, w, h).then(function (m) { e.__map = { key: key, m: m }; }).catch(function () { e.__map = { key: key, m: null }; }));
    });
    return jobs.length ? Promise.all(jobs) : Promise.resolve();
  }
  var fontsOK = false;
  function drawTo(canvas, sc, o) {
    var fm = FORMATS[sc.format] || FORMATS.story, k = o.scale || 1;
    canvas.width = Math.max(1, Math.round(fm.w * k)); canvas.height = Math.max(1, Math.round(fm.h * k));
    drawScene(canvas.getContext('2d'), sc, o);
    return canvas;
  }
  /* Pinta la escena en un canvas. o.edit: huecos vacíos y selección (vista previa); sin o.edit queda lista para exportar. */
  function render(canvas, sc, o) {
    o = o || {}; var oo = { scale: o.scale, placeholders: !!o.edit, sel: o.edit ? o.sel : null, pxs: o.pxs };
    var go = function () { fontsOK = true; return prepMaps(sc).then(function () { return drawTo(canvas, sc, oo); }); };
    return fontsOK ? go() : fontsReady().then(go);
  }
  function renderThumb(canvas, sc, width) {
    var fm = FORMATS[sc.format] || FORMATS.story;
    return fontsReady().then(function () { fontsOK = true; return drawTo(canvas, sc, { scale: width / fm.w, placeholders: true, ghost: true }); });
  }

  /* ---------- Gestos sobre la escena ---------- */
  function toLocal(e, W, H, x, y) {                                // punto del lienzo → coordenadas locales del elemento (sin giro)
    var R = rectPx(e, W, H), dx = x - (R.x + R.w / 2), dy = y - (R.y + R.h / 2), c = Math.cos(-e.rot || 0), s = Math.sin(-e.rot || 0);
    return { x: dx * c - dy * s + R.w / 2, y: dx * s + dy * c + R.h / 2, w: R.w, h: R.h };
  }
  function hitTest(sc, x, y) {
    var fm = FORMATS[sc.format] || FORMATS.story;
    for (var i = sc.elements.length - 1; i >= 0; i--) {
      var e = sc.elements[i], p = toLocal(e, fm.w, fm.h, x, y);
      if (p.x >= 0 && p.y >= 0 && p.x <= p.w && p.y <= p.h) return e;
    }
    return null;
  }
  function handleHit(sc, e, x, y, rad) {
    var fm = FORMATS[sc.format] || FORMATS.story, p = toLocal(e, fm.w, fm.h, x, y);
    return Math.abs(p.x - p.w) <= rad && Math.abs(p.y - p.h) <= rad;
  }
  function resizeBy(sc, e, e0, dx, dy) {                           // arrastrar la esquina inferior derecha; la superior izquierda queda fija
    var fm = FORMATS[sc.format] || FORMATS.story, W = fm.w, H = fm.h, c = Math.cos(e0.rot || 0), s = Math.sin(e0.rot || 0);
    var ldx = dx * c + dy * s, ldy = -dx * s + dy * c, nw = Math.max(0.05, e0.w + ldx / W), nh = Math.max(0.03, e0.h + ldy / H);
    var w0 = e0.w * W, h0 = e0.h * H, cx0 = e0.x * W + w0 / 2, cy0 = e0.y * H + h0 / 2;
    var tlx = cx0 + (-w0 / 2) * c - (-h0 / 2) * s, tly = cy0 + (-w0 / 2) * s + (-h0 / 2) * c, w1 = nw * W, h1 = nh * H;
    var cx1 = tlx + (w1 / 2) * c - (h1 / 2) * s, cy1 = tly + (w1 / 2) * s + (h1 / 2) * c;
    e.w = nw; e.h = nh; e.x = cx1 / W - nw / 2; e.y = cy1 / H - nh / 2;
  }

  function toBlob(canvas) {
    return new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
  }
  function download(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* Devuelve 'shared' | 'saved' | 'cancelled'. Usa el menú de compartir del móvil (ahí sale Instagram). */
  function share(canvas, text) {
    var name = '4timer-entreno.png', cap = root.Capacitor, P = cap && cap.Plugins;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
      var b64 = canvas.toDataURL('image/png').split(',')[1];
      return P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' }).then(function (f) {
        return P.Share.share({ title: '4TIMER', text: text, files: [f.uri], dialogTitle: 'Compartir entreno' });
      }).then(function () { return 'shared'; }).catch(function (e) { return /cancel/i.test(String(e && e.message)) ? 'cancelled' : 'error'; });
    }
    return toBlob(canvas).then(function (blob) {
      var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text }).then(function () { return 'shared'; })
          .catch(function (e) { if (e && e.name === 'AbortError') return 'cancelled'; download(blob, name); return 'saved'; });
      }
      download(blob, name); return 'saved';
    });
  }
  /* Envía o descarga un archivo de texto (GPX, programa…). Devuelve 'shared' | 'saved' | 'cancelled' | 'error'. */
  function file(name, text, mime, title) {
    var cap = root.Capacitor, P = cap && cap.Plugins;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
      return P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }).then(function (f) {
        return P.Share.share({ title: title || '4TIMER', files: [f.uri], dialogTitle: title || 'Enviar archivo' });
      }).then(function () { return 'shared'; }).catch(function (e) { return /cancel/i.test(String(e && e.message)) ? 'cancelled' : 'error'; });
    }
    download(new Blob([text], { type: mime || 'text/plain' }), name);
    return Promise.resolve('saved');
  }
  /* Guardar imagen: en el móvil va a la galería (álbum «4TIMER»); en el navegador se descarga. */
  function saveGallery(dataUrl, video) {
    var P = root.Capacitor && root.Capacitor.Plugins, M = P && P.Media;
    if (!M) return Promise.reject(new Error('no-media'));
    function put(album) {
      var o = { path: dataUrl, fileName: '4timer-' + Date.now() };
      if (album) o.albumIdentifier = album;
      return video ? M.saveVideo(o) : M.savePhoto(o);
    }
    return Promise.resolve().then(function () { return M.createAlbum({ name: '4TIMER' }); }).catch(function () {})
      .then(function () { return M.getAlbums(); })
      .then(function (r) { var a = (r && r.albums || []).filter(function (x) { return x.name === '4TIMER'; })[0]; return a ? a.identifier : null; })
      .catch(function () { return null; })
      .then(function (id) { return put(id).catch(function () { return put(null); }); });
  }
  function native() { var c = root.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.Media); }
  function save(canvas) {
    if (native()) {
      return saveGallery(canvas.toDataURL('image/png'), false).then(function () { return 'gallery'; }).catch(function () { return 'error'; });
    }
    return toBlob(canvas).then(function (b) { download(b, '4timer-entreno.png'); return 'saved'; });
  }


  /* ---------- Vídeo: todos los vídeos de la escena se reproducen a la vez y se graba la tarjeta entera ---------- */
  var VMIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  function videoMime() {
    var MR = root.MediaRecorder;
    if (!MR || !MR.isTypeSupported) return null;
    for (var i = 0; i < VMIMES.length; i++) if (MR.isTypeSupported(VMIMES[i])) return VMIMES[i];
    return null;
  }
  function videoSupported() { return !!(videoMime() && root.HTMLCanvasElement && root.HTMLCanvasElement.prototype.captureStream); }
  function videosOf(sc) { return sc.elements.filter(function (e) { return e.type === 'media' && e.media && e.media.kind === 'video'; }).map(function (e) { return e.media.el; }); }
  function masterVideo(sc) {                                       // el más largo manda en la duración y el audio
    var vs = videosOf(sc), best = null;
    vs.forEach(function (v) { if (!best || (v.duration || 0) > (best.duration || 0)) best = v; });
    return best;
  }
  /* Graba desde `start` hasta `start+maxSec` (opts: { onProgress(0..1), maxSec, start }) → Promise<{blob, mime, ext}> */
  function recordVideo(sc, opts) {
    opts = opts || {};
    var mime = videoMime(), video = masterVideo(sc), vids = videosOf(sc);
    if (!mime || !video) return Promise.reject(new Error('sin-soporte'));
    return fontsReady().then(function () { return prepMaps(sc); }).then(function () {
      return new Promise(function (resolve, reject) {
        var fm = FORMATS[sc.format] || FORMATS.story, scale = Math.min(1, 1280 / Math.max(fm.w, fm.h));
        var cv = root.document.createElement('canvas'); cv.width = Math.round(fm.w * scale); cv.height = Math.round(fm.h * scale);
        var ctx = cv.getContext('2d'), t0 = opts.start || 0, end = Math.min(video.duration || 60, t0 + (opts.maxSec || 60)), dur = Math.max(0.1, end - t0);
        var stream = cv.captureStream(30), rec, chunks = [], done = false, raf = 0;
        try {                                                   // audio del vídeo principal sin que suene por el altavoz (una sola vez por elemento)
          var AC = root.AudioContext || root.webkitAudioContext;
          if (AC) {
            if (!video.__dest) { var ac0 = new AC(); video.__dest = ac0.createMediaStreamDestination(); ac0.createMediaElementSource(video).connect(video.__dest); video.__ac = ac0; }
            if (video.__ac.state === 'suspended') video.__ac.resume();
            video.__dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
          }
        } catch (e) {}
        function pauseAll() { vids.forEach(function (v) { try { v.pause(); v.loop = false; } catch (e) {} }); }
        function finish(err) {
          if (done) return; done = true; cancelAnimationFrame(raf); pauseAll();
          if (err) reject(err);
        }
        try { rec = new root.MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 }); } catch (e) { return reject(e); }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function (e) { finish(e.error || new Error('grabacion')); };
        rec.onstop = function () {
          if (done && !chunks.length) return;
          var m = mime.split(';')[0]; done = true;
          resolve({ blob: new Blob(chunks, { type: m }), mime: m, ext: m.indexOf('mp4') >= 0 ? 'mp4' : 'webm' });
        };
        /* Lo que no es vídeo se dibuja UNA vez por tramo de capas; en cada fotograma solo se actualizan los vídeos (mucho más ligero en el móvil) */
        var layers = [], run = [], first = true;
        function flush() { if (!run.length && !first) return; var c = root.document.createElement('canvas'); c.width = cv.width; c.height = cv.height; drawScene(c.getContext('2d'), { format: sc.format, r: sc.r, logo: sc.logo, gymName: sc.gymName, elements: run }, { scale: scale, noBg: !first }); layers.push({ img: c }); run = []; first = false; }
        sc.elements.forEach(function (e) {
          if (e.type === 'media' && e.media && e.media.kind === 'video') { flush(); layers.push({ vid: e }); } else run.push(e);
        });
        if (run.length) flush();
        function paint() {
          layers.forEach(function (L) {
            if (L.img) ctx.drawImage(L.img, 0, 0);
            else { ctx.save(); ctx.scale(scale, scale); drawElement(ctx, sc, L.vid, fm.w, fm.h, {}); ctx.restore(); }
          });
        }
        var wall0 = 0, lastT = -1, lastAt = 0;
        function frame() {
          var nowW = root.performance.now(); if (!wall0) { wall0 = nowW; lastAt = nowW; }
          if (video.currentTime !== lastT) { lastT = video.currentTime; lastAt = nowW; }
          paint();
          if (nowW - lastAt > 5000 || nowW - wall0 > (dur + 8) * 1000) { try { rec.stop(); } catch (e) {} finish(); return; }   // el vídeo se atascó: se cierra lo grabado
          if (opts.onProgress) opts.onProgress(Math.max(0, Math.min(1, (video.currentTime - t0) / dur)));
          if (video.ended || video.currentTime >= end - 0.05) { try { rec.stop(); } catch (e) {} finish(); return; }
          raf = root.requestAnimationFrame(frame);
        }
        function go() {
          rec.start(500);
          var pl = video.play();
          vids.forEach(function (v) { if (v !== video) { try { v.play(); } catch (e) {} } });
          function begin() { raf = root.requestAnimationFrame(frame); }
          if (pl && pl.then) pl.then(begin, function () { video.muted = true; video.play().then(begin, function (e) { finish(e); try { rec.stop(); } catch (x) {} }); });
          else begin();
        }
        vids.forEach(function (v) { v.loop = v !== video; v.muted = v !== video; try { v.currentTime = v === video ? t0 : (v.duration ? t0 % v.duration : 0); } catch (e) {} });
        var started = false; function once() { if (started) return; started = true; video.removeEventListener('seeked', once); go(); }
        video.addEventListener('seeked', once); setTimeout(once, 600);
      });
    });
  }
  /* Instagram admite hasta 60 s por historia: un vídeo más largo se graba en partes de 60 s, una detrás de otra. → Promise<[{blob,mime,ext}]> */
  var PART_SEC = 60;
  function partsOf(video) { return Math.max(1, Math.ceil(((video && video.duration || PART_SEC) - 0.05) / PART_SEC)); }
  function recordVideoParts(sc, opts) {
    opts = opts || {};
    var n = partsOf(masterVideo(sc)), out = [], i = 0;
    function next() {
      if (i >= n) return Promise.resolve(out);
      var idx = i++;
      return recordVideo(sc, { start: idx * PART_SEC, maxSec: PART_SEC, onProgress: function (p) { if (opts.onProgress) opts.onProgress((idx + p) / n, idx + 1, n); } })
        .then(function (v) { out.push(v); return next(); });
    }
    return next();
  }
  function blobB64(blob) {
    return new Promise(function (res, rej) { var f = new root.FileReader(); f.onload = function () { res(String(f.result).split(',')[1]); }; f.onerror = rej; f.readAsDataURL(blob); });
  }
  function vname(v, i, n) { return '4timer-entreno' + (n > 1 ? '-parte' + (i + 1) : '') + '.' + v.ext; }
  /* Guarda el vídeo (o sus partes) en la galería (móvil) o lo descarga (navegador): 'gallery' | 'saved' | 'error' */
  function saveVideo(vs) {
    vs = [].concat(vs); var cap = root.Capacitor, P = cap && cap.Plugins;
    if (native() && P.Filesystem) {
      return vs.reduce(function (pr, v, i) {
        return pr.then(function () { return blobB64(v.blob).then(function (b64) { return P.Filesystem.writeFile({ path: vname(v, i, vs.length), data: b64, directory: 'CACHE' }); }).then(function (f) { return saveGallery(f.uri, true); }); });
      }, Promise.resolve()).then(function () { return 'gallery'; }).catch(function () { return 'error'; });
    }
    vs.forEach(function (v, i) { setTimeout(function () { download(v.blob, vname(v, i, vs.length)); }, i * 700); });
    return Promise.resolve('saved');
  }
  function shareVideo(vs, text) {
    vs = [].concat(vs); var cap = root.Capacitor, P = cap && cap.Plugins;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
      return vs.reduce(function (pr, v, i) {
        return pr.then(function (uris) { return blobB64(v.blob).then(function (b64) { return P.Filesystem.writeFile({ path: vname(v, i, vs.length), data: b64, directory: 'CACHE' }); }).then(function (f) { return uris.concat(f.uri); }); });
      }, Promise.resolve([])).then(function (uris) { return P.Share.share({ title: '4TIMER', text: text, files: uris, dialogTitle: 'Compartir vídeo' }); })
        .then(function () { return 'shared'; }).catch(function (e) { return /cancel/i.test(String(e && e.message)) ? 'cancelled' : 'error'; });
    }
    var files = []; try { files = vs.map(function (v, i) { return new File([v.blob], vname(v, i, vs.length), { type: v.mime }); }); } catch (e) {}
    if (files.length && navigator.canShare && navigator.canShare({ files: files })) {
      return navigator.share({ files: files, text: text }).then(function () { return 'shared'; })
        .catch(function (e) { if (e && e.name === 'AbortError') return 'cancelled'; return saveVideo(vs); });
    }
    return saveVideo(vs);
  }

  root.Share = { FORMATS: FORMATS, TEMPLATES: TEMPLATES, STYLES: STYLES, TYPE_LABEL: TYPE_LABEL, makeScene: makeScene, newElement: newElement, mediaOf: mediaOf, render: render, renderThumb: renderThumb, drawScene: drawScene, hitTest: hitTest, handleHit: handleHit, resizeBy: resizeBy, share: share, save: save, recordVideo: recordVideo, recordVideoParts: recordVideoParts, masterVideo: masterVideo, videosOf: videosOf, partsOf: partsOf, videoSupported: videoSupported, saveVideo: saveVideo, shareVideo: shareVideo, saveGallery: saveGallery, native: native, file: file, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
