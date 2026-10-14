const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('assert');
const www = path.join(__dirname, '..', 'www');

(async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(www, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, ''), {
    url: 'http://localhost/index.html', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  const beeps = [];
  w.AudioContext = function () {
    this.currentTime = 0; this.state = 'running'; this.destination = {};
    this.resume = () => {};
    const node = () => ({ connect() {}, gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} }, start() { beeps.push(1); }, stop() {} });
    this.createGain = node; this.createOscillator = node;
  };
  w.confirm = () => true; w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  // Reloj controlable: avanzar minutos sin esperar
  let offset = 0; const realNow = w.performance.now.bind(w.performance);
  Object.defineProperty(w, 'performance', { value: { now: () => realNow() + offset }, configurable: true });
  for (const f of ['timer', 'exercises', 'store', 'audio', 'led', 'map', 'share', 'run', 'runui', 'app']) w.eval(fs.readFileSync(path.join(www, 'js', f + '.js'), 'utf8'));

  const $ = s => w.document.querySelector(s);
  const $$ = s => [...w.document.querySelectorAll(s)];
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const input = (el, v) => { if (v !== undefined) el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const tick = ms => new Promise(r => setTimeout(r, ms));
  const go = async h => { w.location.hash = h; await tick(30); const lv = $('#lv-exit'); if (lv) { click(lv); await tick(30); } };   // si hay un entreno en marcha, se confirma la salida

  // ---- Menú: orden pedido, sin guardados ni reloj ----
  const titles = $$('.card .c-title').map(e => e.textContent);
  console.log('Menú:', titles.join(' | '));
  assert.strictEqual(titles[0], 'Entrenamientos predefinidos', 'Predefinidos va el primero');
  assert.strictEqual(JSON.stringify(titles.slice(1, 4)), '["For Time","EMOM","AMRAP"]');
  assert.strictEqual(titles[titles.length - 1], 'Compartir entreno', 'Compartir entreno va al final del todo');
  assert.strictEqual(titles[titles.length - 2], 'Historial');
  assert.strictEqual(titles[titles.length - 3], 'Ejercicios');
  assert.ok(titles.includes('Entrenamientos predefinidos') && titles.includes('Contador de rondas') && titles.includes('Running'));
  assert.ok(!titles.some(t => /guardados|Reloj/i.test(t)), 'no deben quedar Guardados ni Reloj');
  assert.strictEqual(titles.length, 15);

  // ---- Config: solo Empezar (sin guardar) ----
  await go('#/config/amrap');
  assert.ok($('#start') && !$('#save') && !$('#name'));
  w.Store.setSettings({ prep: 3 });
  click($('#start')); await tick(30);
  assert.strictEqual(w.location.hash, '#/run');
  assert.ok($('#plus') && $('#minus') && $('#pause'));
  await tick(200);
  assert.strictEqual($('#phase').textContent, 'Preparados');
  click($('#pause')); await tick(30);
  const before = $('#led-red').innerHTML;
  await tick(1300);
  assert.strictEqual($('#led-red').innerHTML, before, 'en pausa el display no cambia');
  click($('#pause'));
  click($('#plus')); click($('#plus')); click($('#minus')); await tick(60);

  // ---- Ejercicios: lista con explicación en español ----
  await go('#/exercises');
  assert.ok($$('.ex-card').length >= 39, 'hay ' + $$('.ex-card').length);
  assert.ok($('.ex-desc').textContent.length > 20);
  input($('#ex-q'), 'burpee');
  assert.ok($$('.ex-card').length >= 2 && $$('.ex-card').every(c => /burpee/i.test(c.textContent)));
  input($('#ex-q'), '');
  // añadir uno propio
  await go('#/exercise/new');
  input($('#x-name'), 'Thruster'); input($('#x-desc'), 'Sentadilla frontal seguida de press sobre la cabeza en un solo movimiento.');
  click($('#x-save')); await tick(30);
  assert.strictEqual(w.location.hash, '#/exercises');
  assert.ok(w.Store.exercises().some(e => e.name === 'Thruster'));
  // no se puede borrar uno en uso
  click($('[data-xdel="burpees"]')); await tick(10);
  assert.ok(w.Store.getExercise('burpees'), 'un ejercicio en uso no se borra');
  assert.ok(/No se puede borrar/.test($('.toast').textContent));

  // ---- Predefinidos: info (i) con explicación ----
  await go('#/presets');
  const cats = $$('.card .c-title').map(e => e.textContent);
  assert.strictEqual(JSON.stringify(cats), '["EMOM","AMRAP","For Time","Partners"]', 'categorías en orden: ' + cats);
  assert.ok(!$('.preset'), 'primero la lista de categorías');
  click($$('.card')[0]); await tick(30);                      // entrar en EMOM
  assert.strictEqual(w.location.hash, '#/presets/emom');
  assert.strictEqual($$('.preset').length, 5);
  assert.ok($$('.p-name').every(n => !/partner/i.test(n.textContent)));
  await go('#/presets/partners'); assert.strictEqual($$('.preset').length, 3);
  await go('#/presets/amrap'); assert.strictEqual($$('.preset').length, 2);
  await go('#/presets/emom');
  const info = $('[data-info="back-squat"]');
  assert.ok(info, 'cada ejercicio tiene su (i)');
  click(info); await tick(10);
  assert.ok(/Sentadilla trasera/.test($('.sheet').textContent), $('.sheet').textContent);
  click($('.sheet [data-close]')); await tick(10);
  assert.ok(!$('.sheet'));
  // numeración y cantidades puestas a mano
  const p7 = [...$$('.preset')].find(p => /Back squat \/ Bike/.test(p.textContent));
  assert.ok(/1\.\s*8\s*Back squat/.test(p7.querySelector('.ex-lines').textContent.replace(/\s+/g, ' ')), p7.querySelector('.ex-lines').textContent);

  // ---- Crear entreno con ejercicios de la biblioteca ----
  await go('#/preset/new');
  input($('#p-name'), 'Mi EMOM piernas');
  $('#p-mode').value = 'emom'; input($('#p-mode')); $('#p-num').checked = true; input($('#p-num'));
  click($('[data-f="rounds"][data-d="1"]'));                      // 11 rondas
  click($('#add-ex')); await tick(5);
  let line = $$('.ed-line')[0];
  input(line.querySelector('select[data-k="ex"]'), 'back-squat'); await tick(5);
  line = $$('.ed-line')[0];
  input(line.querySelector('input[data-k="qty"]'), '10');
  assert.ok(line.querySelector('[data-info="back-squat"]') || $$('.ed-line')[0].querySelector('[data-info="back-squat"]'), 'el (i) aparece al elegir ejercicio');
  click($$('.ed-line')[0].querySelector('[data-act="addpart"]')); await tick(5);
  input($$('.ed-line')[0].querySelectorAll('select[data-k="ex"]')[1], 'run'); await tick(5);
  input($$('.ed-line')[0].querySelectorAll('input[data-k="qty"]')[1], '200 m');
  click($('#add-ex')); await tick(5);
  input($$('.ed-line')[1].querySelector('select[data-k="ex"]'), 'rest'); await tick(5);
  click($('#add-txt')); await tick(5);
  input($$('.ed-line')[2].querySelector('input[data-k="text"]'), 'Sin descanso extra');
  click($$('.ed-line')[1].querySelector('[data-act="up"]')); await tick(5);   // Rest pasa a la primera línea
  click($('#p-save')); await tick(30);
  assert.strictEqual(w.location.hash, '#/presets/emom', 'tras guardar vuelve a su lista');
  const mine = w.Store.presets().find(p => p.name === 'Mi EMOM piernas');
  assert.strictEqual(mine.cfg.rounds, 11); assert.strictEqual(mine.numbered, true);
  assert.strictEqual(JSON.stringify(mine.lines.map(l => l.t)), '["ex","ex","txt"]');
  assert.strictEqual(mine.lines[0].parts[0].ex, 'rest');
  assert.strictEqual(JSON.stringify(mine.lines[1].parts.map(p => p.ex + ':' + p.qty)), '["back-squat:10","run:200 m"]');
  // se puede arrancar
  click($(`[data-prun="${mine.id}"]`)); await tick(40);
  assert.strictEqual(w.location.hash, '#/run');
  assert.ok(!$('#plus'), 'EMOM: ronda automática');
  // editar y borrar
  await go('#/preset/' + mine.id);
  input($('#p-name'), 'Mi EMOM v2'); click($('#p-save')); await tick(30);
  assert.strictEqual(w.Store.getPreset(mine.id).name, 'Mi EMOM v2');
  click($(`[data-pdel="${mine.id}"]`)); await tick(10);
  assert.strictEqual($$('.preset').length, 5);

  // ---- EMOM con ejercicios: aparecen en pantalla y el rojo salta cada minuto ----
  w.Store.setSettings({ prep: 0 });
  await go('#/presets/emom');
  click($('[data-prun="p7"]')); await tick(80);            // EMOM 12' · Back squat / Bike / Run / Rest
  assert.ok($('.ex-panel'), 'los ejercicios salen en el reloj');
  assert.strictEqual($$('.ex-panel .ex-line').length, 4);
  assert.ok($('.ex-panel [data-info="back-squat"]'), 'con su (i)');
  const nowIdx = () => $$('.ex-panel .ex-line').map((e, i) => e.classList.contains('now') ? i : -1).filter(i => i > -1).join(',');
  assert.strictEqual(nowIdx(), '0');
  offset += 61000; await tick(120); assert.strictEqual(nowIdx(), '1', 'a los 61 s pasa al 2.º ejercicio');
  offset += 60000; await tick(120); assert.strictEqual(nowIdx(), '2');
  offset += 60000; await tick(120); assert.strictEqual(nowIdx(), '3');
  offset += 60000; await tick(120); assert.strictEqual(nowIdx(), '0', 'tras el último vuelve al primero');
  assert.ok($$('.ex-panel .ex-line')[0].classList.contains('now'));
  // los 3 botones del reloj existen (Pausa, Reiniciar, Terminar)
  assert.ok($('#pause') && $('#reset') && $('#finish'));
  // AMRAP con ejercicios: se ven pero no hay resaltado
  await go('#/presets/amrap'); click($('[data-prun="p2"]')); await tick(80);
  assert.strictEqual($$('.ex-panel .ex-line').length, 5); assert.strictEqual($$('.ex-line.now').length, 0);

  // ---- Error: EMOM de 5 min con 6 ejercicios ----
  await go('#/preset/new');
  input($('#p-name'), 'Prueba error'); $('#p-mode').value = 'emom'; input($('#p-mode'));
  for (let i = 0; i < 6; i++) { click($('#add-ex')); await tick(2); input($$('.ed-line')[i].querySelector('select[data-k="ex"]'), 'burpees'); await tick(2); }
  while (w.Store.config('emom').rounds > 5 && $('#o-rounds').textContent > 5) click($('[data-f="rounds"][data-d="-1"]'));
  assert.ok(!$('#p-err').hidden && /05:00/.test($('#p-err').textContent), 'error visible: ' + $('#p-err').textContent);
  click($('#p-save')); await tick(20);
  assert.strictEqual(w.location.hash, '#/preset/new', 'no se guarda con error');
  assert.ok(!w.Store.presets().some(p => p.name === 'Prueba error'));
  click($('[data-f="rounds"][data-d="1"]')); await tick(5);
  assert.ok($('#p-err').hidden, 'sin error con 6 rondas');
  click($('#p-save')); await tick(30);
  assert.ok(w.Store.presets().some(p => p.name === 'Prueba error'));
  // un entreno ya guardado con error no arranca
  const bad = w.Store.addPreset({ name: 'Roto', mode: 'emom', cfg: { interval: 60, rounds: 3 }, numbered: true, lines: [1, 2, 3, 4].map(() => ({ t: 'ex', parts: [{ ex: 'run', qty: '' }], note: '' })) });
  await go('#/'); await go('#/presets/emom'); click($(`[data-prun="${bad.id}"]`)); await tick(20);
  assert.strictEqual(w.location.hash, '#/presets/emom'); assert.ok(/Error/.test($('.toast').textContent));
  w.Store.removePreset(bad.id);

  // ---- AMRAP con descansos de serie ----
  await go('#/presets/amrap'); click($('[data-prun="p8"]')); await tick(60);
  assert.ok(/AMRAP 1\/2/.test($('#phase').textContent) || $('#phase').textContent === 'Preparados');

  // ---- Contador de rondas ----
  await go('#/config/counter'); await tick(40);
  assert.strictEqual($('#phase').textContent, 'Rondas'); assert.ok(!$('#led-red'));
  click($('#plus')); click($('#plus')); click($('#plus')); click($('#minus'));
  assert.strictEqual(w.Store.counter(), 2);
  click($('#reset')); assert.strictEqual(w.Store.counter(), 0);

  // ---- Seguridad: nombres con HTML no se interpretan ----
  w.Store.addPreset({ name: '<img src=x onerror=alert(1)>', mode: 'emom', cfg: {}, lines: [{ t: 'txt', text: '<b>x</b>' }] });
  await go('#/presets/emom');
  assert.ok(!$('.preset img') && !$('.ex-txt b'));

  // ---- Compartir: AMRAP (rondas) y For Time (tiempo) ----
  const calls = [];
  w.Share.render = (cv, o) => { calls.push(o); return Promise.resolve(cv); };
  await go('#/'); await go('#/presets/amrap'); click($('[data-prun="p2"]')); await tick(80);   // AMRAP 20'
  click($('#plus')); click($('#plus')); click($('#plus')); await tick(80);
  assert.ok(/Pausa/.test($('#pause').textContent));
  offset += 1201000; await tick(150);                       // se acaba el AMRAP
  assert.ok(/Compartir/.test($('#pause').textContent), 'al terminar, el botón pasa a Compartir');
  click($('#pause')); await tick(60);
  assert.ok(/share/.test(w.location.hash) && $('#sh-canvas'), 'abre la pantalla de compartir');
  let o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'rounds'); assert.strictEqual(o.r.value, 3); assert.strictEqual(o.r.sub, 'en 20:00');
  assert.strictEqual(o.r.lines.length, 5); assert.strictEqual(o.r.lines[0].parts[0].name, 'American swing'); assert.strictEqual(o.r.lines[0].parts[0].qty, '15');
  assert.strictEqual(o.format, 'story'); assert.strictEqual(o.showExercises, true);
  click($('[data-fmt="post"]')); await tick(20); assert.strictEqual(calls[calls.length - 1].format, 'post');
  $('#sh-ex').checked = false; $('#sh-ex').dispatchEvent(new w.Event('change', { bubbles: true })); await tick(20);
  assert.strictEqual(calls[calls.length - 1].showExercises, false);
  click($('.top [data-nav]')); await tick(40); assert.ok(!$('.run'), 'volver no reinicia el reloj');

  await go('#/'); await go('#/presets/partners'); click($('[data-prun="p3"]')); await tick(80);   // For Time
  offset += 754000; await tick(80);
  click($('#finish')); await tick(40); assert.ok($('#leave-sheet')); click($('#lv-exit')); await tick(100);
  assert.ok(/Compartir/.test($('#pause').textContent));
  click($('#pause')); await tick(60);
  o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'time'); assert.ok(Math.abs(o.r.value - 754) <= 2, 'tiempo realizado ' + o.r.value);
  assert.strictEqual(o.r.modeName, 'FOR TIME');
  await go('#/'); await go('#/presets/emom'); click($('[data-prun="p6"]')); await tick(80);   // EMOM 12'
  offset += 200000; await tick(80); click($('#finish')); await tick(40); click($('#lv-exit')); await tick(100); click($('#pause')); await tick(60);
  o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'text'); assert.strictEqual(o.r.value, "EMOM 12'"); assert.strictEqual(o.r.lines.length, 3);
  assert.ok(!/\d\d:\d\d/.test(JSON.stringify(o.r)), 'el EMOM no muestra tiempo');
  console.log('Compartir OK:', o.r.modeName, o.r.value + 's');

  // ---- Compartir entreno sin haber usado la app ----
  await go('#/'); click($$('.card').find(c => /Compartir entreno/.test(c.textContent))); await tick(40);
  assert.strictEqual(w.location.hash, '#/share/new'); assert.ok($('#m-text') && $('#sh-bg-gal') && $('#sh-bd-cam'));
  input($('#m-min'), '12'); input($('#m-sec'), '34'); input($('#m-text'), 'Thrusters\n\nPull ups'); await tick(10);
  o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'time'); assert.strictEqual(o.r.value, 754); assert.strictEqual(o.r.lines.length, 2); assert.strictEqual(o.r.modeName, 'FOR TIME');
  click($('[data-mt="amrap"]')); input($('#m-rounds'), '7'); input($('#m-reps'), '12'); input($('#m-dur'), '20'); await tick(10);
  o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'rounds'); assert.strictEqual(o.r.value, 7); assert.strictEqual(o.r.sub, '+ 12 reps · en 20:00');
  click($('[data-mt="emom"]')); input($('#m-emom'), '15'); await tick(10);
  o = calls[calls.length - 1]; assert.strictEqual(o.r.kind, 'text'); assert.strictEqual(o.r.value, "EMOM 15'");
  console.log('Compartir manual OK');

  // ---- Historial y marcas personales ----
  let hist = w.Store.history();
  assert.ok(hist.length >= 3, 'los entrenos terminados se guardan solos: ' + hist.length);
  const am = hist.filter(h => h.modeId === 'amrap' && h.presetId === 'p2'); assert.strictEqual(am.length, 1); assert.strictEqual(am[0].value, 3); assert.strictEqual(am[0].pr, false, 'la primera vez no es PR');
  await go('#/'); await go('#/presets/amrap'); click($('[data-prun="p2"]')); await tick(80);
  for (let i = 0; i < 5; i++) click($('#plus'));
  offset += 1201000; await tick(150);
  const am2 = w.Store.history().filter(h => h.presetId === 'p2'); assert.strictEqual(am2.length, 2); assert.strictEqual(am2[1].value, 5); assert.strictEqual(am2[1].pr, true, '5 rondas > 3 rondas = PR');
  assert.ok(/marca personal/.test($('.toast').textContent), 'avisa de la marca personal');
  click($('#pause')); await tick(40); assert.strictEqual(calls[calls.length - 1].r.pr, true, 'la tarjeta recibe pr');
  // For Time: menos tiempo es mejor
  const f1 = w.Store.addResult({ modeId: 'fortime', modeName: 'FOR TIME', name: 'Fran', kind: 'time', value: 300, rounds: 0, lines: [] });
  const f2 = w.Store.addResult({ modeId: 'fortime', modeName: 'FOR TIME', name: 'fran', kind: 'time', value: 280, rounds: 0, lines: [] });
  const f3 = w.Store.addResult({ modeId: 'fortime', modeName: 'FOR TIME', name: 'Fran', kind: 'time', value: 310, rounds: 0, lines: [] });
  assert.ok(!f1.pr && f2.pr && !f3.pr, 'PR solo con un tiempo menor (mismo nombre sin importar mayúsculas)');
  await go('#/'); click($$('.card').find(c => /Historial/.test(c.textContent))); await tick(40);
  assert.strictEqual(w.location.hash, '#/history');
  assert.ok($$('.hist-g').length >= 3);
  const fr = $$('.hist-g').find(g => /Fran/.test(g.textContent));
  assert.ok(/3 veces/.test(fr.textContent) && /04:40/.test(fr.querySelector('.h-pr').textContent), 'resumen: 3 veces, PR 04:40');
  assert.ok(fr.querySelector('.h-d.good') && /−00:20/.test(fr.querySelector('.h-d.good').textContent), 'delta −20 s en verde: ' + [...fr.querySelectorAll('.h-d')].map(x => x.textContent));
  assert.ok(fr.querySelector('.h-d.bad'), '+30 s en rojo');
  const rep = $$('.hist-g').find(g => g.querySelector('[data-hrep]')); click(rep.querySelector('[data-hrep]')); await tick(60);
  assert.strictEqual(w.location.hash, '#/run', 'Repetir arranca el entreno');
  await go('#/'); await go('#/history'); const n0 = w.Store.history().length;
  click($('[data-hdel]')); await tick(30); assert.strictEqual(w.Store.history().length, n0 - 1, 'se puede borrar un resultado');
  console.log('Historial OK');
  // plantillas: horizontal y logo grande
  await go('#/share/new'); await tick(30);
  click($('[data-fmt="land"]')); click($('[data-sty="logo"]')); await tick(20);
  o = calls[calls.length - 1]; assert.strictEqual(o.format, 'land'); assert.strictEqual(o.style, 'logo');
  click($('[data-sty="std"]')); await tick(10); assert.strictEqual(calls[calls.length - 1].style, 'std');
  // guardar manual en el historial exige nombre
  const nH = w.Store.history().length; click($('#sh-hist')); await tick(10); assert.strictEqual(w.Store.history().length, nH, 'sin nombre no guarda');
  input($('#m-name'), 'Murph'); input($('#m-min'), '45'); click($('#sh-hist')); await tick(10); assert.strictEqual(w.Store.history().length, nH + 1);
  assert.strictEqual(w.Store.history().slice(-1)[0].modeId, 'fortime');
  console.log('Plantillas OK');
  // accesibilidad: sonidos distintos por tipo
  w.Store.setSound('work', { preset: 'beep' }); w.Store.setSound('rest', { preset: 'beep' });
  await go('#/settings'); await tick(20); click($('#snd-access')); await tick(20);
  const sn = w.Store.settings().sounds;
  assert.strictEqual(sn.work.preset, 'tick'); assert.strictEqual(sn.rest.preset, 'long');
  assert.strictEqual(new Set(Object.values(sn).map(x => x.preset)).size, 9, 'los 9 eventos suenan distinto');
  assert.ok(w.Sound.PRESETS.tick && w.Sound.PRESETS.long);
  console.log('Accesibilidad OK');

  // ---- Migración: datos de la versión anterior (solo texto) ----
  const old = { presets: [
    { id: 'p2', name: 'viejo', mode: 'amrap', cfg: { dur: 1200 }, desc: 'x' },
    { id: 'custom1', name: 'Mío antiguo', mode: 'emom', cfg: {}, desc: '8 Burpees\nRest' }] };
  const w2 = new JSDOM('<main id="app"></main>', { url: 'http://localhost/', runScripts: 'outside-only' }).window;
  w2.localStorage.setItem('4timer.v1', JSON.stringify(old));
  for (const f of ['timer', 'exercises', 'store']) w2.eval(fs.readFileSync(path.join(www, 'js', f + '.js'), 'utf8'));
  const migrated = w2.Store.presets();
  assert.ok(Array.isArray(migrated.find(p => p.id === 'p2').lines) && migrated.find(p => p.id === 'p2').lines[0].t === 'ex');
  assert.strictEqual(JSON.stringify(migrated.find(p => p.id === 'custom1').lines.map(l => l.text)), '["8 Burpees","Rest"]');
  console.log('UI OK');
  process.exit(0);
})().catch(e => { console.error('FALLO:', e); process.exit(1); });
