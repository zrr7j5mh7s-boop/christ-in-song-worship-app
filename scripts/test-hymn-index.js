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

function loadSettings() {
  const source = read("app/hymn-index-settings.js");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.CISHymnIndexSettings;
}

function loadUi() {
  const source = read("app/hymn-index-ui.js");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.CISHymnIndexUI;
}

function run() {
  const settings = loadSettings();
  const ui = loadUi();
  const storage = { _data: {} };
  const saveJson = (key, value) => { storage._data[key] = JSON.stringify(value); };
  const loadJson = (key, fallback) => {
    const raw = storage._data[key];
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_error) { return fallback; }
  };

  assert.equal(settings.normalizeLayout("compact"), "compact");
  assert.equal(settings.normalizeLayout("invalid"), "grid");
  assert.equal(settings.normalizeSort("title-asc"), "title-asc");
  assert.equal(settings.normalizeSort("bad"), "number-asc");

  const saved = settings.save({ layout: "list", showCategories: false, sort: "title-asc" }, saveJson);
  assert.equal(saved.layout, "list");
  assert.equal(saved.showCategories, false);

  const loaded = settings.load(null, loadJson);
  assert.equal(loaded.layout, "list");
  assert.equal(loaded.showCategories, false);

  const songs = [
    { number: "003", title: "Zebra Song" },
    { number: "001", title: "Alpha Song" },
    { number: "002", title: "Beta Song" },
  ];
  const sorted = ui.sortSongs(songs, "title-asc", { songKey: (s) => `zu:${s.number}` });
  assert.equal(sorted[0].title, "Alpha Song");
  assert.equal(sorted[2].title, "Zebra Song");

  const favorites = new Set(["zu:002"]);
  const favSorted = ui.sortSongs(songs, "favorites", {
    favorites,
    songKey: (s) => `zu:${s.number}`,
  });
  assert.equal(favSorted[0].number, "002");

  const gridHtml = ui.renderCollection(songs, { layout: "grid", showCategories: true, showTitles: true, showFavorites: true }, {
    favorites,
    songKey: (s) => `zu:${s.number}`,
    renderSongTags: () => '<div class="song-tag-list"><button class="song-tag-chip">Prayer</button></div>',
  });
  assert.ok(gridHtml.includes("hymn-index-grid layout-grid"));
  assert.ok(gridHtml.includes("hymn-card-tags"));
  assert.ok(gridHtml.includes("Prayer"));

  const hiddenCats = ui.renderCollection(songs, { layout: "grid", showCategories: false, showTitles: true }, {
    songKey: (s) => `zu:${s.number}`,
    renderSongTags: () => '<div class="song-tag-list"><button>Prayer</button></div>',
  });
  assert.equal(hiddenCats.includes("hymn-card-tags"), false);

  const compactHtml = ui.renderCollection(songs, { layout: "compact", showCategories: true }, {
    songKey: (s) => `zu:${s.number}`,
    renderSongTags: () => "",
  });
  assert.ok(compactHtml.includes("layout-compact"));
  assert.ok(compactHtml.includes("is-compact"));

  const listHtml = ui.renderCollection(songs, { layout: "list", showCategories: true, showFavorites: true }, {
    favorites,
    songKey: (s) => `zu:${s.number}`,
    renderSongTags: () => "",
  });
  assert.ok(listHtml.includes("hymn-index-list"));
  assert.ok(listHtml.includes("hymn-index-list-row"));

  const toolbar = ui.renderToolbar({
    settings: { layout: "grid", showCategories: true, sort: "number-asc" },
    query: "",
    ranges: [["001-050", 1, 50]],
    activeRange: "001-050",
    filterRow: '<div class="filter-row"><button data-command="index-all-hymns">All Hymns</button></div>',
  });
  assert.ok(toolbar.includes("set-index-layout"));
  assert.ok(toolbar.includes("Show categories"));
  assert.ok(toolbar.includes("All Hymns"));
  assert.ok(toolbar.includes("<svg"));
  assert.equal(toolbar.includes("emoji"), false);

  const appSource = read("app/app.js");
  assert.ok(appSource.includes("persistIndexDisplay"));
  assert.ok(appSource.includes("index-all-hymns"));
  assert.ok(appSource.includes("songSearchHaystack"));
  assert.ok(appSource.includes("CISHymnIndexUI.renderPage"));

  const cssSource = read("app/styles.css");
  assert.ok(cssSource.includes("hymn-index-grid"));
  assert.ok(cssSource.includes("repeat(auto-fill, minmax(var(--hymn-card-min"));
  assert.ok(cssSource.includes("hymn-card-tags"));

  const searchUi = read("app/hymn-search-ui.js");
  assert.ok(searchUi.includes("renderIndexCollection"));

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:hymn-index"]);

  console.log("test:hymn-index — all checks passed");
}

run();
