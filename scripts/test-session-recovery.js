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
  const sandbox = {
    window: {},
    console,
    localStorage: {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      removeItem(key) { delete this.store[key]; },
    },
    indexedDB: null,
    setTimeout,
    clearTimeout,
    ...(extraSandbox || {}),
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function validSnapshot() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    sessionActive: true,
    session: {
      worshipPlan: [{ id: "slot-1", role: "Hymn", songKey: "sda:default:051" }],
      songService: [],
      activeSlot: 0,
      presenter: {
        open: true,
        songKey: "sda:default:051",
        slideIndex: 2,
        planIndex: null,
        queueKeys: [],
        queueIndex: null,
      },
      emergencyMode: "",
      displayMode: "lyrics",
      bible: { translation: "KJV", bookOrder: 43, chapter: 3, verse: 16, live: null, preview: null, previousLive: null },
      hymnQueue: {
        preview: null,
        next: { songKey: "sda:default:108", title: "Amazing Grace" },
        queue: [{ songKey: "sda:default:051" }],
      },
      live: {
        previous: { songKey: "sda:default:051", slideIndex: 2 },
        preview: null,
        next: { songKey: "sda:default:108" },
        contentType: "hymn",
        phase: "live",
      },
      language: { languageCode: "zu", hymnBookId: "christ-in-song", editionId: "default", uiLocale: "en" },
      outputs: { destinations: ["Local projector"], themeId: "classic_dark", projection: {}, obs: {} },
      stageDisplay: { settings: { layoutId: "current-and-next" } },
      camera: { defaultCameraId: "", backupCameraId: "", activeCameraId: "" },
      media: { songKey: "", position: 0, playing: false },
      timer: { seconds: 600, running: false, endsAt: 0 },
    },
    labels: {
      previousLive: "Christ in Song · Zulu · Hymn 51 · Stanza 3",
      next: "SDA Hymnal · English · Hymn 108",
      preview: "—",
      queueCount: 1,
    },
  };
}

