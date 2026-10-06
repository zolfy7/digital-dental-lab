// Offline cache. On install it precaches every built file listed in Vite's
// manifest; afterwards it answers from the cache first and refreshes in the
// background, so the presentation works in a clinic without Wi-Fi.
const CACHE = 'dentlab-1791291062338';
const BASE = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = new Set([BASE, `${BASE}index.html`, `${BASE}icon.svg`, `${BASE}icon-180.png`, `${BASE}icon-192.png`, `${BASE}icon-512.png`, `${BASE}manifest.webmanifest`]);
      try {
        const res = await fetch(`${BASE}.vite/manifest.json`, { cache: 'no-store' });
        if (res.ok) {
          const manifest = await res.json();
          for (const entry of Object.values(manifest)) {
            urls.add(BASE + entry.file);
            for (const f of [...(entry.css || []), ...(entry.assets || [])]) urls.add(BASE + f);
          }
        }
      } catch {
        /* runtime caching below still covers what is visited */
      }
      await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => undefined);
      if (hit) {
        event.waitUntil(fresh);
        return hit;
      }
      const res = await fresh;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match(`${BASE}index.html`)) || Response.error();
      return Response.error();
    })(),
  );
});
