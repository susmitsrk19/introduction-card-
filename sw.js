// This service worker exists ONLY to clean up and remove the old, buggy
// workers that were stuck caching a stale copy of the site. The first
// time it runs in a visitor's browser, it deletes all caches, unregisters
// itself, and reloads that one tab. On every visit after that (once
// there's nothing left to clean), it just quietly unregisters without
// reloading — so this can't turn into a reload loop.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const hadStaleCache = names.length > 0;
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
      if (hadStaleCache) {
        const clientsList = await self.clients.matchAll({ type: "window" });
        clientsList.forEach((client) => client.navigate(client.url));
      }
    })()
  );
});
