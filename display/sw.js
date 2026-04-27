/* Service Worker — cache static + media, fallback to cached config when offline */

const CACHE_NAME = 'cartelera-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './player.js',
  './widgets/renderers.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isApi = url.pathname.startsWith('/api/');
  const isMedia = url.pathname.startsWith('/media/file/') || /^\/api\/media\/\d+\/file$/.test(url.pathname);

  if (isMedia) {
    // Cache-first for media (images/videos rarely change)
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
          }
          return res;
        }),
      ).catch(() => caches.match(event.request)),
    );
    return;
  }

  if (isApi) {
    // Network-first for API, fallback to cache (last known good).
    event.respondWith(
      fetch(event.request).then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(event.request)),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request)),
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
