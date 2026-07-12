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
  const win = loadModule("app/hymnal-library/hymnal-migration.js");
  const migration = win.CISHymnalMigration;

  assert.equal(migration.CHRIST_IN_SONG, "christ-in-song");
  assert.equal(migration.SDA_HYMNAL, "sda-hymnal");
  assert.equal(migration.resolveEditionFromLegacyCode("zu").editionId, "christ-in-song-zulu");
  assert.equal(migration.resolveEditionFromLegacyCode("sda").hymnBookId, "sda-hymnal");
  assert.equal(migration.resolveEditionFromLegacyCode("sda").editionId, "sda-hymnal-english");

  const cisDetection = migration.detectHymnBookFromFilename("Christ_in_Song_Zulu.pptx");
  assert.equal(cisDetection.hymnBookId, "christ-in-song");
  const sdaDetection = migration.detectHymnBookFromFilename("SDA_Hymnal_English_PowerPoint_Pack.pptx");
  assert.equal(sdaDetection.hymnBookId, "sda-hymnal");

  assert.equal(migration.buildHymnId("christ-in-song-zulu", "001"), "christ-in-song-zulu:001");
  assert.equal(
    migration.migrateSongKey("zu:001", migration.editionIdByLegacyCodeMap()),
    "christ-in-song-zulu:001",
  );
  assert.equal(
    migration.migrateSongKey("sda:010", migration.editionIdByLegacyCodeMap()),
    "sda-hymnal-english:010",
  );

  const zuluEdition = migration.builtInEditionFromLegacy("zu", {
    code: "zu",
    name: "Zulu",
    source: "Christ_in_Song_VaChinoda. v2_QA_Clean.pptx",
    songCount: 300,
  });
  assert.equal(zuluEdition.sourceFileName, migration.ZULU_SOURCE_FIX);
  assert.equal(zuluEdition.hymnBookId, "christ-in-song");

  const classifiedSda = migration.classifyImportedPack(
    { code: "sda", name: "SDA Hymnal", songs: [{ number: "001", title: "Test" }] },
    "SDA_Hymnal_English_PowerPoint_Pack.pptx",
  );
  assert.equal(classifiedSda.hymnBookId, "sda-hymnal");
  assert.equal(classifiedSda.editionId, "sda-hymnal-english");

  const classifiedUnknown = migration.classifyImportedPack(
    { code: "xyz", name: "Mystery Pack", songs: [{ number: "001", title: "Test" }] },
    "random-import.pptx",
  );
  assert.equal(classifiedUnknown.hymnBookId, "unclassified-hymn-books");

  const settingsWin = loadModule("app/hymnal-library/hymnal-library-settings.js", { window: win });
  const settings = settingsWin.CISHymnalLibrarySettings;
  const storage = { _data: {} };
  const saveJson = (key, value) => { storage._data[key] = JSON.stringify(value); };
  const loadJson = (key, fallback) => {
    const raw = storage._data[key];
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_error) { return fallback; }
  };
  const saved = settings.save({ hymnBookId: "sda-hymnal", editionId: "sda-hymnal-english" }, saveJson);
  assert.equal(saved.hymnBookId, "sda-hymnal");
  const loaded = settings.load(() => "zu", loadJson);
  assert.equal(loaded.editionId, "sda-hymnal-english");

  const storeWin = loadModule("app/hymnal-library/hymnal-library-store.js", { window: win });
  const store = storeWin.CISHymnalLibraryStore;
  assert.equal(typeof store.normalizeSong, "function");
  const normalized = store.normalizeSong({ number: "1", title: "Test" }, "christ-in-song-zulu");
  assert.equal(normalized.hymnId, "christ-in-song-zulu:001");

  const appSource = read("app/app.js");
  assert.ok(appSource.includes("hymnBookSwitcher"));
  assert.ok(appSource.includes("hymnEditionSwitcher"));
  assert.ok(appSource.includes("selectEdition"));
  assert.ok(appSource.includes("loadHymnalLibrary"));
  assert.ok(appSource.includes("migrateLegacySongKeys"));

  const indexHtml = read("app/index.html");
  assert.ok(indexHtml.includes("hymnal-library/hymnal-library-store.js"));
  assert.ok(indexHtml.includes('id="hymnBookSwitcher"'));
  assert.ok(indexHtml.includes('id="hymnEditionSwitcher"'));

  const importSource = read("app/pack-import.js");
  assert.ok(importSource.includes("CISHymnalImportService"));
  assert.ok(importSource.includes("hymnalImportTarget"));

  const backupSource = read("app/backup-restore.js");
  assert.ok(backupSource.includes("hymnalLibrary"));
  assert.ok(backupSource.includes("hymnBookId"));

  const searchSource = read("app/hymn-search.js");
  assert.ok(searchSource.includes("editionId"));
  assert.ok(searchSource.includes("hymnId"));

  const uiSource = read("app/hymn-index-ui.js");
  assert.ok(uiSource.includes("renderHymnalSelectors"));

  const cssSource = read("app/styles.css");
  assert.ok(cssSource.includes("hymnal-selector-group"));
  assert.ok(cssSource.includes("hymnal-library-settings"));

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:hymnal-library"]);

  console.log("test:hymnal-library — all checks passed");
}

run();
