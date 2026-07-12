const CACHE_NAME = "christ-in-song-worship-v42";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=42",
  "./data/songs.js?v=2",
  "./data/extra-packs.js",
  "./lazy-pack-loader.js?v=1",
  "./performance/task-session.js?v=1",
  "./performance/performance-monitor.js?v=1",
  "./performance/passage-cache.js?v=1",
  "./performance/stanza-render-cache.js?v=1",
  "./ux/ui-icons.js?v=1",
  "./ux/operator-status-strip.js?v=1",
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
  "./hymn-search-ui.js?v=4",
  "./data/bible-catalog.js?v=2",
  "./bible-store.js?v=2",
  "./bible-reader-ui.js?v=2",
  "./bible/bible-reference-parser.js?v=1",
  "./bible/bible-projection-settings.js?v=1",
  "./bible/bible-projection-service.js?v=2",
  "./bible/bible-search-service.js?v=2",
  "./bible/bible-speech-service.js?v=1",
  "./bible/bible-live-ui.js?v=2",
  "./brand/brand-config.js?v=1",
  "./brand/brand-migration.js?v=1",
  "./hymn-queue/live-hymn-queue-settings.js?v=1",
  "./hymn-queue/live-hymn-queue-service.js?v=1",
  "./hymn-queue/live-hymn-queue-ui.js?v=1",
  "./service-mode/service-mode-settings.js?v=1",
  "./service-mode/service-mode-service.js?v=1",
  "./service-mode/service-mode-ui.js?v=1",
  "./quiet-service-mode/notification-classifier.js?v=1",
  "./quiet-service-mode/quiet-service-mode-settings.js?v=1",
  "./quiet-service-mode/quiet-service-mode-service.js?v=1",
  "./quiet-service-mode/quiet-service-mode-ui.js?v=1",
  "./accessibility/focus-manager.js?v=1",
  "./keyboard/keyboard-shortcuts-registry.js?v=1",
  "./keyboard/keyboard-shortcuts-settings.js?v=1",
  "./keyboard/keyboard-shortcuts-service.js?v=1",
  "./keyboard/keyboard-shortcuts-ui.js?v=1",
  "./presentation/presentation-state-model.js?v=1",
  "./presentation/live-switch-settings.js?v=1",
  "./presentation/live-switch-service.js?v=1",
  "./presentation/live-lock-settings.js?v=1",
  "./presentation/live-lock-service.js?v=1",
  "./presentation/live-lock-ui.js?v=1",
  "./song-audio-store.js?v=1",
  "./song-audio-player.js?v=1",
  "./song-audio-ui.js?v=1",
  "./builder-save.js?v=1",
  "./builder-order-preview.js?v=1",
  "./presentation/projection-themes.js?v=1",
  "./presentation/text-fit-engine.js?v=1",
  "./presentation/slide-layout-engine.js?v=1",
  "./presentation/projection-settings.js?v=1",
  "./presenter-engine.js?v=2",
  "./presenter-output.js?v=2",
  "./presenter-control.js?v=4",
  "./obs/obs-constants.js?v=2",
  "./obs/obs-sanitize.js?v=1",
  "./obs/obs-settings-store.js?v=2",
  "./obs/obs-event-service.js?v=1",
  "./obs/obs-ws-client.js?v=1",
  "./obs/obs-connection-service.js?v=2",
  "./obs/obs-scene-service.js?v=2",
  "./obs/obs-source-service.js?v=1",
  "./obs/obs-output-service.js?v=2",
  "./obs/obs-control-service.js?v=1",
  "./obs/obs-program-monitor.js?v=1",
  "./obs/obs-program-monitor-ui.js?v=1",
  "./hymn-index-settings.js?v=1",
  "./hymn-index-ui.js?v=3",
  "./camera/camera-constants.js?v=1",
  "./camera/camera-settings-store.js?v=1",
  "./camera/camera-source-service.js?v=2",
  "./camera/camera-compositor.js?v=1",
  "./camera/camera-source-ui.js?v=1",
  "./camera/camera-preview-window.html",
  "./camera/camera-preview-window.js?v=1",
  "./obs/obs-mapping-ui.js?v=2",
  "./obs/obs-control-ui.js?v=2",
  "./obs/obs-settings-ui.js?v=2",
  "./presenter-screen.html",
  "./presenter-screen.js?v=3",
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
  "./app.js?v=42",
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
