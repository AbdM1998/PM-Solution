// Minimal service worker — exists mainly to satisfy Chrome/Android's PWA
// installability requirement (a controlling SW with a fetch handler).
// Deliberately does NOT cache API responses or page navigations: this app's data
// (tasks, reminders, dashboard) must always be live, never a stale cached copy.
// Only static, content-hashed build assets are cached, which is always safe.
const STATIC_CACHE = "projectflow-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset = event.request.method === "GET" && url.pathname.startsWith("/_next/static/");
  if (!isStaticAsset) return; // everything else: always network, never intercepted

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
