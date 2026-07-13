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

  assert.equal(migration.resolveBookOrigin({ isBuiltIn: true }), "builtIn");
  assert.equal(migration.resolveEditionOrigin({ sourceType: "builtin" }), "builtIn");
  assert.equal(migration.resolveEditionOrigin({ sourceType: "imported" }), "imported");
  assert.equal(migration.isDeletableOrigin("builtIn"), false);
  assert.equal(migration.isDeletableOrigin("imported"), true);
  assert.equal(migration.isDeletableOrigin("userCreated"), true);
  assert.equal(migration.originLabel("builtIn"), "Built-in");
  assert.equal(migration.originLabel("imported"), "Imported");
  assert.equal(migration.originLabel("userCreated"), "User-created");

  const storeWin = loadModule("app/hymnal-library/hymnal-library-store.js", { window: win });
  const store = storeWin.CISHymnalLibraryStore;
  const builtinBook = migration.builtInHymnBooks()[0];
  assert.throws(
    () => store.assertDeletableBook(builtinBook),
    /built-in hymn book/i,
  );
  assert.throws(
    () => store.assertDeletableEdition(migration.builtInEditionFromLegacy("zu", { code: "zu", name: "Zulu" })),
    /built-in edition/i,
  );

  const deletionWin = loadModule("app/hymnal-library/hymnal-deletion-service.js", { window: { ...win, CISHymnalLibraryStore: store } });
  const deletion = deletionWin.CISHymnalDeletionService;

  const refs = {
    favorites: ["custom-hymnal-english:001", "christ-in-song-zulu:010"],
    recents: ["custom-hymnal-english:002"],
    worshipPlan: [{ role: "Opening", songKey: "custom-hymnal-english:003" }],
    songService: [{ role: "Song 1", songKey: "custom-hymnal-english:004" }],
    customTemplates: [{ id: "t1", name: "Sunday", slots: [{ songKey: "custom-hymnal-english:005" }] }],
    songTagMap: { "custom-hymnal-english:006": ["praise"] },
    presenter: { songKey: "custom-hymnal-english:007" },
  };

  deletion.configure({
    getReferenceData: () => refs,
  });

  const impact = deletion.analyzeEditionReferences("custom-hymnal-english");
  assert.equal(impact.favorites.length, 1);
  assert.equal(impact.worshipPlan.length, 1);
  assert.equal(impact.songService.length, 1);
  assert.equal(impact.templates.length, 1);
  assert.equal(impact.songTags.length, 1);
  assert.ok(impact.presenter);
  assert.ok(impact.total >= 7);

  const patch = deletion.buildReferencePatch(impact, "remove", "", "custom-hymnal-english");
  assert.equal(patch.removeFavorites.length, 1);
  assert.equal(patch.removeFavorites[0], "custom-hymnal-english:001");
  assert.equal(patch.clearWorshipPlanSlots.length, 1);

  const uiSource = read("app/hymnal-library/hymnal-library-ui.js");
  assert.ok(uiSource.includes("origin-badge"));
  assert.ok(uiSource.includes("delete-hymnal-edition"));
  assert.ok(uiSource.includes("delete-hymnal-book"));
  assert.ok(uiSource.includes("validate-hymnal-book"));
  assert.ok(!uiSource.includes('data-command="delete-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Delete</button>\n    `;\n  }\n\n  function renderBuiltinBookActions'));

  const appSource = read("app/app.js");
  assert.ok(appSource.includes("getSearchScopeOptions"));
  assert.ok(appSource.includes("applyHymnalReferencePatch"));
  assert.ok(appSource.includes("confirmDeleteHymnal"));
  assert.ok(appSource.includes("parsed.editionId"));
  assert.ok(appSource.includes("CISHymnalDeletionService"));

  const searchSource = read("app/hymn-search.js");
  assert.ok(searchSource.includes("hymnBookTitle"));
  assert.ok(searchSource.includes("editionIds"));
  assert.ok(searchSource.includes("sourceLabel"));

  const searchUiSource = read("app/hymn-search-ui.js");
  assert.ok(searchUiSource.includes("renderScopeRow"));
  assert.ok(searchUiSource.includes("search-result-source"));
  assert.ok(searchUiSource.includes("getSearchScopeOptions"));

  const indexHtml = read("app/index.html");
  assert.ok(indexHtml.includes("hymnal-deletion-service.js"));

  const stylesSource = read("app/styles.css");
  assert.ok(stylesSource.includes("origin-badge"));
  assert.ok(stylesSource.includes("hymnal-delete-modal"));

  const helpSource = read("app/help/help-content.js");
  assert.ok(helpSource.includes("Hymnal Library Manager"));
  assert.ok(helpSource.includes("reference-impact"));

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:hymnal-integration"]);

  console.log("test:hymnal-integration — all checks passed");
}

run();
