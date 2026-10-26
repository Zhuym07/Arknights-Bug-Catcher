const CACHE_NAME = "originium-defense-v16";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./retro.js",
  "./game-core.mjs",
  "./level.mjs",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/map-layout.svg",
  "./assets/bug-orange.png",
  "./assets/bug-yellow.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key.startsWith("originium-defense-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
