(function () {
  "use strict";

  const STORAGE_PREFIX = "cis-va-chinoda:";
  const electronBridge = window.electronAPI || null;
  const legacyDesktopBridge = window.ChristInSongDesktop || null;
  const desktopBridge = electronBridge || legacyDesktopBridge;
  const baseData = window.CIS_DATA || { meta: {}, languagePacks: [] };
  const extraPacks = window.CIS_EXTRA_LANGUAGE_PACKS || [];
  let importedPacks = [];
  const data = {
    meta: baseData.meta || {},
    languagePacks: [],
  };
  const rangeSize = 50;
  const defaultSlots = [
    "Opening Hymn",
    "Doxology",
    "Prayer Hymn",
    "Offering Hymn",
    "Special Music",
    "Sermon Hymn",
    "Closing Hymn",
  ];
  const defaultSongServiceSlots = Array.from({ length: 15 }, (_, index) => `Song ${index + 1}`);
  const customItemTypes = (window.CISSlideContent && window.CISSlideContent.SLIDE_TYPES
    ? window.CISSlideContent.SLIDE_TYPES.filter((type) => type.id !== "hymn").map((type) => [type.id, type.label])
    : [
      ["scripture", "Scripture Reading"],
      ["prayer", "Prayer"],
      ["announcement", "Welcome & Announcements"],
      ["offering", "Offering Appeal"],
      ["sermon", "Sermon Title"],
      ["special", "Special Music"],
      ["benediction", "Benediction / Closing"],
    ]);
  const builtinTemplates = window.CIS_BUILTIN_TEMPLATES || [];
  const categoryDefinitions = window.CISTagCatalog
    ? [{ id: "all", label: "All", color: "#666", keywords: [] }, ...window.CISTagCatalog.getAllTags()]
    : [
    { id: "all", label: "All", keywords: [] },
    { id: "opening", label: "Opening", keywords: ["opening", "come", "worship", "praise", "sing", "joy"] },
    { id: "praise", label: "Praise", keywords: ["praise", "hallelu", "glory", "sing", "hosanna", "tumi"] },
    { id: "prayer", label: "Prayer", keywords: ["prayer", "pray", "thandaza", "khuleka", "morena", "nkosi"] },
    { id: "offering", label: "Offering", keywords: ["offering", "give", "gift", "nikela", "mnikelo"] },
    { id: "communion", label: "Communion", keywords: ["cross", "blood", "calvary", "communion", "supper", "jesu"] },
    { id: "second-coming", label: "Second Coming", keywords: ["coming", "king", "door", "yeza", "buya", "advent"] },
    { id: "invitation", label: "Invitation", keywords: ["come", "saviour", "mercy", "grace", "today", "jesus"] },
    { id: "closing", label: "Closing", keywords: ["rest", "home", "closing", "peace", "mphumula", "amen"] },
  ];
  const navItems = [
    { id: "home", label: "Home Dashboard", icon: "⌂" },
    { id: "index", label: "Hymn Index", icon: "☰" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "builder", label: "Worship Builder", icon: "+" },
    { id: "presenter", label: "Presenter", icon: "▶" },
    { id: "favorites", label: "Favorites", icon: "★" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];
  const launchParams = new URLSearchParams(window.location.search);
  const launchView = launchParams.get("view");
  const initialView = navItems.some((item) => item.id === launchView) ? launchView : loadValue("view", "home");

  const els = {
    content: document.getElementById("content"),
    nav: document.getElementById("primaryNav"),
    title: document.getElementById("pageTitle"),
    languageSwitcher: document.getElementById("languageSwitcher"),
    modalRoot: document.getElementById("modalRoot"),
    presenterControlRoot: document.getElementById("presenterControlRoot"),
    presenterOutputRoot: document.getElementById("presenterOutputRoot"),
    presenterOverlay: document.getElementById("presenterOverlay"),
    emergencyOverlay: document.getElementById("emergencyOverlay"),
  };

  let embeddedProjectorActive = false;

  const state = {
    view: initialView,
    languageCode: loadValue("language", "zu"),
    songNumber: loadValue("songNumber", "001"),
    indexRange: loadValue("range", "001-050"),
    query: "",
    builderQuery: "",
    searchScope: loadValue("searchScope", "current"),
    category: loadValue("category", "all"),
    tagFilters: loadJson("tagFilters", []),
    activeSlot: Number(loadValue("activeSlot", 0)) || 0,
    activeSongServiceSlot: Number(loadValue("activeSongServiceSlot", 0)) || 0,
    slideIndex: 0,
    displayMode: loadValue("displayMode", "slides"),
    fontScale: Number(loadValue("fontScale", 1)) || 1,
    notice: "",
    desktopInfo: null,
    presenter: {
      open: false,
      songKey: "",
      slideIndex: 0,
      planIndex: null,
      queueKeys: [],
      queueIndex: null,
    },
    timerSeconds: Number(loadValue("timerSeconds", 600)) || 600,
    timerRunning: loadValue("timerRunning", "false") === "true",
    timerEndsAt: Number(loadValue("timerEndsAt", 0)) || 0,
    emergencyMode: "",
    showAddContent: false,
  };

  let favorites = new Set(loadJson("favorites", []));
  let recents = loadJson("recents", []);
  let customTemplates = [];
  let templateEditorDraft = null;
  let songTagMap = {};
  let autoBackupList = [];
  let worshipPlan = normalizeWorshipPlan(loadJson("worshipPlan", null));
  let songService = normalizeSongService(loadJson("songService", null));
  state.activeSlot = Math.min(state.activeSlot, worshipPlan.length - 1);
  state.activeSongServiceSlot = Math.min(state.activeSongServiceSlot, songService.length - 1);

  function mergeLanguagePacks(packs) {
    const byCode = new Map();
    for (const pack of packs || []) {
      if (!pack || !pack.code) continue;
      byCode.set(pack.code, {
        ...pack,
        status: pack.status || "ready",
        songCount: pack.songCount || (pack.songs || []).length,
        songs: pack.songs || [],
      });
    }
    return [...byCode.values()];
  }

  function refreshLanguageLibrary() {
    data.languagePacks = mergeLanguagePacks([...(baseData.languagePacks || []), ...extraPacks, ...importedPacks]);
  }

  function isBuiltinLanguagePack(code) {
    return [...(baseData.languagePacks || []), ...extraPacks].some((pack) => pack.code === code);
  }

  async function loadImportedLanguagePacks() {
    try {
      if (window.CISPackStore) {
        importedPacks = await window.CISPackStore.migrateLegacyStorage();
      } else {
        importedPacks = loadJson("importedLanguagePacks", []);
      }
    } catch (_error) {
      importedPacks = loadJson("importedLanguagePacks", []);
    }
    refreshLanguageLibrary();
  }

  function persistImportedLanguagePacks() {
    saveJson("importedLanguagePacks", importedPacks);
    if (window.CISPackStore && window.CISPackStore.savePacks) {
      return window.CISPackStore.savePacks(importedPacks).catch(() => {});
    }
    return Promise.resolve();
  }

  function openLanguagePackImportModal() {
    if (!window.CISPackImport) {
      setNotice("Import module failed to load. Refresh the app and try again.");
      return;
    }
    window.CISPackImport.openModal({
      modalRoot: els.modalRoot,
      escapeHtml,
      getImportedPacks: () => importedPacks,
      getAllPacks: () => data.languagePacks,
      isBuiltinPack: isBuiltinLanguagePack,
      onImported: async ({ importedPacks: nextImported, summaryItems }) => {
        importedPacks = nextImported;
        refreshLanguageLibrary();
        await persistImportedLanguagePacks();
        const primary = summaryItems && summaryItems[0];
        if (primary && primary.code) {
          state.languageCode = primary.code;
          saveValue("language", state.languageCode);
        }
        const message = (summaryItems || []).map((item) => {
          if (item.isNew) return `Imported ${item.added} new hymns in ${item.name}`;
          if (item.added) return `Added ${item.added} new hymns in ${item.name}`;
          if (item.updated) return `Updated ${item.updated} hymns in ${item.name}`;
          return `${item.name} now has ${item.total} hymns`;
        }).join(" · ");
        setNotice(message || "Language pack imported.");
        if (window.CISTagCatalog && summaryItems && summaryItems.some((item) => item.isNew || item.added)) {
          openBulkTagModal(primary && primary.code ? primary.code : state.languageCode);
        } else {
          render();
        }
      },
      onClose: () => {
        if (window.CISPackImport && !window.CISPackImport.isOpen()) {
          els.modalRoot.innerHTML = "";
        }
      },
    });
  }

  function createPlanSlot(role, index, overrides = {}) {
    const type = overrides.type || (overrides.songKey ? "hymn" : overrides.itemType ? overrides.itemType : "hymn");
    return {
      id: overrides.id || `slot-${index + 1}`,
      role,
      type,
      itemType: overrides.itemType || (type === "hymn" ? "" : type),
      title: overrides.title || "",
      body: overrides.body || "",
      notes: overrides.notes || "",
      scriptureRef: overrides.scriptureRef || "",
      contentFormat: overrides.contentFormat || "plain",
      songKey: type === "hymn" ? (overrides.songKey || "") : "",
    };
  }

  function createDefaultPlan() {
    return defaultSlots.map((role, index) => createPlanSlot(role, index));
  }

  function createDefaultSongService() {
    return defaultSongServiceSlots.map((role, index) => ({
      id: `song-service-${index + 1}`,
      role,
      songKey: "",
    }));
  }

  function normalizePlanSlot(slot, index, fallbackRole) {
    if (window.CISSlideContent) {
      return window.CISSlideContent.normalizeContentSlot(slot || {}, index, fallbackRole);
    }
    const source = slot || {};
    const isCustom = source.type === "custom" || source.itemType || source.body || source.title;
    return createPlanSlot(source.role || fallbackRole || `Item ${index + 1}`, index, {
      id: source.id || `slot-${index + 1}`,
      type: isCustom ? (source.itemType || "announcement") : "hymn",
      itemType: source.itemType || "",
      title: source.title || "",
      body: source.body || "",
      notes: source.notes || "",
      scriptureRef: source.scriptureRef || "",
      contentFormat: source.contentFormat || "plain",
      songKey: isCustom ? "" : (source.songKey || ""),
    });
  }

  function normalizeWorshipPlan(plan) {
    if (!Array.isArray(plan)) return createDefaultPlan();
    const legacyRoles = new Set([...defaultSlots, "Praise Hymn 1", "Praise Hymn 2"]);
    const looksLikeLegacyDefault = plan.length === defaultSlots.length
      && plan.every((slot) => slot && legacyRoles.has(slot.role || ""))
      && !plan.some((slot) => slot && (slot.type === "custom" || slot.itemType || slot.body || slot.title));
    if (!looksLikeLegacyDefault || plan.length !== defaultSlots.length) {
      return plan.map((slot, index) => normalizePlanSlot(slot, index, slot && slot.role));
    }
    return defaultSlots.map((role, index) => {
      let source = plan.find((slot) => slot && slot.role === role);
      if (role === "Doxology") {
        source = source || plan.find((slot) => slot && ["Praise Hymn 1", "Praise Hymn 2"].includes(slot.role) && slot.songKey);
      }
      return normalizePlanSlot(source, index, role);
    });
  }

  function normalizeSongService(plan) {
    if (!Array.isArray(plan)) return createDefaultSongService();
    return defaultSongServiceSlots.map((role, index) => {
      const source = plan[index] || {};
      return {
        id: `song-service-${index + 1}`,
        role: source.role || role,
        songKey: source.songKey || "",
      };
    });
  }

  function storageKey(key) {
    return STORAGE_PREFIX + key;
  }

  function loadValue(key, fallback) {
    try {
      const value = localStorage.getItem(storageKey(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      localStorage.setItem(storageKey(key), String(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(storageKey(key));
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function plain(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lyricHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function itemTypeLabel(type) {
    if (window.CISSlideContent) {
      const meta = window.CISSlideContent.getSlideType(type);
      return meta ? meta.label : "Service Item";
    }
    return (customItemTypes.find((item) => item[0] === type) || ["", "Service Item"])[1];
  }

  function resolveSlotType(slot) {
    return window.CISSlideContent
      ? window.CISSlideContent.resolveSlotType(slot)
      : (slot && slot.type === "custom" ? slot.itemType || "announcement" : "hymn");
  }

  function isCustomSlot(slot) {
    return window.CISSlideContent
      ? window.CISSlideContent.isCustomContentSlot(slot)
      : !!(slot && (slot.type === "custom" || slot.itemType || slot.body || slot.title));
  }

  function getPack(code = state.languageCode) {
    return data.languagePacks.find((pack) => pack.code === code) || data.languagePacks[0] || { songs: [] };
  }

  function getSongs(code = state.languageCode) {
    return getPack(code).songs || [];
  }

  function paddedNumber(value) {
    return String(value).padStart(3, "0");
  }

  function rangeOptions(pack = getPack()) {
    const songs = pack.songs || [];
    const maxNumber = songs.reduce((max, song) => Math.max(max, Number(song.number) || 0), 0);
    const upper = Math.max(rangeSize, maxNumber);
    const options = [];
    for (let start = 1; start <= upper; start += rangeSize) {
      const end = Math.min(start + rangeSize - 1, upper);
      options.push([`${paddedNumber(start)}-${paddedNumber(end)}`, start, end]);
    }
    return options;
  }

  function activeRangeKey(pack = getPack()) {
    const options = rangeOptions(pack);
    return options.some((range) => range[0] === state.indexRange) ? state.indexRange : options[0][0];
  }

  function makeSongKey(code, number) {
    return `${code}:${number}`;
  }

  function parseSongKey(key) {
    const parts = String(key || "").split(":");
    return { code: parts[0] || state.languageCode, number: parts[1] || "" };
  }

  function getSong(number, code = state.languageCode) {
    return getSongs(code).find((song) => song.number === String(number).padStart(3, "0")) || null;
  }

  function getSongByKey(key) {
    const parsed = parseSongKey(key);
    return getSong(parsed.number, parsed.code);
  }

  function selectedSong() {
    return getSong(state.songNumber);
  }

  function ensureSelectedSong() {
    const songs = getSongs();
    if (!songs.length) return null;
    const found = selectedSong();
    if (found) return found;
    state.songNumber = songs[0].number;
    saveValue("songNumber", state.songNumber);
    return songs[0];
  }

  function viewTitle() {
    if (state.view === "song") {
      const song = selectedSong();
      return song ? `Hymn ${song.number}` : "Hymn";
    }
    const item = navItems.find((nav) => nav.id === state.view);
    return item ? item.label : "Home Dashboard";
  }

  function songKey(song, code = state.languageCode) {
    return makeSongKey(code, song.number);
  }

  function addRecent(song, code = state.languageCode) {
    if (!song) return;
    const key = songKey(song, code);
    recents = [key, ...recents.filter((item) => item !== key)].slice(0, 16);
    saveJson("recents", recents);
  }

  function getTagMeta(tagId) {
    if (window.CISTagCatalog) return window.CISTagCatalog.getTag(tagId);
    const category = categoryDefinitions.find((item) => item.id === tagId);
    return category ? { id: category.id, label: category.label, color: category.color || "#666" } : null;
  }

  function getStoredSongTags(key) {
    return songTagMap[key] || [];
  }

  function getSongTags(song, code = state.languageCode) {
    if (!song) return [];
    const key = makeSongKey(code, song.number);
    const stored = getStoredSongTags(key);
    const embedded = Array.isArray(song.tags) ? song.tags : [];
    const inferred = window.CISTagCatalog ? window.CISTagCatalog.inferTagsFromSong(song) : [];
    const catalog = window.CISTagCatalog;
    const merged = catalog
      ? catalog.normalizeTags([...embedded, ...stored, ...(stored.length ? [] : inferred.slice(0, 3))])
      : [...new Set([...embedded, ...stored])];
    return merged;
  }

  async function loadSongTags() {
    try {
      if (window.CISSongTagsStore) {
        songTagMap = await window.CISSongTagsStore.migrateLegacyStorage();
      } else {
        songTagMap = loadJson("songTags", {});
      }
    } catch (_error) {
      songTagMap = loadJson("songTags", {});
    }
  }

  function persistSongTags() {
    saveJson("songTags", songTagMap);
    if (window.CISSongTagsStore && window.CISSongTagsStore.saveTagMap) {
      return window.CISSongTagsStore.saveTagMap(songTagMap).catch(() => {});
    }
    return Promise.resolve();
  }

  async function loadAutoBackupList() {
    try {
      if (window.CISBackupStore) {
        autoBackupList = await window.CISBackupStore.listAutoBackups();
      } else {
        autoBackupList = [];
      }
    } catch (_error) {
      autoBackupList = [];
    }
  }

  function mergeImportedPacks(incoming, mode) {
    const packs = Array.isArray(incoming) ? incoming : [];
    if (mode === "replace") return packs.slice();
    const byCode = new Map(importedPacks.map((pack) => [pack.code, pack]));
    packs.forEach((pack) => {
      const existing = byCode.get(pack.code);
      if (!existing) {
        byCode.set(pack.code, pack);
        return;
      }
      if (mode !== "merge") return;
      const songsByNumber = new Map((existing.songs || []).map((song) => [song.number, song]));
      (pack.songs || []).forEach((song) => songsByNumber.set(song.number, song));
      const mergedSongs = [...songsByNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
      byCode.set(pack.code, {
        ...existing,
        ...pack,
        songs: mergedSongs,
        songCount: mergedSongs.length,
      });
    });
    return [...byCode.values()];
  }

  function mergeTemplates(incoming, mode) {
    const templates = Array.isArray(incoming) ? incoming : [];
    if (mode === "replace") return templates.slice();
    const byId = new Map(customTemplates.map((template) => [template.id, template]));
    templates.forEach((template) => {
      if (template && template.id) byId.set(template.id, template);
    });
    return [...byId.values()];
  }

  function mergeTagMap(incoming, mode) {
    const next = mode === "replace" ? {} : { ...songTagMap };
    Object.entries(incoming || {}).forEach(([key, tags]) => {
      const existing = next[key] || [];
      const merged = mode === "merge"
        ? (window.CISTagCatalog ? window.CISTagCatalog.normalizeTags([...existing, ...(tags || [])]) : [...new Set([...existing, ...(tags || [])])])
        : (window.CISTagCatalog ? window.CISTagCatalog.normalizeTags(tags || []) : (tags || []));
      if (merged.length) next[key] = merged;
    });
    return next;
  }

  function setupBackupRestore() {
    if (!window.CISBackupRestore) return;
    window.CISBackupRestore.configure({
      escapeHtml,
      modalRoot: els.modalRoot,
      setNotice,
      render,
      gatherSnapshot: async () => ({
        worshipPlan,
        songService,
        favorites: [...favorites],
        recents,
        customTemplates,
        importedLanguagePacks: importedPacks,
        songTags: songTagMap,
        tagFilters: state.tagFilters,
        languageCode: state.languageCode,
        settings: {
          displayMode: state.displayMode,
          fontScale: state.fontScale,
          timerSeconds: state.timerSeconds,
        },
        ui: {
          searchScope: state.searchScope,
          category: state.category,
          indexRange: state.indexRange,
        },
      }),
      describeCurrentData: async () => ({
        components: {
          "worship-plans": `${assignedSlots().length} builder items · ${assignedSongServiceSlots().length} opening songs`,
          favorites: `${favorites.size} favorites · ${recents.length} recent hymns`,
          "language-packs": `${importedPacks.length} imported packs`,
          templates: `${customTemplates.length} templates`,
          tags: `${Object.keys(songTagMap).length} tagged hymns`,
          settings: "current preferences",
        },
      }),
      applyRestore: async (parsed, conflictMap) => {
        const lines = [];
        const data = parsed.data || {};
        const mode = (id) => conflictMap[id] || "merge";

        if (data["worship-plans"] && mode("worship-plans") !== "skip") {
          worshipPlan = normalizeWorshipPlan(data["worship-plans"].worshipPlan || []);
          songService = normalizeSongService(data["worship-plans"].songService || []);
          saveJson("worshipPlan", worshipPlan);
          saveJson("songService", songService);
          lines.push("Worship builders and service plans restored.");
        }

        if (data.favorites && mode("favorites") !== "skip") {
          const incomingFavorites = data.favorites.favorites || [];
          const incomingRecents = data.favorites.recents || [];
          if (mode("favorites") === "merge") {
            favorites = new Set([...favorites, ...incomingFavorites]);
            recents = [...new Set([...incomingRecents, ...recents])].slice(0, 16);
          } else {
            favorites = new Set(incomingFavorites);
            recents = incomingRecents.slice(0, 16);
          }
          saveJson("favorites", [...favorites]);
          saveJson("recents", recents);
          lines.push("Favorites and recent hymns restored.");
        }

        if (data["language-packs"] && mode("language-packs") !== "skip") {
          importedPacks = mergeImportedPacks(
            data["language-packs"].importedLanguagePacks || [],
            mode("language-packs") === "replace" ? "replace" : "merge",
          );
          refreshLanguageLibrary();
          await persistImportedLanguagePacks();
          lines.push(`Imported language packs restored (${importedPacks.length} packs).`);
        }

        if (data.templates && mode("templates") !== "skip") {
          customTemplates = mergeTemplates(
            data.templates.customTemplates || [],
            mode("templates") === "replace" ? "replace" : "merge",
          );
          saveJson("customTemplates", customTemplates);
          await persistCustomTemplates();
          lines.push("Custom templates restored.");
        }

        if (data.tags && mode("tags") !== "skip") {
          songTagMap = mergeTagMap(data.tags.songTags || {}, mode("tags"));
          if (mode("tags") === "replace" && Array.isArray(data.tags.tagFilters)) {
            state.tagFilters = data.tags.tagFilters;
          } else if (Array.isArray(data.tags.tagFilters) && data.tags.tagFilters.length) {
            state.tagFilters = [...new Set([...(state.tagFilters || []), ...data.tags.tagFilters])];
          }
          saveJson("songTags", songTagMap);
          saveJson("tagFilters", state.tagFilters);
          Object.keys(songTagMap).forEach((key) => syncTagsToSongMetadata(key, songTagMap[key]));
          await persistSongTags();
          lines.push("Hymn tags and categories restored.");
        }

        if (data.settings && mode("settings") !== "skip") {
          const incomingSettings = data.settings.settings || {};
          if (incomingSettings.displayMode) {
            state.displayMode = incomingSettings.displayMode;
            saveValue("displayMode", state.displayMode);
          }
          if (incomingSettings.fontScale) {
            state.fontScale = Number(incomingSettings.fontScale) || state.fontScale;
            saveValue("fontScale", state.fontScale);
          }
          if (incomingSettings.timerSeconds) {
            state.timerSeconds = Number(incomingSettings.timerSeconds) || state.timerSeconds;
            saveValue("timerSeconds", state.timerSeconds);
          }
          if (data.settings.languageCode) {
            state.languageCode = data.settings.languageCode;
            saveValue("language", state.languageCode);
          }
          const ui = data.settings.ui || {};
          if (ui.searchScope) {
            state.searchScope = ui.searchScope;
            saveValue("searchScope", state.searchScope);
          }
          if (ui.category) {
            state.category = ui.category;
            saveValue("category", state.category);
          }
          if (ui.indexRange) {
            state.indexRange = ui.indexRange;
            saveValue("range", state.indexRange);
          }
          lines.push("Settings restored.");
        }

        await loadAutoBackupList();
        return { lines };
      },
    });
  }

  function bindBackupSettings() {
    if (state.view !== "settings" || !window.CISBackupRestore) return;
    const panel = document.querySelector(".backup-center");
    if (panel) window.CISBackupRestore.bindSettingsEvents(panel);
  }

  function setupSongTags() {
    if (window.CISSongTagsUI) {
      window.CISSongTagsUI.configure({ escapeHtml, getTagMeta });
    }
  }

  function renderSongTags(song, code = state.languageCode, options = {}) {
    if (!window.CISSongTagsUI) return "";
    return window.CISSongTagsUI.renderTagList(getSongTags(song, code), options);
  }

  function matchesTagFilters(song, code = state.languageCode) {
    const filters = state.tagFilters || [];
    if (!filters.length) return true;
    const tags = getSongTags(song, code);
    return filters.some((tagId) => tags.includes(tagId));
  }

  function suggestSongsForSlot(slot, limit = 6) {
    if (!slot || !window.CISTagCatalog) return [];
    const hints = window.CISTagCatalog.tagsForSlotRole(slot.role || "");
    if (!hints.length) return [];
    const songs = getSongs();
    return songs
      .filter((song) => hints.some((tagId) => getSongTags(song).includes(tagId)))
      .slice(0, limit);
  }

  function suggestSongsLabel(slot) {
    if (!slot) return "Suggested hymns";
    const role = String(slot.role || "").toLowerCase();
    if (role.includes("opening")) return "Suggested opening songs";
    if (role.includes("closing")) return "Suggested closing songs";
    if (role.includes("offering")) return "Suggested offering hymns";
    if (role.includes("prayer")) return "Suggested prayer hymns";
    if (role.includes("communion")) return "Suggested communion hymns";
    if (role.includes("sermon")) return "Suggested worship hymns";
    return `Suggested for ${slot.role}`;
  }

  function openSongTagEditor(song, code = state.languageCode) {
    if (!song || !window.CISSongTagsUI || !window.CISTagCatalog) return;
    const key = makeSongKey(code, song.number);
    els.modalRoot.innerHTML = window.CISSongTagsUI.renderSongTagEditor(
      key,
      `Hymn ${song.number} · ${song.title}`,
      getSongTags(song, code),
      window.CISTagCatalog.getAllTags(),
    );
  }

  function openBulkTagModal(packCode = state.languageCode) {
    if (!window.CISSongTagsUI || !window.CISTagCatalog) return;
    const packs = importedPacks.length ? importedPacks : data.languagePacks.filter((pack) => pack.source && String(pack.source).includes("Imported"));
    const targetPacks = packs.length ? packs : [getPack()];
    els.modalRoot.innerHTML = window.CISSongTagsUI.renderBulkTagModal(
      targetPacks,
      packCode,
      window.CISTagCatalog.getAllTags(),
    );
  }

  function syncTagsToSongMetadata(songKey, tags) {
    const parsed = parseSongKey(songKey);
    const normalized = window.CISTagCatalog ? window.CISTagCatalog.normalizeTags(tags) : tags;
    const applyToPack = (pack) => {
      if (!pack || !Array.isArray(pack.songs)) return false;
      const song = pack.songs.find((item) => item.number === parsed.number);
      if (!song) return false;
      song.tags = normalized;
      return true;
    };
    const pack = data.languagePacks.find((item) => item.code === parsed.code);
    applyToPack(pack);
    const imported = importedPacks.find((item) => item.code === parsed.code);
    if (applyToPack(imported)) persistImportedLanguagePacks();
  }

  async function saveSongTagsFromModal(songKey) {
    if (!window.CISSongTagsUI) return;
    const tags = window.CISSongTagsUI.readCheckedTags(els.modalRoot, ".song-tag-picker");
    songTagMap[songKey] = window.CISTagCatalog.normalizeTags(tags);
    syncTagsToSongMetadata(songKey, songTagMap[songKey]);
    await persistSongTags();
    closeModal();
    setNotice("Hymn tags saved.");
    render();
  }

  async function autoTagSongFromModal(songKey) {
    const parsed = parseSongKey(songKey);
    const song = getSong(parsed.number, parsed.code);
    if (!song || !window.CISTagCatalog) return;
    const inferred = window.CISTagCatalog.inferTagsFromSong(song);
    els.modalRoot.querySelectorAll(".song-tag-picker input[type='checkbox']").forEach((input) => {
      input.checked = inferred.includes(input.value);
      input.closest(".song-tag-option")?.classList.toggle("active", input.checked);
    });
  }

  async function applyBulkTagsFromModal() {
    const packCode = document.getElementById("bulkTagPack")?.value || state.languageCode;
    const mode = document.getElementById("bulkTagMode")?.value || "merge";
    const tags = window.CISSongTagsUI.readCheckedTags(els.modalRoot, "#bulkTagPicker");
    const pack = data.languagePacks.find((item) => item.code === packCode);
    if (!pack || !tags.length) {
      setNotice("Choose a pack and at least one tag.");
      return;
    }
    const keys = (pack.songs || []).map((song) => makeSongKey(pack.code, song.number));
    if (window.CISSongTagsStore) {
      songTagMap = await window.CISSongTagsStore.bulkApplyTags(keys, tags, mode === "replace" ? "replace" : "merge");
    } else {
      keys.forEach((key) => {
        const existing = songTagMap[key] || [];
        songTagMap[key] = mode === "replace"
          ? window.CISTagCatalog.normalizeTags(tags)
          : window.CISTagCatalog.normalizeTags([...existing, ...tags]);
      });
      await persistSongTags();
    }
    keys.forEach((key) => syncTagsToSongMetadata(key, songTagMap[key]));
    closeModal();
    setNotice(`Applied tags to ${keys.length} hymns in ${pack.name}.`);
    render();
  }

  async function autoBulkTagFromModal() {
    const packCode = document.getElementById("bulkTagPack")?.value || state.languageCode;
    const pack = data.languagePacks.find((item) => item.code === packCode);
    if (!pack || !window.CISTagCatalog) return;
    const keys = [];
    for (const song of pack.songs || []) {
      const key = makeSongKey(pack.code, song.number);
      const inferred = window.CISTagCatalog.inferTagsFromSong(song);
      if (inferred.length) {
        songTagMap[key] = window.CISTagCatalog.normalizeTags([...(songTagMap[key] || []), ...inferred]);
        syncTagsToSongMetadata(key, songTagMap[key]);
        keys.push(key);
      }
    }
    await persistSongTags();
    setNotice(`Auto-suggested tags for ${keys.length} hymns in ${pack.name}.`);
    render();
  }

  function searchSongs(query, limit, code = state.languageCode, useCategory = false) {
    const songs = getSongs(code);
    const q = plain(query).toLowerCase();
    const results = q
      ? songs.filter((song) => (song.searchText || `${song.number} ${song.title}`.toLowerCase()).includes(q))
      : songs;
    const filtered = useCategory ? filterByCategory(results, (song) => song, () => code) : results;
    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }

  function allSearchResults(query, limit = 120) {
    const q = plain(query).toLowerCase();
    const results = [];
    for (const pack of data.languagePacks) {
      if (pack.status !== "ready") continue;
      for (const song of pack.songs || []) {
        const haystack = song.searchText || `${song.number} ${song.title}`.toLowerCase();
        if (!q || haystack.includes(q)) results.push({ song, code: pack.code, pack });
      }
    }
    return filterByCategory(results, (item) => item.song, (item) => item.code).slice(0, limit);
  }

  function filterByCategory(items, getSongItem = (item) => item, resolveCode = null) {
    if (!(state.tagFilters || []).length && state.category === "all") return items;
    return items.filter((item) => {
      const song = getSongItem(item);
      const code = resolveCode ? resolveCode(item) : state.languageCode;
      if ((state.tagFilters || []).length) return matchesTagFilters(song, code);
      return matchesCategory(song, state.category, code);
    });
  }

  function matchesCategory(song, categoryId, code = state.languageCode) {
    if (categoryId === "all") return true;
    const tags = getSongTags(song, code);
    if (tags.includes(categoryId)) return true;
    const category = categoryDefinitions.find((item) => item.id === categoryId);
    if (!category || !category.keywords.length) return true;
    const text = (song.searchText || `${song.number} ${song.title}`).toLowerCase();
    return category.keywords.some((keyword) => text.includes(keyword));
  }

  function resultSnippet(song, query) {
    const q = plain(query).toLowerCase();
    const sections = song.sections || [];
    const section = q ? sections.find((item) => item.body.toLowerCase().includes(q)) : sections[0];
    const text = plain((section && section.body) || (sections[0] && sections[0].body) || song.title);
    if (!q) return escapeHtml(text.slice(0, 170));
    const index = text.toLowerCase().indexOf(q);
    if (index < 0) return escapeHtml(text.slice(0, 170));
    const start = Math.max(0, index - 55);
    const end = Math.min(text.length, index + q.length + 95);
    const before = escapeHtml((start > 0 ? "..." : "") + text.slice(start, index));
    const match = escapeHtml(text.slice(index, index + q.length));
    const after = escapeHtml(text.slice(index + q.length, end) + (end < text.length ? "..." : ""));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function rangeSongs(rangeKey, query) {
    const options = rangeOptions();
    const range = options.find((item) => item[0] === rangeKey) || options[0];
    return searchSongs(query).filter((song) => {
      const number = Number(song.number);
      return number >= range[1] && number <= range[2];
    });
  }

  function compactSource(source) {
    return source ? source.replace(/^ppt\/slides\//, "") : "Awaiting upload";
  }

  function slotSong(slot) {
    return slot && slot.songKey ? getSongByKey(slot.songKey) : null;
  }

  function slotHasContent(slot) {
    if (!slot) return false;
    if (isCustomSlot(slot)) {
      const text = window.CISSlideContent ? window.CISSlideContent.plainText(`${slot.title} ${slot.body}`) : plain(`${slot.title} ${slot.body}`);
      return !!text;
    }
    return !!slotSong(slot);
  }

  function slotTitle(slot) {
    if (!slot) return "";
    if (window.CISSlideContent) {
      return window.CISSlideContent.slotTitle(slot, (entry) => {
        const song = slotSong(entry);
        return song ? `Hymn ${song.number} · ${song.title}` : entry.role || "Hymn";
      });
    }
    const song = slotSong(slot);
    if (song) return `Hymn ${song.number} · ${song.title}`;
    return slot.title || slot.role || itemTypeLabel(slot.itemType);
  }

  function slotSubtitle(slot) {
    if (!slot) return "";
    if (window.CISSlideContent) {
      return window.CISSlideContent.slotSubtitle(slot, (entry) => {
        const song = slotSong(entry);
        return song ? `${song.slides.length} slides · ${getPack(parseSongKey(entry.songKey).code).name}` : "Assign a hymn";
      });
    }
    const song = slotSong(slot);
    if (song) return `${song.slides.length} slides · ${getPack(parseSongKey(slot.songKey).code).name}`;
    return `${itemTypeLabel(slot.itemType)} · ${plain(slot.body).slice(0, 80) || "Custom slide"}`;
  }

  function slotSlides(slot) {
    if (window.CISSlideContent) {
      return window.CISSlideContent.buildSlidesFromSlot(slot, (entry) => {
        const song = slotSong(entry);
        return song ? song.slides : [];
      });
    }
    const song = slotSong(slot);
    if (song) return song.slides;
    if (!isCustomSlot(slot)) return [];
    const chunks = String(slot.body || slot.title || slot.role)
      .split(/\n-{3,}\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const slides = chunks.length ? chunks : [slot.title || slot.role || itemTypeLabel(slot.itemType)];
    return slides.map((body, index) => ({
      kind: resolveSlotType(slot),
      label: index === 0 ? itemTypeLabel(slot.itemType) : `${itemTypeLabel(slot.itemType)} ${index + 1}`,
      marker: "",
      body,
      sourceSlide: "Custom",
      slideInHymn: index + 1,
      totalSlides: slides.length,
    }));
  }

  function timerRemaining() {
    if (!state.timerRunning) return Math.max(0, state.timerSeconds);
    return Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  }

  function formatDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function downloadText(filename, text, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function render() {
    ensureSelectedSong();
    renderNav();
    renderLanguageSwitcher();
    els.title.textContent = viewTitle();
    els.content.innerHTML = `${renderNotice()}${renderView()}`;
    renderPresenterAV();
    renderEmergencyOverlay();
    if (state.view === "builder") bindBuilderInteractions();
    bindBackupSettings();
    document.body.classList.add("app-ready");
  }

  function renderNotice() {
    if (!state.notice) return "";
    return `<div class="app-notice" role="status">${escapeHtml(state.notice)}</div>`;
  }

  function setNotice(message) {
    state.notice = message || "";
    render();
    if (message) {
      window.clearTimeout(setNotice.timer);
      setNotice.timer = window.setTimeout(() => {
        if (state.notice === message) {
          state.notice = "";
          render();
        }
      }, 5200);
    }
  }

  function renderNav() {
    els.nav.innerHTML = navItems.map((item) => `
      <button class="rail-btn ${state.view === item.id ? "active" : ""}" type="button" data-view="${item.id}">
        <span class="ico" aria-hidden="true">${item.icon}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `).join("");
  }

  function renderLanguageSwitcher() {
    els.languageSwitcher.innerHTML = data.languagePacks.map((pack) => {
      const active = pack.code === state.languageCode ? "active" : "";
      const status = pack.status === "ready" ? "ready" : "awaiting";
      const label = pack.status === "ready" ? `${pack.name} (${pack.songCount})` : `${pack.name}`;
      return `<button class="language-button ${status} ${active}" type="button" data-lang="${escapeHtml(pack.code)}">${escapeHtml(label)}</button>`;
    }).join("");
  }

  function renderView() {
    if (state.view === "index") return renderIndex();
    if (state.view === "search") return renderSearch();
    if (state.view === "song") return renderSong();
    if (state.view === "builder") return renderBuilder();
    if (state.view === "presenter") return renderPresenterDashboard();
    if (state.view === "favorites") return renderFavorites();
    if (state.view === "settings") return renderSettings();
    return renderHome();
  }

  function renderHome() {
    const pack = getPack();
    const ranges = rangeOptions(pack);
    const readyPacks = data.languagePacks.filter((item) => item.status === "ready").length;
    const firstAssigned = firstAssignedSlot();
    const current = selectedSong();
    const recent = recents.map((key) => ({ key, song: getSongByKey(key) })).find((item) => item.song);
    const favoriteCount = [...favorites].filter((key) => getSongByKey(key)).length;
    const assignedCount = assignedSlots().length;
    return `
      <section class="hero worship-hero">
        <p class="eyebrow">Christ in Song · VaChinoda Edition</p>
        <h2>Your worship, ready to lead.</h2>
        <p>Search, build a Sabbath order of service, and present any hymn full-screen in the navy and gold worship theme.</p>
        <label class="hero-search">
          <span aria-hidden="true">⌕</span>
          <input id="homeSearchInput" type="search" value="" placeholder="Search by number, title, or a line of lyrics...">
        </label>
        <div class="stat-row">
          <div class="stat-chip"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(pack.name || "Language")} hymns</span></div>
          <div class="stat-chip"><strong>${favoriteCount}</strong><span>Favorites</span></div>
          <div class="stat-chip"><strong>${assignedCount}</strong><span>In today's set</span></div>
        </div>
      </section>
      ${recent ? `
        <div class="continue-strip">
          <div>
            <span>Continue reading</span>
            <strong>${escapeHtml(getPack(parseSongKey(recent.key).code).name)} · Hymn ${escapeHtml(recent.song.number)} · ${escapeHtml(recent.song.title)}</strong>
          </div>
          <button type="button" data-song="${escapeHtml(recent.song.number)}" data-lang-jump="${escapeHtml(parseSongKey(recent.key).code)}">Open</button>
        </div>
      ` : ""}
      <div class="dashboard-grid">
        <section class="section">
          <div class="metric-row">
            <div class="metric"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(pack.name || "Language")} hymns</span></div>
            <div class="metric"><strong>${data.meta.deckSlideCount || 0}</strong><span>Source slides integrated</span></div>
            <div class="metric"><strong>${readyPacks}/${data.languagePacks.length}</strong><span>Language packs ready</span></div>
          </div>
          <div class="command-grid">
            ${commandCard("index", "☰", "Hymn Index", "Browse by 50-hymn ranges")}
            ${commandCard("search", "⌕", "Search Centre", "Find titles, numbers, and lyrics")}
            ${commandCard("builder", "+", "Worship Builder", "Prepare the service order")}
            ${commandCard("favorites", "★", "Favorites", "Open saved hymns")}
            ${commandCard("presenter", "▶", "Presenter Dashboard", "Run the current worship flow")}
            ${commandCard("settings", "⚙", "Language Packs", "Manage multilingual hymn libraries")}
          </div>
        </section>
        <aside class="panel">
          <h2>Quick Jump</h2>
          <div class="range-grid">
            ${ranges.map((range) => `<button class="range-button" type="button" data-command="range-open" data-range="${range[0]}">${range[0]}</button>`).join("")}
          </div>
          <hr>
          <h3>Live Service</h3>
          ${firstAssigned ? renderCurrentSlot(firstAssigned) : renderCurrentSong(current)}
          <div class="button-row">
            <button class="action-button" type="button" data-command="present-current">Present</button>
            <button class="secondary-button" type="button" data-view="builder">Worship Builder</button>
          </div>
        </aside>
      </div>
    `;
  }

  function commandCard(view, icon, title, detail) {
    return `
      <button class="command-card" type="button" data-view="${view}">
        <span class="command-icon" aria-hidden="true">${icon}</span>
        <span>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(detail)}</span>
        </span>
      </button>
    `;
  }

  function renderCurrentSong(song) {
    if (!song) return `<div class="empty-state">No hymn selected for this language.</div>`;
    return `
      <div class="result-item" data-song="${song.number}">
        <strong>Current Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
        <small>${song.slides.length} presentation slides</small>
      </div>
    `;
  }

  function renderCurrentSlot(slotInfo) {
    const song = getSongByKey(slotInfo.slot.songKey);
    if (!slotHasContent(slotInfo.slot)) return "";
    return `
      <div class="result-item" ${song ? `data-song="${song.number}" data-lang-jump="${parseSongKey(slotInfo.slot.songKey).code}"` : `data-command="present-plan-slot" data-slot="${slotInfo.index}"`}>
        <strong>${escapeHtml(slotInfo.slot.role)}</strong>
        <span>${escapeHtml(slotTitle(slotInfo.slot))}</span>
        <small>${escapeHtml(slotSubtitle(slotInfo.slot))}</small>
      </div>
    `;
  }

  function renderIndex() {
    const pack = getPack();
    if (pack.status !== "ready") return renderAwaitingPack(pack);
    const ranges = rangeOptions(pack);
    const activeRange = activeRangeKey(pack);
    const songs = rangeSongs(activeRange, state.query);
    return `
      <section class="section">
        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="indexSearchInput" type="search" value="${escapeHtml(state.query)}" placeholder="Search hymns">
          </label>
          <div class="tab-row">
            ${ranges.map((range) => `<button class="range-button ${activeRange === range[0] ? "active" : ""}" type="button" data-command="set-range" data-range="${range[0]}">${range[0]}</button>`).join("")}
          </div>
        </div>
        <div class="tile-grid">
          ${songs.map(renderSongCard).join("") || `<div class="empty-state">No hymns match this search.</div>`}
        </div>
      </section>
    `;
  }

  function renderSongCard(song) {
    const key = songKey(song);
    const starred = favorites.has(key);
    const tags = renderSongTags(song, state.languageCode);
    return `
      <button class="tile song-tile" type="button" data-song="${song.number}">
        ${starred ? '<span class="star" aria-hidden="true">★</span>' : ""}
        <span class="tnum">${escapeHtml(song.number)}</span>
        <span class="ttitle">${escapeHtml(song.title)}</span>
        ${tags ? `<span class="tile-tags">${tags}</span>` : ""}
      </button>
    `;
  }

  function renderSearch() {
    const pack = getPack();
    if (pack.status !== "ready" && state.searchScope !== "all") return renderAwaitingPack(pack);
    const results = state.searchScope === "all"
      ? allSearchResults(state.query, 120)
      : searchSongs(state.query, 80, state.languageCode, true).map((song) => ({ song, code: state.languageCode, pack }));
    return `
      <section class="section">
        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="globalSearchInput" type="search" value="${escapeHtml(state.query)}" placeholder="Search number, title, verse, or chorus">
          </label>
          <div class="segmented-control" aria-label="Search scope">
            <button class="${state.searchScope === "current" ? "active" : ""}" type="button" data-command="set-search-scope" data-scope="current">Current</button>
            <button class="${state.searchScope === "all" ? "active" : ""}" type="button" data-command="set-search-scope" data-scope="all">All Languages</button>
          </div>
          <span class="muted">${results.length} result${results.length === 1 ? "" : "s"}</span>
        </div>
        <div class="filter-row tag-filter-section">
          ${window.CISTagCatalog && window.CISSongTagsUI
            ? window.CISSongTagsUI.renderFilterRow(window.CISTagCatalog.getAllTags(), state.tagFilters)
            : categoryDefinitions.map((category) => `<button class="filter-chip ${state.category === category.id ? "active" : ""}" type="button" data-command="set-category" data-category="${category.id}">${escapeHtml(category.label)}</button>`).join("")}
        </div>
        <div class="result-list">
          ${results.map((item) => renderSearchResult(item.song, item.code, item.pack)).join("") || `<div class="empty-state">No hymns match this search.</div>`}
        </div>
      </section>
    `;
  }

  function renderSearchResult(song, code = state.languageCode, pack = getPack(code)) {
    const tags = renderSongTags(song, code);
    return `
      <button class="result-item" type="button" data-song="${song.number}" data-lang-jump="${escapeHtml(code)}">
        <strong>${escapeHtml(pack.name || "Language")} · Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
        ${tags ? `<div class="result-tags">${tags}</div>` : ""}
        <small>${resultSnippet(song, state.query)}</small>
      </button>
    `;
  }

  function renderSong() {
    const song = ensureSelectedSong();
    if (!song) return renderAwaitingPack(getPack());
    const key = songKey(song);
    const isFavorite = favorites.has(key);
    const slide = song.slides[Math.min(state.slideIndex, song.slides.length - 1)] || song.slides[0];
    const fontSize = Math.round(42 * state.fontScale);
    return `
      <div class="song-layout">
        <section class="section">
          <div class="song-header">
            <div class="song-title-block reader-badge">
              <span class="reader-numtile" aria-hidden="true">${escapeHtml(song.number)}</span>
              <div>
                <p class="eyebrow">${escapeHtml(getPack().name)}</p>
                <h2>${escapeHtml(song.title)}</h2>
                <p class="muted">${song.slides.length} presentation slides · ${song.sections.length} unique sections</p>
                <div class="song-tags-row">
                  ${renderSongTags(song) || `<span class="muted">No categories yet</span>`}
                  <button class="text-button" type="button" data-command="edit-song-tags" data-song="${song.number}">Edit Tags</button>
                </div>
              </div>
            </div>
            <div class="song-actions">
              <button class="secondary-button" type="button" data-command="toggle-favorite">${isFavorite ? "★ Saved" : "☆ Save"}</button>
              <button class="secondary-button" type="button" data-command="open-slot-picker">Add to Set</button>
              <button class="action-button" type="button" data-command="present-song">Present</button>
            </div>
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="set-display" data-mode="slides">Slides</button>
            <button class="secondary-button" type="button" data-command="set-display" data-mode="sections">Sections</button>
            <span class="font-controls">
              <button class="secondary-button" type="button" data-command="font-down" title="Smaller text">A-</button>
              <button class="secondary-button" type="button" data-command="font-reset" title="Reset text">A</button>
              <button class="secondary-button" type="button" data-command="font-up" title="Larger text">A+</button>
            </span>
          </div>
          ${state.displayMode === "sections" ? renderSections(song) : renderSlideStage(song, slide, fontSize)}
        </section>
        <aside class="panel">
          <h3>Slides</h3>
          <div class="slide-list">
            ${song.slides.map((item, index) => renderSlideChip(item, index)).join("")}
          </div>
        </aside>
      </div>
    `;
  }

  function renderSlideStage(song, slide, fontSize) {
    const current = state.slideIndex + 1;
    return `
      <div class="lyric-stage" style="--stage-font: ${fontSize}px">
        <div class="stage-top">
          <div>
            <div class="stage-label">${escapeHtml(slide.label)}</div>
            <div>Hymn ${escapeHtml(song.number)} · ${escapeHtml(song.title)}</div>
          </div>
          <div class="stage-count">${current} of ${song.slides.length}</div>
        </div>
        <div class="lyric-body">${lyricHtml(slide.body)}</div>
        <div class="stage-bottom">
          <button class="stage-nav" type="button" data-command="prev-slide" ${state.slideIndex === 0 ? "disabled" : ""}>‹ Prev</button>
          <span class="stage-count">Source slide ${escapeHtml(slide.sourceSlide)}</span>
          <button class="stage-nav" type="button" data-command="next-slide" ${state.slideIndex >= song.slides.length - 1 ? "disabled" : ""}>Next ›</button>
        </div>
      </div>
    `;
  }

  function renderSlideChip(slide, index) {
    return `
      <button class="slide-chip ${index === state.slideIndex ? "active" : ""}" type="button" data-slide="${index}">
        <strong>${escapeHtml(index + 1)}. ${escapeHtml(slide.label)}</strong>
        <span>${escapeHtml(plain(slide.body).slice(0, 80))}</span>
      </button>
    `;
  }

  function renderSections(song) {
    return `
      <div class="stanza-list">
        ${song.sections.map((section) => `
          <article class="stanza ${section.kind}">
            <div class="slabel">${escapeHtml(section.label)}</div>
            <div class="stext">${lyricHtml(section.body)}</div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function getAllServiceTemplates() {
    return [...builtinTemplates, ...customTemplates];
  }

  function getTemplateById(templateId) {
    return getAllServiceTemplates().find((template) => template.id === templateId) || null;
  }

  async function loadCustomTemplates() {
    try {
      if (window.CISTemplateStore) {
        customTemplates = await window.CISTemplateStore.migrateLegacyStorage();
      } else {
        customTemplates = loadJson("customTemplates", []);
      }
    } catch (_error) {
      customTemplates = loadJson("customTemplates", []);
    }
  }

  function persistCustomTemplates() {
    saveJson("customTemplates", customTemplates);
    if (window.CISTemplateStore && window.CISTemplateStore.saveTemplates) {
      return window.CISTemplateStore.saveTemplates(customTemplates).catch(() => {});
    }
    return Promise.resolve();
  }

  function setupBuilderSlides() {
    if (!window.CISBuilderSlides) return;
    window.CISBuilderSlides.configure({
      escapeHtml,
      plain,
      getSlideTypes: () => (window.CISSlideContent ? window.CISSlideContent.SLIDE_TYPES : []),
    });
    if (window.CISPresenterOutput && window.CISSlideContent) {
      window.CISPresenterOutput.configure({
        escapeHtml,
        lyricHtml,
        richTextHtml: window.CISSlideContent.richTextHtml,
      });
    }
  }

  function setupTemplateSystem() {
    if (window.CISTemplateUI) {
      window.CISTemplateUI.configure({ escapeHtml, plain, itemTypeLabel });
    }
  }

  function bindBuilderInteractions() {
    const list = document.querySelector(".set-list");
    if (list && window.CISTemplateUI) {
      window.CISTemplateUI.bindPlanDragDrop(list, reorderPlanSlots);
    }
  }

  function reorderPlanSlots(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const item = worshipPlan.splice(fromIndex, 1)[0];
    worshipPlan.splice(toIndex, 0, item);
    state.activeSlot = toIndex;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    render();
  }

  function openTemplatePreview(templateId) {
    const template = getTemplateById(templateId);
    if (!template || !window.CISTemplateUI) return;
    els.modalRoot.innerHTML = window.CISTemplateUI.renderPreviewModal(template);
  }

  function openTemplateEditor(templateId = null, fromCurrentPlan = false) {
    if (!window.CISTemplateUI) return;
    if (templateId) {
      const template = customTemplates.find((item) => item.id === templateId);
      if (!template) return;
      templateEditorDraft = {
        id: template.id,
        name: template.name,
        detail: template.detail,
        icon: template.icon || "★",
        slots: template.slots.map((slot) => ({ ...slot })),
      };
    } else if (fromCurrentPlan) {
      templateEditorDraft = {
        id: null,
        name: "",
        detail: `${worshipPlan.length} service items`,
        icon: "★",
        slots: worshipPlan.map((slot) => ({
          role: slot.role,
          type: slot.type || "song",
          itemType: slot.itemType || "",
          title: slot.title || "",
          body: slot.body || "",
        })),
      };
    } else {
      templateEditorDraft = {
        id: null,
        name: "",
        detail: "",
        icon: "★",
        slots: [{ role: "Opening Hymn", type: "song" }],
      };
    }
    renderTemplateEditorModal();
  }

  function renderTemplateEditorModal() {
    if (!templateEditorDraft || !window.CISTemplateUI) return;
    const mode = templateEditorDraft.id ? "edit" : "create";
    els.modalRoot.innerHTML = window.CISTemplateUI.renderEditorModal(templateEditorDraft, customItemTypes, mode);
    window.CISTemplateUI.bindEditorDragDrop(els.modalRoot, (fromIndex, toIndex) => {
      const item = templateEditorDraft.slots.splice(fromIndex, 1)[0];
      templateEditorDraft.slots.splice(toIndex, 0, item);
      renderTemplateEditorModal();
    });
    els.modalRoot.querySelectorAll('[data-editor-field="type"]').forEach((select) => {
      select.addEventListener("change", () => {
        const row = Number(select.dataset.editorRow);
        const slot = templateEditorDraft.slots[row];
        if (!slot) return;
        slot.type = select.value;
        if (slot.type === "custom") {
          slot.itemType = slot.itemType || customItemTypes[0][0];
          slot.title = slot.title || slot.role;
          slot.body = slot.body || slot.title;
        }
        renderTemplateEditorModal();
      });
    });
  }

  async function saveTemplateEditor() {
    if (!templateEditorDraft || !window.CISTemplateUI) return;
    const payload = window.CISTemplateUI.readEditorState(els.modalRoot, customItemTypes);
    if (!payload.name) {
      setNotice("Enter a template name before saving.");
      return;
    }
    if (!payload.slots.length) {
      setNotice("Add at least one service item to the template.");
      return;
    }
    const id = templateEditorDraft.id || `custom-${Date.now()}`;
    const nextTemplate = {
      id,
      name: payload.name,
      detail: payload.detail || `${payload.slots.length} service items`,
      icon: payload.icon || "★",
      category: "custom",
      builtin: false,
      slots: payload.slots,
      updatedAt: Date.now(),
    };
    customTemplates = [
      ...customTemplates.filter((template) => template.id !== id),
      nextTemplate,
    ];
    await persistCustomTemplates();
    templateEditorDraft = null;
    closeModal();
    setNotice(`Saved template “${nextTemplate.name}”.`);
    render();
  }

  async function deleteCustomTemplate(templateId) {
    const template = customTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Delete template “${template.name}”?`)) return;
    customTemplates = customTemplates.filter((item) => item.id !== templateId);
    if (window.CISTemplateStore && window.CISTemplateStore.deleteTemplate) {
      await window.CISTemplateStore.deleteTemplate(templateId).catch(() => {});
    }
    await persistCustomTemplates();
    setNotice(`Deleted template “${template.name}”.`);
    render();
  }

  function renderBuilder() {
    const pack = getPack();
    const current = selectedSong();
    const results = pack.status === "ready" ? searchSongs(state.builderQuery, 32) : [];
    const songServiceAssigned = assignedSongServiceSlots();
    const templateGallery = window.CISTemplateUI
      ? window.CISTemplateUI.renderGallery(builtinTemplates, customTemplates)
      : "";
    const activeWorshipSlot = worshipPlan[state.activeSlot] || worshipPlan[0];
    const activeServiceSlot = songService[state.activeSongServiceSlot] || songService[0];
    const worshipSuggestions = suggestSongsForSlot(activeWorshipSlot);
    const serviceSuggestions = suggestSongsForSlot(activeServiceSlot);
    const renderSuggestionButton = (song) => `
      <button class="suggested-song-button" type="button" data-command="assign-song" data-song="${song.number}">
        <strong>Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
        ${renderSongTags(song) ? `<span class="result-tags">${renderSongTags(song)}</span>` : ""}
      </button>
    `;
    const renderServiceSuggestionButton = (song) => `
      <button class="suggested-song-button" type="button" data-command="assign-service-song" data-song="${song.number}">
        <strong>Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
      </button>
    `;
    const worshipSuggestionBlock = window.CISSongTagsUI
      ? window.CISSongTagsUI.renderSuggestions(suggestSongsLabel(activeWorshipSlot), worshipSuggestions, renderSuggestionButton)
      : "";
    const serviceSuggestionBlock = window.CISSongTagsUI
      ? window.CISSongTagsUI.renderSuggestions(suggestSongsLabel(activeServiceSlot), serviceSuggestions, renderServiceSuggestionButton)
      : "";
    return `
      ${templateGallery}
      <section class="section opens-service">
        <div class="song-header">
          <div>
            <p class="eyebrow">Opens the Service</p>
            <h2>Song Service</h2>
            <p class="muted">Up to fifteen hymns sung to gather the congregation before the main order begins.</p>
          </div>
          <div class="song-actions">
            ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">Use Hymn ${escapeHtml(current.number)}</button>` : ""}
            <button class="action-button" type="button" data-command="present-song-service">Present Song Service</button>
            <button class="secondary-button" type="button" data-command="clear-song-service">Clear Song Service</button>
          </div>
        </div>
        <div class="service-summary">${songServiceAssigned.length} of ${songService.length} opening songs assigned</div>
        <div class="song-service-list">
          ${songService.map(renderSongServiceRow).join("")}
        </div>
      </section>
      <div class="builder-grid">
        <section class="section">
          <div class="song-header">
            <div>
              <h2>Worship Builder</h2>
              <p class="muted">${assignedSlots().length} of ${worshipPlan.length} service items ready</p>
            </div>
            <div class="song-actions">
              <button class="action-button" type="button" data-command="toggle-add-content">Add Content</button>
              <button class="secondary-button" type="button" data-command="save-template">Save as Template</button>
              <button class="secondary-button" type="button" data-command="copy-plan">Copy Builder</button>
              <button class="secondary-button" type="button" data-command="export-plan">Export Builder</button>
              <button class="secondary-button" type="button" data-command="export-bulletin">Export Bulletin</button>
              <button class="secondary-button" type="button" data-command="import-plan">Import Builder</button>
              <button class="secondary-button" type="button" data-command="print-set">Print</button>
              <button class="danger-button" type="button" data-command="clear-plan">Clear</button>
              <input id="worshipPlanImport" class="hidden" type="file" accept="application/json">
            </div>
          </div>
          ${state.showAddContent && window.CISBuilderSlides ? window.CISBuilderSlides.renderAddContentMenu() : ""}
          <p class="muted drag-hint">Drag the ⋮⋮ handle to reorder any item — hymns, scripture, prayers, and more.</p>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>Assign Hymn</h3>
          <p class="muted">Builder: ${escapeHtml(worshipPlan[state.activeSlot]?.role || worshipPlan[0].role)} · Song Service: ${escapeHtml(songService[state.activeSongServiceSlot]?.role || songService[0].role)}</p>
          ${worshipSuggestionBlock}
          ${serviceSuggestionBlock}
          ${current ? `<button class="action-button" type="button" data-command="assign-current">Use Hymn ${escapeHtml(current.number)}</button>` : ""}
          ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">Use Hymn ${escapeHtml(current.number)} in Song Service</button>` : ""}
          <hr>
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="builderSearchInput" type="search" value="${escapeHtml(state.builderQuery)}" placeholder="Find a hymn">
          </label>
          <div class="result-list">
            ${results.map((song) => `
              <div class="result-item result-choice">
                <button type="button" data-command="assign-song" data-song="${song.number}">
                  <strong>Hymn ${escapeHtml(song.number)}</strong>
                  <span>${escapeHtml(song.title)}</span>
                  ${renderSongTags(song) ? `<span class="result-tags">${renderSongTags(song)}</span>` : ""}
                </button>
                <button type="button" data-command="assign-service-song" data-song="${song.number}">Song Service</button>
              </div>
            `).join("") || `<div class="empty-state">No hymns available in this language.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderPlanRow(slot, index) {
    const song = getSongByKey(slot.songKey);
    const custom = isCustomSlot(slot);
    const active = state.activeSlot === index ? "active" : "";
    const typeBadge = window.CISBuilderSlides
      ? window.CISBuilderSlides.renderSlotTypeBadge(slot, resolveSlotType, (type) => window.CISSlideContent.getSlideType(type))
      : "";
    const inlineEditor = active && custom && window.CISBuilderSlides
      ? window.CISBuilderSlides.renderInlineEditor(slot, index, resolveSlotType, (type) => window.CISSlideContent.getSlideType(type), window.CISSlideContent.richTextHtml)
      : "";
    return `
      <div class="set-row ${active} ${custom ? "custom-row" : ""}" data-slot="${index}">
        <button class="drag-handle" type="button" draggable="true" data-drag-slot="${index}" aria-label="Drag to reorder">⋮⋮</button>
        <div class="set-number">${index + 1}</div>
        <button class="slot-button ${active}" type="button" data-command="activate-slot" data-slot="${index}">${escapeHtml(slot.role)}</button>
        <div class="set-song ${slotHasContent(slot) ? "assigned" : ""}">
          ${typeBadge}
          ${slotHasContent(slot) ? `${escapeHtml(slotTitle(slot))}<small>${escapeHtml(slotSubtitle(slot))}</small>` : `<span class="muted">Not configured</span>`}
          ${inlineEditor}
        </div>
        <div class="mini-actions">
          ${slotHasContent(slot) ? `<button type="button" data-command="present-plan-slot" data-slot="${index}" title="Present">▶</button>` : ""}
          ${song ? `<button type="button" data-command="open-plan-song" data-slot="${index}" title="Open">↗</button>` : ""}
          ${custom ? `<button type="button" data-command="edit-slide-item" data-slot="${index}" title="Edit">✎</button>` : ""}
          <button type="button" data-command="move-slot-up" data-slot="${index}" title="Move up">↑</button>
          <button type="button" data-command="move-slot-down" data-slot="${index}" title="Move down">↓</button>
          <button type="button" data-command="remove-slot-song" data-slot="${index}" title="Remove">×</button>
        </div>
      </div>
    `;
  }

  function renderSongServiceRow(slot, index) {
    const song = getSongByKey(slot.songKey);
    const active = state.activeSongServiceSlot === index ? "active" : "";
    return `
      <div class="set-row song-service-row ${active}">
        <div class="set-number">${index + 1}</div>
        <button class="slot-button ${active}" type="button" data-command="activate-service-slot" data-service-slot="${index}">${escapeHtml(slot.role)}</button>
        <div class="set-song ${song ? "assigned" : ""}">${song ? `Hymn ${escapeHtml(song.number)} · ${escapeHtml(song.title)}` : "No hymn assigned"}</div>
        <div class="mini-actions">
          ${song ? `<button type="button" data-command="present-service-slot" data-service-slot="${index}" title="Present">▶</button>` : ""}
          ${song ? `<button type="button" data-command="open-service-song" data-service-slot="${index}" title="Open">↗</button>` : ""}
          <button type="button" data-command="move-service-up" data-service-slot="${index}" title="Move up">↑</button>
          <button type="button" data-command="move-service-down" data-service-slot="${index}" title="Move down">↓</button>
          <button type="button" data-command="remove-service-song" data-service-slot="${index}" title="Remove">×</button>
        </div>
      </div>
    `;
  }

  function assignedSlots() {
    return worshipPlan
      .map((slot, index) => ({ slot, index }))
      .filter((item) => slotHasContent(item.slot));
  }

  function assignedSongServiceSlots() {
    return songService
      .map((slot, index) => ({ slot, index }))
      .filter((item) => item.slot.songKey && getSongByKey(item.slot.songKey));
  }

  function firstAssignedSlot() {
    return assignedSlots()[0] || null;
  }

  function applyEnginePresenterState(engineState) {
    state.presenter.open = engineState.active;
    state.presenter.slideIndex = engineState.slideIndex;
    state.presenter.songKey = engineState.songKey;
    state.presenter.planIndex = engineState.planIndex;
    state.presenter.queueKeys = engineState.queueKeys || [];
    state.presenter.queueIndex = engineState.queueIndex;
  }

  function buildPresenterNextContext(item) {
    if (!item) return { nextSlide: null, nextHymn: null };
    const index = Math.max(0, Math.min(item.slides.length - 1, state.presenter.slideIndex));
    const nextSlide = item.slides[index + 1]
      ? { label: item.slides[index + 1].label, body: item.slides[index + 1].body }
      : null;
    const queuedNextKey = state.presenter.queueIndex !== null ? state.presenter.queueKeys[state.presenter.queueIndex + 1] : "";
    const queuedNextSong = queuedNextKey ? getSongByKey(queuedNextKey) : null;
    const nextSlot = queuedNextSong ? null : nextAssignedSlot(state.presenter.planIndex);
    const nextItem = queuedNextSong
      ? { title: `Hymn ${queuedNextSong.number} · ${queuedNextSong.title}`, slides: queuedNextSong.slides }
      : nextSlot
        ? presenterItemFromSlot(nextSlot.slot, nextSlot.index)
        : null;
    const nextHymn = nextItem
      ? {
          title: nextItem.title,
          firstLine: nextItem.slides && nextItem.slides[0] ? nextItem.slides[0].body : "",
        }
      : null;
    return { nextSlide, nextHymn };
  }

  function presenterCanGoPrev(item) {
    if (!item) return false;
    const index = state.presenter.slideIndex;
    return index > 0
      || (state.presenter.queueIndex !== null && state.presenter.queueIndex > 0)
      || (typeof state.presenter.planIndex === "number" && previousAssignedSlot(state.presenter.planIndex));
  }

  function presenterCanGoNext(item) {
    if (!item) return false;
    const index = state.presenter.slideIndex;
    return index < item.slides.length - 1
      || (state.presenter.queueIndex !== null && state.presenter.queueKeys[state.presenter.queueIndex + 1])
      || nextAssignedSlot(state.presenter.planIndex);
  }

  function presenterMoveCore(delta) {
    const item = currentPresenterItem();
    if (!item) return false;
    const beforeKey = `${state.presenter.songKey}-${state.presenter.slideIndex}-${state.presenter.planIndex}`;
    const next = state.presenter.slideIndex + delta;
    if (next >= 0 && next < item.slides.length) {
      state.presenter.slideIndex = next;
      return beforeKey !== `${state.presenter.songKey}-${state.presenter.slideIndex}-${state.presenter.planIndex}`;
    }
    if (delta > 0) {
      if (state.presenter.queueIndex !== null) {
        const nextKey = state.presenter.queueKeys[state.presenter.queueIndex + 1];
        const nextSong = nextKey ? getSongByKey(nextKey) : null;
        if (nextSong) {
          state.presenter.songKey = nextKey;
          state.presenter.slideIndex = 0;
          state.presenter.queueIndex += 1;
          return true;
        }
        return false;
      }
      const nextSlot = nextAssignedSlot(state.presenter.planIndex);
      if (nextSlot) {
        const nextItem = presenterItemFromSlot(nextSlot.slot, nextSlot.index);
        if (nextItem) {
          state.presenter.songKey = nextSlot.slot.songKey;
          state.presenter.slideIndex = 0;
          state.presenter.planIndex = nextSlot.index;
          state.activeSlot = nextSlot.index;
          saveValue("activeSlot", state.activeSlot);
          return true;
        }
      }
      return false;
    }
    if (state.presenter.queueIndex !== null) {
      const prevKey = state.presenter.queueKeys[state.presenter.queueIndex - 1];
      const prevSong = prevKey ? getSongByKey(prevKey) : null;
      if (prevSong) {
        state.presenter.songKey = prevKey;
        state.presenter.slideIndex = prevSong.slides.length - 1;
        state.presenter.queueIndex -= 1;
        return true;
      }
      return false;
    }
    const prevSlot = previousAssignedSlot(state.presenter.planIndex);
    if (prevSlot) {
      const prevItem = presenterItemFromSlot(prevSlot.slot, prevSlot.index);
      if (prevItem) {
        state.presenter.songKey = prevSlot.slot.songKey;
        state.presenter.slideIndex = prevItem.slides.length - 1;
        state.presenter.planIndex = prevSlot.index;
        state.activeSlot = prevSlot.index;
        saveValue("activeSlot", state.activeSlot);
        return true;
      }
    }
    return false;
  }

  function buildPresenterSessionPatch(overrides = {}) {
    return {
      active: true,
      paused: false,
      displayMode: "lyrics",
      slideIndex: 0,
      songKey: state.presenter.songKey,
      planIndex: state.presenter.planIndex,
      queueKeys: state.presenter.queueKeys,
      queueIndex: state.presenter.queueIndex,
      fontScale: state.fontScale,
      timerSeconds: state.timerSeconds,
      timerRunning: state.timerRunning,
      timerEndsAt: state.timerEndsAt,
      ...overrides,
    };
  }

  function renderPresenterAV() {
    if (!window.CISPresenterEngine || !window.CISPresenterOutput || !window.CISPresenterControl) return;
    applyEnginePresenterState(window.CISPresenterEngine.getState());
    const snapshot = window.CISPresenterEngine.buildSnapshot();
    window.CISPresenterControl.render(els.presenterControlRoot, snapshot);
    if (embeddedProjectorActive) {
      window.CISPresenterOutput.render(els.presenterOutputRoot, snapshot);
    } else {
      window.CISPresenterOutput.render(els.presenterOutputRoot, { active: false });
    }
    document.body.classList.toggle("presenter-live", snapshot.active);
  }

  function setupPresenterSystem() {
    if (!window.CISPresenterEngine) return;
    window.CISPresenterControl.configure({ escapeHtml, plain, formatDuration });
    window.CISPresenterOutput.configure({ escapeHtml, lyricHtml });
    window.CISPresenterEngine.configure({
      currentPresenterItem: () => {
        applyEnginePresenterState(window.CISPresenterEngine.getState());
        return currentPresenterItem();
      },
      nextContext: (_engineState, item) => buildPresenterNextContext(item),
      canGoPrev: (_engineState, item) => presenterCanGoPrev(item),
      canGoNext: (_engineState, item) => presenterCanGoNext(item),
      movePresenter: (engineState, delta) => {
        applyEnginePresenterState(engineState);
        const changed = presenterMoveCore(delta);
        if (changed) {
          engineState.slideIndex = state.presenter.slideIndex;
          engineState.songKey = state.presenter.songKey;
          engineState.planIndex = state.presenter.planIndex;
          engineState.queueKeys = state.presenter.queueKeys;
          engineState.queueIndex = state.presenter.queueIndex;
        }
        return changed;
      },
      onEmbeddedOutput: (enabled) => {
        embeddedProjectorActive = enabled;
        if (enabled) {
          els.presenterOutputRoot.classList.remove("hidden");
          window.CISPresenterOutput.requestFullscreen(els.presenterOutputRoot);
        } else {
          els.presenterOutputRoot.classList.add("hidden");
          if (document.fullscreenElement === els.presenterOutputRoot && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
        renderPresenterAV();
      },
      toggleOutputFullscreen: () => {
        if (embeddedProjectorActive) {
          window.CISPresenterOutput.requestFullscreen(els.presenterOutputRoot);
          return;
        }
        if (window.CISPresenterOutput) window.CISPresenterOutput.requestFullscreen(document.documentElement);
      },
      electronOpenProjector: desktopBridge && desktopBridge.openProjector
        ? async () => {
            embeddedProjectorActive = false;
            await desktopBridge.openProjector();
          }
        : null,
      electronCloseProjector: desktopBridge && desktopBridge.closeProjector
        ? () => desktopBridge.closeProjector()
        : null,
      electronPublish: desktopBridge && desktopBridge.publishPresenterState
        ? (payload) => desktopBridge.publishPresenterState(payload)
        : null,
    });
    window.CISPresenterEngine.subscribe(() => renderPresenterAV());
    if (desktopBridge && desktopBridge.onPresenterClosed) {
      desktopBridge.onPresenterClosed(() => {
        embeddedProjectorActive = true;
        renderPresenterAV();
      });
    }
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === "cis-presenter:closed") {
        embeddedProjectorActive = true;
        renderPresenterAV();
      }
    });
  }

  function startPresenterSession(patch) {
    if (!window.CISPresenterEngine) return;
    state.presenter.open = true;
    window.CISPresenterEngine.openSession(buildPresenterSessionPatch(patch));
    applyEnginePresenterState(window.CISPresenterEngine.getState());
    renderPresenterAV();
  }

  function renderPresenterDashboard() {
    const assigned = assignedSlots();
    const currentInfo = assigned.find((item) => item.index === state.activeSlot) || assigned[0] || null;
    const currentSong = currentInfo ? getSongByKey(currentInfo.slot.songKey) : selectedSong();
    const nextInfo = currentInfo ? assigned.find((item) => item.index > currentInfo.index) : null;
    const remaining = timerRemaining();
    const time = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date());
    return `
      <div class="operator-grid">
        <section class="section">
          <p class="eyebrow">Clock ${escapeHtml(time)}</p>
          <h2>${currentInfo ? `Current: ${escapeHtml(slotTitle(currentInfo.slot))}` : currentSong ? `Current: Hymn ${escapeHtml(currentSong.number)} · ${escapeHtml(currentSong.title)}` : "Current: No hymn selected"}</h2>
          <p class="muted">${nextInfo ? `Next: ${escapeHtml(slotTitle(nextInfo.slot))}` : "Next: Not assigned"}</p>
          <div class="button-row">
            <button class="action-button" type="button" data-command="present-current">Present Current</button>
            <button class="secondary-button" type="button" data-command="presenter-open-output">Open Projector Screen</button>
            <button class="secondary-button" type="button" data-command="emergency-black">Black Screen</button>
            <button class="secondary-button" type="button" data-command="emergency-white">White Screen</button>
            <button class="secondary-button" type="button" data-command="emergency-logo">Logo Screen</button>
          </div>
          <div class="operator-preview-grid">
            <article class="preview-card">
              <span>Current Preview</span>
              <strong>${currentInfo ? escapeHtml(slotTitle(currentInfo.slot)) : currentSong ? `Hymn ${escapeHtml(currentSong.number)}` : "No item"}</strong>
              <p>${escapeHtml(currentInfo ? plain(slotSlides(currentInfo.slot)[0]?.body).slice(0, 170) : currentSong ? plain(currentSong.slides[0]?.body).slice(0, 170) : "Build a service queue first.")}</p>
            </article>
            <article class="preview-card next">
              <span>Next Preview</span>
              <strong>${nextInfo ? escapeHtml(slotTitle(nextInfo.slot)) : "End of queue"}</strong>
              <p>${escapeHtml(nextInfo ? plain(slotSlides(nextInfo.slot)[0]?.body).slice(0, 170) : "No next item assigned.")}</p>
            </article>
            <article class="timer-card">
              <span>Countdown</span>
              <strong>${formatDuration(remaining)}</strong>
              <div class="button-row">
                <button class="secondary-button" type="button" data-command="timer-minus">-5</button>
                <button class="secondary-button" type="button" data-command="timer-plus">+5</button>
                <button class="action-button" type="button" data-command="timer-toggle">${state.timerRunning ? "Pause" : "Start"}</button>
                <button class="secondary-button" type="button" data-command="timer-reset">Reset</button>
              </div>
            </article>
          </div>
          <hr>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>Presenter Queue</h3>
          <div class="result-list">
            ${assigned.map((item) => {
              const song = getSongByKey(item.slot.songKey);
              return `
                <button class="result-item" type="button" data-command="present-plan-slot" data-slot="${item.index}">
                  <strong>${escapeHtml(item.slot.role)}</strong>
                  <span>${escapeHtml(slotTitle(item.slot))}</span>
                  <small>${escapeHtml(song ? `${song.slides.length} slides` : slotSubtitle(item.slot))}</small>
                </button>
              `;
            }).join("") || `<div class="empty-state">Build a worship builder order to create a queue.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderFavorites() {
    const favoriteSongs = [...favorites].map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    const recentSongs = recents.map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    return `
      <div class="dashboard-grid">
        <section class="section">
          <h2>Favorites</h2>
          <div class="tile-grid">
            ${favoriteSongs.map((item) => renderStoredSongCard(item.key, item.song)).join("") || `<div class="empty-state">No favorites saved yet.</div>`}
          </div>
        </section>
        <aside class="panel">
          <h3>Recently Used</h3>
          <div class="result-list">
            ${recentSongs.map((item) => renderStoredResult(item.key, item.song)).join("") || `<div class="empty-state">No recent hymns yet.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderStoredSongCard(key, song) {
    const parsed = parseSongKey(key);
    return `
      <button class="tile song-tile" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}">
        <span class="star" aria-hidden="true">★</span>
        <span class="tnum">${escapeHtml(song.number)}</span>
        <span class="ttitle">${escapeHtml(song.title)}</span>
        <small class="tile-meta">${escapeHtml(getPack(parsed.code).name)}</small>
      </button>
    `;
  }

  function renderStoredResult(key, song) {
    const parsed = parseSongKey(key);
    return `
      <button class="result-item" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}">
        <strong>${escapeHtml(getPack(parsed.code).name)} · Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
      </button>
    `;
  }

  function renderSettings() {
    const backupPanel = window.CISBackupRestore ? window.CISBackupRestore.renderSettingsPanel({
      favorites: favorites.size,
      builderItems: assignedSlots().length,
      importedPacks: importedPacks.length,
      templates: customTemplates.length,
      taggedHymns: Object.keys(songTagMap).length,
      autoBackups: autoBackupList,
    }) : `
      <section class="section">
        <h3>Local Worship Data</h3>
        <div class="button-row">
          <button class="action-button" type="button" data-command="export-backup">Export Backup</button>
          <button class="secondary-button" type="button" data-command="restore-backup">Restore Backup</button>
        </div>
      </section>`;
    return `
      <div class="settings-page">
        <div class="dashboard-grid">
          <section class="section">
            <h2>Language Packs</h2>
            <div class="import-zone" data-command="import-language-pack">
              <strong>Import Language Pack</strong>
              <span>Add hymns in a new language from a JSON pack or PowerPoint file. Drag-and-drop, validation, and duplicate handling are built in.</span>
              <button class="action-button" type="button" data-command="import-language-pack">Import Language Pack</button>
              <span class="muted">Test pack: <code>app/data/sample-packs/ndebele-sample.json</code> (5 Ndebele hymns)</span>
            </div>
            <div class="import-zone tag-tools-zone">
              <strong>Tag & Categorize Hymns</strong>
              <span>Apply worship categories to imported packs in bulk, or refine tags hymn by hymn from the song reader.</span>
              <button class="secondary-button" type="button" data-command="open-bulk-tag">Bulk Tag Hymns</button>
              <span class="muted">${Object.keys(songTagMap).length} hymns tagged across all languages</span>
            </div>
            <div class="language-status">
              ${data.languagePacks.map((pack) => `
                <div class="language-row">
                  <strong>${escapeHtml(pack.name)}</strong>
                  <span class="status-pill ${pack.status === "ready" ? "ready" : "awaiting"}">${pack.status === "ready" ? `${pack.songCount} hymns` : "Awaiting upload"}</span>
                  <span class="muted">${escapeHtml(compactSource(pack.source))}</span>
                </div>
              `).join("")}
            </div>
          </section>
          <aside class="panel">
            <h3>Install & Offline</h3>
            <p class="muted">This app includes a web app manifest and service worker so it can be installed by supported browsers and cached for offline worship use.</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="install-app">Install App</button>
            </div>
            ${desktopBridge ? `
              <hr>
              <h3>Desktop App</h3>
              <p class="muted">Native desktop mode is active${state.desktopInfo ? ` · Version ${escapeHtml(state.desktopInfo.version)} · ${escapeHtml(state.desktopInfo.platform)}` : ""}.</p>
              <div class="button-row">
                <button class="secondary-button" type="button" data-command="check-updates">Check Updates</button>
              </div>
            ` : ""}
            <hr>
            <h3>Source Integration</h3>
            <p class="muted">${escapeHtml((data.meta.generatedFrom || []).join(" + "))}</p>
          </aside>
        </div>
        ${backupPanel}
      </div>
    `;
  }

  function renderAwaitingPack(pack) {
    return `
      <section class="section">
        <div class="empty-state">
          <div>
            <h2>${escapeHtml(pack.name || "Language")} Pack</h2>
            <p>Awaiting hymn upload.</p>
          </div>
        </div>
      </section>
    `;
  }

  function openSong(number, code) {
    if (code && code !== state.languageCode) {
      state.languageCode = code;
      saveValue("language", code);
    }
    const song = getSong(number);
    if (!song) return;
    state.songNumber = song.number;
    state.slideIndex = 0;
    state.view = "song";
    saveValue("songNumber", state.songNumber);
    saveValue("view", state.view);
    addRecent(song);
    render();
  }

  function moveSlide(delta) {
    const song = selectedSong();
    if (!song) return;
    state.slideIndex = Math.max(0, Math.min(song.slides.length - 1, state.slideIndex + delta));
    render();
  }

  function toggleFavorite() {
    const song = selectedSong();
    if (!song) return;
    const key = songKey(song);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveJson("favorites", [...favorites]);
    render();
  }

  function openSlotPicker() {
    const song = selectedSong();
    if (!song) return;
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-command="close-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Add hymn to worship builder">
          <div class="song-header">
            <div>
              <h2>Hymn ${escapeHtml(song.number)}</h2>
              <p class="muted">${escapeHtml(song.title)}</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <div class="slot-picker">
            ${worshipPlan.map((slot, index) => `
              <button class="slot-button" type="button" data-command="slot-add" data-slot="${index}">
                ${escapeHtml(slot.role)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function closeModal() {
    if (window.CISPackImport && window.CISPackImport.isOpen()) {
      window.CISPackImport.closeModal();
      return;
    }
    els.modalRoot.innerHTML = "";
  }

  function assignSongToSlot(index, song) {
    if (!song || !worshipPlan[index]) return;
    worshipPlan[index] = createPlanSlot(worshipPlan[index].role, index, {
      type: "hymn",
      songKey: songKey(song),
    });
    state.activeSlot = index;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    render();
  }

  function openSlideItemEditor(index = null, contentType = null) {
    const slot = typeof index === "number" ? worshipPlan[index] : null;
    const targetIndex = typeof index === "number" ? index : state.activeSlot;
    const type = contentType || (slot ? resolveSlotType(slot) : "scripture");
    const meta = window.CISSlideContent ? window.CISSlideContent.getSlideType(type) : { role: "Service Item", label: "Item" };
    const draft = slot || createPlanSlot(meta.role, targetIndex, { type, itemType: type });
    const suggestions = window.CISSlideContent
      ? window.CISSlideContent.filterScriptureSuggestions(draft.scriptureRef || draft.title)
      : [];
    if (!window.CISBuilderSlides) return openCustomItemEditor(index);
    els.modalRoot.innerHTML = window.CISBuilderSlides.renderEditorModal(
      draft,
      typeof index === "number" ? index : null,
      window.CISSlideContent.SLIDE_TYPES,
      suggestions,
    );
    window.CISBuilderSlides.bindRichEditor(els.modalRoot);
    window.CISBuilderSlides.bindEditorTypeToggle(els.modalRoot, window.CISSlideContent.SLIDE_TYPES);
    els.modalRoot.dataset.editorSlot = typeof index === "number" ? String(index) : "append";
  }

  function saveSlideItemFromModal() {
    if (!window.CISBuilderSlides || !window.CISSlideContent) return saveCustomItemFromModal();
    const target = els.modalRoot.dataset.editorSlot || String(state.activeSlot);
    const payload = window.CISBuilderSlides.readEditorState(els.modalRoot, window.CISSlideContent.sanitizeRichHtml);
    const meta = window.CISSlideContent.getSlideType(payload.type);
    const slot = createPlanSlot(payload.role || meta.role, target === "append" ? worshipPlan.length : Number(target), {
      type: payload.type,
      itemType: payload.type,
      title: payload.title,
      body: payload.body,
      notes: payload.notes,
      scriptureRef: payload.scriptureRef,
      contentFormat: payload.contentFormat,
    });
    if (target === "append") {
      worshipPlan.push(slot);
      state.activeSlot = worshipPlan.length - 1;
    } else {
      worshipPlan[Number(target)] = slot;
      state.activeSlot = Number(target);
    }
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    render();
  }

  function addContentItem(contentType) {
    const meta = window.CISSlideContent ? window.CISSlideContent.getSlideType(contentType) : null;
    if (!meta) return;
    const slot = createPlanSlot(meta.role, worshipPlan.length, {
      type: contentType,
      itemType: contentType,
      title: contentType === "scripture" ? "" : meta.label,
      body: "",
    });
    worshipPlan.push(slot);
    state.activeSlot = worshipPlan.length - 1;
    state.showAddContent = false;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    openSlideItemEditor(state.activeSlot, contentType);
  }

  function openCustomItemEditor(index = null) {
    const slot = typeof index === "number" ? worshipPlan[index] : null;
    const targetIndex = typeof index === "number" ? index : state.activeSlot;
    const itemType = slot && slot.itemType ? slot.itemType : "scripture";
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-command="close-modal">
        <form class="modal form-grid" role="dialog" aria-modal="true" aria-label="Custom service item" data-command="modal-form">
          <div class="song-header">
            <div>
              <h2>${slot ? "Edit Service Item" : "Add Service Item"}</h2>
              <p class="muted">Use three hyphens on a line by themselves to split a custom item into multiple projector slides.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Target slot</span>
            <select id="customItemSlot">
              ${worshipPlan.map((item, planIndex) => `<option value="${planIndex}" ${planIndex === targetIndex ? "selected" : ""}>${planIndex + 1}. ${escapeHtml(item.role)}</option>`).join("")}
              <option value="append">Append as new item</option>
            </select>
          </label>
          <label>
            <span>Item type</span>
            <select id="customItemType">
              ${customItemTypes.map((item) => `<option value="${item[0]}" ${item[0] === itemType ? "selected" : ""}>${escapeHtml(item[1])}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Role in service</span>
            <input id="customItemRole" value="${escapeHtml(slot ? slot.role : itemTypeLabel(itemType))}" placeholder="Scripture Reading">
          </label>
          <label>
            <span>Slide title</span>
            <input id="customItemTitle" value="${escapeHtml(slot ? slot.title : "")}" placeholder="John 14:1-3">
          </label>
          <label class="full">
            <span>Projector text</span>
            <textarea id="customItemBody" rows="8" placeholder="Text to show on the projector">${escapeHtml(slot ? slot.body : "")}</textarea>
          </label>
          <label class="full">
            <span>Private notes</span>
            <textarea id="customItemNotes" rows="3" placeholder="Notes for the worship team">${escapeHtml(slot ? slot.notes : "")}</textarea>
          </label>
          <div class="button-row">
            <button class="action-button" type="button" data-command="save-slide-item">Save Content</button>
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  function saveCustomItemFromModal() {
    const target = document.getElementById("customItemSlot")?.value || String(state.activeSlot);
    const itemType = document.getElementById("customItemType")?.value || "note";
    const role = plain(document.getElementById("customItemRole")?.value) || itemTypeLabel(itemType);
    const title = plain(document.getElementById("customItemTitle")?.value) || role;
    const body = document.getElementById("customItemBody")?.value.trim() || title;
    const notes = document.getElementById("customItemNotes")?.value.trim() || "";
    const slot = createPlanSlot(role, target === "append" ? worshipPlan.length : Number(target), {
      type: itemType,
      itemType,
      title,
      body,
      notes,
      scriptureRef: itemType === "scripture" ? title : "",
      contentFormat: "plain",
    });
    if (target === "append") {
      worshipPlan.push(slot);
      state.activeSlot = worshipPlan.length - 1;
    } else {
      worshipPlan[Number(target)] = slot;
      state.activeSlot = Number(target);
    }
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    render();
  }

  function loadTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return;
    worshipPlan = normalizeWorshipPlan(template.slots);
    state.activeSlot = 0;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    setNotice(`Loaded “${template.name}” template.`);
    render();
  }

  function saveCurrentTemplate() {
    openTemplateEditor(null, true);
  }

  function assignSongToServiceSlot(index, song) {
    if (!song || !songService[index]) return;
    songService[index].songKey = songKey(song);
    state.activeSongServiceSlot = index;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveJson("songService", songService);
    render();
  }

  function moveSlot(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= worshipPlan.length) return;
    const temp = worshipPlan[index];
    worshipPlan[index] = worshipPlan[next];
    worshipPlan[next] = temp;
    state.activeSlot = next;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    render();
  }

  function moveServiceSlot(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= songService.length) return;
    const temp = songService[index];
    songService[index] = songService[next];
    songService[next] = temp;
    state.activeSongServiceSlot = next;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveJson("songService", songService);
    render();
  }

  function presenterItemFromSlot(slot, index) {
    const song = slotSong(slot);
    if (song) {
      const parsed = parseSongKey(slot.songKey);
      return {
        type: "song",
        title: `Hymn ${song.number} · ${song.title}`,
        shortTitle: `Hymn ${song.number}`,
        subtitle: `${getPack(parsed.code).name} · ${slot.role}`,
        slides: song.slides,
        song,
        songKey: slot.songKey,
        planIndex: index,
      };
    }
    if (isCustomSlot(slot)) {
      const type = resolveSlotType(slot);
      const meta = window.CISSlideContent ? window.CISSlideContent.getSlideType(type) : null;
      return {
        type: "custom",
        contentKind: type,
        title: slot.title || slot.role || itemTypeLabel(slot.itemType),
        shortTitle: meta ? meta.label : itemTypeLabel(slot.itemType),
        subtitle: `${slot.role}${slot.scriptureRef ? ` · ${slot.scriptureRef}` : ""}`,
        slides: slotSlides(slot),
        song: null,
        songKey: "",
        planIndex: index,
      };
    }
    return null;
  }

  function currentPresenterItem() {
    if (state.presenter.songKey) {
      const song = getSongByKey(state.presenter.songKey);
      if (!song) return null;
      const parsed = parseSongKey(state.presenter.songKey);
      return {
        type: "song",
        title: `Hymn ${song.number} · ${song.title}`,
        shortTitle: `Hymn ${song.number}`,
        subtitle: getPack(parsed.code).name,
        slides: song.slides,
        song,
        songKey: state.presenter.songKey,
        planIndex: state.presenter.planIndex,
      };
    }
    if (typeof state.presenter.planIndex === "number") {
      return presenterItemFromSlot(worshipPlan[state.presenter.planIndex], state.presenter.planIndex);
    }
    return null;
  }

  function openPresenter(song, planIndex) {
    if (!song) return;
    state.presenter.songKey = songKey(song);
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = typeof planIndex === "number" ? planIndex : null;
    state.presenter.queueKeys = [];
    state.presenter.queueIndex = null;
    addRecent(song);
    startPresenterSession({
      songKey: state.presenter.songKey,
      planIndex: state.presenter.planIndex,
      queueKeys: [],
      queueIndex: null,
      slideIndex: 0,
    });
    render();
  }

  function openCustomPresenter(planIndex) {
    const item = presenterItemFromSlot(worshipPlan[planIndex], planIndex);
    if (!item) return;
    state.presenter.songKey = "";
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = planIndex;
    state.presenter.queueKeys = [];
    state.presenter.queueIndex = null;
    startPresenterSession({
      songKey: "",
      planIndex,
      queueKeys: [],
      queueIndex: null,
      slideIndex: 0,
    });
    render();
  }

  function openPresenterQueue(keys, startIndex = 0) {
    const queueKeys = keys.filter((key) => getSongByKey(key));
    if (!queueKeys.length) return;
    const boundedIndex = Math.max(0, Math.min(queueKeys.length - 1, startIndex));
    const song = getSongByKey(queueKeys[boundedIndex]);
    state.presenter.songKey = queueKeys[boundedIndex];
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = null;
    state.presenter.queueKeys = queueKeys;
    state.presenter.queueIndex = boundedIndex;
    const parsed = parseSongKey(queueKeys[boundedIndex]);
    state.languageCode = parsed.code;
    state.songNumber = parsed.number;
    addRecent(song, parsed.code);
    startPresenterSession({
      songKey: state.presenter.songKey,
      planIndex: null,
      queueKeys,
      queueIndex: boundedIndex,
      slideIndex: 0,
    });
    render();
  }

  function presentCurrent() {
    const assigned = firstAssignedSlot();
    if (assigned) {
      presentPlanSlot(assigned.index);
      return;
    }
    openPresenter(selectedSong(), null);
  }

  function presentPlanSlot(index) {
    const slot = worshipPlan[index];
    if (!slotHasContent(slot)) return;
    if (isCustomSlot(slot)) return openCustomPresenter(index);
    const song = getSongByKey(slot.songKey);
    const parsed = parseSongKey(slot.songKey);
    state.languageCode = parsed.code;
    state.songNumber = song.number;
    state.activeSlot = index;
    saveValue("language", state.languageCode);
    saveValue("songNumber", state.songNumber);
    saveValue("activeSlot", state.activeSlot);
    openPresenter(song, index);
  }

  function presentSongService(startIndex = 0) {
    const assigned = assignedSongServiceSlots();
    if (!assigned.length) return;
    const startPosition = Math.max(0, assigned.findIndex((item) => item.index === startIndex));
    const keys = assigned.map((item) => item.slot.songKey);
    openPresenterQueue(keys, startPosition === -1 ? 0 : startPosition);
  }

  function togglePresenterFullscreen() {
    if (!window.CISPresenterEngine || !window.CISPresenterEngine.getState().active) return;
    if (window.CISPresenterEngine.handleCommand("presenter-fullscreen")) return;
  }

  function presenterMove(delta) {
    if (!window.CISPresenterEngine) return;
    if (window.CISPresenterEngine.moveSlide(delta)) {
      applyEnginePresenterState(window.CISPresenterEngine.getState());
      window.CISPresenterEngine.publishState();
      renderPresenterAV();
    }
  }

  function closePresenter() {
    if (window.CISPresenterEngine) window.CISPresenterEngine.closeSession();
    state.presenter.open = false;
    state.emergencyMode = "";
    embeddedProjectorActive = false;
    render();
  }

  function setEmergency(mode) {
    if (window.CISPresenterEngine && window.CISPresenterEngine.getState().active) {
      window.CISPresenterEngine.setDisplayMode(mode);
      renderPresenterAV();
      return;
    }
    state.emergencyMode = mode;
    renderEmergencyOverlay();
    if (els.emergencyOverlay.requestFullscreen) {
      els.emergencyOverlay.requestFullscreen().catch(() => {});
    }
  }

  function clearEmergency() {
    if (window.CISPresenterEngine && window.CISPresenterEngine.getState().active) {
      window.CISPresenterEngine.setDisplayMode("lyrics");
      renderPresenterAV();
      return;
    }
    state.emergencyMode = "";
    if (document.fullscreenElement === els.emergencyOverlay && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    renderEmergencyOverlay();
  }

  function nextAssignedSlot(index) {
    if (typeof index !== "number") return null;
    return assignedSlots().find((item) => item.index > index) || null;
  }

  function previousAssignedSlot(index) {
    if (typeof index !== "number") return null;
    return [...assignedSlots()].reverse().find((item) => item.index < index) || null;
  }

  function renderEmergencyOverlay() {
    if (!state.emergencyMode) {
      els.emergencyOverlay.className = "emergency-overlay hidden";
      els.emergencyOverlay.setAttribute("aria-hidden", "true");
      els.emergencyOverlay.innerHTML = "";
      return;
    }
    els.emergencyOverlay.className = `emergency-overlay ${state.emergencyMode}`;
    els.emergencyOverlay.setAttribute("aria-hidden", "false");
    els.emergencyOverlay.innerHTML = state.emergencyMode === "logo"
      ? `<div class="emergency-logo"><strong>CHRIST IN SONG</strong><span>VaChinoda Worship</span></div><button class="emergency-return" type="button" data-command="emergency-clear">Return</button>`
      : `<button class="emergency-return" type="button" data-command="emergency-clear">Return</button>`;
  }

  function copyPlan() {
    const lines = worshipPlan.map((slot, index) => {
      const song = getSongByKey(slot.songKey);
      const detail = slotHasContent(slot) ? slotTitle(slot) : song ? `Hymn ${song.number} - ${song.title}` : "Unassigned";
      return `${index + 1}. ${slot.role}: ${detail}`;
    });
    const text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        state.notice = "Worship builder copied.";
        render();
      }).catch(() => window.prompt("Copy worship builder", text));
    } else {
      window.prompt("Copy worship builder", text);
    }
  }

  function exportPlan() {
    const payload = {
      app: "Christ in Song Worship App",
      exportedAt: new Date().toISOString(),
      languageCode: state.languageCode,
      worshipPlan,
      songService,
      favorites: [...favorites],
      recents,
      customTemplates,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`christ-in-song-worship-builder-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportBackup() {
    if (window.CISBackupRestore) return window.CISBackupRestore.exportFullBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      app: "Christ in Song Worship App",
      type: "full-backup",
      exportedAt: new Date().toISOString(),
      languageCode: state.languageCode,
      worshipPlan,
      songService,
      favorites: [...favorites],
      recents,
      customTemplates,
      importedLanguagePacks: importedPacks,
      songTags: songTagMap,
      tagFilters: state.tagFilters,
      settings: {
        displayMode: state.displayMode,
        fontScale: state.fontScale,
        timerSeconds: state.timerSeconds,
      },
    };
    downloadText(`christ-in-song-backup-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportBulletin() {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = worshipPlan.map((slot, index) => {
      const content = slotHasContent(slot) ? slotTitle(slot) : "To be assigned";
      const detail = isCustomSlot(slot) ? plain(slot.body) : slotSubtitle(slot);
      return `<tr><td>${index + 1}</td><td>${escapeHtml(slot.role)}</td><td>${escapeHtml(content)}</td><td>${escapeHtml(detail)}</td></tr>`;
    }).join("");
    const openingSongs = assignedSongServiceSlots().map((item, index) => {
      const song = getSongByKey(item.slot.songKey);
      return `<li>${index + 1}. Hymn ${escapeHtml(song.number)} - ${escapeHtml(song.title)}</li>`;
    }).join("");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Christ in Song Service Bulletin</title>
  <style>
    body{font-family:Arial,sans-serif;margin:40px;color:#131f38}
    h1{font-family:Georgia,serif;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{border:1px solid #d9d4c8;padding:10px;text-align:left;vertical-align:top}
    th{background:#f5efe0}
    td:first-child{width:44px;text-align:center;font-weight:bold}
    .muted{color:#5e6575}
  </style>
</head>
<body>
  <h1>Christ in Song Worship Builder</h1>
  <p class="muted">Generated ${new Date().toLocaleString()}</p>
  ${openingSongs ? `<h2>Song Service</h2><ol>${openingSongs}</ol>` : ""}
  <h2>Order of Service</h2>
  <table>
    <thead><tr><th>#</th><th>Service Item</th><th>Content</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    downloadText(`christ-in-song-service-bulletin-${stamp}.html`, html, "text/html");
  }

  function importPlanFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!Array.isArray(payload.worshipPlan)) throw new Error("Missing worshipPlan");
        worshipPlan = normalizeWorshipPlan(payload.worshipPlan);
        if (Array.isArray(payload.songService)) songService = normalizeSongService(payload.songService);
        if (Array.isArray(payload.favorites)) favorites = new Set(payload.favorites);
        if (Array.isArray(payload.recents)) recents = payload.recents.slice(0, 16);
        if (Array.isArray(payload.customTemplates)) customTemplates = payload.customTemplates;
        saveJson("worshipPlan", worshipPlan);
        saveJson("songService", songService);
        saveJson("favorites", [...favorites]);
        saveJson("recents", recents);
        saveJson("customTemplates", customTemplates);
        persistCustomTemplates().finally(() => render());
        return;
      } catch (error) {
        window.alert("That worship builder file could not be imported.");
      }
    };
    reader.readAsText(file);
  }

  function restoreBackupFromFile(file) {
    if (!file) return;
    if (window.CISBackupRestore && window.CISBackupRestore.restoreFromFile) {
      return window.CISBackupRestore.restoreFromFile(file);
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(payload.worshipPlan)) worshipPlan = normalizeWorshipPlan(payload.worshipPlan);
        if (Array.isArray(payload.songService)) songService = normalizeSongService(payload.songService);
        if (Array.isArray(payload.favorites)) favorites = new Set(payload.favorites);
        if (Array.isArray(payload.recents)) recents = payload.recents.slice(0, 16);
        if (Array.isArray(payload.customTemplates)) customTemplates = payload.customTemplates;
        if (Array.isArray(payload.importedLanguagePacks)) {
          importedPacks = payload.importedLanguagePacks;
          refreshLanguageLibrary();
        }
        if (payload.songTags && typeof payload.songTags === "object") {
          songTagMap = payload.songTags;
          saveJson("songTags", songTagMap);
          persistSongTags();
        }
        if (Array.isArray(payload.tagFilters)) {
          state.tagFilters = payload.tagFilters;
          saveJson("tagFilters", state.tagFilters);
        }
        saveJson("worshipPlan", worshipPlan);
        saveJson("songService", songService);
        saveJson("favorites", [...favorites]);
        saveJson("recents", recents);
        saveJson("customTemplates", customTemplates);
        persistCustomTemplates().finally(() => render());
        return;
      } catch (error) {
        window.alert("That backup file could not be restored.");
      }
    };
    reader.readAsText(file);
  }

  function resetLocalData() {
    favorites = new Set();
    recents = [];
    customTemplates = [];
    importedPacks = [];
    songTagMap = {};
    state.tagFilters = [];
    refreshLanguageLibrary();
    worshipPlan = createDefaultPlan();
    songService = createDefaultSongService();
    saveJson("favorites", []);
    saveJson("recents", []);
    saveJson("customTemplates", []);
    saveJson("importedLanguagePacks", []);
    saveJson("songTags", {});
    saveJson("tagFilters", []);
    saveJson("worshipPlan", worshipPlan);
    saveJson("songService", songService);
    const clearAutoBackups = window.CISBackupStore
      ? window.CISBackupStore.listAutoBackups().then((items) => Promise.all(items.map((item) => window.CISBackupStore.deleteAutoBackup(item.id)))).then(() => loadAutoBackupList())
      : Promise.resolve();
    Promise.all([persistImportedLanguagePacks(), persistCustomTemplates(), persistSongTags(), clearAutoBackups]).finally(() => render());
  }

  function persistTimer() {
    saveValue("timerSeconds", state.timerSeconds);
    saveValue("timerRunning", state.timerRunning);
    saveValue("timerEndsAt", state.timerEndsAt);
  }

  function syncTimerToPresenter() {
    if (!window.CISPresenterEngine || !window.CISPresenterEngine.getState().active) return;
    window.CISPresenterEngine.patchState({
      timerSeconds: state.timerSeconds,
      timerRunning: state.timerRunning,
      timerEndsAt: state.timerEndsAt,
    });
  }

  function adjustTimer(delta) {
    const next = Math.max(60, timerRemaining() + delta);
    state.timerSeconds = next;
    state.timerEndsAt = state.timerRunning ? Date.now() + next * 1000 : 0;
    persistTimer();
    syncTimerToPresenter();
    render();
  }

  function toggleTimer() {
    if (state.timerRunning) {
      state.timerSeconds = timerRemaining();
      state.timerRunning = false;
      state.timerEndsAt = 0;
    } else {
      state.timerRunning = true;
      state.timerEndsAt = Date.now() + Math.max(1, state.timerSeconds) * 1000;
    }
    persistTimer();
    syncTimerToPresenter();
    render();
  }

  function resetTimer() {
    state.timerRunning = false;
    state.timerSeconds = 600;
    state.timerEndsAt = 0;
    persistTimer();
    syncTimerToPresenter();
    render();
  }

  let deferredInstallPrompt = null;

  function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt = null;
      return;
    }
    window.alert("If your browser supports installable web apps, use its Install or Add to Dock menu for this app.");
  }

  function handleDesktopCommand(command) {
    if (!command) return;
    if (command === "show-about") {
      const version = state.desktopInfo?.version || "";
      setNotice(version ? `Christ in Song Worship App · v${version}` : "Christ in Song Worship App");
      return;
    }
    if (command.startsWith("view:")) {
      const view = command.slice(5);
      if (navItems.some((item) => item.id === view)) {
        state.view = view;
        saveValue("view", view);
        render();
      }
      return;
    }
    if (command.startsWith("notice:")) {
      setNotice(command.slice(7));
      return;
    }
    handleCommand(command, { dataset: {} });
  }

  function rerenderKeepingFocus(target) {
    const id = target.id;
    const position = target.selectionStart || target.value.length;
    render();
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      next.setSelectionRange(position, position);
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-view], [data-command], [data-song], [data-lang], [data-slide]");
    if (!target) return;

    const backdrop = event.target.classList.contains("modal-backdrop");
    if (backdrop) {
      closeModal();
      return;
    }

    const lang = target.dataset.lang;
    if (lang) {
      state.languageCode = lang;
      state.slideIndex = 0;
      state.indexRange = activeRangeKey(getPack(lang));
      saveValue("language", lang);
      saveValue("range", state.indexRange);
      render();
      return;
    }

    const view = target.dataset.view;
    if (view) {
      state.view = view;
      saveValue("view", view);
      render();
      return;
    }

    const songNumber = target.dataset.song;
    const command = target.dataset.command;
    if (songNumber && !command) {
      openSong(songNumber, target.dataset.langJump);
      return;
    }

    if (target.dataset.slide) {
      state.slideIndex = Number(target.dataset.slide);
      render();
      return;
    }

    handleCommand(command, target);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "homeSearchInput") {
      state.query = target.value;
      state.view = "search";
      saveValue("view", state.view);
      render();
      return;
    }
    if (target.id === "indexSearchInput" || target.id === "globalSearchInput") {
      state.query = target.value;
      rerenderKeepingFocus(target);
    }
    if (target.id === "builderSearchInput") {
      state.builderQuery = target.value;
      rerenderKeepingFocus(target);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "worshipPlanImport") {
      importPlanFromFile(target.files && target.files[0]);
      target.value = "";
    }
    if (target.id === "backupImport") {
      restoreBackupFromFile(target.files && target.files[0]);
      target.value = "";
    }
    if (target.closest(".song-tag-option")) {
      const option = target.closest(".song-tag-option");
      if (option) option.classList.toggle("active", target.checked);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (state.emergencyMode) {
      if (event.key === "Escape") clearEmergency();
      return;
    }
    if (state.presenter.open || (window.CISPresenterEngine && window.CISPresenterEngine.getState().active)) {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        presenterMove(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        presenterMove(-1);
      }
      if (event.key === "Escape") closePresenter();
      if (event.key.toLowerCase() === "f") togglePresenterFullscreen();
      if (event.key.toLowerCase() === "h") closePresenter();
      if (event.key.toLowerCase() === "b") setEmergency("black");
      if (event.key.toLowerCase() === "w") setEmergency("white");
      if (event.key.toLowerCase() === "l") setEmergency("logo");
      if (event.key.toLowerCase() === "c") clearEmergency();
      if (event.key.toLowerCase() === "p") {
        if (window.CISPresenterEngine) window.CISPresenterEngine.togglePause();
        renderPresenterAV();
      }
      return;
    }
    if (state.view === "song") {
      if (event.key === "ArrowRight") moveSlide(1);
      if (event.key === "ArrowLeft") moveSlide(-1);
    }
  });

  function handleCommand(command, target) {
    const slotIndex = Number(target.dataset.slot);
    const serviceSlotIndex = Number(target.dataset.serviceSlot);
    if (command === "range-open") {
      state.indexRange = target.dataset.range || state.indexRange;
      state.view = "index";
      saveValue("range", state.indexRange);
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "set-range") {
      state.indexRange = target.dataset.range || state.indexRange;
      saveValue("range", state.indexRange);
      render();
      return;
    }
    if (command === "toggle-favorite") return toggleFavorite();
    if (command === "open-slot-picker") return openSlotPicker();
    if (command === "toggle-add-content") {
      state.showAddContent = !state.showAddContent;
      render();
      return;
    }
    if (command === "add-content-item") return addContentItem(target.dataset.contentType);
    if (command === "open-custom-item" || command === "edit-custom-item" || command === "edit-slide-item") {
      return openSlideItemEditor(Number.isNaN(slotIndex) ? null : slotIndex);
    }
    if (command === "save-custom-item" || command === "save-slide-item") return saveSlideItemFromModal();
    if (command === "preview-template") return openTemplatePreview(target.dataset.template);
    if (command === "load-template") return loadTemplate(target.dataset.template);
    if (command === "save-template") return saveCurrentTemplate();
    if (command === "edit-template") return openTemplateEditor(target.dataset.template);
    if (command === "delete-template") return deleteCustomTemplate(target.dataset.template);
    if (command === "open-template-editor") return openTemplateEditor();
    if (command === "save-template-editor") return saveTemplateEditor();
    if (command === "add-editor-row") {
      if (!templateEditorDraft) return;
      templateEditorDraft.slots.push({
        role: `Item ${templateEditorDraft.slots.length + 1}`,
        type: "song",
      });
      renderTemplateEditorModal();
      return;
    }
    if (command === "remove-editor-row") {
      if (!templateEditorDraft) return;
      const rowIndex = Number(target.dataset.editorRow);
      templateEditorDraft.slots.splice(rowIndex, 1);
      if (!templateEditorDraft.slots.length) {
        templateEditorDraft.slots.push({ role: "Opening Hymn", type: "song" });
      }
      renderTemplateEditorModal();
      return;
    }
    if (command === "slot-add") return assignSongToSlot(slotIndex, selectedSong());
    if (command === "set-search-scope") {
      state.searchScope = target.dataset.scope || "current";
      saveValue("searchScope", state.searchScope);
      render();
      return;
    }
    if (command === "set-category") {
      state.category = target.dataset.category || "all";
      state.tagFilters = state.category === "all" ? [] : [state.category];
      saveValue("category", state.category);
      saveJson("tagFilters", state.tagFilters);
      render();
      return;
    }
    if (command === "toggle-tag-filter") {
      const tag = target.dataset.tag;
      if (!tag) return;
      const filters = state.tagFilters || [];
      state.tagFilters = filters.includes(tag) ? filters.filter((item) => item !== tag) : [...filters, tag];
      state.category = state.tagFilters.length === 1 ? state.tagFilters[0] : "all";
      saveJson("tagFilters", state.tagFilters);
      saveValue("category", state.category);
      render();
      return;
    }
    if (command === "clear-tag-filters") {
      state.tagFilters = [];
      state.category = "all";
      saveJson("tagFilters", []);
      saveValue("category", "all");
      render();
      return;
    }
    if (command === "edit-song-tags") {
      const song = getSong(target.dataset.song) || selectedSong();
      return openSongTagEditor(song, state.languageCode);
    }
    if (command === "save-song-tags") return saveSongTagsFromModal(target.dataset.songKey);
    if (command === "auto-tag-song") return autoTagSongFromModal(target.dataset.songKey);
    if (command === "open-bulk-tag") return openBulkTagModal();
    if (command === "apply-bulk-tags") return applyBulkTagsFromModal();
    if (command === "auto-bulk-tag") return autoBulkTagFromModal();
    if (command === "activate-slot") {
      state.activeSlot = slotIndex;
      saveValue("activeSlot", state.activeSlot);
      render();
      return;
    }
    if (command === "activate-service-slot") {
      state.activeSongServiceSlot = serviceSlotIndex;
      saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
      render();
      return;
    }
    if (command === "assign-current") return assignSongToSlot(state.activeSlot, selectedSong());
    if (command === "assign-current-service") return assignSongToServiceSlot(state.activeSongServiceSlot, selectedSong());
    if (command === "assign-song") return assignSongToSlot(state.activeSlot, getSong(target.dataset.song));
    if (command === "assign-service-song") return assignSongToServiceSlot(state.activeSongServiceSlot, getSong(target.dataset.song));
    if (command === "remove-slot-song") {
      if (worshipPlan[slotIndex]) {
        if (isCustomSlot(worshipPlan[slotIndex]) || worshipPlan.length > defaultSlots.length) worshipPlan.splice(slotIndex, 1);
        else worshipPlan[slotIndex] = createPlanSlot(worshipPlan[slotIndex].role, slotIndex);
      }
      saveJson("worshipPlan", worshipPlan);
      state.activeSlot = Math.max(0, Math.min(state.activeSlot, worshipPlan.length - 1));
      render();
      return;
    }
    if (command === "remove-service-song") {
      if (songService[serviceSlotIndex]) songService[serviceSlotIndex].songKey = "";
      saveJson("songService", songService);
      render();
      return;
    }
    if (command === "move-slot-up") return moveSlot(slotIndex, -1);
    if (command === "move-slot-down") return moveSlot(slotIndex, 1);
    if (command === "move-service-up") return moveServiceSlot(serviceSlotIndex, -1);
    if (command === "move-service-down") return moveServiceSlot(serviceSlotIndex, 1);
    if (command === "open-plan-song") {
      const slot = worshipPlan[slotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code);
      }
      return;
    }
    if (command === "open-service-song") {
      const slot = songService[serviceSlotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code);
      }
      return;
    }
    if (command === "present-plan-slot") return presentPlanSlot(slotIndex);
    if (command === "present-service-slot") return presentSongService(serviceSlotIndex);
    if (command === "present-song-service") return presentSongService(0);
    if (command === "copy-plan") return copyPlan();
    if (command === "export-plan") return exportPlan();
    if (command === "export-backup") return exportBackup();
    if (command === "export-bulletin") return exportBulletin();
    if (command === "restore-backup") {
      if (window.CISBackupRestore) return window.CISBackupRestore.openRestoreDialog();
      return;
    }
    if (command === "import-language-pack") return openLanguagePackImportModal();
    if (command === "import-plan") {
      const input = document.getElementById("worshipPlanImport");
      if (input) input.click();
      return;
    }
    if (command === "print-set") return window.print();
    if (command === "clear-plan") {
      worshipPlan = createDefaultPlan();
      saveJson("worshipPlan", worshipPlan);
      render();
      return;
    }
    if (command === "clear-song-service") {
      songService = createDefaultSongService();
      saveJson("songService", songService);
      render();
      return;
    }
    if (command === "reset-local-data") return resetLocalData();
    if (command === "set-display") {
      state.displayMode = target.dataset.mode || "slides";
      saveValue("displayMode", state.displayMode);
      render();
      return;
    }
    if (command === "font-up") {
      state.fontScale = Math.min(1.6, state.fontScale + 0.1);
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "font-down") {
      state.fontScale = Math.max(0.7, state.fontScale - 0.1);
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "font-reset") {
      state.fontScale = 1;
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "timer-plus") return adjustTimer(300);
    if (command === "timer-minus") return adjustTimer(-300);
    if (command === "timer-toggle") return toggleTimer();
    if (command === "timer-reset") return resetTimer();
    if (command === "install-app") return installApp();
    if (command === "check-updates") {
      if (desktopBridge && desktopBridge.checkForUpdates) {
        desktopBridge.checkForUpdates();
        setNotice("Checking for desktop app updates.");
      } else {
        setNotice("Updates are available in the packaged desktop app.");
      }
      return;
    }
    if (command === "next-slide") return moveSlide(1);
    if (command === "prev-slide") return moveSlide(-1);
    if (command === "presenter-pause") {
      if (window.CISPresenterEngine) window.CISPresenterEngine.togglePause();
      renderPresenterAV();
      return;
    }
    if (command === "presenter-open-output") {
      if (window.CISPresenterEngine) {
        window.CISPresenterEngine.openOutputSurface();
        renderPresenterAV();
      }
      return;
    }
    if (command === "present-song") return openPresenter(selectedSong(), null);
    if (command === "present-current" || command === "open-presenter") return presentCurrent();
    if (command === "presenter-next") return presenterMove(1);
    if (command === "presenter-prev") return presenterMove(-1);
    if (command === "presenter-fullscreen") return togglePresenterFullscreen();
    if (command === "close-presenter") return closePresenter();
    if (command === "emergency-black") return setEmergency("black");
    if (command === "emergency-white") return setEmergency("white");
    if (command === "emergency-logo") return setEmergency("logo");
    if (command === "emergency-clear") return clearEmergency();
    if (command === "close-modal") return closeModal();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  function setupDesktopBridge() {
    if (!desktopBridge) return;

    const loadInfo = () => {
      if (electronBridge && electronBridge.getAppInfo) {
        return electronBridge.getAppInfo();
      }
      if (legacyDesktopBridge && legacyDesktopBridge.getAppInfo) {
        return legacyDesktopBridge.getAppInfo();
      }
      if (electronBridge && electronBridge.getAppVersion) {
        return electronBridge.getAppVersion().then((version) => ({
          name: "Christ in Song Worship App",
          version,
          platform: electronBridge.platform || "desktop",
          packaged: true,
        }));
      }
      return Promise.resolve(null);
    };

    loadInfo().then((info) => {
      if (!info) return;
      state.desktopInfo = info;
      if (state.view === "settings") render();
    }).catch(() => {});

    if (electronBridge && electronBridge.onMenuCommand) {
      electronBridge.onMenuCommand(handleDesktopCommand);
    } else if (legacyDesktopBridge && legacyDesktopBridge.onCommand) {
      legacyDesktopBridge.onCommand(handleDesktopCommand);
    }

    if (electronBridge && electronBridge.onUpdateStatus) {
      electronBridge.onUpdateStatus((payload) => {
        if (!payload) return;
        if (payload.status === "downloading") {
          setNotice(`Downloading update… ${payload.percent || 0}%`);
        } else if (payload.status === "downloaded") {
          setNotice(`Update ${payload.version || ""} ready — restart to install.`);
        } else if (payload.status === "available") {
          setNotice(`Update ${payload.version || ""} available.`);
        } else if (payload.status === "error") {
          setNotice(payload.message || "Update check failed.");
        }
      });
    }
  }

  setupDesktopBridge();
  setupTemplateSystem();
  setupBuilderSlides();
  setupPresenterSystem();
  setupSongTags();
  setupBackupRestore();

  Promise.all([loadImportedLanguagePacks(), loadCustomTemplates(), loadSongTags(), loadAutoBackupList()]).finally(() => {
    render();
    if (!data.languagePacks.length) {
      setNotice("Hymn library failed to load. Check app/data/songs.js.");
    }
    if (window.CISBackupRestore) {
      window.CISBackupRestore.maybeRunDailyBackup().then((result) => {
        if (result) {
          loadAutoBackupList().finally(() => {
            setNotice(`Daily backup saved on this device (${result.id}).`);
          });
        }
      }).catch(() => {});
    }
  });
  setInterval(() => {
    if (state.timerRunning && timerRemaining() <= 0) {
      state.timerRunning = false;
      state.timerSeconds = 0;
      persistTimer();
      syncTimerToPresenter();
    }
    if (window.CISPresenterEngine && window.CISPresenterEngine.getState().active) {
      syncTimerToPresenter();
      window.CISPresenterEngine.publishState();
      renderPresenterAV();
      return;
    }
    if (state.view === "presenter" || state.presenter.open) render();
  }, 1000);
})();
