const assert = require('assert');
const T = require('../www/js/timer.js');

// Simula el reloj a 100 ms y recoge eventos
function sim(id, cfg, prep, opts, until) {
  const plan = T.buildPlan(id, cfg);
  let prev = null, events = [];
  const end = until || ((prep + plan.total + 3) * 1000);
  for (let ms = 0; ms <= end; ms += 100) {
    const cur = T.stateAt(plan, prep, ms);
    T.eventsFor(plan, prev, cur, opts).forEach(e => events.push([ms, e]));
    prev = cur;
  }
  return { plan, events };
}
const count = (ev, n) => ev.filter(e => e[1] === n).length;

// Tabata: 8 rondas, 4:00 total
let r = sim('tabata', {}, 10, { beepLast3: true });
assert.strictEqual(r.plan.total, 240);
assert.strictEqual(count(r.events, 'go'), 1);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(count(r.events, 'work'), 7);   // inicio de cada trabajo salvo el primero
assert.strictEqual(count(r.events, 'rest'), 8);
// Cuenta previa: pitidos en 3,2,1 (a los 7 s, 8 s, 9 s) y "go" a los 10 s
const pre = r.events.filter(e => e[1] === 'countdown' && e[0] < 10000).map(e => e[0]);
assert.deepStrictEqual(pre, [7000, 8000, 9000].map(x => x + 100 - 100 + 0).map(x => pre[pre.indexOf(x)]));
assert.strictEqual(pre.length, 3);
assert.strictEqual(r.events.find(e => e[1] === 'go')[0], 10000);
console.log('tabata ok, pitidos previos en ms:', pre);

// EMOM 10 x 60 s: 9 cambios de minuto + fin
r = sim('emom', { rounds: 10, interval: 60 }, 10, { beepLast3: false });
assert.strictEqual(count(r.events, 'minute'), 9);
assert.strictEqual(count(r.events, 'end'), 1);
console.log('emom ok');

// AMRAP 12:00 sin time cap
r = sim('amrap', {}, 10, { beepLast3: true });
assert.strictEqual(r.plan.total, 720);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(count(r.events, 'countdown'), 3 + 3);
console.log('amrap ok');

// For Time con cap de 5 min
r = sim('fortime', { cap: 300 }, 3, {}, 400000);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(r.events.find(e => e[1] === 'end')[0], 303000);
// For Time sin cap: nunca termina solo
r = sim('fortime', { cap: 0 }, 10, {}, 3600000);
assert.strictEqual(count(r.events, 'end'), 0);
console.log('fortime ok');

// Fight Gone Bad: 3 x 5 x 60 + 2 x 60 = 1020 s
r = sim('fortime', {}, 0, {}, 1000);
const fgb = T.buildPlan('fgb', {});
assert.strictEqual(fgb.total, 3 * 5 * 60 + 2 * 60);
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 61000).label, 'Estación 2');
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 301000).label, 'Descanso');
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 361000).round, 2);
console.log('fgb ok');

// Trabajo = descanso y descanso temporizado
assert.strictEqual(T.buildPlan('equal', { work: 30, rounds: 3 }).total, 150);
assert.strictEqual(T.buildPlan('rest', { dur: 90 }).total, 90);
assert.strictEqual(T.stateAt(T.buildPlan('rest', { dur: 90 }), 0, 1).display, 90);
assert.strictEqual(T.fmt(125), '02:05');

// Sin cuenta previa: "go" inmediato
r = sim('rest', { dur: 5 }, 0, {});
assert.strictEqual(r.events[0][1], 'go');
// Pantalla de resumen para listas
assert.strictEqual(T.summary('emom', { rounds: 12, interval: 60 }), '12 × 01:00');
// AMRAP con descansos: 2 x 10' + 1' de descanso
r = sim('amrapx', { dur: 600, blocks: 2, rest: 60 }, 10, { beepLast3: false });
assert.strictEqual(r.plan.total, 1260);
assert.strictEqual(count(r.events, 'rest'), 1);
assert.strictEqual(count(r.events, 'work'), 1);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(T.stateAt(r.plan, 0, 100000).label, 'AMRAP 1/2');
assert.strictEqual(T.stateAt(r.plan, 0, 700000).label, 'AMRAP 2/2');
// Contador de rondas: sin reloj; y el menú queda ordenado
assert.strictEqual(T.buildPlan('counter', {}).kind, 'counter');
const ids = T.MODES.map(m => m.id);
assert.deepStrictEqual(ids.slice(0, 3), ['fortime', 'emom', 'amrap']);
assert.strictEqual(ids[ids.length - 1], 'counter');
assert.ok(!ids.includes('clock'), 'el Reloj ya no existe');
// Validación: EMOM con menos rondas que ejercicios
const L = n => Array.from({ length: n }, () => ({ t: 'ex', parts: [{ ex: 'run', qty: '' }], note: '' }));
const e1 = T.validateLines('emom', { interval: 60, rounds: 5 }, L(6));
assert.ok(/05:00/.test(e1) && /\(5\)/.test(e1) && /\(6\)/.test(e1), e1);
assert.strictEqual(T.validateLines('emom', { interval: 60, rounds: 6 }, L(6)), null);
assert.strictEqual(T.validateLines('emom', { interval: 60, rounds: 12 }, L(3)), null);
assert.strictEqual(T.validateLines('amrap', { dur: 60 }, L(6)), null, 'AMRAP no rota ejercicios');
assert.strictEqual(T.validateLines('emom', { rounds: 2 }, [{ t: 'txt', text: '21-15-9' }]), null, 'el texto libre no cuenta');
console.log('TODOS LOS TESTS OK');

// ---- timeline == eventsFor (muestreo fino) en todos los modos ----
{
  const T = require('../www/js/timer.js');
  const Tm = T.Timer || global.Timer || T;
  for (const id of Tm.MODES.map(m => m.id).filter(i => i !== 'counter')) {
    for (const prep of [0, 2, 10]) {
      const plan = Tm.buildPlan(id, Tm.defaultConfig(id));
      if (plan.kind === 'up') plan.cap = 90;
      const tl = Tm.timeline(plan, prep, { beepLast3: true });
      const ev = []; let prev = null;
      const total = ((plan.total || plan.cap) + prep + 2) * 1000;
      for (let ms = 0; ms <= total; ms += 10) {
        const cur = Tm.stateAt(plan, prep, ms);
        Tm.eventsFor(plan, prev, cur, { beepLast3: true }).forEach(e => ev.push([e, ms])); prev = cur;
      }
      const a = tl.map(e => e.ev).join(','), b = ev.map(e => e[0]).join(',');
      assert.strictEqual(a, b, `timeline ${id} prep ${prep}: mismas secuencias de eventos`);
      tl.forEach((e, i) => assert.ok(Math.abs(e.ms - ev[i][1]) <= 10, `${id} ${e.ev}: ${e.ms} vs ${ev[i][1]}`));
    }
  }
  console.log('timeline coincide con eventsFor en todos los modos');
}