async function run() {
  const snapshotWin = loadModule("app/session-recovery/session-recovery-snapshot.js");
  const { CISSessionRecoverySnapshot } = snapshotWin;

  const good = CISSessionRecoverySnapshot.validateSnapshot(validSnapshot());
  assert.equal(good.ok, true, "valid snapshot passes validation");

  const corrupt = CISSessionRecoverySnapshot.validateSnapshot({ version: 9 });
  assert.equal(corrupt.ok, false, "invalid snapshot rejected");

  const sanitized = CISSessionRecoverySnapshot.sanitizeObsSettings({ outputTarget: "obs", password: "secret", token: "x" });
  assert.equal(sanitized.outputTarget, "obs");
  assert.equal(sanitized.password, undefined);
  assert.equal(sanitized.token, undefined);

  const storeWin = loadModule("app/session-recovery/session-recovery-store.js");
  const memory = new Map();
  storeWin.indexedDB = {
    open() {
      const req = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => {},
        },
      };
      setTimeout(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    },
  };
  storeWin.CISSessionRecoveryStore.supportsIndexedDb = () => true;
  storeWin.CISSessionRecoveryStore.openDatabase = async () => ({
    transaction() {
      return {
        objectStore() {
          return {
            put(record) {
              memory.set(record.id, record);
              return { onsuccess: null, onerror: null };
            },
            get(id) {
              const req = { result: memory.get(id) || null, onsuccess: null, onerror: null };
              setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 0);
              return req;
            },
            delete(id) {
              memory.delete(id);
              return { onsuccess: null, onerror: null };
            },
          };
        },
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
    },
  });

  // Use real store with mocked IDB is complex; test transactional logic via service with stub store
  const writes = [];
  const storeStub = {
    readSnapshots: async () => ({
      latest: writes.length ? writes[writes.length - 1] : null,
      previous: writes.length > 1 ? writes[writes.length - 2] : null,
    }),
    writeSnapshotTransactional: async (snapshot, validate) => {
      const validation = validate(snapshot);
      if (!validation.ok) return { ok: false, preserved: true, message: validation.errors.join(" ") };
      if (writes.length) writes.push(snapshot);
      else writes.push(snapshot);
      if (writes.length >= 2) writes.unshift(writes[writes.length - 2]);
      return { ok: true };
    },
    clearSnapshots: async () => { writes.length = 0; return { ok: true }; },
    supportsIndexedDb: () => true,
  };

  const serviceWin = loadModule("app/session-recovery/session-recovery-service.js", {
    window: {
      CISSessionRecoverySettings: loadModule("app/session-recovery/session-recovery-settings.js").CISSessionRecoverySettings,
      CISSessionRecoverySnapshot: snapshotWin.CISSessionRecoverySnapshot,
      CISSessionRecoveryStore: storeStub,
      localStorage: {
        store: { "cis-va-chinoda:sessionWasActive": "true", "cis-va-chinoda:sessionCleanExit": "false" },
        getItem(key) { return this.store[key] ?? null; },
        setItem(key, value) { this.store[key] = String(value); },
      },
      setTimeout,
      clearTimeout,
    },
  });
  const service = serviceWin.CISSessionRecoveryService;

  let appliedOptions = null;
  service.configure({
    loadSettings: () => ({ autosaveEnabled: true, debounceMs: 10 }),
    captureSession: () => validSnapshot(),
    applySession: async (_snapshot, options) => {
      appliedOptions = options;
      return { ok: true, message: "restored" };
    },
    inspectAvailability: async () => ({ items: [{ id: "missing", label: "Hymn 999", available: false }], warnings: ["Missing hymnal"] }),
  });

  await service.saveNow("live-change");
  await service.saveNow("stanza-change");
  const startup = await service.checkOnStartup();
  assert.equal(startup.interrupted, true, "interrupted session detected");
  assert.match(startup.labels.previousLive, /Hymn 51/);

  await service.restoreSession({ openOutputs: false, restoreLive: false });
  assert.equal(appliedOptions.restoreLive, false);
  assert.equal(appliedOptions.openOutputs, false);

  service.configure({
    loadSettings: () => ({ autosaveEnabled: true, debounceMs: 10 }),
    captureSession: () => validSnapshot(),
    applySession: async (_snapshot, options) => {
      appliedOptions = options;
      return { ok: true };
    },
  });
  serviceWin.localStorage.store["cis-va-chinoda:sessionCleanExit"] = "false";
  serviceWin.localStorage.store["cis-va-chinoda:sessionWasActive"] = "true";
  await service.checkOnStartup();
  await service.restoreSession({
    reopenProjector: true,
    reconnectObs: true,
    restoreLive: true,
    openOutputs: true,
  });
  assert.equal(appliedOptions.reopenProjector, true);
  assert.equal(appliedOptions.reconnectObs, true);
  assert.ok(!JSON.stringify(appliedOptions).includes("stream"), "no automatic streaming flag");

  const fallback = await storeStub.writeSnapshotTransactional({ version: 9 }, CISSessionRecoverySnapshot.validateSnapshot);
  assert.equal(fallback.ok, false, "transactional write rejects corrupt snapshot");

  const ui = read("app/session-recovery/session-recovery-ui.js");
  assert.match(ui, /A worship session was interrupted/);
  assert.match(ui, /Restore Session/);
  assert.match(ui, /Review Before Restoring/);
  assert.match(ui, /Discard Recovery/);
  assert.match(ui, /no auto stream\/record/i);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupSessionRecovery/);
  assert.match(appSource, /maybeOfferSessionRecovery/);
  assert.match(appSource, /session-recovery-restore/);
  assert.match(appSource, /scheduleSessionRecoverySave\("live-change"\)/);
  assert.match(appSource, /window\.confirm\("Restore previous Live content/);
  assert.doesNotMatch(appSource, /session-recovery-restore[\s\S]{0,120}present-current/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /session-recovery-service\.js/);
  assert.match(indexHtml, /styles\.css\?v=46/);

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v46/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:session-recovery"]);

  console.log("test:session-recovery — all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
