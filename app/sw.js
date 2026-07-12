const CACHE_NAME = "christ-in-song-worship-v33";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=32",
  "./data/songs.js?v=2",
  "./data/extra-packs.js",
  "./lazy-pack-loader.js?v=1",
  "./slide-content.js?v=1",
  "./builder-slides.js?v=2",
  "./service-templates.js?v=2",
  "./template-store.js?v=1",
  "./template-ui.js?v=2",
  "./pack-store.js?v=2",
  "./pack-import.js?v=2",
  "./hymnal-library/hymnal-migration.js?v=2",
  "./hymnal-library/hymnal-library-settings.js?v=2",
  "./hymnal-library/hymnal-library-store.js?v=2",
  "./hymnal-library/hymnal-import-service.js?v=2",
  "./hymnal-library/hymnal-deletion-service.js?v=1",
  "./hymnal-library/hymnal-library-ui.js?v=2",
  "./tag-catalog.js?v=1",
  "./song-tags-store.js?v=1",
  "./song-tags-ui.js?v=1",
  "./backup-zip.js?v=1",
  "./backup-store.js?v=1",
  "./backup-restore.js?v=1",
  "./vendor/fuse.min.js",
  "./hymn-search.js?v=3",
  "./hymn-search-ui.js?v=2",
  "./data/bible-catalog.js?v=2",
  "./bible-store.js?v=2",
  "./bible-reader-ui.js?v=2",
  "./bible/bible-reference-parser.js?v=1",
  "./bible/bible-projection-settings.js?v=1",
  "./bible/bible-projection-service.js?v=1",
  "./bible/bible-search-service.js?v=1",
  "./bible/bible-speech-service.js?v=1",
  "./bible/bible-live-ui.js?v=1",
  "./song-audio-store.js?v=1",
  "./song-audio-player.js?v=1",
  "./song-audio-ui.js?v=1",
  "./builder-save.js?v=1",
  "./builder-order-preview.js?v=1",
  "./presenter-engine.js?v=1",
  "./presenter-output.js?v=1",
  "./presenter-control.js?v=3",
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
  "./obs/obs-mapping-ui.js?v=2",
  "./obs/obs-control-ui.js?v=2",
  "./obs/obs-settings-ui.js?v=2",
  "./presenter-screen.html",
  "./presenter-screen.js?v=1",
  "./help/help-icons.js?v=2",
  "./help/help-content.js?v=2",
  "./help/help-store.js?v=2",
  "./help/help-search.js?v=2",
  "./help/help-checklists.js?v=2",
  "./help/help-diagnostics.js?v=2",
  "./help/help-training.js?v=2",
  "./help/help-contextual.js?v=2",
  "./help/help-ui.js?v=2",
  "./i18n/i18n-catalog.js?v=1",
  "./i18n/i18n-store.js?v=1",
  "./i18n/i18n.js?v=1",
  "./app.js?v=32",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
];

const LAZY_CACHE = [
  "./data/sda-hymnal-pack.js?v=2",
  "./vendor/pdfmake.min.js",
  "./vendor/vfs_fonts.js",
  "./bulletin-export.js?v=2",
  "./vendor/Midi.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.allSettled(LAZY_CACHE.map((url) => cache.add(url)));
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
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
    }).catch(() => caches.match("./index.html"))),
  );
});
