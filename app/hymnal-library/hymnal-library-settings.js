(function () {
  "use strict";

  const STORAGE_KEY = "hymnalSelection";
  const LEGACY_LANGUAGE_KEY = "language";

  const DEFAULTS = {
    hymnBookId: "christ-in-song",
    editionId: "christ-in-song-zulu",
  };

  function load(loadValue, loadJson) {
    const read = typeof loadJson === "function" ? loadJson : () => null;
    const raw = read(STORAGE_KEY, null);
    if (raw && raw.hymnBookId && raw.editionId) {
      return {
        hymnBookId: String(raw.hymnBookId),
        editionId: String(raw.editionId),
      };
    }
    const legacyCode = typeof loadValue === "function" ? loadValue(LEGACY_LANGUAGE_KEY, "zu") : "zu";
    const mapped = window.CISHymnalMigration
      ? window.CISHymnalMigration.resolveEditionFromLegacyCode(legacyCode)
      : null;
    if (mapped) {
      return { hymnBookId: mapped.hymnBookId, editionId: mapped.editionId };
    }
    return { ...DEFAULTS };
  }

  function save(selection, saveJson, saveValue) {
    const next = {
      hymnBookId: String(selection.hymnBookId || DEFAULTS.hymnBookId),
      editionId: String(selection.editionId || DEFAULTS.editionId),
    };
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, next);
    if (typeof saveValue === "function" && window.CISHymnalMigration) {
      const legacy = window.CISHymnalMigration.resolveLegacyCodeFromEdition(next.editionId);
      if (legacy) saveValue(LEGACY_LANGUAGE_KEY, legacy);
    }
    return next;
  }

  window.CISHymnalLibrarySettings = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    save,
  };
})();
