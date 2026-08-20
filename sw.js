// v2 — always network-first, for everything, including the HTML shell.
// The old v1 worker cached "/" and "/index.html" cache-first, which meant
// browsers kept showing a stale copy of the site forever, even after new
// code was deployed. This version only ever falls back to cache when
// there's genuinely no network — so updates always show up immediately.
const CACHE_NAME = "digital-card-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request))
  );
});
