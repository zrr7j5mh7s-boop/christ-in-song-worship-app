(function () {
  "use strict";

  const SESSION_KEY = "cis-service-mode-session";
  const listeners = new Set();
  let adapters = {};
  let settings = {};

  const state = {
    active: false,
    previousView: "presenter",
    enteredAt: 0,
    sessionRestored: false,
    pendingRestoreConfirm: false,
  };

  function notify() {
    persistSession();
    listeners.forEach((fn) => fn(getState()));
  }

  function persistSession() {
    if (settings.autosaveSession === false || typeof adapters.saveSession !== "function") return;
    adapters.saveSession({
      active: state.active,
      previousView: state.previousView,
      enteredAt: state.enteredAt,
      sessionRestored: state.sessionRestored,
    });
  }

  function restoreSession(saved) {
    if (!saved || typeof saved !== "object") return;
    if (saved.active) {
      state.active = true;
      state.previousView = saved.previousView || "presenter";
      state.enteredAt = saved.enteredAt || Date.now();
      state.sessionRestored = Boolean(saved.sessionRestored);
      if (settings.restoreSessionOnLaunch && !state.sessionRestored) {
        state.pendingRestoreConfirm = true;
      }
    }
  }

  function getRole() {
    if (typeof adapters.getRole === "function") return adapters.getRole();
    return "operator";
  }

  function canAccessAdmin() {
    const role = getRole();
    return role === "admin" || role === "editor";
  }

  function isAdminOnlyCommand(command) {
    const list = window.CISServiceModeSettings?.ADMIN_ONLY_COMMANDS;
    return list ? list.has(command) : false;
  }

  function isCommandAllowed(command) {
    if (!state.active) return true;
    if (!isAdminOnlyCommand(command)) return true;
    return false;
  }

  function isPresentationActive() {
    if (typeof adapters.isPresentationActive === "function") {
      return adapters.isPresentationActive();
    }
    return false;
  }

  function isActive() {
    return Boolean(state.active);
  }

  function enter(options) {
    if (state.active) return { ok: true, message: "Service Mode is already active." };
    state.active = true;
    state.previousView = options?.previousView || "presenter";
    state.enteredAt = Date.now();
    state.pendingRestoreConfirm = false;
    notify();
    return { ok: true, message: "Service Mode entered." };
  }

  function exit(options) {
    if (!state.active) return { ok: true, message: "Service Mode is not active." };
    if (!options?.force && settings.confirmExitDuringLive && isPresentationActive()) {
      if (!options?.confirmed) {
        return { ok: false, needsConfirm: true, message: "A presentation is active. Exit Service Mode without clearing outputs?" };
      }
    }
    const previousView = state.previousView || "presenter";
    state.active = false;
    state.enteredAt = 0;
    notify();
    return { ok: true, previousView, message: "Service Mode exited." };
  }

  function confirmSessionRestore() {
    state.pendingRestoreConfirm = false;
    state.sessionRestored = true;
    notify();
    return { ok: true };
  }

  function dismissSessionRestore() {
    state.pendingRestoreConfirm = false;
    state.active = false;
    notify();
    return { ok: true };
  }

  function getState() {
    return {
      active: state.active,
      previousView: state.previousView,
      enteredAt: state.enteredAt,
      pendingRestoreConfirm: state.pendingRestoreConfirm,
      canAccessAdmin: canAccessAdmin(),
      role: getRole(),
      settings: { ...settings },
    };
  }

  function configure(options) {
    adapters = {
      getRole: options?.getRole || null,
      isPresentationActive: options?.isPresentationActive || null,
      saveSession: options?.saveSession || null,
      loadSession: options?.loadSession || null,
      saveSettings: options?.saveSettings || null,
    };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISServiceModeSettings) {
      settings = window.CISServiceModeSettings.load();
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

  window.CISServiceModeService = {
    configure,
    subscribe,
    getState,
    isActive,
    enter,
    exit,
    canAccessAdmin,
    isCommandAllowed,
    isAdminOnlyCommand,
    confirmSessionRestore,
    dismissSessionRestore,
    isPresentationActive,
  };
})();
