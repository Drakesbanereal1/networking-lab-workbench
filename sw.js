"use strict";
/* Offline support. Bump CACHE and the ?v= query strings in index.html together on every release. */
const CACHE = "workbench-4.0.7-web.2";
const V = "?v=4.0.7-web.2";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", `style.css${V}`, `engine.js${V}`, `progress-core.js${V}`, `ui.js${V}`, `calc.js${V}`, `study.js${V}`, `runners.js${V}`, `download.js${V}`, `LICENSE.txt${V}`, `app.js${V}`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
