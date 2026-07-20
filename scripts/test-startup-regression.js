#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    loadJson(key, fallback = null) {
      if (!Object.prototype.hasOwnProperty.call(store, key)) return fallback;
      const raw = store[key];
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    },
    saveJson(key, value) {
      store[key] = JSON.stringify(value);
    },
  };
}

function testAppJsParses() {
  const result = spawnSync(process.execPath, ["--check", path.join(ROOT, "app/app.js")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `app/app.js must parse cleanly: ${result.stderr || result.stdout}`);
  const source = read("app/app.js");
  assert.match(source, /function setupBible\(\)/, "setupBible must remain defined for startup");
}

function testCleanProfileSettingsLoad() {
  const storage = makeStorage();
  const logo = loadModule("app/branding/church-logo-settings.js").CISChurchLogoSettings;
  const projection = loadModule("app/presentation/projection-settings.js").CISProjectionSettings;
  const loadedLogo = logo.load(storage.loadJson);
  const loadedProjection = projection.load(storage.loadJson);
  assert.deepEqual(loadedLogo, logo.DEFAULTS);
  assert.equal(loadedProjection.backgroundId, "black");
}

function testSavedLogoAndBackgroundSettingsLoad() {
  const storage = makeStorage({
    churchLogoSettings: JSON.stringify({
      imageDataUrl: "data:image/png;base64,abcd",
      fileName: "sanctuary.png",
      updatedAt: 1,
    }),
    projectionSettings: JSON.stringify({
      backgroundId: "white",
      customBackgroundDataUrl: "",
      themeId: "classic_dark",
    }),
  });
  const logo = loadModule("app/branding/church-logo-settings.js").CISChurchLogoSettings;
  const projection = loadModule("app/presentation/projection-settings.js").CISProjectionSettings;
  const loadedLogo = logo.load(storage.loadJson);
  const loadedProjection = projection.load(storage.loadJson);
  assert.equal(loadedLogo.fileName, "sanctuary.png");
  assert.match(loadedLogo.imageDataUrl, /^data:image\/png;/);
  assert.equal(loadedProjection.backgroundId, "white");
}

function testCorruptSettingsDoNotBlockStartup() {
  const storage = makeStorage({
    churchLogoSettings: "{not-json",
    projectionSettings: JSON.stringify({
      backgroundId: "custom",
      customBackgroundDataUrl: "not-a-data-url",
      customBackgroundName: 42,
    }),
  });
  const logo = loadModule("app/branding/church-logo-settings.js").CISChurchLogoSettings;
  const projection = loadModule("app/presentation/projection-settings.js").CISProjectionSettings;
  assert.doesNotThrow(() => logo.load(storage.loadJson));
  assert.doesNotThrow(() => projection.load(storage.loadJson));
  const loadedLogo = logo.load(storage.loadJson);
  const loadedProjection = projection.load(storage.loadJson);
  assert.equal(loadedLogo.imageDataUrl, "");
  assert.equal(loadedProjection.backgroundId, "black");
  assert.equal(loadedProjection.customBackgroundDataUrl, "");
}

function testOversizedOrInvalidAssetsFallback() {
  const storage = makeStorage({
    churchLogoSettings: JSON.stringify({
      imageDataUrl: `data:image/png;base64,${"A".repeat(logoMaxChars() + 1)}`,
      fileName: "huge.png",
    }),
    projectionSettings: JSON.stringify({
      backgroundId: "custom",
      customBackgroundDataUrl: `data:image/jpeg;base64,${"B".repeat(8 * 1024 * 1024)}`,
      customBackgroundName: "wallpaper.jpg",
    }),
  });
  const logo = loadModule("app/branding/church-logo-settings.js").CISChurchLogoSettings;
  const projection = loadModule("app/presentation/projection-settings.js").CISProjectionSettings;
  const loadedLogo = logo.load(storage.loadJson);
  const loadedProjection = projection.load(storage.loadJson);
  assert.equal(loadedLogo.imageDataUrl, "");
  assert.equal(loadedProjection.backgroundId, "black");
}

function logoMaxChars() {
  const logo = loadModule("app/branding/church-logo-settings.js").CISChurchLogoSettings;
  return logo.MAX_BYTES * 2 + 256;
}

function testStartupModulesImportCleanly() {
  loadModule("app/presentation/projection-backgrounds.js");
  loadModule("app/branding/church-logo-ui.js");
}

function run() {
  console.log("test:startup-regression");
  testAppJsParses();
  testCleanProfileSettingsLoad();
  testSavedLogoAndBackgroundSettingsLoad();
  testCorruptSettingsDoNotBlockStartup();
  testOversizedOrInvalidAssetsFallback();
  testStartupModulesImportCleanly();
  console.log("test:startup-regression — all assertions passed");
}

run();
