const CACHE = 'ifort-raport-v15';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Strategie: Network-first pentru HTML/JS/CSS, cache fallback pentru offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Doar pentru resurse din propriul domeniu
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(resp => {
      // Salvează copia în cache pentru offline
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() =>
      // Offline: încearcă din cache, sau fallback la index.html
      caches.match(e.request).then(r => r || caches.match('./index.html'))
    )
  );
});
