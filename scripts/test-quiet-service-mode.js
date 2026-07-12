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

function loadQuietStack() {
  const sandbox = { window: {}, console, sessionStorage: { store: {} } };
  vm.createContext(sandbox);
  [
    "app/quiet-service-mode/notification-classifier.js",
    "app/quiet-service-mode/quiet-service-mode-settings.js",
    "app/quiet-service-mode/quiet-service-mode-service.js",
    "app/quiet-service-mode/quiet-service-mode-ui.js",
    "app/service-mode/service-mode-settings.js",
  ].forEach((file) => vm.runInContext(read(file), sandbox));
  return sandbox.window;
}

function run() {
  const modules = loadQuietStack();
  const {
    CISNotificationClassifier,
    CISQuietServiceModeSettings,
    CISQuietServiceModeService,
    CISQuietServiceModeUI,
  } = modules;

  assert.ok(CISNotificationClassifier, "notification classifier loads");
  assert.ok(CISQuietServiceModeService, "quiet service loads");

  const critical = CISNotificationClassifier.classifyNotice("Output disconnected from projector");
  assert.equal(critical.level, CISNotificationClassifier.LEVELS.critical);

  const important = CISNotificationClassifier.classifyNotice("Camera unavailable for preview");
  assert.equal(important.level, CISNotificationClassifier.LEVELS.important);

  const nonessential = CISNotificationClassifier.classifyNotice("Update 1.2.0 available");
  assert.equal(nonessential.level, CISNotificationClassifier.LEVELS.nonessential);

  let platformQuiet = null;
  let powerBlock = null;
  const session = [];

  CISQuietServiceModeService.configure({
    loadSettings: () => CISQuietServiceModeSettings.load(),
    saveSettings: () => {},
    saveSession: (payload) => session.push(payload),
    loadSession: () => null,
    setPlatformQuietMode: (enabled) => { platformQuiet = enabled; },
    setPowerBlocker: async (enabled) => { powerBlock = enabled; return { enabled }; },
  });

  assert.equal(CISQuietServiceModeService.getState().active, false);

  const enter = CISQuietServiceModeService.enter({ outputsActive: true });
  assert.equal(enter.ok, true);
  assert.equal(CISQuietServiceModeService.isActive(), true);
  assert.equal(platformQuiet, true);
  assert.ok(CISQuietServiceModeService.shouldPauseBackgroundTask(CISQuietServiceModeService.BACKGROUND_TASKS.indexing));

  const defer = CISQuietServiceModeService.evaluateNotice("Update available");
  assert.equal(defer.defer, true);

  const showCritical = CISQuietServiceModeService.evaluateNotice("Autosave failure — could not save worship plan");
  assert.equal(showCritical.defer, false);
  assert.equal(showCritical.level, "critical");

  const showImportant = CISQuietServiceModeService.evaluateNotice("Backup outdated");
  assert.equal(showImportant.defer, false);
  assert.equal(showImportant.unobtrusive, true);

  assert.equal(CISQuietServiceModeService.shouldDeferUpdateStatus("available"), true);
  assert.equal(CISQuietServiceModeService.shouldDeferUpdateStatus("error"), false);

  assert.equal(CISQuietServiceModeService.shouldBlockAdminPopup("check-updates"), true);
  assert.equal(CISQuietServiceModeService.shouldBlockAdminPopup("emergency-black"), false);

  CISQuietServiceModeService.queueNotice("Pack imported", "nonessential");
  assert.equal(CISQuietServiceModeService.getState().deferredCount, 1);

  const exit = CISQuietServiceModeService.exit();
  assert.equal(exit.ok, true);
  assert.equal(CISQuietServiceModeService.isActive(), false);
  assert.equal(platformQuiet, false);

  const settings = CISQuietServiceModeSettings.save(
    { autoEnterWithServiceMode: "ask" },
    (key, value) => assert.equal(key, CISQuietServiceModeSettings.STORAGE_KEY),
  );
  assert.equal(settings.autoEnterWithServiceMode, "ask");

  const autoNever = CISQuietServiceModeSettings.load(() => ({ autoEnterWithServiceMode: "never" }));
  assert.equal(autoNever.autoEnterWithServiceMode, "never");

  CISQuietServiceModeService.configure({
    loadSettings: () => ({ autoEnterWithServiceMode: "always" }),
    saveSession: () => {},
    loadSession: () => null,
  });
  const autoDecision = CISQuietServiceModeService.shouldAutoEnterWithServiceMode();
  assert.equal(autoDecision.enter, true);

  const banner = CISQuietServiceModeUI.renderStatusBanner(true, 2);
  assert.match(banner, /QUIET SERVICE MODE ACTIVE/);
  assert.match(banner, /quiet-service-mode-exit/);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupQuietServiceMode/);
  assert.match(appSource, /quiet-service-mode-enter/);
  assert.match(appSource, /quiet-service-mode-exit/);
  assert.match(appSource, /maybeOfferQuietServiceModeOnServiceEnter/);
  const uiSource = read("app/quiet-service-mode/quiet-service-mode-ui.js");
  assert.match(uiSource, /QUIET SERVICE MODE ACTIVE/);
  assert.match(appSource, /Enter Quiet Service Mode/);
  assert.match(appSource, /Enter Service Mode/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /quiet-service-mode/);
  assert.match(indexHtml, /topbarQuietServiceModeBtn/);
  assert.match(indexHtml, /quietServiceModeRoot/);

  const presenterOutput = read("app/presenter-output.js");
  assert.ok(!presenterOutput.includes("data-command"), "congregation output has no operator controls");

  const presenterScreen = read("app/presenter-screen.js");
  assert.match(presenterScreen, /cursor = "none"/);

  const updaterSource = read("src/updater.js");
  assert.match(updaterSource, /setQuietMode/);
  assert.match(updaterSource, /quietModeActive/);

  const mainSource = read("src/main.js");
  assert.match(mainSource, /powerSaveBlocker/);
  assert.match(mainSource, /quiet-mode:set-power-blocker/);

  const preloadSource = read("src/preload.js");
  assert.match(preloadSource, /quietMode/);

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v43/);
  assert.match(sw, /quiet-service-mode-service\.js/);

  const styles = read("app/styles.css");
  assert.match(styles, /quiet-service-mode-banner/);
  assert.match(styles, /quiet-reduce-motion/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:quiet-service-mode"]);

  console.log("test:quiet-service-mode — all assertions passed");
}

run();
