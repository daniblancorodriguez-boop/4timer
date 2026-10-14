/* 4TIMER — interfaz y navegación */
(function () {
  'use strict';
  var T = window.Timer, Store = window.Store, Sound = window.Sound;
  var app = document.getElementById('app');
  var cleanup = null;      // función que limpia la vista actual (temporizadores, wake lock…)
  var lastResult = null;   // resultado del último entreno terminado (para compartir)
  var resume = null;       // {elapsed, rounds} al retomar un entreno guardado
  var runGuard = null, guardHash = '';   // mientras corre un entreno: pregunta antes de salir
  function armGuard(f) { runGuard = f; guardHash = f ? location.hash : ''; }
  var pending = null;      // entreno que se va a ejecutar {mode, cfg, name}
  var defaultLogo = 'icons/gym-logo.webp';

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, el) { return (el || app).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || app).querySelectorAll(sel)); }
  function dateEs(ts) { var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], d = ts ? new Date(ts) : new Date(); return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function logoSrc() { return Store.settings().logo || defaultLogo; }

  var toastTimer;
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- iconos (trazo, 32×32) ---------- */
  function svg(inner, extra) {
    return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + (extra || '') + '>' + inner + '</svg>';
  }
  var ICON = {
    fortime: svg('<circle cx="16" cy="18" r="10"/><path d="M16 18v-6M13 4h6M16 4v4"/>'),
    amrap: svg('<path d="M26 16a10 10 0 1 1-3-7.1"/><path d="M26 5v5h-5"/>'),
    emom: svg('<path d="M5 14v-2a4 4 0 0 1 4-4h17M22 4l4 4-4 4M27 18v2a4 4 0 0 1-4 4H6M10 28l-4-4 4-4"/>'),
    tabata: svg('<circle cx="16" cy="18" r="9"/><path d="M16 13v5l3 2M5 8l4-3M27 8l-4-3"/>'),
    interval: svg('<circle cx="16" cy="16" r="11" stroke-dasharray="3.2 3.2"/><path d="M16 9v7l4 3"/>'),
    rest: svg('<path d="M11 7v18M21 7v18"/>'),
    equal: svg('<path d="M7 12h18M7 20h18"/>'),
    amrapx: svg('<path d="M26 16a10 10 0 1 1-3-7.1"/><path d="M26 5v5h-5"/><path d="M13 12v8M19 12v8"/>'),
    counter: svg('<path d="M8 7v18M13 7v18M18 7v18M23 7v18M4 22L28 10"/>'),
    presets: svg('<path d="M6 8h20M6 16h20M6 24h12"/><path d="M24 20l3 3-3 3" />'),
    edit: svg('<path d="M6 26l1-6L21 6l5 5L12 25z"/><path d="M18 9l5 5"/>'),
    plus: svg('<path d="M16 6v20M6 16h20"/>'),
    info: svg('<circle cx="16" cy="16" r="12"/><path d="M16 14.5v8"/><circle cx="16" cy="10" r="1.3" fill="currentColor" stroke="none"/>'),
    exercises: svg('<path d="M10 9v14M22 9v14M5 13v6M27 13v6M10 16h12"/>'),
    up: svg('<path d="M8 20l8-8 8 8"/>'),
    down: svg('<path d="M8 12l8 8 8-8"/>'),
    fgb: svg('<path d="M18 3L8 18h8l-2 11 10-15h-8z"/>'),
    saved: svg('<path d="M8 5h16v22l-8-5.5L8 27z"/>'),
    gear: svg('<path d="M5 9h13M24 9h3M5 23h3M14 23h13"/><circle cx="21" cy="9" r="3"/><circle cx="11" cy="23" r="3"/>'),
    back: svg('<path d="M20 6l-10 10 10 10"/>'),
    play: svg('<path d="M10 6l15 10-15 10z" fill="currentColor"/>'),
    pause: svg('<path d="M11 6v20M21 6v20"/>'),
    trash: svg('<path d="M6 9h20M13 9V5h6v4M9 9l1 18h12l1-18"/>'),
    reset: svg('<path d="M6 16a10 10 0 1 0 3-7.1"/><path d="M6 5v5h5"/>'),
    history: svg('<path d="M5 26V6M5 26h22"/><path d="M9 20l5-6 4 3 7-9"/>'),
    trophy: svg('<path d="M10 5h12v7a6 6 0 0 1-12 0zM10 8H5v2a5 5 0 0 0 5 5M22 8h5v2a5 5 0 0 1-5 5M16 18v5M11 27h10"/>'),
    share: svg('<path d="M16 21V5M10 11l6-6 6 6M6 17v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8"/>'),
    camera: svg('<path d="M4 11a2 2 0 0 1 2-2h4l2-3h8l2 3h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="16" cy="17" r="5"/>'),
    image: svg('<rect x="4" y="6" width="24" height="20" rx="3"/><circle cx="12" cy="13" r="2.4"/><path d="M4 23l7-6 5 4 4-3 8 6"/>'),
    download: svg('<path d="M16 5v16M10 15l6 6 6-6M6 26h20"/>'),
    stop: svg('<rect x="8" y="8" width="16" height="16" rx="2" fill="currentColor"/>'),
    run: svg('<circle cx="20" cy="6" r="2.6"/><path d="M14 12l5-1 3 5 5 1M19 11l-3 6-5 3-3 5M16 17l4 4-1 6"/>'),
    file: svg('<path d="M8 4h11l6 6v18H8z"/><path d="M19 4v6h6M12 18h8M12 23h8"/>'),
    route: svg('<circle cx="8" cy="24" r="3"/><circle cx="24" cy="8" r="3"/><path d="M11 24h9a4 4 0 0 0 0-8h-8a4 4 0 0 1 0-8h9"/>')
  };

  /* ---------- router ---------- */
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var q = {}, qi = h.indexOf('?');
    if (qi > -1) { h.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }); h = h.slice(0, qi); }
    var parts = h.split('/').filter(Boolean);
    return { parts: parts, q: q };
  }
  function render() {
    runGuard = null;
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    closeInfo();
    var r = route(), p = r.parts;
    window.scrollTo(0, 0);
    if (!p.length) return viewHome();
    if (p[0] === 'config' && T.getMode(p[1])) return viewConfig(p[1]);
    if (p[0] === 'presets') return viewPresets(p[1]);
    if (p[0] === 'preset' && p[1]) return viewPresetForm(p[1]);
    if (p[0] === 'running') return window.RunUI.route(p.slice(1), r.q);
    if (p[0] === 'run') return viewRun();
    if (p[0] === 'share') return viewShare(p[1] === 'new');
    if (p[0] === 'history') return viewHistory();
    if (p[0] === 'exercises') return viewExercises();
    if (p[0] === 'exercise' && p[1]) return viewExerciseForm(p[1]);
    if (p[0] === 'settings') return viewSettings();
    viewHome();
  }
  window.addEventListener('hashchange', function () {
    if (runGuard && location.hash !== guardHash) {          // atrás (botón o gesto) con un entreno en marcha: se vuelve al entreno y se pregunta
      var target = location.hash;
      history.pushState(null, '', guardHash);                // sin disparar hashchange: la vista del entreno sigue intacta
      runGuard(target); return;
    }
    render();
  });

  function header(title, opts) {
    opts = opts || {};
    return '<div class="top">' +
      '<button class="icon-btn" data-nav="' + (opts.back || '#/') + '" aria-label="Volver">' + ICON.back + '</button>' +
      '<h1 class="title grow">' + esc(title) + '</h1></div>';
  }
  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-nav]');
    if (n) go(n.getAttribute('data-nav'));
  });

  /* ---------- Inicio ---------- */
  function viewHome() {
    var s = Store.settings();
    var html = '<div class="screen">' +
      '<div class="top"><div class="grow"><div class="wordmark"><span class="four">4</span>TIMER</div>' +
      (s.gymName ? '<div class="gymname">' + esc(s.gymName) + '</div>' : '') + '</div>' +
      '<img class="gym-logo" src="' + esc(logoSrc()) + '" alt="' + esc(s.gymName || 'Logo del gimnasio') + '">' +
      '<button class="icon-btn" data-nav="#/settings" aria-label="Ajustes">' + ICON.gear + '</button></div>' +
      '<p class="sr-only">Elige el tipo de entrenamiento</p><ul class="modes">';
    function modeCard(m) {
      return '<li><button class="card" data-nav="#/config/' + m.id + '"><span>' + ICON[m.id] + '</span><span><span class="c-title">' + esc(m.name) + '</span><span class="c-desc">' + esc(m.desc) + '</span></span></button></li>';
    }
    html += '<li><button class="card accent" data-nav="#/presets"><span>' + ICON.presets + '</span><span><span class="c-title">Entrenamientos predefinidos</span><span class="c-desc">Los entrenos del box con el tiempo ya configurado. Toca y empieza, o crea el tuyo.</span></span></button></li>';
    var sess = Store.session();
    if (sess && !T.getMode(sess.pending.mode)) { Store.clearSession(); sess = null; }
    if (sess) html += '<li><button class="card accent" id="resume-btn"><span>' + ICON.play + '</span><span><span class="c-title">Retomar entreno</span><span class="c-desc">' + esc(sess.pending.name) + ' · pausado en ' + T.fmt(Math.floor(sess.elapsed / 1000)) + '</span></span></button>' +
      '<button class="btn small block" id="resume-del" style="margin-top:6px">Descartar el entreno guardado</button></li>';
    T.MODES.forEach(function (m) {
      if (m.id === 'counter') html += '<li><button class="card" data-nav="#/running"><span>' + ICON.run + '</span><span><span class="c-title">Running</span><span class="c-desc">Carrera con GPS: tiempo, km, ritmo y recorrido. Series y programas por semanas.</span></span></button></li>';
      html += modeCard(m);
    });
    html += '<li><button class="card" data-nav="#/exercises"><span>' + ICON.exercises + '</span><span><span class="c-title">Ejercicios</span><span class="c-desc">Todos los ejercicios guardados y qué es cada uno.</span></span></button></li>';
    html += '<li><button class="card" data-nav="#/history"><span>' + ICON.history + '</span><span><span class="c-title">Historial</span><span class="c-desc">Tus resultados y marcas personales. Repite un entreno y compara.</span></span></button></li>';
    html += '<li><button class="card" data-nav="#/share/new"><span>' + ICON.share + '</span><span><span class="c-title">Compartir entreno</span><span class="c-desc">Crea la imagen de un entreno hecho con el reloj y la pizarra de clase: resultado, texto y fotos.</span></span></button></li>';
    app.innerHTML = html + '</ul></div>';
    if (sess) {
      $('#resume-btn').addEventListener('click', function () {
        pending = sess.pending; resume = { elapsed: sess.elapsed, rounds: sess.rounds || 0 };
        Store.clearSession(); Sound.unlock(); go('#/run');
      });
      $('#resume-del').addEventListener('click', function () { if (window.confirm('¿Descartar el entreno guardado?')) { Store.clearSession(); viewHome(); } });
    }
  }

  /* ---------- Campos de configuración (compartidos por Config y Predefinidos) ---------- */
  function minSec(f) { return f.k === 'cap' || f.k === 'rest' ? 0 : 1; }
  function fieldHtml(f) {
    if (f.type === 'num') {
      return '<div class="field"><div class="flabel">' + esc(f.label) + '</div><div class="time-ctl"><div class="step">' +
        '<button data-f="' + f.k + '" data-d="-1" aria-label="Menos">−</button><output id="o-' + f.k + '"></output>' +
        '<button data-f="' + f.k + '" data-d="1" aria-label="Más">+</button></div></div></div>';
    }
    return '<div class="field"><div class="flabel">' + esc(f.label) + '</div><div class="time-ctl">' +
      '<div class="step"><button data-f="' + f.k + '" data-p="m" data-d="-1" aria-label="Menos minutos">−</button><output id="o-' + f.k + '-m"></output><button data-f="' + f.k + '" data-p="m" data-d="1" aria-label="Más minutos">+</button><span class="unit">min</span></div>' +
      '<div class="step"><button data-f="' + f.k + '" data-p="s" data-d="-1" aria-label="Menos segundos">−</button><output id="o-' + f.k + '-s"></output><button data-f="' + f.k + '" data-p="s" data-d="1" aria-label="Más segundos">+</button><span class="unit">s</span></div></div></div>';
  }
  function fieldsHtml(mode) { return mode.fields.map(fieldHtml).join(''); }
  function refreshFields(mode, cfg) {
    mode.fields.forEach(function (f) {
      if (f.type === 'num') { $('#o-' + f.k).textContent = cfg[f.k]; }
      else { $('#o-' + f.k + '-m').textContent = pad(Math.floor(cfg[f.k] / 60)); $('#o-' + f.k + '-s').textContent = pad(cfg[f.k] % 60); }
    });
  }
  function totalHtml(modeId, cfg) {
    if (modeId === 'fortime') return cfg.cap ? 'Time cap: <b>' + T.fmt(cfg.cap) + '</b>' : 'Sin time cap: el reloj cuenta hacia arriba';
    return 'Duración total: <b>' + T.fmt(T.buildPlan(modeId, cfg).total) + '</b>';
  }
  /* Aplica un clic en un botón −/+ al valor de cfg. Devuelve true si lo era. */
  function stepField(mode, cfg, target) {
    var b = target.closest('[data-f]');
    if (!b) return false;
    var f = mode.fields.filter(function (x) { return x.k === b.dataset.f; })[0], d = +b.dataset.d;
    if (!f) return false;
    if (f.type === 'num') {
      cfg[f.k] = Math.max(f.min, Math.min(f.max, cfg[f.k] + d));
    } else {
      var m = Math.floor(cfg[f.k] / 60), sec = cfg[f.k] % 60;
      if (b.dataset.p === 'm') m = Math.max(0, Math.min(99, m + d));
      else sec = Math.max(0, Math.min(55, sec + d * 5));
      cfg[f.k] = Math.max(minSec(f), m * 60 + sec);
    }
    return true;
  }

  /* ---------- Configuración de un modo ---------- */
  function viewConfig(modeId) {
    var mode = T.getMode(modeId);
    if (modeId === 'counter') {
      pending = { mode: modeId, cfg: {}, name: mode.name }; Sound.unlock(); return go('#/run');
    }
    var cfg = Store.config(modeId);

    app.innerHTML = '<div class="screen">' + header(mode.name) +
      '<p class="lead">' + esc(mode.desc) + '</p>' +
      '<div class="panel">' + fieldsHtml(mode) + '</div>' +
      '<div class="total" id="total"></div>' +
      '<button class="btn primary block" id="start">' + ICON.play + 'Empezar</button></div>';

    function refresh() { refreshFields(mode, cfg); $('#total').innerHTML = totalHtml(modeId, cfg); }
    refresh();

    function onStep(e) { if (stepField(mode, cfg, e.target)) refresh(); }
    app.addEventListener('click', onStep);
    cleanup = function () { app.removeEventListener('click', onStep); };
    $('#start').addEventListener('click', function () {
      Store.setConfig(modeId, cfg);
      pending = { mode: modeId, cfg: Object.assign({}, cfg), name: mode.name };
      Sound.unlock();
      go('#/run');
    });
  }

  /* ---------- Ficha de información de un ejercicio (i) ---------- */
  var sheetEl = null, sheetKey = null;
  function closeInfo() {
    if (sheetEl) { sheetEl.remove(); sheetEl = null; }
    if (sheetKey) { document.removeEventListener('keydown', sheetKey); sheetKey = null; }
  }
  function showInfo(id) {
    var e = Store.getExercise(id);
    if (!e) return;
    closeInfo();
    sheetEl = document.createElement('div');
    sheetEl.className = 'sheet-back';
    sheetEl.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t"><h2 id="sh-t">' + esc(e.name) + '</h2>' +
      '<p>' + (e.desc ? esc(e.desc) : 'Todavía no tiene explicación. Puedes añadirla en Ejercicios.') + '</p>' +
      '<button class="btn primary block" data-close>Entendido</button></div>';
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click', function (ev) { if (ev.target === sheetEl || ev.target.closest('[data-close]')) closeInfo(); });
    sheetKey = function (ev) { if (ev.key === 'Escape') closeInfo(); };
    document.addEventListener('keydown', sheetKey);
    var btn = sheetEl.querySelector('[data-close]'); if (btn) btn.focus();
  }
  document.addEventListener('click', function (e) {
    var i = e.target.closest('[data-info]');
    if (i) { e.preventDefault(); showInfo(i.getAttribute('data-info')); }
  });

  function exName(id) { var e = Store.getExercise(id); return e ? e.name : '(ejercicio borrado)'; }
  function infoBtn(id) {
    if (!Store.getExercise(id)) return '';
    return '<button class="info-btn" data-info="' + esc(id) + '" aria-label="Qué es ' + esc(exName(id)) + '">' + ICON.info + '</button>';
  }
  /* Lista de ejercicios de un entreno, cada uno con su (i) */
  function linesHtml(pr) {
    var n = 0, h = '<ul class="ex-lines">';
    pr.lines.forEach(function (l) {
      if (l.t === 'txt') { h += '<li class="ex-txt">' + esc(l.text) + '</li>'; return; }
      n++;
      h += '<li class="ex-line" data-ei="' + (n - 1) + '">' + (pr.numbered ? '<span class="ex-n">' + n + '.</span>' : '') +
        l.parts.map(function (pt) {
          return '<span class="ex-part">' + (pt.qty ? '<b class="ex-q">' + esc(pt.qty) + '</b> ' : '') +
            '<span class="ex-name">' + esc(exName(pt.ex)) + '</span>' + infoBtn(pt.ex) + '</span>';
        }).join('<span class="ex-plus"> + </span>') +
        (l.note ? ' <span class="ex-note">' + esc(l.note) + '</span>' : '') + '</li>';
    });
    return h + '</ul>';
  }

  /* ---------- Entrenamientos predefinidos ---------- */
  var CATS = [
    { id: 'emom', name: 'EMOM', desc: 'Un ejercicio cada minuto' },
    { id: 'amrap', name: 'AMRAP', desc: 'Máximas rondas en un tiempo' },
    { id: 'fortime', name: 'For Time', desc: 'Completar el trabajo lo más rápido posible' },
    { id: 'partners', name: 'Partners', desc: 'Entrenos por parejas' },
    { id: 'otros', name: 'Otros', desc: 'Tabata, intervalos y demás' }
  ];
  function catOf(it) {
    if (/partner/i.test(it.name)) return 'partners';
    if (it.mode === 'emom') return 'emom';
    if (it.mode === 'amrap' || it.mode === 'amrapx') return 'amrap';
    if (it.mode === 'fortime') return 'fortime';
    return 'otros';
  }
  function viewPresets(cat) {
    var all = Store.presets(), html;
    var info = CATS.filter(function (c) { return c.id === cat; })[0];
    if (!info) {      // lista de categorías
      html = '<div class="screen">' + header('Entrenamientos predefinidos') +
        '<p class="lead">Elige el tipo de entrenamiento para ver su lista.</p>' +
        '<button class="btn primary block" data-nav="#/preset/new" style="margin-bottom:14px">' + ICON.plus + 'Crear entrenamiento</button><ul class="modes">';
      CATS.forEach(function (c) {
        var n = all.filter(function (it) { return catOf(it) === c.id; }).length;
        if (!n && c.id === 'otros') return;
        html += '<li><button class="card" data-nav="#/presets/' + c.id + '"><span>' + (ICON[c.id] || ICON.presets) + '</span><span><span class="c-title">' + esc(c.name) + '</span><span class="c-desc">' + esc(c.desc) + ' · ' + n + (n === 1 ? ' entreno' : ' entrenos') + '</span></span></button></li>';
      });
      html += '</ul><button class="btn small block" id="restore" style="margin-top:10px">Restaurar ejemplos borrados</button></div>';
    } else {
      var items = all.filter(function (it) { return catOf(it) === cat; });
      html = '<div class="screen">' + header(info.name, { back: '#/presets' }) +
        '<p class="lead">Toca Empezar y el reloj arranca. Con (i) ves qué es cada ejercicio.</p>' +
        '<button class="btn primary block" data-nav="#/preset/new" style="margin-bottom:14px">' + ICON.plus + 'Crear entrenamiento</button>';
      if (!items.length) html += '<div class="empty">No hay entrenos en esta lista.</div>';
      items.forEach(function (it) {
        var m = T.getMode(it.mode);
        html += '<article class="preset"><div class="p-name">' + esc(it.name) + '</div>' +
          '<div class="p-tags"><span class="chip">' + esc(m ? m.name : it.mode) + '</span><span class="chip">' + esc(T.summary(it.mode, it.cfg)) + '</span></div>' +
          (it.lines.length ? linesHtml(it) : '') +
          '<div class="p-actions"><button class="btn primary small" data-prun="' + it.id + '">' + ICON.play + 'Empezar</button>' +
          '<button class="icon-btn" data-nav="#/preset/' + it.id + '" aria-label="Editar ' + esc(it.name) + '">' + ICON.edit + '</button>' +
          '<button class="icon-btn" data-pdel="' + it.id + '" aria-label="Borrar ' + esc(it.name) + '">' + ICON.trash + '</button></div></article>';
      });
      html += '</div>';
    }
    app.innerHTML = html;

    function onClick(e) {
      var r = e.target.closest('[data-prun]'), d = e.target.closest('[data-pdel]');
      if (r) {
        var it = Store.getPreset(r.dataset.prun);
        if (!it) return;
        var err = T.validateLines(it.mode, it.cfg, it.lines);
        if (err) { toast('Error: ' + err); return; }
        pending = { mode: it.mode, cfg: Object.assign(T.defaultConfig(it.mode), it.cfg), name: it.name, lines: it.lines, numbered: !!it.numbered, presetId: it.id };
        Sound.unlock(); go('#/run');
      } else if (d) {
        var item = Store.getPreset(d.dataset.pdel);
        if (item && window.confirm('¿Borrar "' + item.name + '"?')) { Store.removePreset(item.id); viewPresets(cat); toast('Entreno borrado'); }
      } else if (e.target.closest('#restore')) {
        var n = Store.restorePresets(); viewPresets(cat); toast(n ? 'Ejemplos restaurados: ' + n : 'No faltaba ningún ejemplo');
      }
    }
    app.addEventListener('click', onClick);
    cleanup = function () { app.removeEventListener('click', onClick); };
  }

  function viewPresetForm(id) {
    var editing = id !== 'new' ? Store.getPreset(id) : null;
    if (id !== 'new' && !editing) return go('#/presets');
    var types = T.MODES.filter(function (m) { return m.id !== 'counter'; });
    var st = editing
      ? { name: editing.name, mode: editing.mode, cfg: Object.assign(T.defaultConfig(editing.mode), editing.cfg), numbered: !!editing.numbered, lines: JSON.parse(JSON.stringify(editing.lines)) }
      : { name: '', mode: 'emom', cfg: Store.config('emom'), numbered: false, lines: [] };

    app.innerHTML = '<div class="screen">' + header(editing ? 'Editar entrenamiento' : 'Crear entrenamiento', { back: '#/presets' }) +
      '<div class="panel"><div class="field"><div class="flabel">Nombre</div><input class="text-in" id="p-name" maxlength="60" autocomplete="off" placeholder="Ej. EMOM 12\' · Piernas" value="' + esc(st.name) + '"></div>' +
      '<div class="field"><div class="flabel">Tipo de entreno</div><select class="text-in" id="p-mode">' +
      types.map(function (m) { return '<option value="' + m.id + '"' + (m.id === st.mode ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="panel" id="p-fields"></div><div class="total" id="total"></div>' +
      '<div class="error" id="p-err" role="alert" hidden></div>' +
      '<div class="panel"><h2>Ejercicios</h2>' +
      '<p class="hint">Elige los ejercicios de tu lista. Las repeticiones, calorías o metros los escribes tú a mano.</p>' +
      '<label class="switch"><span>Numerar los ejercicios (1., 2., 3.…)</span><input type="checkbox" id="p-num"' + (st.numbered ? ' checked' : '') + '></label>' +
      '<div id="p-lines"></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn small" id="add-ex">' + ICON.plus + 'Ejercicio</button><button class="btn small" id="add-txt">' + ICON.plus + 'Texto</button></div></div>' +
      '<button class="btn primary block" id="p-save">' + ICON.saved + 'Guardar</button></div>';

    function mountFields() { $('#p-fields').innerHTML = fieldsHtml(T.getMode(st.mode)); refresh(); }
    function refresh() { var mode = T.getMode(st.mode); refreshFields(mode, st.cfg); $('#total').innerHTML = totalHtml(st.mode, st.cfg); updateError(); }
    function updateError() {
      var err = T.validateLines(st.mode, st.cfg, st.lines.filter(function (l) { return l.t === 'txt' || l.parts.some(function (p) { return p.ex; }); }));
      var el = $('#p-err'); el.hidden = !err; el.textContent = err ? 'Error: ' + err : '';
      return err;
    }

    function optionsHtml(sel) {
      return '<option value="">Elige un ejercicio…</option>' + Store.exercises().map(function (e) {
        return '<option value="' + esc(e.id) + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.name) + '</option>';
      }).join('');
    }
    function mountLines() {
      var h = '';
      if (!st.lines.length) h += '<div class="empty" style="margin:12px 0 0">Aún no hay ejercicios. Toca "+ Ejercicio".</div>';
      st.lines.forEach(function (l, i) {
        h += '<div class="ed-line" data-li="' + i + '"><div class="ed-head"><span class="ed-title">' + (l.t === 'txt' ? 'Texto' : 'Ejercicio') + '</span><span class="ed-btns">' +
          '<button class="icon-btn mini" data-act="up" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
          '<button class="icon-btn mini" data-act="down" aria-label="Bajar"' + (i === st.lines.length - 1 ? ' disabled' : '') + '>' + ICON.down + '</button>' +
          '<button class="icon-btn mini" data-act="del" aria-label="Quitar">' + ICON.trash + '</button></span></div>';
        if (l.t === 'txt') {
          h += '<input class="text-in" data-k="text" maxlength="80" placeholder="Texto libre: 21-15-9, Buy out…" value="' + esc(l.text) + '">';
        } else {
          l.parts.forEach(function (pt, pi) {
            h += '<div class="ed-part" data-pi="' + pi + '"><input class="text-in qty" data-k="qty" maxlength="20" placeholder="Reps / cal / m" value="' + esc(pt.qty) + '" aria-label="Repeticiones, calorías o metros">' +
              '<select class="text-in" data-k="ex" aria-label="Ejercicio">' + optionsHtml(pt.ex) + '</select>' +
              (pt.ex ? infoBtn(pt.ex) : '') +
              (l.parts.length > 1 ? '<button class="icon-btn mini" data-act="delpart" aria-label="Quitar este ejercicio">' + ICON.trash + '</button>' : '') + '</div>';
          });
          h += '<button class="btn small" data-act="addpart" style="margin:8px 0">' + ICON.plus + 'Otro ejercicio en la misma línea</button>' +
            '<input class="text-in" data-k="note" maxlength="40" placeholder="Nota (opcional): juntos, heavy…" value="' + esc(l.note || '') + '">';
        }
        h += '</div>';
      });
      $('#p-lines').innerHTML = h;
      updateError();
    }
    mountFields(); mountLines();

    function onClick(e) {
      if (stepField(T.getMode(st.mode), st.cfg, e.target)) { refresh(); return; }
      var act = e.target.closest('[data-act]');
      if (!act || act.disabled) return;
      var lineEl = act.closest('.ed-line'), i = lineEl ? +lineEl.dataset.li : -1, a = act.dataset.act;
      if (a === 'up' && i > 0) { var t = st.lines[i - 1]; st.lines[i - 1] = st.lines[i]; st.lines[i] = t; }
      else if (a === 'down' && i < st.lines.length - 1) { var t2 = st.lines[i + 1]; st.lines[i + 1] = st.lines[i]; st.lines[i] = t2; }
      else if (a === 'del') st.lines.splice(i, 1);
      else if (a === 'addpart') st.lines[i].parts.push({ ex: '', qty: '' });
      else if (a === 'delpart') st.lines[i].parts.splice(+act.closest('.ed-part').dataset.pi, 1);
      mountLines();
    }
    function onInput(e) {
      var t = e.target;
      if (t.id === 'p-name') { st.name = t.value; return; }
      if (t.id === 'p-num') { st.numbered = t.checked; return; }
      if (t.id === 'p-mode') {
        st.mode = t.value;
        st.cfg = (editing && editing.mode === st.mode) ? Object.assign(T.defaultConfig(st.mode), editing.cfg) : Store.config(st.mode);
        mountFields(); return;
      }
      var lineEl = t.closest('.ed-line');
      if (!lineEl || !t.dataset.k) return;
      var l = st.lines[+lineEl.dataset.li], k = t.dataset.k;
      if (k === 'text') l.text = t.value;
      else if (k === 'note') l.note = t.value;
      else {
        var pt = l.parts[+t.closest('.ed-part').dataset.pi];
        pt[k] = t.value;
        if (k === 'ex') mountLines();   // para mostrar el (i) del ejercicio elegido y revisar el error
      }
    }
    app.addEventListener('click', onClick);
    app.addEventListener('input', onInput);
    app.addEventListener('change', onInput);
    cleanup = function () { app.removeEventListener('click', onClick); app.removeEventListener('input', onInput); app.removeEventListener('change', onInput); };

    $('#add-ex').addEventListener('click', function () { st.lines.push({ t: 'ex', parts: [{ ex: '', qty: '' }], note: '' }); mountLines(); });
    $('#add-txt').addEventListener('click', function () { st.lines.push({ t: 'txt', text: '' }); mountLines(); });
    $('#p-save').addEventListener('click', function () {
      var name = st.name.trim();
      if (!name) { toast('Ponle un nombre al entreno'); $('#p-name').focus(); return; }
      var lines = [], bad = false;
      st.lines.forEach(function (l) {
        if (l.t === 'txt') { if (l.text.trim()) lines.push({ t: 'txt', text: l.text.trim() }); return; }
        var parts = [];
        l.parts.forEach(function (pt) {
          if (pt.ex) parts.push({ ex: pt.ex, qty: pt.qty.trim() });
          else if (pt.qty.trim()) bad = true;
        });
        if (parts.length) lines.push({ t: 'ex', parts: parts, note: (l.note || '').trim() });
      });
      if (bad) { toast('Hay una línea con cantidad pero sin ejercicio'); return; }
      var verr = T.validateLines(st.mode, st.cfg, lines);
      if (verr) { toast('Error: ' + verr); $('#p-err').scrollIntoView && $('#p-err').scrollIntoView({ block: 'center' }); return; }
      var data = { name: name, mode: st.mode, cfg: Object.assign({}, st.cfg), numbered: st.numbered, lines: lines };
      if (editing) Store.updatePreset(editing.id, data); else Store.addPreset(data);
      toast('Entreno guardado'); go('#/presets/' + catOf(data));
    });
  }

  /* ---------- Ejercicios ---------- */
  function viewExercises() {
    var q = '';
    app.innerHTML = '<div class="screen">' + header('Ejercicios') +
      '<p class="lead">Todos los ejercicios guardados y qué es cada uno. Los usas al crear entrenamientos predefinidos.</p>' +
      '<button class="btn primary block" data-nav="#/exercise/new" style="margin-bottom:12px">' + ICON.plus + 'Añadir ejercicio</button>' +
      '<input class="text-in" id="ex-q" type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" autocomplete="off" style="margin-bottom:12px">' +
      '<div id="ex-list"></div>' +
      '<button class="btn small block" id="ex-restore" style="margin-top:6px">Restaurar ejercicios de serie</button></div>';

    function norm(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function mountList() {
      var list = Store.exercises().filter(function (e) { return !q || norm(e.name + ' ' + e.desc).indexOf(norm(q)) > -1; });
      var h = '';
      if (!list.length) h = '<div class="empty">' + (q ? 'Ningún ejercicio coincide con la búsqueda.' : 'Aún no hay ejercicios. Añade el primero.') + '</div>';
      list.forEach(function (e) {
        h += '<article class="ex-card"><div class="ex-head"><div class="p-name">' + esc(e.name) + '</div><div class="ex-actions">' +
          '<button class="icon-btn" data-nav="#/exercise/' + esc(e.id) + '" aria-label="Editar ' + esc(e.name) + '">' + ICON.edit + '</button>' +
          '<button class="icon-btn" data-xdel="' + esc(e.id) + '" aria-label="Borrar ' + esc(e.name) + '">' + ICON.trash + '</button></div></div>' +
          '<p class="ex-desc">' + (e.desc ? esc(e.desc) : 'Sin explicación todavía.') + '</p></article>';
      });
      $('#ex-list').innerHTML = h;
    }
    mountList();
    function onInput(e) { if (e.target.id === 'ex-q') { q = e.target.value.trim(); mountList(); } }
    function onClick(e) {
      var d = e.target.closest('[data-xdel]');
      if (d) {
        var ex = Store.getExercise(d.dataset.xdel);
        if (!ex) return;
        var used = Store.exerciseUsage(ex.id);
        if (used.length) { toast('No se puede borrar: lo usa ' + used[0] + (used.length > 1 ? ' y ' + (used.length - 1) + ' más' : '')); return; }
        if (window.confirm('¿Borrar "' + ex.name + '"?')) { Store.removeExercise(ex.id); mountList(); toast('Ejercicio borrado'); }
      } else if (e.target.closest('#ex-restore')) {
        var n = Store.restoreExercises(); mountList(); toast(n ? 'Ejercicios restaurados: ' + n : 'No faltaba ninguno');
      }
    }
    app.addEventListener('input', onInput);
    app.addEventListener('click', onClick);
    cleanup = function () { app.removeEventListener('input', onInput); app.removeEventListener('click', onClick); };
  }

  function viewExerciseForm(id) {
    var editing = id !== 'new' ? Store.getExercise(id) : null;
    if (id !== 'new' && !editing) return go('#/exercises');
    app.innerHTML = '<div class="screen">' + header(editing ? 'Editar ejercicio' : 'Añadir ejercicio', { back: '#/exercises' }) +
      '<div class="panel"><div class="field"><div class="flabel">Nombre</div><input class="text-in" id="x-name" maxlength="50" autocomplete="off" placeholder="Ej. Thruster" value="' + esc(editing ? editing.name : '') + '"></div>' +
      '<div class="field"><div class="flabel">Qué es y cómo se hace</div><textarea class="text-in" id="x-desc" rows="6" maxlength="500" placeholder="Explicación en español">' + esc(editing ? editing.desc : '') + '</textarea></div></div>' +
      '<button class="btn primary block" id="x-save">' + ICON.saved + 'Guardar</button></div>';
    $('#x-save').addEventListener('click', function () {
      var name = $('#x-name').value.trim(), desc = $('#x-desc').value.trim();
      if (!name) { toast('Ponle un nombre al ejercicio'); $('#x-name').focus(); return; }
      var dup = Store.exercises().filter(function (e) { return e.name.toLowerCase() === name.toLowerCase() && (!editing || e.id !== editing.id); })[0];
      if (dup) { toast('Ya existe un ejercicio con ese nombre'); return; }
      if (editing) Store.updateExercise(editing.id, { name: name, desc: desc }); else Store.addExercise({ name: name, desc: desc });
      toast('Ejercicio guardado'); go('#/exercises');
    });
  }

  /* ---------- Pantalla del reloj ---------- */
  function wakeLock() {
    var lock = null, alive = true;
    function acquire() {
      if (!alive || !navigator.wakeLock) return;
      navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
    }
    function onVis() { if (document.visibilityState === 'visible') acquire(); }
    document.addEventListener('visibilitychange', onVis);
    acquire();
    return function () { alive = false; document.removeEventListener('visibilitychange', onVis); if (lock) lock.release().catch(function () {}); };
  }

  function runShell(label, extraBlue, panel) {
    return '<div class="screen run" data-type="prep">' +
      '<div class="top"><button class="icon-btn" id="exit" aria-label="Salir">' + ICON.back + '</button>' +
      '<div class="grow"><div class="gymname" style="margin:0">' + esc(label) + '</div></div>' +
      '<img class="gym-logo" src="' + esc(logoSrc()) + '" alt=""></div>' +
      '<h1 class="sr-only">Temporizador</h1><div class="phase" id="phase" aria-live="polite"></div>' +
      '<div class="run-body"><div class="stage"><div class="bezel"><div class="display">' +
      '<div class="led" id="led-blue" role="img" aria-label="Rondas"></div>' +
      '<div class="led" id="led-red" role="img" aria-label="Tiempo"></div></div></div></div>' + (panel || '') + '</div>' + extraBlue;
  }

  function viewCounter() {
    var count = Store.counter();
    app.innerHTML = '<div class="screen run counter-screen" data-type="work">' +
      '<div class="top"><button class="icon-btn" id="exit" aria-label="Salir">' + ICON.back + '</button>' +
      '<div class="grow"><div class="gymname" style="margin:0">Contador de rondas</div></div>' +
      '<img class="gym-logo" src="' + esc(logoSrc()) + '" alt=""></div>' +
      '<h1 class="sr-only">Contador de rondas</h1><div class="phase" id="phase">Rondas</div>' +
      '<div class="stage"><div class="bezel"><div class="display"><div class="led" id="led-blue" role="img" aria-label="Rondas"></div></div></div></div>' +
      '<div class="counter-ctl"><button class="btn" id="minus" aria-label="Quitar una ronda">−</button>' +
      '<button class="btn plus" id="plus" aria-label="Sumar una ronda">+1</button></div>' +
      '<button class="btn block" id="reset" style="margin-top:10px">' + ICON.reset + 'Poner a cero</button></div>';
    var blue = new window.LED($('#led-blue'), 'DD');
    function draw() { blue.set(pad(count)); }
    function add(d) {
      count = Math.max(0, Math.min(99, count + d));
      Store.setCounter(count); draw();
      if (d > 0 && navigator.vibrate && Store.settings().vibrate) navigator.vibrate(30);
    }
    draw();
    $('#plus').addEventListener('click', function () { add(1); });
    $('#minus').addEventListener('click', function () { add(-1); });
    $('#led-blue').addEventListener('click', function () { add(1); });
    $('#reset').addEventListener('click', function () { if (count === 0 || window.confirm('¿Poner el contador a cero?')) { count = 0; Store.setCounter(0); draw(); } });
    $('#exit').addEventListener('click', function () { go('#/'); });
    var wl = wakeLock();
    var unfit = window.LED.autoFit($('.stage'), $('.display'), $('.bezel'), 120);
    cleanup = function () { wl(); unfit(); };
  }

  function viewRun() {
    if (!pending) return go('#/');
    if (pending.mode === 'counter') return viewCounter();
    var mode = T.getMode(pending.mode), cfg = pending.cfg;
    var plan = T.buildPlan(pending.mode, cfg);
    var settings = Store.settings(), prep = settings.prep;
    var manual = plan.manual;

    var controls = '';
    if (manual) {
      controls += '<div class="rounds-bar"><button class="btn" id="minus" aria-label="Quitar una ronda">−</button>' +
        '<div class="r-label">Rondas</div><button class="btn plus" id="plus" aria-label="Sumar una ronda">+1</button></div>';
    }
    controls += '<div class="controls"><button class="btn" id="reset">' + ICON.reset + 'Reiniciar</button>' +
      '<button class="btn primary main" id="pause">' + ICON.pause + '<span>Pausa</span></button>' +
      '<button class="btn danger" id="finish">' + ICON.stop + 'Terminar</button></div></div>';

    var hasLines = pending.lines && pending.lines.length;
    var panel = hasLines ? '<aside class="ex-panel" aria-label="Ejercicios del entreno">' + linesHtml({ lines: pending.lines, numbered: pending.numbered }) + '</aside>' : '';
    app.innerHTML = runShell(pending.name.toLowerCase().indexOf(mode.name.toLowerCase()) === 0 ? pending.name : mode.name + ' · ' + pending.name, controls, panel);

    /* En EMOM, intervalos, tabata y trabajo=descanso: en rojo el ejercicio que toca y, al cambiar de ronda, salta al siguiente */
    var exEls = $$('.ex-line'), rotating = hasLines && exEls.length && T.ROTATING.indexOf(pending.mode) > -1;
    var markIdx = -2, markKind = '';
    function markExercise(cur) {
      if (!rotating) return;
      var n = exEls.length, idx = -1, kind = '';
      if (cur.phase === 'prep') { idx = 0; kind = 'next'; }
      else if (cur.phase === 'run') {
        if (cur.type === 'rest') { idx = cur.round % n; kind = 'next'; }
        else { idx = (cur.round - 1) % n; kind = 'now'; }
      }
      if (idx === markIdx && kind === markKind) return;
      markIdx = idx; markKind = kind;
      exEls.forEach(function (el, i) {
        el.classList.toggle('now', i === idx && kind === 'now');
        el.classList.toggle('next', i === idx && kind === 'next');
      });
      if (idx > -1 && exEls[idx].scrollIntoView) exEls[idx].scrollIntoView({ block: 'nearest' });
    }

    var run = $('.run');
    var blue = new window.LED($('#led-blue'), 'DD'), red = new window.LED($('#led-red'), 'DD:DD');
    var startedAt, pausedTotal, pausedAt, prev, rounds, frozen, finished;

    function reset() {
      startedAt = performance.now(); pausedTotal = 0; pausedAt = null; prev = null; rounds = 0; frozen = null; finished = false;
      run.classList.remove('paused'); shareMode = false; armGuard(askLeave);
      setPauseBtn(false);
      $('#pause').disabled = false;
      markIdx = -2; markKind = '';
      if (typeof rewind === 'function') rewind();
    }
    function elapsed() {
      if (frozen !== null) return frozen;
      var now = pausedAt !== null ? pausedAt : performance.now();
      return now - startedAt - pausedTotal;
    }
    function setPauseBtn(paused) {
      $('#pause').innerHTML = (paused ? ICON.play : ICON.pause) + '<span>' + (paused ? 'Reanudar' : 'Pausa') + '</span>';
    }
    function fmtDisplay(sec) {
      sec = Math.min(sec, 99 * 60 + 59);
      return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
    }
    function draw(cur) {
      run.dataset.type = cur.phase === 'run' ? (cur.type === 'rest' ? 'rest' : 'work') : cur.phase === 'done' ? 'done' : 'prep';
      red.set(fmtDisplay(cur.display));
      blue.set(pad(manual ? rounds : cur.round));
      var label = cur.label;
      if (cur.phase === 'run' && plan.kind === 'segments' && !manual && cur.type !== 'rest') {
        // Muestra "Ronda x de y" en los modos por rondas
        var totalRounds = plan.segments.length ? plan.segments[plan.segments.length - 1].round : 0;
        if (totalRounds > 1 && pending.mode !== 'rest') label = cur.label + ' · ronda ' + cur.round + '/' + totalRounds;
      }
      $('#phase').textContent = label;
      markExercise(cur);
    }
    var shareMode = false;
    /* Sonidos: se programan por adelantado en el reloj de audio (12 s de margen), así suenan exactos
       aunque la pantalla se apague o el navegador ralentice los temporizadores. Pausa/reinicio los cancelan. */
    var tl = T.timeline(plan, prep, { beepLast3: settings.beepLast3 }), tlIdx = 0, useSched = Sound.available(), LOOK = 12000;
    function schedule() {
      if (!useSched || finished || frozen !== null || pausedAt !== null) return;
      var el = elapsed();
      while (tlIdx < tl.length && tl[tlIdx].ms <= el + LOOK) {
        if (tl[tlIdx].ms >= el - 150) Sound.schedule(tl[tlIdx].ev, (tl[tlIdx].ms - el) / 1000);
        tlIdx++;
      }
    }
    function rewind() {
      Sound.cancelAll();
      var el = elapsed(); tlIdx = 0;
      while (tlIdx < tl.length && tl[tlIdx].ms < el - 150) tlIdx++;
    }
    function buildResult() {
      var id = pending.mode, sec = Math.max(0, Math.floor(elapsed() / 1000 - prep + 0.001));
      if (plan.total) sec = Math.min(sec, plan.total);
      if (plan.cap) sec = Math.min(sec, plan.cap);
      var rr = manual ? rounds : 0, res = { modeId: id, modeName: mode.name.toUpperCase(), name: pending.name, sec: sec, rounds: rr, date: dateEs() };
      var n = 0;
      res.lines = (pending.lines || []).map(function (l) {
        if (l.t === 'txt') return { num: '', parts: [{ qty: '', name: l.text }], note: '' };
        n++;
        return { num: pending.numbered ? n + '.' : '', parts: l.parts.map(function (pt) { return { qty: pt.qty || '', name: exName(pt.ex) }; }), note: l.note || '' };
      });
      if (id === 'amrap' || id === 'amrapx') { res.kind = 'rounds'; res.value = rr; res.label = 'RONDAS'; res.sub = 'en ' + T.fmt(sec); }
      else if (id === 'emom') {
        var iv = pending.cfg.interval || 60, nr = pending.cfg.rounds || 0;
        res.kind = 'text'; res.label = 'ENTRENO'; res.sub = 'Entreno completado';
        res.value = iv === 60 ? 'EMOM ' + nr + "'" : 'EMOM ' + nr + ' × ' + (iv % 60 ? iv + '"' : (iv / 60) + "'");
      }
      else if (id === 'fortime') {
        res.kind = 'time'; res.value = sec; res.label = 'TIEMPO';
        res.sub = rr > 0 ? rr + (rr === 1 ? ' ronda' : ' rondas') : (plan.cap ? 'Time cap ' + T.fmt(plan.cap) : 'Tiempo final');
      } else { res.kind = 'time'; res.value = sec; res.label = 'DURACIÓN'; res.sub = 'Entreno completado'; }
      lastResult = res;
    }
    function tick() {
      var cur = T.stateAt(plan, prep, elapsed());
      if (frozen !== null) cur = { phase: 'done', display: cur.display, remaining: 0, round: cur.round, type: 'done', label: 'Fin' };
      if (!finished) {
        if (!useSched) T.eventsFor(plan, prev, cur, { beepLast3: settings.beepLast3 }).forEach(function (ev) { Sound.play(ev); });
        prev = cur;
        if (cur.phase === 'done') finished = true;
      }
      draw(cur); schedule();
      if (finished && !shareMode) {
        shareMode = true; runGuard = null; buildResult();
        if (lastResult.sec >= 3 || lastResult.rounds > 0) {
          lastResult.presetId = pending.presetId || '';
          lastResult = Store.addResult(lastResult);
        }
        var b = $('#pause'); b.disabled = false; b.innerHTML = ICON.share + '<span>Compartir</span>';
        toast(lastResult.pr ? '¡Nueva marca personal!' : '¡Entreno terminado!');
      }
    }

    Sound.prepare();
    reset(); tick();
    var iv = setInterval(tick, 50), wl = wakeLock();
    function onVisible() { if (document.visibilityState === 'visible') schedule(); }
    document.addEventListener('visibilitychange', onVisible);
    var unfit = window.LED.autoFit($('.stage'), $('.display'), $('.bezel'));

    function togglePause() {
      if (finished) { if (shareMode) go('#/share'); return; }
      if (pausedAt === null) { pausedAt = performance.now(); run.classList.add('paused'); setPauseBtn(true); Sound.cancelAll(); }
      else { pausedTotal += performance.now() - pausedAt; pausedAt = null; run.classList.remove('paused'); setPauseBtn(false); rewind(); }
    }
    $('#pause').addEventListener('click', togglePause);
    $('#reset').addEventListener('click', function () { reset(); tick(); });
    $('#finish').addEventListener('click', function () {
      if (finished) return;
      var cur = T.stateAt(plan, prep, elapsed());
      if (cur.phase === 'prep') { runGuard = null; go('#/'); return; }
      frozen = elapsed(); pausedAt = null; run.classList.remove('paused');
      Sound.cancelAll();
      if (plan.kind === 'up') Sound.play('end');
      tick();
    });
    /* Salir del entreno: seguir, pausar y guardar para retomar, o salir del todo */
    function askLeave(target) {
      if (finished) { runGuard = null; go(target || '#/'); return; }
      if (document.getElementById('leave-sheet')) return;
      var back = document.createElement('div');
      back.className = 'sheet-back'; back.id = 'leave-sheet';
      back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Salir del entreno"><h2>¿Salir del entreno?</h2>' +
        '<p>El reloj sigue corriendo. Puedes pausarlo y guardarlo para retomarlo después desde la pantalla principal.</p>' +
        '<button class="btn primary block" id="lv-stay">Seguir entrenando</button>' +
        '<button class="btn block" id="lv-save" style="margin-top:10px">Pausar y guardar para retomar</button>' +
        '<button class="btn danger block" id="lv-exit" style="margin-top:10px">Salir del entreno</button></div>';
      document.body.appendChild(back);
      back.addEventListener('click', function (e) {
        var t = e.target;
        if (t === back || t.closest('#lv-stay')) { back.remove(); return; }
        if (t.closest('#lv-save')) {
          Store.saveSession({ pending: JSON.parse(JSON.stringify({ mode: pending.mode, cfg: pending.cfg, name: pending.name, lines: pending.lines || [], numbered: !!pending.numbered, presetId: pending.presetId || '' })), elapsed: Math.max(0, Math.round(elapsed())), rounds: rounds || 0, ts: Date.now() });
          back.remove(); runGuard = null; go('#/'); toast('Entreno guardado: retómalo desde la pantalla principal');
        } else if (t.closest('#lv-exit')) { back.remove(); runGuard = null; go(target || '#/'); }
      });
    }
    armGuard(askLeave);
    $('#exit').addEventListener('click', function () { if (history.length > 1) history.back(); else askLeave('#/'); });
    if (resume) {
      startedAt = performance.now() - resume.elapsed; pausedAt = performance.now(); rounds = resume.rounds; resume = null;
      run.classList.add('paused'); setPauseBtn(true); Sound.cancelAll(); rewind();
      prev = T.stateAt(plan, prep, elapsed()); tick();
    }
    if (manual) {
      var add = function (d) { rounds = Math.max(0, Math.min(99, rounds + d)); if (d > 0 && navigator.vibrate && settings.vibrate) navigator.vibrate(30); tick(); };
      $('#plus').addEventListener('click', function () { add(1); });
      $('#minus').addEventListener('click', function () { add(-1); });
      $('#led-blue').addEventListener('click', function () { add(1); });
    }
    function onKey(e) {
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (manual && (e.key === '+' || e.key === 'ArrowUp')) { rounds = Math.min(99, rounds + 1); tick(); }
    }
    document.addEventListener('keydown', onKey);
    cleanup = function () { runGuard = null; var ls = document.getElementById('leave-sheet'); if (ls) ls.remove(); clearInterval(iv); Sound.cancelAll(); wl(); unfit(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisible); };
  }

  /* ---------- Compartir (Instagram, etc.) ---------- */
  function loadImg(src) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
  }
  function photoBtns(id, label, withCam) {
    return '<div class="photo-row"><span class="photo-l">' + label + '</span>' +
      (withCam ? '<label class="btn small">' + ICON.camera + 'Hacer foto<input type="file" id="' + id + '-cam" accept="image/*" capture="environment" hidden></label>' : '') +
      '<label class="btn small">' + ICON.image + 'Subir foto<input type="file" id="' + id + '-gal" accept="image/*" hidden></label>' +
      '<button class="btn small" id="' + id + '-rm" hidden>Quitar</button></div>';
  }
  /* Formulario para un entreno hecho fuera de la app (reloj y pizarra de clase) */
  function manualFormHtml() {
    return '<div class="card-form">' +
      '<div class="seg-ctl" role="group" aria-label="Tipo de entreno">' +
      '<button class="btn small on" data-mt="fortime">For Time</button><button class="btn small" data-mt="amrap">AMRAP</button>' +
      '<button class="btn small" data-mt="emom">EMOM</button><button class="btn small" data-mt="otro">Otro</button></div>' +
      '<label class="fld"><span>Nombre del entreno (opcional)</span><input class="text-in" id="m-name" maxlength="60" placeholder="Ej. Murph, Fran, WOD del lunes" autocomplete="off"></label>' +
      '<div class="m-box" data-for="fortime"><span class="m-l">Tiempo realizado</span><div class="row">'+'<label class="mini-f"><span>Minutos</span><input class="text-in" id="m-min" type="number" inputmode="numeric" min="0" max="99" placeholder="0"></label><label class="mini-f"><span>Segundos</span><input class="text-in" id="m-sec" type="number" inputmode="numeric" min="0" max="59" placeholder="0"></label></div></div>' +
      '<div class="m-box" data-for="amrap" hidden><span class="m-l">Resultado</span><div class="row">'+'<label class="mini-f"><span>Rondas</span><input class="text-in" id="m-rounds" type="number" inputmode="numeric" min="0" max="99" placeholder="0"></label><label class="mini-f"><span>+ Repes</span><input class="text-in" id="m-reps" type="number" inputmode="numeric" min="0" max="999" placeholder="0"></label><label class="mini-f"><span>Minutos (opc.)</span><input class="text-in" id="m-dur" type="number" inputmode="numeric" min="0" max="99" placeholder="0"></label></div></div>' +
      '<div class="m-box" data-for="emom" hidden><span class="m-l">Minutos del EMOM</span><div class="row"><input class="text-in" id="m-emom" type="number" inputmode="numeric" min="1" max="99" placeholder="Ej. 15"></div></div>' +
      '<label class="fld"><span>Entreno (una línea por ejercicio)</span><textarea class="text-in" id="m-text" rows="5" placeholder="21-15-9\nThrusters 43 kg\nPull ups"></textarea></label></div>';
  }
  function viewShare(manual) {
    if (!manual && !lastResult) return go('#/');
    var st = { format: 'story', style: 'std', photo: null, board: null, showEx: true, logo: null, type: 'fortime' };
    var s = Store.settings();
    app.innerHTML = '<div class="screen share-view">' + header(manual ? 'Compartir entreno' : 'Compartir', { back: '#/' }) +
      (manual ? '<p class="lead">¿Has entrenado con el reloj y la pizarra de clase? Rellena el resultado y crea tu imagen.</p>' + manualFormHtml() : '') +
      '<div class="share-prev"><canvas id="sh-canvas" aria-label="Vista previa de la imagen para compartir"></canvas></div>' +
      '<div class="seg-ctl" role="group" aria-label="Formato"><button class="btn small on" data-fmt="story">Story 9:16</button><button class="btn small" data-fmt="post">Post 4:5</button><button class="btn small" data-fmt="land">Horizontal 16:9</button></div>' +
      '<div class="seg-ctl" role="group" aria-label="Estilo del logo"><button class="btn small on" data-sty="std">Logo normal</button><button class="btn small" data-sty="logo">Logo grande</button></div>' +
      photoBtns('sh-bg', 'Foto de fondo', true) + photoBtns('sh-bd', 'Foto de la pizarra', true) +
      '<label class="chk"><input type="checkbox" id="sh-ex" checked> Mostrar ejercicios</label>' +
      (manual ? '<button class="btn block" id="sh-hist" style="margin-bottom:10px">' + ICON.history + 'Guardar en el historial</button>' : '') +
      '<button class="btn primary block" id="sh-share">' + ICON.share + 'Compartir</button>' +
      '<button class="btn block" id="sh-save" style="margin-top:10px">' + ICON.download + 'Guardar imagen</button>' +
      '<p class="hint">En «Compartir» elige Instagram (Stories o publicación) en el menú del móvil. Si tu navegador no lo permite, se guarda la imagen para que la subas tú.</p></div>';
    var canvas = $('#sh-canvas'), seq = 0, res = manual ? null : lastResult;
    var isRun = !!(res && res.modeId === 'run');
    if (isRun) { st.hide = true; $('#sh-ex').parentNode.insertAdjacentHTML('beforebegin', '<label class="chk"><input type="checkbox" id="sh-priv" checked> Ocultar inicio y final del recorrido (privacidad)</label>'); $('#sh-ex').parentNode.lastChild.textContent = ' Mostrar parciales por km'; $('#sh-priv').addEventListener('change', function () { st.hide = this.checked; draw(); });
      $('#sh-priv').parentNode.insertAdjacentHTML('afterend', '<label class="chk"><input type="checkbox" id="sh-map"> Mapa real (se descarga de internet)</label>'); $('#sh-map').addEventListener('change', function () { st.map = this.checked; draw(); }); }
    var TYPES = { fortime: 'FOR TIME', amrap: 'AMRAP', emom: 'EMOM', otro: 'ENTRENO' };
    function num(id) { var el = $(id); return el ? Math.max(0, parseInt(el.value, 10) || 0) : 0; }
    function buildManual() {
      var t = st.type, name = ($('#m-name').value || '').trim(), r = { modeId: t, modeName: TYPES[t], name: name || TYPES[t], date: dateEs() };
      r.lines = ($('#m-text').value || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return { num: '', parts: [{ qty: '', name: x }], note: '' }; });
      if (t === 'fortime') { r.kind = 'time'; r.label = 'TIEMPO'; r.value = Math.min(99 * 60 + 59, num('#m-min') * 60 + num('#m-sec')); r.sub = 'Tiempo final'; }
      else if (t === 'amrap') {
        var rd = num('#m-rounds'), rp = num('#m-reps'), du = num('#m-dur'), sub = [];
        r.kind = 'rounds'; r.label = 'RONDAS'; r.value = Math.min(99, rd); r.reps = rp;
        if (rp) sub.push('+ ' + rp + ' reps'); if (du) sub.push('en ' + T.fmt(du * 60));
        r.sub = sub.join(' · ');
      } else if (t === 'emom') { var em = num('#m-emom'); r.kind = 'text'; r.label = 'ENTRENO'; r.value = 'EMOM' + (em ? ' ' + em + "'" : ''); r.sub = 'Entreno completado'; }
      else { r.kind = 'text'; r.label = 'ENTRENO'; r.value = (name || 'WOD').toUpperCase(); r.sub = 'Entreno completado'; r.name = name || 'Entreno'; }
      return r;
    }
    function draw() {
      if (manual) res = buildManual();
      var rd = isRun ? window.RunUI.shareModel(res, st.hide) : res, my = ++seq;
      return window.Share.render(canvas, { format: st.format, style: st.style, photo: st.photo, board: st.board, logo: st.logo, gymName: s.gymName || '4TIME Hybrid & Functional Center', showExercises: st.showEx && rd.lines.length > 0, map: isRun && !!st.map, r: rd }).then(function () { return my; });
    }
    loadImg(logoSrc()).then(function (img) { st.logo = img; draw(); });
    draw();
    function wirePhoto(id, key) {
      function pick(file) {
        if (!file) return;
        var url = URL.createObjectURL(file);
        loadImg(url).then(function (img) {
          URL.revokeObjectURL(url);
          if (!img) { toast('No se pudo abrir esa imagen'); return; }
          st[key] = img; $('#' + id + '-rm').hidden = false; draw();
        });
      }
      ['cam', 'gal'].forEach(function (k) { var el = $('#' + id + '-' + k); el.addEventListener('change', function (e) { pick(e.target.files[0]); e.target.value = ''; }); });
      $('#' + id + '-rm').addEventListener('click', function () { st[key] = null; this.hidden = true; draw(); });
    }
    wirePhoto('sh-bg', 'photo'); wirePhoto('sh-bd', 'board');
    $('#sh-ex').addEventListener('change', function () { st.showEx = this.checked; draw(); });
    $$('[data-fmt]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.format = b.dataset.fmt;
        $$('[data-fmt]').forEach(function (x) { x.classList.toggle('on', x === b); });
        draw();
      });
    });
    $$('[data-sty]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.style = b.dataset.sty;
        $$('[data-sty]').forEach(function (x) { x.classList.toggle('on', x === b); });
        draw();
      });
    });
    if (manual) {
      $$('[data-mt]').forEach(function (b) {
        b.addEventListener('click', function () {
          st.type = b.dataset.mt;
          $$('[data-mt]').forEach(function (x) { x.classList.toggle('on', x === b); });
          $$('.m-box').forEach(function (x) { x.hidden = x.dataset.for !== st.type; });
          draw();
        });
      });
      $$('.card-form input, .card-form textarea').forEach(function (el) { el.addEventListener('input', draw); });
    }
    if (manual) $('#sh-hist').addEventListener('click', function () {
      var r = buildManual();
      if (!($('#m-name').value || '').trim()) { toast('Ponle un nombre al entreno para guardarlo'); $('#m-name').focus(); return; }
      var rec = Store.addResult(r); toast(rec.pr ? '¡Nueva marca personal!' : 'Guardado en el historial');
      if (rec.pr) { res = rec; draw(); }
    });
    function text() { if (isRun) return window.RunUI.shareText(res); return res.kind === 'rounds' ? res.value + ' rondas · ' + res.name : res.kind === 'time' ? res.name + ' · ' + T.fmt(res.value) : res.name; }
    $('#sh-share').addEventListener('click', function () {
      draw().then(function () { return window.Share.share(canvas, text() + ' #4TIMER'); }).then(function (r) {
        if (r === 'saved') toast('Imagen guardada. Ya puedes subirla a Instagram');
        else if (r === 'error') toast('No se pudo compartir');
      });
    });
    $('#sh-save').addEventListener('click', function () { draw().then(function () { return window.Share.save(canvas); }).then(function () { toast('Imagen guardada'); }); });
  }

  /* ---------- Historial ---------- */
  function valText(h) {
    if (h.kind === 'time') return T.fmt(h.value);
    if (h.kind === 'rounds') return h.value + (h.value === 1 ? ' ronda' : ' rondas') + (h.reps ? ' + ' + h.reps : '');
    if (h.kind === 'run') return window.RunUI.valText(h);
    return 'Completado';
  }
  function deltaHtml(h, prevH) {
    var a = Store.score(h), b = prevH && Store.score(prevH);
    if (!a || !b) return '';
    var d = a.v - b.v; if (!d) return '<span class="h-d same">=</span>';
    var good = a.dir * d > 0, txt;
    if (h.kind === 'time') txt = (d < 0 ? '−' : '+') + T.fmt(Math.abs(d));
    else { var rd = Math.trunc(Math.abs(d) / 1000), rp = Math.abs(d) % 1000; txt = (d < 0 ? '−' : '+') + (rd ? rd + ' r' : '') + (rd && rp ? ' ' : '') + (rp ? rp + ' reps' : '') ; }
    return '<span class="h-d ' + (good ? 'good' : 'bad') + '">' + txt + '</span>';
  }
  function spark(list) {
    var pts = list.slice(-10).map(function (h) { var sc = Store.score(h); return sc ? sc.dir * sc.v : null; }).filter(function (v) { return v !== null; });
    if (pts.length < 2) return '';
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), W = 96, H = 26;
    var d = pts.map(function (v, i) { return (i * W / (pts.length - 1)).toFixed(1) + ',' + (H - 3 - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - 6)).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function viewHistory() {
    var all = Store.history(), groups = {}, order = [];
    all.forEach(function (h) { if (!groups[h.key]) { groups[h.key] = []; order.push(h.key); } groups[h.key].push(h); });
    order.sort(function (a, b) { return groups[b][groups[b].length - 1].ts - groups[a][groups[a].length - 1].ts; });
    var html = '<div class="screen">' + header('Historial') +
      '<p class="lead">Se guarda solo al terminar cada entreno. Toca uno para ver sus pruebas: cada una se puede compartir o borrar con la papelera.</p>';
    if (!order.length) html += '<div class="empty">Todavía no hay resultados. Termina un entreno y aparecerá aquí.</div>';
    order.forEach(function (k) {
      var list = groups[k].slice().sort(function (a, b) { return a.ts - b.ts; }), last = list[list.length - 1];
      var scored = list.filter(function (h) { return Store.score(h); }), best = null;
      scored.forEach(function (h) { if (!best || Store.score(h).dir * Store.score(h).v > Store.score(best).dir * Store.score(best).v) best = h; });
      html += '<details class="hist-g"' + (list.length === 1 ? ' open' : '') + '><summary><div class="h-top"><span class="h-name">' + esc(last.name) + '</span><span class="chip">' + esc(last.modeName) + '</span></div>' +
        '<div class="h-sub"><span>' + list.length + (list.length === 1 ? ' vez' : ' veces') + '</span>' +
        (best ? '<span class="h-pr">' + ICON.trophy + valText(best) + '</span>' : '') + '<span class="h-spark">' + spark(list) + '</span></div></summary><div class="h-body">';
      list.slice().reverse().forEach(function (h) {
        var idx = list.indexOf(h), prevH = null;
        for (var j = idx - 1; j >= 0; j--) if (Store.score(list[j])) { prevH = list[j]; break; }
        html += '<div class="h-row"><span class="h-date">' + esc(dateEs(h.ts)) + '</span><span class="h-val">' + esc(valText(h)) + ((h === best || (h.modeId === 'run' && h.pr)) ? ' <b class="pr-tag">PR</b>' : '') + '</span>' +
          deltaHtml(h, prevH) +
          (h.modeId === 'run' && h.route ? '<button class="icon-btn mini" data-hgpx="' + h.id + '" aria-label="Exportar GPX">' + ICON.download + '</button>' : '') +
          '<button class="icon-btn mini" data-hshare="' + h.id + '" aria-label="Compartir este resultado">' + ICON.share + '</button>' +
          '<button class="icon-btn mini" data-hdel="' + h.id + '" aria-label="Borrar este resultado">' + ICON.trash + '</button></div>';
      });
      if (last.presetId && Store.getPreset(last.presetId)) html += '<button class="btn primary small block" data-hrep="' + last.presetId + '" style="margin-top:8px">' + ICON.play + 'Repetir este entreno</button>';
      html += '</div></details>';
    });
    if (order.length) html += '<button class="btn small block" id="h-clear" style="margin-top:10px">Borrar todo el historial</button>';
    app.innerHTML = html + '</div>';
    var open = {};
    function onClick(e) {
      var gx = e.target.closest('[data-hgpx]'); if (gx) { var gh = all.filter(function (x) { return x.id === gx.dataset.hgpx; })[0]; if (gh) window.RunUI.saveGPX(gh); return; }
      var sh = e.target.closest('[data-hshare]'), dl = e.target.closest('[data-hdel]'), rp = e.target.closest('[data-hrep]');
      if (sh) { var h = all.filter(function (x) { return x.id === sh.dataset.hshare; })[0]; if (h) { lastResult = h; go('#/share'); } }
      else if (dl) { if (window.confirm('¿Borrar este resultado?')) { Store.removeResult(dl.dataset.hdel); viewHistory(); } }
      else if (rp) {
        var it = Store.getPreset(rp.dataset.hrep); if (!it) return;
        var err = T.validateLines(it.mode, it.cfg, it.lines); if (err) { toast('Error: ' + err); return; }
        pending = { mode: it.mode, cfg: Object.assign(T.defaultConfig(it.mode), it.cfg), name: it.name, lines: it.lines, numbered: !!it.numbered, presetId: it.id };
        Sound.unlock(); go('#/run');
      } else if (e.target.closest('#h-clear')) { if (window.confirm('¿Borrar TODO el historial?')) { Store.clearHistory(); viewHistory(); } }
    }
    app.addEventListener('click', onClick);
    cleanup = function () { app.removeEventListener('click', onClick); };
  }

  /* ---------- Ajustes ---------- */
  var EVENTS = [
    { id: 'countdown', name: 'Cuenta atrás 3, 2, 1', hint: 'Últimos 3 segundos antes de empezar (y de cada intervalo).' },
    { id: 'go', name: 'Inicio del entreno', hint: 'Cuando el reloj arranca tras la cuenta atrás.' },
    { id: 'minute', name: 'Cambio de minuto', hint: 'EMOM y Fight Gone Bad: cada vez que empieza un nuevo intervalo.' },
    { id: 'work', name: 'Empieza el trabajo', hint: 'Tabata, intervalos y trabajo = descanso.' },
    { id: 'rest', name: 'Empieza el descanso', hint: 'Tabata, intervalos, descanso y Fight Gone Bad.' },
    { id: 'end', name: 'Fin del tiempo', hint: 'AMRAP, cuenta atrás y time cap del For Time.' },
    { id: 'lvl1', name: 'Running: cambio a suave / andar', hint: 'Series de running: empieza un tramo suave o andando.' },
    { id: 'lvl2', name: 'Running: cambio a medio', hint: 'Series de running: empieza un tramo a ritmo medio.' },
    { id: 'lvl3', name: 'Running: cambio a fuerte / sprint', hint: 'Series de running: empieza un tramo fuerte o sprint.' }
  ];

  function resizeLogo(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { rej(new Error('Ese archivo no es una imagen válida.')); };
        img.onload = function () {
          var max = 480, sc = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/png'));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function viewSettings() {
    var s = Store.settings();
    function presetOptions(ev) {
      var cur = s.sounds[ev.id] || { preset: 'beep' };
      var o = Object.keys(Sound.PRESETS).map(function (k) {
        return '<option value="' + k + '"' + (cur.preset === k ? ' selected' : '') + '>' + esc(Sound.PRESETS[k].label) + '</option>';
      }).join('');
      if (cur.data) o += '<option value="custom"' + (cur.preset === 'custom' ? ' selected' : '') + '>Mi sonido</option>';
      return o;
    }
    var sounds = EVENTS.map(function (ev) {
      var cur = s.sounds[ev.id] || {};
      return '<div class="snd"><div class="s-name">' + esc(ev.name) + '</div><div class="s-hint">' + esc(ev.hint) + '</div>' +
        '<div class="s-row"><select class="text-in" data-ev="' + ev.id + '" aria-label="Sonido: ' + esc(ev.name) + '">' + presetOptions(ev) + '</select>' +
        '<button class="btn small" data-test="' + ev.id + '" aria-label="Probar">' + ICON.play + '</button>' +
        '<label class="btn small" style="cursor:pointer">Subir<input type="file" accept="audio/*" hidden data-up="' + ev.id + '"></label></div>' +
        (cur.data ? '<div class="s-file">Archivo propio: ' + esc(cur.name || 'sonido') + '</div>' : '') + '</div>';
    }).join('');

    var prepOpts = [0, 3, 5, 10, 15, 20].map(function (n) {
      return '<option value="' + n + '"' + (s.prep === n ? ' selected' : '') + '>' + (n ? n + ' segundos' : 'Sin cuenta atrás') + '</option>';
    }).join('');

    app.innerHTML = '<div class="screen">' + header('Ajustes') +
      '<div class="panel"><h2>Cuenta atrás</h2>' +
      '<div class="field"><div class="flabel">Cuenta atrás antes de empezar</div><select class="text-in" id="prep">' + prepOpts + '</select></div>' +
      '<label class="switch"><span>Pitidos 3, 2, 1 al final de cada intervalo</span><input type="checkbox" id="b3"' + (s.beepLast3 ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Vibración</span><input type="checkbox" id="vib"' + (s.vibrate ? ' checked' : '') + '></label>' +
      '<div class="field"><div class="flabel">Volumen</div><input type="range" id="vol" min="0" max="1" step="0.05" value="' + s.volume + '" aria-label="Volumen"></div></div>' +
      '<div class="panel"><h2>Sonidos</h2>' +
      '<p class="s-hint">Para saber qué toca sin mirar la pantalla: pitido corto y agudo = trabajo, tono largo y grave = descanso, vibración distinta en cada caso.</p>' +
      '<button class="btn small block" id="snd-access" style="margin-bottom:10px">Aplicar sonidos distintos por tipo (recomendado)</button>' + sounds + '<div id="snd-msg" class="s-hint" role="status"></div></div>' +
      '<div class="panel"><h2>Tu gimnasio</h2>' +
      '<div class="field"><div class="flabel">Nombre</div><input class="text-in" id="gym" maxlength="40" value="' + esc(s.gymName) + '" placeholder="Nombre del box" autocomplete="off"></div>' +
      '<div class="field"><div class="flabel">Logo (se muestra en la pantalla de inicio y en el reloj)</div>' +
      '<div class="row" style="align-items:center;flex-wrap:wrap"><img class="gym-logo" style="height:56px" src="' + esc(logoSrc()) + '" alt="Logo actual">' +
      '<label class="btn small" style="cursor:pointer">Cambiar logo<input type="file" accept="image/*" hidden id="logo"></label>' +
      '<button class="btn small" id="logo-reset">Restaurar</button></div></div></div></div>';

    function onChange(e) {
      var t = e.target;
      if (t.id === 'prep') Store.setSettings({ prep: +t.value });
      else if (t.id === 'b3') Store.setSettings({ beepLast3: t.checked });
      else if (t.id === 'vib') Store.setSettings({ vibrate: t.checked });
      else if (t.id === 'vol') { Store.setSettings({ volume: +t.value }); }
      else if (t.id === 'gym') Store.setSettings({ gymName: t.value.trim() });
      else if (t.dataset.ev) {
        var ev = t.dataset.ev, cur = Store.settings().sounds[ev] || {};
        Store.setSound(ev, { preset: t.value, data: cur.data, name: cur.name });
        Sound.unlock(); Sound.preview(ev);
      } else if (t.dataset.up && t.files[0]) {
        var evId = t.dataset.up;
        Sound.readFile(t.files[0]).then(function (data) {
          Store.setSound(evId, { preset: 'custom', data: data, name: t.files[0].name });
          Sound.unlock(); Sound.preview(evId); viewSettings(); toast('Sonido guardado');
        }).catch(function (err) { $('#snd-msg').textContent = err.message; });
      } else if (t.id === 'logo' && t.files[0]) {
        resizeLogo(t.files[0]).then(function (url) {
          if (Store.setSettings({ logo: url })) { viewSettings(); toast('Logo actualizado'); }
          else toast('No se pudo guardar el logo');
        }).catch(function (err) { toast(err.message); });
      }
    }
    function onClick(e) {
      var tb = e.target.closest('[data-test]');
      if (tb) { Sound.unlock(); Sound.preview(tb.dataset.test); }
      if (e.target.closest('#snd-access')) {
        Object.keys(Sound.ACCESSIBLE).forEach(function (k) { Store.setSound(k, { preset: Sound.ACCESSIBLE[k] }); });
        Store.setSettings({ vibrate: true }); Sound.unlock(); viewSettings(); toast('Sonidos por tipo aplicados');
      }
      if (e.target.closest('#logo-reset')) { Store.setSettings({ logo: null }); viewSettings(); toast('Logo restaurado'); }
    }
    app.addEventListener('change', onChange);
    app.addEventListener('click', onClick);
    cleanup = function () { app.removeEventListener('change', onChange); app.removeEventListener('click', onClick); };
  }

  /* ---------- arranque ---------- */
  window.AppKit = {
    app: app, esc: esc, $: $, $$: $$, header: header, toast: toast, go: go, ICON: ICON, pad: pad, dateEs: dateEs, logoSrc: logoSrc, wakeLock: wakeLock, loadImg: loadImg,
    setCleanup: function (f) { cleanup = f; },
    setRunGuard: armGuard,
    setShareResult: function (r) { lastResult = r; }
  };
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
