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

function loadCatalog() {
  const source = read("app/data/bible-catalog.js");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.CIS_BIBLE_CATALOG;
}

function loadStoreAndParser(catalog) {
  const storeSource = `
    const catalog = ${JSON.stringify(catalog)};
    ${read("app/bible-store.js").replace(
      "const catalog = window.CIS_BIBLE_CATALOG || { translations: [], books: [] };",
      "",
    )}
  `;
  const parserSource = read("app/bible/bible-reference-parser.js");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(storeSource, sandbox);
  vm.runInContext(parserSource, sandbox);
  return {
    parser: sandbox.window.CISBibleReferenceParser,
    store: sandbox.window.CISBibleStore,
  };
}

function loadProjectionModules(catalog) {
  const sandbox = {
    window: {},
    console,
    fetch: async () => ({ ok: false }),
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const catalog = ${JSON.stringify(catalog)};
    ${read("app/bible-store.js").replace(
      "const catalog = window.CIS_BIBLE_CATALOG || { translations: [], books: [] };",
      "",
    )}
  `, sandbox);
  vm.runInContext(read("app/bible/bible-reference-parser.js"), sandbox);
  vm.runInContext(read("app/bible/bible-projection-settings.js"), sandbox);
  vm.runInContext(read("app/bible/bible-projection-service.js"), sandbox);
  vm.runInContext(read("app/bible/bible-search-service.js"), sandbox);
  vm.runInContext(read("app/bible/bible-speech-service.js"), sandbox);
  vm.runInContext(read("app/bible/bible-live-ui.js"), sandbox);
  return sandbox.window;
}

function mockBook() {
  return {
    book: {
      chapters: [{
        chapter: 3,
        verses: [
          { verse: 16, text: "For God so loved the world, that he gave his only begotten Son." },
          { verse: 17, text: "For God sent not his Son into the world to condemn the world." },
          { verse: 18, text: "He that believeth on him is not condemned." },
        ],
      }, {
        chapter: 8,
        verses: [{ verse: 28, text: "And we know that all things work together for good." }],
      }],
    },
  };
}

async function run() {
  const catalog = loadCatalog();
  const { parser, store } = loadStoreAndParser(catalog);

  const john = parser.parseReference("John 3:16");
  assert.equal(john.ok, true);
  assert.equal(john.parsed.bookName, "John");
  assert.equal(john.parsed.chapter, 3);
  assert.equal(john.parsed.verseStart, 16);

  const jn = parser.parseReference("Jn 3:16");
  assert.equal(jn.ok, true);
  assert.equal(jn.parsed.referenceLabel, "John 3:16");

  const rom = parser.parseReference("Rom 8:28");
  assert.equal(rom.ok, true);
  assert.equal(rom.parsed.bookName, "Romans");

  const range = parser.parseReference("Rev 14:6-12");
  assert.equal(range.ok, true);
  assert.equal(range.parsed.verseStart, 6);
  assert.equal(range.parsed.verseEnd, 12);

  const numbered = parser.parseReference("1 Cor 13");
  assert.equal(numbered.ok, true);
  assert.equal(numbered.parsed.bookName, "1 Corinthians");

  const psalm = parser.parseReference("Ps 23");
  assert.equal(psalm.ok, true);
  assert.equal(psalm.parsed.bookName, "Psalms");

  const invalid = parser.parseReference("NotABook 1:1");
  assert.equal(invalid.ok, false);

  const badVerse = parser.parseReference("John 3:60");
  assert.equal(badVerse.ok, true);

  const partial = parser.suggestFromPartial("John 3");
  assert.ok(partial.length >= 2);
  assert.ok(partial.some((item) => item.reference.includes("John 3:16")));

  const mods = loadProjectionModules(catalog);
  const service = mods.CISBibleProjectionService;
  const settings = mods.CISBibleProjectionSettings;
  const search = mods.CISBibleSearchService;
  const speech = mods.CISBibleSpeechService;
  const ui = mods.CISBibleLiveUI;

  const saved = settings.save({ defaultTranslation: "KJV", versesPerSlide: 2 }, (key, value) => {
    settings._saved = value;
  });
  assert.equal(saved.versesPerSlide, 2);

  const originalLoad = mods.CISBibleStore.loadBook;
  mods.CISBibleStore.loadBook = async () => mockBook();

  let sendLiveCalls = 0;
  service.configure({
    loadSettings: () => settings.load(null, () => settings._saved),
    onSendLive: () => { sendLiveCalls += 1; },
    onClearLive: () => {},
  });

  await service.loadPreviewFromInput("John 3:16");
  const preview = service.getState().preview;
  assert.equal(preview.referenceLabel, "John 3:16");
  assert.equal(preview.slides.length, 1);
  assert.equal(preview.translation, "KJV");

  await service.loadPreviewFromInput("John 3:60");
  assert.ok(service.getState().preview.error);
  assert.equal(service.getState().preview.slides.length, 0);

  await service.loadPreviewFromInput("John 3:16");

  const liveBefore = service.getState().live.referenceLabel;
  assert.equal(liveBefore, "");

  const send = service.sendLive();
  assert.equal(send.ok, true);
  assert.equal(sendLiveCalls, 1);
  assert.equal(service.getState().live.active, true);
  assert.equal(service.getState().live.referenceLabel, "John 3:16");

  await service.setPreviewTranslation("ASV");
  assert.equal(service.getState().preview.translation, "ASV");
  assert.equal(service.getState().live.translation, "KJV");

  const change = await service.changeLiveVersion("ASV");
  assert.equal(change.ok, true);
  assert.equal(service.getState().live.translation, "ASV");

  const clear = service.clearLive();
  assert.equal(clear.ok, true);
  assert.equal(service.getState().live.cleared, true);

  const restore = service.restorePreviousLive();
  assert.equal(restore.ok, true);
  assert.equal(service.getState().live.cleared, false);

  const slides = service.buildSlides(
    mockBook().book.chapters[0].verses,
    john.parsed,
    "KJV",
    null,
  );
  assert.ok(slides.length >= 1);
  assert.ok(slides[0].body.includes("For God so loved"));

  search.clearIndex();
  const index = await search.buildIndex("KJV");
  assert.ok(index.length > 0);

  const match = search.matchesRecord({
    text: "God so loved the world",
    testament: "NT",
    bookOrder: 43,
  }, "God loved", { allWords: false });
  assert.equal(match, true);

  const spoken = speech.parseSpokenReference("turn to John chapter 3 verse 16");
  assert.equal(spoken.ok, true);
  assert.equal(spoken.parsed.referenceLabel, "John 3:16");

  assert.equal(speech.confidenceLabel(0.9), "High");
  assert.equal(speech.confidenceLabel(0.3), "Low");

  const html = ui.renderLiveWorkspace({
    translations: store.getTranslations(),
    projectionState: service.getState(),
    settings: service.getSettings(),
    speechState: { listening: false, supported: false },
    bibleMode: "live",
  });
  assert.ok(html.includes("Bible Live"));
  assert.ok(html.includes("bibleLiveReferenceInput"));
  assert.ok(html.includes("Send Live"));

  mods.CISBibleStore.loadBook = originalLoad;

  assert.ok(fs.existsSync(path.join(ROOT, "app/bible/bible-projection-service.js")));
  assert.ok(read("app/app.js").includes("open-bible-live"));
  assert.ok(read("app/index.html").includes("bible-live-ui.js"));
  assert.ok(read("app/sw.js").includes("bible-projection-service.js"));

  console.log("test:bible-projection — all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
