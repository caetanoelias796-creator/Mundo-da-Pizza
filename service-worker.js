const CACHE_NAME = 'mundo-da-pizza-v1';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './assets/logo.png',
  './menu.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Initial PWA caching skipped/warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle local requests, ignore browser extension queries (e.g. chrome-extension://)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Network first, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the newly fetched response
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback if navigating to page
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
