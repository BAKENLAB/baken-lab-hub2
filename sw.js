const CACHE = 'lab-hub-shell-v5';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Always fetch live API, manifest, service worker and app icons from network.
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/sw.js' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png' ||
    url.pathname === '/icon-maskable-512.png'
  ) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  }
});
