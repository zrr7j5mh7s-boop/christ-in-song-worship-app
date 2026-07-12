// scripts/test-performance.js
//
// Quick smoke tests for lazy loading and incremental search indexing.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "app");

function fail(message) {
  console.error(`[test:performance] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[test:performance] ${message}`);
}

function loadScript(relativePath) {
  const full = path.join(appDir, relativePath);
  if (!fs.existsSync(full)) fail(`Missing file: ${relativePath}`);
  const code = fs.readFileSync(full, "utf8");
  vm.runInThisContext(code, { filename: full });
}

function createMockSong(number, title, body) {
  return {
    number,
    title,
    slides: [{ kind: "verse", label: "Verse 1", body }],
    sections: [{ kind: "verse", label: "Verse 1", body }],
  };
}

function runSearchTests() {
  global.window = {
    Fuse: class MockFuse {
      constructor(records, options) {
        this.records = records;
        this.options = options;
      }
      search(query) {
        const q = String(query).toLowerCase();
        return this.records
          .filter((item) => JSON.stringify(item).toLowerCase().includes(q))
          .map((item) => ({ item, score: 0.1, matches: [] }));
      }
    },
  };

  loadScript("hymn-search.js");

  const packs = [
    {
      code: "zu",
      name: "Zulu",
      status: "ready",
      songs: [createMockSong("001", "Alpha Hymn", "come worship now")],
    },
    {
      code: "en",
      name: "English",
      status: "ready",
      songs: [createMockSong("002", "Beta Hymn", "praise the lord")],
    },
  ];

  const indexedZu = window.CISSearchEngine.ensurePackIndexed(packs[0]);
  if (indexedZu !== 1) fail(`Expected 1 indexed Zulu hymn, got ${indexedZu}`);
  if (window.CISSearchEngine.getRecordCount() !== 1) {
    fail(`Expected record count 1 after single-pack index, got ${window.CISSearchEngine.getRecordCount()}`);
  }

  const first = window.CISSearchEngine.search("alpha");
  if (!first.total) fail("Expected search hit before indexing all packs");

  window.CISSearchEngine.ensurePackIndexed(packs[1]);
  const second = window.CISSearchEngine.search("praise");
  if (!second.total) fail("Expected cross-pack search hit after lazy index");

  const cached = window.CISSearchEngine.search("praise");
  if (cached !== second) fail("Expected search result cache to return same object");

  ok("incremental search indexing works");
}

function runLoaderTests() {
  global.window = global.window || {};
  global.document = {
    head: { appendChild: () => {} },
  };
  loadScript("lazy-pack-loader.js");

  if (!window.CISLazyLoader) fail("CISLazyLoader was not registered");
  if (!window.CISLazyLoader.isPackDeferred("sda")) fail("SDA pack should be deferred");
  if (window.CISLazyLoader.isPackDeferred("zu")) fail("Zulu pack should not be deferred");
  if (!window.CISLazyLoader.DEFERRED_PACK_META.sda) fail("SDA deferred pack metadata should be defined");
  if (window.CISLazyLoader.DEFERRED_PACK_META.sda.name !== "SDA Hymnal") {
    fail(`Unexpected SDA pack name: ${window.CISLazyLoader.DEFERRED_PACK_META.sda.name}`);
  }
  if (!window.CISLazyLoader.DEFERRED_BUNDLES.pdfmake.length) fail("pdfmake bundle should be defined");

  const resolved = window.CISLazyLoader.assetPath("./app.js?v=25");
  if (resolved !== "./app.js?v=25") fail(`Unexpected dev asset path: ${resolved}`);

  global.window.CIS_BUILD_PREFIX = "./dist/";
  const prod = window.CISLazyLoader.assetPath("./bulletin-export.js?v=1");
  if (prod !== "./dist/bulletin-export.js") fail(`Unexpected prod asset path: ${prod}`);

  ok("lazy pack loader exposes deferred packs and production paths");
}

function runHtmlTests() {
  const indexHtml = fs.readFileSync(path.join(appDir, "index.html"), "utf8");
  if (indexHtml.includes("sda-hymnal-pack.js")) {
    fail("index.html should not synchronously load sda-hymnal-pack.js");
  }
  if (!indexHtml.includes("lazy-pack-loader.js")) {
    fail("index.html should load lazy-pack-loader.js");
  }
  if (indexHtml.includes("pdfmake.min.js")) {
    fail("index.html should defer pdfmake.min.js");
  }
  ok("index.html defers heavy packs and vendor bundles");
}

runHtmlTests();
runLoaderTests();
runSearchTests();
ok("all performance smoke tests passed");
