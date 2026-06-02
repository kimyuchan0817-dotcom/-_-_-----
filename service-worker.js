const CACHE_NAME = 'campusflow-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache local assets; skip external fonts/CDN (they have their own caching)
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network-first for navigation, cache-first for assets
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).then((response) => {
        // Cache successful GET responses from same origin
        if (response && response.status === 200 && e.request.method === 'GET') {
          const url = new URL(e.request.url);
          if (url.origin === self.location.origin) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, cloned));
          }
        }
        return response;
      });
    }).catch(() => {
      // Fallback to index for navigation
      if (e.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
