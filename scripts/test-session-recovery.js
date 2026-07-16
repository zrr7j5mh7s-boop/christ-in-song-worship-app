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

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function createLocalStorage(initial) {
  return {
    store: { ...(initial || {}) },
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    },
    removeItem(key) {
      delete this.store[key];
    },
  };
}

function createEventTarget(extra) {
  const listeners = new Map();
  return {
    ...(extra || {}),
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const type = typeof event === "string" ? event : event?.type;
      for (const handler of listeners.get(type) || []) handler(event || { type });
    },
    __listeners: listeners,
  };
}

function loadModule(file, options) {
  const localStorage = options?.localStorage || createLocalStorage();
  const windowObject = createEventTarget({
    localStorage,
    setTimeout,
    clearTimeout,
    ...(options?.window || {}),
  });
  const documentObject = createEventTarget({
    visibilityState: "visible",
    ...(options?.document || {}),
  });
  const sandbox = {
    window: windowObject,
    document: documentObject,
    console,
    localStorage,
    indexedDB: options?.indexedDB,
    setTimeout,
    clearTimeout,
    ...(options?.globals || {}),
  };
  vm.createContext(sandbox);
  vm.runInContext(read(file), sandbox, { filename: file });
  windowObject.__sandbox = sandbox;
  return windowObject;
}

function validSnapshot(overrides) {
  const base = {
    version: 1,
    id: "snapshot-1",
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
      previousLive: "Christ in Song - Zulu - Hymn 51 - Stanza 3",
      next: "SDA Hymnal - English - Hymn 108",
      preview: "-",
      queueCount: 1,
    },
  };
  return {
    ...base,
    ...(overrides || {}),
    session: {
      ...base.session,
      ...(overrides?.session || {}),
    },
    labels: {
      ...base.labels,
      ...(overrides?.labels || {}),
    },
  };
}

function corruptSnapshot(label) {
  return {
    version: 9,
    savedAt: label || "not-a-date",
    sessionActive: true,
    session: {},
  };
}

function createFakeIndexedDB(options) {
  const config = {
    failOpen: false,
    failPutIds: new Set(),
    ...(options || {}),
  };
  const records = new Map();
  if (config.records) {
    for (const [key, value] of Object.entries(config.records)) records.set(key, clone(value));
  }
  let storeCreated = Boolean(config.records);

  function makeRequest(tx, action) {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    tx.__pending += 1;
    setTimeout(() => {
      if (tx.__aborted) {
        tx.__pending -= 1;
        tx.__scheduleComplete();
        return;
      }
      try {
        request.result = action();
        if (request.onsuccess) request.onsuccess({ target: request });
      } catch (error) {
        request.error = error;
        tx.error = error;
        tx.__aborted = true;
        if (request.onerror) request.onerror({ target: request });
        if (tx.onerror) tx.onerror({ target: tx });
      } finally {
        tx.__pending -= 1;
        tx.__scheduleComplete();
      }
    }, 0);
    return request;
  }

  function createTransaction() {
    const working = new Map();
    for (const [key, value] of records.entries()) working.set(key, clone(value));
    const tx = {
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      __pending: 0,
      __aborted: false,
      __completed: false,
      __completionScheduled: false,
      abort() {
        if (this.__completed || this.__aborted) return;
        this.__aborted = true;
        this.error = this.error || new Error("Transaction aborted.");
        this.__scheduleComplete();
      },
      objectStore() {
        return {
          get(id) {
            return makeRequest(tx, () => clone(working.get(id) || null));
          },
          put(record) {
            return makeRequest(tx, () => {
              if (config.failPutIds.has(record.id)) throw new Error(`Injected write failure for ${record.id}.`);
              working.set(record.id, clone(record));
              return clone(record);
            });
          },
          delete(id) {
            return makeRequest(tx, () => {
              working.delete(id);
              return undefined;
            });
          },
        };
      },
      __scheduleComplete() {
        if (this.__completionScheduled || this.__completed) return;
        this.__completionScheduled = true;
        setTimeout(() => {
          this.__completionScheduled = false;
          if (this.__pending > 0 || this.__completed) return;
          this.__completed = true;
          if (this.__aborted) {
            if (this.onabort) this.onabort({ target: this });
            return;
          }
          records.clear();
          for (const [key, value] of working.entries()) records.set(key, clone(value));
          if (this.oncomplete) this.oncomplete({ target: this });
        }, 0);
      },
    };
    setTimeout(() => tx.__scheduleComplete(), 0);
    return tx;
  }

  const db = {
    objectStoreNames: {
      contains() {
        return storeCreated;
      },
    },
    createObjectStore() {
      storeCreated = true;
    },
    transaction() {
      return createTransaction();
    },
  };

  return {
    records,
    config,
    open() {
      const request = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        if (config.failOpen) {
          request.error = new Error("IndexedDB open failed.");
          if (request.onerror) request.onerror({ target: request });
          return;
        }
        if (!storeCreated && request.onupgradeneeded) request.onupgradeneeded({ target: request });
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);
      return request;
    },
  };
}

