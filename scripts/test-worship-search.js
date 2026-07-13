#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function loadModule(file, extraSandbox) {
  const source = read(file);
  const sandbox = { window: {}, console, ...(extraSandbox || {}) };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function run() {
  const detectorWin = loadModule("app/worship-search/worship-search-query-detector.js");
  const detector = detectorWin.CISWorshipSearchQueryDetector;

  const parserWin = loadModule("app/bible/bible-reference-parser.js", {
    window: {
      CISBibleStore: {
        getBooks: () => [
          { order: 43, name: "John", osis: "John" },
          { order: 45, name: "Romans", osis: "Rom" },
        ],
      },
    },
  });
  const detectorWithParser = loadModule("app/worship-search/worship-search-query-detector.js", {
    window: { CISBibleReferenceParser: parserWin.CISBibleReferenceParser },
  }).CISWorshipSearchQueryDetector;

  assert.equal(detectorWithParser.detect("Jn 3:16").type, "bible_reference");
  assert.equal(detector.detect("51").type, "hymn_number");
  assert.equal(detector.detect("Amazing Grace").type, "hymn_title");
  assert.equal(detector.detect("all things work together for good").type, "bible_phrase");
  assert.ok(detectorWithParser.looksLikeBibleReference("John 3:16"));
  assert.ok(detector.looksLikeHymnNumber("108"));

  const engineWin = loadModule("app/worship-search/worship-search-engine.js", {
    window: {
      CISWorshipSearchQueryDetector: detectorWithParser,
      CISBibleReferenceParser: parserWin.CISBibleReferenceParser,
      CISSearchEngine: {
        search: (query) => ({
          flat: [
            {
              hymnId: "sda:default:051",
              id: "sda:default:051",
              title: "Lead Me Gently Home",
              hymnBookTitle: "SDA Hymnal",
              packName: "English",
              number: "051",
              code: "sda",
              editionId: "default",
              score: 0,
              snippetHtml: "Lead me gently home, Father",
            },
            {
              hymnId: "nde:default:051",
              id: "nde:default:051",
              title: "Different Hymn 51",
              hymnBookTitle: "Ndebele Hymnal",
              packName: "Ndebele",
              number: "051",
              code: "nde",
              editionId: "default",
              score: 0.1,
              snippetHtml: "Verse line",
            },
          ],
          groups: [],
          total: 2,
        }),
      },
      CISBibleSearchService: {
        cancelActiveSearch: () => {},
        searchText: async () => [
          {
            reference: "Romans 8:28",
            translation: "KJV",
            bookOrder: 45,
            chapter: 8,
            verse: 28,
            text: "And we know that all things work together for good",
            highlighted: "all things work together",
          },
        ],
      },
      CISSongAudioStore: {
        listAllMeta: async () => [{ songKey: "sda:default:108", fileName: "amazing-grace.mp3", kind: "mp3" }],
      },
    },
  });

  const engine = engineWin.CISWorshipSearchEngine;
  engine.configure({
    makeSongKey: (item) => `${item.code}:${item.editionId}:${item.number}`,
    getSongByKey: (key) => (key.includes("108")
      ? { number: "108", title: "Amazing Grace" }
      : { number: "051", title: "Lead Me Gently Home" }),
    describeSongKey: (key) => ({ shortLabel: `SDA Hymnal · English · Hymn ${key.split(":").pop()}` }),
    slotTitle: (slot) => slot.title || slot.role,
    slotSubtitle: () => "",
    loadRecentQueries: () => [],
    saveRecentQueries: () => {},
  });

  let cancelled = false;
  const bibleTextHits = async () => [
    {
      reference: "Romans 8:28",
      translation: "KJV",
      bookOrder: 45,
      chapter: 8,
      verse: 28,
      text: "And we know that all things work together for good",
      highlighted: "all things work together",
    },
  ];
  engineWin.CISBibleSearchService.searchText = async () => {
    if (cancelled) return null;
    return bibleTextHits();
  };

  return Promise.resolve()
    .then(async () => {
      const hymnNumber = await engine.search("51", {
        context: {
          bibleTranslation: "KJV",
          bibleAbbreviation: "KJV",
          hymnScope: {},
          worshipPlan: [{ id: "slot-51", role: "Offering", title: "Offering Hymn", songKey: "" }],
          favorites: ["sda:default:108"],
          recents: ["sda:default:051"],
        },
      });
      assert.ok(hymnNumber.total >= 2, "hymn number search should return multiple hymnals");
      const hymnGroup = hymnNumber.groups.find((group) => group.id === "hymns");
      assert.ok(hymnGroup, "hymns group present");
      assert.ok(hymnGroup.results.some((item) => item.subtitle.includes("Hymn 051")));

      const bibleRef = await engine.search("Jn 3:16", {
        context: { bibleTranslation: "KJV", bibleAbbreviation: "KJV", hymnScope: {}, worshipPlan: [], favorites: [], recents: [] },
      });
      const refGroup = bibleRef.groups.find((group) => group.id === "bible-references");
      assert.ok(refGroup, "bible reference group present");

      const phrase = await engine.search("all things work together", {
        context: { bibleTranslation: "KJV", bibleAbbreviation: "KJV", hymnScope: {}, worshipPlan: [], favorites: [], recents: [] },
      });
      const textGroup = phrase.groups.find((group) => group.id === "bible-text");
      assert.ok(textGroup, "bible text group present");

      const title = await engine.search("Amazing Grace", {
        context: { bibleTranslation: "KJV", bibleAbbreviation: "KJV", hymnScope: {}, worshipPlan: [], favorites: [], recents: [] },
      });
      assert.ok(title.flat.length >= 1, "title search returns hymn results");

      const media = await engine.search("amazing", {
        context: { bibleTranslation: "KJV", bibleAbbreviation: "KJV", hymnScope: {}, worshipPlan: [], favorites: [], recents: [] },
      });
      const mediaGroup = media.groups.find((group) => group.id === "media");
      assert.ok(mediaGroup, "media group present");

      const service = await engine.search("Offering", {
        context: {
          bibleTranslation: "KJV",
          bibleAbbreviation: "KJV",
          hymnScope: {},
          worshipPlan: [{ id: "slot-1", role: "Offering Hymn", title: "Offering Hymn", body: "" }],
          favorites: [],
          recents: [],
        },
      });
      const serviceGroup = service.groups.find((group) => group.id === "service-items");
      assert.ok(serviceGroup, "service items group present");

      hymnNumber.flat.forEach((item) => {
        assert.ok(item.actions.includes("preview"), "preview action available");
        assert.ok(item.actions.includes("set-next"), "set-next action available");
        assert.ok(!item.actions.includes("open"), "selection does not auto-live");
      });

      engine.cancelSearch();
      let slowResolve;
      const slowGate = new Promise((resolve) => {
        slowResolve = resolve;
      });
      engineWin.CISBibleSearchService.searchText = async () => {
        await slowGate;
        return bibleTextHits();
      };

      const pending = engine.search("all things work together for good", {
        context: { bibleTranslation: "KJV", bibleAbbreviation: "KJV", hymnScope: {}, worshipPlan: [], favorites: [], recents: [] },
      });
      await Promise.resolve();
      engine.cancelSearch();
      slowResolve();
      const aborted = await pending;
      assert.equal(aborted, null, "cancelled search returns null");

      const ui = read("app/worship-search/worship-search-ui.js");
      assert.match(ui, /previewActiveResult/);
      assert.match(ui, /data-worship-search-action/);
      assert.match(ui, /Escape/);
      assert.match(ui, /aria-selected/);

      const appSource = read("app/app.js");
      assert.match(appSource, /handleWorshipSearchAction/);
      assert.match(appSource, /getWorshipSearchContext/);
      assert.match(appSource, /closeWorshipSearch/);
      assert.match(appSource, /searchReturnView/);

      const indexHtml = read("app/index.html");
      assert.match(indexHtml, /worship-search-engine\.js/);
      assert.match(indexHtml, /styles\.css\?v=46/);

      const sw = read("app/sw.js");
      assert.match(sw, /christ-in-song-worship-v46/);

      const pkg = JSON.parse(read("package.json"));
      assert.ok(pkg.scripts["test:worship-search"]);

      console.log("test:worship-search — all assertions passed");
    });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
