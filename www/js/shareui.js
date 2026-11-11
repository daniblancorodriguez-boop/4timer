/* 4TIMER — editor de la tarjeta para compartir: plantillas en ruleta, elementos que se mueven, redimensionan, giran y se ponen en capas */
(function (root) {
  'use strict';
  function K() { return root.AppKit; }
  var PREV_SCALE = 0.5;                                 // la vista previa se dibuja a media resolución (más fluida al arrastrar)

  /* host: contenedor · cfg: { model() → datos del entreno, text() → texto para compartir, isRun, gymName, logoSrc, logoRound } */
  function mount(host, cfg) {
    var S = root.Share, k = K(), ICON = k.ICON, VS = S.videoSupported();
    function $(s) { return k.$(s, host); }
    function $$(s) { return k.$$(s, host); }
    var st = { format: 'story', tpl: 0, sc: null, sel: null, spare: [], busy: false, logo: null }, seq = 0, drag = null, thumbT = 0, dead = false;

    host.innerHTML =
      '<div class="seg-ctl" id="ed-fmt" role="group" aria-label="Tamaño"><button class="btn small on" data-fmt="story">Stories 9:16</button><button class="btn small" data-fmt="post">Publicación 4:5</button></div>' +
      '<div class="tpl-strip" id="ed-tpl" role="listbox" aria-label="Plantillas">' +
      S.TEMPLATES.map(function (t, i) { return '<button class="tpl' + (i === 0 ? ' on' : '') + '" data-tpl="' + i + '" role="option"><canvas></canvas><span>' + t.name + '</span></button>'; }).join('') + '</div>' +
      '<div class="share-prev ed-prev"><canvas id="sh-canvas" aria-label="Vista previa editable de la imagen para compartir"></canvas></div>' +
      '<p class="hint" id="ed-hint">Toca un recuadro para editarlo y arrástralo. Desliza el fondo a la izquierda para cambiar de plantilla.</p>' +
      '<div class="ed-bar" id="ed-bar" hidden>' +
      '<div class="ed-sel"><b id="ed-name"></b><span id="ed-deselect" class="ed-x" role="button" tabindex="0">Cerrar ✕</span></div>' +
      '<div class="seg-ctl" id="ed-styles" role="group" aria-label="Estilo"></div>' +
      '<div class="ed-ops">' +
      '<button class="btn small" data-op="up">Delante</button><button class="btn small" data-op="down">Detrás</button>' +
      '<button class="btn small" data-op="smaller">Más pequeño</button><button class="btn small" data-op="bigger">Más grande</button>' +
      '<button class="btn small" data-op="rotl">Girar ↺</button><button class="btn small" data-op="rotr">Girar ↻</button>' +
      '<button class="btn small" data-op="src" data-media>Cambiar foto / vídeo</button><button class="btn small" data-op="clear" data-media>Vaciar</button>' +
      '<button class="btn small" data-op="fill" data-media>Poner de fondo</button><button class="btn small" data-op="free" data-fixed>Liberar fondo</button>' +
      '<button class="btn small danger" data-op="del">Eliminar</button></div></div>' +
      '<div class="ed-add" id="ed-add"></div>' +
      '<button class="btn primary block" id="sh-share">' + ICON.share + 'Compartir</button>' +
      '<button class="btn block" id="sh-save" style="margin-top:10px">' + ICON.download + 'Guardar imagen</button>' +
      '<div id="sh-vid-box" hidden><button class="btn block" id="sh-vshare" style="margin-top:10px">' + ICON.share + 'Compartir vídeo</button>' +
      '<button class="btn primary block" id="sh-vsave" style="margin-top:10px">' + ICON.download + 'Guardar vídeo</button>' +
      '<p class="hint">Instagram recorta a 15 s lo que se le envía desde otra app con «Compartir». Para historias de hasta 60 s pulsa «Guardar vídeo» y súbelo desde la galería dentro de Instagram. Si el vídeo dura más de 60 s se guarda en partes de 60 s. Si hay varios vídeos se graban a la vez; manda el más largo.</p>' +
      '<div class="vprog" id="sh-vprog" hidden><div class="vbar"><i id="sh-vbar"></i></div><span id="sh-vtxt">Grabando…</span></div></div>' +
      '<p class="hint">En «Compartir» elige Instagram (Stories o publicación) en el menú del móvil. Si tu navegador no lo permite, se guarda la imagen para que la subas tú.</p>';

    var canvas = $('#sh-canvas');

    /* ---------- escena ---------- */
    function data(pool) { return { r: cfg.model(), logo: st.logo, gymName: cfg.gymName, isRun: !!cfg.isRun, pool: pool || [] }; }
    function build(i, pool) { var sc = S.makeScene(i, st.format, data(pool)); st.spare = sc.spare || []; return sc; }
    st.sc = build(0, []);
    function selEl() { return st.sel ? st.sc.elements.filter(function (e) { return e.id === st.sel; })[0] || null : null; }

    function draw(final) {
      var my = ++seq, sc = st.sc; sc.r = cfg.model(); sc.logo = st.logo; sc.gymName = cfg.gymName;
      var b = canvas.getBoundingClientRect(), fm = S.FORMATS[sc.format];
      var o = final ? { edit: false } : { edit: true, sel: st.sel, scale: PREV_SCALE, pxs: b.width ? fm.w / b.width : 3 };
      return S.render(canvas, sc, o).then(function () { return my; });
    }
    function changed() { draw(); bar(); thumbsLater(); }

    /* ---------- ruleta de plantillas ---------- */
    function thumbs() {
      if (dead) return;
      $$('.tpl').forEach(function (b) {
        var i = +b.dataset.tpl, sc = S.makeScene(i, st.format, data(S.mediaOf(st.sc).concat(st.spare)));
        S.renderThumb(b.querySelector('canvas'), sc, 84);
      });
    }
    function thumbsLater() { clearTimeout(thumbT); thumbT = setTimeout(thumbs, 250); }
    function markTpl() {
      $$('.tpl').forEach(function (b) { var on = +b.dataset.tpl === st.tpl; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); if (on && b.scrollIntoView) { try { b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {} } });
    }
    function setTpl(i) {
      var n = S.TEMPLATES.length; i = ((i % n) + n) % n;
      var pool = S.mediaOf(st.sc).concat(st.spare);       // las fotos y vídeos ya cargados pasan a los huecos de la nueva plantilla
      st.tpl = i; st.sc = build(i, pool); st.sel = null; markTpl(); changed(); vidBox();
    }
    host.addEventListener('click', function (e) {
      var t = e.target.closest('.tpl'); if (t) { setTpl(+t.dataset.tpl); return; }
      var f = e.target.closest('[data-fmt]');
      if (f) { st.format = f.dataset.fmt; st.sc.format = st.format; $$('[data-fmt]').forEach(function (x) { x.classList.toggle('on', x === f); }); changed(); }
    });

    /* ---------- barra del elemento seleccionado ---------- */
    function bar() {
      var e = selEl(), b = $('#ed-bar'); b.hidden = !e;
      renderAdd();
      if (!e) return;
      var styles = S.STYLES[e.type] || [], box = $('#ed-styles');
      $('#ed-name').textContent = S.TYPE_LABEL[e.type] + (e.label && e.type === 'media' ? ' · ' + e.label : '');
      box.hidden = !styles.length;
      box.innerHTML = styles.map(function (n, i) { return '<button class="btn small' + (i === (e.style | 0) ? ' on' : '') + '" data-est="' + i + '">' + n + '</button>'; }).join('');
      $$('#ed-bar [data-media]').forEach(function (x) { x.hidden = e.type !== 'media' || (x.dataset.op === 'clear' && !e.media) || (x.dataset.op === 'fill' && e.fixed && e.w > 0.99); });
      $$('#ed-bar [data-fixed]').forEach(function (x) { x.hidden = !(e.type === 'media' && e.fixed); });
    }
    function renderAdd() {
      var have = {}; st.sc.elements.forEach(function (e) { have[e.type] = true; });
      var types = ['media', 'title', 'stat', 'exercises', 'logo', 'brand', 'footer'].concat(cfg.isRun ? ['route'] : []);
      $('#ed-add').innerHTML = '<span class="ed-add-l">Añadir</span>' + types.filter(function (t) { return t === 'media' || !have[t]; }).map(function (t) {
        return '<button class="btn small" data-add="' + t + '">+ ' + S.TYPE_LABEL[t] + '</button>';
      }).join('');
    }
    function move(e, delta) {                              // cambia el orden de capas
      var a = st.sc.elements, i = a.indexOf(e), j = i + delta; if (j < 0 || j >= a.length) return;
      a.splice(i, 1); a.splice(j, 0, e);
    }
    function scaleBy(e, f) {
      var cx = e.x + e.w / 2, cy = e.y + e.h / 2; e.w = Math.min(1.5, Math.max(0.05, e.w * f)); e.h = Math.min(1.5, Math.max(0.03, e.h * f)); e.x = cx - e.w / 2; e.y = cy - e.h / 2;
    }
    host.addEventListener('click', function (ev) {
      var e = selEl(), t;
      if ((t = ev.target.closest('[data-add]'))) {
        var type = t.dataset.add;
        if (type !== 'media') { var ex = st.sc.elements.filter(function (x) { return x.type === type; })[0]; if (ex) { st.sel = ex.id; changed(); return; } }
        var ne = S.newElement(type, st.sc); if (type === 'media') ne.label = 'Foto o vídeo';
        st.sc.elements.push(ne); st.sel = ne.id; changed();
        if (type === 'media') openSheet(ne);
        return;
      }
      if (ev.target.closest('#ed-deselect')) { st.sel = null; changed(); return; }
      if (!e) return;
      if ((t = ev.target.closest('[data-est]'))) { e.style = +t.dataset.est; changed(); return; }
      if (!(t = ev.target.closest('[data-op]'))) return;
      var op = t.dataset.op;
      if (op === 'up') move(e, 1); else if (op === 'down') move(e, -1);
      else if (op === 'bigger') scaleBy(e, 1.1); else if (op === 'smaller') scaleBy(e, 1 / 1.1);
      else if (op === 'rotl' || op === 'rotr') { e.rot = (e.rot || 0) + (op === 'rotl' ? -0.05 : 0.05); if (Math.abs(e.rot) < 0.01) e.rot = 0; }
      else if (op === 'del') { dropMedia(e); st.sc.elements.splice(st.sc.elements.indexOf(e), 1); st.sel = null; }
      else if (op === 'src') { openSheet(e); return; }
      else if (op === 'clear') dropMedia(e);
      else if (op === 'fill') { e.x = 0; e.y = 0; e.w = 1; e.h = 1; e.rot = 0; e.style = 0; e.fixed = true; var a = st.sc.elements; a.splice(a.indexOf(e), 1); a.unshift(e); }
      else if (op === 'free') e.fixed = false;
      changed(); vidBox();
    });
    host.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.id === 'ed-deselect') { st.sel = null; changed(); } });

    /* ---------- gestos sobre la tarjeta ---------- */
    function pt(ev) {
      var b = canvas.getBoundingClientRect(), fm = S.FORMATS[st.sc.format], sx = b.width ? fm.w / b.width : 1, sy = b.height ? fm.h / b.height : 1;
      return { x: (ev.clientX - b.left) * sx, y: (ev.clientY - b.top) * sy, px: sx, fm: fm };
    }
    function snap(e) { return { x: e.x, y: e.y, w: e.w, h: e.h, rot: e.rot || 0 }; }
    canvas.addEventListener('pointerdown', function (ev) {
      if (st.busy || (ev.button && ev.button !== 0)) return;
      var p = pt(ev), cur = selEl(), hit = null;
      if (cur && !cur.fixed && S.handleHit(st.sc, cur, p.x, p.y, 44 * p.px)) drag = { mode: 'resize', el: cur, sx: p.x, sy: p.y, e0: snap(cur), moved: false };
      else {
        hit = S.hitTest(st.sc, p.x, p.y);
        if (hit && !hit.fixed) { st.sel = hit.id; drag = { mode: 'move', el: hit, sx: p.x, sy: p.y, ox: hit.x, oy: hit.y, moved: false, wasSel: cur === hit }; }
        else drag = { mode: 'swipe', el: hit, sx: p.x, sy: p.y, dx: 0, dy: 0 };
      }
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      if (ev.cancelable) ev.preventDefault();
      draw(); bar();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var p = pt(ev), dx = p.x - drag.sx, dy = p.y - drag.sy, fm = p.fm;
      if (Math.abs(dx) + Math.abs(dy) > 8 * p.px) drag.moved = true;
      if (drag.mode === 'move') {
        var e = drag.el; e.x = Math.max(-e.w / 2, Math.min(1 - e.w / 2, drag.ox + dx / fm.w)); e.y = Math.max(-e.h / 2, Math.min(1 - e.h / 2, drag.oy + dy / fm.h)); draw();
      } else if (drag.mode === 'resize') {
        var r = drag.e0, c = drag.el; c.x = r.x; c.y = r.y; c.w = r.w; c.h = r.h; S.resizeBy(st.sc, c, r, dx, dy); draw();
      } else { drag.dx = dx; drag.dy = dy; }
    });
    function endDrag(ev, cancel) {
      if (!drag) return; var d = drag; drag = null;
      try { canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (cancel) { draw(); return; }
      var p = pt(ev);
      if (d.mode === 'swipe') {
        if (Math.abs(d.dx) > 70 * p.px && Math.abs(d.dx) > Math.abs(d.dy) * 1.3) { setTpl(st.tpl + (d.dx < 0 ? 1 : -1)); return; }
        if (!d.moved) { st.sel = d.el ? d.el.id : null; if (d.el && d.el.type === 'media' && !d.el.media) openSheet(d.el); }
      } else if (d.mode === 'move' && !d.moved && d.el.type === 'media' && !d.el.media) openSheet(d.el);
      changed();
    }
    canvas.addEventListener('pointerup', function (ev) { endDrag(ev, false); });
    canvas.addEventListener('pointercancel', function (ev) { endDrag(ev, true); });
    canvas.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowLeft') setTpl(st.tpl - 1); else if (ev.key === 'ArrowRight') setTpl(st.tpl + 1); });
    canvas.tabIndex = 0;

    /* ---------- fotos y vídeos: cámara o galería ---------- */
    function dropMedia(e) {
      if (e.media) { var m = e.media; if (m.kind === 'video') { try { m.el.pause(); } catch (x) {} } if (m.url) { try { URL.revokeObjectURL(m.url); } catch (x) {} } e.media = null; }
    }
    function loadImage(file) {
      return new Promise(function (res) {
        var url = URL.createObjectURL(file), i = new Image();
        i.onload = function () { URL.revokeObjectURL(url); res({ el: i, kind: 'img' }); };
        i.onerror = function () { URL.revokeObjectURL(url); res(null); };
        i.src = url;
      });
    }
    function loadVideo(file) {
      return new Promise(function (res) {
        var v = document.createElement('video'), url = URL.createObjectURL(file), done = false;
        v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.muted = true;
        function fail() { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (e) {} res(null); }
        v.onerror = fail;
        v.onloadeddata = function () {
          if (!(v.duration > 0)) return fail();
          v.onseeked = function () { v.onseeked = null; if (done) return; done = true; res({ el: v, kind: 'video', url: url }); };
          try { v.currentTime = Math.min(0.2, v.duration / 2); } catch (e) {}
        };
        v.src = url;
      });
    }
    function setMedia(e, file) {
      if (!file) return;
      var isVid = /^video\//.test(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(file.name || '');
      if (isVid && !VS) { k.toast('Este móvil no puede grabar vídeos con la tarjeta. Prueba con una foto'); return; }
      (isVid ? loadVideo(file) : loadImage(file)).then(function (m) {
        if (dead) return;
        if (!m) { k.toast(isVid ? 'No se pudo abrir ese vídeo' : 'No se pudo abrir esa imagen'); return; }
        dropMedia(e); e.media = m; st.sel = e.id; changed(); vidBox();
        if (isVid) { var n = S.partsOf(m.el); if (n > 1) k.toast('El vídeo dura ' + Math.round(m.el.duration) + ' s: se grabará en ' + n + ' partes de 60 s (límite de Instagram)'); }
      });
    }
    function closeSheet() { var s = document.getElementById('md-sheet'); if (s) s.remove(); }
    function openSheet(e) {
      closeSheet();
      var back = document.createElement('div'); back.className = 'sheet-back'; back.id = 'md-sheet';
      back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="Añadir foto o vídeo"><h2>Añadir foto o vídeo</h2>' +
        '<label class="btn block">' + ICON.camera + 'Hacer foto<input type="file" accept="image/*" capture="environment" hidden data-md></label>' +
        (VS ? '<label class="btn block" style="margin-top:10px">' + ICON.camera + 'Grabar vídeo<input type="file" accept="video/*" capture="environment" hidden data-md></label>' : '') +
        '<label class="btn block" style="margin-top:10px">' + ICON.image + (VS ? 'Galería (foto o vídeo)' : 'Galería') + '<input type="file" accept="' + (VS ? 'image/*,video/*' : 'image/*') + '" hidden data-md></label>' +
        '<button class="btn block" id="md-cancel" style="margin-top:10px">Cancelar</button></div>';
      document.body.appendChild(back);
      back.addEventListener('click', function (ev) { if (ev.target === back || ev.target.closest('#md-cancel')) closeSheet(); });
      back.addEventListener('change', function (ev) { var f = ev.target.files && ev.target.files[0]; closeSheet(); setMedia(e, f); });
    }

    /* ---------- exportar ---------- */
    function vidBox() { var b = $('#sh-vid-box'); if (b) b.hidden = !(VS && S.videosOf(st.sc).length); }
    function exportImg(fn, then) { draw(true).then(function () { return fn(canvas); }).then(function (r) { draw(); then(r); }); }
    $('#sh-share').addEventListener('click', function () {
      exportImg(function (c) { return S.share(c, cfg.text() + ' #4TIMER'); }, function (r) {
        if (r === 'saved') k.toast('Imagen guardada. Ya puedes subirla a Instagram'); else if (r === 'error') k.toast('No se pudo compartir');
      });
    });
    $('#sh-save').addEventListener('click', function () {
      exportImg(function (c) { return S.save(c); }, function (r) { k.toast(r === 'gallery' ? 'Imagen guardada en la galería (álbum 4TIMER)' : r === 'error' ? 'No se pudo guardar. Prueba con «Compartir»' : 'Imagen descargada en la carpeta de descargas'); });
    });
    function makeVideo(what) {
      if (st.busy || !S.masterVideo(st.sc)) return;
      st.busy = true; st.sel = null; draw();
      var box = $('#sh-vprog'); box.hidden = false; $('#sh-vbar').style.width = '0%'; $('#sh-vtxt').textContent = 'Grabando… no cierres la pantalla';
      $$('#sh-vid-box .btn').forEach(function (b) { b.disabled = true; });
      st.sc.r = cfg.model();
      S.recordVideoParts(st.sc, { onProgress: function (p, i, n) { $('#sh-vbar').style.width = Math.round(p * 100) + '%'; $('#sh-vtxt').textContent = n > 1 ? 'Grabando parte ' + i + ' de ' + n + '… no cierres la pantalla' : 'Grabando… no cierres la pantalla'; } })
        .then(function (v) {
          $('#sh-vtxt').textContent = what === 'share' ? 'Abriendo compartir…' : 'Guardando…';
          return (what === 'share' ? S.shareVideo(v, cfg.text() + ' #4TIMER') : S.saveVideo(v)).then(function (r) {
            if (what === 'save') k.toast(r === 'gallery' ? 'Vídeo guardado en la galería (álbum 4TIMER)' : r === 'error' ? 'No se pudo guardar el vídeo. Prueba con «Compartir vídeo»' : 'Vídeo descargado en la carpeta de descargas');
            else if (r === 'saved') k.toast('Vídeo descargado. Ya puedes subirlo a Instagram'); else if (r === 'error') k.toast('No se pudo compartir el vídeo');
          });
        })
        .catch(function () { k.toast('No se pudo grabar el vídeo en este móvil'); })
        .then(function () {
          st.busy = false; box.hidden = true; $$('#sh-vid-box .btn').forEach(function (b) { b.disabled = false; });
          S.videosOf(st.sc).forEach(function (v) { try { v.pause(); v.muted = true; v.currentTime = Math.min(0.2, v.duration / 2); } catch (e) {} });
          draw();
        });
    }
    $('#sh-vshare').addEventListener('click', function () { makeVideo('share'); });
    $('#sh-vsave').addEventListener('click', function () { makeVideo('save'); });

    /* ---------- arranque ---------- */
    var img = new Image();
    img.onload = function () { if (cfg.logoRound) img.__round = true; st.logo = img; changed(); };
    img.src = cfg.logoSrc;
    renderAdd(); draw(); thumbs();

    return {
      refresh: function () { draw(); thumbsLater(); },
      scene: function () { return st.sc; },
      state: st,
      destroy: function () {
        dead = true; clearTimeout(thumbT); closeSheet();
        var all = st.sc.elements.map(function (e) { return e.media; }).concat(st.spare);
        all.forEach(function (m) { if (m && m.kind === 'video') { try { m.el.pause(); } catch (e) {} if (m.url) { try { URL.revokeObjectURL(m.url); } catch (e) {} } } });
      }
    };
  }
  root.ShareUI = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
