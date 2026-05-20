/*
================================================================================
  HEA Report Generator - Service Worker
  Copyright (c) 2025 [Frank L. Thomas Sr.] - All Rights Reserved
  Enables offline use and installable PWA functionality
================================================================================
*/

const CACHE_NAME = 'hea-report-v18';
const CACHE_VERSION = '6.5.0';

// Files to cache for offline use
const FILES_TO_CACHE = [
    './manifest.json',
  './xlsx.full.min.js',
  './pdf.min.js',
  './pdf.worker.min.js',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: Cache all app files when SW first installs ──────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing HEA Report Generator v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app files...');
        // Cache files individually so one failure doesn't break everything
        return Promise.allSettled(
          FILES_TO_CACHE.map(file =>
            cache.add(file).catch(err => {
              console.warn('[SW] Could not cache: ' + file, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Installation complete');
        // Take control immediately without waiting for page refresh
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: Clean up old caches when SW updates ────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating new version...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache: ' + name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Now controlling all pages');
        return self.clients.claim();
      })
  );
});

// ── FETCH: Serve from cache, fall back to network ────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http requests (chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache (works offline)
          console.log('[SW] Serving from cache: ' + event.request.url);
          return cachedResponse;
        }

        // Not in cache - fetch from network
        console.log('[SW] Fetching from network: ' + event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses for future offline use
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed AND not in cache
            // Return offline fallback page
            console.warn('[SW] Offline and not cached: ' + event.request.url);
            return caches.match('./index.html');
          });
      })
  );
});

// ── MESSAGE: Handle updates from main app ────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
