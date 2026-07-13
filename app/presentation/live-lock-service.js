(function () {
  "use strict";

  const listeners = new Set();
  let adapters = {};
  let settings = {};

  const state = {
    enabled: false,
    unlockedUntil: 0,
  };

  function notify() {
    if (settings.autosave !== false && typeof adapters.saveSettings === "function") {
      adapters.saveSettings({ enabled: state.enabled });
    }
    listeners.forEach((fn) => fn(getState()));
  }

  function getState() {
    return {
      enabled: state.enabled,
      active: isActive(),
      settings: { ...settings },
    };
  }

  function isActive() {
    return Boolean(state.enabled);
  }

  function isCommandBlocked(command, options) {
    if (!isActive()) return false;
    const blocked = window.CISLiveLockSettings?.BLOCKED_WHEN_LOCKED;
    if (blocked && blocked.has(command)) return true;
    const outputCommands = window.CISLiveLockSettings?.OUTPUT_REASSIGN_COMMANDS;
    if (outputCommands && outputCommands.has(command) && !options?.confirmed) return true;
    return false;
  }

  function shouldConfirmClose() {
    if (!isActive() || !settings.confirmCloseWhileLive) return false;
    if (typeof adapters.isPresentationActive === "function") {
      return adapters.isPresentationActive();
    }
    return false;
  }

  function enable() {
    state.enabled = true;
    notify();
    return { ok: true, message: "Live Lock enabled." };
  }

  function disable(options) {
    if (state.enabled && settings.confirmUnlock !== false && !options?.confirmed) {
      return { ok: false, needsConfirm: true, message: "Unlock Live Lock? Administrative and destructive actions will be available again." };
    }
    state.enabled = false;
    notify();
    return { ok: true, message: "Live Lock disabled." };
  }

  function toggle(options) {
    if (state.enabled) return disable(options);
    return enable();
  }

  function configure(options) {
    adapters = {
      isPresentationActive: options?.isPresentationActive || null,
      saveSettings: options?.saveSettings || null,
    };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
      state.enabled = Boolean(settings.enabled);
    } else if (window.CISLiveLockSettings) {
      settings = window.CISLiveLockSettings.load();
      state.enabled = Boolean(settings.enabled);
    }
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.CISLiveLockService = {
    configure,
    subscribe,
    getState,
    isActive,
    isCommandBlocked,
    shouldConfirmClose,
    enable,
    disable,
    toggle,
  };
})();
