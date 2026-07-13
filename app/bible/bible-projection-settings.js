(function () {
  "use strict";

  const STORAGE_KEY = "bibleProjection";

  const DEFAULTS = {
    defaultTranslation: "KJV",
    secondaryTranslation: "",
    defaultLayout: "fullscreen",
    defaultDestinations: ["main"],
    versesPerSlide: 1,
    autoSplit: true,
    verseGrouping: "auto",
    projectionTheme: "scripture_focus",
    showVerseNumbers: true,
    showTranslationAbbr: true,
    showCopyright: true,
    enterSendsPreview: true,
    confirmLiveVersionChange: true,
    preserveLiveOnFailure: true,
    enableHistory: true,
    enableSpeechDetection: false,
    speechLanguage: "en-US",
    fontScale: 1,
    minFontScale: 0.75,
    defaultTransition: "fade",
    dualVersion: false,
    dualLayout: "stacked",
    obsLayout: "lower_third",
    sermonMode: false,
  };

  function load(_loadValue, loadJson) {
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

  window.CISBibleProjectionSettings = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
  };
})();
