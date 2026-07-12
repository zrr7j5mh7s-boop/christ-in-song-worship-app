(function () {
  "use strict";

  const STORAGE_KEY = "liveLock";

  const DEFAULTS = {
    enabled: false,
    confirmUnlock: true,
    confirmCloseWhileLive: true,
  };

  const BLOCKED_WHEN_LOCKED = new Set([
    "delete-hymnal-edition",
    "delete-hymnal-book",
    "confirm-delete-hymnal",
    "export-and-delete-hymnal",
    "replace-hymnal-source",
    "import-language-pack",
    "undo-hymnal-delete",
    "restore-backup",
    "open-bulk-tag",
    "check-updates",
    "close-presenter",
  ]);

  const OUTPUT_REASSIGN_COMMANDS = new Set([
    "set-destinations",
    "open-obs-settings",
  ]);

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

  window.CISLiveLockSettings = {
    STORAGE_KEY,
    DEFAULTS,
    BLOCKED_WHEN_LOCKED,
    OUTPUT_REASSIGN_COMMANDS,
    load,
    save,
  };
})();
