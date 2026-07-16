#!/usr/bin/env node
"use strict";

// Focused tests for the three P1 projection-reliability fixes:
//   A. No per-second full DOM rebuild of the presenter control/output.
//   B. Escape cannot close the live session from the projector window
//      without confirmation; commands route through controller guards.
//   C. Projector windows receive a state replay on open/reload.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function makeBroadcastStub() {
  const instances = [];
  class BroadcastChannelStub {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.posted = [];
      instances.push(this);
    }
    postMessage(message) {
      this.posted.push(message);
    }
    close() {}
  }
  return { BroadcastChannelStub, instances };
}

function loadPresenterScreen(options) {
  const { BroadcastChannelStub, instances } = makeBroadcastStub();
  const handlers = {};
  const rendered = [];
  const fullscreenCalls = [];

  const sandbox = {
    console,
    Date,
    Intl,
    window: null,
    document: {
      fullscreenElement: null,
      documentElement: { style: {} },
      body: { style: {} },
      getElementById: () => ({ id: "projectorRoot" }),
      exitFullscreen: () => Promise.resolve(),
    },
  };
  sandbox.window = {
    location: { origin: "file://" },
    opener: null,
    addEventListener: (type, handler) => {
      handlers[type] = handler;
    },
    electronAPI: options && options.electronAPI ? options.electronAPI : undefined,
  };
  sandbox.BroadcastChannel = BroadcastChannelStub;
  vm.createContext(sandbox);

  vm.runInContext(read("app/presenter-engine.js"), sandbox);
  sandbox.window.CISPresenterOutput = {
    configure() {},
    render(root, snapshot) {
      rendered.push(snapshot);
    },
    requestFullscreen(target) {
      fullscreenCalls.push(target);
    },
  };
  vm.runInContext(read("app/presenter-screen.js"), sandbox);

  return { sandbox, handlers, instances, rendered, fullscreenCalls };
}

function screenBus(instances) {
  // First channel created by presenter-screen.js itself.
  return instances[0];
}

function pressKey(handlers, key) {
  handlers.keydown({ key, preventDefault() {} });
}

function closeCommands(bus) {
  return bus.posted.filter(
    (msg) => msg.type === "presenter:command" && msg.command === "close-presenter",
  );
}

function testEscapeNormalMode() {
  const { handlers, instances } = loadPresenterScreen();
  const bus = screenBus(instances);

  pressKey(handlers, "Escape");
  assert.equal(closeCommands(bus).length, 0, "single Escape must not close the session");

  pressKey(handlers, "Escape");
  assert.equal(closeCommands(bus).length, 1, "second Escape within the window confirms close");

  pressKey(handlers, "Escape");
  assert.equal(closeCommands(bus).length, 1, "confirmation state resets after a close request");

  const stale = loadPresenterScreen();
  const staleBus = screenBus(stale.instances);
  const realNow = Date.now;
  try {
    let now = 1_000_000;
    Date.now = () => now;
    pressKey(stale.handlers, "Escape");
    now += 5_000; // beyond the 2s confirmation window
    pressKey(stale.handlers, "Escape");
    assert.equal(closeCommands(staleBus).length, 0, "slow double Escape must not close");
  } finally {
    Date.now = realNow;
  }
  console.log("  B1: Escape in normal mode — pass");
}

function testEscapeFullscreenMode() {
  const { sandbox, handlers, instances } = loadPresenterScreen();
  const bus = screenBus(instances);

  sandbox.document.fullscreenElement = { id: "projectorRoot" };
  pressKey(handlers, "Escape");
  pressKey(handlers, "Escape");
  assert.equal(closeCommands(bus).length, 0, "Escape in fullscreen never sends close");

  // Leaving fullscreen must not inherit an armed close from fullscreen presses.
  sandbox.document.fullscreenElement = null;
  pressKey(handlers, "Escape");
  assert.equal(closeCommands(bus).length, 0, "first Escape after fullscreen only arms");
  console.log("  B2: Escape in fullscreen mode — pass");
}

