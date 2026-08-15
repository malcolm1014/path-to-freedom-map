/* Path to Freedom — service worker
   Goal: the map still opens and shows the last-known data/area on a weak
   or dropped connection, and repeat visits (install/"Add to Home Screen")
   load fast without re-downloading the whole app every time.

   Strategy is deliberately different per resource type:
   - Same-origin app shell (index.html/data.js/boundary.js/FL_COUNTY_GEO.js):
     network-first, falling back to cache. data.js grows county-by-county,
     so a fresh copy is preferred whenever the network is up; the cached
     copy is only a fallback for offline/dead-signal moments.
   - Pinned-version CDN libraries (Leaflet, markercluster, Google Fonts):
     cache-first. Safe because these URLs are version-locked and never
     change under us, so there's nothing to go stale.
   - CARTO map tiles: cache-first with a capped, self-trimming cache, so an
     area someone has already viewed keeps rendering offline without the
     tile cache growing forever on a low-storage phone.
   - Everything else (Nominatim reverse-geocode, the CareerOneStop jobs
     API) is intentionally left alone — that data is meant to be live. */

const CACHE_VERSION = 'ptf-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;
const TILE_CACHE = `${CACHE_VERSION}-tiles`;
const TILE_CACHE_MAX = 300;

const APP_SHELL = [
  './',
  './index.html',
  './data.js',
  './boundary.js',
  './FL_COUNTY_GEO.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const keep = new Set([APP_SHELL_CACHE, CDN_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ptf-') && !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, maxItems));
      }
    });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(req).then(cached => fetch(req).then(res => {
          if (res.ok) { cache.put(req, res.clone()); trimCache(TILE_CACHE, TILE_CACHE_MAX); }
          return res;
        }).catch(() => cached))
      )
    );
    return;
  }

  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(req).then(cached => cached || fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(APP_SHELL_CACHE).then(cache => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
