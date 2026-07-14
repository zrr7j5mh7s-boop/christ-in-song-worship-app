(function () {
  "use strict";

  const STORAGE_KEY = "cis-keyboard-shortcuts";

  function load(loadJson) {
    const fallback = {};
    if (typeof loadJson !== "function") return fallback;
    const saved = loadJson(STORAGE_KEY, fallback);
    return saved && typeof saved === "object" ? saved : fallback;
  }

  function save(bindings, saveJson) {
    if (typeof saveJson !== "function") return;
    saveJson(STORAGE_KEY, bindings || {});
  }

  function reset(saveJson) {
    save({}, saveJson);
  }

  window.CISKeyboardShortcutsSettings = {
    STORAGE_KEY,
    load,
    save,
    reset,
  };
})();
