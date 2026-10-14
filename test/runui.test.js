const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('assert');
const www = path.join(__dirname, '..', 'www');
(async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(www, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, ''), { url: 'http://localhost/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; let beeps = 0;
  w.AudioContext = function () { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.resume = () => {};
    const node = () => ({ connect() {}, gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} }, start() { beeps++; }, stop() {} });
    this.createGain = node; this.createOscillator = node; };
  w.TextDecoder = require('util').TextDecoder; w.confirm = () => true; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
  let promptVal = null; w.prompt = () => promptVal;
  let offset = 0; const realNow = w.performance.now.bind(w.performance);
  Object.defineProperty(w, 'performance', { value: { now: () => realNow() + offset }, configurable: true });
  for (const f of ['timer', 'exercises', 'store', 'audio', 'led', 'map', 'share', 'run', 'runui', 'app']) w.eval(fs.readFileSync(path.join(www, 'js', f + '.js'), 'utf8'));
  const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const click = el => { assert.ok(el, 'falta el elemento a pulsar'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const tick = ms => new Promise(r => setTimeout(r, ms));
  const go = async h => { w.location.hash = h; await tick(40); const lv = $('#lv-exit'); if (lv) { click(lv); await tick(40); } };
  const now = () => w.RunUI._nowMs();
  let emit = null;
  w.Run.GPS.provider = { start(cb) { emit = cb; return () => { emit = null; }; } };
  const DLAT = 1 / 111195;
  let lat = 40.0;
  const fix = (m, acc = 5) => { lat += m * DLAT; emit({ lat, lon: -3, t: now(), acc }); };
  const ADV = async (sec, speed) => { for (let i = 0; i < sec; i++) { offset += 1000; fix(speed); } await tick(260); };

  // ---- hub ----
  assert.ok($$('.card .c-title').some(e => e.textContent === 'Running'), 'menú Running');
  await go('#/running');
  assert.ok($('[data-nav="#/running/free"]') && /Base aeróbica/.test($('.screen').textContent), 'hub con carrera libre y programa de ejemplo');
  console.log('Hub OK');

  // ---- carrera libre ----
  w.Store.setSettings({ prep: 2 });
  await go('#/running/free');
  assert.ok($('#main') && $('#finish').disabled);
  click($('#main')); await tick(260);
  assert.ok(/Prepárate/.test($('#phase').textContent), 'cuenta atrás');
  offset += 2300; await tick(300);
  assert.strictEqual($('.run').dataset.type, 'work', 'en marcha');
  await ADV(370, 3);                              // 1110 m a 3 m/s
  const redLed = () => $$('#led-red .led-digit').length;
  assert.ok($('#rg-info').textContent.includes('Km 1:'), 'parcial de km: ' + $('#rg-info').textContent);
  click($('#main')); await tick(100);              // pausa
  assert.ok(w.document.querySelector('.run').classList.contains('paused'));
  const pausedInfo = $('#rg-info').textContent; offset += 30000; await tick(300);
  click($('#main')); await tick(100);              // seguir
  await ADV(10, 3);
  click($('#finish')); await tick(40); assert.ok($('#lv-save')); click($('#lv-save')); await tick(80);
  assert.strictEqual(w.location.hash, '#/running/result');
  const h = w.Store.history().filter(x => x.modeId === 'run')[0];
  assert.ok(h, 'guardada en el historial');
  assert.ok(Math.abs(h.distance - 1140) < 30, 'distancia ' + h.distance);
  assert.ok(Math.abs(h.sec - 380) <= 3, 'tiempo en marcha sin la pausa: ' + h.sec);
  assert.strictEqual(h.splits.length >= 1, true); assert.ok(h.route.length >= 2 && h.efforts[1000]);
  assert.ok(/km/.test($('.screen').textContent) && $('.rr-route'), 'resultado con recorrido');
  console.log('Carrera libre OK', h.distance, h.sec);

  // ---- tarjeta de compartir: privacidad ----
  const calls = []; w.Share.render = (c, o) => { calls.push(o); return Promise.resolve(); };
  click($('#rs-share')); await tick(120);
  assert.strictEqual(w.location.hash, '#/share');
  assert.ok($('#sh-priv') && $('#sh-priv').checked, 'privacidad activada por defecto');
  let o = calls[calls.length - 1];
  assert.strictEqual(o.r.kind, 'run'); assert.ok(o.r.lines.length >= 1 && o.r.value === h.value);
  assert.ok(o.r.route.length === 0 || o.r.route.length < h.route.length, 'se recorta inicio/fin (carrera corta → sin recorrido)');
  $('#sh-priv').checked = false; $('#sh-priv').dispatchEvent(new w.Event('change', { bubbles: true })); await tick(60);
  o = calls[calls.length - 1]; assert.strictEqual(o.r.route.length, h.route.length, 'sin privacidad: recorrido completo');
  console.log('Compartir carrera OK');

  // ---- historial ----
  await go('#/history');
  assert.ok($('[data-hgpx]') && /1,1\d km/.test($('.hist-g').textContent), 'historial con carrera y GPX');
  console.log('Historial carrera OK');

  // ---- programa: parte por tiempo ----
  await go('#/running/program/g1');
  assert.ok($$('[data-go]').length === 5, 'partes del ejemplo: ' + $$('[data-go]').length);
  click($('[data-go="0.0"]')); await tick(60);
  assert.strictEqual(w.location.hash, '#/running/go/g1/0/0');
  assert.strictEqual($('#step-panel').dataset.lvl, '1');
  assert.ok(/Suave/i.test($('#st-lvl').textContent) && /3\/10/.test($('#st-note').textContent));
  click($('#main')); offset += 2300; await tick(300);
  const b0 = beeps; fix(0);
  offset += 297000; fix(5); await tick(300);       // casi al final del primer paso → suenan cuenta atrás programada
  assert.ok(beeps > b0, 'sonidos programados por adelantado: ' + (beeps - b0));
  offset += 4000; await tick(300);
  assert.strictEqual($('#step-panel').dataset.lvl, '2', 'cambio a Medio');
  assert.ok(/variando/.test($('#st-note').textContent));
  offset += 185000; await tick(300);
  assert.ok(/Terminado/.test($('#st-lvl').textContent), 'fin de la parte');
  click($('#exit')); await tick(40); click($('#lv-exit')); await tick(60);
  console.log('Parte por tiempo OK');

  // ---- programa: parte por distancia ----
  await go('#/running/go/g1/0/1');
  click($('#main')); offset += 2300; await tick(300);
  assert.ok(/8 km|8,00 km/.test($('#st-val').textContent), $('#st-val').textContent);
  await ADV(1500, 4);   // 6000 m
  assert.ok(!/Terminado/.test($('#st-lvl').textContent));
  await ADV(520, 4);    // 8080 m
  assert.ok(/Terminado/.test($('#st-lvl').textContent), 'distancia completada');
  click($('#finish')); await tick(40); click($('#lv-save')); await tick(80);
  const h2 = w.Store.history().filter(x => x.modeId === 'run').pop();
  assert.ok(h2.progKey === 'g1|0|1' && h2.distance > 8000);
  await go('#/running/program/g1'); assert.ok($('.chip.done'), 'parte marcada como hecha');
  console.log('Parte por distancia OK', h2.distance);

  // ---- editor de partes ----
  await go('#/running/part/g1/1/0');
  assert.ok($('.f-rounds').value === '5');
  $('.f-rounds').value = '4';
  const stp = $$('.stp')[0]; stp.querySelector('.f-min').value = '0'; stp.querySelector('.f-sec').value = '0';
  click($('#pt-save')); await tick(40);
  assert.ok(/#\/running\/part/.test(w.location.hash), 'tiempo 0 no se guarda'); assert.strictEqual(w.Store.getProgram('g1').weeks[1].parts[0].items[0].rounds, 5);
  $$('.stp')[0].querySelector('.f-sec').value = '30';
  click($('#pt-save')); await tick(60);
  assert.strictEqual(w.location.hash, '#/running/program/g1');
  const sv = w.Store.getProgram('g1').weeks[1].parts[0].items[0]; assert.strictEqual(sv.rounds, 4); assert.strictEqual(sv.steps[0].value, 30);
  await go('#/running/part/g1/1/0'); click($('#add-rep')); click($('[data-sadd="1"]')); click($('#pt-save')); await tick(60);
  assert.strictEqual(w.Store.getProgram('g1').weeks[1].parts[0].items.length, 2);
  console.log('Editor OK');

  // ---- importar / exportar ----
  const prog = w.Store.getProgram('g1'), text = w.Run.exportProgram(prog);
  await go('#/running/import-prog');
  $('#ip-text').value = '{"hola":1}'; click($('#ip-check')); assert.ok($('.err'), 'texto no válido rechazado'); assert.ok(!$('#ip-save'));
  const bad = JSON.parse(text); bad.program.weeks[0].parts[0].items[0].value = 1;
  $('#ip-text').value = JSON.stringify(bad); click($('#ip-check')); assert.ok(/tiempo fuera de rango/.test($('.err').textContent), $('.err') && $('.err').textContent);
  $('#ip-text').value = text; click($('#ip-check')); assert.ok($('#ip-save')); const n0 = w.Store.programs().length;
  click($('#ip-save')); await tick(60);
  assert.strictEqual(w.Store.programs().length, n0 + 1); assert.notStrictEqual(w.Store.programs()[n0].id, 'g1');
  console.log('Importar programa OK');

  // ---- importar carrera de un GPX ----
  const gpx = w.Run.buildGPX({ startT: Date.UTC(2025, 2, 1, 9), name: 'Del reloj', route: Array.from({ length: 400 }, (_, i) => [40 + i * 5 * DLAT, -3, i * 2, 650]) });
  await go('#/running/import-file');
  const f = new w.File([gpx], 'a.gpx'), inp = $('#if-file'); Object.defineProperty(inp, 'files', { value: [f] });
  inp.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(120);
  assert.ok($('#if-save'), 'vista previa de la carrera importada: ' + $('#if-out').textContent);
  click($('#if-save')); await tick(60);
  const h3 = w.Store.history().filter(x => x.source === 'file')[0]; assert.ok(h3 && Math.abs(h3.distance - 1995) < 30, 'distancia importada ' + (h3 && h3.distance));
  console.log('Importar carrera OK');
  // ---- salir de un entreno: seguir / pausar y guardar / salir ----
  await go('#/'); await go('#/config/amrap'); w.Store.setSettings({ prep: 3 });
  click($('#start')); await tick(60);
  assert.strictEqual(w.location.hash, '#/run');
  offset += 20000; await tick(150);
  w.history.back(); await tick(250);
  assert.ok($('#leave-sheet'), 'atrás pregunta si estás seguro'); assert.strictEqual(w.location.hash, '#/run', 'sigue en el entreno');
  click($('#lv-stay')); await tick(30); assert.ok(!$('#leave-sheet'));
  w.history.back(); await tick(250); click($('#lv-save')); await tick(120);
  assert.strictEqual(w.location.hash, '#/', 'vuelve a la pantalla principal');
  const ss = w.Store.session(); assert.ok(ss && ss.elapsed >= 20000 && ss.elapsed < 22000, 'sesión guardada: ' + (ss && ss.elapsed));
  assert.ok($('#resume-btn') && /Retomar entreno/.test($('#resume-btn').textContent), 'tarjeta Retomar entreno');
  click($('#resume-btn')); await tick(120);
  assert.strictEqual(w.location.hash, '#/run'); assert.ok($('.run').classList.contains('paused'), 'retoma en pausa'); assert.strictEqual(w.Store.session(), null);
  const t0 = $('#led-red').textContent; offset += 8000; await tick(150);
  assert.ok($('.run').classList.contains('paused'));
  click($('#pause')); await tick(30); assert.ok(!$('.run').classList.contains('paused'), 'Reanudar continúa');
  click($('#exit')); await tick(250); assert.ok($('#leave-sheet'));
  click($('#lv-exit')); await tick(120); assert.ok(!$('.run') && !w.Store.session(), 'salir sin guardar');
  console.log('Salir / pausar y retomar OK');
  // ---- atrás durante una carrera ----
  await go('#/running/free'); click($('#main')); offset += 4000; await tick(300);
  assert.strictEqual($('.run').dataset.type, 'work');
  w.history.back(); await tick(250);
  assert.ok($('#leave-sheet') && /Seguir corriendo/.test($('#leave-sheet').textContent), 'atrás en carrera pregunta'); assert.strictEqual(w.location.hash, '#/running/free');
  click($('#lv-stay')); await tick(30);
  click($('#exit')); await tick(40); click($('#lv-exit')); await tick(100);
  assert.strictEqual(w.location.hash, '#/running', 'salir sin guardar');
  console.log('Atrás en carrera OK');
  console.log('RUN UI OK'); process.exit(0);
})().catch(e => { console.log('FALLO:', e); process.exit(1); });
