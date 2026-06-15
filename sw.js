const CACHE = 'ifort-raport-v47';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './logo.png'];

self.addEventListener('install', (e) => {
  // Forțează activarea imediată, fără să aștepte alte tab-uri
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() =>
      // Trimite mesaj tuturor clienților că s-a actualizat → vor face reload
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE }));
      })
    )
  );
});

// Strategie network-first pentru HTML/JS/CSS — mereu versiunea proaspătă
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() =>
      caches.match(e.request).then(r => r || caches.match('./index.html'))
    )
  );
});
