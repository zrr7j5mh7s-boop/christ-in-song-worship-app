(function () {
  "use strict";

  const PACK_SCRIPTS = {
    sda: "./data/sda-hymnal-pack.js?v=2",
  };

  const DEFERRED_PACK_META = {
    sda: {
      code: "sda",
      editionId: "sda-hymnal-english",
      hymnBookId: "sda-hymnal",
      name: "SDA Hymnal",
      status: "loading",
      songCount: 695,
      source: "SDA_Hymnal_English_PowerPoint_Pack.pptx",
    },
  };

  const DEFERRED_BUNDLES = {
    pdfmake: [
      "./vendor/pdfmake.min.js",
      "./vendor/vfs_fonts.js",
      "./bulletin-export.js?v=2",
    ],
    midi: ["./vendor/Midi.js"],
  };

  const loadedScripts = new Set();
  const loadingPromises = new Map();

  function assetPath(relative) {
    const prefix = window.CIS_BUILD_PREFIX || "./";
    if (!prefix || prefix === "./") return relative;
    const clean = String(relative).replace(/^\.\//, "");
    const versionless = clean.replace(/\?v=\d+/, "");
    return `${prefix}${versionless}`;
  }

  function loadScript(src) {
    const resolved = assetPath(src);
    if (loadedScripts.has(resolved)) return Promise.resolve();
    if (loadingPromises.has(resolved)) return loadingPromises.get(resolved);

    const promise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = resolved;
      el.async = true;
      el.onload = () => {
        loadedScripts.add(resolved);
        loadingPromises.delete(resolved);
        resolve();
      };
      el.onerror = () => {
        loadingPromises.delete(resolved);
        reject(new Error(`Failed to load ${resolved}`));
      };
      document.head.appendChild(el);
    });
    loadingPromises.set(resolved, promise);
    return promise;
  }

  function loadScriptsSequential(urls) {
    return (urls || []).reduce(
      (chain, url) => chain.then(() => loadScript(url)),
      Promise.resolve(),
    );
  }

  function ensurePackLoaded(code) {
    const src = PACK_SCRIPTS[code];
    if (!src) return Promise.resolve(false);
    return loadScript(src).then(() => true);
  }

  function ensureBundle(bundleId) {
    const urls = DEFERRED_BUNDLES[bundleId];
    if (!urls || !urls.length) return Promise.resolve();
    return loadScriptsSequential(urls);
  }

  function preloadDeferredPacks(codes) {
    const list = codes && codes.length ? codes : Object.keys(PACK_SCRIPTS);
    return Promise.all(list.map((code) => ensurePackLoaded(code).catch(() => false)));
  }

  function scheduleIdlePreload(fn, timeoutMs) {
    const run = typeof fn === "function" ? fn : () => {};
    const timeout = Number(timeoutMs) || 4000;
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => run(), { timeout });
      return;
    }
    window.setTimeout(run, Math.min(timeout, 2000));
  }

  function isPackDeferred(code) {
    return Boolean(PACK_SCRIPTS[code]);
  }

  function isPackLoaded(code) {
    const src = PACK_SCRIPTS[code];
    if (!src) return true;
    return loadedScripts.has(assetPath(src));
  }

  window.CISLazyLoader = {
    PACK_SCRIPTS,
    DEFERRED_PACK_META,
    DEFERRED_BUNDLES,
    assetPath,
    loadScript,
    ensurePackLoaded,
    ensureBundle,
    preloadDeferredPacks,
    scheduleIdlePreload,
    isPackDeferred,
    isPackLoaded,
  };
})();
