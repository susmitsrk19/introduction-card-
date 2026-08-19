const CACHE_NAME = "digital-card-v1";
const SHELL_URLS = ["/", "/index.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
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

// Network-first for navigation/data, cache-first for the static shell —
// keeps the card fresh (so shared links always show current data) while
// still letting the app open offline after a first visit.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isShellAsset = SHELL_URLS.some((u) => url.pathname === u);

  if (isShellAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Everything else (JS bundles, Firestore calls, share links with query
  // params) — try the network first, fall back to cache if offline.
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
