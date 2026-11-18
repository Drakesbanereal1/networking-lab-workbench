"use strict";
/* Kill switch for this retired address. Browsers that installed the old offline copy fetch this file on
   their next visit; it removes the old copy's cached files, unregisters itself, and reloads open pages
   so they show the retired notice. Only entries under this folder are removed: other sites on the same
   github.io origin keep their caches and saved progress. */
const SCOPE = new URL("./", self.location).pathname;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      await Promise.all(keys.filter((r) => new URL(r.url).pathname.startsWith(SCOPE)).map((r) => cache.delete(r)));
      if ((await cache.keys()).length === 0) await caches.delete(name);
    }
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request));
});
