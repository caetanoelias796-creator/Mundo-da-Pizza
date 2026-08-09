const CACHE_NAME = 'mundo-da-pizza-v1.0.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './painel.html',
  './index.css?v=2',
  './painel.css?v=2',
  './app.js?v=2',
  './painel.js?v=3',
  './firebase-config.js',
  './menu.json',
  './manifest.json',
  './assets/logo.png',
  './assets/pizza_hero.png',
  './assets/pizza_banner.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Non-critical cache pre-load warning:', err);
      });
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Listener for SW skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Fetch Event: Stale-While-Revalidate for local assets, Network-First for API/Firebase
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests or Firebase / API calls
  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.includes('/api/') ||
    requestUrl.hostname.includes('firebase') ||
    requestUrl.hostname.includes('googleapis') ||
    requestUrl.protocol === 'chrome-extension:'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
