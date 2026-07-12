#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function loadMonitorLogic() {
  const source = fs.readFileSync(path.join(ROOT, "app/obs/obs-program-monitor.js"), "utf8");
  const sandbox = {
    window: {
      CISObsEventService: { subscribe() {} },
      CISObsConstants: { CONNECTION_STATES: { CONNECTING: "connecting", RECONNECTING: "reconnecting" } },
      localStorage: {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, value) { this._data[key] = value; },
      },
      clearTimeout() {},
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      setInterval() { return 0; },
      clearInterval() {},
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.CISObsProgramMonitor;
}

function loadUiSource() {
  return fs.readFileSync(path.join(ROOT, "app/obs/obs-program-monitor-ui.js"), "utf8");
}

function run() {
  const monitor = loadMonitorLogic();

  assert.ok(monitor.isObsVirtualCamera({ kind: "videoinput", label: "OBS Virtual Camera" }));
  assert.equal(monitor.isObsVirtualCamera({ kind: "videoinput", label: "FaceTime HD Camera" }), false);

  const devices = [
    { kind: "videoinput", deviceId: "a", label: "FaceTime HD Camera" },
    { kind: "videoinput", deviceId: "b", label: "OBS Virtual Camera" },
  ];
  const obsCam = monitor.findObsVirtualCamera(devices);
  assert.equal(obsCam.deviceId, "b");

  const worship = monitor.getWorshipOutputLabels(
    { active: true, paused: false, displayMode: "lyrics" },
    { title: "Hymn 42 · Amazing Grace" },
  );
  assert.equal(worship.worshipLiveActive, true);
  assert.match(worship.worshipLive, /Amazing Grace/);

  const previewOnly = monitor.getWorshipOutputLabels(
    { active: true, paused: true, displayMode: "lyrics" },
    { title: "Prepared hymn" },
  );
  assert.equal(previewOnly.worshipLiveActive, false);

  assert.equal(monitor.SNAPSHOT_INTERVAL_MS >= 3000, true, "snapshot polling should be low-rate");

  const uiSource = loadUiSource();
  assert.ok(uiSource.includes("Snapshot Preview"), "snapshot mode must be labeled");
  assert.ok(uiSource.includes("Viewer Return Monitor"), "viewer return placeholder required");
  assert.ok(uiSource.includes("muted"), "video element should be muted");
  assert.ok(uiSource.includes("obs-monitor-start"), "start monitor control required");
  assert.ok(uiSource.includes("obs-monitor-stop"), "stop monitor control required");
  assert.ok(uiSource.includes("audio: false") === false, "UI file should not enable monitor audio");

  const monitorSource = fs.readFileSync(path.join(ROOT, "app/obs/obs-program-monitor.js"), "utf8");
  assert.ok(monitorSource.includes("audio: false"), "getUserMedia must not request audio");
  assert.ok(monitorSource.includes("stopMonitor"), "explicit stop required");
  assert.ok(monitorSource.includes("releaseStream"), "video tracks must be released");
  assert.ok(monitorSource.includes("snapshotInFlight"), "prevent overlapping screenshot requests");
  assert.ok(monitorSource.includes("stopSnapshotPolling"), "snapshot polling cleanup required");
  assert.ok(monitorSource.includes("GetSourceScreenshot"), "snapshot fallback uses OBS screenshot API");
  assert.ok(!monitorSource.includes("startStream"), "monitor must not auto-start streaming");

  const appSource = fs.readFileSync(path.join(ROOT, "app/app.js"), "utf8");
  assert.ok(appSource.includes("obs-monitor-stop"), "app wires stop monitor command");
  assert.ok(appSource.includes("obs-monitor-detach"), "detach monitor command wired");
  assert.ok(!appSource.match(/obs-monitor-stop[\s\S]{0,120}stopStream/), "closing monitor must not stop stream");

  const mainSource = fs.readFileSync(path.join(ROOT, "src/main.js"), "utf8");
  assert.ok(mainSource.includes("obs-monitor:open"), "detachable monitor window IPC required");
  assert.ok(mainSource.includes("alwaysOnTop: true"), "detachable monitor should stay on top");

  const styles = fs.readFileSync(path.join(ROOT, "app/styles.css"), "utf8");
  assert.ok(styles.includes("@media (max-width: 1100px)"), "responsive monitor layout required");

  const indexHtml = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  assert.ok(indexHtml.includes("obs-program-monitor.js"), "monitor module loaded in shell");

  console.log("test-obs-program-monitor: all checks passed");
}

run();
