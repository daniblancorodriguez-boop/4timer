/* 4TIMER — pantallas de Running: carrera en vivo (GPS), series, programas por semanas, importar y resultados */
(function (root) {
  'use strict';
  var R = root.Run;
  function K() { return root.AppKit; }
  var epoch = Date.now() - performance.now();
  function nowMs() { return performance.now() + epoch; }
  var LOOK = 90;                 // segundos de sonidos de series que se programan por adelantado (sigue sonando con la pantalla apagada)
  var lastDraftErr = null;

  function esc(s) { return K().esc(s); }
  function $(s, el) { return K().$(s, el); }
  function $$(s, el) { return K().$$(s, el); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function app() { return K().app; }
  function lvlOptions(sel) { return R.LEVELS.map(function (l) { return '<option value="' + l.id + '"' + (l.id === sel ? ' selected' : '') + '>' + l.name + '</option>'; }).join(''); }

  /* ---------- registro (lo que se guarda en el historial) ---------- */
  function kmLed(m) { var km = Math.min(99.99, m / 1000); return (km >= 10 ? km.toFixed(2) : km.toFixed(2)); }
  function makeRecord(sum, o) {
    var pace = sum.avgPace ? R.fmtPace(sum.avgPace) + ' /km' : '';
    return {
      modeId: 'run', modeName: 'Running', name: o.name, kind: 'run', label: 'DISTANCIA', value: kmLed(sum.distance),
      distance: sum.distance, sec: sum.sec, avgPace: sum.avgPace, splits: sum.splits, route: sum.route, efforts: sum.efforts,
      startT: sum.startT || o.startT || Date.now(), source: o.source || 'gps', progKey: o.progKey || '',
      sub: R.fmtTime(sum.sec) + (pace ? ' · ' + pace : ''), date: K().dateEs(sum.startT || o.startT), lines: []
    };
  }
  function valText(h) { return R.fmtKm(h.distance || 0) + ' km · ' + R.fmtTime(h.sec || 0); }
  function shareModel(h, hide) {
    var route = hide ? R.trimRoute(h.route || [], 200) : (h.route || []);
    var lines = (h.splits || []).map(function (s) {
      return { num: '', parts: [{ qty: s.partial ? (s.dist + ' m') : (s.km + ' km'), name: R.fmtTime(s.sec) }], note: '' };
    });
    return { modeName: 'RUNNING', name: h.name, kind: 'run', value: h.value, sub: h.sub, label: 'DISTANCIA', pr: h.pr, lines: lines, date: h.date || K().dateEs(h.ts), route: route };
  }
  function shareText(h) { return h.name + ' · ' + R.fmtKm(h.distance) + ' km · ' + R.fmtTime(h.sec) + (h.avgPace ? ' · ' + R.fmtPace(h.avgPace) + '/km' : '') + ' #4TIMER'; }
  function saveGPX(h) {
    if (!h.route || h.route.length < 2) { K().toast('Esta carrera no tiene recorrido'); return Promise.resolve(); }
    var name = '4timer-' + new Date(h.startT || h.ts || Date.now()).toISOString().slice(0, 10) + '.gpx';
    return root.Share.file(name, R.buildGPX(h), 'application/gpx+xml', 'Carrera 4TIMER').then(function (r) { if (r === 'saved') K().toast('Archivo GPX guardado'); });
  }

  function routeSvg(route) {
    if (!route || route.length < 2) return '';
    var kx = Math.cos(route[0][0] * Math.PI / 180), P = route.map(function (p) { return [p[1] * kx, -p[0]]; }), mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    P.forEach(function (p) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); });
    var W = 300, H = 200, m = 14, k = Math.min((W - 2 * m) / Math.max(1e-9, mxx - mnx), (H - 2 * m) / Math.max(1e-9, mxy - mny)), ox = (W - (mxx - mnx) * k) / 2, oy = (H - (mxy - mny) * k) / 2;
    var d = P.map(function (p) { return ((p[0] - mnx) * k + ox).toFixed(1) + ',' + ((p[1] - mny) * k + oy).toFixed(1); }).join(' ');
    return '<svg class="rr-route" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Recorrido dibujado"><polyline points="' + d + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  /* ---------- router ---------- */
  function route(parts, q) {
    var a = parts[0];
    if (!a) return hub();
    if (a === 'free') return live({ name: 'Carrera libre', steps: null, free: true });
    if (a === 'go') return goProgram(parts[1], +parts[2], +parts[3]);
    if (a === 'result') return result();
    if (a === 'program' && parts[1]) return viewProgram(parts[1]);
    if (a === 'part') return editPart(parts[1], +parts[2], +parts[3]);
    if (a === 'import-file') return importFile();
    if (a === 'import-prog') return importProg();
    hub();
  }

  /* ---------- inicio de Running ---------- */
  function hub() {
    var Store = root.Store, ICON = K().ICON, s = Store.settings();
    var html = '<div class="screen">' + K().header('Running') +
      '<ul class="modes"><li><button class="card accent" data-nav="#/running/free"><span>' + ICON.run + '</span><span><span class="c-title">Carrera libre</span><span class="c-desc">Empieza ya: tiempo, km, ritmo actual y medio, parciales y recorrido.</span></span></button></li></ul>' +
      '<h2 class="sec-h">Programas</h2>';
    var progs = Store.programs();
    if (!progs.length) html += '<div class="empty">No hay programas. Crea uno o importa el que te pase tu entrenador.</div>';
    html += '<ul class="modes">';
    progs.forEach(function (p) {
      html += '<li><button class="card" data-nav="#/running/program/' + esc(p.id) + '"><span>' + ICON.route + '</span><span><span class="c-title">' + esc(p.name) + '</span><span class="c-desc">' + p.weeks.length + (p.weeks.length === 1 ? ' semana' : ' semanas') + '</span></span></button></li>';
    });
    html += '</ul><div class="row" style="margin:10px 0"><button class="btn small" id="new-prog">' + ICON.plus + 'Nuevo programa</button><button class="btn small" data-nav="#/running/import-prog">' + ICON.download + 'Importar programa</button></div>' +
      '<button class="btn small block" data-nav="#/running/import-file" style="margin-bottom:12px">' + ICON.file + 'Importar carrera del reloj (GPX, TCX, FIT)</button>';
    var b = Store.runBests(), names = { 1000: '1 km', 5000: '5 km', 10000: '10 km', 21097: 'Media maratón' }, rows = Object.keys(names).filter(function (k) { return b[k]; });
    if (rows.length) {
      html += '<h2 class="sec-h">Mis mejores marcas</h2><ul class="bests">' + rows.map(function (k) { return '<li><span>' + names[k] + '</span><b>' + R.fmtTime(b[k].sec) + '</b><span class="muted">' + esc(K().dateEs(b[k].ts)) + '</span></li>'; }).join('') + '</ul>';
    }
    html += '<label class="chk"><input type="checkbox" id="autop"' + (s.runAutoPause ? ' checked' : '') + '> Pausa automática en carrera libre (si te paras)</label>' +
      '<p class="hint">El GPS solo se usa durante la carrera y los datos se quedan en tu móvil. El recorrido se dibuja sin mapa.</p></div>';
    app().innerHTML = html;
    $('#autop').addEventListener('change', function () { Store.setSettings({ runAutoPause: this.checked }); });
    $('#new-prog').addEventListener('click', function () {
      var name = (window.prompt('Nombre del programa', '') || '').trim(); if (!name) return;
      var p = Store.saveProgram({ id: '', name: name.slice(0, 60), weeks: [newWeek(1)] });
      K().go('#/running/program/' + p.id);
    });
  }
  function defStep() { return { t: 'step', kind: 'time', value: 300, level: 1, note: '' }; }
  function newWeek(n) { return { name: 'Semana ' + n, parts: [{ name: 'A', items: [defStep()] }] }; }

  /* ---------- un programa: semanas y partes ---------- */
  function partDone(pid, wi, pi) {
    var key = pid + '|' + wi + '|' + pi, h = root.Store.history().filter(function (x) { return x.modeId === 'run' && x.progKey === key; });
    return h.length ? h[h.length - 1] : null;
  }
  function viewProgram(id) {
    var Store = root.Store, ICON = K().ICON, p = Store.getProgram(id);
    if (!p) return K().go('#/running');
    var html = '<div class="screen">' + K().header(p.name, { back: '#/running' }) +
      '<div class="row" style="margin-bottom:12px"><button class="btn small" id="p-ren">' + ICON.edit + 'Renombrar</button><button class="btn small" id="p-exp">' + ICON.share + 'Exportar</button></div>';
    p.weeks.forEach(function (w, wi) {
      html += '<section class="wk"><div class="wk-h"><h2 class="sec-h" style="margin:0">' + esc(w.name) + '</h2><div class="ed-btns"><button class="icon-btn mini" data-wren="' + wi + '" aria-label="Renombrar semana">' + ICON.edit + '</button><button class="icon-btn mini" data-wdel="' + wi + '" aria-label="Borrar semana">' + ICON.trash + '</button></div></div>';
      w.parts.forEach(function (pt, pi) {
        var d = partDone(p.id, wi, pi), tot = R.totals(R.flatten(pt.items));
        html += '<div class="part"><div class="wk-h"><span class="p-name" style="font-size:24px">' + esc(pt.name) + '</span>' + (d ? '<span class="chip done">✓ ' + esc(K().dateEs(d.ts)) + '</span>' : '') + '</div>' +
          '<ul class="ex-lines">' + pt.items.map(function (it) { return '<li class="ex-line">' + esc(R.describeItem(it)) + '</li>'; }).join('') + '</ul>' +
          '<div class="p-actions"><button class="btn primary small" data-go="' + wi + '.' + pi + '">' + ICON.play + 'Empezar</button>' +
          '<button class="icon-btn mini" data-ped="' + wi + '.' + pi + '" aria-label="Editar parte">' + ICON.edit + '</button></div></div>';
      });
      html += '<button class="btn small block" data-padd="' + wi + '" style="margin-top:6px">' + ICON.plus + 'Añadir parte</button></section>';
    });
    html += '<button class="btn small block" id="w-add" style="margin:8px 0">' + ICON.plus + 'Añadir semana</button>' +
      '<button class="btn small block danger" id="p-del">' + ICON.trash + 'Borrar programa</button></div>';
    app().innerHTML = html;
    function persist(msg) { var e = R.validateProgram(p); if (e) { K().toast(e); return false; } Store.saveProgram(p); viewProgram(id); if (msg) K().toast(msg); return true; }
    function onClick(e) {
      var t = e.target, b;
      if ((b = t.closest('[data-go]'))) { var g = b.dataset.go.split('.'); root.Sound && root.Sound.unlock(); K().go('#/running/go/' + id + '/' + g[0] + '/' + g[1]); }
      else if ((b = t.closest('[data-ped]'))) { var q = b.dataset.ped.split('.'); K().go('#/running/part/' + id + '/' + q[0] + '/' + q[1]); }
      else if ((b = t.closest('[data-padd]'))) {
        var wk = p.weeks[+b.dataset.padd]; if (wk.parts.length >= 6) return K().toast('Máximo 6 partes por semana');
        wk.parts.push({ name: String.fromCharCode(65 + wk.parts.length), items: [defStep()] }); persist();
      }
      else if ((b = t.closest('[data-wren]'))) { var n = (window.prompt('Nombre de la semana', p.weeks[+b.dataset.wren].name) || '').trim(); if (n) { p.weeks[+b.dataset.wren].name = n.slice(0, 40); persist(); } }
      else if ((b = t.closest('[data-wdel]'))) { if (p.weeks.length < 2) return K().toast('Un programa necesita al menos una semana'); if (window.confirm('¿Borrar esta semana?')) { p.weeks.splice(+b.dataset.wdel, 1); persist(); } }
      else if (t.closest('#w-add')) { if (p.weeks.length >= 52) return; p.weeks.push(newWeek(p.weeks.length + 1)); persist(); }
      else if (t.closest('#p-ren')) { var nn = (window.prompt('Nombre del programa', p.name) || '').trim(); if (nn) { p.name = nn.slice(0, 60); persist(); } }
      else if (t.closest('#p-del')) { if (window.confirm('¿Borrar el programa «' + p.name + '»?')) { Store.removeProgram(id); K().go('#/running'); } }
      else if (t.closest('#p-exp')) exportDialog(p);
    }
    app().addEventListener('click', onClick);
    K().setCleanup(function () { app().removeEventListener('click', onClick); });
  }

  function exportDialog(p) {
    var ICON = K().ICON, text = R.exportProgram(p), safe = p.name.replace(/[^\w\-]+/g, '_').slice(0, 30) || 'programa';
    var back = document.createElement('div');
    back.className = 'sheet-back'; back.id = 'exp-sheet';
    back.innerHTML = '<div class="sheet" role="dialog" aria-label="Exportar programa"><h2>Exportar programa</h2><p>Envía este programa a tus alumnos. Ellos lo importan en Running → Importar programa.</p>' +
      '<textarea class="text-in" id="exp-text" readonly rows="4"></textarea>' +
      '<div class="row" style="margin-top:12px"><button class="btn small" id="exp-copy">Copiar texto</button><button class="btn small" id="exp-file">' + ICON.download + 'Archivo</button></div>' +
      '<button class="btn small block" id="exp-share" style="margin-top:8px">' + ICON.share + 'Enviar…</button><button class="btn small block" id="exp-close" style="margin-top:8px">Cerrar</button></div>';
    document.body.appendChild(back);
    back.querySelector('#exp-text').value = text;
    back.addEventListener('click', function (e) {
      var t = e.target;
      if (t === back || t.closest('#exp-close')) back.remove();
      else if (t.closest('#exp-copy')) {
        var ta = back.querySelector('#exp-text'); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (er) {}
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { K().toast('Texto copiado'); }, function () { K().toast(ok ? 'Texto copiado' : 'Selecciona el texto y cópialo'); });
        else K().toast(ok ? 'Texto copiado' : 'Selecciona el texto y cópialo');
      }
      else if (t.closest('#exp-file')) root.Share.file(safe + '.4timer.json', text, 'application/json', p.name).then(function (r) { if (r === 'saved') K().toast('Archivo guardado'); });
      else if (t.closest('#exp-share')) {
        if (navigator.share && !(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform())) navigator.share({ title: p.name, text: text }).catch(function () {});
        else root.Share.file(safe + '.4timer.json', text, 'application/json', p.name).then(function (r) { if (r === 'saved') K().toast('Archivo guardado'); });
      }
    });
  }

  /* ---------- editor de una parte ---------- */
  function stepRow(s, path) {
    var time = s.kind === 'time', m = Math.floor(s.value / 60), sec = s.value % 60, km = s.value >= 1000 && s.value % 1000 === 0;
    return '<div class="stp" data-path="' + path + '"><div class="stp-r">' +
      '<select class="text-in f-kind" aria-label="Tipo"><option value="time"' + (time ? ' selected' : '') + '>Tiempo</option><option value="dist"' + (!time ? ' selected' : '') + '>Distancia</option></select>' +
      (time ? '<label class="mini-f"><span>Min</span><input class="text-in f-min" type="number" inputmode="numeric" min="0" max="480" value="' + m + '"></label><label class="mini-f"><span>Seg</span><input class="text-in f-sec" type="number" inputmode="numeric" min="0" max="59" value="' + sec + '"></label>'
        : '<label class="mini-f"><span>' + (km ? 'Km' : 'Metros') + '</span><input class="text-in f-dist" type="number" inputmode="decimal" min="0" step="any" value="' + (km ? s.value / 1000 : s.value) + '"></label><select class="text-in f-unit" aria-label="Unidad"><option value="m"' + (km ? '' : ' selected') + '>m</option><option value="km"' + (km ? ' selected' : '') + '>km</option></select>') +
      '</div><div class="stp-r"><select class="text-in f-lvl" aria-label="Intensidad">' + lvlOptions(s.level) + '</select>' +
      '<input class="text-in f-note" maxlength="40" placeholder="Nota (ej. 3/10, 50 %)" value="' + esc(s.note || '') + '"></div></div>';
  }
  function editPart(pid, wi, pi) {
    var Store = root.Store, ICON = K().ICON, prog = Store.getProgram(pid);
    if (!prog || !prog.weeks[wi] || !prog.weeks[wi].parts[pi]) return K().go('#/running');
    var part = JSON.parse(JSON.stringify(prog.weeks[wi].parts[pi]));
    function render() {
      var html = '<div class="screen">' + K().header('Editar parte', { back: '#/running/program/' + pid }) +
        '<p class="lead">' + esc(prog.name) + ' · ' + esc(prog.weeks[wi].name) + '</p>' +
        '<label class="fld"><span>Nombre de la parte</span><input class="text-in" id="pt-name" maxlength="40" value="' + esc(part.name) + '"></label>';
      part.items.forEach(function (it, i) {
        html += '<div class="ed-line"><div class="ed-head"><span class="ed-title">' + (it.t === 'repeat' ? 'Bloque repetido' : 'Paso ' + (i + 1)) + '</span><div class="ed-btns">' +
          '<button class="icon-btn mini" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir">' + ICON.up + '</button>' +
          '<button class="icon-btn mini" data-down="' + i + '"' + (i === part.items.length - 1 ? ' disabled' : '') + ' aria-label="Bajar">' + ICON.down + '</button>' +
          '<button class="icon-btn mini" data-del="' + i + '" aria-label="Borrar">' + ICON.trash + '</button></div></div>';
        if (it.t === 'repeat') {
          html += '<label class="fld"><span>Número de rondas</span><input class="text-in f-rounds" data-path="' + i + '" type="number" inputmode="numeric" min="1" max="99" value="' + it.rounds + '"></label>';
          it.steps.forEach(function (s, j) {
            html += stepRow(s, i + '.' + j) + '<div class="ed-btns" style="justify-content:flex-end"><button class="icon-btn mini" data-sdel="' + i + '.' + j + '" aria-label="Borrar paso del bloque">' + ICON.trash + '</button></div>';
          });
          html += '<button class="btn small block" data-sadd="' + i + '">' + ICON.plus + 'Añadir paso al bloque</button>';
        } else html += stepRow(it, String(i));
        html += '</div>';
      });
      html += '<div class="row" style="margin:12px 0"><button class="btn small" id="add-step">' + ICON.plus + 'Añadir paso</button><button class="btn small" id="add-rep">' + ICON.plus + 'Añadir bloque</button></div>' +
        '<p class="hint">Ejemplo: 5 rondas sin descanso = bloque con 3 pasos (3\' suave 50 %, 2\' medio 70 %, 1\' sprint 100 %).</p>' +
        '<button class="btn primary block" id="pt-save">Guardar parte</button></div>';
      app().innerHTML = html;
    }
    function stepAt(path) { var a = String(path).split('.'); return a.length === 1 ? part.items[+a[0]] : part.items[+a[0]].steps[+a[1]]; }
    function read() {
      part.name = ($('#pt-name').value || '').trim();
      $$('.f-rounds').forEach(function (el) { part.items[+el.dataset.path].rounds = parseInt(el.value, 10) || 0; });
      $$('.stp').forEach(function (el) {
        var s = stepAt(el.dataset.path), q = function (c) { return el.querySelector(c); };
        s.kind = q('.f-kind').value; s.level = +q('.f-lvl').value; s.note = (q('.f-note').value || '').trim();
        if (s.kind === 'time') s.value = (parseInt(q('.f-min').value, 10) || 0) * 60 + (parseInt(q('.f-sec').value, 10) || 0);
        else s.value = Math.round((parseFloat(String(q('.f-dist').value).replace(',', '.')) || 0) * (q('.f-unit').value === 'km' ? 1000 : 1));
      });
    }
    function onClick(e) {
      var t = e.target, b;
      if (t.closest('#pt-save')) {
        read();
        var copy = JSON.parse(JSON.stringify(prog)); copy.weeks[wi].parts[pi] = part;
        var err = R.validateProgram(copy); if (err) return K().toast(err);
        Store.saveProgram(copy); K().toast('Parte guardada'); return K().go('#/running/program/' + pid);
      }
      if (t.closest('#add-step')) { read(); if (part.items.length >= 60) return; part.items.push(defStep()); return render(); }
      if (t.closest('#add-rep')) { read(); if (part.items.length >= 60) return; part.items.push({ t: 'repeat', rounds: 3, steps: [defStep()] }); return render(); }
      if ((b = t.closest('[data-up]'))) { read(); var i = +b.dataset.up; part.items.splice(i - 1, 0, part.items.splice(i, 1)[0]); return render(); }
      if ((b = t.closest('[data-down]'))) { read(); var k = +b.dataset.down; part.items.splice(k + 1, 0, part.items.splice(k, 1)[0]); return render(); }
      if ((b = t.closest('[data-del]'))) { read(); if (part.items.length < 2) return K().toast('La parte necesita al menos un paso'); part.items.splice(+b.dataset.del, 1); return render(); }
      if ((b = t.closest('[data-sadd]'))) { read(); var bl = part.items[+b.dataset.sadd]; if (bl.steps.length >= 12) return K().toast('Máximo 12 pasos por bloque'); bl.steps.push(defStep()); return render(); }
      if ((b = t.closest('[data-sdel]'))) { read(); var a = b.dataset.sdel.split('.'), blk = part.items[+a[0]]; if (blk.steps.length < 2) return K().toast('El bloque necesita al menos un paso'); blk.steps.splice(+a[1], 1); return render(); }
    }
    function onChange(e) { if (e.target.classList.contains('f-kind')) { read(); var s = stepAt(e.target.closest('.stp').dataset.path); s.value = s.kind === 'time' ? 300 : 1000; render(); } }
    render();
    app().addEventListener('click', onClick); app().addEventListener('change', onChange);
    K().setCleanup(function () { app().removeEventListener('click', onClick); app().removeEventListener('change', onChange); });
  }

  /* ---------- importar programa (archivo o texto pegado) ---------- */
  function importProg() {
    var Store = root.Store, ICON = K().ICON, found = null;
    app().innerHTML = '<div class="screen">' + K().header('Importar programa', { back: '#/running' }) +
      '<p class="lead">Pega el texto que te ha enviado tu entrenador o elige el archivo. Antes de guardar se comprueba que todo esté bien.</p>' +
      '<label class="btn block" style="margin-bottom:10px">' + ICON.file + 'Elegir archivo<input type="file" id="ip-file" accept=".json,.txt,.4timer,application/json,text/plain" hidden></label>' +
      '<label class="fld"><span>O pega aquí el texto del programa</span><textarea class="text-in" id="ip-text" rows="5" spellcheck="false"></textarea></label>' +
      '<button class="btn block" id="ip-check">Revisar programa</button><div id="ip-out" style="margin-top:12px"></div></div>';
    function check(text) {
      var out = $('#ip-out'); found = null;
      var r = R.parseProgramText(text);
      if (r.error) { out.innerHTML = '<div class="err" role="alert">' + esc(r.error) + '</div>'; return; }
      found = r.program;
      var already = Store.programs().some(function (p) { return p.name === found.name; });
      out.innerHTML = '<div class="preview"><div class="p-name">' + esc(found.name) + '</div>' +
        found.weeks.map(function (w) { return '<div class="pv-w"><b>' + esc(w.name) + '</b>' + w.parts.map(function (pt) { return '<div class="pv-p">' + esc(pt.name) + ': ' + esc(pt.items.map(R.describeItem).join(' + ')) + '</div>'; }).join('') + '</div>'; }).join('') + '</div>' +
        (already ? '<p class="hint">Ya tienes un programa con este nombre. Se guardará como otro programa distinto.</p>' : '') +
        '<button class="btn primary block" id="ip-save">Guardar programa</button>';
    }
    function onClick(e) {
      if (e.target.closest('#ip-check')) check($('#ip-text').value);
      else if (e.target.closest('#ip-save') && found) { var p = Store.saveProgram(found); K().toast('Programa importado'); K().go('#/running/program/' + p.id); }
    }
    function onFile(e) {
      var f = e.target.files[0]; if (!f) return;
      if (f.size > 400 * 1024) { $('#ip-out').innerHTML = '<div class="err" role="alert">El archivo es demasiado grande para ser un programa.</div>'; return; }
      var fr = new FileReader(); fr.onload = function () { $('#ip-text').value = fr.result; check(fr.result); };
      fr.onerror = function () { $('#ip-out').innerHTML = '<div class="err" role="alert">No se pudo leer el archivo.</div>'; };
      fr.readAsText(f); e.target.value = '';
    }
    app().addEventListener('click', onClick); $('#ip-file').addEventListener('change', onFile);
    K().setCleanup(function () { app().removeEventListener('click', onClick); });
  }

  /* ---------- importar carrera grabada por el reloj ---------- */
  function importFile() {
    var Store = root.Store, ICON = K().ICON, sum = null, fname = '';
    app().innerHTML = '<div class="screen">' + K().header('Importar carrera', { back: '#/running' }) +
      '<p class="lead">Exporta la carrera desde la app de tu pulsera (Zepp, Mi Fitness…) como GPX, TCX o FIT y elígela aquí. Solo se usa el recorrido y la hora.</p>' +
      '<label class="btn block" style="margin-bottom:10px">' + ICON.file + 'Elegir archivo<input type="file" id="if-file" accept=".gpx,.tcx,.fit,application/gpx+xml,application/octet-stream,text/xml" hidden></label><div id="if-out"></div></div>';
    function show() {
      var pace = sum.avgPace ? R.fmtPace(sum.avgPace) + ' /km' : '--';
      $('#if-out').innerHTML = '<div class="preview"><div class="p-name">' + esc(K().dateEs(sum.startT)) + '</div><div class="bigline">' + R.fmtKm(sum.distance) + ' km · ' + R.fmtTime(sum.sec) + ' · ' + pace + '</div>' + routeSvg(sum.route) + '</div>' +
        '<label class="fld"><span>Nombre</span><input class="text-in" id="if-name" maxlength="60" value="' + esc(fname || 'Carrera') + '"></label>' +
        '<button class="btn primary block" id="if-save">Guardar en el historial</button>';
    }
    function onFile(e) {
      var f = e.target.files[0]; if (!f) return; e.target.value = '';
      if (f.size > 20 * 1024 * 1024) { $('#if-out').innerHTML = '<div class="err" role="alert">Archivo demasiado grande.</div>'; return; }
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var p = R.parseFile(f.name, fr.result), s = R.fromPoints(p.points, {});
          if (!s || s.distance < 50) throw new Error('El archivo no contiene un recorrido válido (menos de 50 m).');
          sum = s; fname = (p.name || '').slice(0, 60) || 'Carrera'; show();
        } catch (er) { sum = null; $('#if-out').innerHTML = '<div class="err" role="alert">' + esc(er.message || 'No se pudo leer el archivo.') + '</div>'; }
      };
      fr.onerror = function () { $('#if-out').innerHTML = '<div class="err" role="alert">No se pudo leer el archivo.</div>'; };
      fr.readAsArrayBuffer(f);
    }
    function onClick(e) {
      if (!e.target.closest('#if-save') || !sum) return;
      var rec = Store.addResult(makeRecord(sum, { name: ($('#if-name').value || '').trim() || 'Carrera', source: 'file' }));
      K().toast(rec.pr ? '¡Nueva marca personal!' : 'Carrera guardada'); lastRun = rec; K().go('#/running/result');
    }
    $('#if-file').addEventListener('change', onFile); app().addEventListener('click', onClick);
    K().setCleanup(function () { app().removeEventListener('click', onClick); });
  }

  /* ---------- resultado ---------- */
  var lastRun = null;
  function result() {
    var Store = root.Store, ICON = K().ICON, h = lastRun;
    if (!h) return K().go('#/running');
    var best = Store.runBests(), names = { 1000: '1 km', 5000: '5 km', 10000: '10 km', 21097: 'Media maratón' };
    var html = '<div class="screen">' + K().header('Resultado', { back: '#/running' }) +
      '<div class="preview"><div class="p-name">' + esc(h.name) + (h.pr ? ' <b class="pr-tag">NUEVO PR</b>' : '') + '</div>' +
      '<div class="rr-stats"><div><span class="rr-n">' + R.fmtKm(h.distance) + '</span><span class="rr-l">km</span></div><div><span class="rr-n">' + R.fmtTime(h.sec) + '</span><span class="rr-l">tiempo</span></div><div><span class="rr-n">' + (h.avgPace ? R.fmtPace(h.avgPace) : '--:--') + '</span><span class="rr-l">/km medio</span></div></div>' +
      (h.route && h.route.length > 1 && root.RunMap ? '<div class="seg-ctl" role="group" aria-label="Tipo de vista" style="margin-top:8px"><button class="btn small on" data-mapmode="draw">Recorrido dibujado</button><button class="btn small" data-mapmode="map">Mapa real</button></div>' : '') +
      '<div id="rr-view">' + routeSvg(h.route) + '</div><p class="hint" id="rr-note" hidden></p></div>';
    if (h.splits && h.splits.length) {
      var fast = Math.min.apply(null, h.splits.filter(function (s) { return !s.partial; }).map(function (s) { return s.sec; }));
      html += '<h2 class="sec-h">Tiempo por km</h2><ul class="splits">' + h.splits.map(function (s) {
        return '<li' + (s.sec === fast && !s.partial ? ' class="fast"' : '') + '><span>' + (s.partial ? R.fmtKm(s.dist) + ' km' : 'Km ' + s.km) + '</span><b>' + R.fmtTime(s.sec) + '</b></li>';
      }).join('') + '</ul>';
    }
    var eff = Object.keys(h.efforts || {}).filter(function (k) { return names[k]; });
    if (eff.length) html += '<h2 class="sec-h">Mejores tramos</h2><ul class="bests">' + eff.map(function (k) { var pr = (h.prs || []).indexOf(k) > -1; return '<li><span>' + names[k] + '</span><b>' + R.fmtTime(h.efforts[k]) + '</b>' + (pr ? '<span class="pr-tag">PR</span>' : '<span></span>') + '</li>'; }).join('') + '</ul>';
    html += '<button class="btn primary block" id="rs-share">' + ICON.share + 'Compartir tarjeta</button>' +
      '<button class="btn block" id="rs-gpx" style="margin-top:10px"' + (h.route && h.route.length > 1 ? '' : ' disabled') + '>' + ICON.download + 'Exportar GPX</button>' +
      '<div class="row" style="margin-top:10px"><button class="btn small" data-nav="#/running">Listo</button><button class="btn small danger" id="rs-del">' + ICON.trash + 'Borrar</button></div></div>';
    app().innerHTML = html;
    function onClick(e) {
      var mm = e.target.closest('[data-mapmode]');
      if (mm) return showView(mm.dataset.mapmode);
      if (e.target.closest('#rs-share')) { K().setShareResult(h); K().go('#/share'); }
      else if (e.target.closest('#rs-gpx')) saveGPX(h);
      else if (e.target.closest('#rs-del')) { if (window.confirm('¿Borrar esta carrera del historial?')) { Store.removeResult(h.id); lastRun = null; K().go('#/running'); } }
    }
    var seq = 0;
    function showView(mode) {
      var my = ++seq, box = $('#rr-view'), note = $('#rr-note');
      $$('[data-mapmode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mapmode === mode); });
      note.hidden = true;
      if (mode === 'draw') { box.innerHTML = routeSvg(h.route); return; }
      var W = 700, H = 460;
      box.innerHTML = '<div class="rr-loading">Cargando mapa…</div>';
      root.RunMap.render(h.route, W, H).then(function (m) {
        if (my !== seq) return;
        var c = m.canvas, ctx = c.getContext && c.getContext('2d');
        if (ctx) root.RunMap.stroke(ctx, m.proj, h.route, 1);
        box.innerHTML = ''; c.className = 'rr-map'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Mapa con el recorrido'); box.appendChild(c);
        note.hidden = false;
        note.textContent = m.loaded ? 'El mapa se descarga de CARTO y OpenStreetMap, que ven la zona que consultas.' : 'No se ha podido cargar el mapa (¿sin conexión?). Se muestra solo el recorrido.';
      });
    }
    app().addEventListener('click', onClick);
    K().setCleanup(function () { seq++; app().removeEventListener('click', onClick); });
  }

  /* ---------- ir a una parte de un programa ---------- */
  function goProgram(pid, wi, pi) {
    var p = root.Store.getProgram(pid), w = p && p.weeks[wi], pt = w && w.parts[pi];
    if (!pt) return K().go('#/running');
    live({ name: pt.name + ' · ' + w.name, steps: R.flatten(pt.items), progName: p.name, progKey: pid + '|' + wi + '|' + pi });
  }

  /* ---------- carrera en vivo ---------- */
  function live(cfg) {
    var Store = root.Store, Sound = root.Sound, ICON = K().ICON, settings = Store.settings(), steps = cfg.steps, eng = steps ? new R.Engine(steps) : null;
    var tr = new R.Tracker({ autoPause: !steps && !!settings.runAutoPause });
    var phase = 'ready', t0 = 0, gpsAcc = null, gpsErr = '', lastFix = 0, started = false, sched = {}, notifIds = [], stopGps = null, iv = null, prepScheduled = false, lastIdx = -1;
    var label = cfg.progName ? cfg.progName : 'Running';
    app().innerHTML = '<div class="screen run run-gps" data-type="prep">' +
      '<div class="top"><button class="icon-btn" id="exit" aria-label="Salir">' + ICON.back + '</button><div class="grow"><div class="gymname" style="margin:0">' + esc(label) + '</div></div><img class="gym-logo" src="' + esc(K().logoSrc()) + '" alt=""></div>' +
      '<h1 class="sr-only">Carrera</h1><div class="phase" id="phase" aria-live="polite">' + esc(cfg.name) + '</div><div class="gps-st" id="gps-st" role="status">Buscando GPS…</div>' +
      '<div class="run-body rg-body"><div class="rg-leds">' +
      blk('TIEMPO', 'led-red', 'rg-t') + blk('KM', 'led-blue', 'rg-d') + blk('RITMO /km', 'led-pace', 'rg-p') + '</div>' +
      (steps ? '<aside class="rg-step" id="step-panel" data-lvl="1" aria-live="polite"><div class="st-lvl" id="st-lvl"></div><div class="st-val" id="st-val"></div><div class="st-note" id="st-note"></div><div class="st-bar"><i id="st-bar"></i></div><div class="st-next" id="st-next"></div></aside>' : '') +
      '</div><div class="rg-info" id="rg-info"></div>' +
      '<div class="controls"><button class="btn primary main" id="main">' + ICON.play + '<span>Empezar</span></button><button class="btn danger" id="finish" disabled>' + ICON.stop + 'Terminar</button></div></div>';
    var run = $('.run'), phaseEl = $('#phase');
    var time = null, timePat = '', dist = new root.LED($('#led-blue'), 'DD.DD'), pace = new root.LED($('#led-pace'), 'DD:DD');
    var fits = [];
    function fit(stageSel, pattern) { return root.LED.autoFit($(stageSel + ' .stage'), $(stageSel + ' .display'), $(stageSel + ' .bezel'), root.LED.measure(pattern, 1) + 12); }
    function setTimePat(p) {
      if (p === timePat) return;
      timePat = p; time = new root.LED($('#led-red'), p);
      if (fits[0]) fits[0](); fits[0] = fit('#rg-t', p);
    }
    setTimePat('DD:DD');
    fits[1] = fit('#rg-d', 'DD.DD'); fits[2] = fit('#rg-p', 'DD:DD');
    var wl = K().wakeLock();

    function blk(l, id, bid) {
      return '<div class="rg-blk" id="' + bid + '"><span class="rg-l">' + l + '</span><div class="stage"><div class="bezel"><div class="display"><div class="led" id="' + id + '" role="img" aria-label="' + l + '"></div></div></div></div></div>';
    }
    function setPhase(txt, type) { phaseEl.textContent = txt; run.dataset.type = type; }
    function gpsLine() {
      var el = $('#gps-st'), age = nowMs() - lastFix;
      if (gpsErr === 'denied') { el.textContent = 'Sin permiso de ubicación: actívalo en los ajustes del móvil'; el.className = 'gps-st bad'; return; }
      if (gpsErr) { el.textContent = 'GPS no disponible'; el.className = 'gps-st bad'; return; }
      if (!lastFix || age > 15000) { el.textContent = lastFix ? 'Sin señal GPS' : 'Buscando GPS…'; el.className = 'gps-st bad'; return; }
      var a = Math.round(gpsAcc || 0);
      el.textContent = (a <= 15 ? 'GPS listo' : a <= 35 ? 'GPS aceptable' : 'Señal débil') + ' (±' + a + ' m)';
      el.className = 'gps-st ' + (a <= 15 ? 'good' : a <= 35 ? 'mid' : 'bad');
    }
    function onPoint(p) {
      gpsAcc = p.acc; lastFix = nowMs(); gpsErr = '';
      if ((phase === 'run' || phase === 'paused') && p.t >= t0) tr.add(p);
    }
    stopGps = R.GPS.start(onPoint, function (e) { gpsErr = e || 'error'; });

    /* ---- panel de series ---- */
    function showStep(sec, d) {
      if (!eng) return;
      var panel = $('#step-panel'), s = eng.current();
      if (!s) { panel.dataset.lvl = '1'; $('#st-lvl').textContent = '¡Terminado!'; $('#st-val').textContent = ''; $('#st-note').textContent = ''; $('#st-next').textContent = ''; $('#st-bar').style.width = '100%'; return; }
      var rem = eng.remaining(sec, d), total = s.value;
      panel.dataset.lvl = String(s.level);
      $('#st-lvl').textContent = R.levelName(s.level).toUpperCase() + (s.round ? ' · ' + s.round : '');
      $('#st-val').textContent = s.kind === 'time' ? R.fmtTime(Math.ceil(rem)) : R.fmtKm(rem) + ' km';
      $('#st-note').textContent = s.note || '';
      $('#st-bar').style.width = Math.max(0, Math.min(100, (1 - rem / total) * 100)).toFixed(1) + '%';
      var n = eng.next();
      $('#st-next').textContent = n ? 'Después: ' + R.stepLabel(n) : 'Último tramo';
    }
    function announce(idx) {              // idx = paso que acaba de empezar (o steps.length si terminó)
      var s = steps[idx];
      if (!s) { R.GPS.notify('¡Entreno terminado!', 'Termina la carrera cuando quieras'); return; }
      R.GPS.notify(R.levelName(s.level) + ' · ' + R.fmtStepValue(s.kind, s.value), s.note || (s.round ? 'Ronda ' + s.round : ''));
    }
    function scheduleCues(sec, now) {
      if (!eng || phase !== 'run' || eng.done() || !Sound.available()) return;
      eng.cues(sec, LOOK).forEach(function (c) {
        if (sched[c.key] || c.atSec < sec) return;
        sched[c.key] = true;
        var delay = c.atSec - sec;
        Sound.schedule(c.ev, delay);
        if (/:end$/.test(c.key)) {
          var i = parseInt(c.key, 10), nx = steps[i + 1];
          var id = nx ? R.GPS.notify(R.levelName(nx.level) + ' · ' + R.fmtStepValue(nx.kind, nx.value), nx.note || '', now + delay * 1000) : R.GPS.notify('¡Entreno terminado!', '', now + delay * 1000);
          if (id) notifIds.push(id);
        }
      });
    }
    function clearSched() { sched = {}; Sound.cancelAll(); R.GPS.cancelNotify(notifIds); notifIds = []; }

    var lastLive = 0;
    function pushLive(now, sec) {
      if (now - lastLive < 5000) return; lastLive = now;
      var cp = tr.curPace(now), ap = tr.avgPace(now), s = eng && eng.current();
      var pace = cp ? R.fmtPace(cp) : (ap ? R.fmtPace(ap) : '--:--');
      var line = R.fmtKm(tr.dist) + ' km · ' + pace + ' /km' + (phase === 'paused' ? ' · en pausa' : '') + (s ? ' · ' + R.levelName(s.level) + ' ' + R.fmtTime(Math.ceil(eng.remaining(sec, tr.dist))) : '');
      R.GPS.live(R.fmtTime(sec) + ' · 4TIMER', line);
    }
    /* ---- bucle ---- */
    function draw(now) {
      var sec = tr.movingMs(now) / 1000;
      var shown = Math.floor(sec + 0.001);
      setTimePat(shown >= 6000 ? 'D:DD:DD' : 'DD:DD');
      time.set(shown >= 6000 ? Math.floor(shown / 3600) + ':' + pad(Math.floor(shown % 3600 / 60)) + ':' + pad(shown % 60) : pad(Math.floor(shown / 60)) + ':' + pad(shown % 60));
      var km = Math.min(99.99, tr.dist / 1000); dist.set(km.toFixed(2).replace(/^(\d)\./, '0$1.'));
      var cp = tr.curPace(now);
      var rp = cp ? Math.round(cp) : 0;
      pace.set(rp > 0 && rp < 3600 ? pad(Math.floor(rp / 60)) + ':' + pad(rp % 60) : '  :  ');
      var ap = tr.avgPace(now), sp = tr.splits[tr.splits.length - 1];
      $('#rg-info').textContent = 'Ritmo medio ' + (ap ? R.fmtPace(ap) : '--:--') + ' /km' + (sp ? ' · Km ' + sp.km + ': ' + R.fmtTime(sp.sec) : '');
      return sec;
    }
    function tick() {
      var now = nowMs();
      gpsLine();
      if (phase === 'prep') {
        var left = Math.ceil((t0 - now) / 1000);
        if (left <= 0) return startRun(now);
        setPhase('Prepárate… ' + left, 'prep'); return;
      }
      if (phase !== 'run' && phase !== 'paused') return;
      var sec = draw(now);
      pushLive(now, sec);
      if (phase === 'run' && tr.auto) setPhase('Pausa automática', 'rest'); else if (phase === 'run') setPhase(cfg.name, 'work');
      if (eng && phase === 'run') {
        var ch = eng.update(sec, tr.dist);
        ch.forEach(function (idx) {
          var prevIdx = idx - 1, wasTimed = steps[prevIdx] && steps[prevIdx].kind === 'time' && sched[prevIdx + ':end'];
          if (!wasTimed) { var nx = steps[idx]; Sound.play(nx ? R.levelEvent(nx.level) : 'end'); announce(idx); }
        });
        showStep(sec, tr.dist);
        if (eng.done()) { setPhase('¡Entreno terminado!', 'done'); }
        scheduleCues(sec, now);
      }
    }
    function startPrep() {
      Sound.unlock(); Sound.prepare(); R.GPS.requestNotify();
      var prep = Math.max(0, settings.prep | 0), now = nowMs();
      t0 = now + prep * 1000; phase = 'prep'; started = true;
      $('#main').innerHTML = ICON.stop + '<span>Cancelar</span>';
      if (prep > 0) for (var i = 3; i >= 1; i--) if (prep - i >= 0 && settings.beepLast3) Sound.schedule('countdown', prep - i);
      Sound.schedule('go', prep);
      tick();
    }
    function startRun(now) {
      phase = 'run'; tr.begin(t0); sched = {}; K().setRunGuard(askLeave);
      $('#finish').disabled = false; setMain(false);
      if (eng) { announce(0); }
      tick();
    }
    function setMain(paused) { $('#main').innerHTML = (paused ? ICON.play : ICON.pause) + '<span>' + (paused ? 'Seguir' : 'Pausa') + '</span>'; }
    function togglePause() {
      var now = nowMs();
      if (phase === 'ready') return startPrep();
      if (phase === 'prep') { Sound.cancelAll(); phase = 'ready'; $('#main').innerHTML = ICON.play + '<span>Empezar</span>'; setPhase(cfg.name, 'prep'); return; }
      if (phase === 'run') { tr.pause(now); phase = 'paused'; run.classList.add('paused'); setMain(true); clearSched(); setPhase('En pausa', 'prep'); }
      else if (phase === 'paused') { tr.resume(now); phase = 'run'; run.classList.remove('paused'); setMain(false); setPhase(cfg.name, 'work'); }
    }
    function finish() {
      if (phase !== 'run' && phase !== 'paused') return;
      K().setRunGuard(null);
      var now = nowMs(); clearSched(); R.GPS.liveClear();
      if (tr.manual) tr.resume(now);
      var sum = R.summarize(tr, now); sum.startT = t0;
      phase = 'done'; clearInterval(iv);
      if (sum.distance < 30 && !(steps && sum.sec > 20)) {         // casi sin recorrido: no se guarda
        K().toast('Carrera demasiado corta: no se ha guardado'); return K().go('#/running');
      }
      var rec = Store.addResult(makeRecord(sum, { name: cfg.name, startT: t0, progKey: cfg.progKey }));
      lastRun = rec; if (rec.pr) K().toast('¡Nueva marca personal!');
      Sound.play('end'); K().go('#/running/result');
    }
    $('#main').addEventListener('click', togglePause);
    $('#finish').addEventListener('click', function () { if (phase === 'run' || phase === 'paused') askLeave('#/running', true); });
    /* Atrás / flecha con la carrera en marcha: seguir, terminar y guardar, o salir sin guardar */
    function askLeave(target, fin) {
      if (document.getElementById('leave-sheet')) return;
      var back = document.createElement('div');
      back.className = 'sheet-back'; back.id = 'leave-sheet';
      back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Salir de la carrera"><h2>' + (fin ? '¿Terminar la carrera?' : '¿Salir de la carrera?') + '</h2><p>' + (fin ? 'Se guardará con su resultado y su recorrido, o puedes descartarla.' : 'La carrera sigue en marcha. Si sales sin guardar, se pierde.') + '</p>' +
        '<button class="btn primary block" id="lv-stay">Seguir corriendo</button>' +
        '<button class="btn block" id="lv-save" style="margin-top:10px">Terminar y guardar</button>' +
        '<button class="btn danger block" id="lv-exit" style="margin-top:10px">' + (fin ? 'Descartar carrera' : 'Salir sin guardar') + '</button></div>';
      document.body.appendChild(back);
      back.addEventListener('click', function (e) {
        var t = e.target;
        if (t === back || t.closest('#lv-stay')) back.remove();
        else if (t.closest('#lv-save')) { back.remove(); finish(); }
        else if (t.closest('#lv-exit')) { back.remove(); K().setRunGuard(null); K().go(target || '#/running'); }
      });
    }
    $('#exit').addEventListener('click', function () {
      if (phase === 'run' || phase === 'paused') askLeave('#/running'); else K().go('#/running');
    });
    function onKey(e) { if (e.code === 'Space') { e.preventDefault(); togglePause(); } }
    function onVis() { if (document.visibilityState === 'visible') tick(); }
    document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVis);
    if (eng) showStep(0, 0);
    draw(nowMs());
    iv = setInterval(tick, 200);
    K().setCleanup(function () {
      var ls = document.getElementById('leave-sheet'); if (ls) ls.remove();
      clearInterval(iv); if (stopGps) stopGps(); R.GPS.liveClear(); Sound.cancelAll(); R.GPS.cancelNotify(notifIds); wl(); fits.forEach(function (f) { if (f) f(); });
      document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    });
  }

  root.RunUI = { route: route, valText: valText, shareModel: shareModel, shareText: shareText, saveGPX: saveGPX, _makeRecord: makeRecord, _nowMs: nowMs, _last: function () { return lastRun; }, _setLast: function (r) { lastRun = r; } };
})(window);
