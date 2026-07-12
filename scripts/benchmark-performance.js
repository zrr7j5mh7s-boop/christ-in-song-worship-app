// scripts/benchmark-performance.js
//
// Records baseline/after metrics for hymn search, bible search, and cache behaviour.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "app");

function loadScript(relativePath) {
  const full = path.join(appDir, relativePath);
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

function bench(label, fn, iterations = 1) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    samples.push(Number(end - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { label, medianMs: Number(median.toFixed(3)), avgMs: Number(avg.toFixed(3)), samples };
}

function setupHymnSearch(packSize) {
  global.window = {
    Fuse: class MockFuse {
      constructor(records, options) {
        this.records = records;
        this.options = options;
      }
      search(query, opts) {
        const q = String(query).toLowerCase();
        const limit = opts?.limit || 120;
        return this.records
          .filter((item) => JSON.stringify(item).toLowerCase().includes(q))
          .slice(0, limit)
          .map((item) => ({ item, score: 0.1, matches: [{ key: "title", value: item.title, indices: [[0, 1]] }] }));
      }
    },
  };
  loadScript("hymn-search.js");
  const songs = [];
  for (let i = 1; i <= packSize; i += 1) {
    const num = String(i).padStart(3, "0");
    songs.push(createMockSong(num, `Benchmark Hymn ${num}`, `praise worship stanza ${num}`));
  }
  const pack = { code: "bench", status: "ready", songs, editionId: "bench-edition", name: "Benchmark" };
  window.CISSearchEngine.ensurePackIndexed(pack);
  return pack;
}

function setupBibleSearch() {
  global.window = {
    CISBibleStore: {
      getBooks: () => [{ order: 1, name: "Genesis", testament: "OT" }],
      loadBook: async () => ({
        book: {
          chapters: [{
            chapter: 1,
            verses: Array.from({ length: 200 }, (_, index) => ({
              verse: index + 1,
              text: `Verse text number ${index + 1} with praise and worship keywords`,
            })),
          }],
        },
      }),
    },
  };
  loadScript("bible/bible-search-service.js");
}

async function runBenchmarks() {
  const report = {
    generatedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform },
    measurements: [],
  };

  setupHymnSearch(695);
  report.measurements.push(bench("hymnSearch_cold", () => {
    window.CISSearchEngine.search("praise 120");
  }, 8));
  report.measurements.push(bench("hymnSearch_cached", () => {
    window.CISSearchEngine.search("praise 120");
  }, 8));

  setupHymnSearch(1200);
  report.measurements.push(bench("hymnSearch_largeCollection", () => {
    window.CISSearchEngine.search("worship 600");
  }, 5));

  global.window = {};
  loadScript("performance/stanza-render-cache.js");
  report.measurements.push(bench("stanzaCache_miss", () => {
    window.CISStanzaRenderCache.set(`key-${Math.random()}`, "<p>text</p>");
  }, 200));
  report.measurements.push(bench("stanzaCache_hit", () => {
    window.CISStanzaRenderCache.get("warm-key");
  }, 200));
  window.CISStanzaRenderCache.set("warm-key", "<p>text</p>");

  setupBibleSearch();
  const bibleColdStart = process.hrtime.bigint();
  const coldResults = await window.CISBibleSearchService.searchText("praise worship", { translation: "KJV", limit: 20 });
  const bibleColdMs = Number(process.hrtime.bigint() - bibleColdStart) / 1e6;
  report.measurements.push({
    label: "biblePhraseSearch_cold",
    medianMs: Number(bibleColdMs.toFixed(3)),
    avgMs: Number(bibleColdMs.toFixed(3)),
    resultCount: coldResults.length,
  });

  const bibleWarmStart = process.hrtime.bigint();
  const warmResults = await window.CISBibleSearchService.searchText("worship keywords", { translation: "KJV", limit: 20 });
  const bibleWarmMs = Number(process.hrtime.bigint() - bibleWarmStart) / 1e6;
  report.measurements.push({
    label: "biblePhraseSearch_indexCached",
    medianMs: Number(bibleWarmMs.toFixed(3)),
    avgMs: Number(bibleWarmMs.toFixed(3)),
    resultCount: warmResults.length,
  });

  global.window = {
    setTimeout(fn, ms) { return setTimeout(fn, ms); },
    clearTimeout(id) { clearTimeout(id); },
  };
  loadScript("performance/task-session.js");
  let debouncedRuns = 0;
  const session = window.CISTaskSession.createDebouncedSession({ debounceMs: 30 });
  const debounceStart = Date.now();
  await new Promise((resolve) => {
    for (let i = 0; i < 12; i += 1) {
      session.scheduleDebounced(() => { debouncedRuns += 1; resolve(); });
    }
    setTimeout(resolve, 120);
  });
  report.measurements.push({
    label: "debounce_coalescedRuns",
    medianMs: Date.now() - debounceStart,
    runs: debouncedRuns,
  });

  const outPath = path.join(root, "scripts", "performance-benchmark-report.json");
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("[benchmark:performance] wrote", outPath);
  report.measurements.forEach((item) => {
    console.log(`[benchmark:performance] ${item.label}: ${item.medianMs ?? item.runs} ${item.runs != null ? "runs" : "ms"}`);
  });
}

runBenchmarks().catch((error) => {
  console.error("[benchmark:performance] FAIL:", error);
  process.exit(1);
});
