/**
 * Service Worker for Hackathon Starter PWA.
 * Implements Workbox-style caching strategies:
 * - NetworkFirst for HTML navigation
 * - StaleWhileRevalidate / CacheFirst for static assets
 * - NetworkOnly for API & Auth routes (NEVER cached)
 * - Offline fallback page
 */

const CACHE_NAME = 'hackathon-pwa-v1';
const OFFLINE_FALLBACK_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/favicon.ico',
];

const EXCLUDED_PATTERNS = [
  '/api/',
  '/auth/',
  'supabase.co',
  'localhost:54321',
];

// Helper to determine if a URL should bypass service worker cache
function shouldExclude(url) {
  return EXCLUDED_PATTERNS.some((pattern) => url.includes(pattern));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache sensitive API or Auth calls
  if (shouldExclude(url)) {
    return;
  }

  // Navigation requests: Network-first, fallback to cache, then offline fallback page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match(OFFLINE_FALLBACK_URL);
          if (fallback) return fallback;
          return new Response('Network error occurred while offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Static assets (styles, scripts, images, fonts)
  const isStatic =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font';

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
