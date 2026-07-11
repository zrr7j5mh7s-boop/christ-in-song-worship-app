const CACHE_NAME = "christ-in-song-worship-v13";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=13",
  "./slide-content.js?v=1",
  "./builder-slides.js?v=1",
  "./service-templates.js?v=1",
  "./template-store.js?v=1",
  "./template-ui.js?v=1",
  "./pack-store.js?v=1",
  "./pack-import.js?v=1",
  "./presenter-engine.js?v=1",
  "./presenter-output.js?v=1",
  "./presenter-control.js?v=1",
  "./presenter-screen.html",
  "./presenter-screen.js?v=1",
  "./app.js?v=13",
  "./data/songs.js?v=2",
  "./data/extra-packs.js",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
