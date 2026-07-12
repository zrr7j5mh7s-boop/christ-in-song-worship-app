(function () {
  "use strict";

  const STORAGE_KEY = "quietServiceMode";

  const AUTO_ENTER_OPTIONS = {
    never: "never",
    always: "always",
    ask: "ask",
  };

  const DEFAULTS = {
    autoEnterWithServiceMode: "never",
    preventDisplaySleep: true,
    reduceAnimations: true,
    deferUpdates: true,
    pauseBackgroundIndexing: true,
    autosaveSession: true,
  };

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS };
      const merged = { ...DEFAULTS, ...raw };
      if (!AUTO_ENTER_OPTIONS[merged.autoEnterWithServiceMode]) {
        merged.autoEnterWithServiceMode = DEFAULTS.autoEnterWithServiceMode;
      }
      return merged;
    } catch (_error) {
      return { ...DEFAULTS };
    }
  }

  function save(settings, saveJson) {
    const merged = { ...DEFAULTS, ...settings };
    if (!AUTO_ENTER_OPTIONS[merged.autoEnterWithServiceMode]) {
      merged.autoEnterWithServiceMode = DEFAULTS.autoEnterWithServiceMode;
    }
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, merged);
    return merged;
  }

  window.CISQuietServiceModeSettings = {
    STORAGE_KEY,
    AUTO_ENTER_OPTIONS,
    DEFAULTS,
    load,
    save,
  };
})();
