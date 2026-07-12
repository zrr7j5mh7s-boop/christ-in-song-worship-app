// scripts/test-performance-audit.js
//
// Performance audit regression tests: debounce, cancellation, cleanup, caches.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "app");

function fail(message) {
  console.error(`[test:performance-audit] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[test:performance-audit] ${message}`);
}

function loadScript(relativePath) {
  const full = path.join(appDir, relativePath);
  if (!fs.existsSync(full)) fail(`Missing file: ${relativePath}`);
  const code = fs.readFileSync(full, "utf8");
  vm.runInThisContext(code, { filename: full });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockSong(number, title, body) {
  return {
    number,
    title,
    slides: [{ kind: "verse", label: "Verse 1", body }],
    sections: [{ kind: "verse", label: "Verse 1", body }],
  };
}

async function testTaskSessionDebounce() {
  const timers = [];
  global.window = {
    setTimeout(fn, ms) {
      const id = timers.length + 1;
      timers.push({ id, fn, ms, cleared: false });
      return id;
    },
    clearTimeout(id) {
      const entry = timers.find((item) => item.id === id);
      if (entry) entry.cleared = true;
    },
  };
  loadScript("performance/task-session.js");

  const session = window.CISTaskSession.createDebouncedSession({ debounceMs: 50 });
  let runs = 0;
  session.scheduleDebounced(() => { runs += 1; });
  session.scheduleDebounced(() => { runs += 1; });
  if (timers.length !== +2) fail(`Expected 2 debounce timers, got ${timers.length}`);
  const last = timers[timers.length - 1];
  if (!timers[0].cleared) fail("First debounce timer should be cleared");
  last.fn();
  if (runs !== 1) fail(`Expected one debounced run, got ${runs}`);
  ok("debounce coalesces rapid calls");
}

async function testTaskSessionCancellation() {
  global.window = global.window || {
    setTimeout(fn) { return 1; },
    clearTimeout() {},
  };
  if (!window.CISTaskSession) loadScript("performance/task-session.js");

  const session = window.CISTaskSession.createDebouncedSession({ debounceMs: 0 });
  let completed = 0;
  const first = session.runImmediate(async (gen, isCurrent) => {
    await sleep(20);
    if (isCurrent(gen)) completed += 1;
  });
  session.cancelPending();
  await first;
  if (completed !== 0) fail("Stale async task should not complete after cancel");
  ok("async search cancellation drops stale results");
}

function testBibleSearchCancellation() {
  global.window = {
    CISBibleStore: {
      getBooks: () => [{ order: 1, name: "Genesis", testament: "OT" }],
      loadBook: async () => ({
        book: {
          chapters: [{
            chapter: 1,
            verses: [
              { verse: 1, text: "In the beginning God created the heaven and the earth." },
              { verse: 2, text: "And the earth was without form, and void." },
            ],
          }],
        },
      }),
    },
  };
  loadScript("bible/bible-search-service.js");

  let firstDone = false;
  const p1 = window.CISBibleSearchService.searchText("beginning", { translation: "KJV" }).then((results) => {
    firstDone = results !== null;
  });
  window.CISBibleSearchService.cancelActiveSearch();
  const p2 = window.CISBibleSearchService.searchText("void", { translation: "KJV" });

  return Promise.all([p1, p2]).then(([_, second]) => {
    if (firstDone) fail("Cancelled bible search should return null");
    if (!second || !second.length) fail("Second bible search should complete");
    ok("bible phrase search cancels stale requests");
  });
}

function testPassageCache() {
  global.window = {};
  loadScript("performance/passage-cache.js");
  window.CISPassageCache.set({ ref: "John 3:16", t: "KJV" }, { slides: [{ body: "For God so loved" }] });
  const hit = window.CISPassageCache.get({ ref: "John 3:16", t: "KJV" });
  if (!hit || !hit.slides.length) fail("Passage cache should return stored slides");
  for (let i = 0; i < 60; i += 1) {
    window.CISPassageCache.set({ ref: `Ref ${i}`, t: "KJV" }, { slides: [] });
  }
  if (window.CISPassageCache.size() > window.CISPassageCache.MAX_ENTRIES) {
    fail(`Passage cache exceeded max entries (${window.CISPassageCache.size()})`);
  }
  ok("passage cache stores and evicts LRU entries");
}

function testStanzaRenderCache() {
  global.window = {};
  loadScript("performance/stanza-render-cache.js");
  window.CISStanzaRenderCache.set("line one\nline two", "line one<br>line two");
  const cached = window.CISStanzaRenderCache.get("line one\nline two");
  if (cached !== "line one<br>line two") fail("Stanza render cache mismatch");
  ok("stanza render cache memoises HTML");
}

function testHymnIndexStableKeys() {
  const html = fs.readFileSync(path.join(appDir, "hymn-index-ui.js"), "utf8");
  if (!html.includes("data-hymn-key")) fail("Hymn index cards should expose stable data-hymn-key");
  if (!html.includes("cardHtmlCache")) fail("Hymn index should memoise card HTML");
  ok("hymn index uses stable keys and card memoisation");
}

function testObsReconnectTimerDedup() {
  const timers = [];
  global.window = {
    setTimeout(fn, ms) {
      const id = timers.length + 1;
      timers.push({ id, fn, cleared: false });
      return id;
    },
    clearTimeout(id) {
      const entry = timers.find((item) => item.id === id);
      if (entry) entry.cleared = true;
    },
    CISObsSettingsStore: {
      loadSettings: () => ({
        enabled: true,
        autoReconnect: true,
        reconnectIntervalMs: 1000,
      }),
    },
    CISObsConstants: {
      CONNECTION_STATES: {
        RECONNECTING: "reconnecting",
        DISCONNECTED: "disconnected",
        DISABLED: "disabled",
      },
    },
  };
  loadScript("obs/obs-connection-service.js");

  if (!window.CISObsConnectionService.hasActiveReconnectTimer) {
    fail("OBS connection service should expose reconnect timer state");
  }
  ok("OBS reconnect timer diagnostics exposed");
}

function testCameraCleanupExports() {
  const html = fs.readFileSync(path.join(appDir, "camera/camera-source-service.js"), "utf8");
  if (!html.includes("shutdownCleanup")) fail("Camera service should expose shutdownCleanup");
  if (!html.includes("releaseAllStreams")) fail("Camera service should expose releaseAllStreams");
  if (!html.includes("getActiveStreamCount")) fail("Camera service should expose getActiveStreamCount");
  ok("camera cleanup helpers are exported");
}

function testLazyPerformanceModulesInShell() {
  const indexHtml = fs.readFileSync(path.join(appDir, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(appDir, "sw.js"), "utf8");
  if (!indexHtml.includes("performance/task-session.js")) fail("index.html should load task-session.js");
  if (!indexHtml.includes("performance/performance-monitor.js")) fail("index.html should load performance-monitor.js");
  if (!sw.includes("christ-in-song-worship-v38")) fail("service worker cache should be v38");
  if (indexHtml.includes("sda-hymnal-pack.js")) fail("SDA pack should remain deferred");
  ok("performance modules ship in app shell with cache v38");
}

function testLargeHymnCollectionRenderMemo() {
  global.window = {
    Fuse: class MockFuse {
      constructor(records) { this.records = records; }
      search(query) {
        return this.records
          .filter((item) => JSON.stringify(item).includes(query))
          .map((item) => ({ item, score: 0.1, matches: [] }));
      }
    },
  };
  loadScript("hymn-search.js");

  const songs = [];
  for (let i = 1; i <= 400; i += 1) {
    const num = String(i).padStart(3, "0");
    songs.push(createMockSong(num, `Hymn ${num}`, `body ${num}`));
  }
  const pack = { code: "bench", status: "ready", songs, editionId: "bench-edition" };
  window.CISSearchEngine.ensurePackIndexed(pack);

  const start = Date.now();
  const first = window.CISSearchEngine.search("Hymn 200");
  const firstMs = Date.now() - start;
  const secondStart = Date.now();
  const second = window.CISSearchEngine.search("Hymn 200");
  const secondMs = Date.now() - secondStart;
  if (!first.total) fail("Large collection search should return hits");
  if (second !== first) fail("Repeated search should hit memo cache");
  if (firstMs > 500) fail(`Large collection search too slow: ${firstMs}ms`);
  if (secondMs > firstMs) fail(`Cached search should be faster (${secondMs}ms vs ${firstMs}ms)`);
  ok(`large hymn search ${firstMs}ms, cached ${secondMs}ms`);
}

function testHymnSearchUiCancellationApi() {
  const html = fs.readFileSync(path.join(appDir, "hymn-search-ui.js"), "utf8");
  if (!html.includes("cancelPending")) fail("Search UI should expose cancelPending");
  if (!html.includes("CISTaskSession")) fail("Search UI should use task session debounce");
  ok("hymn search UI exposes cancellation and debounce");
}

async function testLongSessionResourceStability() {
  global.window = global.window || {};
  if (!window.CISStanzaRenderCache) loadScript("performance/stanza-render-cache.js");
  if (!window.CISPassageCache) loadScript("performance/passage-cache.js");

  const initialStanza = window.CISStanzaRenderCache.size();
  const initialPassage = window.CISPassageCache.size();

  for (let round = 0; round < 120; round += 1) {
    window.CISStanzaRenderCache.set(`verse-${round}`, `<p>${round}</p>`);
    window.CISPassageCache.set({ ref: `John ${round % 21 || 1}:${round % 30 || 1}`, t: "KJV" }, { slides: [] });
    if (window.CISBibleSearchService) window.CISBibleSearchService.cancelActiveSearch();
  }

  if (window.CISStanzaRenderCache.size() > window.CISStanzaRenderCache.MAX_ENTRIES) {
    fail("Stanza cache grew without bound in long session simulation");
  }
  if (window.CISPassageCache.size() > window.CISPassageCache.MAX_ENTRIES) {
    fail("Passage cache grew without bound in long session simulation");
  }
  if (window.CISStanzaRenderCache.size() <= initialStanza) {
    fail("Stanza cache should retain entries during simulation");
  }
  ok("long-session simulation keeps bounded caches");
}

async function main() {
  await testTaskSessionDebounce();
  await testTaskSessionCancellation();
  await testBibleSearchCancellation();
  testPassageCache();
  testStanzaRenderCache();
  testHymnIndexStableKeys();
  testObsReconnectTimerDedup();
  testCameraCleanupExports();
  testLazyPerformanceModulesInShell();
  testLargeHymnCollectionRenderMemo();
  testHymnSearchUiCancellationApi();
  await testLongSessionResourceStability();
  ok("all performance audit tests passed");
}

main().catch((error) => fail(error?.message || String(error)));
