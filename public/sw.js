/* Minimal app-shell cache. GPS data, route points, photos and reports are never cached. */
const CACHE_PREFIX = 'pawprint-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_PREFIX);
    await cache.add(new URL('./', self.registration.scope).toString());
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('pawprint-shell-') && key !== CACHE_PREFIX).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Never cache third-party map tiles or external assets.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_PREFIX);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(new URL('./', self.registration.scope).toString()));
      }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
