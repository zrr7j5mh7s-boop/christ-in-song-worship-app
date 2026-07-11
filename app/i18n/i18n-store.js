(function () {
  "use strict";

  const STORAGE_KEY = "cis-va-chinoda:uiLocale";
  const DEFAULT_LOCALE = "en";

  function loadLocale(supportedLocales) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (!supportedLocales || supportedLocales.includes(stored))) {
        return stored;
      }
    } catch (_error) {
      /* ignore storage errors */
    }
    return DEFAULT_LOCALE;
  }

  function saveLocale(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_error) {
      /* ignore storage errors */
    }
  }

  window.CISI18nStore = {
    STORAGE_KEY,
    DEFAULT_LOCALE,
    loadLocale,
    saveLocale,
  };
})();
