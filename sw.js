// Bump when shell list or fetch strategy changes (old caches are pruned on activate).
const CACHE = 'calvybots-v5';
const SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/store.js',
  '/js/widgets/clock.js',
  '/js/widgets/notes.js',
  '/js/widgets/todo.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/logo-lockup.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/**
 * Online-first: try network, then cache (precached shell + prior successful loads).
 * Cross-origin (CDN fonts/scripts) is not intercepted so the browser always uses
 * normal network rules when online; offline may lack CDN styling until cached by the browser.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirst(event.request));
});
