// ================================================================
// SERVICE-WORKER.JS — offline caching for Ants In Your Plants
// Caches the app shell (HTML, CSS, JS, fonts) so the app loads
// without a network connection. Firebase Firestore handles its
// own offline persistence separately via enablePersistence().
// ================================================================

const CACHE_NAME    = 'aiyp-v3';
const SHELL_ASSETS  = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/utils.js',
  './js/mode.js',
  './js/app.js',
  './js/onboarding.js',
  './js/settings.js',
  './js/gardens.js',
  './js/plant-library.js',
  './js/plants.js',
  './js/tiles.js',
  './js/tasks.js',
  './js/calendar.js',
  './js/tracking.js',
  './js/weather.js',
  './js/advanced.js',
  './js/batch4.js',
  './js/messaging.js',
  './js/batch6.js',
];

// ── Install: cache shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('SW: some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for shell, network-first for Firebase ─────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Firebase and external APIs
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('open-meteo') ||
    url.hostname.includes('openfarm') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cdnjs')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for local shell assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache new shell assets
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