function loadRecoveryService(options) {
  const snapshotWin = loadModule("app/session-recovery/session-recovery-snapshot.js");
  const settingsWin = loadModule("app/session-recovery/session-recovery-settings.js");
  const localStorage = createLocalStorage({
    [snapshotWin.CISSessionRecoverySnapshot.CLEAN_EXIT_KEY]: options.cleanExit ? "true" : "false",
    [snapshotWin.CISSessionRecoverySnapshot.ACTIVE_SESSION_KEY]: options.sessionWasActive ? "true" : "false",
  });
  const writes = [];
  const store = {
    supportsIndexedDb: () => options.supportsIndexedDb !== false,
    readSnapshots: async () => {
      if (options.readError) throw options.readError;
      return {
        latest: options.latest || null,
        previous: options.previous || null,
      };
    },
    writeSnapshotTransactional: async (snapshot, validate) => {
      if (options.writeError) throw options.writeError;
      const validation = validate(snapshot);
      if (!validation.ok) return { ok: false, preserved: true, message: validation.errors.join(" ") };
      writes.push(clone(snapshot));
      options.latest = clone(snapshot);
      return { ok: true, id: snapshot.id || "latest", writtenAt: new Date().toISOString() };
    },
    clearSnapshots: async () => {
      options.latest = null;
      options.previous = null;
      writes.length = 0;
      return { ok: true };
    },
  };
  const serviceWin = loadModule("app/session-recovery/session-recovery-service.js", {
    localStorage,
    window: {
      CISSessionRecoverySettings: settingsWin.CISSessionRecoverySettings,
      CISSessionRecoverySnapshot: snapshotWin.CISSessionRecoverySnapshot,
      CISSessionRecoveryStore: store,
    },
  });
  const service = serviceWin.CISSessionRecoveryService;
  service.configure({
    loadSettings: () => ({ autosaveEnabled: true, debounceMs: 1, markInterruptedOnUncleanExit: true }),
    captureSession: () => clone(options.captureSnapshot || validSnapshot({ id: "captured-final" })),
    applySession: async (_snapshot, restoreOptions) => {
      options.appliedOptions = restoreOptions;
      return { ok: true, message: "restored" };
    },
    inspectAvailability: async () => ({ items: [{ id: "missing", label: "Hymn 999", available: false }], warnings: ["Missing hymnal"] }),
  });
  return { service, serviceWin, localStorage, store, writes, snapshotApi: snapshotWin.CISSessionRecoverySnapshot, options };
}

async function assertStartup(options, expected) {
  const ctx = loadRecoveryService(options);
  const result = await ctx.service.checkOnStartup();
  assert.equal(result.interrupted, expected.interrupted, expected.message);
  if (expected.source) assert.equal(result.source, expected.source, expected.message);
  if (expected.corruptReport) assert.equal(Boolean(result.corruptReport), true, expected.message);
  assert.equal(
    ctx.localStorage.getItem(ctx.snapshotApi.CLEAN_EXIT_KEY),
    "false",
    "startup marks the current run dirty after reading previous flags",
  );
  return { ...ctx, result };
}

async function testSnapshotValidation(snapshotApi) {
  const good = snapshotApi.validateSnapshot(validSnapshot());
  assert.equal(good.ok, true, "valid snapshot passes validation");

  const corrupt = snapshotApi.validateSnapshot(corruptSnapshot());
  assert.equal(corrupt.ok, false, "invalid snapshot rejected");

  const sanitized = snapshotApi.sanitizeObsSettings({ outputTarget: "obs", password: "secret", token: "x" });
  assert.equal(sanitized.outputTarget, "obs");
  assert.equal(sanitized.password, undefined);
  assert.equal(sanitized.token, undefined);
}

