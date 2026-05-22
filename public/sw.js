const CACHE_NAME = 'camperguard-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install: App-Shell cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-first für Navigation, Cache-first für Assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET-Requests cachen
  if (request.method !== 'GET') return;

  // Externe URLs (APIs, Karten-Tiles) nicht cachen
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Erfolgreiche Antwort cachen
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: aus Cache liefern
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback für Navigation-Requests
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
