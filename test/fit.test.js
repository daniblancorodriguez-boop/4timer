const assert = require('assert');
global.window = global; global.document = {};
require('../www/js/led.js');
const fit = window.LED.fitCalc;
// El reloj calculado SIEMPRE cabe en el hueco (margen del bezel incluido)
const chromeW = 56, chromeH = 48;
let n = 0;
for (let W = 240; W <= 1400; W += 20) for (let H = 100; H <= 1000; H += 20) {
  const r = fit(W, H, chromeW, chromeH);
  if (r.u <= 1) continue; // espacio mínimo: se usa u=1 y no hay nada mejor que hacer
  const w = r.layout === 'row' ? 452 * r.u : 292 * r.u;
  const h = r.layout === 'row' ? 96 * r.u : 218 * r.u;
  assert.ok(w <= W - chromeW + 0.01 && h <= H - chromeH + 0.01, `no cabe en ${W}x${H}: ${JSON.stringify(r)} ${w}x${h}`);
  n++;
}
assert.strictEqual(fit(358, 540, chromeW, chromeH).layout, 'col');   // móvil en vertical
assert.strictEqual(fit(700, 150, chromeW, chromeH).layout, 'row');   // móvil en horizontal
console.log('fit OK en', n, 'tamaños');