async function testStartupDetection() {
  const latest = validSnapshot({ id: "latest-valid" });
  await assertStartup({
    cleanExit: true,
    sessionWasActive: true,
    latest,
  }, {
    interrupted: false,
    message: "previous clean exit must not offer recovery",
  });

  const crashed = await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest,
  }, {
    interrupted: true,
    source: "latest",
    message: "previous crash must offer latest valid recovery",
  });
  assert.match(crashed.result.labels.previousLive, /Hymn 51/, "latest recovery option keeps labels");

  await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest: corruptSnapshot("latest-corrupt"),
    previous: validSnapshot({ id: "previous-valid", labels: { previousLive: "Fallback hymn" } }),
  }, {
    interrupted: true,
    source: "previous",
    corruptReport: true,
    message: "corrupt latest falls back to valid previous snapshot",
  });

  const bothCorrupt = await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest: corruptSnapshot("latest-corrupt"),
    previous: corruptSnapshot("previous-corrupt"),
  }, {
    interrupted: false,
    message: "both corrupt snapshots must not offer unsafe recovery",
  });
  assert.equal(bothCorrupt.service.getRecoveryOffer(), null, "no recovery offer remains after corrupt snapshots");
  assert.equal(bothCorrupt.options.latest.version, 9, "corrupt latest is preserved for later inspection");
  assert.equal(bothCorrupt.options.previous.version, 9, "corrupt fallback is preserved for later inspection");

  await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest,
    supportsIndexedDb: false,
  }, {
    interrupted: false,
    message: "unavailable storage is handled without recovery prompt",
  });

  const storageError = await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest,
    readError: new Error("storage read failed"),
  }, {
    interrupted: false,
    message: "storage read failure is handled without recovery prompt",
  });
  assert.equal(storageError.result.storageError, true);
}

async function testCleanAndCrashRestartFlow() {
  const cleanExit = loadRecoveryService({
    cleanExit: false,
    sessionWasActive: true,
    latest: null,
    captureSnapshot: validSnapshot({ id: "final-clean", labels: { previousLive: "Final clean live item" } }),
  });
  const cleanResult = await cleanExit.service.recordCleanExit("beforeunload");
  assert.equal(cleanResult.ok, true, "clean exit writes final snapshot");
  assert.equal(cleanExit.writes.at(-1).id, "final-clean", "final clean snapshot recorded");
  assert.equal(cleanExit.writes.at(-1).saveReason, "beforeunload", "clean exit records save reason");
  assert.equal(cleanExit.localStorage.getItem(cleanExit.snapshotApi.CLEAN_EXIT_KEY), "true", "clean exit flag recorded");
  assert.equal(cleanExit.localStorage.getItem(cleanExit.snapshotApi.ACTIVE_SESSION_KEY), "true", "active session flag preserved after final save");

  await assertStartup({
    cleanExit: true,
    sessionWasActive: true,
    latest: cleanExit.writes.at(-1),
  }, {
    interrupted: false,
    message: "restart after clean exit must not show recovery",
  });

  const unclean = await assertStartup({
    cleanExit: false,
    sessionWasActive: true,
    latest: cleanExit.writes.at(-1),
  }, {
    interrupted: true,
    source: "latest",
    message: "restart after unclean exit shows the saved recovery option",
  });
  assert.equal(unclean.result.snapshot.id, "final-clean", "unclean restart offers the correct snapshot");
}

async function testWriteFailureHandling() {
  const failed = loadRecoveryService({
    cleanExit: false,
    sessionWasActive: false,
    latest: null,
    writeError: new Error("write failed"),
  });
  const result = await failed.service.saveNow("autosave");
  assert.equal(result.ok, false, "write failure returns a safe failure result");
  assert.equal(result.preserved, true, "write failure reports existing data as preserved");
  assert.equal(failed.localStorage.getItem(failed.snapshotApi.ACTIVE_SESSION_KEY), "false", "failed write does not mark session active");
}

