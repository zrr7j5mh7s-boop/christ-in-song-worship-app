const CACHE_NAME = "christ-in-song-worship-v25";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=25",
  "./slide-content.js?v=1",
  "./builder-slides.js?v=1",
  "./service-templates.js?v=1",
  "./template-store.js?v=1",
  "./template-ui.js?v=1",
  "./pack-store.js?v=1",
  "./pack-import.js?v=1",
  "./tag-catalog.js?v=1",
  "./song-tags-store.js?v=1",
  "./song-tags-ui.js?v=1",
  "./backup-zip.js?v=1",
  "./backup-store.js?v=1",
  "./backup-restore.js?v=1",
  "./vendor/pdfmake.min.js",
  "./vendor/vfs_fonts.js",
  "./bulletin-export.js?v=1",
  "./vendor/fuse.min.js",
  "./hymn-search.js?v=1",
  "./hymn-search-ui.js?v=1",
  "./vendor/Midi.js",
  "./song-audio-store.js?v=1",
  "./song-audio-player.js?v=1",
  "./song-audio-ui.js?v=1",
  "./presenter-engine.js?v=2",
  "./presenter-output.js?v=2",
  "./presenter-control.js?v=2",
  "./obs/obs-constants.js?v=2",
  "./obs/obs-sanitize.js?v=1",
  "./obs/obs-settings-store.js?v=2",
  "./obs/obs-event-service.js?v=1",
  "./obs/obs-ws-client.js?v=1",
  "./obs/obs-connection-service.js?v=1",
  "./obs/obs-scene-service.js?v=2",
  "./obs/obs-source-service.js?v=1",
  "./obs/obs-output-service.js?v=1",
  "./obs/obs-control-service.js?v=1",
  "./obs/obs-mapping-ui.js?v=1",
  "./obs/obs-control-ui.js?v=1",
  "./obs/obs-settings-ui.js?v=2",
  "./presenter-screen.html",
  "./presenter-screen.js?v=2",
  "./help/help-icons.js?v=1",
  "./help/help-content.js?v=1",
  "./help/help-store.js?v=1",
  "./help/help-search.js?v=1",
  "./help/help-checklists.js?v=1",
  "./help/help-diagnostics.js?v=1",
  "./help/help-training.js?v=1",
  "./help/help-contextual.js?v=1",
  "./help/help-ui.js?v=1",
  "./app.js?v=25",
  "./data/songs.js?v=2",
  "./data/sda-hymnal-pack.js?v=2",
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
