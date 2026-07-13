(function () {
  "use strict";

  const STORAGE_KEY = "liveHymnQueue";

  const DEFAULTS = {
    autoAdvanceQueue: true,
    confirmBeforeLive: true,
    confirmReplaceLive: true,
    defaultTransition: "fade",
    inheritDestinations: true,
    autosave: true,
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
    if (typeof saveJson !== "function") return { ...DEFAULTS, ...settings };
    const merged = { ...DEFAULTS, ...settings };
    saveJson(STORAGE_KEY, merged);
    return merged;
  }

  window.CISLiveHymnQueueSettings = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
  };
})();