async function testIndexedDbStore() {
  const snapshotWin = loadModule("app/session-recovery/session-recovery-snapshot.js");
  const validate = snapshotWin.CISSessionRecoverySnapshot.validateSnapshot;
  const fakeIndexedDb = createFakeIndexedDB();
  const storeWin = loadModule("app/session-recovery/session-recovery-store.js", { indexedDB: fakeIndexedDb });
  const store = storeWin.CISSessionRecoveryStore;

  assert.equal(store.supportsIndexedDb(), true, "fake IndexedDB is available");
  await store.writeSnapshotTransactional(validSnapshot({ id: "first" }), validate);
  await store.writeSnapshotTransactional(validSnapshot({ id: "second" }), validate);
  let records = await store.readSnapshots();
  assert.equal(records.latest.id, "second", "latest snapshot is written");
  assert.equal(records.previous.id, "first", "previous snapshot is promoted atomically with latest write");

  const rejected = await store.writeSnapshotTransactional(corruptSnapshot(), validate);
  assert.equal(rejected.ok, false, "corrupt snapshot write is rejected before storage mutation");
  records = await store.readSnapshots();
  assert.equal(records.latest.id, "second", "latest remains after corrupt write rejection");
  assert.equal(records.previous.id, "first", "previous remains after corrupt write rejection");

  fakeIndexedDb.config.failPutIds.add(store.LATEST_ID);
  await assert.rejects(
    () => store.writeSnapshotTransactional(validSnapshot({ id: "third" }), validate),
    /Injected write failure/,
    "latest write failure rejects",
  );
  fakeIndexedDb.config.failPutIds.clear();
  records = await store.readSnapshots();
  assert.equal(records.latest.id, "second", "failed paired write leaves latest unchanged");
  assert.equal(records.previous.id, "first", "failed paired write leaves previous unchanged");

  await store.clearSnapshots();
  records = await store.readSnapshots();
  assert.equal(records.latest, null, "clear removes latest");
  assert.equal(records.previous, null, "clear removes previous");

  const unavailableStoreWin = loadModule("app/session-recovery/session-recovery-store.js", { indexedDB: null });
  assert.equal(unavailableStoreWin.CISSessionRecoveryStore.supportsIndexedDb(), false, "null IndexedDB is unavailable");

  const failingOpen = loadModule("app/session-recovery/session-recovery-store.js", {
    indexedDB: createFakeIndexedDB({ failOpen: true }),
  });
  await assert.rejects(
    () => failingOpen.CISSessionRecoveryStore.readSnapshots(),
    /IndexedDB open failed/,
    "open failure is surfaced safely",
  );
}

function testRestoreAndIntegrationWiring() {
  return (async () => {
    const ctx = loadRecoveryService({
      cleanExit: false,
      sessionWasActive: true,
      latest: validSnapshot(),
    });
    const startup = await ctx.service.checkOnStartup();
    assert.equal(startup.interrupted, true, "interrupted session detected for restore test");

    await ctx.service.restoreSession({ openOutputs: false, restoreLive: false });
    assert.equal(ctx.options.appliedOptions.restoreLive, false);
    assert.equal(ctx.options.appliedOptions.openOutputs, false);

    ctx.localStorage.setItem(ctx.snapshotApi.CLEAN_EXIT_KEY, "false");
    ctx.localStorage.setItem(ctx.snapshotApi.ACTIVE_SESSION_KEY, "true");
    await ctx.service.checkOnStartup();
    await ctx.service.restoreSession({
      reopenProjector: true,
      reconnectObs: true,
      restoreLive: true,
      openOutputs: true,
    });
    assert.equal(ctx.options.appliedOptions.reopenProjector, true);
    assert.equal(ctx.options.appliedOptions.reconnectObs, true);
    assert.ok(!JSON.stringify(ctx.options.appliedOptions).includes("stream"), "no automatic streaming flag");

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
    assert.match(indexHtml, /styles\.css\?v=47/);

    const sw = read("app/sw.js");
    assert.match(sw, /christ-in-song-worship-v47/);

    const pkg = JSON.parse(read("package.json"));
    assert.ok(pkg.scripts["test:session-recovery"]);
  })();
}

async function run() {
  const snapshotWin = loadModule("app/session-recovery/session-recovery-snapshot.js");
  await testSnapshotValidation(snapshotWin.CISSessionRecoverySnapshot);
  await testStartupDetection();
  await testCleanAndCrashRestartFlow();
  await testWriteFailureHandling();
  await testIndexedDbStore();
  await testRestoreAndIntegrationWiring();
  await delay();
  console.log("test:session-recovery - all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
