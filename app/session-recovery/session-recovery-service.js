(function () {
  "use strict";

  let adapters = {};
  let settings = {};
  let debounceTimer = null;
  let saving = false;
  let pendingSave = false;
  let recoveryOffer = null;

  function configure(options) {
    adapters = { ...(options || {}) };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISSessionRecoverySettings) {
      settings = window.CISSessionRecoverySettings.load();
    }
  }

  function loadSettings() {
    if (typeof adapters.loadSettings === "function") settings = adapters.loadSettings();
    return settings;
  }

  function markSessionActive(active) {
    try {
      localStorage.setItem(
        window.CISSessionRecoverySnapshot?.ACTIVE_SESSION_KEY || "cis-va-chinoda:sessionWasActive",
        active ? "true" : "false",
      );
    } catch (_error) {
      return;
    }
  }

  function markCleanExit(clean) {
    try {
      localStorage.setItem(
        window.CISSessionRecoverySnapshot?.CLEAN_EXIT_KEY || "cis-va-chinoda:sessionCleanExit",
        clean ? "true" : "false",
      );
    } catch (_error) {
      return;
    }
  }

  function wasCleanExit() {
    try {
      return localStorage.getItem(window.CISSessionRecoverySnapshot?.CLEAN_EXIT_KEY) === "true";
    } catch (_error) {
      return true;
    }
  }

  function wasSessionActive() {
    try {
      return localStorage.getItem(window.CISSessionRecoverySnapshot?.ACTIVE_SESSION_KEY) === "true";
    } catch (_error) {
      return false;
    }
  }

  function readStartupFlags() {
    return {
      cleanExit: wasCleanExit(),
      sessionActive: wasSessionActive(),
    };
  }

  function buildSnapshotFromApp() {
    if (typeof adapters.captureSession !== "function") return null;
    const raw = adapters.captureSession();
    if (!raw) return null;
    const normalized = window.CISSessionRecoverySnapshot?.normalizeSnapshot(raw, {
      describeLiveItem: adapters.describeLiveItem,
    });
    return normalized?.snapshot || null;
  }

  async function saveNow(reason) {
    if (settings.autosaveEnabled === false) return { ok: false, skipped: true };
    if (!window.CISSessionRecoveryStore?.supportsIndexedDb?.()) return { ok: false, skipped: true };
    if (saving) {
      pendingSave = true;
      return { ok: false, queued: true };
    }
    saving = true;
    try {
      const snapshot = buildSnapshotFromApp();
      if (!snapshot) return { ok: false, message: "Nothing to save." };
      snapshot.saveReason = reason || "autosave";
      const result = await window.CISSessionRecoveryStore.writeSnapshotTransactional(
        snapshot,
        (value) => window.CISSessionRecoverySnapshot.validateSnapshot(value),
      );
      if (result.ok) {
        markSessionActive(Boolean(snapshot.sessionActive));
      }
      return result;
    } catch (error) {
      return { ok: false, message: error?.message || "Autosave failed.", preserved: true };
    } finally {
      saving = false;
      if (pendingSave) {
        pendingSave = false;
        scheduleSave("queued");
      }
    }
  }

  function scheduleSave(reason) {
    if (settings.autosaveEnabled === false) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    const delay = Number(settings.debounceMs) || 800;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void saveNow(reason || "debounced");
    }, delay);
  }

  async function flushSave(reason) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    return saveNow(reason || "flush");
  }

  async function checkOnStartup() {
    loadSettings();
    const startupFlags = readStartupFlags();
    markCleanExit(false);
    if (!window.CISSessionRecoveryStore?.supportsIndexedDb?.()) {
      recoveryOffer = null;
      return { interrupted: false, storageUnavailable: true };
    }

    let records;
    try {
      records = await window.CISSessionRecoveryStore.readSnapshots();
    } catch (error) {
      recoveryOffer = null;
      return {
        interrupted: false,
        storageError: true,
        message: error?.message || "Session recovery storage unavailable.",
      };
    }

    const { latest, previous } = records;
    const validate = window.CISSessionRecoverySnapshot.validateSnapshot;
    let snapshot = latest;
    let source = "latest";
    let corruptReport = null;

    if (latest) {
      const latestValidation = validate(latest);
      if (!latestValidation.ok) {
        corruptReport = { source: "latest", errors: latestValidation.errors };
        if (previous && validate(previous).ok) {
          snapshot = previous;
          source = "previous";
        } else {
          snapshot = null;
        }
      }
    }

    const interrupted = Boolean(
      settings.markInterruptedOnUncleanExit !== false
      && snapshot
      && (startupFlags.sessionActive || snapshot.sessionActive)
      && !startupFlags.cleanExit,
    );

    if (!interrupted || !snapshot) {
      recoveryOffer = null;
      return { interrupted: false };
    }

    recoveryOffer = {
      snapshot,
      source,
      corruptReport,
      savedAt: snapshot.savedAt,
      labels: snapshot.labels || {},
    };
    return { interrupted: true, ...recoveryOffer };
  }

  function getRecoveryOffer() {
    return recoveryOffer ? { ...recoveryOffer } : null;
  }

  async function discardRecovery() {
    recoveryOffer = null;
    markSessionActive(false);
    markCleanExit(true);
    return window.CISSessionRecoveryStore.clearSnapshots();
  }

  async function restoreSession(options) {
    const offer = recoveryOffer;
    if (!offer?.snapshot) return { ok: false, message: "No recovery snapshot available." };
    const opts = {
      openOutputs: false,
      restoreLive: false,
      reopenProjector: false,
      reopenStageDisplay: false,
      reconnectObs: false,
      ...(options || {}),
    };

    if (typeof adapters.applySession !== "function") {
      return { ok: false, message: "Recovery bridge unavailable." };
    }

    const result = await adapters.applySession(offer.snapshot, opts);
    if (result?.ok) {
      recoveryOffer = null;
      markCleanExit(true);
      await flushSave("restored");
    }
    return result;
  }

  async function inspectAvailability(snapshot) {
    if (typeof adapters.inspectAvailability === "function") {
      return adapters.inspectAvailability(snapshot || recoveryOffer?.snapshot);
    }
    return { items: [], warnings: [] };
  }

  function recordCleanExit(reason) {
    const result = flushSave(reason || "clean-exit");
    markCleanExit(true);
    return result;
  }

  function setupLifecycle() {
    window.addEventListener("beforeunload", () => {
      void recordCleanExit("beforeunload");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushSave("hidden");
    });
  }

  window.CISSessionRecoveryService = {
    configure,
    loadSettings,
    scheduleSave,
    saveNow,
    flushSave,
    checkOnStartup,
    getRecoveryOffer,
    discardRecovery,
    restoreSession,
    inspectAvailability,
    setupLifecycle,
    markSessionActive,
    markCleanExit,
    recordCleanExit,
    buildSnapshotFromApp,
  };
})();
