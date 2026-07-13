(function () {
  "use strict";

  const STORAGE_KEY = "serviceMode";

  const DEFAULTS = {
    confirmExitDuringLive: true,
    autosaveSession: true,
    restoreSessionOnLaunch: true,
  };

  const ADMIN_ONLY_COMMANDS = new Set([
    "delete-hymnal-edition",
    "delete-hymnal-book",
    "confirm-delete-hymnal",
    "export-and-delete-hymnal",
    "replace-hymnal-source",
    "import-language-pack",
    "check-updates",
    "undo-hymnal-delete",
    "open-bulk-tag",
    "restore-backup",
    "export-backup",
    "open-obs-settings",
    "bible-settings",
    "delete-template",
    "save-template-editor",
    "open-template-editor",
    "close-presenter",
  ]);

  const SERVICE_MODE_VIEWS = new Set(["service", "search", "index", "bible", "help", "song"]);

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

  window.CISServiceModeSettings = {
    STORAGE_KEY,
    DEFAULTS,
    ADMIN_ONLY_COMMANDS,
    SERVICE_MODE_VIEWS,
    load,
    save,
  };
})();
