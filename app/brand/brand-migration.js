(function () {
  "use strict";

  const MIGRATION_KEY = "brandMigrationV1";

  function run(loadJson, saveJson) {
    if (typeof loadJson !== "function" || typeof saveJson !== "function") return { ok: false };
    const done = loadJson(MIGRATION_KEY, null);
    if (done && done.version === 1) return { ok: true, skipped: true };

    const brand = window.CISBrandConfig ? window.CISBrandConfig.BRAND : null;
    const patch = {
      version: 1,
      migratedAt: new Date().toISOString(),
      applicationName: brand?.appName || "VaChinoda Worship App",
    };

    const settings = loadJson("settings", {});
    if (settings && typeof settings === "object") {
      if (!settings.applicationName || window.CISBrandConfig?.isLegacyAppName?.(settings.applicationName)) {
        settings.applicationName = patch.applicationName;
        saveJson("settings", settings);
      }
    }

    saveJson(MIGRATION_KEY, patch);
    return { ok: true, patch };
  }

  window.CISBrandMigration = { MIGRATION_KEY, run };
})();
