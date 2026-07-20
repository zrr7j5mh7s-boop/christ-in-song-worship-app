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
    backgroundId: "black",
    customBackgroundDataUrl: "",
    customBackgroundName: "",
  };

  const ALLOWED_BACKGROUND_IDS = new Set(["black", "white", "navy_soft", "warm_stone", "deep_blue", "custom"]);
  const MAX_CUSTOM_BACKGROUND_DATA_URL_CHARS = 3 * 1024 * 1024 * 2 + 256;

  function isValidCustomBackgroundDataUrl(value) {
    return typeof value === "string"
      && value.startsWith("data:image/")
      && value.length <= MAX_CUSTOM_BACKGROUND_DATA_URL_CHARS;
  }

  function sanitize(settings) {
    const merged = { ...DEFAULTS, ...(settings && typeof settings === "object" ? settings : {}) };
    if (window.CISProjectionThemes && !window.CISProjectionThemes.ALLOWED_THEME_IDS.includes(merged.themeId)) {
      merged.themeId = DEFAULTS.themeId;
    }
    if (!ALLOWED_BACKGROUND_IDS.has(merged.backgroundId)) {
      merged.backgroundId = DEFAULTS.backgroundId;
    }
    if (merged.backgroundId === "custom") {
      if (!isValidCustomBackgroundDataUrl(merged.customBackgroundDataUrl)) {
        merged.backgroundId = DEFAULTS.backgroundId;
        merged.customBackgroundDataUrl = "";
        merged.customBackgroundName = "";
      } else if (typeof merged.customBackgroundName !== "string") {
        merged.customBackgroundName = "";
      }
    } else {
      merged.customBackgroundDataUrl = "";
      merged.customBackgroundName = "";
    }
    return merged;
  }

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS };
      return sanitize(raw);
    } catch (error) {
      console.warn("[projection-settings] Could not load saved projection settings:", error);
      return { ...DEFAULTS };
    }
  }

  function save(settings, saveJson) {
    const merged = sanitize(settings);
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
