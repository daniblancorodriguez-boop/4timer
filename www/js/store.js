/* 4TIMER — almacenamiento local: ajustes, ejercicios, entrenos predefinidos, contador */
(function (root) {
  'use strict';
  var KEY = '4timer.v1';

  /* ---------- Entrenos predefinidos de serie ----------
     Cada línea es {t:'ex', parts:[{ex, qty}], note} (uno o varios ejercicios juntos)
     o {t:'txt', text} (texto libre: 21-15-9, Buy out…). */
  function ex(id, qty) { return { ex: id, qty: qty || '' }; }
  function L(parts, note) { return { t: 'ex', parts: parts, note: note || '' }; }
  function X(text) { return { t: 'txt', text: text }; }

  function seedPresets() {
    return [
      { id: 'p1', name: "Partners 2' ON × 1' OFF × 3R", mode: 'interval', cfg: { work: 120, rest: 60, rounds: 15 }, numbered: true, lines: [
        L([ex('sled-push')], 'heavy'), L([ex('floor-press'), ex('ring-row')]), L([ex('sled-pull')]),
        L([ex('wallclimbs'), ex('db-push-press')]), L([ex('horizontal-row'), ex('seated-wallballs')]),
        X('5 estaciones × 3 rondas = 15 intervalos')] },
      { id: 'p2', name: "AMRAP 20'", mode: 'amrap', cfg: { dur: 1200 }, numbered: false, lines: [
        L([ex('american-swing', '15')]), L([ex('wallballs-lunge', '20')]), L([ex('du', '25')]),
        L([ex('shuttle-run', '3 × 12,5 m')]), L([ex('sled-pull', 'Max m')])] },
      { id: 'p3', name: 'Partner For Time 21-15-9 + 30-24-18', mode: 'fortime', cfg: { cap: 0 }, numbered: false, lines: [
        X('21-15-9'), L([ex('burpee-pull-ups')]), L([ex('db-hang-snatch')]), L([ex('db-step-up')]), L([ex('push-ups')]),
        X('+'), L([ex('cal-bike', '30-24-18 cal'), ex('run', '400 m')], 'juntos'),
        X('Buy out:'), L([ex('du', '150')], 'a repartir')] },
      { id: 'p4', name: "EMOM 10' · Burpees", mode: 'emom', cfg: { interval: 60, rounds: 10 }, numbered: false, lines: [
        L([ex('burpees', '8-14')], 'sin rest')] },
      { id: 'p5', name: 'Partners 90" ON × 30" OFF × 3R', mode: 'interval', cfg: { work: 90, rest: 30, rounds: 18 }, numbered: true, lines: [
        L([ex('sled-push')]), L([ex('sled-pull')]), L([ex('farmer-hold'), ex('hang-bar-hold')]),
        L([ex('lunges'), ex('step-up')]), L([ex('burpees-broad-jump-syncro')]), L([ex('run-syncro')]),
        X('6 estaciones × 3 rondas = 18 intervalos')] },
      { id: 'p6', name: "EMOM 12' · Front squat / Pull ups / Row", mode: 'emom', cfg: { interval: 60, rounds: 12 }, numbered: true, lines: [
        L([ex('tempo-front-squat', '6')]), L([ex('iso-pull-ups', 'Máx time')]), L([ex('db-bench-row', '6+6')])] },
      { id: 'p7', name: "EMOM 12' · Back squat / Bike / Run", mode: 'emom', cfg: { interval: 60, rounds: 12 }, numbered: true, lines: [
        L([ex('back-squat', '8')]), L([ex('sprint-bike', '30"')]), L([ex('run', '200 m')]), L([ex('rest')])] },
      { id: 'p8', name: "10' AMRAP × 2R × 1' REST", mode: 'amrapx', cfg: { dur: 600, blocks: 2, rest: 60 }, numbered: false, lines: [
        L([ex('run', '200 m')]), L([ex('ski', '200 m')]), L([ex('push-ups', '12')]), L([ex('burpees', '12')]), L([ex('sled-push', 'Max')])] },
      { id: 'p9', name: "EMOM 12' · Pull ups / Ski / Tríceps", mode: 'emom', cfg: { interval: 60, rounds: 12 }, numbered: true, lines: [
        L([ex('strict-pull-ups', '6')]), L([ex('sprint-ski', '30"')]), L([ex('triceps-band-ext', '20')]), L([ex('rest')])] },
      { id: 'p10', name: "EMOM 16' · Hip thrust / T2B / Push ups", mode: 'emom', cfg: { interval: 60, rounds: 16 }, numbered: true, lines: [
        L([ex('hip-thrust', '12')]), L([ex('strict-t2b', '12')]), L([ex('slow-push-ups', '6')]), L([ex('kip-pull-ups', 'Máx')])] },
      { id: 'p11', name: "A · 30\" ON × 30\" OFF · KB RDL + Row / Quadruped pull rack", mode: 'interval', cfg: { work: 30, rest: 30, rounds: 8 }, numbered: true, lines: [
        L([ex('kb-rdl-row', 'Máx')]), L([ex('quadruped-pull-rack', 'Máx')]),
        X('Ajusta las rondas a lo que mande el coach (por defecto 8)')] },
      { id: 'p12', name: "B1 · EMOM 10' · Muscle ups / Burpees", mode: 'emom', cfg: { interval: 60, rounds: 10 }, numbered: false, lines: [
        L([ex('burpees', '15')], 'minutos impares'), L([ex('muscle-ups', '3-5'), ex('kip-pull-ups', '15')], 'minutos pares · muscle ups o kip pull ups')] },
      { id: 'p13', name: "B2 · EMOM 10' · Burpees / Squat jumps", mode: 'emom', cfg: { interval: 60, rounds: 10 }, numbered: false, lines: [
        L([ex('squat-jumps', '20')], 'minutos impares'), L([ex('burpees', '15')], 'minutos pares')] },
      { id: 'p14', name: "2 parejas · 6' ON × 1' OFF × 1R", mode: 'interval', cfg: { work: 360, rest: 60, rounds: 4 }, numbered: true, lines: [
        X('Formato: 2 parejas'),
        L([ex('ski', '1000 m'), ex('run', 'Máx m')]), L([ex('sled-push', '50 m'), ex('run', 'Máx m')]),
        L([ex('burpees-broad-jump', '80 m'), ex('run', 'Máx m')]), L([ex('lunges', '100 m'), ex('run', 'Máx m')])] },
      { id: 'p15', name: "Parejas · 7' ON × 30\" OFF × 1R", mode: 'interval', cfg: { work: 420, rest: 30, rounds: 5 }, numbered: true, lines: [
        X('Formato: parejas'),
        L([ex('run', '1000 m'), ex('ski', 'Máx cal')]), L([ex('sled-push', '50 m'), ex('ski', 'Máx cal')]),
        L([ex('burpees-broad-jump', '80 m'), ex('ski', 'Máx cal')]), L([ex('wallballs-lunge', '100'), ex('ski', 'Máx cal')]),
        L([ex('sled-pull', '50 m'), ex('ski', 'Máx cal')])] },
      { id: 'p16', name: "A · AMRAP 17' · Front squat / Pull ups / Wallclimb", mode: 'amrap', cfg: { dur: 1020 }, numbered: false, lines: [
        L([ex('pause-front-squat', '5')]), L([ex('ecc-pull-ups', '5')]), L([ex('wallclimb-box-obstacles', '5')])] },
      { id: 'p17', name: "B · 5R For Time (TC 20') · Bike / Swing / Ski", mode: 'fortime', cfg: { cap: 1200 }, numbered: false, lines: [
        X('5 rondas'), L([ex('cal-bike', '12')]), L([ex('american-swing', '25')]), L([ex('ski', '200 m')])] }
    ];
  }

  /* Programa de ejemplo (el de la imagen del entrenador). Niveles: 0 Andar, 1 Suave, 2 Medio, 3 Fuerte, 4 Sprint */
  function seedPrograms() {
    function S(kind, value, level, note) { return { t: 'step', kind: kind, value: value, level: level, note: note || '' }; }
    return [{ id: 'g1', name: 'Base aeróbica (ejemplo)', weeks: [
      { name: 'Semana 1', parts: [
        { name: 'A · Preparación', items: [S('time', 300, 1, '3/10'), S('time', 180, 2, 'variando ritmos (bajo-medio-alto)')] },
        { name: 'B · Base aeróbica', items: [S('dist', 8000, 2, '')] }] },
      { name: 'Semana 2', parts: [
        { name: 'B · Fartlek', items: [{ t: 'repeat', rounds: 5, steps: [S('time', 180, 1, '50 %'), S('time', 120, 2, '70 %'), S('time', 60, 4, '100 %')] }] }] },
      { name: 'Semana 3', parts: [
        { name: 'B · Fartlek', items: [{ t: 'repeat', rounds: 3, steps: [S('time', 300, 1, '50 %'), S('time', 180, 2, '70 %'), S('time', 120, 4, '100 %')] }] }] },
      { name: 'Semana 4', parts: [
        { name: 'B · Base aeróbica', items: [S('dist', 9000, 2, '')] }] }
    ] }];
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults() {
    return {
      settings: {
        runAutoPause: false, prep: 10, beepLast3: true, volume: 0.8, vibrate: true, gymName: '', logo: null,
        sounds: {
          countdown: { preset: 'beep' }, go: { preset: 'horn' }, minute: { preset: 'bell' },
          work: { preset: 'tick' }, rest: { preset: 'long' }, end: { preset: 'horn' },
          lvl1: { preset: 'gong' }, lvl2: { preset: 'double' }, lvl3: { preset: 'siren' }
        }
      },
      configs: {},
      exercises: clone(root.SEED_EXERCISES || []),
      presets: seedPresets(),
      counter: 0,
      history: [],
      session: null,
      programs: seedPrograms(),
      seedsSeen: seedsSeenNow()
    };
  }

  /* Entrenos guardados con la versión anterior (solo texto): los de serie se sustituyen por la
     versión con ejercicios; los creados por el usuario se convierten en líneas de texto. */
  function migratePreset(pr, seeds) {
    if (Array.isArray(pr.lines)) return pr;
    var seed = seeds.filter(function (s) { return s.id === pr.id; })[0];
    if (seed) return seed;
    var lines = String(pr.desc || '').split('\n').filter(function (t) { return t.trim(); }).map(function (t) { return X(t.trim()); });
    return { id: pr.id, name: pr.name, mode: pr.mode, cfg: pr.cfg, numbered: false, lines: lines };
  }

  var OLD_P = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
  var NEW_E = ['kb-rdl-row', 'quadruped-pull-rack', 'muscle-ups', 'squat-jumps', 'burpees-broad-jump', 'pause-front-squat', 'ecc-pull-ups', 'wallclimb-box-obstacles'];
  function seedsSeenNow() { return { p: seedPresets().map(function (x) { return x.id; }), e: (root.SEED_EXERCISES || []).map(function (x) { return x.id; }) }; }
  var data;
  function load() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        d.settings = Object.assign(d.settings, p.settings || {});
        d.settings.sounds = Object.assign(defaults().settings.sounds, (p.settings && p.settings.sounds) || {});
        d.configs = p.configs || {};
        if (Array.isArray(p.exercises)) d.exercises = p.exercises;
        if (Array.isArray(p.presets)) { var seeds = seedPresets(); d.presets = p.presets.map(function (x) { return migratePreset(x, seeds); }); }
        /* Ejemplos y ejercicios nuevos de una versión posterior: se añaden una sola vez (si los borras, no vuelven solos) */
        var seen = p.seedsSeen || { p: OLD_P.slice(), e: (root.SEED_EXERCISES || []).map(function (e) { return e.id; }).filter(function (id) { return NEW_E.indexOf(id) < 0; }) };
        var haveP = {}, haveE = {};
        d.presets.forEach(function (x) { haveP[x.id] = 1; }); d.exercises.forEach(function (x) { haveE[x.id] = 1; });
        seedPresets().forEach(function (x) { if (seen.p.indexOf(x.id) < 0 && !haveP[x.id]) d.presets.push(x); });
        clone(root.SEED_EXERCISES || []).forEach(function (x) { if (seen.e.indexOf(x.id) < 0 && !haveE[x.id]) d.exercises.push(x); });
        d.counter = +p.counter || 0;
        if (Array.isArray(p.history)) d.history = p.history;
        if (Array.isArray(p.programs)) d.programs = p.programs;
        if (p.session && p.session.pending && typeof p.session.elapsed === 'number') d.session = p.session;
      }
    } catch (e) { /* datos corruptos: se usan los valores por defecto */ }
    d.seedsSeen = seedsSeenNow();
    return d;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) {
      /* Sin espacio: se quitan los recorridos de las carreras más antiguas (lo más pesado) y se reintenta */
      var runs = data.history.filter(function (h) { return h.route; });
      for (var i = 0; i < runs.length - 3; i++) {
        delete runs[i].route;
        try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e2) {}
      }
      return false;
    }
  }
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  data = load();

  var Store = {
    settings: function () { return data.settings; },
    setSettings: function (patch) { Object.assign(data.settings, patch); return persist(); },
    setSound: function (ev, snd) { data.settings.sounds[ev] = snd; return persist(); },

    /* ---- ejercicios ---- */
    exercises: function () {
      return data.exercises.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }); });
    },
    getExercise: function (id) { return data.exercises.filter(function (e) { return e.id === id; })[0] || null; },
    addExercise: function (e) {
      var item = { id: newId('x'), name: e.name, desc: e.desc || '' };
      data.exercises.push(item); persist(); return item;
    },
    updateExercise: function (id, e) {
      var it = Store.getExercise(id); if (!it) return null;
      it.name = e.name; it.desc = e.desc || ''; persist(); return it;
    },
    /* Nombres de los entrenos que usan un ejercicio */
    exerciseUsage: function (id) {
      return data.presets.filter(function (pr) {
        return pr.lines.some(function (l) { return l.t === 'ex' && l.parts.some(function (pt) { return pt.ex === id; }); });
      }).map(function (pr) { return pr.name; });
    },
    removeExercise: function (id) {
      if (Store.exerciseUsage(id).length) return false;
      data.exercises = data.exercises.filter(function (e) { return e.id !== id; }); persist(); return true;
    },
    restoreExercises: function () {
      var have = {}; data.exercises.forEach(function (e) { have[e.id] = 1; });
      var add = clone(root.SEED_EXERCISES || []).filter(function (e) { return !have[e.id]; });
      data.exercises = data.exercises.concat(add); persist(); return add.length;
    },

    /* ---- entrenos predefinidos ---- */
    presets: function () { return data.presets.slice(); },
    getPreset: function (id) { return data.presets.filter(function (x) { return x.id === id; })[0] || null; },
    addPreset: function (pr) {
      var item = { id: newId('p'), name: pr.name, mode: pr.mode, cfg: pr.cfg, numbered: !!pr.numbered, lines: pr.lines || [] };
      data.presets.push(item); persist(); return item;
    },
    updatePreset: function (id, pr) {
      var it = Store.getPreset(id); if (!it) return null;
      it.name = pr.name; it.mode = pr.mode; it.cfg = pr.cfg; it.numbered = !!pr.numbered; it.lines = pr.lines || []; persist(); return it;
    },
    removePreset: function (id) { data.presets = data.presets.filter(function (x) { return x.id !== id; }); persist(); },
    /* Vuelve a añadir los ejemplos del box que se hayan borrado (no toca los demás) */
    restorePresets: function () {
      var have = {}; data.presets.forEach(function (x) { have[x.id] = 1; });
      var missing = seedPresets().filter(function (x) { return !have[x.id]; });
      Store.restoreExercises();
      data.presets = data.presets.concat(missing); persist(); return missing.length;
    },

    /* ---- historial de resultados y marcas personales ---- */
    /* Puntuación comparable: For Time = menos tiempo es mejor; AMRAP = más rondas (y repes) es mejor. Otros modos: sin marca. */
    score: function (r) {
      if (r.modeId === 'fortime' && r.kind === 'time' && r.value > 0) return { dir: -1, v: r.value };
      if ((r.modeId === 'amrap' || r.modeId === 'amrapx') && r.kind === 'rounds' && (r.value > 0 || r.reps > 0)) return { dir: 1, v: r.value * 1000 + (r.reps || 0) };
      return null;
    },
    history: function () { return data.history.slice(); },
    addResult: function (r) {
      var key = r.modeId + '|' + String(r.name || '').trim().toLowerCase();
      var rec = Object.assign({}, r, { id: newId('h'), ts: Date.now(), key: key, pr: false });
      var sc = Store.score(rec);
      if (sc) {
        var prev = data.history.filter(function (h) { return h.key === key && Store.score(h); });
        if (prev.length) {
          var best = prev.reduce(function (a, h) { var v = Store.score(h).v; return sc.dir * v > sc.dir * a ? v : a; }, Store.score(prev[0]).v);
          rec.pr = sc.dir * sc.v > sc.dir * best;
        }
      }
      if (rec.modeId === 'run' && rec.efforts) {
        var bests = Store.runBests(), prs = [];
        Object.keys(rec.efforts).forEach(function (k) { if (bests[k] && rec.efforts[k] < bests[k].sec) prs.push(k); });
        rec.prs = prs; rec.pr = prs.length > 0;
      }
      data.history.push(rec);
      if (data.history.length > 500) data.history.splice(0, data.history.length - 500);
      persist(); return rec;
    },
    removeResult: function (id) { data.history = data.history.filter(function (h) { return h.id !== id; }); persist(); },
    clearHistory: function () { data.history = []; persist(); },

    /* ---- carreras: marcas por distancia y programas ---- */
    runBests: function () {
      var best = {};
      data.history.forEach(function (h) {
        if (h.modeId !== 'run' || !h.efforts) return;
        Object.keys(h.efforts).forEach(function (k) { if (!best[k] || h.efforts[k] < best[k].sec) best[k] = { sec: h.efforts[k], ts: h.ts, id: h.id }; });
      });
      return best;
    },
    programs: function () { return data.programs.slice(); },
    getProgram: function (id) { return data.programs.filter(function (p) { return p.id === id; })[0] || null; },
    saveProgram: function (p) {
      var i = data.programs.map(function (x) { return x.id; }).indexOf(p.id);
      if (i < 0) { p.id = p.id || newId('g'); data.programs.push(p); } else data.programs[i] = p;
      persist(); return p;
    },
    removeProgram: function (id) { data.programs = data.programs.filter(function (p) { return p.id !== id; }); persist(); },
    restorePrograms: function () {
      if (Store.getProgram('g1')) return 0;
      data.programs = seedPrograms().concat(data.programs); persist(); return 1;
    },

    /* ---- entreno pausado y guardado para retomar ---- */
    session: function () { return data.session || null; },
    saveSession: function (x) { data.session = x; return persist(); },
    clearSession: function () { data.session = null; persist(); },

    counter: function () { return data.counter || 0; },
    setCounter: function (n) { data.counter = Math.max(0, Math.min(99, n | 0)); persist(); },

    config: function (mode) { return Object.assign(root.Timer.defaultConfig(mode), data.configs[mode] || {}); },
    setConfig: function (mode, cfg) { data.configs[mode] = Object.assign({}, cfg); persist(); }
  };
  root.Store = Store;
})(window);
