/* Service worker de 4TIMER: funciona sin conexión */
const CACHE = '4timer-v6';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/timer.js', 'js/exercises.js', 'js/store.js', 'js/audio.js', 'js/led.js', 'js/map.js', 'js/share.js', 'js/run.js', 'js/runui.js', 'js/app.js',
  'fonts/barlow-condensed-latin-600-normal.woff2', 'fonts/barlow-condensed-latin-700-normal.woff2',
  'fonts/barlow-condensed-latin-700-italic.woff2', 'fonts/barlow-condensed-latin-800-italic.woff2',
  'icons/gym-logo.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
