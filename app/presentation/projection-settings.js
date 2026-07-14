(function () {
  "use strict";

  const STORAGE_KEY = "projectionSettings";

  const DEFAULTS = {
    themeId: "classic_dark",
    outputProfile: "projector",
    aspectRatio: "16:9",
    transition: "fade",
    hideTitleAfterFirst: true,
    hymnMaxLines: 5,
    showTranslationOnOutput: true,
    reducedMotion: false,
    stageShowNextVerse: true,
  };

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS };
      const merged = { ...DEFAULTS, ...raw };
      if (window.CISProjectionThemes && !window.CISProjectionThemes.ALLOWED_THEME_IDS.includes(merged.themeId)) {
        merged.themeId = DEFAULTS.themeId;
      }
      return merged;
    } catch (_error) {
      return { ...DEFAULTS };
    }
  }

  function save(settings, saveJson) {
    const merged = { ...DEFAULTS, ...settings };
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, merged);
    return merged;
  }

  window.CISProjectionSettings = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
  };
})();
