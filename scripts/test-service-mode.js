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
  const settingsWin = loadModule("app/service-mode/service-mode-settings.js");
  const uiWin = loadModule("app/service-mode/service-mode-ui.js");
  const serviceWin = loadModule("app/service-mode/service-mode-service.js", {
    window: { CISServiceModeSettings: settingsWin.CISServiceModeSettings },
  });

  const service = serviceWin.CISServiceModeService;
  const ui = uiWin.CISServiceModeUI;
  const settings = settingsWin.CISServiceModeSettings;

  ui.configure({ escapeHtml: (v) => String(v || "") });

  let role = "operator";
  let presentationActive = false;
  const session = [];

  service.configure({
    getRole: () => role,
    isPresentationActive: () => presentationActive,
    saveSession: (payload) => session.push(payload),
    loadSession: () => null,
    loadSettings: () => settings.load(),
  });

  assert.equal(service.getState().active, false);
  assert.equal(service.canAccessAdmin(), false);

  role = "admin";
  assert.equal(service.canAccessAdmin(), true);
  role = "operator";

  const entered = service.enter({ previousView: "presenter" });
  assert.equal(entered.ok, true);
  assert.equal(service.getState().active, true);

  const workspace = ui.renderWorkspace({
    appName: "VaChinoda Worship App",
    live: { type: "hymn", title: "Hymn 051", position: "Stanza 1", destinations: "Local projector" },
    preview: { title: "Hymn 108", meta: "Preview", layout: "Hymn slides", destinations: "Preview only", status: "Ready" },
    next: { title: "Hymn 120", meta: "Next", status: "Ready", takeCommand: "hymn-take-next" },
    queue: [{ title: "Hymn 200", meta: "Queued" }],
    status: { projectorStatus: "active", projectorDetail: "Active", stageStatus: "ready", stageDetail: "Stage", obsEnabled: true, obsStatus: "connected", obsDetail: "Connected" },
  });

  assert.match(workspace, /SERVICE MODE/);
  assert.match(workspace, /Currently Live/);
  assert.match(workspace, /Preview/);
  assert.match(workspace, /Next/);
  assert.match(workspace, /Emergency controls/);
  assert.match(workspace, /data-command="emergency-clear"/);
  assert.match(workspace, /data-command="emergency-black"/);
  assert.match(workspace, /data-command="hymn-restore-previous"/);
  assert.match(workspace, /data-command="service-mode-exit"/);
  assert.match(workspace, /Hymn Search/);
  assert.match(workspace, /Bible Search/);
  assert.match(workspace, /aria-label="Service Mode workspace"/);

  const emergency = ui.renderEmergencyStrip();
  assert.match(emergency, /Clear/);
  assert.match(emergency, /Blackout/);
  assert.match(emergency, /Emergency Help/);

  presentationActive = true;
  const blocked = service.exit();
  assert.equal(blocked.ok, false);
  assert.equal(blocked.needsConfirm, true);

  const confirmed = service.exit({ confirmed: true });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.previousView, "presenter");
  assert.equal(service.getState().active, false);

  service.enter({ previousView: "home" });
  assert.equal(service.isCommandAllowed("hymn-take-next"), true);
  assert.equal(service.isCommandAllowed("delete-hymnal-edition"), false);
  role = "admin";
  assert.equal(service.isCommandAllowed("delete-hymnal-edition"), false);
  service.exit({ force: true });

  const restoreWin = loadModule("app/service-mode/service-mode-service.js", {
    window: { CISServiceModeSettings: settingsWin.CISServiceModeSettings },
  });
  const restoreService = restoreWin.CISServiceModeService;
  restoreService.configure({
    getRole: () => "operator",
    isPresentationActive: () => false,
    saveSession: () => {},
    loadSession: () => ({ active: true, previousView: "presenter", enteredAt: Date.now(), sessionRestored: false }),
    loadSettings: () => settings.load(),
  });
  assert.equal(restoreService.getState().active, true);
  assert.equal(restoreService.getState().pendingRestoreConfirm, true);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupServiceMode/);
  assert.match(appSource, /service-mode-enter/);
  assert.match(appSource, /service-mode-exit/);
  assert.match(appSource, /service-mode-active/);
  assert.match(appSource, /isCommandAllowed/);
  assert.match(appSource, /renderServiceModeContextBar/);
  assert.match(appSource, /buildServiceModeLiveContext/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /service-mode-service\.js/);
  assert.match(indexHtml, /service-mode-ui\.js/);
  assert.match(indexHtml, /topbarServiceModeBtn/);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  assert.match(indexHtml, /styles\.css\?v=37/);