function testCommandsForwardedNotExecutedLocally() {
  const { handlers, instances } = loadPresenterScreen();
  const bus = screenBus(instances);

  pressKey(handlers, "ArrowRight");
  pressKey(handlers, "b");
  const commands = bus.posted.filter((msg) => msg.type === "presenter:command").map((msg) => msg.command);
  assert.deepEqual(commands, ["presenter-next", "emergency-black"], "keys forward commands to controller");

  const states = bus.posted.filter((msg) => msg.type === "presenter:state");
  assert.equal(states.length, 0, "output window must never broadcast its own inert state");
  console.log("  B3: output keys forward to controller, no local execution — pass");
}

function testElectronCommandPath() {
  const sent = [];
  const { handlers, instances } = loadPresenterScreen({
    electronAPI: {
      onPresenterState() {},
      sendPresenterCommand: (command) => sent.push(command),
    },
  });
  const bus = screenBus(instances);
  pressKey(handlers, "Escape");
  pressKey(handlers, "Escape");
  assert.deepEqual(sent, ["close-presenter"], "desktop app forwards via IPC");
  assert.equal(closeCommands(bus).length, 0, "no duplicate channel command when IPC is available");
  console.log("  B4: Electron IPC command path, no duplicates — pass");
}

function testLiveLockBlocksClose() {
  const sandbox = { console, window: {}, localStorage: undefined };
  vm.createContext(sandbox);
  vm.runInContext(read("app/presentation/live-lock-settings.js"), sandbox);
  vm.runInContext(read("app/presentation/live-lock-service.js"), sandbox);
  const service = sandbox.window.CISLiveLockService;
  service.configure({ loadSettings: () => ({ enabled: false }) });

  service.enable();
  assert.equal(service.isCommandBlocked("close-presenter"), true, "Live Lock blocks close-presenter");
  service.disable({ confirmed: true });
  assert.equal(service.isCommandBlocked("close-presenter"), false, "unlocked allows close-presenter");

  const appSource = read("app/app.js");
  assert.match(appSource, /onRemoteCommand:\s*\(command\)\s*=>\s*handleDesktopCommand\(command\)/,
    "projector commands route through handleDesktopCommand");
  assert.match(appSource, /CISLiveLockService\.isCommandBlocked\(command\)/,
    "handleCommand consults Live Lock");
  console.log("  B5: Live Lock mode blocks close-presenter — pass");
}

function testControllerRoutesRemoteCommands() {
  const { BroadcastChannelStub, instances } = makeBroadcastStub();
  const sandbox = { console, Date, Intl, window: {}, BroadcastChannel: BroadcastChannelStub };
  vm.createContext(sandbox);
  vm.runInContext(read("app/presenter-engine.js"), sandbox);
  const engine = sandbox.window.CISPresenterEngine;

  const received = [];
  engine.configure({
    currentPresenterItem: () => null,
    onRemoteCommand: (command) => received.push(command),
  });
  engine.publishState(); // creates the controller channel
  const channel = instances[0];
  channel.onmessage({ data: { type: "presenter:command", command: "close-presenter" } });
  assert.deepEqual(received, ["close-presenter"], "controller routes remote commands to the adapter");
  console.log("  B6: controller receives forwarded commands — pass");
}

function testStateReplayOnRequest() {
  const { BroadcastChannelStub, instances } = makeBroadcastStub();
  const sandbox = { console, Date, Intl, window: {}, BroadcastChannel: BroadcastChannelStub };
  vm.createContext(sandbox);
  vm.runInContext(read("app/presenter-engine.js"), sandbox);
  const engine = sandbox.window.CISPresenterEngine;
  engine.configure({ currentPresenterItem: () => null });

  engine.patchState({ active: true });
  const channel = instances[0];
  const before = channel.posted.filter((msg) => msg.type === "presenter:state").length;
  channel.onmessage({ data: { type: "presenter:request-state" } });
  const after = channel.posted.filter((msg) => msg.type === "presenter:state").length;
  assert.equal(after, before + 1, "active controller replays state on request");

  engine.patchState({ active: false });
  const idleBefore = channel.posted.filter((msg) => msg.type === "presenter:state").length;
  channel.onmessage({ data: { type: "presenter:request-state" } });
  const idleAfter = channel.posted.filter((msg) => msg.type === "presenter:state").length;
  assert.equal(idleAfter, idleBefore, "inactive engine stays silent on request");
  console.log("  C1: controller replays state to booting outputs — pass");
}

