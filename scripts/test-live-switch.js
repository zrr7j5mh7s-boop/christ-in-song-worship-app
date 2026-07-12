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

async function run() {
  const modelWin = loadModule("app/presentation/presentation-state-model.js");
  const switchSettingsWin = loadModule("app/presentation/live-switch-settings.js");
  const lockSettingsWin = loadModule("app/presentation/live-lock-settings.js");
  const switchWin = loadModule("app/presentation/live-switch-service.js", {
    window: {
      CISPresentationStateModel: modelWin.CISPresentationStateModel,
      CISLiveSwitchSettings: switchSettingsWin.CISLiveSwitchSettings,
    },
  });
  const lockWin = loadModule("app/presentation/live-lock-service.js", {
    window: { CISLiveLockSettings: lockSettingsWin.CISLiveLockSettings },
  });
  const lockUiWin = loadModule("app/presentation/live-lock-ui.js");
  const bibleWin = loadModule("app/bible/bible-projection-service.js", {
    window: {
      CISLiveSwitchService: switchWin.CISLiveSwitchService,
      CISBibleReferenceParser: {
        parseReference: (text) => (text === "John 3:16"
          ? { ok: true, parsed: { bookOrder: 43, chapter: 3, verseStart: 16, referenceLabel: "John 3:16" } }
          : { ok: false, error: "Reference not found." }),
        formatReferenceLabel: () => "John 3:16",
      },
      CISBibleStore: {
        loadBook: async () => ({ meta: { name: "John" } }),
        getChapter: () => ({ verses: [{ verse: 16, text: "For God so loved the world." }] }),
        getBookMeta: () => ({ name: "John" }),
        getTranslationMeta: () => ({ code: "KJV", label: "KJV" }),
        chapterCount: () => 21,
      },
    },
  });

  const model = modelWin.CISPresentationStateModel;
  const liveSwitch = switchWin.CISLiveSwitchService;
  const liveLock = lockWin.CISLiveLockService;
  const bible = bibleWin.CISBibleProjectionService;

  assert.equal(model.labelForPhase(model.PHASE.PREVIEW), "Preview");
  assert.equal(model.isExplicitLiveAction("hymn-take-next"), true);
  assert.equal(model.isPreviewOnlyAction("hymn-preview"), true);

  let liveApplies = 0;
  let captured = null;
  liveSwitch.configure({
    prepareContent: async (descriptor) => {
      if (descriptor.type === "hymn" && descriptor.songKey === "missing:001") {
        return { ok: false, message: "Hymn lyrics are missing. Current Live output is unchanged." };
      }
      return { ok: true, staging: { type: descriptor.type, ready: true, songKey: descriptor.songKey } };
    },
    applyLive: async (descriptor) => {
      liveApplies += 1;
      if (descriptor.type === "hymn" && descriptor.songKey === "fail:001") {
        return { ok: false, message: "Transition failed." };
      }
      return { ok: true, displayMode: "lyrics" };
    },
    captureLiveSnapshot: () => {
      captured = { songKey: "live:001", slideIndex: 2 };
      return captured;
    },
  });

  const blocked = await liveSwitch.commit({ type: "hymn", songKey: "missing:001" });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /unchanged/i);
  assert.equal(liveApplies, 0);

  const ok = await liveSwitch.commit({ type: "hymn", songKey: "christ-in-song-zulu:051" });
  assert.equal(ok.ok, true);
  assert.equal(liveApplies, 1);
  assert.deepEqual(captured, { songKey: "live:001", slideIndex: 2 });

  liveApplies = 0;
  const failed = await liveSwitch.commit({ type: "hymn", songKey: "fail:001" });
  assert.equal(failed.ok, false);
  assert.equal(liveApplies, 1);

  const concurrent = await Promise.all([
    liveSwitch.commit({ type: "hymn", songKey: "a:001" }),
    liveSwitch.commit({ type: "hymn", songKey: "b:002" }),
  ]);
  assert.ok(concurrent.some((item) => item.ok === false && /already in progress/i.test(item.message)));

  liveLock.configure({ isPresentationActive: () => true });
  liveLock.enable();
  assert.equal(liveLock.isCommandBlocked("delete-hymnal-edition"), true);
  assert.equal(liveLock.isCommandBlocked("hymn-take-next"), false);
  assert.equal(liveLock.isCommandBlocked("emergency-clear"), false);
  const unlock = liveLock.disable();
  assert.equal(unlock.needsConfirm, true);
  liveLock.disable({ confirmed: true });
  assert.equal(liveLock.isActive(), false);

  const strip = lockUiWin.CISLiveLockUI.renderStrip({ active: true });
  assert.match(strip, /LIVE LOCK ENABLED/);
  assert.match(strip, /live-lock-unlock/);

  bible.configure({});
  const emptySend = bible.sendLive();
  assert.equal(emptySend.ok, false);
  bible.setPreviewField("slides", [{ body: "Verse" }]);
  bible.setPreviewField("loading", true);
  const loadingSend = bible.sendLive();
  assert.equal(loadingSend.ok, false);
  assert.match(loadingSend.message, /loading/i);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupLiveSwitch/);
  assert.match(appSource, /setupLiveLock/);
  assert.match(appSource, /commitHymnLive/);
  assert.match(appSource, /hasLyricLiveContent/);
  assert.match(appSource, /live-lock-enable/);

  const cameraSource = read("app/camera/camera-source-service.js");
  assert.match(cameraSource, /hasLyricLiveContent/);
  assert.match(cameraSource, /disconnected/);
  assert.doesNotMatch(cameraSource, /church logo has been shown on the affected outputs/);

  const hymnQueue = read("app/hymn-queue/live-hymn-queue-service.js");
  assert.match(hymnQueue, /CISLiveSwitchService/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /live-switch-service\.js/);
  assert.match(indexHtml, /liveLockRoot/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:live-switch"]);

  console.log("test-live-switch: all assertions passed");
}

run();
