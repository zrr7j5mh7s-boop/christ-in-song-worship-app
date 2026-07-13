(function () {
  "use strict";

  const STORAGE_KEY = "indexDisplay";
  const VALID_LAYOUTS = new Set(["grid", "compact", "list"]);
  const VALID_SORTS = new Set([
    "number-asc",
    "number-desc",
    "title-asc",
    "title-desc",
    "recent",
    "favorites",
  ]);
  const VALID_DENSITY = new Set(["comfortable", "compact"]);

  const DEFAULTS = {
    layout: "grid",
    showCategories: true,
    showTitles: true,
    showFavorites: true,
    density: "comfortable",
    sort: "number-asc",
  };

  function normalizeLayout(value) {
    const layout = String(value || "").trim();
    return VALID_LAYOUTS.has(layout) ? layout : DEFAULTS.layout;
  }

  function normalizeSort(value) {
    const sort = String(value || "").trim();
    return VALID_SORTS.has(sort) ? sort : DEFAULTS.sort;
  }

  function normalizeDensity(value) {
    const density = String(value || "").trim();
    return VALID_DENSITY.has(density) ? density : DEFAULTS.density;
  }

  function load(loadValue, loadJson) {
    const read = typeof loadJson === "function" ? loadJson : () => null;
    const raw = read(STORAGE_KEY, null);
    const parsed = raw && typeof raw === "object" ? raw : {};
    return {
      layout: normalizeLayout(parsed.layout),
      showCategories: parsed.showCategories !== false,
      showTitles: parsed.showTitles !== false,
      showFavorites: parsed.showFavorites !== false,
      density: normalizeDensity(parsed.density),
      sort: normalizeSort(parsed.sort),
    };
  }

  function save(settings, saveJson) {
    if (typeof saveJson !== "function") return false;
    const current = {
      layout: normalizeLayout(settings.layout),
      showCategories: settings.showCategories !== false,
      showTitles: settings.showTitles !== false,
      showFavorites: settings.showFavorites !== false,
      density: normalizeDensity(settings.density),
      sort: normalizeSort(settings.sort),
    };
    saveJson(STORAGE_KEY, current);
    return current;
  }

  function patch(settings, patchValues, saveJson) {
    return save({ ...settings, ...patchValues }, saveJson);
  }

  window.CISHymnIndexSettings = {
    STORAGE_KEY,
    VALID_LAYOUTS,
    VALID_SORTS,
    DEFAULTS,
    normalizeLayout,
    normalizeSort,
    load,
    save,
    patch,
  };
})();
