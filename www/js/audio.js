/* 4TIMER — sonidos sintetizados con Web Audio + sonidos propios subidos por el usuario */
(function (root) {
  'use strict';
  var ctx = null;
  var buffers = {}; // evento -> {src, buffer}

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  var live = [];   // nodos programados que aún no han terminado (para poder cancelarlos al pausar)
  function track(node) {
    live.push(node);
    node.onended = function () { var i = live.indexOf(node); if (i > -1) live.splice(i, 1); };
  }
  function tone(c, dest, o) {
    var osc = c.createOscillator(), g = c.createGain();
    var t0 = (o.when !== undefined ? o.when : c.currentTime) + (o.start || 0);
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd) osc.frequency.linearRampToValueAtTime(o.freqEnd, t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.5, t0 + 0.008);
    if (o.sustain) g.gain.setValueAtTime(o.gain || 0.5, t0 + o.dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(dest);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02); track(osc);
  }

  /* Cada preset recibe (contexto, destino). */
  var PRESETS = {
    beep:   { label: 'Pitido',        play: function (c, d, w) { tone(c, d, { when: w, freq: 880, dur: 0.16, gain: 0.6 }); } },
    high:   { label: 'Pitido agudo',  play: function (c, d, w) { tone(c, d, { when: w, freq: 1480, dur: 0.5, gain: 0.5 }); } },
    double: { label: 'Doble pitido',  play: function (c, d, w) {
      tone(c, d, { when: w, freq: 1000, dur: 0.1, gain: 0.55 });
      tone(c, d, { when: w, freq: 1000, dur: 0.1, gain: 0.55, start: 0.16 });
    } },
    horn:   { label: 'Bocina',        play: function (c, d, w) {
      tone(c, d, { when: w, type: 'sawtooth', freq: 196, dur: 1.1, gain: 0.35, sustain: true });
      tone(c, d, { when: w, type: 'square', freq: 247, dur: 1.1, gain: 0.18, sustain: true });
    } },
    bell:   { label: 'Campana',       play: function (c, d, w) {
      [[660, 0.5], [1320, 0.28], [1980, 0.14], [2640, 0.08]].forEach(function (p) {
        tone(c, d, { when: w, freq: p[0], dur: 1.4, gain: p[1] });
      });
    } },
    siren:  { label: 'Sirena',        play: function (c, d, w) {
      tone(c, d, { when: w, type: 'triangle', freq: 600, freqEnd: 1100, dur: 0.5, gain: 0.5 });
      tone(c, d, { when: w, type: 'triangle', freq: 1100, freqEnd: 600, dur: 0.5, gain: 0.5, start: 0.5 });
    } },
    gong:   { label: 'Gong',          play: function (c, d, w) {
      [[110, 0.6], [165, 0.35], [233, 0.25], [330, 0.15]].forEach(function (p) {
        tone(c, d, { when: w, freq: p[0], dur: 2.2, gain: p[1] });
      });
    } },
    tick:   { label: 'Pitido corto (trabajo)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 1800, dur: 0.07, gain: 0.55 });
      tone(c, d, { when: w, freq: 1800, dur: 0.07, gain: 0.55, start: 0.12 });
    } },
    long:   { label: 'Tono largo grave (descanso)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 330, dur: 1.3, gain: 0.55, sustain: true });
    } },
    longbeep: { label: 'Pitido largo (inicio)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 880, dur: 1.0, gain: 0.6, sustain: true });
    } },
    startseq: { label: 'Secuencia: 3 pitidos + largo (archivo)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 880, dur: 1.0, gain: 0.6, sustain: true });
    } },
    voice:  { label: 'Voz', play: function () {} },
    none:   { label: 'Silencio',      play: function () {} }
  };

  /* Voces: archivos audio/half.mp3 y audio/welldone.mp3 (voz real). Si no están, voz robótica del móvil. */
  var VOICES = {
    half:     { file: 'audio/half.mp3',     text: 'Mitad del tiempo superada', lang: 'es-ES' },
    welldone: { file: 'audio/welldone.mp3', text: 'Well done!',                lang: 'en-US' }
  };
  var START = 'audio/start.mp3', START_LEAD = 3.02; // 3 pitidos cortos (s 0,1,2) y uno largo a los 3,02 s
  function muted(s, ev) { var d = s.sounds && s.sounds[ev]; return !!(d && d.preset === 'none'); }
  var vbuf = {}, speechTimers = [];
  function playStart(volume, delay) {
    var c = ensure(); if (!c) return;
    var when = c.currentTime + (delay || 0), dest = master(c, volume);
    function fallback() {
      [0, 1, 2].forEach(function (i) { PRESETS.beep.play(c, dest, when + i); });
      PRESETS.longbeep.play(c, dest, when + START_LEAD);
    }
    if (vbuf.start === undefined) VOICES.start = { file: START };
    loadVoice(c, 'start').then(function (buf) {
      if (!buf) return fallback();
      var s = c.createBufferSource(); s.buffer = buf; s.connect(dest); s.start(Math.max(when, c.currentTime)); track(s);
    });
  }
  function robot(c, dest, w, name) {
    var f = name === 'half' ? [520, 440, 520, 660] : [440, 554, 659, 880];
    f.forEach(function (hz, i) { tone(c, dest, { when: w, type: 'square', freq: hz, dur: 0.16, gain: 0.25, start: i * 0.19 }); });
  }
  function speak(name, delay, volume) {
    var v = VOICES[name], ss = root.speechSynthesis;
    if (!ss || !root.SpeechSynthesisUtterance) return false;
    speechTimers.push(setTimeout(function () {
      try {
        var u = new root.SpeechSynthesisUtterance(v.text);
        u.lang = v.lang; u.pitch = 0.4; u.rate = 0.9; u.volume = volume;
        ss.speak(u);
      } catch (e) {}
    }, Math.max(0, delay) * 1000));
    return true;
  }
  function loadVoice(c, name) {
    if (vbuf[name] !== undefined) return Promise.resolve(vbuf[name]);
    if (typeof fetch !== 'function') { vbuf[name] = null; return Promise.resolve(null); }
    return fetch(VOICES[name].file).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); }); })
      .then(function (b) { vbuf[name] = b; return b; })
      .catch(function () { vbuf[name] = null; return null; });
  }
  function playVoice(name, volume, delay) {
    var c = ensure(); if (!c) return;
    var when = c.currentTime + (delay || 0), dest = master(c, Math.min(1, volume + 0.15));
    loadVoice(c, name).then(function (buf) {
      if (buf) { var s = c.createBufferSource(); s.buffer = buf; s.connect(dest); s.start(Math.max(when, c.currentTime)); track(s); }
      else if (!speak(name, Math.max(0, when - c.currentTime), volume)) robot(c, dest, when, name);
    });
  }

  var vibTimers = [];
  /* Vibración distinta por tipo: pulso corto = trabajo, largo = descanso */
  var VIB = { countdown: 40, go: 400, minute: [200, 100, 200], work: [90, 70, 90], rest: 700, end: [300, 120, 300, 120, 600], lvl1: 500, lvl2: [150, 90, 150], lvl3: [120, 60, 120, 60, 120, 60, 300] };
  function vibrate(event, s) { if (s.vibrate && navigator.vibrate) navigator.vibrate(VIB[event] || 120); }

  /* Ajuste recomendado de accesibilidad: cada evento suena distinto (corto y agudo = trabajo, largo y grave = descanso) */
  var ACCESSIBLE = { countdown: 'beep', go: 'startseq', half: 'voice', welldone: 'voice', minute: 'high', work: 'tick', rest: 'long', end: 'bell', lvl1: 'gong', lvl2: 'double', lvl3: 'siren' };

  function master(c, volume) {
    var g = c.createGain();
    g.gain.value = Math.max(0, Math.min(1, volume));
    g.connect(c.destination);
    return g;
  }

  function decode(c, key, snd) {
    if (buffers[key] && buffers[key].src === snd.data) return Promise.resolve(buffers[key].buffer);
    return fetch(snd.data).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    }).then(function (buf) { buffers[key] = { src: snd.data, buffer: buf }; return buf; });
  }

  function playSound(snd, key, volume, delay) {
    var c = ensure();
    if (!c || !snd) return;
    var dest = master(c, volume), when = c.currentTime + (delay || 0);
    if (snd.preset === 'custom' && snd.data) {
      decode(c, key, snd).then(function (buf) {
        var s = c.createBufferSource();
        s.buffer = buf; s.connect(dest); s.start(Math.max(when, c.currentTime)); track(s);
      }).catch(function () { PRESETS.beep.play(c, dest, when); });
      return;
    }
    var p = PRESETS[snd.preset] || PRESETS.beep;
    p.play(c, dest, when);
  }

  root.Sound = {
    PRESETS: PRESETS,
    ACCESSIBLE: ACCESSIBLE,
    unlock: ensure, // llamar desde un gesto del usuario (botón Empezar)
    /* Reproduce el sonido configurado para un evento: countdown, go, minute, work, rest, end */
    play: function (event) {
      var s = root.Store.settings();
      if (event === 'startseq') return playStart(s.volume, 0);
      if (VOICES[event]) { if (!muted(s, event)) playVoice(event, s.volume, 0); return; }
      playSound(s.sounds[event], event, s.volume);
      vibrate(event, s);
    },
    /* Programa el sonido en el reloj de audio para dentro de `delaySec` segundos (exacto aunque la página vaya lenta).
       Devuelve false si no hay Web Audio (entonces hay que usar play() en el momento). */
    schedule: function (event, delaySec) {
      var s = root.Store.settings();
      if (!ensure()) return false;
      if (event === 'startseq') { playStart(s.volume, Math.max(0, delaySec)); return true; }
      if (VOICES[event]) { if (!muted(s, event)) playVoice(event, s.volume, Math.max(0, delaySec)); return true; }
      playSound(s.sounds[event], event, s.volume, Math.max(0, delaySec));
      if (s.vibrate && navigator.vibrate) {
        var t = setTimeout(function () { vibrate(event, s); }, Math.max(0, delaySec) * 1000);
        vibTimers.push(t);
      }
      return true;
    },
    available: function () { return !!(root.AudioContext || root.webkitAudioContext); },
    /* Cancela todo lo programado que aún no ha sonado (pausa, reinicio, terminar) */
    cancelAll: function () {
      live.slice().forEach(function (n) { try { n.stop(0); } catch (e) {} });
      live.length = 0;
      vibTimers.forEach(clearTimeout); vibTimers.length = 0;
      speechTimers.forEach(clearTimeout); speechTimers.length = 0;
      try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(0);
    },
    /* Decodifica los sonidos propios con antelación para que estén listos al programarlos */
    prepare: function () {
      var c = ensure(), s = root.Store.settings();
      if (!c) return;
      VOICES.start = { file: START }; loadVoice(c, 'half'); loadVoice(c, 'welldone'); loadVoice(c, 'start');
      Object.keys(s.sounds).forEach(function (k) { var sn = s.sounds[k]; if (sn && sn.preset === 'custom' && sn.data) decode(c, k, sn).catch(function () {}); });
    },
    preview: function (event) {
      var s = root.Store.settings();
      if (event === 'startseq' || (event === 'go' && (s.sounds.go || {}).preset === 'startseq')) return playStart(s.volume, 0);
      if (VOICES[event]) return playVoice(event, s.volume, 0);
      playSound(s.sounds[event], event, s.volume);
    },
    /* Convierte un archivo de audio en dataURL para guardarlo (máx. ~700 KB) */
    readFile: function (file) {
      return new Promise(function (res, rej) {
        if (file.size > 700 * 1024) return rej(new Error('El archivo pesa más de 700 KB. Usa un sonido más corto.'));
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(new Error('No se pudo leer el archivo.')); };
        fr.readAsDataURL(file);
      });
    }
  };
})(window);