=======
  assert.match(indexHtml, /styles\.css\?v=36/);
>>>>>>> ac027c6 (Add Service Mode so worship operators can run live services from a touch-friendly workspace with live, preview, and next context tied to hymn queue, Bible projection, and emergency output controls.)
=======
  assert.match(indexHtml, /styles\.css\?v=41/);
>>>>>>> 8117b1f (Add Quiet Service Mode to suppress background interruptions during live worship while preserving autosave, recovery, and critical alerts.)
=======
  assert.match(indexHtml, /styles\.css\?v=38/);
>>>>>>> 1f16699 (Improve worship app responsiveness with debounced search, cancellation, and resource cleanup.)
=======
  assert.match(indexHtml, /styles\.css\?v=39/);
>>>>>>> 1e7c418 (Improve operator UI consistency with control hierarchy, status strip, and terminology.)
=======
  assert.match(indexHtml, /styles\.css\?v=40/);
>>>>>>> e584b20 (Unify projection rendering so hymn, Bible, and OBS congregation outputs share themes, layout, and text fitting for readable slides on any screen.)
=======
  assert.match(indexHtml, /styles\.css\?v=42/);
>>>>>>> feddf9c (Add configurable keyboard shortcuts, touch-friendly live controls, and accessibility improvements for faster worship operation.)
=======
  assert.match(indexHtml, /styles\.css\?v=43/);
>>>>>>> da01d1b (Add unified Worship Search so operators can find hymns, Scripture, service items, and media from one place during live worship.)
=======
  assert.match(indexHtml, /styles\.css\?v=44/);
>>>>>>> ad24e9c (Add Stage Display so worship leaders and musicians can monitor live lyrics, Scripture, and cues on a private screen without changing congregation projection.)

  const styles = read("app/styles.css");
  assert.match(styles, /\.service-mode-trio/);
  assert.match(styles, /\.service-touch-btn/);
  assert.match(styles, /\.service-emergency-strip/);
  assert.match(styles, /body\.service-mode-active/);

  const sw = read("app/sw.js");
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  assert.match(sw, /christ-in-song-worship-v37/);
=======
  assert.match(sw, /christ-in-song-worship-v36/);
>>>>>>> ac027c6 (Add Service Mode so worship operators can run live services from a touch-friendly workspace with live, preview, and next context tied to hymn queue, Bible projection, and emergency output controls.)
=======
  assert.match(sw, /christ-in-song-worship-v41/);
>>>>>>> 8117b1f (Add Quiet Service Mode to suppress background interruptions during live worship while preserving autosave, recovery, and critical alerts.)
=======
  assert.match(sw, /christ-in-song-worship-v38/);
>>>>>>> 1f16699 (Improve worship app responsiveness with debounced search, cancellation, and resource cleanup.)
=======
  assert.match(sw, /christ-in-song-worship-v39/);
>>>>>>> 1e7c418 (Improve operator UI consistency with control hierarchy, status strip, and terminology.)
=======
  assert.match(sw, /christ-in-song-worship-v40/);
>>>>>>> e584b20 (Unify projection rendering so hymn, Bible, and OBS congregation outputs share themes, layout, and text fitting for readable slides on any screen.)
=======
  assert.match(sw, /christ-in-song-worship-v42/);
>>>>>>> feddf9c (Add configurable keyboard shortcuts, touch-friendly live controls, and accessibility improvements for faster worship operation.)
=======
  assert.match(sw, /christ-in-song-worship-v43/);
>>>>>>> da01d1b (Add unified Worship Search so operators can find hymns, Scripture, service items, and media from one place during live worship.)
=======
  assert.match(sw, /christ-in-song-worship-v44/);
>>>>>>> ad24e9c (Add Stage Display so worship leaders and musicians can monitor live lyrics, Scripture, and cues on a private screen without changing congregation projection.)
  assert.match(sw, /service-mode-service\.js/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:service-mode"], "package.json should define test:service-mode");

  console.log("test-service-mode: all assertions passed");
}

run();
