(function () {
  "use strict";

  const STORAGE_KEY = "sessionRecoverySettings";

  const DEFAULTS = {
    autosaveEnabled: true,
    debounceMs: 800,
    keepPreviousSnapshot: true,
    markInterruptedOnUncleanExit: true,
  };

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS };
      return { ...DEFAULTS, ...raw };
    } catch (_error) {
      return { ...DEFAULTS };
    }
  }

  function save(settings, saveJson) {
    const merged = { ...DEFAULTS, ...settings };
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, merged);
    return merged;
  }

  window.CISSessionRecoverySettings = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
  };
})();
