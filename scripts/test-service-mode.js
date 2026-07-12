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
  assert.match(indexHtml, /styles\.css\?v=38/);

  const styles = read("app/styles.css");
  assert.match(styles, /\.service-mode-trio/);
  assert.match(styles, /\.service-touch-btn/);
  assert.match(styles, /\.service-emergency-strip/);
  assert.match(styles, /body\.service-mode-active/);

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v38/);
  assert.match(sw, /service-mode-service\.js/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:service-mode"], "package.json should define test:service-mode");

  console.log("test-service-mode: all assertions passed");
}

run();
