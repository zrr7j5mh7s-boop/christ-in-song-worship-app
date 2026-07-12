(function () {
  "use strict";

  const SESSION_KEY = "cis-quiet-service-mode-session";
  const listeners = new Set();
  let adapters = {};
  let settings = {};

  const state = {
    active: false,
    enteredAt: 0,
    deferredNotices: [],
    pausedTasks: new Set(),
    powerBlockActive: false,
    updatesDeferred: false,
    askedAutoEnterThisSession: false,
  };

  const BACKGROUND_TASKS = {
    indexing: "indexing",
    lazyPreload: "lazyPreload",
    helpIndex: "helpIndex",
    analytics: "analytics",
    thumbnails: "thumbnails",
    updatePrompts: "updatePrompts",
  };

  function notify() {
    persistSession();
    listeners.forEach((fn) => fn(getState()));
  }

  function persistSession() {
    if (settings.autosaveSession === false || typeof adapters.saveSession !== "function") return;
    adapters.saveSession({
      active: state.active,
      enteredAt: state.enteredAt,
      deferredCount: state.deferredNotices.length,
    });
  }

  function restoreSession(saved) {
    if (!saved || typeof saved !== "object" || !saved.active) return;
    state.active = true;
    state.enteredAt = saved.enteredAt || Date.now();
    applyQuietEffects(true);
  }

  function isActive() {
    return state.active;
  }

  function shouldPauseBackgroundTask(taskId) {
    if (!state.active) return false;
    if (!settings.pauseBackgroundIndexing && (taskId === BACKGROUND_TASKS.indexing || taskId === BACKGROUND_TASKS.lazyPreload)) {
      return false;
    }
    return state.pausedTasks.has(taskId);
  }

  function evaluateNotice(message, options) {
    const classifier = window.CISNotificationClassifier;
    if (!state.active || !classifier) {
      return { show: true, defer: false, unobtrusive: false, level: "normal" };
    }
    const classification = classifier.classifyNotice(message, options);
    if (classification.level === classifier.LEVELS.critical) {
      return { show: true, defer: false, unobtrusive: false, level: classification.level };
    }
    if (classification.level === classifier.LEVELS.important) {
      return { show: true, defer: false, unobtrusive: true, level: classification.level };
    }
    return { show: false, defer: true, unobtrusive: false, level: classification.level };
  }

  function queueNotice(message, level) {
    state.deferredNotices.push({ message, level, queuedAt: Date.now() });
    if (state.deferredNotices.length > 48) state.deferredNotices.shift();
    notify();
  }

  function flushDeferredNotices() {
    const count = state.deferredNotices.length;
    state.deferredNotices = [];
    notify();
    return count;
  }

  function shouldDeferUpdateStatus(status) {
    if (!state.active || !settings.deferUpdates) return false;
    const deferStatuses = new Set(["checking", "available", "downloading", "downloaded", "not-available"]);
    return deferStatuses.has(status);
  }

  function shouldBlockAdminPopup(command) {
    if (!state.active) return false;
    const blocked = new Set([
      "check-updates",
      "import-language-pack",
      "open-bulk-tag",
      "delete-template",
      "save-template-editor",
    ]);
    return blocked.has(command);
  }

  function applyQuietEffects(enabled) {
    if (enabled) {
      state.pausedTasks = new Set(Object.values(BACKGROUND_TASKS));
      if (settings.deferUpdates) state.updatesDeferred = true;
    } else {
      state.pausedTasks.clear();
      state.updatesDeferred = false;
    }

    if (typeof adapters.setPlatformQuietMode === "function") {
      adapters.setPlatformQuietMode(enabled, {
        preventDisplaySleep: settings.preventDisplaySleep,
        deferUpdates: settings.deferUpdates,
      });
    }
  }

  async function syncPowerBlocker(outputsActive) {
    if (!state.active || !settings.preventDisplaySleep) {
      if (state.powerBlockActive && typeof adapters.setPowerBlocker === "function") {
        await adapters.setPowerBlocker(false);
        state.powerBlockActive = false;
      }
      return;
    }
    const shouldBlock = Boolean(outputsActive);
    if (shouldBlock === state.powerBlockActive) return;
    if (typeof adapters.setPowerBlocker === "function") {
      await adapters.setPowerBlocker(shouldBlock);
      state.powerBlockActive = shouldBlock;
    }
  }

  function enter(options) {
    if (state.active) return { ok: true, message: "Quiet Service Mode is already active." };
    state.active = true;
    state.enteredAt = Date.now();
    applyQuietEffects(true);
    if (options?.outputsActive) syncPowerBlocker(true);
    notify();
    return { ok: true, message: "Quiet Service Mode active. Nonessential interruptions are suppressed." };
  }

  function exit() {
    if (!state.active) return { ok: true, message: "Quiet Service Mode is not active." };
    const deferredCount = state.deferredNotices.length;
    state.active = false;
    state.enteredAt = 0;
    applyQuietEffects(false);
    syncPowerBlocker(false);
    notify();
    return {
      ok: true,
      message: deferredCount
        ? `Quiet Service Mode exited. ${deferredCount} deferred notice(s) were cleared.`
        : "Quiet Service Mode exited.",
      deferredCount,
    };
  }

  function shouldAutoEnterWithServiceMode() {
    if (settings.autoEnterWithServiceMode === "always") return { enter: true, ask: false };
    if (settings.autoEnterWithServiceMode === "ask" && !state.askedAutoEnterThisSession) {
      return { enter: false, ask: true };
    }
    return { enter: false, ask: false };
  }

  function markAutoEnterAsked() {
    state.askedAutoEnterThisSession = true;
  }

  function getState() {
    return {
      active: state.active,
      enteredAt: state.enteredAt,
      deferredNotices: [...state.deferredNotices],
      deferredCount: state.deferredNotices.length,
      pausedTasks: [...state.pausedTasks],
      powerBlockActive: state.powerBlockActive,
      updatesDeferred: state.updatesDeferred,
      settings: { ...settings },
    };
  }

  function updateSettings(patch) {
    settings = { ...settings, ...patch };
    if (typeof adapters.saveSettings === "function") adapters.saveSettings(settings);
    if (state.active) applyQuietEffects(true);
    notify();
    return settings;
  }

  function configure(options) {
    adapters = {
      setPlatformQuietMode: options?.setPlatformQuietMode || null,
      setPowerBlocker: options?.setPowerBlocker || null,
      saveSession: options?.saveSession || null,
      loadSession: options?.loadSession || null,
      saveSettings: options?.saveSettings || null,
    };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISQuietServiceModeSettings) {
      settings = window.CISQuietServiceModeSettings.load();
    }
    if (typeof adapters.loadSession === "function") {
      restoreSession(adapters.loadSession());
    }
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.CISQuietServiceModeService = {
    BACKGROUND_TASKS,
    configure,
    subscribe,
    getState,
    isActive,
    enter,
    exit,
    evaluateNotice,
    queueNotice,
    flushDeferredNotices,
    shouldPauseBackgroundTask,
    shouldDeferUpdateStatus,
    shouldBlockAdminPopup,
    syncPowerBlocker,
    shouldAutoEnterWithServiceMode,
    markAutoEnterAsked,
    updateSettings,
  };
})();
