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

function fakeEvent(binding, platform) {
  const reg = loadModule("app/keyboard/keyboard-shortcuts-registry.js").CISKeyboardShortcutsRegistry;
  const parsed = reg.parseBinding(binding);
  const isMac = platform === "darwin";
  return {
    key: parsed.key === "space" ? " " : parsed.key === "bracketleft" ? "[" : parsed.key === "bracketright" ? "]" : parsed.key,
    shiftKey: parsed.shift,
    altKey: parsed.alt,
    ctrlKey: parsed.ctrl || (!isMac && parsed.mod),
    metaKey: parsed.meta || (isMac && parsed.mod),
    preventDefault() {},
  };
}

function run() {
  const regWin = loadModule("app/keyboard/keyboard-shortcuts-registry.js");
  const settingsWin = loadModule("app/keyboard/keyboard-shortcuts-settings.js");
  const serviceWin = loadModule("app/keyboard/keyboard-shortcuts-service.js", {
    window: {
      CISKeyboardShortcutsRegistry: regWin.CISKeyboardShortcutsRegistry,
      CISKeyboardShortcutsSettings: settingsWin.CISKeyboardShortcutsSettings,
    },
  });
  const uiWin = loadModule("app/keyboard/keyboard-shortcuts-ui.js", {
    window: {
      CISKeyboardShortcutsRegistry: regWin.CISKeyboardShortcutsRegistry,
      CISKeyboardShortcutsService: serviceWin.CISKeyboardShortcutsService,
    },
  });
  const focusWin = loadModule("app/accessibility/focus-manager.js");

  const reg = regWin.CISKeyboardShortcutsRegistry;
  const service = serviceWin.CISKeyboardShortcutsService;
  const ui = uiWin.CISKeyboardShortcutsUI;
  const focus = focusWin.CISFocusManager;

  assert.ok(reg.ACTIONS.length >= 20, "registry defines operator shortcuts");
  assert.ok(reg.getAction("presenter-next"), "next stanza action exists");
  assert.ok(reg.getAction("emergency-black"), "blackout action exists");
  assert.ok(reg.getAction("global-search"), "global search action exists");

  const defaults = {};
  reg.ACTIONS.forEach((action) => {
    if (!action.aliasOf && action.defaultBinding) defaults[action.id] = action.defaultBinding;
  });
  const defaultConflicts = reg.detectConflicts(defaults);
  const nonAliasConflicts = defaultConflicts.filter((item) => !item.actionIds.every((id) => {
    const action = reg.getAction(id);
    return action?.aliasOf;
  }));
  assert.equal(nonAliasConflicts.length, 0, `default bindings should not conflict: ${JSON.stringify(nonAliasConflicts)}`);

  let handled = [];
  service.configure({
    bindings: {},
    platform: "darwin",
    getContext: () => ({
      presenterActive: true,
      emergencyMode: false,
      bibleLive: false,
      hasSelection: true,
      searchView: false,
      mediaLoaded: true,
    }),
    onAction: (actionId) => {
      handled.push(actionId);
      return { handled: true };
    },
  });

  assert.ok(service.handleEvent(fakeEvent("space", "darwin")), "space advances slides in presenter context");
  assert.deepEqual(handled, ["presenter-next"]);

  handled = [];
  assert.ok(service.handleEvent(fakeEvent("shift+space", "darwin")), "shift+space goes to previous slide");
  assert.deepEqual(handled, ["presenter-prev"]);

  handled = [];
  const typingInput = { tagName: "INPUT", type: "search", id: "globalSearchInput", isContentEditable: false };
  assert.equal(
    service.handleEvent({ ...fakeEvent("c", "darwin"), target: typingInput }),
    false,
    "typing guard blocks global shortcuts",
  );

  handled = [];
  assert.ok(
    service.handleEvent({ ...fakeEvent("enter", "darwin"), target: typingInput }),
    "enter allowed in search field for preview",
  );
  assert.deepEqual(handled, ["load-preview"]);

  const blocked = service.setBinding("emergency-black", "mod+k");
  assert.ok(blocked.conflicts.length >= 1, "duplicate bindings are detected");

  const panel = ui.renderSettingsPanel(service.getState());
  assert.match(panel, /Keyboard Shortcut Settings/);
  assert.match(panel, /data-shortcut-action="global-search"/);

  const reference = ui.renderReferencePanel(service.getState(), "blackout");
  assert.match(reference, /Blackout/);
  assert.match(reference, /Emergency/);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupKeyboardShortcuts/);
  assert.match(appSource, /showChorusSlide/);
  assert.match(appSource, /bindKeyboardShortcutPanels/);
  assert.match(appSource, /hymn-queue-top/);
  assert.match(appSource, /move-slot-top/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /keyboard-shortcuts-registry\.js/);
  assert.match(indexHtml, /a11yAnnounce/);
  assert.match(indexHtml, /styles\.css\?v=46/);

  const styles = read("app/styles.css");
  assert.match(styles, /\.live-touch-btn/);
  assert.match(styles, /min-height: 48px/);

  const presenter = read("app/presenter-control.js");
  assert.match(presenter, /aria-label="Black screen"/);
  assert.match(presenter, /aria-pressed/);

  const serviceMode = read("app/service-mode/service-mode-ui.js");
  assert.match(serviceMode, /hymn-queue-top/);
  assert.match(serviceMode, /aria-label="Emergency controls"/);

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v46/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:keyboard-shortcuts"]);

  assert.equal(typeof focus.rememberFocus, "function");
  assert.equal(typeof focus.trapFocus, "function");
  assert.equal(typeof focus.announce, "function");

  console.log("test:keyboard-shortcuts — all assertions passed");
}

run();
