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
  const sandbox = { window: {}, console, setTimeout, clearTimeout, ...(extraSandbox || {}) };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function run() {
  const settingsWin = loadModule("app/stage-display/stage-display-settings.js");
  const settings = settingsWin.CISStageDisplaySettings;
  assert.ok(settings.LAYOUTS["current-and-next"], "current-and-next layout exists");
  assert.ok(settings.LAYOUTS.preacher.modules.includes("currentBibleVerse"), "preacher layout includes bible verse");
  assert.equal(settings.activeModules({ layoutId: "countdown" }).length, 3, "countdown layout modules");

  const engineWin = loadModule("app/stage-display/stage-display-engine.js", {
    window: {
      CISStageDisplaySettings: settingsWin.CISStageDisplaySettings,
      setInterval: () => 0,
      clearInterval: () => {},
    },
  });
  const engine = engineWin.CISStageDisplayEngine;

  const worshipContext = {
    currentHymn: { number: "051", title: "Lead Me Gently Home" },
    currentStanza: { label: "Stanza 2", body: "Lead me gently home, Father" },
    nextStanza: { label: "Chorus", body: "Lead me with a tender hand" },
    currentBible: { reference: "John 3:16", text: "For God so loved the world", translation: "KJV" },
    nextBible: { reference: "John 3:17", text: "For God sent not his Son", translation: "KJV" },
    currentServiceItem: { title: "Bible Reading", role: "Scripture", meta: "John 3:16" },
    nextServiceItem: { title: "Offering", role: "Offering Hymn", meta: "Hymn 34" },
    status: {
      camera: { label: "Main camera", detail: "Active feed", status: "live" },
      mic: { label: "Muted", detail: "Operator mic", status: "muted" },
      recording: { label: "Recording", detail: "OBS recording active", status: "active" },
      streaming: { label: "Streaming", detail: "OBS stream live", status: "live" },
    },
  };

  const storedSettings = settings.load();
  engine.configure({
    loadSettings: () => storedSettings,
    saveSettings: (patch) => {
      Object.assign(storedSettings, patch || {});
    },
    getWorshipContext: () => worshipContext,
  });

  engine.patchState({
    active: true,
    connected: true,
    sermonTitle: "Amazing Grace",
    speakerName: "Pastor Smith",
    countdownPausedRemaining: 125,
    countdownRunning: false,
    countdownLabel: "Remaining",
  });

  const snapshot = engine.buildSnapshot();
  assert.equal(snapshot.layout, "current-and-next");
  assert.equal(snapshot.blocks.currentHymnStanza.title, "Hymn 051 · Lead Me Gently Home");
  assert.equal(snapshot.blocks.nextHymnStanza.title, "Chorus");
  assert.equal(snapshot.blocks.currentBibleVerse.title, "John 3:16");
  assert.equal(snapshot.blocks.nextServiceItem.title, "Offering");
  engine.saveSettings({ layoutId: "countdown" });
  const countdownSnapshot = engine.buildSnapshot();
  assert.equal(countdownSnapshot.blocks.countdown.title, "02:05");

  const outputWin = loadModule("app/stage-display/stage-display-output.js");
  const html = outputWin.CISStageDisplayOutput.render(snapshot);
  assert.match(html, /Stage Display/);
  assert.match(html, /Hymn 051/);
  assert.match(html, /Chorus/);
  assert.match(html, /John 3:16/);
  assert.ok(!html.includes("data-command"), "stage output has no operator controls");

  const serviceWin = loadModule("app/stage-display/stage-display-service.js", {
    window: {
      CISStageDisplaySettings: settingsWin.CISStageDisplaySettings,
      CISStageDisplayEngine: engineWin.CISStageDisplayEngine,
      setInterval: () => 0,
      clearInterval: () => {},
    },
  });
  const service = serviceWin.CISStageDisplayService;
  service.configure({
    loadSettings: () => storedSettings,
    saveSettings: (patch) => Object.assign(storedSettings, patch || {}),
    getWorshipContext: () => worshipContext,
  });

  const sent = service.sendPrivateMessage("Five minutes remaining");
  assert.equal(sent.ok, true);
  const withMessage = engine.buildSnapshot();
  assert.equal(withMessage.privateMessage.text, "Five minutes remaining");

  service.dismissPrivateMessage();
  assert.equal(engine.buildSnapshot().privateMessage, null);

  service.startCountdown(90);
  assert.ok(engine.getState().countdownRunning, "countdown starts");
  service.pauseCountdown();
  assert.equal(engine.getState().countdownRunning, false, "countdown pauses");
  service.adjustCountdown(30);
  assert.ok(engine.countdownRemaining() >= 30, "countdown adjusts");
  service.resetCountdown(120);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupStageDisplay/);
  assert.match(appSource, /getStageDisplayWorshipContext/);
  assert.match(appSource, /stage-display-open/);
  assert.match(appSource, /Congregation outputs unchanged/);
  assert.match(appSource, /stage-display-send-message/);
  assert.doesNotMatch(appSource, /stage-display-open[\s\S]{0,200}present-current/, "opening stage display does not send live");

  const mainSource = read("src/main.js");
  assert.match(mainSource, /stage-display:open/);
  assert.match(mainSource, /stage-display:restart/);
  assert.match(mainSource, /display-removed/);

  const preloadSource = read("src/preload.js");
  assert.match(preloadSource, /stageDisplay:/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /stage-display-engine\.js/);
  assert.match(indexHtml, /styles\.css\?v=44/);

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v44/);
  assert.match(sw, /stage-display-screen\.html/);

  const screenSource = read("app/stage-display/stage-display-screen.js");
  assert.match(screenSource, /cis-stage-display-v1/);
  assert.ok(!screenSource.includes("CISPresenterEngine"), "stage screen independent from presenter engine");

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:stage-display"]);

  console.log("test:stage-display — all assertions passed");
}

run();
