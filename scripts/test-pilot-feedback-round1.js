#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  normalizeSource,
  assertSetSearchModeBindSpecialCase,
} = require("./lib/source-text-helpers");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadModule(rel, sandboxExtras = {}) {
  const sandbox = { window: {}, console, ...sandboxExtras };
  vm.createContext(sandbox);
  vm.runInContext(read(rel), sandbox);
  return sandbox.window;
}

function testBibleLiveUiPartialUpdate() {
  const ui = loadModule("app/bible/bible-live-ui.js").CISBibleLiveUI;
  const html = ui.renderLiveWorkspace({
    translations: [{ code: "KJV", name: "King James Version", abbreviation: "KJV" }],
    projectionState: {
      preview: { referenceInput: "grace", searchMode: "text", searchResults: [], slides: [] },
      live: {},
    },
    settings: {},
    sermonMode: false,
    bibleMode: "live",
  });
  assert.match(html, /id="bibleLiveReferenceInput"/);
  assert.match(html, /data-bible-results-host/);
  assert.doesNotMatch(html, /data-bible-command="show-logo"/, "duplicate Bible logo control removed");
}

function testBibleLiveBindsBeforePartialUpdate() {
  const app = read("app/app.js");
  assert.match(app, /const canPartial = options\.partial === true && root\.querySelector\("\.bible-live-workspace"\)/);
}

function testBibleInputDoesNotSearchOnKeystroke() {
  const app = read("app/app.js");
  assert.doesNotMatch(app, /runBiblePhraseSearch\(input\.value/, "phrase search no longer runs on each input event");
  assert.match(app, /setPreviewField\("referenceInput", input\.value, \{ silent: true \}\)/);
  assert.match(app, /paintBibleLive\(\{ partial: true \}\)/);
}

function testBibleGoLiveEnsuresProjector() {
  const app = read("app/app.js");
  assert.match(app, /function ensureLiveProjectorReady/);
  assert.match(app, /ensureLiveProjectorReady\(\)/);
  assert.match(app, /displayMode: "lyrics"/);
  assert.match(app, /sendLive\(\{ fromLiveSwitch: true \}\)/);
}

function testHymnGridClickUsesClosest() {
  const app = read("app/app.js");
  assert.match(app, /target\.closest\("\[data-song\]"\)/);
  assert.match(app, /hymn-index-card, \.hymn-index-list-row/);
}

function testSearchResultActionsNotBlocked() {
  const searchUi = read("app/hymn-search-ui.js");
  assert.match(searchUi, /highlightActiveResult/);
  assert.doesNotMatch(searchUi, /event\.stopPropagation\(\)/);
  assert.match(read("app/styles.css"), /\.search-result-card-wrap \.hymn-queue-actions/);
}

function testSortDropdownAndPartialIndexPaint() {
  const app = read("app/app.js");
  assert.match(app, /paintIndexCollection\(\)/);
  assert.match(read("app/styles.css"), /-webkit-appearance: menulist/);
}

function testLogoAndBackgroundModules() {
  const logo = loadModule("app/branding/church-logo-settings.js", {
    FileReader: class {
      readAsDataURL() {
        this.onload({ target: { result: "data:image/png;base64,abc" } });
      }
    },
  }).CISChurchLogoSettings;
  const bg = loadModule("app/presentation/projection-backgrounds.js").CISProjectionBackgrounds;
  assert.equal(logo.validateFile({ type: "image/png", size: 1000 }).ok, true);
  assert.equal(logo.validateFile({ type: "application/pdf", size: 1000 }).ok, false);
  assert.ok(bg.listBundled().length >= 5);
  assert.match(bg.resolveBackground({ backgroundId: "white" }).css, /fff/i);
}

function testPresenterOutputCustomLogoAndBackground() {
  const output = read("app/presenter-output.js");
  assert.match(output, /projector-custom-logo-image/);
  assert.match(output, /applyOutputBackground/);
  assert.match(read("app/presenter-engine.js"), /projectorBackgroundCss/);
}

function testEmergencyHelpDuplicatesRemoved() {
  const help = read("app/help/help-ui.js");
  const matches = help.match(/Show church logo/g) || [];
  assert.equal(matches.length, 1, "Emergency Help should expose one Show church logo action");
}

function testBibleSearchModeSelectorRegression() {
  const uiSource = read("app/bible/bible-live-ui.js");
  const appSource = normalizeSource(read("app/app.js"));
  assert.match(normalizeSource(uiSource), /updateSearchModeTabs/);
  assert.match(normalizeSource(uiSource), /data-bible-mode-tab/);
  assertSetSearchModeBindSpecialCase(assert, uiSource, "bible-live-ui.js");
  const bindBlock = normalizeSource(uiSource).match(
    /if\s*\(\s*command\s*===\s*"set-search-mode"\s*\)\s*\{[\s\S]*?return;\s*\}/,
  );
  assert.ok(bindBlock, "bindWorkspace must special-case set-search-mode");
  assert.match(bindBlock[0], /keydown/);
  const modeSwitchBlock = appSource.match(
    /if\s*\(\s*command\s*===\s*"set-search-mode"\s*\)\s*\{[\s\S]*?paintBibleLive\(\{ partial: true \}\)/,
  );
  assert.ok(modeSwitchBlock, "set-search-mode handler must exist");
  assert.match(modeSwitchBlock[0], /paintBibleLive\(\{ partial: true \}\)/);
  assert.doesNotMatch(modeSwitchBlock[0], /runBiblePhraseSearch/);
}

function run() {
  console.log("test:pilot-feedback-round1");
  testBibleLiveUiPartialUpdate();
  testBibleLiveBindsBeforePartialUpdate();
  testBibleInputDoesNotSearchOnKeystroke();
  testBibleGoLiveEnsuresProjector();
  testBibleSearchModeSelectorRegression();
  testHymnGridClickUsesClosest();
  testSearchResultActionsNotBlocked();
  testSortDropdownAndPartialIndexPaint();
  testLogoAndBackgroundModules();
  testPresenterOutputCustomLogoAndBackground();
  testEmergencyHelpDuplicatesRemoved();
  console.log("test:pilot-feedback-round1 — all assertions passed");
}

run();
