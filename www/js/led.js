/* 4TIMER — display de 7 segmentos en SVG, como los relojes de pared de box */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var MAP = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '' };

  function hSeg(cx, cy, len, th) {
    var h = len / 2, t = th / 2;
    return [[cx - h, cy], [cx - h + t, cy - t], [cx + h - t, cy - t], [cx + h, cy], [cx + h - t, cy + t], [cx - h + t, cy + t]];
  }
  function vSeg(cx, cy, len, th) {
    var h = len / 2, t = th / 2;
    return [[cx, cy - h], [cx + t, cy - h + t], [cx + t, cy + h - t], [cx, cy + h], [cx - t, cy + h - t], [cx - t, cy - h + t]];
  }
  var SEGS = {
    a: hSeg(28, 6, 40, 10), g: hSeg(28, 48, 40, 10), d: hSeg(28, 90, 40, 10),
    f: vSeg(6, 27, 38, 10), b: vSeg(50, 27, 38, 10), e: vSeg(6, 69, 38, 10), c: vSeg(50, 69, 38, 10)
  };
  function pts(p) { return p.map(function (q) { return q[0] + ',' + q[1]; }).join(' '); }

  /* pattern: 'DD' o 'DD:DD' ('D' = dígito, ':' = dos puntos). Hereda el color de CSS (currentColor). */
  function LED(container, pattern) {
    this.el = container;
    this.cells = [];
    this.last = '';
    container.textContent = '';
    for (var i = 0; i < pattern.length; i++) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      if (pattern[i] === '.') {
        svg.setAttribute('viewBox', '0 0 16 96');
        svg.setAttribute('class', 'led-dot');
        var dc = document.createElementNS(NS, 'circle');
        dc.setAttribute('cx', 8); dc.setAttribute('cy', 90); dc.setAttribute('r', 6); dc.setAttribute('class', 'seg on');
        svg.appendChild(dc);
        this.cells.push(null);
      } else if (pattern[i] === ':') {
        svg.setAttribute('viewBox', '0 0 24 96');
        svg.setAttribute('class', 'led-colon');
        [32, 66].forEach(function (y) {
          var c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', 12); c.setAttribute('cy', y); c.setAttribute('r', 6);
          c.setAttribute('class', 'seg on');
          svg.appendChild(c);
        });
        this.cells.push(null);
      } else {
        svg.setAttribute('viewBox', '0 0 56 96');
        svg.setAttribute('class', 'led-digit');
        var segs = {};
        Object.keys(SEGS).forEach(function (k) {
          var p = document.createElementNS(NS, 'polygon');
          p.setAttribute('points', pts(SEGS[k]));
          p.setAttribute('class', 'seg');
          svg.appendChild(p);
          segs[k] = p;
        });
        this.cells.push(segs);
      }
      container.appendChild(svg);
    }
  }
  /* text con la misma longitud que el patrón, p. ej. '45:39' */
  LED.prototype.set = function (text) {
    if (text === this.last) return;
    this.last = text;
    for (var i = 0; i < this.cells.length; i++) {
      var segs = this.cells[i];
      if (!segs) continue;
      var on = MAP[text[i]] || '';
      for (var k in segs) segs[k].setAttribute('class', on.indexOf(k) > -1 ? 'seg on' : 'seg');
    }
  };
  /* Calcula la unidad 'u' (px por unidad de dibujo) y la disposición que mejor llena el hueco W×H.
     Fila: [rondas][tiempo] = 452 × 96 unidades (incluye el desplazamiento de la cursiva).
     Columna: tiempo encima, rondas debajo = 292 × 218 unidades. */
  LED.fitCalc = function (W, H, chromeW, chromeH) {
    var aw = Math.max(0, W - chromeW), ah = Math.max(0, H - chromeH);
    var row = Math.min(aw / 452, ah / 96), col = Math.min(aw / 292, ah / 218);
    var layout = col > row ? 'col' : 'row';
    var u = Math.max(0.2, Math.floor(Math.max(row, col) * 100) / 100);
    return { u: u, layout: layout };
  };
  /* Ajusta el display al hueco real de .stage y se reajusta al girar o cambiar el tamaño. Devuelve una función para parar. */
  LED.autoFit = function (stage, display, bezel, singleUnitsW) {
    function fit() {
      var cs = getComputedStyle(bezel);
      var cw = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      var ch = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      var r;
      if (singleUnitsW) {  // un único display (contador): ancho en unidades + cursiva
        var aw = Math.max(0, stage.clientWidth - (cw || 0) - 8), ah = Math.max(0, stage.clientHeight - (ch || 0) - 8);
        r = { layout: 'row', u: Math.max(0.2, Math.floor(Math.min(aw / (singleUnitsW + 12), ah / 96) * 100) / 100) };
      } else r = LED.fitCalc(stage.clientWidth, stage.clientHeight, (cw || 0) + 8, (ch || 0) + 8);
      display.dataset.layout = r.layout;
      display.style.setProperty('--u', r.u + 'px');
    }
    fit();
    var ro = root.ResizeObserver ? new root.ResizeObserver(fit) : null;
    if (ro) ro.observe(stage);
    root.addEventListener('resize', fit);
    root.addEventListener('orientationchange', fit);
    return function () { if (ro) ro.disconnect(); root.removeEventListener('resize', fit); root.removeEventListener('orientationchange', fit); };
  };
  /* Dibujo en canvas (para la tarjeta de compartir): mismos segmentos y cursiva que en pantalla.
     x,y = esquina superior izquierda, u = px por unidad. */
  LED.measure = function (text, u) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += (text[i] === ':' ? 24 : text[i] === '.' ? 16 : 56) * u + (i < text.length - 1 ? 8 * u : 0);
    return w;
  };
  LED.draw = function (ctx, text, x, y, u, color, glow) {
    ctx.save();
    ctx.translate(x, y + 48 * u);
    ctx.transform(1, 0, -Math.tan(7 * Math.PI / 180), 1, 0, 0);
    var cx = 0;
    for (var i = 0; i < text.length; i++) {
      if (text[i] === '.') {
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = glow || 0;
        ctx.beginPath(); ctx.arc(cx + 8 * u, 42 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
        cx += 16 * u + 8 * u;
        continue;
      }
      if (text[i] === ':') {
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = glow || 0;
        [32, 66].forEach(function (cy) { ctx.beginPath(); ctx.arc(cx + 12 * u, (cy - 48) * u, 6 * u, 0, Math.PI * 2); ctx.fill(); });
        cx += 24 * u + 8 * u;
        continue;
      }
      var on = MAP[text[i]] || '';
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function (k) {
        var lit = on.indexOf(k) > -1;
        ctx.beginPath();
        SEGS[k].forEach(function (pt, j) { var px = cx + pt[0] * u, py = (pt[1] - 48) * u; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = lit ? 1 : 0.08;
        ctx.shadowColor = color; ctx.shadowBlur = lit ? (glow || 0) : 0;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      cx += 56 * u + 8 * u;
    }
    ctx.restore();
  };
  root.LED = LED;
})(window);
