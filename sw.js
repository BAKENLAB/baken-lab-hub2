const CACHE = 'lab-hub-shell-v19';
const SHELL = ['/', '/index.html', '/today.html', '/result.html', '/next.html', '/course.html', '/blood.html', '/jockey.html', '/bet.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.includes('supabase.co')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          const key = url.pathname === '/' ? '/' : url.pathname;
          caches.open(CACHE).then((cache) => cache.put(key, copy));
          return res;
        })
        .catch(async () => {
          const key = url.pathname === '/' ? '/' : url.pathname;
          return (await caches.match(key)) || (await caches.match('/index.html'));
        })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
  }
});