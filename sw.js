/* Service worker do Fazenda Boa — gerado no build. */
const VERSION = 'mv1x1dr9';
const CACHE = 'fazendaboa-' + VERSION;
const FILES = ["./","index.html","manifest.webmanifest","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","assets/phaser-DXXWZowi.js","assets/index-B2fqC5zH.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fazendaboa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Navegação: rede primeiro (pega versões novas), cache se offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // Demais arquivos (com hash): cache primeiro
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