function testScreenRequestsStateOnBoot() {
  const { instances } = loadPresenterScreen();
  const bus = screenBus(instances);
  const requests = bus.posted.filter((msg) => msg.type === "presenter:request-state");
  assert.equal(requests.length, 1, "browser projector requests a state replay on boot");

  const electron = loadPresenterScreen({
    electronAPI: { onPresenterState() {}, sendPresenterCommand() {} },
  });
  const electronBus = screenBus(electron.instances);
  const electronRequests = electronBus.posted.filter((msg) => msg.type === "presenter:request-state");
  assert.equal(electronRequests.length, 0, "desktop projector relies on main-process replay instead");
  console.log("  C2: projector window boot handshake — pass");
}

function testMainProcessReplaySource() {
  const mainSource = read("src/main.js");
  assert.match(mainSource, /lastPresenterPayload = payload \|\| null;/, "main caches the last presenter payload");
  assert.match(mainSource, /did-finish-load/, "main replays after did-finish-load");
  assert.match(mainSource, /PRESENTER_OUTPUT_COMMANDS/, "main whitelists projector commands");
  const projectorFn = mainSource.slice(
    mainSource.indexOf("function createProjectorWindow"),
    mainSource.indexOf("ipcMain.handle('presenter:open'"),
  );
  assert.ok(projectorFn.includes("did-finish-load"), "replay listener attaches during projector window creation");
  assert.ok(projectorFn.includes("lastPresenterPayload"), "projector window creation replays the cached payload");

  const preloadSource = read("src/preload.js");
  assert.match(preloadSource, /sendPresenterCommand/, "preload exposes the command bridge");
  console.log("  C3: main-process replay + command bridge present — pass");
}

function testNoPerSecondRebuild() {
  const appSource = read("app/app.js");
  const intervalStart = appSource.indexOf("const presenterClockInterval");
  assert.ok(intervalStart > -1, "presenter clock interval exists");
  const intervalBlock = appSource.slice(intervalStart, appSource.indexOf("}, 1000);", intervalStart));
  assert.ok(!intervalBlock.includes("renderPresenterAV()"), "interval must not rebuild the control panel");
  assert.ok(!intervalBlock.includes("publishState()"), "interval must not publish unchanged state");
  assert.ok(!/\brender\(\)/.test(intervalBlock), "interval must not re-render the app view");
  assert.ok(intervalBlock.includes("updatePresenterClockText()"), "interval updates time text in place");

  const controlSource = read("app/presenter-control.js");
  assert.match(controlSource, /data-presenter-clock/, "control clock is updatable in place");
  assert.match(controlSource, /data-presenter-timer/, "control timer is updatable in place");
  assert.match(appSource, /data-presenter-dashboard-clock/, "dashboard clock is updatable in place");
  assert.match(appSource, /data-presenter-dashboard-timer/, "dashboard timer is updatable in place");
  console.log("  A1: no per-second DOM rebuild; in-place time updates — pass");
}

function testControlRenderStillWorks() {
  const sandbox = { console, Date, Intl, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read("app/presenter-control.js"), sandbox);
  const control = sandbox.window.CISPresenterControl;

  const root = {
    className: "",
    innerHTML: "",
    setAttribute() {},
  };
  control.render(root, {
    active: true,
    paused: false,
    displayMode: "lyrics",
    slideIndex: 0,
    slideCount: 3,
    slide: { label: "Verse 1", body: "Amazing grace" },
    clock: "10:00:00",
    timerRemaining: 300,
    timerRunning: false,
    canPrev: false,
    canNext: true,
  });
  assert.ok(root.innerHTML.includes("data-presenter-clock"), "rendered control exposes clock hook");
  assert.ok(root.innerHTML.includes("data-presenter-timer"), "rendered control exposes timer hook");
  assert.ok(root.innerHTML.includes("data-command=\"presenter-next\""), "transport controls intact");
  console.log("  A2: presenter control renders with in-place hooks — pass");
}

function run() {
  console.log("test:presenter-reliability");
  testNoPerSecondRebuild();
  testControlRenderStillWorks();
  testEscapeNormalMode();
  testEscapeFullscreenMode();
  testCommandsForwardedNotExecutedLocally();
  testElectronCommandPath();
  testLiveLockBlocksClose();
  testControllerRoutesRemoteCommands();
  testStateReplayOnRequest();
  testScreenRequestsStateOnBoot();
  testMainProcessReplaySource();
  console.log("test:presenter-reliability — all assertions passed");
}

run();
