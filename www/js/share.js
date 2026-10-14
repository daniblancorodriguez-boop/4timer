/* 4TIMER — tarjeta para compartir (Instagram, etc.) y envío con el menú de compartir del móvil */
(function (root) {
  'use strict';
  var FORMATS = {
    story: { w: 1080, h: 1920, label: 'Story' },
    post: { w: 1080, h: 1350, label: 'Post' },
    land: { w: 1920, h: 1080, label: 'Horizontal' }
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
  function imgSize(img) { return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }; }
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
  function drawStat(ctx, r, x, y, w, u, digitsH) {
    var h = 56 + digitsH + 44;
    ctx.save(); rr(ctx, x, y, w, h, 30); ctx.fillStyle = 'rgba(0,0,0,.74)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke(); ctx.restore();
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
  function background(ctx, o, W, H) {
    ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, W, H);
    if (o.photo) {
      cover(ctx, o.photo, 0, 0, W, H);
      var top = ctx.createLinearGradient(0, 0, 0, 360); top.addColorStop(0, 'rgba(0,0,0,.65)'); top.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, 360);
      var bot = ctx.createLinearGradient(0, H * 0.3, 0, H); bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(0.55, 'rgba(0,0,0,.78)'); bot.addColorStop(1, 'rgba(0,0,0,.93)');
      ctx.fillStyle = bot; ctx.fillRect(0, H * 0.3, W, H * 0.7);
    } else {
      var g = ctx.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.2, H * 0.25, W * 0.9);
      g.addColorStop(0, 'rgba(255,45,45,.16)'); g.addColorStop(1, 'rgba(255,45,45,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(W * 0.9, H * 0.7, 0, W * 0.9, H * 0.7, W * 0.9);
      g2.addColorStop(0, 'rgba(58,116,255,.14)'); g2.addColorStop(1, 'rgba(58,116,255,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    }
  }
  function drawBoard(ctx, img, x, y, w, h) {
    var bs = imgSize(img), bk = Math.min(w / bs.w, h / bs.h), bw = bs.w * bk, bh = bs.h * bk, bx = x + (w - bw) / 2, by = y + (h - bh) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = '#000'; rr(ctx, bx, by, bw, bh, 26); ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, bx, by, bw, bh, 26); ctx.clip(); ctx.drawImage(img, bx, by, bw, bh); ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.28)'; rr(ctx, bx, by, bw, bh, 26); ctx.stroke();
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

  /* o: { format:'story'|'post'|'land', style:'std'|'logo', photo, board, logo, gymName, showExercises,
          r: {modeName, name, kind:'rounds'|'time'|'text', value, sub, label, pr, lines:[{num, parts:[{qty,name}], note}], date} } */
  function render(canvas, o) {
    return fontsReady().then(function () {
      var r0 = o.r, wantMap = r0.kind === 'run' && o.map && r0.route && r0.route.length > 1 && !o.board && root.RunMap;
      if (!wantMap) return doRender(canvas, o, null);
      var probe = {}; doRender(root.document.createElement('canvas'), o, null, probe);       // 1.ª pasada: solo mide el hueco del recorrido
      if (!probe.w) return doRender(canvas, o, null);
      return root.RunMap.render(r0.route, probe.w, probe.h).then(function (m) { return doRender(canvas, o, m.loaded ? m : null); });
    });
  }
  function doRender(canvas, o, mapPre, probe) {
    {
      var fmtDef = FORMATS[o.format] || FORMATS.story, W = fmtDef.w, H = fmtDef.h, land = W > H, pad = 64, cw = W - pad * 2;
      var big = o.style === 'logo';
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d'), r = o.r;
      ctx.textBaseline = 'alphabetic';
      background(ctx, o, W, H);

      // ----- fila superior: logo del gimnasio (izq.) y marca 4TIMER (dcha.) -----
      var logoH = big ? (land ? 220 : 300) : (land ? 112 : 132), logoMaxW = big ? (land ? 620 : 600) : 400, wm = big ? 66 : (land ? 80 : 92);
      if (o.logo) {
        var ls = imgSize(o.logo), k = Math.min(logoMaxW / ls.w, logoH / ls.h), lw = ls.w * k, lh = ls.h * k;
        ctx.save(); rr(ctx, pad, pad, lw, lh, 22); ctx.clip(); ctx.fillStyle = '#000'; ctx.fillRect(pad, pad, lw, lh);
        ctx.drawImage(o.logo, pad, pad, lw, lh); ctx.restore();
      } else if (o.gymName) {
        ctx.font = '800 italic ' + (big ? 96 : 64) + 'px ' + F; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(o.gymName, pad, pad + (big ? 110 : 70));
      }
      var wmY = big ? pad + logoH / 2 + wm * 0.36 : pad + 96 * wm / 92;
      ctx.textAlign = 'right'; ctx.font = '800 italic ' + wm + 'px ' + F;
      var tw = ctx.measureText('TIMER').width; ctx.fillStyle = '#fff'; ctx.fillText('TIMER', W - pad, wmY);
      ctx.lineWidth = Math.max(3, wm / 23); ctx.strokeStyle = ORANGE; ctx.lineJoin = 'round';
      ctx.strokeText('4', W - pad - tw - 4, wmY);
      ctx.textAlign = 'left';
      var topLimit = pad + logoH + 40;

      var routeBoard = r.kind === 'run' && r.route && r.route.length > 1 && !o.board, hasBoard = !!(o.board || routeBoard);
      function drawB(x, y, w, h) { if (routeBoard) { if (probe) { probe.w = Math.round(w); probe.h = Math.round(h); } drawRoute(ctx, r.route, x, y, w, h, mapPre); } else drawBoard(ctx, o.board, x, y, w, h); }
      var exAll = (o.showExercises && r.lines) ? r.lines : [];
      var chipH = 60, gap = 26, lineH = 62, footY = H - pad;

      function footer() {
        ctx.font = '600 38px ' + F; ctx.fillStyle = MUTED; ctx.textAlign = 'left'; ctx.fillText(r.date, pad, footY);
        ctx.textAlign = 'right'; ctx.fillText('Hecho con 4TIMER', W - pad, footY); ctx.textAlign = 'left';
      }
      function chip(y) {
        ctx.font = '800 italic 38px ' + F;
        var chipW = ctx.measureText(r.modeName).width + 44;
        ctx.fillStyle = ORANGE; rr(ctx, pad, y, chipW, chipH, chipH / 2); ctx.fill();
        ctx.fillStyle = '#1b1203'; ctx.fillText(r.modeName, pad + 22, y + 42);
        if (r.pr) drawPR(ctx, pad + chipW + 16, y, chipH);
      }

      // ================= HORIZONTAL 16:9 =================
      if (land) {
        var colW = 880, rx = pad + colW + 70, rw = W - pad - rx;
        var y0 = topLimit - 10;
        chip(y0);
        var ty = y0 + chipH + gap / 2, tf = '800 italic 88px ' + F;
        ctx.font = tf; ctx.fillStyle = '#fff';
        var tl = wrap(ctx, r.name, colW, 2);
        tl.forEach(function (t, i) { ctx.fillText(t, pad, ty + 78 + i * 90); });
        var ly = ty + tl.length * 90 + 24, lroom = footY - 70 - ly;
        if (hasBoard && lroom > 160) drawB(pad, ly, colW, lroom);
        else {
          var maxE = Math.max(0, Math.min(9, Math.floor(lroom / lineH))), sh = exAll.slice(0, maxE), mo = exAll.length - sh.length;
          if (mo > 0 && sh.length > 1) { sh = sh.slice(0, sh.length - 1); mo = exAll.length - sh.length; } else if (mo > 0) { sh = []; mo = 0; }
          sh.forEach(function (ln, i) { drawExercise(ctx, ln, pad, ly + 44 + i * lineH, colW); });
          if (mo > 0) { ctx.font = 'italic 600 40px ' + F; ctx.fillStyle = MUTED; ctx.fillText('+ ' + mo + ' más', pad, ly + 44 + sh.length * lineH); }
        }
        // marcador a la derecha, centrado en vertical
        var probe = r.kind === 'rounds' ? '00' : r.kind === 'run' ? '00.00' : '00:00', uu = Math.min(3.6, (rw - 76) / root.LED.measure(probe, 1)), dH = 96 * uu, stH = 56 + dH + 44;
        var areaTop = topLimit - 10, areaH = footY - 70 - areaTop, sy = areaTop + Math.max(0, (areaH - stH - 70) / 2);
        drawStat(ctx, r, rx, sy, rw, uu, dH);
        ctx.font = '700 46px ' + F; ctx.fillStyle = '#e9e9ec'; ctx.textAlign = 'center';
        ctx.fillText(r.sub || '', rx + rw / 2, sy + stH + 56); ctx.textAlign = 'left';
        footer();
        return canvas;
      }

      // ================= VERTICAL (story / post) =================
      var u = (hasBoard && H < 1500) ? 1.9 : 2.6, digitsH = 96 * u, statH = 56 + digitsH + 44, subH = 64, footerH = 70;
      var titleFont = '800 italic 98px ' + F;
      ctx.font = titleFont;
      var titleLines = wrap(ctx, r.name, cw, 2), titleH = titleLines.length * 100 + 14;
      var fixed = footerH + subH + statH + gap + titleH + chipH + gap + gap;
      var room = H - pad - topLimit - fixed - gap;
      var boardMin = hasBoard ? (H > 1500 ? 560 : 400) : 0;
      var maxEx = Math.max(0, Math.min(9, Math.floor((room - boardMin) / lineH)));
      var shown = exAll.slice(0, maxEx), more = exAll.length - shown.length;
      if (more > 0 && shown.length) { shown = shown.slice(0, shown.length - 1); more = exAll.length - shown.length; }
      if (!shown.length || (hasBoard && more > 0 && shown.length < 2)) { shown = []; more = 0; }   // sin hueco: mejor no mostrar una lista a medias
      var exH = shown.length ? shown.length * lineH + (more > 0 ? lineH : 0) + gap : 0;
      var y = H - pad - (fixed + exH);

      if (hasBoard) { var bh2 = y - 30 - topLimit; if (bh2 > 160) drawB(pad, topLimit, cw, bh2); }

      chip(y); y += chipH + gap / 2;
      ctx.font = titleFont; ctx.fillStyle = '#fff';
      titleLines.forEach(function (t, i) { ctx.fillText(t, pad, y + 88 + i * 100); });
      y += titleH + gap / 2;
      drawStat(ctx, r, pad, y, cw, u, digitsH);
      y += statH + 14;
      ctx.font = '700 44px ' + F; ctx.fillStyle = '#e9e9ec'; ctx.textAlign = 'center';
      ctx.fillText(r.sub || '', W / 2, y + 40); ctx.textAlign = 'left';
      y += subH - 14 + gap / 2;
      shown.forEach(function (ln, i) { drawExercise(ctx, ln, pad, y + 44 + i * lineH, cw); });
      if (more > 0) { ctx.font = 'italic 600 40px ' + F; ctx.fillStyle = MUTED; ctx.fillText('+ ' + more + ' más', pad, y + 44 + shown.length * lineH); }
      footer();
      return canvas;
    }
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
  function save(canvas) { return toBlob(canvas).then(function (b) { download(b, '4timer-entreno.png'); return 'saved'; }); }

  root.Share = { FORMATS: FORMATS, render: render, share: share, save: save, file: file, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
