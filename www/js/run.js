/* 4TIMER — lógica de running (sin interfaz): seguimiento GPS, GPX/TCX/FIT, series y programas por semanas.
   Todo aquí es puro y se prueba en Node. La pantalla está en runui.js. */
(function (root) {
  'use strict';
  var EARTH = 6371000;
  function rad(d) { return d * Math.PI / 180; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* Distancia en metros entre dos puntos {lat, lon} (haversine) */
  function hav(a, b) {
    var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var s = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* ---------- formatos ---------- */
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }
  function fmtPace(secPerKm) {            // 'M:SS' (o '--:--' si no hay dato)
    if (!isFinite(secPerKm) || secPerKm <= 0 || secPerKm >= 3600) return '--:--';
    var s = Math.round(secPerKm);
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }
  function fmtKm(m) { return (m / 1000).toFixed(2).replace('.', ','); }
  function fmtStepValue(kind, value) {
    if (kind === 'dist') return value >= 1000 ? (value % 1000 === 0 ? value / 1000 : (value / 1000).toString().replace('.', ',')) + ' km' : value + ' m';
    var m = Math.floor(value / 60), s = value % 60;
    return s ? (m ? m + "'" : '') + pad(s) + '"' : m + "'";
  }

  /* ---------- seguimiento GPS ---------- */
  /* p = {lat, lon, t (ms), acc (m), alt}. Descarta puntos imprecisos y saltos imposibles, ignora el temblor
     parado, calcula distancia, parciales por km y ritmo, y puede pausarse sola al detenerte. */
  function Tracker(opts) {
    this.o = Object.assign({ maxAcc: 35, maxSpeed: 12, minMove: 2, autoPause: false, pauseSpeed: 0.7, resumeSpeed: 1.0, pauseAfter: 6 }, opts || {});
    this.reset();
  }
  Tracker.prototype.reset = function () {
    this.startT = null; this.offset = 0; this.points = []; this.dist = 0;
    this.last = null; this.lastPos = null; this.splits = [];
    this.manual = false; this.auto = false; this.pauseStart = null; this.slowFor = 0;
    this.acc = null; this.nextKm = 1000; this.lastSplitEt = 0;
  };
  Tracker.prototype.begin = function (t) { if (this.startT === null) this.startT = t; };
  Tracker.prototype._push = function (p, d) {
    var et = p.t - this.offset - this.startT, prev = this.points[this.points.length - 1], prevD = this.dist - d;
    this.points.push({ lat: p.lat, lon: p.lon, alt: p.alt == null ? null : p.alt, t: p.t, et: et, d: this.dist });
    if (prev && d > 0) {
      while (this.dist >= this.nextKm) {
        var f = (this.nextKm - prevD) / d, ce = prev.et + f * (et - prev.et), sec = (ce - this.lastSplitEt) / 1000;
        this.splits.push({ km: this.nextKm / 1000, sec: sec });
        this.lastSplitEt = ce; this.nextKm += 1000;
      }
    }
  };
  Tracker.prototype.add = function (p) {
    if (this.startT === null) this.startT = p.t;
    this.acc = p.acc == null ? null : p.acc;
    if (p.acc != null && p.acc > this.o.maxAcc) return 'acc';
    var cur = { lat: p.lat, lon: p.lon, t: p.t, alt: p.alt };
    var lp = this.lastPos;
    if (!lp) {                                         // primer punto (o primero tras una pausa manual)
      this.lastPos = cur; this.last = cur;
      if (!this.manual && !this.auto) this._push(p, 0);
      return 'first';
    }
    var step = (p.t - lp.t) / 1000;
    if (step <= 0) return 'time';
    var vInst = hav(lp, p) / step;
    if (vInst > this.o.maxSpeed) return 'jump';
    this.lastPos = cur;

    if (this.o.autoPause && !this.manual) {
      if (!this.auto) {
        if (vInst < this.o.pauseSpeed) {
          this.slowFor += step;
          if (this.slowFor >= this.o.pauseAfter) { this.auto = true; this.pauseStart = p.t - this.slowFor * 1000; }
        } else this.slowFor = 0;
      } else if (vInst >= this.o.resumeSpeed) {
        this.offset += p.t - this.pauseStart; this.auto = false; this.pauseStart = null; this.slowFor = 0;
        this.last = cur; this._push(p, 0);
        return 'resumed';
      }
    }
    if (this.manual || this.auto) { this.last = cur; return 'paused'; }

    var d = hav(this.last, p);
    if (d < this.o.minMove) return 'still';
    this.dist += d; this._push(p, d); this.last = cur;
    return 'ok';
  };
  Tracker.prototype.pause = function (t) {
    if (this.manual) return;
    if (!this.auto) this.pauseStart = t;
    this.manual = true;
  };
  Tracker.prototype.resume = function (t) {
    if (!this.manual) return;
    this.manual = false;
    if (!this.auto) { this.offset += t - this.pauseStart; this.pauseStart = null; }
    this.last = null; this.lastPos = null; this.slowFor = 0;
  };
  /* Hueco largo en un archivo importado (el reloj estuvo en pausa): no cuenta tiempo ni distancia */
  Tracker.prototype.gap = function (ms) { this.offset += ms; this.last = null; this.lastPos = null; };
  Tracker.prototype.paused = function () { return this.manual || this.auto; };
  Tracker.prototype.movingMs = function (now) {
    if (this.startT === null) return 0;
    var ref = this.paused() ? this.pauseStart : now;
    return Math.max(0, ref - this.startT - this.offset);
  };
  Tracker.prototype.avgPace = function (now) {
    return this.dist >= 20 ? this.movingMs(now) / 1000 / (this.dist / 1000) : null;
  };
  /* Ritmo actual: últimos 20 s de movimiento; sin dato si estás parado o hay poca señal */
  Tracker.prototype.curPace = function (now) {
    var pts = this.points, n = pts.length;
    if (n < 2 || this.paused()) return null;
    var lastP = pts[n - 1];
    if (this.movingMs(now) - lastP.et > 10000) return null;
    var i = n - 1;
    while (i > 0 && lastP.et - pts[i - 1].et <= 20000) i--;
    var dd = lastP.d - pts[i].d, dt = (lastP.et - pts[i].et) / 1000;
    if (dd < 5 || dt < 4) return null;
    return dt / (dd / 1000);
  };

  /* ---------- simplificar y recortar el recorrido ---------- */
  function project(pts) {
    var lat0 = pts[0].lat, lon0 = pts[0].lon, k = Math.cos(rad(lat0));
    return pts.map(function (p) { return { x: (p.lon - lon0) * k * 111320, y: (p.lat - lat0) * 110540 }; });
  }
  function simplify(points, tolM, maxPts) {      // Ramer–Douglas–Peucker; devuelve índices conservados
    var n = points.length; if (n <= 2) return points.map(function (_, i) { return i; });
    var xy = project(points), keep = new Array(n), stack = [[0, n - 1]], i;
    for (i = 0; i < n; i++) keep[i] = false; keep[0] = keep[n - 1] = true;
    while (stack.length) {
      var s = stack.pop(), a = xy[s[0]], b = xy[s[1]], dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy), best = -1, bi = -1;
      for (i = s[0] + 1; i < s[1]; i++) {
        var dist = len === 0 ? Math.hypot(xy[i].x - a.x, xy[i].y - a.y) : Math.abs(dy * xy[i].x - dx * xy[i].y + b.x * a.y - b.y * a.x) / len;
        if (dist > best) { best = dist; bi = i; }
      }
      if (best > tolM && bi > -1) { keep[bi] = true; stack.push([s[0], bi], [bi, s[1]]); }
    }
    var idx = []; for (i = 0; i < n; i++) if (keep[i]) idx.push(i);
    if (maxPts && idx.length > maxPts) {
      var out = [], step = (idx.length - 1) / (maxPts - 1);
      for (i = 0; i < maxPts; i++) out.push(idx[Math.round(i * step)]);
      idx = out;
    }
    return idx;
  }
  /* route = [[lat, lon, etSeg, alt]]; quita los primeros y últimos `m` metros (privacidad: casa, portal…) */
  function trimRoute(route, m) {
    if (!route || route.length < 2) return [];
    var cum = [0], i;
    for (i = 1; i < route.length; i++) cum.push(cum[i - 1] + hav({ lat: route[i - 1][0], lon: route[i - 1][1] }, { lat: route[i][0], lon: route[i][1] }));
    var total = cum[cum.length - 1];
    if (total < m * 2 + 200) return [];
    return route.filter(function (_, j) { return cum[j] >= m && total - cum[j] >= m; });
  }

  /* ---------- mejores marcas dentro de una carrera (1 km, 5 km, 10 km…) ---------- */
  function bestEfforts(pts, targets) {
    var out = {};
    targets.forEach(function (T) {
      var best = Infinity, i = 0;
      for (var j = 0; j < pts.length; j++) {
        if (pts[j].d < T) continue;
        var target = pts[j].d - T;
        while (i + 1 < pts.length && pts[i + 1].d <= target) i++;
        var a = pts[i], b = pts[i + 1] || a, f = b.d > a.d ? (target - a.d) / (b.d - a.d) : 0;
        var t = pts[j].et - (a.et + f * (b.et - a.et));
        if (t < best) best = t;
      }
      if (best < Infinity) out[T] = Math.round(best / 1000);
    });
    return out;
  }

  /* Resumen listo para guardar */
  function summarize(tr, now) {
    var distance = Math.round(tr.dist), sec = Math.round(tr.movingMs(now) / 1000), splits = tr.splits.map(function (s) { return { km: s.km, sec: Math.round(s.sec) }; });
    var rest = tr.dist - (tr.nextKm - 1000);
    if (rest >= 100) {                                    // último trozo (parcial)
      var psec = (tr.movingMs(now) - tr.lastSplitEt) / 1000;
      splits.push({ km: Math.round(tr.dist / 10) / 1000, sec: Math.round(psec), partial: true, dist: Math.round(rest) });
    }
    var idx = tr.points.length ? simplify(tr.points, 3, 600) : [];
    var route = idx.map(function (i) { var p = tr.points[i]; return [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6, Math.round(p.et / 1000), p.alt == null ? null : Math.round(p.alt)]; });
    return {
      distance: distance, sec: sec, avgPace: tr.dist >= 20 ? Math.round(sec / (tr.dist / 1000)) : 0,
      splits: splits, route: route, efforts: bestEfforts(tr.points, [1000, 5000, 10000, 21097])
    };
  }

  /* Puntos de un archivo → resumen (mismos cálculos que en una carrera en vivo) */
  function fromPoints(pts, o) {
    o = o || {};
    var tr = new Tracker({ maxAcc: 1e9, maxSpeed: 15, minMove: 1.5 });
    if (!pts.length) return null;
    tr.begin(pts[0].t);
    var prev = null;
    pts.forEach(function (p) {
      if (prev && p.t - prev.t > 60000 && hav(prev, p) / ((p.t - prev.t) / 1000) < 1) tr.gap(p.t - prev.t - 1000);   // hueco largo y sin moverse = pausa del reloj
      tr.add({ lat: p.lat, lon: p.lon, t: p.t, alt: p.alt });
      prev = p;
    });
    var end = pts[pts.length - 1].t;
    var sum = summarize(tr, end);
    if (o.timerSec && Math.abs(o.timerSec - sum.sec) < sum.sec * 0.25) {   // el reloj sabe mejor cuánto estuviste en marcha
      sum.sec = Math.round(o.timerSec);
      sum.avgPace = sum.distance >= 20 ? Math.round(sum.sec / (sum.distance / 1000)) : 0;
    }
    sum.startT = pts[0].t;
    return sum;
  }

  /* ---------- archivos: GPX, TCX, FIT ---------- */
  function xmlEsc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
  function buildGPX(rec) {
    var start = rec.startT || rec.ts || Date.now(), out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="4TIMER" xmlns="http://www.topografix.com/GPX/1/1">',
      '<metadata><name>' + xmlEsc(rec.name || 'Carrera') + '</name><time>' + new Date(start).toISOString() + '</time></metadata>',
      '<trk><name>' + xmlEsc(rec.name || 'Carrera') + '</name><type>running</type><trkseg>'];
    (rec.route || []).forEach(function (p) {
      out.push('<trkpt lat="' + p[0] + '" lon="' + p[1] + '">' + (p[3] != null ? '<ele>' + p[3] + '</ele>' : '') + '<time>' + new Date(start + p[2] * 1000).toISOString() + '</time></trkpt>');
    });
    out.push('</trkseg></trk></gpx>');
    return out.join('\n');
  }
  function num(s) { var v = parseFloat(s); return isFinite(v) ? v : null; }
  function parseGPX(text) {
    var pts = [], re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g, m;
    while ((m = re.exec(text))) {
      var lat = /lat\s*=\s*"([^"]+)"/.exec(m[1]), lon = /lon\s*=\s*"([^"]+)"/.exec(m[1]), tm = /<time>\s*([^<]+?)\s*<\/time>/.exec(m[2]), el = /<ele>\s*([^<]+?)\s*<\/ele>/.exec(m[2]);
      if (!lat || !lon || !tm) continue;
      var t = Date.parse(tm[1]); if (!isFinite(t)) continue;
      pts.push({ lat: num(lat[1]), lon: num(lon[1]), t: t, alt: el ? num(el[1]) : null });
    }
    var nm = /<trk>[\s\S]*?<name>\s*([^<]*?)\s*<\/name>/.exec(text);
    if (!pts.length) throw new Error('El archivo GPX no tiene puntos con hora.');
    return { points: pts, name: nm ? nm[1] : '', format: 'GPX' };
  }
  function parseTCX(text) {
    var pts = [], re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g, m, g = function (s, tag) { var r = new RegExp('<' + tag + '>\\s*([^<]+?)\\s*</' + tag + '>').exec(s); return r ? r[1] : null; };
    while ((m = re.exec(text))) {
      var lat = g(m[1], 'LatitudeDegrees'), lon = g(m[1], 'LongitudeDegrees'), tm = g(m[1], 'Time');
      if (lat === null || lon === null || !tm) continue;
      var t = Date.parse(tm); if (!isFinite(t)) continue;
      pts.push({ lat: num(lat), lon: num(lon), t: t, alt: num(g(m[1], 'AltitudeMeters')) });
    }
    var timer = 0, tt = /<TotalTimeSeconds>\s*([^<]+?)\s*<\/TotalTimeSeconds>/g, r2;
    while ((r2 = tt.exec(text))) timer += num(r2[1]) || 0;
    if (!pts.length) throw new Error('El archivo TCX no tiene puntos con posición.');
    return { points: pts, name: '', format: 'TCX', timerSec: timer || null };
  }
  /* FIT (Garmin y compatibles): decodificador mínimo de mensajes «record» (20) y «session» (18) */
  function parseFIT(buf) {
    var dv = new DataView(buf), n = buf.byteLength;
    if (n < 14) throw new Error('Archivo FIT demasiado corto.');
    var hdr = dv.getUint8(0), dataSize = dv.getUint32(4, true);
    if (String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== '.FIT') throw new Error('Esto no es un archivo FIT.');
    var pos = hdr, end = Math.min(n, hdr + dataSize), defs = {}, pts = [], session = null, lastTs = 0, FIT_EPOCH = 631065600000;
    function rd(p, size, type, le) {
      switch (type & 0x1f) {
        case 1: return dv.getInt8(p);
        case 3: return dv.getInt16(p, le);
        case 4: case 11: return dv.getUint16(p, le);
        case 5: return dv.getInt32(p, le);
        case 6: case 12: return dv.getUint32(p, le);
        case 0: case 2: case 10: case 13: return dv.getUint8(p);
        default: return null;
      }
    }
    function readMsg(def, ts) {
      var f = {}, p = pos;
      def.fields.forEach(function (fd) {
        f[fd.num] = (fd.size === 1 || fd.size === 2 || fd.size === 4) ? rd(p, fd.size, fd.type, def.le) : null;
        p += fd.size;
      });
      pos = p + def.devSize;
      if (ts != null) f[253] = ts;
      return f;
    }
    while (pos < end) {
      var h = dv.getUint8(pos++), def, msg;
      if (h & 0x80) {
        def = defs[(h >> 5) & 3]; if (!def) throw new Error('FIT dañado.');
        var off = h & 0x1f, base = lastTs & 0xFFFFFFE0, ts = base + off; if (off < (lastTs & 0x1f)) ts += 0x20;
        lastTs = ts; msg = readMsg(def, ts);
      } else if (h & 0x40) {
        var local = h & 0x0f, hasDev = (h & 0x20) !== 0;
        pos++; var le = dv.getUint8(pos++) === 0, gnum = dv.getUint16(pos, le); pos += 2;
        var nf = dv.getUint8(pos++), fields = [], i;
        for (i = 0; i < nf; i++) { fields.push({ num: dv.getUint8(pos), size: dv.getUint8(pos + 1), type: dv.getUint8(pos + 2) }); pos += 3; }
        var devSize = 0;
        if (hasDev) { var nd = dv.getUint8(pos++); for (i = 0; i < nd; i++) { devSize += dv.getUint8(pos + 1); pos += 3; } }
        defs[local] = { le: le, gnum: gnum, fields: fields, devSize: devSize };
        continue;
      } else {
        def = defs[h & 0x0f]; if (!def) throw new Error('FIT dañado.');
        msg = readMsg(def, null);
        if (msg[253] != null) lastTs = msg[253];
      }
      if (def.gnum === 20) {
        var la = msg[0], lo = msg[1];
        if (la == null || lo == null || la === 0x7FFFFFFF || lo === 0x7FFFFFFF || msg[253] == null) continue;
        pts.push({ lat: la * 180 / 2147483648, lon: lo * 180 / 2147483648, t: FIT_EPOCH + msg[253] * 1000,
          alt: msg[2] != null && msg[2] !== 0xFFFF ? msg[2] / 5 - 500 : null, hr: msg[3] != null && msg[3] !== 255 ? msg[3] : null });
      } else if (def.gnum === 18) {
        session = { timerSec: msg[8] != null && msg[8] !== 0xFFFFFFFF ? msg[8] / 1000 : null, distance: msg[9] != null && msg[9] !== 0xFFFFFFFF ? msg[9] / 100 : null,
          startT: msg[2] != null ? FIT_EPOCH + msg[2] * 1000 : null };
      }
    }
    if (!pts.length) throw new Error('El FIT no tiene posiciones GPS (¿actividad en cinta o sin GPS?).');
    return { points: pts, name: '', format: 'FIT', timerSec: session && session.timerSec, session: session };
  }
  /* Detecta el formato por el contenido y devuelve {points, name, timerSec, format} */
  function parseFile(name, buf) {
    var bytes = new Uint8Array(buf), isFit = bytes.length > 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === '.FIT';
    if (isFit) return parseFIT(buf);
    var text = new TextDecoder('utf-8').decode(bytes);
    if (/<TrainingCenterDatabase/i.test(text) || /\.tcx$/i.test(name)) return parseTCX(text);
    if (/<gpx/i.test(text) || /\.gpx$/i.test(name)) return parseGPX(text);
    throw new Error('Formato no reconocido. Usa un archivo GPX, TCX o FIT.');
  }

  /* ---------- series de running ---------- */
  var LEVELS = [
    { id: 0, name: 'Andar' }, { id: 1, name: 'Suave' }, { id: 2, name: 'Medio' }, { id: 3, name: 'Fuerte' }, { id: 4, name: 'Sprint' }
  ];
  function levelName(l) { return (LEVELS[l] || LEVELS[1]).name; }
  /* El sonido de cada cambio depende de la intensidad: suave/andar, medio, fuerte/sprint */
  function levelEvent(l) { return l <= 1 ? 'lvl1' : l === 2 ? 'lvl2' : 'lvl3'; }

  /* items: [{t:'step', kind:'time'|'dist', value, level, note} | {t:'repeat', rounds, steps:[step…]}] → lista plana */
  function flatten(items) {
    var out = [];
    items.forEach(function (it) {
      if (it.t === 'repeat') {
        for (var r = 1; r <= it.rounds; r++) it.steps.forEach(function (s) { out.push({ kind: s.kind, value: s.value, level: s.level, note: s.note || '', round: it.rounds > 1 ? r + '/' + it.rounds : '' }); });
      } else out.push({ kind: it.kind, value: it.value, level: it.level, note: it.note || '', round: '' });
    });
    return out;
  }
  function stepLabel(s) { return levelName(s.level) + ' · ' + fmtStepValue(s.kind, s.value) + (s.note ? ' (' + s.note + ')' : ''); }
  function describeItem(it) {
    if (it.t === 'repeat') return it.rounds + ' × [' + it.steps.map(function (s) { return fmtStepValue(s.kind, s.value) + ' ' + levelName(s.level).toLowerCase() + (s.note ? ' ' + s.note : ''); }).join(' + ') + ']';
    return fmtStepValue(it.kind, it.value) + ' ' + levelName(it.level).toLowerCase() + (it.note ? ' (' + it.note + ')' : '');
  }

  /* Motor: avanza por tiempo (segundos en marcha) o por distancia (metros) sin acumular errores */
  function Engine(steps) {
    this.steps = steps; this.idx = 0; this.startSec = 0; this.startDist = 0;
  }
  Engine.prototype.update = function (sec, dist) {
    var changed = [];
    while (this.idx < this.steps.length) {
      var s = this.steps[this.idx];
      if (s.kind === 'time') {
        if (sec - this.startSec < s.value) break;
        this.startSec += s.value; this.startDist = dist;
      } else {
        if (dist - this.startDist < s.value) break;
        this.startDist += s.value; this.startSec = sec;
      }
      this.idx++; changed.push(this.idx);
    }
    return changed;
  };
  Engine.prototype.done = function () { return this.idx >= this.steps.length; };
  Engine.prototype.current = function () { return this.steps[this.idx] || null; };
  Engine.prototype.next = function () { return this.steps[this.idx + 1] || null; };
  Engine.prototype.remaining = function (sec, dist) {
    var s = this.current(); if (!s) return 0;
    return s.kind === 'time' ? Math.max(0, s.value - (sec - this.startSec)) : Math.max(0, s.value - (dist - this.startDist));
  };
  Engine.prototype.progress = function (sec, dist) {
    var s = this.current(); if (!s) return 1;
    return Math.min(1, 1 - this.remaining(sec, dist) / s.value);
  };
  /* Avisos conocidos de antemano (cadena de pasos por tiempo): se programan en el reloj de audio.
     [{key, atSec, ev}] dentro de `look` segundos. Los pasos por distancia avisan al detectarse el cambio. */
  Engine.prototype.cues = function (sec, look) {
    var out = [], i = this.idx, t = this.startSec;
    while (i < this.steps.length && this.steps[i].kind === 'time') {
      var s = this.steps[i], endT = t + s.value;
      if (endT > sec + look + 3) break;
      if (s.value > 3) for (var r = 3; r >= 1; r--) out.push({ key: i + ':c' + r, atSec: endT - r, ev: 'countdown' });
      var nx = this.steps[i + 1];
      out.push({ key: i + ':end', atSec: endT, ev: nx ? levelEvent(nx.level) : 'end' });
      t = endT; i++;
    }
    return out.filter(function (c) { return c.atSec <= sec + look; });
  };
  function totals(steps) {
    var sec = 0, dist = 0; steps.forEach(function (s) { if (s.kind === 'time') sec += s.value; else dist += s.value; });
    return { sec: sec, dist: dist };
  }

  /* ---------- programas por semanas: validar, limpiar, exportar, importar ---------- */
  function isInt(v, lo, hi) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi; }
  function str(v, max) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
  function checkStep(s, where) {
    if (!s || typeof s !== 'object') return where + ': paso no válido';
    if (s.kind !== 'time' && s.kind !== 'dist') return where + ': tipo de paso desconocido';
    if (s.kind === 'time' && !isInt(s.value, 5, 28800)) return where + ': tiempo fuera de rango (5 s a 8 h)';
    if (s.kind === 'dist' && !isInt(s.value, 10, 100000)) return where + ': distancia fuera de rango (10 m a 100 km)';
    if (!isInt(s.level, 0, 4)) return where + ': intensidad no válida';
    if (s.note != null && (typeof s.note !== 'string' || s.note.length > 40)) return where + ': nota demasiado larga';
    return null;
  }
  function validateProgram(p) {
    if (!p || typeof p !== 'object') return 'El contenido no es un programa.';
    if (!str(p.name, 60)) return 'El programa necesita un nombre (máx. 60 caracteres).';
    if (!Array.isArray(p.weeks) || p.weeks.length < 1 || p.weeks.length > 52) return 'El programa debe tener entre 1 y 52 semanas.';
    for (var w = 0; w < p.weeks.length; w++) {
      var wk = p.weeks[w], wl = 'Semana ' + (w + 1);
      if (!wk || !str(wk.name, 40)) return wl + ': falta el nombre.';
      if (!Array.isArray(wk.parts) || wk.parts.length < 1 || wk.parts.length > 6) return wl + ': debe tener entre 1 y 6 partes.';
      for (var q = 0; q < wk.parts.length; q++) {
        var pt = wk.parts[q], pl = wl + ' · parte ' + (q + 1);
        if (!pt || !str(pt.name, 40)) return pl + ': falta el nombre.';
        if (!Array.isArray(pt.items) || pt.items.length < 1 || pt.items.length > 60) return pl + ': debe tener entre 1 y 60 pasos.';
        for (var i = 0; i < pt.items.length; i++) {
          var it = pt.items[i], il = pl + ' · paso ' + (i + 1), e;
          if (!it || typeof it !== 'object') return il + ': no válido';
          if (it.t === 'repeat') {
            if (!isInt(it.rounds, 1, 99)) return il + ': rondas fuera de rango (1 a 99)';
            if (!Array.isArray(it.steps) || it.steps.length < 1 || it.steps.length > 12) return il + ': el bloque necesita de 1 a 12 pasos';
            for (var k = 0; k < it.steps.length; k++) { e = checkStep(it.steps[k], il + '.' + (k + 1)); if (e) return e; }
          } else if (it.t === 'step') { e = checkStep(it, il); if (e) return e; }
          else return il + ': tipo desconocido';
        }
      }
    }
    return null;
  }
  var uid = 0;
  function newId(prefix) { return prefix + Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1000).toString(36); }
  function cleanStep(s) { return { t: 'step', kind: s.kind, value: s.value, level: s.level, note: (s.note || '').trim() }; }
  /* Copia limpia (solo campos conocidos) con identificadores nuevos */
  function sanitizeProgram(p) {
    return {
      id: newId('g'), name: p.name.trim(),
      weeks: p.weeks.map(function (w) {
        return { id: newId('w'), name: w.name.trim(), parts: w.parts.map(function (pt) {
          return { id: newId('t'), name: pt.name.trim(), items: pt.items.map(function (it) {
            return it.t === 'repeat' ? { t: 'repeat', rounds: it.rounds, steps: it.steps.map(cleanStep) } : cleanStep(it);
          }) };
        }) };
      })
    };
  }
  function exportProgram(p) { return JSON.stringify({ app: '4timer', type: 'program', v: 1, program: p }); }
  /* Devuelve {program} (ya validado y limpio) o {error} */
  function parseProgramText(text) {
    var obj;
    try { obj = JSON.parse(String(text).trim()); } catch (e) { return { error: 'El texto no es un programa de 4TIMER (no se puede leer).' }; }
    if (!obj || obj.app !== '4timer' || obj.type !== 'program') return { error: 'Este archivo no es un programa de 4TIMER.' };
    if (obj.v !== 1) return { error: 'Versión de programa no compatible. Actualiza la app.' };
    var err = validateProgram(obj.program);
    return err ? { error: err } : { program: sanitizeProgram(obj.program) };
  }

  /* ---------- GPS: proveedor del navegador o nativo (Android, segundo plano) ---------- */
  var GPS = {
    provider: null,                                  // para tests: {start(cb, onErr) → stop()}
    isNative: function () { var c = root.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); },
    start: function (cb, onErr) {
      if (GPS.provider) return GPS.provider.start(cb, onErr);
      if (GPS.isNative() && root.Capacitor.registerPlugin) {
        var BG = root.Capacitor.registerPlugin('BackgroundGeolocation'), id = null, stopped = false;
        BG.addWatcher({ backgroundTitle: 'Carrera en curso', backgroundMessage: '4TIMER está registrando tu carrera', requestPermissions: true, stale: false, distanceFilter: 2 },
          function (loc, err) {
            if (err) { if (onErr) onErr(err.code === 'NOT_AUTHORIZED' ? 'denied' : (err.message || 'error')); return; }
            cb({ lat: loc.latitude, lon: loc.longitude, acc: loc.accuracy, t: loc.time || Date.now(), alt: loc.altitude, speed: loc.speed });
          }).then(function (wid) { id = wid; if (stopped) BG.removeWatcher({ id: id }); });
        return function () { stopped = true; if (id !== null) BG.removeWatcher({ id: id }); };
      }
      if (!root.navigator || !root.navigator.geolocation) { if (onErr) onErr('unsupported'); return function () {}; }
      var wid = root.navigator.geolocation.watchPosition(function (pos) {
        cb({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: pos.timestamp || Date.now(), alt: pos.coords.altitude, speed: pos.coords.speed });
      }, function (e) { if (onErr) onErr(e && e.code === 1 ? 'denied' : 'error'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
      return function () { root.navigator.geolocation.clearWatch(wid); };
    },
    /* Aviso corto en notificación: se refleja en la pulsera/reloj y vibra (solo en la app Android) */
    notifSeq: 1,
    LIVE_ID: 7,
    plug: function () { var c = root.Capacitor, P = c && c.Plugins && c.Plugins.LocalNotifications; return GPS.isNative() && P ? P : null; },
    /* Canales: 'steps' avisa (suena y vibra: llega a la pulsera) y 'live' es silencioso y visible en la pantalla de bloqueo */
    ensureChannels: function () {
      var P = GPS.plug(); if (!P || !P.createChannel || GPS._ch) return; GPS._ch = true;
      try {
        P.createChannel({ id: 'steps', name: 'Cambios de serie', description: 'Aviso en cada cambio de tramo', importance: 4, visibility: 1, vibration: true });
        P.createChannel({ id: 'live', name: 'Carrera en curso', description: 'Tiempo, distancia y ritmo mientras corres', importance: 2, visibility: 1, vibration: false });
      } catch (e) {}
    },
    /* `at` (ms, opcional) programa el aviso para más tarde: funciona con la pantalla apagada. Devuelve el id. */
    notify: function (title, body, at) {
      var P = GPS.plug(); if (!P) return null;
      GPS.ensureChannels();
      var id = 1000 + (GPS.notifSeq++ % 100000), n = { id: id, title: title, body: body, smallIcon: 'ic_stat_icon', channelId: 'steps' };
      if (at) n.schedule = { at: new Date(at), allowWhileIdle: true };
      try { P.schedule({ notifications: [n] }); } catch (e) { /* sin permiso: se ignora */ }
      return id;
    },
    /* Notificación fija con los datos principales (se actualiza con el mismo id; se ve en el bloqueo y en la barra) */
    live: function (title, body) {
      var P = GPS.plug(); if (!P) return;
      GPS.ensureChannels();
      try { P.schedule({ notifications: [{ id: GPS.LIVE_ID, title: title, body: body, smallIcon: 'ic_stat_icon', channelId: 'live', ongoing: true, autoCancel: false }] }); } catch (e) {}
    },
    liveClear: function () { var P = GPS.plug(); if (P) { try { P.cancel({ notifications: [{ id: GPS.LIVE_ID }] }); } catch (e) {} } },
    cancelNotify: function (ids) {
      var c = root.Capacitor, P = c && c.Plugins && c.Plugins.LocalNotifications;
      if (!GPS.isNative() || !P || !ids || !ids.length) return;
      try { P.cancel({ notifications: ids.map(function (i) { return { id: i }; }) }); } catch (e) {}
    },
    requestNotify: function () {
      var c = root.Capacitor, P = c && c.Plugins && c.Plugins.LocalNotifications;
      if (GPS.isNative() && P && P.requestPermissions) { try { P.requestPermissions(); } catch (e) {} }
    }
  };

  root.Run = {
    hav: hav, Tracker: Tracker, simplify: simplify, trimRoute: trimRoute, bestEfforts: bestEfforts, summarize: summarize, fromPoints: fromPoints,
    buildGPX: buildGPX, parseGPX: parseGPX, parseTCX: parseTCX, parseFIT: parseFIT, parseFile: parseFile,
    LEVELS: LEVELS, levelName: levelName, levelEvent: levelEvent, flatten: flatten, stepLabel: stepLabel, describeItem: describeItem,
    Engine: Engine, totals: totals, validateProgram: validateProgram, sanitizeProgram: sanitizeProgram, exportProgram: exportProgram, parseProgramText: parseProgramText,
    fmtTime: fmtTime, fmtPace: fmtPace, fmtKm: fmtKm, fmtStepValue: fmtStepValue, GPS: GPS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Run;
})(typeof window !== 'undefined' ? window : globalThis);
