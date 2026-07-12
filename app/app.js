(function () {
  "use strict";

  const STORAGE_PREFIX = "cis-va-chinoda:";

  function t(key, params) {
    return window.CISI18n ? window.CISI18n.t(key, params) : key;
  }

  function navLabel(id) {
    return t(`nav.${id}`);
  }

  function brandAppName() {
    return window.CISBrandConfig ? window.CISBrandConfig.BRAND.appName : "VaChinoda Worship App";
  }

  function brandShortName() {
    return window.CISBrandConfig ? window.CISBrandConfig.BRAND.shortName : "VaChinoda";
  }

  function brandExportPrefix() {
    return window.CISBrandConfig
      ? window.CISBrandConfig.BRAND.exportFilenamePrefix
      : "VaChinoda_Worship_App";
  }

  function setupBranding() {
    if (!window.CISBrandConfig) return;
    const { BRAND } = window.CISBrandConfig;
    document.title = BRAND.appName;
    if (window.CISBrandMigration) window.CISBrandMigration.run(loadJson, saveJson);
    const splash = document.getElementById("launchSplash");
    if (splash) {
      const mark = splash.querySelector(".launch-mark");
      const title = splash.querySelector("strong");
      const subtitle = splash.querySelector("small");
      if (mark) mark.textContent = BRAND.brandMark;
      if (title) title.textContent = BRAND.appName;
      if (subtitle) subtitle.textContent = BRAND.shortName;
    }
    const lockup = document.querySelector(".brand-lockup");
    if (lockup) {
      const mark = lockup.querySelector(".brand-mark");
      const title = lockup.querySelector("strong");
      const subtitle = lockup.querySelector("span");
      if (mark) mark.textContent = BRAND.brandMark;
      if (title) title.textContent = BRAND.appName;
      if (subtitle) subtitle.textContent = BRAND.shortName;
    }
    if (els.topbarEyebrow) els.topbarEyebrow.textContent = t("topbar.eyebrow");
  }

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
    { id: "search", label: "Worship Search", icon: "⌕" },
    { id: "bible", label: "Bible", icon: "✞" },
    { id: "builder", label: "Worship Builder", icon: "+" },
    { id: "presenter", label: "Presenter", icon: "▶" },
    { id: "cameras", label: "Camera Sources", icon: "◎" },
    { id: "favorites", label: "Favorites", icon: "★" },
    { id: "help", label: "Help Centre", icon: "?" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];
  const launchParams = new URLSearchParams(window.location.search);
  const launchView = launchParams.get("view");
  const initialView = navItems.some((item) => item.id === launchView) ? launchView : loadValue("view", "home");

  const els = {
    content: document.getElementById("content"),
    nav: document.getElementById("primaryNav"),
    title: document.getElementById("pageTitle"),
    topbarEyebrow: document.querySelector(".topbar .eyebrow"),
    uiLocaleSwitcher: document.getElementById("uiLocaleSwitcher"),
    hymnBookSwitcher: document.getElementById("hymnBookSwitcher"),
    hymnEditionSwitcher: document.getElementById("hymnEditionSwitcher"),
    topbarPresenterBtn: document.getElementById("topbarPresenterBtn"),
    topbarHelpBtn: document.getElementById("topbarHelpBtn"),
    topbarEmergencyBtn: document.getElementById("topbarEmergencyBtn"),
    modalRoot: document.getElementById("modalRoot"),
    helpContextRoot: document.getElementById("helpContextRoot"),
    presenterControlRoot: document.getElementById("presenterControlRoot"),
    presenterOutputRoot: document.getElementById("presenterOutputRoot"),
    presenterOverlay: document.getElementById("presenterOverlay"),
    emergencyOverlay: document.getElementById("emergencyOverlay"),
    obsStatusRoot: document.getElementById("obsStatusRoot"),
    operatorStatusRoot: document.getElementById("operatorStatusRoot"),
    quietServiceModeRoot: document.getElementById("quietServiceModeRoot"),
  };

  let embeddedProjectorActive = false;
  let uiLocaleMenuOpen = false;
  let hymnBookMenuOpen = false;
  let hymnEditionMenuOpen = false;
  let indexBookMenuOpen = false;
  let indexEditionMenuOpen = false;
  let hymnalBooks = [];
  let bibleReaderState = { loading: false, error: "", bookPayload: null, chapterPayload: null };
  let bibleLoadedKey = "";

  const hymnalSelection = window.CISHymnalLibrarySettings
    ? window.CISHymnalLibrarySettings.load((key, fallback) => loadValue(key, fallback), (key, fallback) => loadJson(key, fallback))
    : { hymnBookId: "christ-in-song", editionId: "christ-in-song-zulu" };

  const state = {
    view: initialView,
    uiLocale: window.CISI18n ? window.CISI18n.getLocale() : "en",
    hymnBookId: hymnalSelection.hymnBookId,
    editionId: hymnalSelection.editionId,
    languageCode: loadValue("language", window.CISHymnalMigration
      ? (window.CISHymnalMigration.resolveLegacyCodeFromEdition(hymnalSelection.editionId) || "zu")
      : "zu"),
    songNumber: loadValue("songNumber", "001"),
    indexRange: loadValue("range", "001-050"),
    query: "",
    builderQuery: "",
    searchScope: (() => {
      const saved = loadValue("searchScope", "edition");
      return saved === "current" ? "edition" : saved;
    })(),
    category: loadValue("category", "all"),
    tagFilters: loadJson("tagFilters", []),
    activeSlot: Number(loadValue("activeSlot", 0)) || 0,
    activeSongServiceSlot: Number(loadValue("activeSongServiceSlot", 0)) || 0,
    slideIndex: 0,
    displayMode: loadValue("displayMode", "slides"),
    fontScale: Number(loadValue("fontScale", 1)) || 1,
    notice: "",
    noticeLevel: "",
    shortcutReferenceQuery: "",
    searchReturnView: "",
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
    showOrderPreview: loadValue("showOrderPreview", "false") === "true",
    practiceMode: false,
    obsUrls: {},
    obsHeartbeat: {},
    stageDisplayDisplays: [],
    help: {
      category: "",
      articleId: "",
      nav: "",
      searchQuery: "",
      contextKey: "",
      history: [],
    },
    bibleTranslation: loadValue("bibleTranslation", "KJV"),
    bibleBookOrder: Number(loadValue("bibleBookOrder", 43)) || 43,
    bibleChapter: Number(loadValue("bibleChapter", 1)) || 1,
    bibleVerse: Number(loadValue("bibleVerse", 0)) || 0,
    bibleMode: loadValue("bibleMode", "live"),
    bibleSermonMode: loadValue("bibleSermonMode", "false") === "true",
    indexDisplay: window.CISHymnIndexSettings
      ? window.CISHymnIndexSettings.load(null, (key, fallback) => loadJson(key, fallback))
      : {
        layout: "grid",
        showCategories: true,
        showTitles: true,
        showFavorites: true,
        density: "comfortable",
        sort: "number-asc",
      },
  };

  let favorites = new Set(loadJson("favorites", []));
  let recents = loadJson("recents", []);
  let customTemplates = [];
  let templateEditorDraft = null;
  let songTagMap = {};
  let autoBackupList = [];
  let hymnAudioPlayer = null;
  let loadedAudioSongKey = "";
  let songAudioMeta = null;
  let audioDockState = { currentTime: 0 };
  let indexSearchSession = null;
  let biblePhraseSearchSession = null;
  let firstRenderMarked = false;
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

  function resolveEditionPackCode(editionId = state.editionId) {
    const edition = getEdition(editionId);
    if (edition && edition.packCode) return edition.packCode;
    if (window.CISHymnalMigration) {
      const legacy = window.CISHymnalMigration.resolveLegacyCodeFromEdition(editionId);
      if (legacy) return legacy;
    }
    const pack = data.languagePacks.find((item) => item.editionId === editionId);
    return pack ? pack.code : state.languageCode;
  }

  function getEdition(editionId = state.editionId) {
    for (const book of hymnalBooks) {
      const edition = (book.editions || []).find((item) => item.editionId === editionId);
      if (edition) return edition;
    }
    return window.CISHymnalLibraryStore ? window.CISHymnalLibraryStore.getEditionById(editionId) : null;
  }

  function getBook(hymnBookId = state.hymnBookId) {
    return hymnalBooks.find((book) => book.hymnBookId === hymnBookId) || null;
  }

  function persistHymnalSelection() {
    if (!window.CISHymnalLibrarySettings) return;
    window.CISHymnalLibrarySettings.save(
      { hymnBookId: state.hymnBookId, editionId: state.editionId },
      saveJson,
      saveValue,
    );
  }

  function migrateLegacySongKeys() {
    if (!window.CISHymnalMigration) return;
    const map = window.CISHymnalMigration.editionIdByLegacyCodeMap();
    favorites = new Set(window.CISHymnalMigration.migrateKeyList([...favorites], map));
    recents = window.CISHymnalMigration.migrateKeyList(recents, map);
    songTagMap = window.CISHymnalMigration.migrateSongKeyMap(songTagMap, map);
    worshipPlan = worshipPlan.map((slot) => ({
      ...slot,
      songKey: slot.songKey ? window.CISHymnalMigration.migrateSongKey(slot.songKey, map) : "",
    }));
    songService = songService.map((slot) => ({
      ...slot,
      songKey: slot.songKey ? window.CISHymnalMigration.migrateSongKey(slot.songKey, map) : "",
    }));
    saveJson("favorites", [...favorites]);
    saveJson("recents", recents);
    saveJson("songTags", songTagMap);
    saveJson("worshipPlan", worshipPlan);
    saveJson("songService", songService);
  }

  async function loadHymnalLibrary() {
    if (!window.CISHymnalLibraryStore) return;
    let legacyImported = [];
    try {
      if (window.CISPackStore) legacyImported = await window.CISPackStore.getAllPacks();
    } catch (_error) {
      legacyImported = importedPacks;
    }
    await window.CISHymnalLibraryStore.initializeLibrary({
      baseData,
      extraPacks,
      legacyImportedPacks: legacyImported,
    });
    hymnalBooks = await window.CISHymnalLibraryStore.getBooksWithEditions();
    importedPacks = await window.CISHymnalLibraryStore.getImportedPacksForLegacyApi();
    refreshLanguageLibrary({ fullIndex: true });
    ensureActiveEdition();
  }

  function ensureActiveEdition() {
    const book = getBook(state.hymnBookId) || hymnalBooks[0];
    if (book) state.hymnBookId = book.hymnBookId;
    const editions = book ? (book.editions || []) : [];
    const edition = editions.find((item) => item.editionId === state.editionId) || editions[0];
    if (edition) {
      state.editionId = edition.editionId;
      state.languageCode = resolveEditionPackCode(edition.editionId);
      saveValue("language", state.languageCode);
      persistHymnalSelection();
    }
  }

  async function selectHymnBook(hymnBookId) {
    const book = getBook(hymnBookId);
    if (!book) return;
    state.hymnBookId = book.hymnBookId;
    const edition = (book.editions || [])[0];
    if (edition) await selectEdition(edition.editionId, edition.packCode || edition.languageCode);
    else render();
  }

  async function selectEdition(editionId, packCode) {
    const code = packCode || resolveEditionPackCode(editionId);
    if (!(await ensureLanguagePackLoaded(code))) return;
    const edition = getEdition(editionId);
    state.editionId = editionId;
    state.hymnBookId = edition ? edition.hymnBookId : state.hymnBookId;
    state.languageCode = code;
    state.slideIndex = 0;
    state.indexRange = activeRangeKey(getPack(code));
    saveValue("language", code);
    saveValue("range", state.indexRange);
    persistHymnalSelection();
    indexReadyPacks([code]);
    const pack = data.languagePacks.find((item) => item.editionId === editionId || item.code === code);
    if (pack && window.CISSearchEngine) window.CISSearchEngine.ensurePackIndexed(pack);
    render();
  }

  function hymnalSelectorContext(menuScope = "topbar") {
    const book = getBook(state.hymnBookId);
    return {
      books: hymnalBooks,
      editions: book ? (book.editions || []) : [],
      hymnBookId: state.hymnBookId,
      editionId: state.editionId,
      bookMenuOpen: menuScope === "index" ? indexBookMenuOpen : hymnBookMenuOpen,
      editionMenuOpen: menuScope === "index" ? indexEditionMenuOpen : hymnEditionMenuOpen,
    };
  }

  function setupHymnalLibrary() {
    if (window.CISHymnalImportService) {
      window.CISHymnalImportService.configure({
        getImportedPacks: () => importedPacks,
        getAllPacks: () => data.languagePacks,
        getBooksWithEditions: () => hymnalBooks,
        isBuiltinPack: isBuiltinLanguagePack,
        onImported: async ({ importedPacks: nextImported, summaryItems, hymnBookId, editionId }) => {
          importedPacks = nextImported;
          hymnalBooks = window.CISHymnalLibraryStore
            ? await window.CISHymnalLibraryStore.getBooksWithEditions()
            : hymnalBooks;
          refreshLanguageLibrary({ fullIndex: true });
          await persistImportedLanguagePacks();
          if (editionId) await selectEdition(editionId, summaryItems && summaryItems[0] ? summaryItems[0].code : undefined);
          else if (hymnBookId) await selectHymnBook(hymnBookId);
          const completed = editionId ? validateImportCompletion(editionId) : true;
          const message = (summaryItems || []).map((item) => {
            if (item.isNew) return `Imported ${item.added} new hymns in ${item.name}`;
            if (item.added) return `Added ${item.added} new hymns in ${item.name}`;
            if (item.updated) return `Updated ${item.updated} hymns in ${item.name}`;
            return `${item.name} now has ${item.total} hymns`;
          }).join(" · ");
          setNotice(completed
            ? (message || t("notice.packImported"))
            : `${message || t("notice.packImported")} · Import checklist incomplete — check Settings`);
          if (window.CISTagCatalog && summaryItems && summaryItems.some((item) => item.isNew || item.added)) {
            openBulkTagModal(state.languageCode);
          } else {
            render();
          }
        },
      });
    }
    if (window.CISHymnalDeletionService) {
      window.CISHymnalDeletionService.configure({
        escapeHtml,
        getReferenceData: getHymnalReferenceData,
        applyReferencePatch: applyHymnalReferencePatch,
        openModal: (html) => { els.modalRoot.innerHTML = html; },
        setNotice,
        createBackup: async (label) => {
          if (window.CISBackupRestore && window.CISBackupRestore.createAutoBackup) {
            return window.CISBackupRestore.createAutoBackup(label);
          }
          return null;
        },
      });
    }
    if (window.CISHymnalLibraryUI) {
      window.CISHymnalLibraryUI.configure({ escapeHtml });
    }
  }

  function getDeferredPackPlaceholders() {
    if (!window.CISLazyLoader || !window.CISLazyLoader.DEFERRED_PACK_META) return [];
    return Object.entries(window.CISLazyLoader.DEFERRED_PACK_META)
      .filter(([code]) => !window.CISLazyLoader.isPackLoaded(code))
      .map(([, meta]) => ({ ...meta, songs: [] }));
  }

  function refreshLanguageLibrary(options = {}) {
    if (window.CISHymnalLibraryStore && hymnalBooks.length) {
      const packs = [];
      for (const book of hymnalBooks) {
        for (const edition of book.editions || []) {
          packs.push(window.CISHymnalLibraryStore.editionToLanguagePack(edition));
        }
      }
      data.languagePacks = mergeLanguagePacks([
        ...packs,
        ...getDeferredPackPlaceholders().filter((placeholder) => !packs.some((pack) => pack.code === placeholder.code)),
      ]);
    } else {
      data.languagePacks = mergeLanguagePacks([
        ...(baseData.languagePacks || []),
        ...getDeferredPackPlaceholders(),
        ...extraPacks,
        ...importedPacks,
      ]);
    }
    if (!window.CISSearchEngine) return;
    if (options.fullIndex) {
      window.CISSearchEngine.rebuildIndex(data.languagePacks, { clear: true });
      return;
    }
    const packCode = options.packCode || resolveEditionPackCode(state.editionId);
    if (options.packCode || options.editionId) {
      const editionKey = options.editionId || state.editionId;
      const pack = data.languagePacks.find((item) => item.editionId === editionKey || item.code === packCode);
      if (pack) window.CISSearchEngine.ensurePackIndexed(pack);
      return;
    }
    if (options.invalidateCode) {
      window.CISSearchEngine.invalidatePack(options.invalidateCode);
      const edition = getEdition(state.editionId);
      if (edition && edition.editionId) window.CISSearchEngine.invalidatePack(edition.editionId);
    }
  }

  function indexReadyPacks(codes) {
    if (!window.CISSearchEngine) return;
    const targets = codes && codes.length
      ? data.languagePacks.filter((pack) => codes.includes(pack.code))
      : data.languagePacks;
    for (const pack of targets) {
      if (pack.status === "ready") window.CISSearchEngine.ensurePackIndexed(pack);
    }
  }

  function scheduleBackgroundWarmup() {
    if (!window.CISLazyLoader) return;
    const quiet = window.CISQuietServiceModeService;
    if (quiet?.shouldPauseBackgroundTask?.(quiet.BACKGROUND_TASKS.lazyPreload)) return;
    window.CISLazyLoader.scheduleIdlePreload(() => {
      if (quiet?.shouldPauseBackgroundTask?.(quiet.BACKGROUND_TASKS.lazyPreload)) return;
      window.CISLazyLoader.preloadDeferredPacks(["sda"]).then(() => {
        refreshLanguageLibrary();
        if (!quiet?.shouldPauseBackgroundTask?.(quiet.BACKGROUND_TASKS.indexing)) {
          indexReadyPacks(["sda"]);
        }
        render();
      }).catch(() => {});
    });
    window.CISLazyLoader.scheduleIdlePreload(() => {
      if (quiet?.shouldPauseBackgroundTask?.(quiet.BACKGROUND_TASKS.indexing)) return;
      const pending = data.languagePacks
        .filter((pack) => pack.status === "ready")
        .map((pack) => pack.code)
        .filter((code) => !window.CISSearchEngine.getIndexedPackCodes().includes(code));
      if (pending.length) indexReadyPacks(pending);
    }, 8000);
  }

  async function ensureLanguagePackLoaded(code) {
    if (!window.CISLazyLoader || !window.CISLazyLoader.isPackDeferred(code)) return true;
    if (window.CISLazyLoader.isPackLoaded(code)) {
      refreshLanguageLibrary();
      return true;
    }
    try {
      await window.CISLazyLoader.ensurePackLoaded(code);
      refreshLanguageLibrary();
      return true;
    } catch (_error) {
      setNotice("Could not load that language pack. Check your connection and try again.");
      return false;
    }
  }

  async function ensureSearchIndexReady() {
    if (window.CISLazyLoader) {
      await window.CISLazyLoader.preloadDeferredPacks(["sda"]).catch(() => {});
      refreshLanguageLibrary();
    }
    indexReadyPacks();
  }

  async function ensurePdfToolsReady() {
    if (!window.CISLazyLoader) return Boolean(window.CISBulletinExport);
    try {
      await window.CISLazyLoader.ensureBundle("pdfmake");
      return Boolean(window.CISBulletinExport);
    } catch (_error) {
      return false;
    }
  }

  async function ensureMidiReady() {
    if (!window.CISLazyLoader) return typeof window.Midi !== "undefined";
    try {
      await window.CISLazyLoader.ensureBundle("midi");
      return typeof window.Midi !== "undefined";
    } catch (_error) {
      return false;
    }
  }

  function setupHymnAudio() {
    if (!window.CISHymnAudioUI || !window.CISHymnAudioPlayer || !window.CISSongAudioStore) return;
    hymnAudioPlayer = window.CISHymnAudioPlayer.createPlayer();
    hymnAudioPlayer.onStateChange = (playerState) => {
      audioDockState = { ...playerState, currentTime: audioDockState.currentTime || 0 };
      paintAudioDock();
    };
    hymnAudioPlayer.onTimeUpdate = (currentTime) => {
      audioDockState.currentTime = currentTime;
      paintAudioDock(false);
    };
    hymnAudioPlayer.onSectionChange = (section) => {
      if (!section) return;
      state.slideIndex = section.startSlide;
      paintAudioDock(false);
      if (state.view === "song") {
        const activeChip = document.querySelector(`.slide-chip[data-slide="${section.startSlide}"]`);
        document.querySelectorAll(".slide-chip.active").forEach((chip) => chip.classList.remove("active"));
        if (activeChip) activeChip.classList.add("active");
        const stageLabel = document.querySelector(".stage-label");
        const lyricBody = document.querySelector(".lyric-body");
        const song = selectedSong();
        const slide = song && song.slides[section.startSlide];
        if (stageLabel && slide) stageLabel.textContent = slide.label;
        if (lyricBody && slide) lyricBody.innerHTML = lyricHtml(slide.body);
      }
    };
    window.CISHymnAudioUI.configure({
      escapeHtml,
      modalRoot: els.modalRoot,
      getHandlers: () => hymnAudioHandlers(),
      onUploadFile: (file) => handleHymnAudioUpload(file),
    });
  }

  function hymnAudioHandlers() {
    return {
      togglePlay: () => hymnAudioPlayer && hymnAudioPlayer.togglePlay(),
      nextVerse: () => {
        if (!hymnAudioPlayer) return;
        const section = hymnAudioPlayer.nextVerse();
        if (section) {
          state.slideIndex = section.startSlide;
          render();
        }
      },
      setVolume: (value) => hymnAudioPlayer && hymnAudioPlayer.setVolume(value),
      stepTempo: (delta) => hymnAudioPlayer && hymnAudioPlayer.stepTempo(delta),
      setPracticeLoop: (enabled) => hymnAudioPlayer && hymnAudioPlayer.setPracticeLoop(enabled),
      setLoopSection: (index) => hymnAudioPlayer && hymnAudioPlayer.setLoopSection(index),
      openUpload: () => {
        const song = selectedSong();
        if (!song || !window.CISHymnAudioUI) return;
        window.CISHymnAudioUI.openUploadModal(`Hymn ${song.number} · ${song.title}`, songAudioMeta);
      },
      removeAudio: () => removeHymnAudio(),
    };
  }

  async function ensureSongAudioLoaded(song, key) {
    if (!hymnAudioPlayer || !window.CISSongAudioStore) return;
    if (loadedAudioSongKey === key && songAudioMeta) return;
    hymnAudioPlayer.stop();
    songAudioMeta = null;
    loadedAudioSongKey = key;
    audioDockState = { currentTime: 0 };
    const meta = await window.CISSongAudioStore.getAudioMeta(key);
    if (!meta) return;
    const blob = await window.CISSongAudioStore.getAudioBlob(key);
    if (!blob) return;
    songAudioMeta = meta;
    await hymnAudioPlayer.load({ blob, meta, song });
    audioDockState = { ...hymnAudioPlayer.getState(), currentTime: 0 };
  }

  function paintAudioDock(rebind = true) {
    const root = document.getElementById("hymnAudioDock");
    if (!root || !window.CISHymnAudioUI || !hymnAudioPlayer) return;
    const song = selectedSong();
    const statePayload = {
      ...hymnAudioPlayer.getState(),
      currentTime: audioDockState.currentTime || 0,
    };
    if (rebind) {
      window.CISHymnAudioUI.updateDock(root, statePayload, song, songAudioMeta, state.practiceMode);
    } else {
      const progress = statePayload.duration
        ? Math.min(100, ((statePayload.currentTime || 0) / statePayload.duration) * 100)
        : 0;
      const progressBar = root.querySelector(".hymn-audio-progress-bar");
      const progressText = root.querySelector(".hymn-audio-progress .muted");
      const transport = root.querySelector(".audio-transport-button");
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText && window.CISHymnAudioUI.formatTime) {
        progressText.textContent = `${window.CISHymnAudioUI.formatTime(statePayload.currentTime || 0)} / ${window.CISHymnAudioUI.formatTime(statePayload.duration || 0)}`;
      }
      if (transport) {
        transport.textContent = statePayload.playing ? "❚❚" : "▶";
        transport.setAttribute("aria-label", statePayload.playing ? "Pause" : "Play");
      }
    }
  }

  async function bindHymnAudio() {
    if (state.view !== "song" || !hymnAudioPlayer) return;
    const song = selectedSong();
    if (!song) return;
    await ensureSongAudioLoaded(song, songKey(song));
    paintAudioDock(true);
  }

  async function handleHymnAudioUpload(file) {
    const song = selectedSong();
    if (!song || !window.CISSongAudioStore || !hymnAudioPlayer) return;
    try {
      const key = songKey(song);
      songAudioMeta = await window.CISSongAudioStore.saveAudio(key, file);
      const blob = await window.CISSongAudioStore.getAudioBlob(key);
      await hymnAudioPlayer.load({ blob, meta: songAudioMeta, song });
      loadedAudioSongKey = key;
      audioDockState = { ...hymnAudioPlayer.getState(), currentTime: 0 };
      if (window.CISHymnAudioUI) window.CISHymnAudioUI.closeUploadModal();
      paintAudioDock(true);
      setNotice(t("notice.audioSaved", { number: song.number }));
    } catch (error) {
      setNotice(error && error.message ? error.message : t("notice.audioUploadFailed"));
    }
  }

  async function removeHymnAudio() {
    const song = selectedSong();
    if (!song || !window.CISSongAudioStore || !hymnAudioPlayer) return;
    const key = songKey(song);
    await window.CISSongAudioStore.deleteAudio(key);
    hymnAudioPlayer.stop();
    songAudioMeta = null;
    loadedAudioSongKey = "";
    audioDockState = { currentTime: 0 };
    paintAudioDock(true);
    setNotice(t("notice.audioRemoved", { number: song.number }));
  }

  function setupBible() {
    if (!window.CISBibleReaderUI || !window.CISBibleStore) return;
    window.CISBibleReaderUI.configure({ escapeHtml });
    setupBibleProjection();
  }

  function setupBibleProjection() {
    if (!window.CISBibleProjectionService || !window.CISBibleLiveUI) return;
    window.CISBibleLiveUI.configure({ escapeHtml });
    window.CISBibleProjectionService.configure({
      escapeHtml,
      loadSettings: () => (
        window.CISBibleProjectionSettings
          ? window.CISBibleProjectionSettings.load(null, (key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISBibleProjectionSettings) {
          window.CISBibleProjectionSettings.save(settings, saveJson);
        }
      },
      onSendLive: ({ slideIndex }) => {
        const key = window.CISBibleProjectionService.BIBLE_LIVE_KEY;
        state.presenter.songKey = key;
        state.presenter.planIndex = null;
        state.presenter.slideIndex = slideIndex || 0;
        state.presenter.queueKeys = [];
        state.presenter.queueIndex = null;
        if (!window.CISPresenterEngine?.getState?.().active) {
          startPresenterSession({
            songKey: key,
            planIndex: null,
            slideIndex: state.presenter.slideIndex,
            queueKeys: [],
            queueIndex: null,
          });
        } else {
          window.CISPresenterEngine.applyState({
            songKey: key,
            planIndex: null,
            slideIndex: state.presenter.slideIndex,
            queueKeys: [],
            queueIndex: null,
          });
        }
        renderPresenterAV();
        if (state.view === "bible") paintBibleLive();
      },
      onClearLive: () => {
        if (window.CISObsOutputService?.clearOverlay) {
          window.CISObsOutputService.clearOverlay("scripture").catch(() => {});
        }
        if (window.CISPresenterEngine?.getState?.().active
          && state.presenter.songKey === window.CISBibleProjectionService.BIBLE_LIVE_KEY) {
          window.CISPresenterEngine.applyState({ songKey: "", planIndex: null, slideIndex: 0 });
        }
        renderPresenterAV();
      },
    });
    if (window.CISBibleSpeechService) {
      window.CISBibleSpeechService.configure({
        getSettings: () => window.CISBibleProjectionService.getSettings(),
        onSuggestion: (suggestion) => {
          if (suggestion?.error) setNotice(suggestion.error);
          if (state.view === "bible") paintBibleLive();
        },
      });
    }
    if (!window.CISBibleProjectionService._subscribed) {
      window.CISBibleProjectionService._subscribed = true;
      window.CISBibleProjectionService.subscribe(() => {
        if (state.view === "bible") paintBibleLive();
      });
    }
  }

  function describeSongKeyForQueue(songKey) {
    const parsed = parseSongKey(songKey);
    const song = getSong(parsed.number, parsed.code, parsed.editionId);
    if (!song) return null;
    const edition = getEdition(parsed.editionId);
    const store = window.CISHymnalLibraryStore;
    const book = edition && store ? store.getBookById(edition.hymnBookId) : null;
    const pack = getPack(parsed.code, parsed.editionId);
    const bookTitle = book?.title || pack?.bookTitle || pack?.name || "Hymnal";
    const lang = edition?.languageName || pack?.name || parsed.code;
    const chorusSlide = (song.slides || []).find((slide) => /chorus|refrain|pinda|impinda/i.test(slide.label || ""));
    return {
      hymnBookId: edition?.hymnBookId || state.hymnBookId || "",
      editionId: parsed.editionId,
      hymnId: songKey,
      hymnNumber: song.number,
      title: song.title,
      shortLabel: `${bookTitle} · ${lang} · Hymn ${song.number}`,
      chorusLabel: song.chorusLabel || chorusSlide?.label || "Chorus",
    };
  }

  function findChorusSlide(song) {
    if (!song?.slides?.length) return -1;
    return song.slides.findIndex((slide) => /chorus|refrain|pinda|impinda/i.test(slide.label || ""));
  }

  async function resolveSongForQueue(songKey) {
    const parsed = parseSongKey(songKey);
    await ensureLanguagePackLoaded(parsed.code);
    return getSongByKey(songKey);
  }

  function getLiveHymnMeta() {
    if (!state.presenter.songKey) return null;
    if (window.CISBibleProjectionService
      && state.presenter.songKey === window.CISBibleProjectionService.BIBLE_LIVE_KEY) {
      return null;
    }
    const song = getSongByKey(state.presenter.songKey);
    if (!song) return null;
    const meta = describeSongKeyForQueue(state.presenter.songKey);
    if (!meta) return null;
    const slide = song.slides[state.presenter.slideIndex] || song.slides[0];
    return {
      ...meta,
      songKey: state.presenter.songKey,
      slideIndex: state.presenter.slideIndex,
      stanzaLabel: slide?.label ? `${slide.label}` : "",
      destinations: [],
    };
  }

  async function goLiveFromQueue(payload) {
    if (window.CISLiveSwitchService) {
      return window.CISLiveSwitchService.commitHymnLive(payload);
    }
    return applyHymnLiveDirect(payload);
  }

  async function applyHymnLiveDirect(payload) {
    const songKey = payload?.songKey;
    if (!songKey) return { ok: false, message: "Hymn unavailable." };
    const parsed = parseSongKey(songKey);
    if (!(await ensureLanguagePackLoaded(parsed.code))) {
      return { ok: false, message: "Hymn pack could not be loaded." };
    }
    const song = getSongByKey(songKey);
    if (!song) return { ok: false, message: "Hymn not found." };
    const slideIndex = Math.max(0, Math.min(song.slides.length - 1, Number(payload?.slideIndex) || 0));
    addRecent(song, parsed.code, parsed.editionId);
    if (!window.CISPresenterEngine?.getState?.().active) {
      state.presenter.songKey = songKey;
      state.presenter.slideIndex = slideIndex;
      state.presenter.planIndex = null;
      state.presenter.queueKeys = [];
      state.presenter.queueIndex = null;
      startPresenterSession({
        songKey,
        planIndex: null,
        slideIndex,
        queueKeys: [],
        queueIndex: null,
      });
    } else {
      state.presenter.songKey = songKey;
      state.presenter.slideIndex = slideIndex;
      state.presenter.planIndex = null;
      window.CISPresenterEngine.applyState({
        songKey,
        planIndex: null,
        slideIndex,
        displayMode: "lyrics",
        paused: false,
      });
      applyEnginePresenterState(window.CISPresenterEngine.getState());
      renderPresenterAV();
    }
    scheduleSessionRecoverySave("live-change");
    return { ok: true };
  }

  function resolveSongKeyFromTarget(target) {
    if (!target) return "";
    if (target.dataset.songKey) return target.dataset.songKey;
    const number = target.dataset.song;
    if (!number) return "";
    const edition = target.dataset.editionJump || target.dataset.edition || state.editionId;
    return makeSongKey(edition, number);
  }

  function renderHymnQueueActions(songKey, compact) {
    if (!window.CISLiveHymnQueueUI || !songKey) return "";
    return window.CISLiveHymnQueueUI.renderQueueActions(songKey, compact);
  }

  function renderLiveHymnQueueMount(full) {
    if (full) return `<div id="liveHymnQueueMount" class="live-hymn-queue-mount" aria-live="polite"></div>`;
    return `<div id="liveHymnQueueCompactMount" class="live-hymn-queue-compact-mount" aria-live="polite"></div>`;
  }

  function paintLiveHymnQueuePanels() {
    if (!window.CISLiveHymnQueueService || !window.CISLiveHymnQueueUI) return;
    const queueState = window.CISLiveHymnQueueService.getState();
    const liveMeta = getLiveHymnMeta();
    const mount = document.getElementById("liveHymnQueueMount");
    if (mount) {
      mount.innerHTML = window.CISLiveHymnQueueUI.renderWorkspace({
        queueState,
        liveMeta,
        showQuickSearch: state.view === "presenter" || state.view === "song",
      });
    }
    const compactMount = document.getElementById("liveHymnQueueCompactMount");
    if (compactMount) {
      compactMount.innerHTML = window.CISLiveHymnQueueUI.renderCompactNextPanel(queueState);
    }
  }

  function setupLiveHymnQueue() {
    if (!window.CISLiveHymnQueueService || !window.CISLiveHymnQueueUI) return;
    window.CISLiveHymnQueueUI.configure({ escapeHtml });
    window.CISLiveHymnQueueService.configure({
      resolveSong: resolveSongForQueue,
      describeSongKey: describeSongKeyForQueue,
      getLiveMeta: getLiveHymnMeta,
      goLive: goLiveFromQueue,
      findChorusSlide,
      saveSession: (payload) => {
        try {
          sessionStorage.setItem("cis-live-hymn-queue-session", JSON.stringify(payload));
        } catch (_error) {
          /* ignore */
        }
      },
      loadSession: () => {
        try {
          return JSON.parse(sessionStorage.getItem("cis-live-hymn-queue-session") || "null");
        } catch (_error) {
          return null;
        }
      },
      loadSettings: () => (
        window.CISLiveHymnQueueSettings
          ? window.CISLiveHymnQueueSettings.load((key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISLiveHymnQueueSettings) {
          window.CISLiveHymnQueueSettings.save(settings, saveJson);
        }
      },
    });
    if (!window.CISLiveHymnQueueService._subscribed) {
      window.CISLiveHymnQueueService._subscribed = true;
      window.CISLiveHymnQueueService.subscribe(() => {
        paintLiveHymnQueuePanels();
        paintServiceModeWorkspace();
        if (window.CISPresenterEngine?.getState?.().active) renderPresenterAV();
      });
    }
  }

  function isServiceModeActive() {
    return Boolean(window.CISServiceModeService?.getState?.().active);
  }

  function isServiceModeViewAllowed(view) {
    const allowed = window.CISServiceModeSettings?.SERVICE_MODE_VIEWS;
    return allowed ? allowed.has(view) : ["service", "search", "index", "bible", "help", "song"].includes(view);
  }

  function describeServiceOutputDestinations() {
    const parts = [];
    const presenterActive = window.CISPresenterEngine?.getState?.().active;
    if (presenterActive || embeddedProjectorActive) parts.push("Local projector");
    const obsStatus = window.CISObsConnectionService?.getStatus?.();
    if (obsStatus?.connected) parts.push("OBS");
    const camLive = window.CISCameraSourceService?.getState?.().live?.active;
    if (camLive) parts.push("Camera");
    return parts.length ? parts.join(", ") : "—";
  }

  function buildServiceModeLiveContext() {
    const bibleSvc = window.CISBibleProjectionService;
    const bibleKey = bibleSvc?.BIBLE_LIVE_KEY;
    if (bibleSvc && state.presenter.songKey === bibleKey) {
      const live = bibleSvc.getState().live;
      if (live.active && !live.cleared) {
        const slide = live.slides[live.slideIndex];
        return {
          type: "bible",
          typeLabel: "Bible",
          title: live.referenceLabel || "Scripture",
          position: slide
            ? `${live.referenceLabel || "Verse"} · ${live.slideIndex + 1} of ${live.slides.length}`
            : "",
          destinations: (live.destinations || []).join(", ") || describeServiceOutputDestinations(),
          status: "active",
        };
      }
    }
    const camState = window.CISCameraSourceService?.getState?.();
    if (camState?.live?.active) {
      return {
        type: "camera",
        typeLabel: "Camera",
        title: camState.live.cameraName || camState.live.deviceLabel || "Camera feed",
        position: camState.live.layout || "Live",
        destinations: describeServiceOutputDestinations(),
        status: "active",
      };
    }
    const liveMeta = getLiveHymnMeta();
    if (liveMeta) {
      return {
        type: "hymn",
        typeLabel: "Hymn",
        title: liveMeta.shortLabel || liveMeta.title,
        position: liveMeta.stanzaLabel || "",
        destinations: describeServiceOutputDestinations(),
        status: "active",
      };
    }
    if (state.emergencyMode) {
      const titles = { black: "Blackout", white: "White screen", logo: "Logo screen" };
      return {
        type: "emergency",
        typeLabel: "Emergency",
        title: titles[state.emergencyMode] || "Emergency",
        position: "",
        destinations: describeServiceOutputDestinations(),
        status: "active",
      };
    }
    if (window.CISPresenterEngine?.getState?.().active && state.presenter.planIndex != null) {
      const slot = worshipPlan[state.presenter.planIndex];
      if (slot) {
        return {
          type: slot.type || "plan",
          typeLabel: "Service plan",
          title: slotTitle(slot),
          position: "",
          destinations: describeServiceOutputDestinations(),
          status: "active",
        };
      }
    }
    return {
      type: "none",
      typeLabel: "None",
      title: "Nothing Live",
      position: "No active stanza or verse",
      destinations: "—",
      status: "inactive",
    };
  }

  function buildServiceModePreviewContext() {
    const queueState = window.CISLiveHymnQueueService?.getState() || {};
    const preview = queueState.preview;
    if (preview?.songKey) {
      return {
        title: preview.shortLabel || preview.title,
        meta: `Hymn ${preview.hymnNumber || ""}`,
        layout: "Hymn slides",
        destinations: "Preview only",
        status: preview.status === "ready" ? "Ready" : (preview.status || "Prepared"),
        openCommand: "hymn-preview-open",
        clearCommand: "hymn-preview-clear",
      };
    }
    const biblePreview = window.CISBibleProjectionService?.getState()?.preview;
    if (biblePreview?.parsed && biblePreview.slides?.length) {
      return {
        title: biblePreview.referenceLabel || biblePreview.referenceInput,
        meta: biblePreview.translation || state.bibleTranslation || "KJV",
        layout: "Scripture",
        destinations: "Preview only",
        status: biblePreview.loading ? "Loading" : biblePreview.error ? "Error" : "Ready",
        openCommand: "open-bible-live",
        clearCommand: null,
      };
    }
    return null;
  }

  function buildServiceModeNextContext() {
    const queueState = window.CISLiveHymnQueueService?.getState() || {};
    const next = queueState.next;
    if (next?.songKey) {
      return {
        title: next.shortLabel || next.title,
        meta: `Hymn ${next.hymnNumber || ""}`,
        status: next.status === "ready" ? "Ready" : (next.status || "Prepared"),
        previewCommand: "hymn-preview",
        previewData: next.songKey,
        removeCommand: "hymn-remove-next",
        takeCommand: "hymn-take-next",
        takeDisabled: next.status !== "ready",
      };
    }
    const assigned = assignedSlots();
    const currentInfo = assigned.find((item) => item.index === state.activeSlot) || assigned[0] || null;
    const nextInfo = currentInfo ? assigned.find((item) => item.index > currentInfo.index) : null;
    if (nextInfo) {
      return {
        title: slotTitle(nextInfo.slot),
        meta: nextInfo.slot.role || "Service item",
        status: "Ready",
        previewCommand: "present-plan-slot",
        previewDataSlot: nextInfo.index,
        takeCommand: "present-plan-slot",
        takeDataSlot: nextInfo.index,
        takeDisabled: false,
      };
    }
    return null;
  }

  function buildServiceModeStatusContext() {
    const obsStatus = window.CISObsConnectionService?.getStatus?.();
    const obsEnabled = obsStatus?.enabled !== false;
    const localStatus = window.CISCameraSourceService?.getLocalPresentationStatus?.();
    const presenterActive = window.CISPresenterEngine?.getState?.().active;
    return {
      projectorStatus: presenterActive || localStatus?.active ? "active" : "off",
      projectorDetail: localStatus?.mainProjector || (presenterActive ? "Active" : "Off"),
      stageStatus: (window.CISStageDisplayService?.getState?.().connected ? "ready" : "off"),
      stageDetail: window.CISStageDisplayService?.getState?.().connected
        ? (window.CISStageDisplaySettings?.LAYOUTS?.[window.CISStageDisplayService.getState().settings?.layoutId]?.label || "Stage Display")
        : (localStatus?.stageDisplay && localStatus.stageDisplay !== "—" ? localStatus.stageDisplay : "—"),
      obsEnabled,
      obsStatus: obsStatus?.connected ? "connected" : obsEnabled ? "warning" : "off",
      obsDetail: obsStatus?.connected ? "Connected" : obsEnabled ? "Disconnected" : "Off",
    };
  }

  function buildServiceModeContext() {
    const serviceState = window.CISServiceModeService?.getState() || {};
    const queueState = window.CISLiveHymnQueueService?.getState() || {};
    const queue = (queueState.queue || []).map((item) => ({
      id: item.id,
      title: item.shortLabel || item.title || "Queue item",
      meta: `Hymn ${item.hymnNumber || ""}`,
      songKey: item.songKey || "",
    }));
    let mediaControls = "";
    if (window.CISSongAudioUI && selectedSong()) {
      mediaControls = `
        <section class="service-media-panel" aria-label="Hymn media controls">
          <h4>Media</h4>
          ${window.CISSongAudioUI.renderPlayer(selectedSong(), state.languageCode)}
        </section>
      `;
    }
    let localPresentation = "";
    if (window.CISCameraSourceUI && window.CISCameraSourceService) {
      localPresentation = window.CISCameraSourceUI.renderLocalPresentationPanel(
        window.CISCameraSourceService.getLocalPresentationStatus(),
      );
    }
    return {
      appName: brandAppName(),
      pendingRestoreConfirm: serviceState.pendingRestoreConfirm,
      live: buildServiceModeLiveContext(),
      preview: buildServiceModePreviewContext(),
      next: buildServiceModeNextContext(),
      queue,
      status: buildServiceModeStatusContext(),
      mediaControls,
      localPresentation,
      quietServiceModeActive: isQuietServiceModeActive(),
    };
  }

  function renderServiceModeContextBar() {
    if (!isServiceModeActive() || !window.CISServiceModeUI || state.view === "service") return "";
    const ctx = buildServiceModeContext();
    return `
      <div class="service-mode-context-bar" role="region" aria-label="Service Mode live context">
        <div class="service-mode-context-live">
          <span class="service-mode-context-label">Live</span>
          <strong>${escapeHtml(ctx.live?.title || "Nothing Live")}</strong>
          <span class="muted">${escapeHtml(ctx.live?.position || "")}</span>
        </div>
        <div class="service-mode-context-next">
          <span class="service-mode-context-label">Next</span>
          <strong>${escapeHtml(ctx.next?.title || "None")}</strong>
        </div>
        ${window.CISServiceModeUI.renderEmergencyStrip()}
        <button class="secondary-button service-touch-btn" type="button" data-view="service">Service Workspace</button>
        <button class="secondary-button service-touch-btn" type="button" data-command="service-mode-exit">Exit Service Mode</button>
      </div>
    `;
  }

  function renderServiceMode() {
    if (!window.CISServiceModeUI) return `<div class="empty-state">Service Mode is unavailable.</div>`;
    return window.CISServiceModeUI.renderWorkspace(buildServiceModeContext());
  }

  function paintServiceModeWorkspace() {
    if (!isServiceModeActive() || state.view !== "service") return;
    paintLiveHymnQueuePanels();
  }

  function isQuietServiceModeActive() {
    return Boolean(window.CISQuietServiceModeService?.isActive?.());
  }

  function outputsActiveForQuietMode() {
    const presenter = window.CISPresenterEngine?.getState?.() || {};
    return Boolean(
      embeddedProjectorActive
      || (presenter.active && presenter.displayMode === "lyrics")
      || isPresentationLiveActive()
      || state.emergencyMode,
    );
  }

  function syncQuietPowerBlocker() {
    if (!window.CISQuietServiceModeService) return;
    window.CISQuietServiceModeService.syncPowerBlocker(outputsActiveForQuietMode());
  }

  function enterQuietServiceMode() {
    if (!window.CISQuietServiceModeService) return;
    const result = window.CISQuietServiceModeService.enter({ outputsActive: outputsActiveForQuietMode() });
    setNotice(result.message, { nonessential: false });
    render();
  }

  function exitQuietServiceMode() {
    if (!window.CISQuietServiceModeService) return;
    const result = window.CISQuietServiceModeService.exit();
    setNotice(result.message, { nonessential: false });
    render();
  }

  function maybeOfferQuietServiceModeOnServiceEnter() {
    if (!window.CISQuietServiceModeService || isQuietServiceModeActive()) return;
    const decision = window.CISQuietServiceModeService.shouldAutoEnterWithServiceMode();
    if (decision.enter) {
      enterQuietServiceMode();
      return;
    }
    if (decision.ask) {
      window.CISQuietServiceModeService.markAutoEnterAsked();
      if (window.confirm("Enter Quiet Service Mode to reduce background activity and interruptions during this service?")) {
        enterQuietServiceMode();
      }
    }
  }

  function setupQuietServiceMode() {
    if (!window.CISQuietServiceModeService || !window.CISQuietServiceModeUI) return;
    window.CISQuietServiceModeUI.configure({ escapeHtml });
    const electronBridge = window.electronAPI || null;
    window.CISQuietServiceModeService.configure({
      loadSettings: () => (
        window.CISQuietServiceModeSettings
          ? window.CISQuietServiceModeSettings.load((key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISQuietServiceModeSettings) {
          window.CISQuietServiceModeSettings.save(settings, saveJson);
        }
      },
      saveSession: (payload) => {
        try {
          sessionStorage.setItem("cis-quiet-service-mode-session", JSON.stringify(payload));
        } catch (_error) {
          /* ignore */
        }
      },
      loadSession: () => {
        try {
          return JSON.parse(sessionStorage.getItem("cis-quiet-service-mode-session") || "null");
        } catch (_error) {
          return null;
        }
      },
      setPlatformQuietMode: (enabled, options) => {
        if (electronBridge?.quietMode?.setActive) {
          electronBridge.quietMode.setActive(enabled).catch(() => {});
        }
        if (!enabled && electronBridge?.quietMode?.setPowerBlocker) {
          electronBridge.quietMode.setPowerBlocker(false).catch(() => {});
        } else if (enabled && options?.preventDisplaySleep) {
          syncQuietPowerBlocker();
        }
      },
      setPowerBlocker: (enabled) => (
        electronBridge?.quietMode?.setPowerBlocker
          ? electronBridge.quietMode.setPowerBlocker(Boolean(enabled))
          : Promise.resolve({ supported: false })
      ),
    });
    if (!window.CISQuietServiceModeService._subscribed) {
      window.CISQuietServiceModeService._subscribed = true;
      window.CISQuietServiceModeService.subscribe(() => {
        document.body.classList.toggle("quiet-service-mode-active", isQuietServiceModeActive());
        const settings = window.CISQuietServiceModeService.getState().settings || {};
        document.body.classList.toggle("quiet-reduce-motion", isQuietServiceModeActive() && settings.reduceAnimations !== false);
        renderQuietServiceModeBanner();
        syncQuietPowerBlocker();
      });
    }
    document.body.classList.toggle("quiet-service-mode-active", isQuietServiceModeActive());
  }

  function renderQuietServiceModeBanner() {
    if (!els.quietServiceModeRoot || !window.CISQuietServiceModeUI) return;
    const qState = window.CISQuietServiceModeService?.getState?.() || {};
    els.quietServiceModeRoot.innerHTML = window.CISQuietServiceModeUI.renderStatusBanner(
      qState.active,
      qState.deferredCount || 0,
    );
  }

  function getWorshipSearchUI() {
    return window.CISWorshipSearchUI || window.CISSearchUI || null;
  }

  function getActiveWorshipSearchResult() {
    const ui = getWorshipSearchUI();
    return ui?.getActiveResult?.() || null;
  }

  function getShortcutContext() {
    const presenterEngine = window.CISPresenterEngine?.getState?.() || {};
    const activeSearch = getActiveWorshipSearchResult();
    const hasSelection = Boolean(
      activeSearch
      || (state.view === "song" && selectedSong())
      || document.querySelector(".set-row.active, .song-card.active, [data-search-result].active"),
    );
    return {
      presenterActive: Boolean(state.presenter.open || presenterEngine.active),
      emergencyMode: Boolean(state.emergencyMode),
      bibleLive: state.view === "bible" && state.bibleMode === "live",
      searchView: state.view === "search",
      indexView: state.view === "index",
      hasSelection,
      mediaLoaded: Boolean(hymnAudioPlayer?.getState?.()?.loaded),
      modalOpen: Boolean(els.modalRoot?.innerHTML),
      disabled: false,
    };
  }

  function focusCurrentSearchField() {
    const candidates = [
      "#globalSearchInput",
      "#indexSearchInput",
      "#builderSearchInput",
      "#homeSearchInput",
      "#bibleLiveReferenceInput",
    ];
    for (const selector of candidates) {
      const input = document.querySelector(selector);
      if (input && input.offsetParent !== null) {
        input.focus();
        if (window.CISFocusManager) window.CISFocusManager.announce("Search field focused.");
        return true;
      }
    }
    state.view = "search";
    saveValue("view", state.view);
    render();
    window.setTimeout(() => document.getElementById("globalSearchInput")?.focus(), 0);
    return true;
  }

  function loadSelectedIntoPreview() {
    if (state.view === "bible" && state.bibleMode === "live") {
      const input = document.getElementById("bibleLiveReferenceInput");
      if (input) handleBibleCommand("preview-load", input);
      return true;
    }
    if (state.view === "search" && getWorshipSearchUI()?.previewActiveResult) {
      return Boolean(getWorshipSearchUI().previewActiveResult());
    }
    const activeSearch = getActiveWorshipSearchResult();
    if (activeSearch) {
      handleWorshipSearchAction("preview", activeSearch);
      return true;
    }
    if (state.view === "song" && selectedSong()) {
      void handleHymnQueueCommand("hymn-preview", { dataset: { songKey: songKey(selectedSong()) } });
      return true;
    }
    return false;
  }

  async function sendPreviewLiveShortcut() {
    if (state.view === "bible" && state.bibleMode === "live") {
      await handleBibleCommand("send-live", null);
      return true;
    }
    if (window.CISLiveSwitchService) {
      const result = await window.CISLiveSwitchService.commit({ type: "hymn" });
      setNotice(result.message || (result.ok ? "Preview sent Live." : "Send Live cancelled."));
      if (window.CISFocusManager) window.CISFocusManager.announce(result.message || "Preview sent Live.");
      return true;
    }
    const preview = window.CISLiveHymnQueueService?.getState?.().preview;
    if (preview?.songKey) {
      await handleHymnQueueCommand("hymn-send-live", { dataset: { songKey: preview.songKey } });
      return true;
    }
    return false;
  }

  function showChorusSlide() {
    const engine = window.CISPresenterEngine;
    if (!engine?.getState?.().active) return false;
    const song = getSongByKey(engine.getState().songKey || state.presenter.songKey);
    if (!song) return false;
    const chorusIndex = findChorusSlide(song);
    if (chorusIndex < 0) {
      setNotice("No chorus slide found for this hymn.");
      return false;
    }
    state.presenter.slideIndex = chorusIndex;
    engine.patchState({ slideIndex: chorusIndex });
    engine.publishState();
    renderPresenterAV();
    if (window.CISFocusManager) window.CISFocusManager.announce("Chorus slide shown.");
    return true;
  }

  function setSelectedHymnAsNext() {
    const activeSearch = getActiveWorshipSearchResult();
    if (activeSearch?.payload?.songKey) {
      void handleHymnQueueCommand("hymn-set-next", { dataset: { songKey: activeSearch.payload.songKey } });
      return true;
    }
    if (state.view === "song" && selectedSong()) {
      void handleHymnQueueCommand("hymn-set-next", { dataset: { songKey: songKey(selectedSong()) } });
      return true;
    }
    return false;
  }

  function openHymnQueueWorkspace() {
    state.view = "presenter";
    state.presenter.open = true;
    saveValue("view", state.view);
    render();
    if (window.CISFocusManager) window.CISFocusManager.announce("Hymn queue opened.");
    return true;
  }

  function executeShortcutAction(actionId) {
    if (els.modalRoot?.innerHTML && actionId !== "close-presenter") {
      if (actionId === "close-presenter" || (actionId === "emergency-clear" && state.emergencyMode)) {
        /* continue */
      } else if (actionId === "close-presenter") {
        closeModal();
        return { handled: true };
      }
    }

    if (state.emergencyMode) {
      if (actionId === "close-presenter" || actionId === "emergency-clear") {
        clearEmergency();
        return { handled: true };
      }
      if (["emergency-black", "emergency-logo", "emergency-clear", "emergency-restore"].includes(actionId)) {
        if (actionId === "emergency-restore") {
          void handleHymnQueueCommand("hymn-restore-previous", {});
          clearEmergency();
          return { handled: true };
        }
        if (actionId === "emergency-clear") clearEmergency();
        else if (actionId === "emergency-black") setEmergency("black");
        else if (actionId === "emergency-logo") setEmergency("logo");
        return { handled: true };
      }
    }

    switch (actionId) {
      case "global-search":
        state.searchReturnView = state.view;
        state.view = "search";
        saveValue("view", state.view);
        render();
        window.setTimeout(() => document.getElementById("globalSearchInput")?.focus(), 0);
        return { handled: true };
      case "open-bible-live":
        openBibleLive();
        return { handled: true };
      case "open-hymn-search":
        state.view = "search";
        saveValue("view", state.view);
        render();
        return { handled: true };
      case "focus-search-field":
        return { handled: focusCurrentSearchField() };
      case "open-help":
        state.view = "help";
        resetHelpNav();
        saveValue("view", state.view);
        render();
        return { handled: true };
      case "open-emergency-help":
        state.view = "help";
        state.help.category = "emergency";
        saveValue("view", state.view);
        render();
        return { handled: true };
      case "open-queue":
        return { handled: openHymnQueueWorkspace() };
      case "load-preview":
        return { handled: loadSelectedIntoPreview() };
      case "hymn-send-preview-live":
        void sendPreviewLiveShortcut();
        return { handled: true };
      case "hymn-take-next":
        void handleHymnQueueCommand("hymn-take-next", {});
        return { handled: true };
      case "hymn-restore-previous":
        void handleHymnQueueCommand("hymn-restore-previous", {});
        return { handled: true };
      case "presenter-next":
        presenterMove(1);
        if (window.CISFocusManager) window.CISFocusManager.announce("Next slide.");
        return { handled: true };
      case "presenter-prev":
        presenterMove(-1);
        if (window.CISFocusManager) window.CISFocusManager.announce("Previous slide.");
        return { handled: true };
      case "show-chorus":
        return { handled: showChorusSlide() };
      case "hymn-set-next":
        return { handled: setSelectedHymnAsNext() };
      case "emergency-clear":
        clearEmergency();
        return { handled: true };
      case "emergency-logo":
        setEmergency("logo");
        return { handled: true };
      case "emergency-black":
        setEmergency("black");
        return { handled: true };
      case "emergency-white":
        setEmergency("white");
        return { handled: true };
      case "emergency-restore":
        if (state.view === "bible" && state.bibleMode === "live") {
          handleBibleCommand("restore-scripture", null);
        } else {
          void handleHymnQueueCommand("hymn-restore-previous", {});
        }
        return { handled: true };
      case "presenter-pause":
        if (window.CISPresenterEngine) window.CISPresenterEngine.togglePause();
        renderPresenterAV();
        return { handled: true };
      case "media-toggle":
        if (hymnAudioPlayer) hymnAudioPlayer.togglePlay();
        return { handled: true };
      case "bible-next-verse":
        handleBibleCommand("next-verse", null);
        return { handled: true };
      case "bible-prev-verse":
        handleBibleCommand("prev-verse", null);
        return { handled: true };
      case "bible-send-live":
        void handleBibleCommand("send-live", null);
        return { handled: true };
      case "camera-send-live":
        handleCameraSendLive();
        return { handled: true };
      case "camera-next": {
        const cameras = window.CISCameraSourceService?.getState?.().savedCameras || [];
        const currentId = window.CISCameraSourceService?.getState?.().live?.cameraId;
        const index = cameras.findIndex((cam) => cam.id === currentId);
        const next = cameras[(index + 1) % cameras.length];
        if (next) handleCameraSendLive(next.id);
        return { handled: true };
      }
      case "presenter-fullscreen":
        togglePresenterFullscreen();
        return { handled: true };
      case "close-presenter":
        if (els.modalRoot?.innerHTML) {
          closeModal();
          return { handled: true };
        }
        closePresenter();
        return { handled: true };
      default:
        return { handled: false };
    }
  }

  function setupKeyboardShortcuts() {
    if (!window.CISKeyboardShortcutsService || !window.CISKeyboardShortcutsSettings) return;
    const saved = window.CISKeyboardShortcutsSettings.load((key, fallback) => loadJson(key, fallback));
    if (window.CISKeyboardShortcutsUI) {
      window.CISKeyboardShortcutsUI.configure({ escapeHtml });
    }
    window.CISKeyboardShortcutsService.configure({
      bindings: saved,
      platform: state.desktopInfo?.platform || (navigator.platform || "web").toLowerCase(),
      getContext: getShortcutContext,
      onAction: (actionId) => executeShortcutAction(actionId),
    });
    if (!window.CISKeyboardShortcutsService._subscribed) {
      window.CISKeyboardShortcutsService._subscribed = true;
      window.CISKeyboardShortcutsService.subscribe(() => {
        if (state.view === "settings") render();
      });
    }
  }

  function bindKeyboardShortcutPanels() {
    if (!window.CISKeyboardShortcutsUI) return;
    const settingsRoot = document.querySelector(".keyboard-shortcuts-settings");
    if (settingsRoot) {
      window.CISKeyboardShortcutsUI.bindSettingsInteractions(settingsRoot, {
        onBindingChange: (actionId, binding) => {
          const result = window.CISKeyboardShortcutsService.setBinding(actionId, binding);
          window.CISKeyboardShortcutsSettings.save(
            window.CISKeyboardShortcutsService.getBindings(),
            saveJson,
          );
          if (result.conflicts?.length) {
            setNotice(`${result.conflicts.length} shortcut conflict(s) detected.`, { important: true });
          }
          render();
        },
      });
    }
    const referenceRoot = document.querySelector(".keyboard-shortcuts-reference");
    if (referenceRoot) {
      window.CISKeyboardShortcutsUI.bindReferenceInteractions(referenceRoot, {
        onSearch: (query) => {
          state.shortcutReferenceQuery = query;
          const results = document.getElementById("shortcutReferenceResults");
          if (results && window.CISKeyboardShortcutsUI && window.CISKeyboardShortcutsService) {
            const panel = window.CISKeyboardShortcutsUI.renderReferencePanel(
              window.CISKeyboardShortcutsService.getState(),
              query,
            );
            const match = panel.match(/<div id="shortcutReferenceResults"[\s\S]*?>([\s\S]*?)<\/div>\s*<\/section>/);
            if (match) results.innerHTML = match[1];
          }
        },
      });
    }
  }

  function enterServiceMode() {
    if (!window.CISServiceModeService) return;
    const result = window.CISServiceModeService.enter({ previousView: state.view });
    if (!result.ok) {
      setNotice(result.message || "Could not enter Service Mode.");
      return;
    }
    state.view = "service";
    saveValue("view", state.view);
    setNotice("Service Mode active. Live, Preview and Next stay separate.");
    maybeOfferQuietServiceModeOnServiceEnter();
    render();
  }

  function exitServiceMode(options) {
    if (!window.CISServiceModeService) return;
    const result = window.CISServiceModeService.exit(options || {});
    if (result.needsConfirm) {
      if (window.confirm(`${result.message}\n\nOutputs will stay active.`)) {
        exitServiceMode({ confirmed: true });
      }
      return;
    }
    if (!result.ok) {
      setNotice(result.message || "Could not exit Service Mode.");
      return;
    }
    state.view = result.previousView || "presenter";
    saveValue("view", state.view);
    setNotice("Service Mode exited. Outputs were not cleared.");
    render();
  }

  function setupServiceMode() {
    if (!window.CISServiceModeService || !window.CISServiceModeUI) return;
    window.CISServiceModeUI.configure({ escapeHtml });
    window.CISServiceModeService.configure({
      getRole: () => (window.CISHelpStore ? window.CISHelpStore.getRole() : "operator"),
      isPresentationActive: () => Boolean(
        window.CISPresenterEngine?.getState?.().active
        || state.presenter.open
        || state.emergencyMode
        || window.CISCameraSourceService?.getState?.().live?.active,
      ),
      saveSession: (payload) => {
        try {
          sessionStorage.setItem("cis-service-mode-session", JSON.stringify(payload));
        } catch (_error) {
          /* ignore */
        }
      },
      loadSession: () => {
        try {
          return JSON.parse(sessionStorage.getItem("cis-service-mode-session") || "null");
        } catch (_error) {
          return null;
        }
      },
      loadSettings: () => (
        window.CISServiceModeSettings
          ? window.CISServiceModeSettings.load((key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISServiceModeSettings) {
          window.CISServiceModeSettings.save(settings, saveJson);
        }
      },
    });
    if (!window.CISServiceModeService._subscribed) {
      window.CISServiceModeService._subscribed = true;
      window.CISServiceModeService.subscribe(() => {
        document.body.classList.toggle("service-mode-active", isServiceModeActive());
        if (isServiceModeActive()) paintServiceModeWorkspace();
      });
    }
    window.addEventListener("beforeunload", (event) => {
      if (!isServiceModeActive()) return;
      event.preventDefault();
      event.returnValue = "";
    });
    document.body.classList.toggle("service-mode-active", isServiceModeActive());
    const smState = window.CISServiceModeService.getState();
    if (smState.active && state.view !== "service" && !isServiceModeViewAllowed(state.view)) {
      state.view = "service";
      saveValue("view", state.view);
    }
  }

  function isPresentationLiveActive() {
    return Boolean(
      window.CISPresenterEngine?.getState?.().active
      || state.presenter.open
      || state.emergencyMode
      || window.CISCameraSourceService?.getState?.().live?.active
      || (window.CISBibleProjectionService?.getState?.().live?.active
        && !window.CISBibleProjectionService.getState().live.cleared),
    );
  }

  function hasLyricLiveContent() {
    if (window.CISBibleProjectionService) {
      const bibleLive = window.CISBibleProjectionService.getState().live;
      if (bibleLive.active && !bibleLive.cleared && bibleLive.slides?.length) return true;
    }
    if (state.presenter.songKey
      && (!window.CISBibleProjectionService
        || state.presenter.songKey !== window.CISBibleProjectionService.BIBLE_LIVE_KEY)) {
      const song = getSongByKey(state.presenter.songKey);
      if (song && song.slides?.length) return true;
    }
    if (typeof state.presenter.planIndex === "number" && worshipPlan[state.presenter.planIndex]) return true;
    return false;
  }

  function captureLiveSnapshot() {
    const engine = window.CISPresenterEngine?.getState?.() || {};
    return {
      songKey: state.presenter.songKey,
      slideIndex: state.presenter.slideIndex,
      planIndex: state.presenter.planIndex,
      displayMode: engine.displayMode || state.emergencyMode || "lyrics",
      queueKeys: [...(state.presenter.queueKeys || [])],
      queueIndex: state.presenter.queueIndex,
      capturedAt: Date.now(),
      hymnMeta: getLiveHymnMeta(),
      bibleLive: window.CISBibleProjectionService
        ? { ...window.CISBibleProjectionService.getState().live }
        : null,
    };
  }

  function setupLiveSwitch() {
    if (!window.CISLiveSwitchService) return;
    window.CISLiveSwitchService.configure({
      loadSettings: () => (
        window.CISLiveSwitchSettings
          ? window.CISLiveSwitchSettings.load((key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISLiveSwitchSettings) {
          window.CISLiveSwitchSettings.save(settings, saveJson);
        }
      },
      captureLiveSnapshot,
      prepareContent: async (descriptor) => {
        const item = descriptor || {};
        if (item.type === "hymn") {
          const songKey = item.songKey;
          if (!songKey) return { ok: false, message: "No hymn selected." };
          const parsed = parseSongKey(songKey);
          if (!(await ensureLanguagePackLoaded(parsed.code))) {
            return { ok: false, message: "Hymn pack could not be loaded. Current Live output is unchanged." };
          }
          const song = getSongByKey(songKey);
          if (!song || !song.slides?.length) {
            return { ok: false, message: "Hymn lyrics are missing. Current Live output is unchanged." };
          }
          const slideIndex = Math.max(0, Math.min(song.slides.length - 1, Number(item.slideIndex) || 0));
          return {
            ok: true,
            staging: {
              type: "hymn",
              ready: true,
              songKey,
              slideIndex,
              transition: item.transition,
              destinations: item.destinations,
            },
          };
        }
        if (item.type === "bible") {
          const bible = window.CISBibleProjectionService;
          if (!bible) return { ok: false, message: "Bible projection unavailable." };
          const preview = bible.getState().preview;
          if (preview.loading) {
            return { ok: false, message: "Passage is still loading. Current Live output is unchanged." };
          }
          if (preview.error && !preview.slides?.length) {
            return { ok: false, message: preview.error || "Passage is not ready." };
          }
          if (!preview.slides?.length) {
            return { ok: false, message: "Load a passage in Preview before sending Live." };
          }
          return { ok: true, staging: { type: "bible", ready: true } };
        }
        return { ok: true, staging: { type: item.type || "unknown", ready: true } };
      },
      applyLive: async (descriptor) => {
        const item = descriptor || {};
        if (item.type === "hymn") {
          const result = await applyHymnLiveDirect({
            songKey: item.songKey || item.staging?.songKey,
            slideIndex: item.slideIndex ?? item.staging?.slideIndex,
            transition: item.transition || item.staging?.transition,
            destinations: item.destinations || item.staging?.destinations,
            hymnBookId: item.hymnBookId,
            editionId: item.editionId,
          });
          return { ...result, displayMode: "lyrics" };
        }
        if (item.type === "bible" && window.CISBibleProjectionService) {
          const result = window.CISBibleProjectionService.sendLive();
          return { ...result, displayMode: "lyrics" };
        }
        return { ok: false, message: "Unsupported Live content." };
      },
    });
    if (window.CISCameraSourceService) {
      window.CISCameraSourceService.configure({
        hasLyricLiveContent: hasLyricLiveContent,
      });
    }
  }

  function setupLiveLock() {
    if (!window.CISLiveLockService || !window.CISLiveLockUI) return;
    window.CISLiveLockUI.configure({ escapeHtml });
    window.CISLiveLockService.configure({
      isPresentationActive: isPresentationLiveActive,
      loadSettings: () => (
        window.CISLiveLockSettings
          ? window.CISLiveLockSettings.load((key, fallback) => loadJson(key, fallback))
          : {}
      ),
      saveSettings: (settings) => {
        if (window.CISLiveLockSettings) {
          window.CISLiveLockSettings.save(settings, saveJson);
        }
      },
    });
    if (!window.CISLiveLockService._beforeUnloadBound) {
      window.CISLiveLockService._beforeUnloadBound = true;
      window.addEventListener("beforeunload", (event) => {
        if (!window.CISLiveLockService?.shouldConfirmClose()) return;
        event.preventDefault();
        event.returnValue = "";
      });
    }
    if (!window.CISLiveLockService._subscribed) {
      window.CISLiveLockService._subscribed = true;
      window.CISLiveLockService.subscribe(() => renderLiveLockStrip());
    }
    renderLiveLockStrip();
  }

  function renderLiveLockStrip() {
    const root = document.getElementById("liveLockRoot");
    if (!root || !window.CISLiveLockUI || !window.CISLiveLockService) return;
    root.innerHTML = window.CISLiveLockUI.renderStrip(window.CISLiveLockService.getState());
  }

  async function handleHymnQueueCommand(command, target) {
    const service = window.CISLiveHymnQueueService;
    if (!service) return;
    const songKey = resolveSongKeyFromTarget(target);
    const queueId = target?.dataset?.queueId || "";
    const settings = service.getState().settings || {};

    if (command === "hymn-preview" || command === "hymn-preview-open") {
      if (!songKey) return;
      if (window.CISLiveSwitchService) {
        window.CISLiveSwitchService.markPreview({ type: "hymn", songKey });
      }
      service.setPreview(songKey, { startSlideIndex: state.slideIndex });
      const parsed = parseSongKey(songKey);
      void openSong(parsed.number, parsed.code, parsed.editionId);
      paintLiveHymnQueuePanels();
      setNotice("Preview updated. Live output unchanged.");
      return;
    }
    if (command === "hymn-preview-clear") {
      service.clearPreview();
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-set-next") {
      if (!songKey) return;
      service.setAsNext(songKey, { startSlideIndex: 0 });
      paintLiveHymnQueuePanels();
      setNotice("Set as Next. Current hymn remains Live.");
      return;
    }
    if (command === "hymn-add-queue") {
      if (!songKey) return;
      service.addToQueue(songKey, { startSlideIndex: 0 });
      paintLiveHymnQueuePanels();
      setNotice("Added to live queue.");
      return;
    }
    if (command === "hymn-send-live" || command === "hymn-queue-send-live") {
      const key = songKey || (queueId ? service.getState().queue.find((item) => item.id === queueId)?.songKey : "");
      if (!key) return;
      if (settings.confirmReplaceLive
        && window.CISPresenterEngine?.getState?.().active
        && !window.confirm("Send this hymn Live now and replace the current Live hymn?")) {
        return;
      }
      if (!confirmTrainingLiveAction("Send hymn Live now")) return;
      const result = command === "hymn-queue-send-live" && queueId
        ? await service.sendQueueItemLive(queueId, { skipConfirm: true })
        : await service.sendLiveNow(key, { skipConfirm: true });
      paintLiveHymnQueuePanels();
      setNotice(result?.message || (result?.ok ? "Hymn sent Live." : "Could not send hymn Live."));
      return;
    }
    if (command === "hymn-take-next") {
      if (settings.confirmBeforeLive
        && window.CISPresenterEngine?.getState?.().active
        && !window.confirm("Take the prepared Next hymn Live?")) {
        return;
      }
      if (!confirmTrainingLiveAction("Take Next Live")) return;
      const result = await service.takeNextLive();
      paintLiveHymnQueuePanels();
      setNotice(result?.message || (result?.ok ? "Next hymn is now Live." : "Take Next Live failed."));
      return;
    }
    if (command === "hymn-remove-next") {
      service.removeNext();
      paintLiveHymnQueuePanels();
      setNotice("Next hymn removed.");
      return;
    }
    if (command === "hymn-clear-queue") {
      if (!window.confirm("Clear the upcoming hymn queue?")) return;
      service.clearQueue();
      paintLiveHymnQueuePanels();
      setNotice("Queue cleared.");
      return;
    }
    if (command === "hymn-queue-up") {
      service.moveQueueItem(queueId, -1);
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-queue-down") {
      service.moveQueueItem(queueId, 1);
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-queue-top") {
      service.moveQueueItemToEdge(queueId, "top");
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-queue-bottom") {
      service.moveQueueItemToEdge(queueId, "bottom");
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-queue-set-next") {
      service.promoteQueueItem(queueId);
      paintLiveHymnQueuePanels();
      setNotice("Queue item promoted to Next.");
      return;
    }
    if (command === "hymn-queue-remove") {
      service.removeQueueItem(queueId);
      paintLiveHymnQueuePanels();
      return;
    }
    if (command === "hymn-queue-duplicate") {
      service.duplicateQueueItem(queueId);
      paintLiveHymnQueuePanels();
      setNotice("Queue item duplicated.");
      return;
    }
    if (command === "hymn-restore-previous") {
      const result = await service.restorePrevious();
      paintLiveHymnQueuePanels();
      setNotice(result?.message || "Previous hymn restored.");
      return;
    }
    if (command === "hymn-queue-from-plan") {
      const start = Number(target?.dataset?.slot);
      const slots = worshipPlan.slice(Number.isNaN(start) ? 0 : start).filter((slot) => slot?.songKey);
      slots.forEach((slot, index) => {
        if (index === 0) service.setAsNext(slot.songKey, { startSlideIndex: 0 });
        else service.addToQueue(slot.songKey, { startSlideIndex: 0 });
      });
      paintLiveHymnQueuePanels();
      setNotice(slots.length ? `${slots.length} service hymn(s) queued.` : "No service hymns to queue.");
    }
  }

  function renderBibleSettingsPanel() {
    const settings = window.CISBibleProjectionService
      ? window.CISBibleProjectionService.getSettings()
      : (window.CISBibleProjectionSettings ? window.CISBibleProjectionSettings.load(null, loadJson) : {});
    const translations = window.CISBibleStore ? window.CISBibleStore.getTranslations() : [];
    return `
      <section class="section bible-settings-panel">
        <h3>Bible Projection</h3>
        <p class="muted">KJV, ASV, and WEB are bundled (public domain). Import additional translations only when you have permission.</p>
        <div class="settings-grid">
          <label>Default Bible version
            <select data-command="bible-settings" data-setting="defaultTranslation">
              ${translations.map((item) => `<option value="${escapeHtml(item.code)}" ${settings.defaultTranslation === item.code ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
            </select>
          </label>
          <label>Secondary version (dual display)
            <select data-command="bible-settings" data-setting="secondaryTranslation">
              <option value="">None</option>
              ${translations.map((item) => `<option value="${escapeHtml(item.code)}" ${settings.secondaryTranslation === item.code ? "selected" : ""}>${escapeHtml(item.abbreviation || item.code)}</option>`).join("")}
            </select>
          </label>
          <label>Verses per slide
            <select data-command="bible-settings" data-setting="versesPerSlide">
              <option value="1" ${Number(settings.versesPerSlide) === 1 ? "selected" : ""}>One verse</option>
              <option value="2" ${Number(settings.versesPerSlide) === 2 ? "selected" : ""}>Two verses</option>
              <option value="auto" ${settings.versesPerSlide === "auto" || settings.verseGrouping === "auto" ? "selected" : ""}>Automatic safe split</option>
            </select>
          </label>
          <label>Scripture layout
            <select data-command="bible-settings" data-setting="defaultLayout">
              ${Object.values(window.CISProjectionThemes?.LAYOUTS || { fullscreen: { id: "fullscreen", label: "Full-screen" } }).map((layout) => `
                <option value="${escapeHtml(layout.id)}" ${settings.defaultLayout === layout.id ? "selected" : ""}>${escapeHtml(layout.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>OBS scripture layout
            <select data-command="bible-settings" data-setting="obsLayout">
              <option value="lower_third" ${settings.obsLayout === "lower_third" ? "selected" : ""}>Lower third</option>
              <option value="fullscreen" ${settings.obsLayout === "fullscreen" ? "selected" : ""}>Full-screen</option>
              <option value="scripture_overlay" ${settings.obsLayout === "scripture_overlay" ? "selected" : ""}>Scripture over camera</option>
              <option value="reference_only" ${settings.obsLayout === "reference_only" ? "selected" : ""}>Reference only</option>
            </select>
          </label>
          <label>Projection theme
            <select data-command="bible-settings" data-setting="projectionTheme">
              ${(window.CISProjectionThemes?.ALLOWED_THEME_IDS || ["classic_dark"]).map((id) => {
                const theme = window.CISProjectionThemes.getTheme(id);
                return `<option value="${escapeHtml(id)}" ${settings.projectionTheme === id ? "selected" : ""}>${escapeHtml(theme.label)}</option>`;
              }).join("")}
            </select>
          </label>
          <label>Transition
            <select data-command="bible-settings" data-setting="defaultTransition">
              ${Object.values(window.CISProjectionThemes?.TRANSITIONS || { fade: { id: "fade", label: "Fade" } }).map((item) => `
                <option value="${escapeHtml(item.id)}" ${settings.defaultTransition === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>
              `).join("")}
            </select>
          </label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="autoSplit" ${settings.autoSplit !== false ? "checked" : ""}> Automatic safe split for long verses</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="enterSendsPreview" ${settings.enterSendsPreview !== false ? "checked" : ""}> Enter sends to Preview</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="dualVersion" ${settings.dualVersion ? "checked" : ""}> Dual-version display</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="enableSpeechDetection" ${settings.enableSpeechDetection ? "checked" : ""}> Enable speech-assisted detection (opt-in)</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="enableHistory" ${settings.enableHistory !== false ? "checked" : ""}> Scripture session history</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="showVerseNumbers" ${settings.showVerseNumbers !== false ? "checked" : ""}> Show verse numbers</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="showTranslationAbbr" ${settings.showTranslationAbbr !== false ? "checked" : ""}> Show translation abbreviation</label>
          <label><input type="checkbox" data-command="bible-settings" data-setting="confirmLiveVersionChange" ${settings.confirmLiveVersionChange !== false ? "checked" : ""}> Confirm before changing Live version</label>
        </div>
        <div class="language-status">
          ${translations.map((item) => `
            <div class="language-row">
              <strong>${escapeHtml(item.name)} (${escapeHtml(item.abbreviation || item.code)})</strong>
              <span class="status-pill ready">${escapeHtml(String(item.verseRecords || ""))} verses</span>
              <span class="muted">${escapeHtml(item.license || "")}</span>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  async function handleBibleCommand(command, element) {
    const service = window.CISBibleProjectionService;
    if (!service) return;

    const inputValue = () => {
      const input = document.getElementById("bibleLiveReferenceInput");
      return input ? input.value : "";
    };

    if (command === "set-mode") {
      state.bibleMode = element.dataset.mode || "live";
      saveValue("bibleMode", state.bibleMode);
      render();
      return;
    }
    if (command === "toggle-sermon-mode") {
      state.bibleSermonMode = !state.bibleSermonMode;
      saveValue("bibleSermonMode", state.bibleSermonMode ? "true" : "false");
      paintBibleLive();
      return;
    }
    if (command === "set-search-mode") {
      service.setPreviewField("searchMode", element.dataset.mode || "reference");
      paintBibleLive();
      return;
    }
    if (command === "search-reference" || command === "preview-load") {
      const settings = service.getSettings();
      const value = inputValue();
      const mode = service.getState().preview.searchMode;
      if (mode === "text" && window.CISBibleSearchService) {
        await runBiblePhraseSearch(value, service.getState().preview.translation);
        paintBibleLive();
        return;
      }
      await service.loadPreviewFromInput(value);
      if (command === "search-reference" && settings.enterSendsPreview === false) return;
      return;
    }
    if (command === "apply-suggestion") {
      await service.loadPreviewFromInput(element.dataset.reference || "");
      return;
    }
    if (command === "set-preview-version") {
      const translation = element.value;
      saveValue("bibleTranslation", translation);
      state.bibleTranslation = translation;
      await service.setPreviewTranslation(translation);
      return;
    }
    if (command === "set-destinations") {
      const selected = [...element.selectedOptions].map((opt) => opt.value);
      service.setDestinations(selected.length ? selected : ["main"]);
      return;
    }
    if (command === "send-live") {
      if (window.CISLiveSwitchService) {
        const result = await window.CISLiveSwitchService.commit({ type: "bible" });
        setNotice(result.message || (result.ok ? "Scripture sent Live." : "Send Live cancelled."));
        return;
      }
      const result = service.sendLive();
      setNotice(result.message || "");
      return;
    }
    if (command === "change-live-version") {
      const settings = service.getSettings();
      const translation = service.getState().preview.translation;
      if (settings.confirmLiveVersionChange && !window.confirm(`Change Live scripture to ${translation}?`)) return;
      const result = await service.changeLiveVersion(translation);
      setNotice(result.message || "");
      return;
    }
    if (command === "clear-scripture") {
      const result = service.clearLive();
      setNotice(result.message || "");
      return;
    }
    if (command === "restore-scripture") {
      const result = service.restorePreviousLive();
      setNotice(result.message || "");
      return;
    }
    if (command === "show-logo") return setEmergency("logo");
    if (command === "blackout") return setEmergency("black");
    if (command === "prev-verse") return service.movePreviewVerse(-1);
    if (command === "next-verse") return service.movePreviewVerse(1);
    if (command === "preview-result" || command === "history-preview") {
      await service.loadPreviewFromInput(element.dataset.reference || "");
      return;
    }
    if (command === "send-result-live" || command === "history-live") {
      await service.loadPreviewFromInput(element.dataset.reference || "");
      const result = service.sendLive();
      setNotice(result.message || "");
      return;
    }
    if (command === "add-result-service") {
      addBiblePassageToService(element.dataset.reference || "", service.getState().preview.translation);
      return;
    }
    if (command === "history-copy") {
      const ref = element.dataset.reference || "";
      if (navigator.clipboard && ref) {
        navigator.clipboard.writeText(ref).then(() => setNotice(`Copied ${ref}.`)).catch(() => setNotice(ref));
      }
      return;
    }
    if (command === "clear-history") {
      if (!window.confirm("Clear scripture history for this session?")) return;
      service.clearHistory();
      paintBibleLive();
      return;
    }
    if (command === "speech-start" && window.CISBibleSpeechService) {
      const result = window.CISBibleSpeechService.start();
      setNotice(result.message || "");
      paintBibleLive();
      return;
    }
    if (command === "speech-stop" && window.CISBibleSpeechService) {
      const result = window.CISBibleSpeechService.stop();
      setNotice(result.message || "");
      paintBibleLive();
      return;
    }
    if (command === "speech-preview") {
      const suggestion = service.getState().speechSuggestion;
      if (suggestion?.referenceInput) await service.loadPreviewFromInput(suggestion.referenceInput);
      return;
    }
    if (command === "speech-dismiss") {
      service.dismissSpeechSuggestion();
      paintBibleLive();
      return;
    }
    if (command === "speech-correct") {
      const suggestion = service.getState().speechSuggestion;
      const input = document.getElementById("bibleLiveReferenceInput");
      if (input && suggestion?.referenceInput) input.value = suggestion.referenceInput;
      paintBibleLive();
      return;
    }
  }

  function addBiblePassageToService(reference, translation) {
    if (!reference) return;
    const slot = createPlanSlot("Scripture Reading", worshipPlan.length, {
      type: "custom",
      itemType: "scripture",
      title: reference,
      scriptureRef: reference,
      body: reference,
      notes: translation ? `Translation: ${translation}` : "",
    });
    worshipPlan.push(slot);
    saveWorshipPlan();
    if (window.CISBibleProjectionService) {
      window.CISBibleProjectionService.recordHistory({
        reference,
        translation: translation || "KJV",
        sentLive: false,
        addedToService: true,
      });
    }
    setNotice(`${reference} added to worship plan.`);
    render();
  }

  function bindBibleLiveInput(root) {
    const input = root?.querySelector("#bibleLiveReferenceInput");
    if (!input || input.dataset.perfBound === "1") return;
    input.dataset.perfBound = "1";
    input.addEventListener("input", () => {
      const service = window.CISBibleProjectionService;
      if (!service || service.getState().preview.searchMode !== "text") return;
      const translation = service.getState().preview.translation;
      if (!biblePhraseSearchSession) {
        void runBiblePhraseSearch(input.value, translation).then(() => paintBibleLive());
        return;
      }
      biblePhraseSearchSession.scheduleDebounced((gen, isCurrent) => {
        if (!isCurrent(gen)) return;
        return runBiblePhraseSearch(input.value, translation).then(() => {
          if (!isCurrent(gen)) return;
          paintBibleLive();
        });
      });
    });
  }

  function paintBibleLive() {
    const root = document.getElementById("bibleLiveRoot");
    if (!root || !window.CISBibleLiveUI || !window.CISBibleProjectionService) return;
    root.innerHTML = window.CISBibleLiveUI.renderLiveWorkspace({
      translations: window.CISBibleStore.getTranslations(),
      projectionState: window.CISBibleProjectionService.getState(),
      settings: window.CISBibleProjectionService.getSettings(),
      speechState: window.CISBibleSpeechService ? window.CISBibleSpeechService.getState() : null,
      sermonMode: state.bibleSermonMode,
      bibleMode: state.bibleMode,
    });
    window.CISBibleLiveUI.bindWorkspace(root, handleBibleCommand);
    bindBibleLiveInput(root);
    const input = root.querySelector("#bibleLiveReferenceInput");
    if (input && state.bibleSermonMode) input.focus();
  }

  function bindBibleLive() {
    if (state.view !== "bible" || state.bibleMode !== "live") return;
    paintBibleLive();
  }

  function openBibleLive(reference) {
    state.view = "bible";
    state.bibleMode = "live";
    saveValue("view", "bible");
    saveValue("bibleMode", "live");
    render();
    if (reference && window.CISBibleProjectionService) {
      window.CISBibleProjectionService.loadPreviewFromInput(reference);
    }
  }

  function bibleCacheKey() {
    return `${state.bibleTranslation}:${state.bibleBookOrder}:${state.bibleChapter}`;
  }

  function renderBibleShell() {
    if (!window.CISBibleReaderUI || !window.CISBibleStore) {
      return `<section class="section"><p class="muted">Bible reader failed to load.</p></section>`;
    }
    if (state.bibleMode === "live" && window.CISBibleLiveUI) {
      return `<div id="bibleLiveRoot">${window.CISBibleLiveUI.renderLiveWorkspace({
        translations: window.CISBibleStore.getTranslations(),
        projectionState: window.CISBibleProjectionService ? window.CISBibleProjectionService.getState() : { preview: {}, live: {} },
        settings: window.CISBibleProjectionService ? window.CISBibleProjectionService.getSettings() : {},
        speechState: window.CISBibleSpeechService ? window.CISBibleSpeechService.getState() : null,
        sermonMode: state.bibleSermonMode,
        bibleMode: state.bibleMode,
      })}</div>`;
    }
    const store = window.CISBibleStore;
    return `
      <div id="bibleReaderRoot">
        <div class="bible-mode-tabs">
          <button class="secondary-button" type="button" data-bible-command="set-mode" data-mode="read">Read</button>
          <button class="secondary-button active" type="button" data-bible-command="set-mode" data-mode="live">Bible Live</button>
        </div>
        ${window.CISBibleReaderUI.renderReader({
          translations: store.getTranslations(),
          books: store.getBooks(),
          translationCode: state.bibleTranslation,
          bookOrder: state.bibleBookOrder,
          chapterNumber: state.bibleChapter,
          bookPayload: bibleReaderState.bookPayload,
          chapterPayload: bibleReaderState.chapterPayload,
          highlightVerse: state.bibleVerse,
          loading: bibleReaderState.loading,
          error: bibleReaderState.error,
          translationMeta: store.getTranslationMeta(state.bibleTranslation),
          bookMeta: store.getBookMeta(state.bibleBookOrder),
        })}
      </div>
    `;
  }

  function paintBibleReader() {
    const root = document.getElementById("bibleReaderRoot");
    if (!root || state.view !== "bible" || !window.CISBibleReaderUI) return;
    root.innerHTML = window.CISBibleReaderUI.renderReader({
      translations: window.CISBibleStore.getTranslations(),
      books: window.CISBibleStore.getBooks(),
      translationCode: state.bibleTranslation,
      bookOrder: state.bibleBookOrder,
      chapterNumber: state.bibleChapter,
      bookPayload: bibleReaderState.bookPayload,
      chapterPayload: bibleReaderState.chapterPayload,
      highlightVerse: state.bibleVerse,
      loading: bibleReaderState.loading,
      error: bibleReaderState.error,
      translationMeta: window.CISBibleStore.getTranslationMeta(state.bibleTranslation),
      bookMeta: window.CISBibleStore.getBookMeta(state.bibleBookOrder),
    });
    bindBibleHandlers(root);
  }

  async function loadBibleChapter() {
    if (!window.CISBibleStore) return;
    bibleReaderState.loading = true;
    bibleReaderState.error = "";
    paintBibleReader();
    try {
      const payload = await window.CISBibleStore.loadBook(state.bibleTranslation, state.bibleBookOrder);
      bibleReaderState.bookPayload = payload;
      let chapter = window.CISBibleStore.getChapter(payload, state.bibleChapter);
      if (!chapter) {
        state.bibleChapter = 1;
        saveValue("bibleChapter", state.bibleChapter);
        chapter = window.CISBibleStore.getChapter(payload, 1);
      }
      bibleReaderState.chapterPayload = chapter;
      bibleLoadedKey = bibleCacheKey();
    } catch (error) {
      bibleReaderState.error = (error && error.message) ? error.message : "Could not load Bible text.";
      bibleReaderState.bookPayload = null;
      bibleReaderState.chapterPayload = null;
    } finally {
      bibleReaderState.loading = false;
      paintBibleReader();
      if (state.bibleVerse) {
        const verseEl = document.getElementById(`verse-${state.bibleVerse}`);
        if (verseEl) verseEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function changeBibleChapter(delta) {
    if (!window.CISBibleStore) return;
    const count = window.CISBibleStore.chapterCount(state.bibleBookOrder);
    const next = Math.max(1, Math.min(count, state.bibleChapter + delta));
    if (next === state.bibleChapter) return;
    state.bibleChapter = next;
    state.bibleVerse = 0;
    saveValue("bibleChapter", state.bibleChapter);
    saveValue("bibleVerse", state.bibleVerse);
    bibleLoadedKey = "";
    loadBibleChapter();
  }

  function bindBibleHandlers(root) {
    if (!root || !window.CISBibleReaderUI) return;
    window.CISBibleReaderUI.bindReader(root, {
      handleCommand(command, element) {
        if (command === "set-translation") {
          state.bibleTranslation = element.dataset.translation || element.value;
          saveValue("bibleTranslation", state.bibleTranslation);
          state.bibleVerse = 0;
          saveValue("bibleVerse", state.bibleVerse);
          bibleLoadedKey = "";
          loadBibleChapter();
          return;
        }
        if (command === "set-book") {
          state.bibleBookOrder = Number(element.value);
          state.bibleChapter = 1;
          state.bibleVerse = 0;
          saveValue("bibleBookOrder", state.bibleBookOrder);
          saveValue("bibleChapter", state.bibleChapter);
          saveValue("bibleVerse", state.bibleVerse);
          bibleLoadedKey = "";
          loadBibleChapter();
          return;
        }
        if (command === "set-chapter") {
          state.bibleChapter = Number(element.dataset.chapter);
          state.bibleVerse = 0;
          saveValue("bibleChapter", state.bibleChapter);
          saveValue("bibleVerse", state.bibleVerse);
          bibleLoadedKey = "";
          loadBibleChapter();
          return;
        }
        if (command === "prev-chapter") return changeBibleChapter(-1);
        if (command === "next-chapter") return changeBibleChapter(1);
        if (command === "jump") {
          const input = root.querySelector("[data-bible-command='jump-input']");
          const ref = window.CISBibleStore.parseReference(input ? input.value : "");
          if (!ref) {
            setNotice("Enter a reference like John 3 or John 3:16.");
            return;
          }
          state.bibleBookOrder = ref.bookOrder;
          state.bibleChapter = ref.chapter;
          state.bibleVerse = ref.verse || 0;
          saveValue("bibleBookOrder", state.bibleBookOrder);
          saveValue("bibleChapter", state.bibleChapter);
          saveValue("bibleVerse", state.bibleVerse);
          bibleLoadedKey = "";
          loadBibleChapter();
          return;
        }
        if (command === "copy-reference") {
          const text = window.CISBibleStore.formatReference(state.bibleBookOrder, state.bibleChapter, state.bibleVerse || null);
          if (navigator.clipboard && text) {
            navigator.clipboard.writeText(text).then(() => setNotice(`Copied ${text}.`)).catch(() => setNotice(text));
          } else if (text) {
            setNotice(text);
          }
        }
      },
    });
  }

  async function bindBible() {
    if (state.view !== "bible") return;
    if (state.bibleMode === "live") {
      bindBibleLive();
      return;
    }
    const root = document.getElementById("bibleReaderRoot");
    if (!root) return;
    bindBibleHandlers(root);
    root.querySelectorAll("[data-bible-command='set-mode']").forEach((element) => {
      element.addEventListener("click", () => handleBibleCommand("set-mode", element));
    });
    if (bibleLoadedKey !== bibleCacheKey() || !bibleReaderState.chapterPayload) {
      await loadBibleChapter();
    }
  }

  function setupPerformance() {
    if (window.CISTaskSession) {
      indexSearchSession = window.CISTaskSession.createDebouncedSession({ debounceMs: 200 });
      biblePhraseSearchSession = window.CISTaskSession.createDebouncedSession({ debounceMs: 220 });
    }
    window.addEventListener("beforeunload", () => {
      if (getWorshipSearchUI()?.cancelPending) getWorshipSearchUI().cancelPending();
      if (window.CISBibleSearchService?.cancelActiveSearch) window.CISBibleSearchService.cancelActiveSearch();
      if (window.CISCameraSourceService?.shutdownCleanup) window.CISCameraSourceService.shutdownCleanup();
      if (window.CISObsConnectionService?.clearReconnectTimer) window.CISObsConnectionService.clearReconnectTimer();
      if (window.CISPerformanceMonitor?.shutdown) window.CISPerformanceMonitor.shutdown();
    });
  }

  function paintIndexCollection() {
    if (state.view !== "index" || !window.CISHymnIndexUI) return;
    const pack = getPack();
    if (pack.status !== "ready") return;
    const root = document.getElementById("hymnIndexCollectionRoot");
    if (!root) return;
    const activeRange = activeRangeKey(pack);
    const songs = rangeSongs(activeRange, state.query);
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    window.CISHymnIndexUI.paintCollection(
      root,
      songs,
      state.indexDisplay,
      { ...indexDisplayContext(), query: state.query },
    );
    if (window.CISPerformanceMonitor) {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      window.CISPerformanceMonitor.record("hymnIndexRenderMs", ended - started);
    }
  }

  function scheduleIndexSearch(target) {
    const position = target.selectionStart || target.value.length;
    const collection = document.getElementById("hymnIndexCollectionRoot");
    if (window.CISHymnIndexUI && collection) window.CISHymnIndexUI.setCollectionPending(collection);
    if (!indexSearchSession) {
      rerenderKeepingFocus(target);
      return;
    }
    indexSearchSession.scheduleDebounced((gen, isCurrent) => {
      if (!isCurrent(gen)) return;
      paintIndexCollection();
      const next = document.getElementById(target.id);
      if (next) {
        next.focus();
        next.setSelectionRange(position, position);
      }
    });
  }

  async function runBiblePhraseSearch(query, translation) {
    if (!window.CISBibleSearchService || !window.CISBibleProjectionService) return;
    const service = window.CISBibleProjectionService;
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const results = await window.CISBibleSearchService.searchText(query, {
      translation,
      limit: 30,
    });
    if (results === null) return;
    service.setPreviewField("searchResults", results);
    service.setPreviewField("referenceInput", query);
    if (window.CISPerformanceMonitor) {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      window.CISPerformanceMonitor.record("biblePhraseSearchMs", ended - started);
    }
  }

  function getWorshipSearchContext() {
    const translations = window.CISBibleStore ? window.CISBibleStore.getTranslations() : [];
    const translation = state.bibleTranslation || (translations[0]?.code || "KJV");
    const meta = translations.find((item) => item.code === translation);
    const settings = window.CISBibleProjectionService?.getSettings?.() || {};
    const bibleTranslations = [translation];
    if (settings.secondaryTranslation && !bibleTranslations.includes(settings.secondaryTranslation)) {
      bibleTranslations.push(settings.secondaryTranslation);
    }
    return {
      bibleTranslation: translation,
      bibleAbbreviation: meta?.abbreviation || translation,
      bibleTranslations,
      hymnScope: getSearchScopeOptions(),
      worshipPlan,
      favorites: [...favorites],
      recents,
      hymnLimit: 80,
      bibleLimit: 24,
    };
  }

  function closeWorshipSearch() {
    const returnView = state.searchReturnView || "home";
    state.searchReturnView = "";
    state.view = returnView;
    saveValue("view", state.view);
    if (getWorshipSearchUI()?.cancelPending) getWorshipSearchUI().cancelPending();
    render();
    if (window.CISFocusManager) window.CISFocusManager.restoreFocus();
  }

  async function handleWorshipSearchAction(action, result) {
    if (!result) return;
    const payload = result.payload || {};

    if (action === "preview") {
      if (result.type === "hymn" || result.type === "favorite" || result.type === "recent" || result.type === "media") {
        if (!payload.songKey) return;
        void handleHymnQueueCommand("hymn-preview", { dataset: { songKey: payload.songKey } });
        setNotice("Loaded into Preview. Live output unchanged.");
        return;
      }
      if (result.type === "bible-reference" || result.type === "bible-verse") {
        if (window.CISBibleProjectionService) {
          const input = payload.referenceInput || payload.reference || "";
          await window.CISBibleProjectionService.loadPreviewFromInput(input, {
            translation: payload.translation || state.bibleTranslation,
          });
          if (state.view !== "bible" || state.bibleMode !== "live") {
            state.view = "bible";
            state.bibleMode = "live";
            saveValue("view", state.view);
            saveValue("bibleMode", state.bibleMode);
            render();
          } else {
            paintBibleLive();
          }
          setNotice("Scripture loaded into Bible Preview.");
        }
        return;
      }
      if (result.type === "service-item") {
        state.view = "builder";
        state.activeSlot = payload.slotIndex ?? state.activeSlot;
        saveValue("view", state.view);
        saveValue("activeSlot", state.activeSlot);
        render();
        setNotice("Service item selected in Worship Builder.");
        return;
      }
    }

    if (action === "set-next" && payload.songKey) {
      void handleHymnQueueCommand("hymn-set-next", { dataset: { songKey: payload.songKey } });
      return;
    }
    if (action === "add-queue" && payload.songKey) {
      void handleHymnQueueCommand("hymn-add-queue", { dataset: { songKey: payload.songKey } });
      return;
    }
    if (action === "add-service") {
      if (payload.songKey) {
        assignSongToSlot(typeof payload.slotIndex === "number" ? payload.slotIndex : state.activeSlot, getSongByKey(payload.songKey));
        return;
      }
      if (typeof payload.slotIndex === "number") {
        state.activeSlot = payload.slotIndex;
        saveValue("activeSlot", state.activeSlot);
        state.view = "builder";
        saveValue("view", state.view);
        render();
      }
      return;
    }
    if (action === "send-live") {
      if (result.type === "bible-reference" || result.type === "bible-verse") {
        if (window.CISBibleProjectionService) {
          const input = payload.referenceInput || payload.reference || "";
          await window.CISBibleProjectionService.loadPreviewFromInput(input, {
            translation: payload.translation || state.bibleTranslation,
          });
        }
        if (window.CISLiveSwitchService) {
          const commit = await window.CISLiveSwitchService.commit({ type: "bible" });
          setNotice(commit.message || (commit.ok ? "Scripture sent Live." : "Send Live cancelled."));
        } else if (window.CISBibleProjectionService) {
          const send = window.CISBibleProjectionService.sendLive();
          setNotice(send.message || "Scripture sent Live.");
        }
        return;
      }
      if (payload.songKey) {
        void handleHymnQueueCommand("hymn-send-live", { dataset: { songKey: payload.songKey } });
      }
    }
  }

  function setupSearchEngine() {
    refreshLanguageLibrary();
    if (!window.CISSearchEngine) return;
    window.CISSearchEngine.configure({
      escapeHtml,
      filterRecord: (record) => {
        if ((state.tagFilters || []).length) return matchesTagFilters(record.song, record.code);
        if (state.category !== "all") return matchesCategory(record.song, state.category, record.code);
        return true;
      },
    });
    if (window.CISWorshipSearchEngine) {
      window.CISWorshipSearchEngine.configure({
        makeSongKey: (item) => makeSongKey(item.editionId || item.code || state.editionId, item.number || item.song?.number),
        getSongByKey,
        describeSongKey: describeSongKeyForQueue,
        slotTitle,
        slotSubtitle,
        loadRecentQueries: () => loadJson("worshipSearchRecentQueries", []),
        saveRecentQueries: (items) => saveJson("worshipSearchRecentQueries", items),
      });
    }
    const sharedSearchUiConfig = {
      escapeHtml,
      getQuery: () => state.query,
      setQuery: (value) => { state.query = value; },
      getIndexedCount: () => (window.CISSearchEngine ? window.CISSearchEngine.getRecordCount() : 0),
      getSearchScopeOptions,
      getSearchContext: getWorshipSearchContext,
      renderScopeRow: renderSearchScopeRow,
      onOpenSong: (number, code, editionId) => openSong(number, code, editionId),
      onPreviewSong: (songKeyValue) => {
        if (!songKeyValue) return;
        void handleHymnQueueCommand("hymn-preview", { dataset: { songKey: songKeyValue } });
      },
      onPreviewResult: (result) => handleWorshipSearchAction("preview", result),
      onSearchAction: (action, result) => handleWorshipSearchAction(action, result),
      onCloseSearch: closeWorshipSearch,
      renderFilterRow: () => (
        window.CISTagCatalog && window.CISSongTagsUI
          ? window.CISSongTagsUI.renderFilterRow(window.CISTagCatalog.getAllTags(), state.tagFilters)
          : categoryDefinitions.map((category) => `<button class="filter-chip ${state.category === category.id ? "active" : ""}" type="button" data-command="set-category" data-category="${category.id}">${escapeHtml(category.label)}</button>`).join("")
      ),
      renderSongTags: (song, code) => (
        state.indexDisplay.showCategories === false ? "" : renderSongTags(song, code)
      ),
      makeSongKey: (item) => makeSongKey(item.editionId || state.editionId, item.number || item.song?.number),
      renderHymnQueueActions: (key) => renderHymnQueueActions(key, true),
      getIndexDisplaySettings: () => state.indexDisplay,
      renderIndexCollection: (songs, extra = {}) => {
        if (!window.CISHymnIndexUI) return "";
        window.CISHymnIndexUI.configure({ escapeHtml });
        return window.CISHymnIndexUI.renderCollection(
          window.CISHymnIndexUI.sortSongs(songs, state.indexDisplay.sort, {
            favorites,
            recents,
            songKey: (song) => songKey(song, extra.code || state.languageCode, extra.editionId || state.editionId),
          }),
          state.indexDisplay,
          {
            ...indexDisplayContext(),
            ...extra,
            songKey: (song) => songKey(song, extra.code || state.languageCode, extra.editionId || state.editionId),
            renderSongTags: (song) => (
              state.indexDisplay.showCategories === false
                ? ""
                : renderSongTags(song, extra.code || state.languageCode)
            ),
          },
        );
      },
    };
    if (window.CISWorshipSearchUI) {
      window.CISWorshipSearchUI.configure(sharedSearchUiConfig);
    } else if (window.CISSearchUI) {
      window.CISSearchUI.configure(sharedSearchUiConfig);
    }
    window.CISSearchEngine.rebuildIndex(data.languagePacks);
  }

  function bindGlobalSearch() {
    if (state.view !== "search") return;
    const ui = getWorshipSearchUI();
    if (ui) ui.bind();
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

  function saveWorshipPlan(immediate) {
    if (immediate) {
      if (window.CISBuilderSave) window.CISBuilderSave.flush();
      saveJson("worshipPlan", worshipPlan);
      scheduleSessionRecoverySave("worship-plan");
      return;
    }
    if (window.CISBuilderSave) {
      window.CISBuilderSave.schedule("worshipPlan", worshipPlan);
      return;
    }
    saveJson("worshipPlan", worshipPlan);
  }

  function saveSongService(immediate) {
    if (immediate) {
      if (window.CISBuilderSave) window.CISBuilderSave.flush();
      saveJson("songService", songService);
      return;
    }
    if (window.CISBuilderSave) {
      window.CISBuilderSave.schedule("songService", songService);
      return;
    }
    saveJson("songService", songService);
  }

  function paintBuilderSaveStatus() {
    if (state.view !== "builder" || !window.CISBuilderSave) return;
    const indicator = document.querySelector(".builder-save-status");
    if (!indicator) return;
    indicator.dataset.status = window.CISBuilderSave.getStatus();
    indicator.textContent = window.CISBuilderSave.getStatusLabel();
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
    const key = String(value || "");
    const cache = window.CISStanzaRenderCache;
    if (cache) {
      const cached = cache.get(key);
      if (cached) return cached;
      const html = escapeHtml(value).replace(/\n/g, "<br>");
      cache.set(key, html);
      return html;
    }
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

  function getPack(code = state.languageCode, editionId = state.editionId) {
    const byEdition = data.languagePacks.find((pack) => pack.editionId === editionId);
    if (byEdition) return byEdition;
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

  function makeSongKey(codeOrEdition, number) {
    const editionId = String(codeOrEdition || "").includes("-") ? codeOrEdition : (state.editionId || codeOrEdition);
    const num = String(number).padStart(3, "0");
    if (window.CISHymnalMigration) return window.CISHymnalMigration.buildHymnId(editionId, num);
    return `${editionId}:${num}`;
  }

  function parseSongKey(key) {
    const text = String(key || "");
    const idx = text.lastIndexOf(":");
    if (idx < 0) {
      return { editionId: state.editionId, code: state.languageCode, number: text };
    }
    const prefix = text.slice(0, idx);
    const number = text.slice(idx + 1);
    if (prefix.includes("-")) {
      return {
        editionId: prefix,
        code: resolveEditionPackCode(prefix),
        number,
      };
    }
    const mapped = window.CISHymnalMigration ? window.CISHymnalMigration.resolveEditionFromLegacyCode(prefix) : null;
    if (mapped) {
      return { editionId: mapped.editionId, code: mapped.packCode, number };
    }
    return { editionId: state.editionId, code: prefix || state.languageCode, number };
  }

  function getSong(number, code = state.languageCode, editionId = state.editionId) {
    const pack = getPack(code, editionId);
    return (pack.songs || []).find((song) => song.number === String(number).padStart(3, "0")) || null;
  }

  function getSongByKey(key) {
    const parsed = parseSongKey(key);
    return getSong(parsed.number, parsed.code, parsed.editionId);
  }

  function getSearchScopeOptions() {
    if (state.searchScope === "edition") {
      return { editionIds: [state.editionId] };
    }
    if (state.searchScope === "book") {
      return { hymnBookId: state.hymnBookId };
    }
    return {};
  }

  function renderSearchScopeRow() {
    const scopes = [
      { id: "edition", label: "Current edition" },
      { id: "book", label: "Current book" },
      { id: "all", label: "All hymnals" },
    ];
    return `
      <div class="search-scope-row" role="group" aria-label="Search scope">
        ${scopes.map((scope) => `
          <button
            class="filter-chip ${state.searchScope === scope.id ? "active" : ""}"
            type="button"
            data-command="set-search-scope"
            data-scope="${scope.id}"
          >${escapeHtml(scope.label)}</button>
        `).join("")}
      </div>
    `;
  }

  function getHymnalReferenceData() {
    return {
      favorites: [...favorites],
      recents,
      worshipPlan,
      songService,
      customTemplates,
      songTagMap,
      presenter: state.presenter,
    };
  }

  async function applyHymnalReferencePatch(patch) {
    if (!patch) return;
    const migration = window.CISHymnalMigration;

    const remapKey = (key) => {
      if (!patch.replaceMap || !migration) return key;
      const parsed = parseSongKey(key);
      if (parsed.editionId !== patch.replaceMap.fromEditionId) return key;
      const toCode = resolveEditionPackCode(patch.replaceMap.toEditionId);
      return makeSongKey(patch.replaceMap.toEditionId, parsed.number);
    };

    (patch.removeFavorites || []).forEach((key) => favorites.delete(key));
    if (patch.replaceMap) {
      const nextFavorites = new Set();
      favorites.forEach((key) => nextFavorites.add(remapKey(key)));
      favorites = nextFavorites;
    }
    recents = recents.filter((key) => !(patch.removeRecents || []).includes(key));
    if (patch.replaceMap) recents = recents.map(remapKey);

    worshipPlan = worshipPlan.map((slot, index) => {
      if ((patch.clearWorshipPlanSlots || []).includes(index)) {
        return { ...slot, songKey: "" };
      }
      if (!slot || !slot.songKey) return slot;
      if (patch.replaceMap && window.CISHymnalDeletionService
        && window.CISHymnalDeletionService.matchesEditionKey(slot.songKey, patch.replaceMap.fromEditionId)) {
        return { ...slot, songKey: remapKey(slot.songKey) };
      }
      return slot;
    });

    songService = songService.map((slot, index) => {
      if ((patch.clearSongServiceSlots || []).includes(index)) {
        return { ...slot, songKey: "" };
      }
      if (!slot || !slot.songKey) return slot;
      if (patch.replaceMap && window.CISHymnalDeletionService
        && window.CISHymnalDeletionService.matchesEditionKey(slot.songKey, patch.replaceMap.fromEditionId)) {
        return { ...slot, songKey: remapKey(slot.songKey) };
      }
      return slot;
    });

    customTemplates = customTemplates.map((template) => {
      if (!(patch.clearTemplateSlots || []).includes(template.id)) return template;
      return {
        ...template,
        slots: (template.slots || []).map((slot) => (
          slot && slot.songKey ? { ...slot, songKey: "" } : slot
        )),
      };
    });

    (patch.removeSongTags || []).forEach((key) => {
      delete songTagMap[key];
    });
    if (patch.replaceMap) {
      Object.entries({ ...songTagMap }).forEach(([key, tags]) => {
        if (window.CISHymnalDeletionService
          && window.CISHymnalDeletionService.matchesEditionKey(key, patch.replaceMap.fromEditionId)) {
          const nextKey = remapKey(key);
          songTagMap[nextKey] = tags;
          delete songTagMap[key];
        }
      });
    }

    if (patch.clearPresenter) {
      state.presenter.songKey = "";
      state.presenter.slideIndex = 0;
    } else if (patch.replaceMap && state.presenter.songKey
      && window.CISHymnalDeletionService
      && window.CISHymnalDeletionService.matchesEditionKey(state.presenter.songKey, patch.replaceMap.fromEditionId)) {
      state.presenter.songKey = remapKey(state.presenter.songKey);
    }

    saveJson("favorites", [...favorites]);
    saveJson("recents", recents);
    saveJson("songTags", songTagMap);
    saveWorshipPlan(true);
    saveSongService(true);
    saveJson("customTemplates", customTemplates);
  }

  async function refreshHymnalLibraryAfterMutation() {
    if (!window.CISHymnalLibraryStore) return;
    hymnalBooks = await window.CISHymnalLibraryStore.getBooksWithEditions();
    importedPacks = await window.CISHymnalLibraryStore.getImportedPacksForLegacyApi();
    refreshLanguageLibrary({ fullIndex: true });
    await persistImportedLanguagePacks();
    ensureActiveEdition();
  }

  async function exportHymnalEdition(editionId) {
    if (!window.CISHymnalLibraryStore) return;
    const snapshot = await window.CISHymnalLibraryStore.exportLibrarySnapshot();
    const edition = snapshot.editions.find((item) => item.editionId === editionId);
    const imported = snapshot.importedEditions.find((item) => item.editionId === editionId);
    const book = snapshot.books.find((item) => item.hymnBookId === (edition && edition.hymnBookId));
    const payload = { book, edition, imported };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${editionId || "hymnal"}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${edition ? edition.languageName : editionId}`);
  }

  async function exportHymnalBook(hymnBookId) {
    if (!window.CISHymnalLibraryStore) return;
    const snapshot = await window.CISHymnalLibraryStore.exportLibrarySnapshot();
    const book = snapshot.books.find((item) => item.hymnBookId === hymnBookId);
    const editions = snapshot.editions.filter((item) => item.hymnBookId === hymnBookId);
    const imported = snapshot.importedEditions.filter((item) => editions.some((edition) => edition.editionId === item.editionId));
    const payload = { book, editions, importedEditions: imported };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${hymnBookId || "hymnal-book"}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${book ? book.title : hymnBookId}`);
  }

  function validateImportCompletion(editionId) {
    const edition = getEdition(editionId);
    const pack = data.languagePacks.find((item) => item.editionId === editionId);
    const checks = [
      Boolean(edition),
      Boolean(pack && pack.status === "ready"),
      Boolean(pack && (pack.songs || []).length),
      Boolean(window.CISSearchEngine && window.CISSearchEngine.getRecordCount() > 0),
      hymnalBooks.some((book) => (book.editions || []).some((item) => item.editionId === editionId)),
    ];
    return checks.every(Boolean);
  }

  async function confirmDeleteHymnal(targetType, targetId) {
    if (!window.CISHymnalDeletionService || !window.CISHymnalLibraryStore) return;
    const root = els.modalRoot;
    const store = window.CISHymnalLibraryStore;
    const edition = targetType === "edition" ? store.getEditionById(targetId) : null;
    const book = targetType === "book" ? store.getBookById(targetId) : store.getBookById(edition && edition.hymnBookId);
    const confirmName = targetType === "book"
      ? (book && book.title) || targetId
      : (edition && edition.languageName) || targetId;
    if (!window.CISHymnalDeletionService.validateConfirmInput(root, confirmName)) {
      setNotice(`Type "${confirmName}" to confirm deletion.`);
      return;
    }
    const mode = window.CISHymnalDeletionService.readDeletionMode(root);
    const replaceEditionId = root.querySelector("#hymnalDeleteReplaceEdition")?.value || "";
    try {
      if (targetType === "book") {
        await window.CISHymnalDeletionService.executeBookDeletion(targetId, { mode, replaceEditionId });
      } else {
        await window.CISHymnalDeletionService.executeEditionDeletion(targetId, { mode, replaceEditionId });
      }
      closeModal();
      await refreshHymnalLibraryAfterMutation();
      setNotice(`Deleted ${confirmName}. Backup saved automatically.`);
      render();
    } catch (error) {
      setNotice(error.message || "Could not delete hymnal.");
    }
  }

  async function exportAndDeleteHymnal(targetType, targetId) {
    if (targetType === "book") await exportHymnalBook(targetId);
    else await exportHymnalEdition(targetId);
    await confirmDeleteHymnal(targetType, targetId);
  }

  async function undoHymnalDelete() {
    if (!window.CISHymnalDeletionService) return;
    try {
      const label = await window.CISHymnalDeletionService.undoLastDeletion();
      await refreshHymnalLibraryAfterMutation();
      setNotice(`Restored ${label}.`);
      render();
    } catch (error) {
      setNotice(error.message || "Undo is no longer available.");
    }
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
    if (state.view === "service") return "Service Mode";
    if (state.view === "help") return navLabel("help");
    if (state.view === "song") {
      const song = selectedSong();
      return song ? `${t("nav.song")} ${song.number}` : t("nav.song");
    }
    if (state.view === "bible" && window.CISBibleStore) {
      if (state.bibleMode === "live" && window.CISBibleProjectionService) {
        const live = window.CISBibleProjectionService.getState().live;
        return live.active && !live.cleared ? `Bible Live · ${live.referenceLabel}` : "Bible Live";
      }
      const meta = window.CISBibleStore.getBookMeta(state.bibleBookOrder);
      return meta ? `${meta.name} ${state.bibleChapter}` : navLabel("bible");
    }
    if (state.view === "search") return "Worship Search";
    const item = navItems.find((nav) => nav.id === state.view);
    return item ? navLabel(item.id) : navLabel("home");
  }

  function songKey(song, code = state.languageCode, editionId = state.editionId) {
    return makeSongKey(editionId || code, song.number);
  }

  function addRecent(song, code = state.languageCode, editionId = state.editionId) {
    if (!song) return;
    const key = songKey(song, code, editionId);
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
      gatherSnapshot: async () => {
        const obsExport = window.CISObsSettingsStore
          ? window.CISObsSettingsStore.exportForBackup()
          : {};
        return {
        worshipPlan,
        songService,
        favorites: [...favorites],
        recents,
        customTemplates,
        importedLanguagePacks: importedPacks,
        hymnalLibrary: window.CISHymnalLibraryStore ? await window.CISHymnalLibraryStore.exportLibrarySnapshot() : null,
        songTags: songTagMap,
        tagFilters: state.tagFilters,
        languageCode: state.languageCode,
        hymnBookId: state.hymnBookId,
        editionId: state.editionId,
        uiLocale: state.uiLocale,
        settings: {
          displayMode: state.displayMode,
          fontScale: state.fontScale,
          timerSeconds: state.timerSeconds,
          obsSettings: obsExport.obsSettings || {},
        },
        ui: {
          searchScope: state.searchScope,
          category: state.category,
          indexRange: state.indexRange,
          indexDisplay: state.indexDisplay,
        },
      };
      },
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
          saveWorshipPlan(true);
          saveSongService(true);
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
          migrateLegacySongKeys();
          lines.push("Favorites and recent hymns restored.");
        }

        if (data["language-packs"] && mode("language-packs") !== "skip") {
          importedPacks = mergeImportedPacks(
            data["language-packs"].importedLanguagePacks || [],
            mode("language-packs") === "replace" ? "replace" : "merge",
          );
          if (window.CISHymnalLibraryStore) {
            if (data["language-packs"].hymnalLibrary) {
              await window.CISHymnalLibraryStore.restoreLibrarySnapshot(
                data["language-packs"].hymnalLibrary,
                mode("language-packs") === "replace" ? "replace" : "merge",
              );
            } else {
              await window.CISHymnalLibraryStore.initializeLibrary({
                baseData,
                extraPacks,
                legacyImportedPacks: importedPacks,
                force: true,
              });
            }
            hymnalBooks = await window.CISHymnalLibraryStore.getBooksWithEditions();
            importedPacks = await window.CISHymnalLibraryStore.getImportedPacksForLegacyApi();
          }
          refreshLanguageLibrary({ fullIndex: true });
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
          if (incomingSettings.obsSettings && window.CISObsSettingsStore) {
            window.CISObsSettingsStore.importFromBackup({ obsSettings: incomingSettings.obsSettings });
            lines.push("OBS settings restored (password must be re-entered if not exported).");
          }
          if (data.settings.languageCode) {
            state.languageCode = data.settings.languageCode;
            saveValue("language", state.languageCode);
          }
          if (data.settings.hymnBookId) state.hymnBookId = data.settings.hymnBookId;
          if (data.settings.editionId) state.editionId = data.settings.editionId;
          persistHymnalSelection();
          ensureActiveEdition();
          if (data.settings.uiLocale && window.CISI18n) {
            window.CISI18n.setLocale(data.settings.uiLocale, { force: true });
            state.uiLocale = window.CISI18n.getLocale();
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
          if (ui.indexDisplay && window.CISHymnIndexSettings) {
            state.indexDisplay = window.CISHymnIndexSettings.save(ui.indexDisplay, saveJson);
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
    setNotice(t("notice.tagsSaved"));
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
      setNotice(t("notice.choosePackAndTag"));
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
    setNotice(t("notice.tagsApplied", { count: keys.length, name: pack.name }));
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
    setNotice(t("notice.tagsSuggested", { count: keys.length, name: pack.name }));
    render();
  }

  function songSearchHaystack(song, code = state.languageCode) {
    const base = song.searchText || `${song.number} ${song.title}`.toLowerCase();
    const tagLabels = getSongTags(song, code).map((tagId) => {
      const meta = getTagMeta(tagId);
      return meta ? meta.label : tagId;
    }).join(" ");
    return `${base} ${tagLabels}`.trim().toLowerCase();
  }

  function searchSongs(query, limit, code = state.languageCode, useCategory = false) {
    const songs = getSongs(code);
    const q = plain(query).toLowerCase();
    const results = q
      ? songs.filter((song) => songSearchHaystack(song, code).includes(q))
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
    const songs = searchSongs(query, undefined, state.languageCode, true).filter((song) => {
      const number = Number(song.number);
      return number >= range[1] && number <= range[2];
    });
    if (window.CISHymnIndexUI) {
      return window.CISHymnIndexUI.sortSongs(songs, state.indexDisplay.sort, {
        favorites,
        recents,
        songKey: (song) => songKey(song),
      });
    }
    return songs.sort((a, b) => Number(a.number) - Number(b.number));
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
    renderTopbarLabels();
    setupBranding();
    els.title.textContent = viewTitle();
    if (state.view !== "song" && hymnAudioPlayer) hymnAudioPlayer.pause();
    const serviceBar = renderServiceModeContextBar();
    els.content.innerHTML = `${renderNotice()}${serviceBar}${renderView()}`;
    renderPresenterAV();
    renderObsTopbar();
    renderOperatorStatus();
    renderQuietServiceModeBanner();
    renderEmergencyOverlay();
    if (state.view === "builder") bindBuilderInteractions();
    bindGlobalSearch();
    bindKeyboardShortcutPanels();
    if (els.modalRoot?.innerHTML) {
      const modal = els.modalRoot.querySelector(".modal, [role='dialog']");
      if (modal && window.CISFocusManager) window.CISFocusManager.trapFocus(modal);
    }
    bindHymnAudio();
    bindBible();
    bindBackupSettings();
    bindHelpCentre();
    renderHelpContextOverlay();
    paintLiveHymnQueuePanels();
    paintServiceModeWorkspace();
    renderLiveLockStrip();
    if (state.view === "presenter" || state.view === "settings") bindObsProgramMonitor();
    if (state.view === "cameras" || state.view === "presenter" || state.view === "settings") bindCameraSources();
    document.body.classList.toggle("service-mode-active", isServiceModeActive());
    document.body.classList.toggle("quiet-service-mode-active", isQuietServiceModeActive());
    document.body.classList.add("app-ready");
    if (!firstRenderMarked && window.CISPerformanceMonitor) {
      window.CISPerformanceMonitor.measure("initialRenderMs", "app-start");
      firstRenderMarked = true;
    }
  }

  function renderNotice() {
    if (!state.notice) return "";
    const levelClass = state.noticeLevel ? ` app-notice-${state.noticeLevel}` : "";
    return `<div class="app-notice${levelClass}" role="status">${escapeHtml(state.notice)}</div>`;
  }

  function setNotice(message, options) {
    const text = message || "";
    const quiet = window.CISQuietServiceModeService;
    if (quiet && quiet.isActive() && text) {
      const decision = quiet.evaluateNotice(text, options || {});
      if (decision.defer) {
        quiet.queueNotice(text, decision.level);
        return;
      }
      state.notice = text;
      state.noticeLevel = decision.unobtrusive ? "important" : (decision.level === "critical" ? "critical" : "");
      render();
      if (text) {
        window.clearTimeout(setNotice.timer);
        const timeout = decision.unobtrusive ? 9000 : 5200;
        setNotice.timer = window.setTimeout(() => {
          if (state.notice === text) {
            state.notice = "";
            state.noticeLevel = "";
            render();
          }
        }, timeout);
      }
      return;
    }
    state.notice = text;
    state.noticeLevel = "";
    render();
    if (text) {
      window.clearTimeout(setNotice.timer);
      setNotice.timer = window.setTimeout(() => {
        if (state.notice === text) {
          state.notice = "";
          state.noticeLevel = "";
          render();
        }
      }, 5200);
    }
  }

  function navIconMarkup(id, fallback) {
    if (window.CISUiIcons) return window.CISUiIcons.nav(id);
    return fallback || "";
  }

  function gatherOperatorStatus() {
    const items = [];
    const presenter = window.CISPresenterEngine ? window.CISPresenterEngine.getState() : null;
    const obs = window.CISObsConnectionService ? window.CISObsConnectionService.getStatus() : null;
    const liveLock = window.CISLiveLockService ? window.CISLiveLockService.getState() : null;
    const serviceMode = window.CISServiceModeService ? window.CISServiceModeService.isActive() : false;

    items.push({
      label: "Local Outputs",
      value: presenter?.outputOpen ? "Open" : "Closed",
      tone: presenter?.outputOpen ? "ready" : "off",
    });
    items.push({
      label: "Current Service",
      value: isQuietServiceModeActive()
        ? "Quiet Service Mode"
        : (isServiceModeActive() ? "Service Mode" : (presenter?.active ? "Live" : "Browse")),
      tone: presenter?.active || isServiceModeActive() || isQuietServiceModeActive() ? "ready" : "off",
    });

    if (obs) {
      const obsTone = obs.connected ? "ready" : (obs.state === "reconnecting" || obs.state === "connecting" ? "warning" : "off");
      items.push({
        label: "OBS",
        value: obs.connected ? "Connected" : (obs.enabled ? "Disconnected" : "Off"),
        tone: obsTone,
      });
      if (obs.enabled && obs.obsRuntime) {
        items.push({
          label: "Internet Streaming",
          value: obs.obsRuntime.streaming ? "Live" : "Off",
          tone: obs.obsRuntime.streaming ? "ready" : "off",
        });
        items.push({
          label: "Recording",
          value: obs.obsRuntime.recording ? "On" : "Off",
          tone: obs.obsRuntime.recording ? "warning" : "off",
        });
        items.push({
          label: "Virtual Camera",
          value: obs.obsRuntime.virtualCamera ? "On" : "Off",
          tone: obs.obsRuntime.virtualCamera ? "ready" : "off",
        });
      }
    }

    if (liveLock) {
      items.push({
        label: "Live Lock",
        value: liveLock.active || liveLock.enabled ? "On" : "Off",
        tone: liveLock.active || liveLock.enabled ? "warning" : "off",
        icon: window.CISUiIcons ? window.CISUiIcons.get("lock") : "",
      });
    }

    items.push({
      label: "Quiet Service Mode",
      value: serviceMode ? "On" : "Off",
      tone: serviceMode ? "ready" : "off",
    });

    items.push({
      label: "Backup",
      value: autoBackupList.length ? "Ready" : "None",
      tone: autoBackupList.length ? "ready" : "off",
    });

    return { items };
  }

  function renderOperatorStatus() {
    if (!els.operatorStatusRoot || !window.CISOperatorStatusStrip) return;
    els.operatorStatusRoot.innerHTML = window.CISOperatorStatusStrip.render(gatherOperatorStatus());
  }

  function setupUx() {
    if (window.CISOperatorStatusStrip) window.CISOperatorStatusStrip.configure({ escapeHtml });
    if (window.CISUiIcons) {
      // icons are static; no configure required
    }
  }

  function renderNav() {
    const serviceNavItems = [
      { id: "service", label: "Service Mode", icon: "⬤" },
      { id: "search", label: "Worship Search", icon: "⌕" },
      { id: "index", label: "Hymn Index", icon: "☰" },
      { id: "bible", label: "Bible", icon: "✞" },
      { id: "help", label: "Help", icon: "?" },
    ];
    const items = isServiceModeActive() ? serviceNavItems : navItems;
    els.nav.innerHTML = items.map((item) => `
      <button class="rail-btn ${state.view === item.id ? "active" : ""}" type="button" data-view="${item.id}" aria-current="${state.view === item.id ? "page" : "false"}">
        <span class="ico" aria-hidden="true">${navIconMarkup(item.id, item.icon)}</span>
        <span>${escapeHtml(isServiceModeActive() && item.id === "service" ? "Service Mode" : navLabel(item.id))}</span>
      </button>
    `).join("");
  }

  function setupI18n() {
    if (!window.CISI18n) return;
    state.uiLocale = window.CISI18n.getLocale();
    window.CISI18n.onChange((code) => {
      state.uiLocale = code;
      render();
    });
  }

  function renderTopbarLabels() {
    if (els.topbarEyebrow) els.topbarEyebrow.textContent = t("topbar.eyebrow");
    if (els.topbarPresenterBtn) els.topbarPresenterBtn.textContent = t("topbar.presenter");
    if (els.topbarHelpBtn) els.topbarHelpBtn.textContent = t("topbar.help");
    if (els.topbarEmergencyBtn) {
      els.topbarEmergencyBtn.textContent = t("presenter.emergencyHelp");
      els.topbarEmergencyBtn.title = t("presenter.emergencyHelp");
    }
    const serviceBtn = document.getElementById("topbarServiceModeBtn");
    if (serviceBtn) {
      serviceBtn.textContent = isServiceModeActive() ? "Exit Service Mode" : "Enter Service Mode";
      serviceBtn.dataset.command = isServiceModeActive() ? "service-mode-exit" : "service-mode-enter";
      serviceBtn.setAttribute("aria-pressed", isServiceModeActive() ? "true" : "false");
    }
    const quietBtn = document.getElementById("topbarQuietServiceModeBtn");
    if (quietBtn) {
      quietBtn.textContent = isQuietServiceModeActive() ? "Exit Quiet Service Mode" : "Enter Quiet Service Mode";
      quietBtn.dataset.command = isQuietServiceModeActive() ? "quiet-service-mode-exit" : "quiet-service-mode-enter";
      quietBtn.setAttribute("aria-pressed", isQuietServiceModeActive() ? "true" : "false");
    }
  }

  function renderLocaleDropdown(root, options) {
    if (!root) return;
    const {
      open,
      triggerClass,
      ariaLabel,
      currentFlag,
      currentLabel,
      currentMeta,
      toggleCommand,
      items,
    } = options;
    root.innerHTML = `
      <div class="locale-dropdown ${open ? "open" : ""} ${triggerClass || ""}">
        <button
          class="locale-dropdown-trigger ${triggerClass || ""}"
          type="button"
          data-command="${toggleCommand}"
          aria-haspopup="menu"
          aria-expanded="${open ? "true" : "false"}"
          aria-label="${escapeHtml(ariaLabel)}"
        >
          <span class="locale-flag" aria-hidden="true">${currentFlag}</span>
          <span class="locale-label">${escapeHtml(currentLabel)}</span>
          ${currentMeta ? `<span class="locale-meta-inline muted">${escapeHtml(currentMeta)}</span>` : ""}
          <span class="locale-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="locale-dropdown-menu" role="menu">
          ${items}
        </div>
      </div>
    `;
  }

  function renderLanguageSwitcher() {
    if (window.CISI18n && els.uiLocaleSwitcher) {
      const currentMeta = window.CISI18n.getLocaleMeta(state.uiLocale);
      const localeItems = window.CISI18n.SUPPORTED_LOCALES.map((code) => {
        const meta = window.CISI18n.getLocaleMeta(code);
        const active = code === state.uiLocale ? "active" : "";
        return `
          <button class="locale-dropdown-item ${active}" type="button" role="menuitem" data-ui-locale="${escapeHtml(code)}">
            <span class="locale-flag" aria-hidden="true">${meta.flag}</span>
            <span>
              ${escapeHtml(meta.nativeLabel)}
              <span class="locale-meta">${escapeHtml(meta.label)}</span>
            </span>
          </button>
        `;
      }).join("");
      renderLocaleDropdown(els.uiLocaleSwitcher, {
        open: uiLocaleMenuOpen,
        ariaLabel: t("topbar.uiLanguage"),
        currentFlag: currentMeta.flag,
        currentLabel: currentMeta.nativeLabel,
        toggleCommand: "toggle-ui-locale-menu",
        items: localeItems,
      });
    }

    if (els.hymnBookSwitcher && window.CISHymnalLibraryUI) {
      els.hymnBookSwitcher.innerHTML = window.CISHymnalLibraryUI.renderBookSwitcher(hymnalSelectorContext("topbar"));
    }
    if (els.hymnEditionSwitcher && window.CISHymnalLibraryUI) {
      els.hymnEditionSwitcher.innerHTML = window.CISHymnalLibraryUI.renderEditionSwitcher(hymnalSelectorContext("topbar"));
    }
  }

  function renderView() {
    if (state.view === "service") return renderServiceMode();
    if (state.view === "index") return renderIndex();
    if (state.view === "search") return renderSearch();
    if (state.view === "song") return renderSong();
    if (state.view === "builder") return renderBuilder();
    if (state.view === "presenter") return renderPresenterDashboard();
    if (state.view === "cameras") return renderCameraSources();
    if (state.view === "favorites") return renderFavorites();
    if (state.view === "bible") return renderBibleShell();
    if (state.view === "help") return renderHelpCentre();
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
        <p class="eyebrow">${escapeHtml(t("home.eyebrow"))}</p>
        <h2>${escapeHtml(t("home.title"))}</h2>
        <p>${escapeHtml(t("home.subtitle"))}</p>
        <label class="hero-search">
          <span aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("search") : "⌕"}</span>
          <input id="homeSearchInput" type="search" value="" placeholder="${escapeHtml(t("home.searchPlaceholder"))}">
        </label>
        <div class="stat-row">
          <div class="stat-chip"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(t("home.hymnsIn", { name: pack.name || t("topbar.hymnLibrary") }))}</span></div>
          <div class="stat-chip"><strong>${favoriteCount}</strong><span>${escapeHtml(t("home.favorites"))}</span></div>
          <div class="stat-chip"><strong>${assignedCount}</strong><span>${escapeHtml(t("home.inTodaysSet"))}</span></div>
        </div>
      </section>
      ${recent ? `
        <div class="continue-strip">
          <div>
            <span>${escapeHtml(t("home.continueReading"))}</span>
            <strong>${escapeHtml(getPack(parseSongKey(recent.key).code).name)} · ${escapeHtml(t("notice.hymnPrefix", { number: recent.song.number }))} · ${escapeHtml(recent.song.title)}</strong>
          </div>
          <button type="button" data-song="${escapeHtml(recent.song.number)}" data-lang-jump="${escapeHtml(parseSongKey(recent.key).code)}">${escapeHtml(t("common.open"))}</button>
        </div>
      ` : ""}
      <div class="dashboard-grid">
        <section class="section">
          <div class="metric-row">
            <div class="metric"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(t("home.hymnsIn", { name: pack.name || t("topbar.hymnLibrary") }))}</span></div>
            <div class="metric"><strong>${data.meta.deckSlideCount || 0}</strong><span>${escapeHtml(t("home.sourceSlides"))}</span></div>
            <div class="metric"><strong>${readyPacks}/${data.languagePacks.length}</strong><span>${escapeHtml(t("home.packsReady"))}</span></div>
          </div>
          <div class="command-grid">
            ${commandCard("index", "☰", t("home.hymnIndex"), t("home.hymnIndexDetail"))}
            ${commandCard("search", "⌕", t("home.searchCentre"), t("home.searchCentreDetail"))}
            ${commandCard("bible", "✞", t("home.bible"), t("home.bibleDetail"))}
            ${commandCard("builder", "+", t("home.worshipBuilder"), t("home.worshipBuilderDetail"))}
            ${commandCard("favorites", "★", t("home.favorites"), t("home.favoritesDetail"))}
            ${commandCard("presenter", "▶", t("home.presenterDashboard"), t("home.presenterDashboardDetail"))}
            ${commandCard("help", "?", t("home.helpCentre"), t("home.helpCentreDetail"))}
            ${commandCard("settings", "⚙", t("home.languagePacks"), t("home.languagePacksDetail"))}
          </div>
        </section>
        <aside class="panel">
          <h2>${escapeHtml(t("home.quickJump"))}</h2>
          <div class="range-grid">
            ${ranges.map((range) => `<button class="range-button" type="button" data-command="range-open" data-range="${range[0]}">${range[0]}</button>`).join("")}
          </div>
          <hr>
          <h3>${escapeHtml(t("home.liveService"))}</h3>
          ${firstAssigned ? renderCurrentSlot(firstAssigned) : renderCurrentSong(current)}
          ${window.CISObsSettingsUI && window.CISObsConnectionService
            ? window.CISObsSettingsUI.renderDashboardStatus(window.CISObsConnectionService.getStatus())
            : ""}
          <div class="button-row">
            <button class="action-button" type="button" data-command="present-current">${escapeHtml(t("common.present"))}</button>
            <button class="secondary-button" type="button" data-view="builder">${escapeHtml(t("home.worshipBuilderBtn"))}</button>
            <button class="secondary-button service-touch-btn" type="button" data-command="service-mode-enter">Enter Service Mode</button>
          </div>
        </aside>
      </div>
    `;
  }

  function commandCard(view, icon, title, detail) {
    const iconMarkup = window.CISUiIcons ? (window.CISUiIcons.nav(view) || window.CISUiIcons.get(icon) || icon) : icon;
    return `
      <button class="command-card" type="button" data-view="${view}">
        <span class="command-icon" aria-hidden="true">${iconMarkup}</span>
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

  function persistIndexDisplay(patch) {
    if (!window.CISHymnIndexSettings) return;
    state.indexDisplay = window.CISHymnIndexSettings.patch(state.indexDisplay, patch, saveJson);
  }

  function indexDisplayContext() {
    return {
      settings: state.indexDisplay,
      query: state.query,
      favorites,
      recents,
      activeCategory: state.category,
      activeTagFilters: state.tagFilters,
      songKey: (song) => songKey(song),
      langCode: state.languageCode,
      editionId: state.editionId,
      renderSongTags: (song, code = state.languageCode) => renderSongTags(song, code),
      renderHymnQueueActions: (song, extra = {}) => renderHymnQueueActions(
        songKey(song, extra.code || state.languageCode, extra.editionId || state.editionId),
        true,
      ),
      categories: categoryDefinitions,
      renderFilterRow: () => (
        window.CISTagCatalog && window.CISSongTagsUI
          ? window.CISSongTagsUI.renderFilterRow(window.CISTagCatalog.getAllTags(), state.tagFilters)
          : ""
      ),
    };
  }

  function renderIndex() {
    const pack = getPack();
    if (pack.status !== "ready") return renderAwaitingPack(pack);
    if (!window.CISHymnIndexUI) {
      const ranges = rangeOptions(pack);
      const activeRange = activeRangeKey(pack);
      const songs = rangeSongs(activeRange, state.query);
      return `
        <section class="section">
          <div class="toolbar">
            <label class="search-box">
              <span aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("search") : "⌕"}</span>
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
    window.CISHymnIndexUI.configure({ escapeHtml });
    const ranges = rangeOptions(pack);
    const activeRange = activeRangeKey(pack);
    const songs = rangeSongs(activeRange, state.query);
    return window.CISHymnIndexUI.renderPage({
      ...indexDisplayContext(),
      ranges,
      activeRange,
      songs,
      renderHymnalSelectors: () => (
        window.CISHymnalLibraryUI
          ? window.CISHymnalLibraryUI.renderIndexSelectors(hymnalSelectorContext("index"))
          : ""
      ),
    });
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
    const ui = getWorshipSearchUI();
    if (ui) return ui.renderPage(state.query);
    const pack = getPack();
    const results = allSearchResults(state.query, 120);
    return `
      <section class="section">
        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("search") : "⌕"}</span>
            <input id="globalSearchInput" type="search" value="${escapeHtml(state.query)}" placeholder="Search number, title, verse, or chorus">
          </label>
          <span class="muted">${results.length} result${results.length === 1 ? "" : "s"}</span>
        </div>
        <div class="result-list">
          ${results.map((item) => renderSearchResult(item.song, item.code, item.pack)).join("") || `<div class="empty-state">No hymns match this search.</div>`}
        </div>
      </section>
    `;
  }

  function renderSearchResult(song, code = state.languageCode, pack = getPack(code)) {
    const editionId = pack.editionId || state.editionId;
    const key = makeSongKey(editionId, song.number);
    const tags = renderSongTags(song, code);
    return `
      <div class="result-item search-result-with-actions">
        <button class="result-item-main" type="button" data-song="${song.number}" data-lang-jump="${escapeHtml(code)}" data-edition-jump="${escapeHtml(editionId)}">
          <strong>${escapeHtml(pack.name || "Language")} · Hymn ${escapeHtml(song.number)}</strong>
          <span>${escapeHtml(song.title)}</span>
          ${tags ? `<div class="result-tags">${tags}</div>` : ""}
          <small>${resultSnippet(song, state.query)}</small>
        </button>
        ${renderHymnQueueActions(key, true)}
      </div>
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
      ${renderLiveHymnQueueMount(true)}
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
              <button class="secondary-button ${state.practiceMode ? "active" : ""}" type="button" data-command="toggle-practice-mode">${state.practiceMode ? "Close Practice" : "Practice"}</button>
              <button class="secondary-button" type="button" data-command="toggle-favorite" aria-pressed="${isFavorite ? "true" : "false"}">${isFavorite ? `${window.CISUiIcons ? window.CISUiIcons.get("star") : "★"} Saved` : `${window.CISUiIcons ? window.CISUiIcons.get("starOutline") : "☆"} Save`}</button>
              <button class="secondary-button" type="button" data-command="open-slot-picker">Add to Set</button>
              ${renderHymnQueueActions(key)}
              <button class="secondary-button" type="button" data-command="present-song">Present</button>
            </div>
          </div>
          <div id="hymnAudioDock"></div>
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

  function setupBuilderSystems() {
    if (window.CISBuilderOrderPreview) {
      window.CISBuilderOrderPreview.configure({ escapeHtml });
    }
    if (!window.CISBuilderSave) return;
    window.CISBuilderSave.configure({
      saveJson,
      debounceMs: 500,
      onStatusChange: paintBuilderSaveStatus,
    });
    window.addEventListener("beforeunload", () => {
      if (window.CISBuilderSave.hasPending()) window.CISBuilderSave.flush();
    });
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
    const serviceList = document.querySelector(".song-service-list");
    if (serviceList && window.CISTemplateUI) {
      window.CISTemplateUI.bindServiceDragDrop(serviceList, reorderServiceSlots);
    }
    paintBuilderSaveStatus();
  }

  function reorderPlanSlots(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= worshipPlan.length || toIndex >= worshipPlan.length) return;
    const item = worshipPlan.splice(fromIndex, 1)[0];
    worshipPlan.splice(toIndex, 0, item);
    state.activeSlot = toIndex;
    saveValue("activeSlot", state.activeSlot);
    saveWorshipPlan();
    render();
  }

  function reorderServiceSlots(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= songService.length || toIndex >= songService.length) return;
    const item = songService.splice(fromIndex, 1)[0];
    songService.splice(toIndex, 0, item);
    state.activeSongServiceSlot = toIndex;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveSongService();
    render();
  }

  function buildOrderPreviewItem(slot, isSongService) {
    const ready = isSongService
      ? !!(slot.songKey && getSongByKey(slot.songKey))
      : slotHasContent(slot);
    const type = resolveSlotType(slot);
    const meta = window.CISSlideContent ? window.CISSlideContent.getSlideType(type) : null;
    const slides = isSongService
      ? (slot.songKey && getSongByKey(slot.songKey) ? getSongByKey(slot.songKey).slides.length : 0)
      : (ready ? slotSlides(slot).length : 0);
    const song = slotSong(slot);
    let detail = ready ? slotTitle(slot) : "Not configured";
    if (song) detail = `Hymn ${song.number} · ${song.title}`;
    return {
      role: slot.role || "Service item",
      detail,
      typeBadge: meta ? meta.label : "",
      slideCount: slides,
      ready,
    };
  }

  function buildOrderPreviewModel() {
    const songServiceItems = songService.map((slot) => buildOrderPreviewItem(slot, true));
    const worshipItems = worshipPlan.map((slot) => buildOrderPreviewItem(slot, false));
    const totalSlides = [...songServiceItems, ...worshipItems].reduce((sum, item) => sum + (item.slideCount || 0), 0);
    const assignedCount = assignedSongServiceSlots().length + assignedSlots().length;
    return {
      expanded: state.showOrderPreview,
      songServiceItems,
      worshipItems,
      totalSlides,
      assignedCount,
      totalItems: songService.length + worshipPlan.length,
    };
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
      setNotice(t("notice.templateNameRequired"));
      return;
    }
    if (!payload.slots.length) {
      setNotice(t("notice.templateItemsRequired"));
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
    setNotice(t("notice.templateSaved", { name: nextTemplate.name }));
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
    setNotice(t("notice.templateDeleted", { name: template.name }));
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
      ${renderLiveHymnQueueMount(true)}
      ${templateGallery}
      <section class="section opens-service">
        <div class="song-header">
          <div>
            <p class="eyebrow">${escapeHtml(t("builder.opensService"))}</p>
            <h2>${escapeHtml(t("builder.songService"))}</h2>
            <p class="muted">${escapeHtml(t("builder.songServiceDesc"))}</p>
          </div>
          <div class="song-actions">
            ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">${escapeHtml(t("notice.hymnPrefix", { number: current.number }))}</button>` : ""}
            <button class="action-button" type="button" data-command="present-song-service">${escapeHtml(t("builder.presentSongService"))}</button>
            <button class="secondary-button" type="button" data-command="clear-song-service">${escapeHtml(t("builder.clearSongService"))}</button>
          </div>
        </div>
        <div class="service-summary">${escapeHtml(t("builder.openingAssigned", { assigned: songServiceAssigned.length, total: songService.length }))}</div>
        <p class="muted drag-hint">Drag the ⋮⋮ handle to reorder opening songs. Use ↑↓ keys when the handle is focused.</p>
        <div class="song-service-list">
          ${songService.map(renderSongServiceRow).join("")}
        </div>
      </section>
      ${window.CISBuilderOrderPreview ? window.CISBuilderOrderPreview.renderOrderPreview(buildOrderPreviewModel()) : ""}
      <div class="builder-grid">
        <section class="section">
          <div class="song-header">
            <div>
              <h2>${escapeHtml(t("builder.worshipBuilder"))}</h2>
              <p class="muted builder-status-line">
                ${escapeHtml(t("builder.itemsReady", { assigned: assignedSlots().length, total: worshipPlan.length }))}
                ${window.CISBuilderOrderPreview && window.CISBuilderSave
    ? window.CISBuilderOrderPreview.renderSaveIndicator(window.CISBuilderSave.getStatus(), window.CISBuilderSave.getStatusLabel())
    : ""}
              </p>
            </div>
            <div class="song-actions">
              <button class="action-button" type="button" data-command="toggle-add-content">${escapeHtml(t("builder.addContent"))}</button>
              <button class="secondary-button" type="button" data-command="save-template">${escapeHtml(t("builder.saveTemplate"))}</button>
              <button class="secondary-button" type="button" data-command="copy-plan">${escapeHtml(t("builder.copyBuilder"))}</button>
              <button class="secondary-button" type="button" data-command="export-plan">${escapeHtml(t("builder.exportBuilder"))}</button>
              <button class="secondary-button" type="button" data-command="export-bulletin">${escapeHtml(t("builder.serviceBulletin"))}</button>
              <button class="secondary-button" type="button" data-command="import-plan">${escapeHtml(t("builder.importBuilder"))}</button>
              <button class="secondary-button" type="button" data-command="print-set">${escapeHtml(t("common.print"))}</button>
              <button class="danger-button" type="button" data-command="clear-plan">${escapeHtml(t("common.clear"))}</button>
              <input id="worshipPlanImport" class="hidden" type="file" accept="application/json">
            </div>
          </div>
          ${state.showAddContent && window.CISBuilderSlides ? window.CISBuilderSlides.renderAddContentMenu() : ""}
          <p class="muted drag-hint">Drag the ⋮⋮ handle to reorder any item — hymns, scripture, prayers, and more. Use ↑↓ keys when the handle is focused.</p>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>${escapeHtml(t("builder.assignHymn"))}</h3>
          <p class="muted">Builder: ${escapeHtml(worshipPlan[state.activeSlot]?.role || worshipPlan[0].role)} · Song Service: ${escapeHtml(songService[state.activeSongServiceSlot]?.role || songService[0].role)}</p>
          ${worshipSuggestionBlock}
          ${serviceSuggestionBlock}
          ${current ? `<button class="action-button" type="button" data-command="assign-current">Use Hymn ${escapeHtml(current.number)}</button>` : ""}
          ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">Use Hymn ${escapeHtml(current.number)} in Song Service</button>` : ""}
          <hr>
          <label class="search-box">
            <span aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("search") : "⌕"}</span>
            <input id="builderSearchInput" type="search" value="${escapeHtml(state.builderQuery)}" placeholder="${escapeHtml(t("builder.findHymn"))}">
          </label>
          <div class="result-list">
            ${results.map((song) => `
              <div class="result-item result-choice">
                <button type="button" data-command="assign-song" data-song="${song.number}">
                  <strong>Hymn ${escapeHtml(song.number)}</strong>
                  <span>${escapeHtml(song.title)}</span>
                  ${renderSongTags(song) ? `<span class="result-tags">${renderSongTags(song)}</span>` : ""}
                </button>
                <button type="button" data-command="assign-service-song" data-song="${song.number}">${escapeHtml(t("builder.songServiceBtn"))}</button>
              </div>
            `).join("") || `<div class="empty-state">${escapeHtml(t("builder.noHymns"))}</div>`}
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
          ${song ? `<button type="button" data-command="hymn-set-next" data-song-key="${escapeHtml(slot.songKey)}" title="Set as Next">Next</button>` : ""}
          ${song ? `<button type="button" data-command="hymn-add-queue" data-song-key="${escapeHtml(slot.songKey)}" title="Add to Queue">+Q</button>` : ""}
          ${custom ? `<button type="button" data-command="edit-slide-item" data-slot="${index}" title="Edit">✎</button>` : ""}
          <button type="button" data-command="move-slot-up" data-slot="${index}" title="Move up" aria-label="Move up">Up</button>
          <button type="button" data-command="move-slot-down" data-slot="${index}" title="Move down" aria-label="Move down">Down</button>
          <button type="button" data-command="move-slot-top" data-slot="${index}" title="Move to top" aria-label="Move to top">Top</button>
          <button type="button" data-command="move-slot-bottom" data-slot="${index}" title="Move to bottom" aria-label="Move to bottom">Bottom</button>
          <button type="button" data-command="remove-slot-song" data-slot="${index}" title="Remove" aria-label="Remove item">Remove</button>
        </div>
      </div>
    `;
  }

  function renderSongServiceRow(slot, index) {
    const song = getSongByKey(slot.songKey);
    const active = state.activeSongServiceSlot === index ? "active" : "";
    return `
      <div class="set-row song-service-row ${active}" data-service-slot="${index}">
        <button class="drag-handle" type="button" draggable="true" data-drag-service-slot="${index}" aria-label="Drag to reorder song service item">⋮⋮</button>
        <div class="set-number">${index + 1}</div>
        <button class="slot-button ${active}" type="button" data-command="activate-service-slot" data-service-slot="${index}">${escapeHtml(slot.role)}</button>
        <div class="set-song ${song ? "assigned" : ""}">${song ? `Hymn ${escapeHtml(song.number)} · ${escapeHtml(song.title)}` : "No hymn assigned"}</div>
        <div class="mini-actions">
          ${song ? `<button type="button" data-command="present-service-slot" data-service-slot="${index}" title="Present">▶</button>` : ""}
          ${song ? `<button type="button" data-command="open-service-song" data-service-slot="${index}" title="Open">↗</button>` : ""}
          <button type="button" data-command="move-service-up" data-service-slot="${index}" title="Move up" aria-label="Move up">Up</button>
          <button type="button" data-command="move-service-down" data-service-slot="${index}" title="Move down" aria-label="Move down">Down</button>
          <button type="button" data-command="move-service-top" data-service-slot="${index}" title="Move to top" aria-label="Move to top">Top</button>
          <button type="button" data-command="move-service-bottom" data-service-slot="${index}" title="Move to bottom" aria-label="Move to bottom">Bottom</button>
          <button type="button" data-command="remove-service-song" data-service-slot="${index}" title="Remove" aria-label="Remove item">Remove</button>
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

  function getProjectionContextForOutput(item, slide) {
    const projection = window.CISProjectionSettings
      ? window.CISProjectionSettings.load(loadJson)
      : (window.CISProjectionSettings?.DEFAULTS || {});
    const bibleSettings = window.CISBibleProjectionService?.getSettings?.() || {};
    let outputProfile = projection.outputProfile || "projector";
    if (item?.destinations?.includes?.("stage")) outputProfile = "stage";
    return {
      themeId: bibleSettings.projectionTheme || projection.themeId || "classic_dark",
      projectionTheme: bibleSettings.projectionTheme || projection.themeId || "classic_dark",
      outputProfile,
      transition: bibleSettings.defaultTransition || projection.transition || "fade",
      hideTitleAfterFirst: projection.hideTitleAfterFirst !== false,
      showTranslationOnOutput: projection.showTranslationOnOutput !== false && bibleSettings.showTranslationAbbr !== false,
      reducedMotion: projection.reducedMotion || false,
      layout: slide?.layout || item?.layout || bibleSettings.defaultLayout || "fullscreen",
      obsLayout: slide?.obsLayout || item?.obsLayout || bibleSettings.obsLayout || "lower_third",
      stageShowNextVerse: projection.stageShowNextVerse !== false,
    };
  }

  function prepareSongSlides(song) {
    if (!song) return [];
    const projection = window.CISProjectionSettings
      ? window.CISProjectionSettings.load(loadJson)
      : (window.CISProjectionSettings?.DEFAULTS || {});
    const bibleSettings = window.CISBibleProjectionService?.getSettings?.() || {};
    if (window.CISlideLayoutEngine) {
      return window.CISlideLayoutEngine.prepareHymnSlides(song, {
        projectionTheme: bibleSettings.projectionTheme || projection.themeId || "classic_dark",
        fontScale: state.fontScale,
        hymnMaxLines: projection.hymnMaxLines || 5,
        hideTitleAfterFirst: projection.hideTitleAfterFirst !== false,
      });
    }
    return song.slides || [];
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
      ? { title: `Hymn ${queuedNextSong.number} · ${queuedNextSong.title}`, slides: prepareSongSlides(queuedNextSong) }
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
      if (window.CISBibleProjectionService
        && state.presenter.songKey === window.CISBibleProjectionService.BIBLE_LIVE_KEY) {
        window.CISBibleProjectionService.setLiveSlideIndex(next);
      }
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
    const cameraState = window.CISCameraSourceService ? window.CISCameraSourceService.getState() : null;
    window.CISPresenterControl.render(els.presenterControlRoot, snapshot);
    if (embeddedProjectorActive) {
      window.CISPresenterOutput.render(els.presenterOutputRoot, snapshot, cameraState);
      if (window.CISCameraSourceService) {
        window.CISPresenterOutput.bindCameraVideos(els.presenterOutputRoot, window.CISCameraSourceService);
      }
    } else {
      window.CISPresenterOutput.render(els.presenterOutputRoot, { active: false });
    }
    document.body.classList.toggle("presenter-live", snapshot.active);
    if (window.CISObsOutputService && window.CISPresenterEngine) {
      const item = currentPresenterItem();
      window.CISObsOutputService.syncFromPresenter(
        snapshot,
        window.CISPresenterEngine.getState(),
        item,
      ).catch(() => {});
    }
    publishObsMonitorWorshipContext();
    if (state.view === "presenter") renderObsProgramMonitor();
    syncQuietPowerBlocker();
  }

  function setupPresenterSystem() {
    if (!window.CISPresenterEngine) return;
    window.CISPresenterControl.configure({ escapeHtml, plain, formatDuration, helpTrigger, t });
    window.CISPresenterOutput.configure({ escapeHtml, lyricHtml });
    window.CISPresenterEngine.configure({
      currentPresenterItem: () => {
        applyEnginePresenterState(window.CISPresenterEngine.getState());
        return currentPresenterItem();
      },
      nextContext: (_engineState, item) => buildPresenterNextContext(item),
      getProjectionContext: (_engineState, item, slide) => getProjectionContextForOutput(item, slide),
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
      if (event.data && event.data.type === "cis-stage-display:closed") {
        window.CISStageDisplayService?.handleOutputClosed?.();
        render();
      }
    });
  }

  function getStageDisplayWorshipContext() {
    const item = currentPresenterItem();
    const slideIndex = Math.max(0, state.presenter.slideIndex || 0);
    const slide = item?.slides?.[slideIndex] || null;
    const nextCtx = buildPresenterNextContext(item);
    const assigned = assignedSlots();
    const currentSlotInfo = assigned.find((entry) => entry.index === state.activeSlot) || assigned[0] || null;
    const nextSlotInfo = currentSlotInfo
      ? assigned.find((entry) => entry.index > currentSlotInfo.index)
      : assigned[0] || null;

    let currentBible = null;
    let nextBible = null;
    if (window.CISBibleProjectionService) {
      const bibleState = window.CISBibleProjectionService.getPublicState?.();
      const live = bibleState?.live;
      if (live?.active && !live.cleared && live.slides?.length) {
        const liveIndex = Math.max(0, Math.min(live.slides.length - 1, live.slideIndex || 0));
        const liveSlide = live.slides[liveIndex];
        currentBible = {
          reference: live.referenceLabel || liveSlide?.reference || liveSlide?.label || "",
          text: liveSlide?.body || "",
          translation: live.translation || "",
        };
        const nextSlide = live.slides[liveIndex + 1];
        if (nextSlide) {
          nextBible = {
            reference: nextSlide.reference || nextSlide.label || "",
            text: nextSlide.body || "",
            translation: live.translation || "",
          };
        }
      }
    }

    const obsStatus = window.CISObsConnectionService?.getStatus?.() || {};
    const obsLive = window.CISObsOutputService?.getLiveState?.() || {};
    const cameraStatus = window.CISCameraSourceService?.getLocalPresentationStatus?.() || {};

    return {
      currentHymn: item?.type === "song"
        ? { number: item.song?.number || "", title: item.song?.title || item.hymnTitle || "" }
        : null,
      currentStanza: slide
        ? { label: slide.label || "", body: slide.body || "" }
        : null,
      nextStanza: nextCtx.nextSlide || null,
      nextHymnTitle: nextCtx.nextHymn?.title || "",
      currentBible,
      nextBible,
      currentServiceItem: currentSlotInfo
        ? {
          title: slotTitle(currentSlotInfo.slot),
          role: currentSlotInfo.slot.role || "",
          meta: slotSubtitle(currentSlotInfo.slot),
        }
        : null,
      nextServiceItem: nextSlotInfo
        ? {
          title: slotTitle(nextSlotInfo.slot),
          role: nextSlotInfo.slot.role || "",
          meta: slotSubtitle(nextSlotInfo.slot),
        }
        : null,
      status: {
        camera: {
          label: cameraStatus.stageDisplay || cameraStatus.mainProjector || "Camera",
          detail: cameraStatus.active ? "Active feed" : "Idle",
          status: cameraStatus.active ? "live" : "idle",
        },
        mic: {
          label: obsLive.micMuted ? "Muted" : "Live",
          detail: obsLive.micLabel || "Operator mic",
          status: obsLive.micMuted ? "muted" : "live",
        },
        recording: {
          label: obsStatus.recordingActive ? "Recording" : "Not recording",
          detail: obsStatus.recordingActive ? "OBS recording active" : "—",
          status: obsStatus.recordingActive ? "active" : "off",
        },
        streaming: {
          label: obsStatus.streamingActive ? "Streaming" : "Not streaming",
          detail: obsStatus.streamingActive ? "OBS stream live" : "—",
          status: obsStatus.streamingActive ? "live" : "off",
        },
      },
    };
  }

  function publishStageDisplay() {
    if (!window.CISStageDisplayService) return;
    window.CISStageDisplayService.publish();
  }

  function refreshStageDisplayDisplays() {
    if (desktopBridge?.stageDisplay?.listDisplays) {
      desktopBridge.stageDisplay.listDisplays().then((payload) => {
        state.stageDisplayDisplays = payload?.displays || [];
        if (state.view === "settings" || state.view === "presenter") render();
      }).catch(() => {});
      return;
    }
    state.stageDisplayDisplays = [];
  }

  function setupStageDisplay() {
    if (!window.CISStageDisplayEngine || !window.CISStageDisplayService) return;
    window.CISStageDisplayUI?.configure?.({ escapeHtml, t });
    window.CISStageDisplayService.configure({
      loadSettings: () => window.CISStageDisplaySettings.load((key, fallback) => loadJson(key, fallback)),
      saveSettings: (settings) => window.CISStageDisplaySettings.save(settings, saveJson),
      saveMessageLog: (log) => saveJson("stageDisplayMessageLog", log),
      getWorshipContext: getStageDisplayWorshipContext,
      electronOpen: desktopBridge?.stageDisplay?.open
        ? (payload) => desktopBridge.stageDisplay.open(payload)
        : null,
      electronClose: desktopBridge?.stageDisplay?.close
        ? () => desktopBridge.stageDisplay.close()
        : null,
      electronRestart: desktopBridge?.stageDisplay?.restart
        ? (payload) => desktopBridge.stageDisplay.restart(payload)
        : null,
      electronPublish: desktopBridge?.stageDisplay?.publish
        ? (payload) => desktopBridge.stageDisplay.publish(payload)
        : null,
    });
    window.CISStageDisplayEngine.subscribe(() => {
      if (window.CISStageDisplayService.getState().active) publishStageDisplay();
    });
    if (window.CISPresenterEngine) {
      window.CISPresenterEngine.subscribe(() => publishStageDisplay());
    }
    if (desktopBridge?.stageDisplay?.onClosed) {
      desktopBridge.stageDisplay.onClosed(() => {
        window.CISStageDisplayService.handleOutputClosed();
        render();
      });
    }
    if (desktopBridge?.stageDisplay?.onDisplaysChanged) {
      desktopBridge.stageDisplay.onDisplaysChanged(() => {
        refreshStageDisplayDisplays();
        if (window.CISStageDisplayService.getState().active) {
          void window.CISStageDisplayService.restartOutput();
        }
      });
    }
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "cis-stage-display:closed") {
        window.CISStageDisplayService.handleOutputClosed();
        render();
      }
    });
    refreshStageDisplayDisplays();
  }

  function scheduleSessionRecoverySave(reason) {
    if (window.CISSessionRecoveryService) {
      window.CISSessionRecoveryService.scheduleSave(reason);
    }
  }

  function describeRecoveryLiveItem(item, session) {
    if (!item) return null;
    const songKey = item.songKey || item.hymnId || "";
    const bibleKey = window.CISBibleProjectionService?.BIBLE_LIVE_KEY;
    if (songKey && songKey !== bibleKey) {
      const meta = describeSongKeyForQueue(songKey);
      if (!meta) return { label: `Hymn ${item.hymnNumber || songKey} (unavailable)`, available: false };
      const slideIndex = Number(item.slideIndex ?? session?.presenter?.slideIndex) || 0;
      const song = getSongByKey(songKey);
      const slide = song?.slides?.[slideIndex];
      const stanza = slide?.label ? ` · ${slide.label}` : "";
      return { label: `${meta.shortLabel}${stanza}`, available: Boolean(song) };
    }
    if (item.referenceLabel || item.reference) {
      const translation = item.translation || session?.bible?.translation || state.bibleTranslation;
      return { label: `${item.referenceLabel || item.reference} · ${translation}`, available: true };
    }
    if (item.title || item.shortLabel) {
      return { label: item.shortLabel || item.title, available: true };
    }
    return null;
  }

  function captureSessionRecoverySnapshot() {
    const bibleState = window.CISBibleProjectionService?.getPublicState?.() || {};
    const queueState = window.CISLiveHymnQueueService?.getState?.() || {};
    const liveSwitch = window.CISLiveSwitchService?.getState?.() || {};
    const projection = window.CISProjectionSettings
      ? window.CISProjectionSettings.load((key, fallback) => loadJson(key, fallback))
      : {};
    const bibleSettings = window.CISBibleProjectionSettings
      ? window.CISBibleProjectionSettings.load(null, (key, fallback) => loadJson(key, fallback))
      : {};
    const stageState = window.CISStageDisplayService?.getState?.() || {};
    const cameraState = window.CISCameraSourceService?.getState?.() || {};
    const obsExport = window.CISObsSettingsStore?.exportForBackup?.() || {};
    const previousLive = captureLiveSnapshot();
    const session = {
      worshipPlan,
      songService,
      activeSlot: state.activeSlot,
      presenter: { ...state.presenter },
      emergencyMode: state.emergencyMode || "",
      displayMode: window.CISPresenterEngine?.getState?.().displayMode || state.displayMode,
      bible: {
        translation: state.bibleTranslation,
        bookOrder: state.bibleBookOrder,
        chapter: state.bibleChapter,
        verse: state.bibleVerse,
        live: bibleState.live || null,
        preview: bibleState.preview || null,
        previousLive: bibleState.previousLive || null,
      },
      hymnQueue: {
        preview: queueState.preview || null,
        next: queueState.next || null,
        queue: queueState.queue || [],
      },
      live: {
        previous: previousLive,
        preview: queueState.preview || bibleState.preview || null,
        next: queueState.next || null,
        contentType: previousLive?.bibleLive?.active ? "bible" : (previousLive?.songKey ? "hymn" : ""),
        phase: liveSwitch.phase || "",
      },
      language: {
        languageCode: state.languageCode,
        hymnBookId: state.hymnBookId,
        editionId: state.editionId,
        uiLocale: state.uiLocale,
      },
      outputs: {
        destinations: describeServiceOutputDestinations().split(", ").filter(Boolean),
        themeId: bibleSettings.projectionTheme || projection.themeId || "classic_dark",
        projection,
        obs: window.CISSessionRecoverySnapshot
          ? window.CISSessionRecoverySnapshot.sanitizeObsSettings(obsExport.obsSettings || {})
          : (obsExport.obsSettings || {}),
      },
      stageDisplay: {
        settings: stageState.settings || {},
        layoutId: stageState.settings?.layoutId,
        sermonTitle: stageState.sermonTitle || "",
        speakerName: stageState.speakerName || "",
        countdownLabel: stageState.countdownLabel || "",
        countdownRemaining: stageState.countdownRemaining,
      },
      camera: {
        defaultCameraId: cameraState.settings?.defaultCameraId || "",
        backupCameraId: cameraState.settings?.backupCameraId || "",
        activeCameraId: cameraState.live?.cameraId || "",
      },
      media: {
        songKey: loadedAudioSongKey || "",
        position: hymnAudioPlayer?.getCurrentTime?.() || 0,
        playing: Boolean(hymnAudioPlayer?.isPlaying?.()),
      },
      timer: {
        seconds: state.timerSeconds,
        running: state.timerRunning,
        endsAt: state.timerEndsAt,
      },
    };
    const labels = window.CISSessionRecoverySnapshot?.buildLabels(session, {
      describeLiveItem: describeRecoveryLiveItem,
    }) || {};
    return {
      version: window.CISSessionRecoverySnapshot?.SNAPSHOT_VERSION || 1,
      id: `session-${Date.now()}`,
      savedAt: new Date().toISOString(),
      sessionActive: isPresentationLiveActive(),
      session,
      labels,
    };
  }

  async function inspectSessionRecoveryAvailability(snapshot) {
    const session = snapshot?.session || {};
    const items = [];
    const warnings = [];
    const bibleKey = window.CISBibleProjectionService?.BIBLE_LIVE_KEY;

    const checkSong = (songKey, label) => {
      if (!songKey || songKey === bibleKey) return;
      const parsed = parseSongKey(songKey);
      const pack = getPack(parsed.code, parsed.editionId);
      const song = getSongByKey(songKey);
      const available = pack?.status === "ready" && Boolean(song);
      items.push({
        id: songKey,
        label: label || songKey,
        detail: available ? "Hymn available" : "Hymn edition missing",
        available,
      });
      if (!available) warnings.push(`Missing hymnal content for ${label || songKey}`);
    };

    checkSong(session.live?.previous?.songKey, "Previous Live");
    checkSong(session.hymnQueue?.next?.songKey, "Next");
    checkSong(session.hymnQueue?.preview?.songKey, "Preview");
    (session.hymnQueue?.queue || []).forEach((item, index) => {
      checkSong(item.songKey, `Queue item ${index + 1}`);
    });

    const translation = session.bible?.translation;
    if (translation) {
      const available = Boolean(window.CISBibleStore?.getTranslationMeta?.(translation));
      items.push({
        id: `bible:${translation}`,
        label: `Bible ${translation}`,
        detail: available ? "Translation available" : "Bible version missing",
        available,
      });
      if (!available) warnings.push(`Bible translation ${translation} is not installed.`);
    }

    if (session.media?.songKey) {
      items.push({
        id: session.media.songKey,
        label: "Linked media",
        detail: "Media availability verified on restore",
        available: true,
      });
    }

    return { items, warnings };
  }

  async function applySessionRecoverySnapshot(snapshot, options) {
    const session = snapshot?.session;
    if (!session) return { ok: false, message: "Recovery snapshot is empty." };
    const opts = {
      openOutputs: false,
      restoreLive: false,
      reopenProjector: false,
      reopenStageDisplay: false,
      reconnectObs: false,
      ...(options || {}),
    };

    worshipPlan = normalizeWorshipPlan(session.worshipPlan || []);
    songService = normalizeSongService(session.songService || []);
    saveWorshipPlan(true);
    saveSongService(true);
    state.activeSlot = Number(session.activeSlot) || 0;
    state.presenter = {
      open: false,
      songKey: session.presenter?.songKey || "",
      slideIndex: Number(session.presenter?.slideIndex) || 0,
      planIndex: session.presenter?.planIndex ?? null,
      queueKeys: Array.isArray(session.presenter?.queueKeys) ? session.presenter.queueKeys : [],
      queueIndex: session.presenter?.queueIndex ?? null,
    };
    state.emergencyMode = session.emergencyMode || "";
    state.displayMode = session.displayMode || state.displayMode;
    state.bibleTranslation = session.bible?.translation || state.bibleTranslation;
    state.bibleBookOrder = Number(session.bible?.bookOrder) || state.bibleBookOrder;
    state.bibleChapter = Number(session.bible?.chapter) || state.bibleChapter;
    state.bibleVerse = Number(session.bible?.verse) || state.bibleVerse;
    state.languageCode = session.language?.languageCode || state.languageCode;
    state.hymnBookId = session.language?.hymnBookId || state.hymnBookId;
    state.editionId = session.language?.editionId || state.editionId;
    state.uiLocale = session.language?.uiLocale || state.uiLocale;
    state.timerSeconds = Number(session.timer?.seconds) || state.timerSeconds;
    state.timerRunning = false;
    state.timerEndsAt = 0;
    persistTimer();

    if (window.CISProjectionSettings && session.outputs?.projection) {
      window.CISProjectionSettings.save(session.outputs.projection, saveJson);
    }
    if (window.CISObsSettingsStore && session.outputs?.obs) {
      window.CISObsSettingsStore.importFromBackup({ obsSettings: session.outputs.obs });
    }
    if (window.CISStageDisplayService && session.stageDisplay) {
      window.CISStageDisplayService.saveSettings({
        ...(session.stageDisplay.settings || {}),
        sermonTitle: session.stageDisplay.sermonTitle || "",
        speakerName: session.stageDisplay.speakerName || "",
      });
    }
    if (window.CISLiveHymnQueueService) {
      window.CISLiveHymnQueueService.restoreSession({
        next: session.hymnQueue?.next || null,
        queue: session.hymnQueue?.queue || [],
        history: [],
      });
    }

    saveValue("language", state.languageCode);
    saveValue("bibleTranslation", state.bibleTranslation);
    persistHymnalSelection();

    if (opts.restoreLive && session.live?.previous) {
      const previous = session.live.previous;
      if (previous.bibleLive?.active && window.CISBibleProjectionService) {
        window.CISBibleProjectionService.getState().live = {
          ...previous.bibleLive,
          slides: [...(previous.bibleLive.slides || [])],
        };
        state.presenter.songKey = window.CISBibleProjectionService.BIBLE_LIVE_KEY;
        state.presenter.slideIndex = previous.slideIndex || 0;
      } else if (previous.songKey) {
        state.presenter.songKey = previous.songKey;
        state.presenter.slideIndex = previous.slideIndex || 0;
        state.presenter.planIndex = previous.planIndex ?? null;
      }
    }

    if (opts.reopenProjector) {
      if (opts.restoreLive) {
        startPresenterSession({
          songKey: state.presenter.songKey,
          planIndex: state.presenter.planIndex,
          slideIndex: state.presenter.slideIndex,
          queueKeys: state.presenter.queueKeys,
          queueIndex: state.presenter.queueIndex,
        });
        if (window.CISPresenterEngine) window.CISPresenterEngine.publishState();
      } else {
        window.CISPresenterEngine?.openOutputSurface?.();
        state.presenter.open = true;
      }
    }

    if (opts.reopenStageDisplay && window.CISStageDisplayService) {
      await window.CISStageDisplayService.openOutput();
      window.CISStageDisplayService.publish();
    }

    if (opts.reconnectObs && window.CISObsConnectionService?.connect) {
      await window.CISObsConnectionService.connect();
    }

    render();
    scheduleSessionRecoverySave("restored");
    return { ok: true, message: "Session restored without automatic streaming or recording." };
  }

  function setupSessionRecovery() {
    if (!window.CISSessionRecoveryService) return;
    window.CISSessionRecoveryUI?.configure?.({
      escapeHtml,
      modalRoot: els.modalRoot,
    });
    window.CISSessionRecoveryService.configure({
      loadSettings: () => window.CISSessionRecoverySettings.load((key, fallback) => loadJson(key, fallback)),
      captureSession: captureSessionRecoverySnapshot,
      describeLiveItem: describeRecoveryLiveItem,
      applySession: applySessionRecoverySnapshot,
      inspectAvailability: inspectSessionRecoveryAvailability,
    });
    window.CISSessionRecoveryService.setupLifecycle();

    if (window.CISPresenterEngine && !window.CISPresenterEngine._recoverySubscribed) {
      window.CISPresenterEngine._recoverySubscribed = true;
      window.CISPresenterEngine.subscribe(() => scheduleSessionRecoverySave("presenter"));
    }
    if (window.CISLiveHymnQueueService && !window.CISLiveHymnQueueService._recoverySubscribed) {
      window.CISLiveHymnQueueService._recoverySubscribed = true;
      window.CISLiveHymnQueueService.subscribe(() => scheduleSessionRecoverySave("queue"));
    }
    if (window.CISLiveSwitchService && !window.CISLiveSwitchService._recoverySubscribed) {
      window.CISLiveSwitchService._recoverySubscribed = true;
      window.CISLiveSwitchService.subscribe(() => scheduleSessionRecoverySave("live-switch"));
    }
    if (window.CISStageDisplayService && !window.CISStageDisplayService._recoverySubscribed) {
      window.CISStageDisplayService._recoverySubscribed = true;
      window.CISStageDisplayEngine?.subscribe?.(() => scheduleSessionRecoverySave("stage-display"));
    }
  }

  async function maybeOfferSessionRecovery() {
    if (!window.CISSessionRecoveryService || !window.CISSessionRecoveryUI) return;
    const result = await window.CISSessionRecoveryService.checkOnStartup();
    if (!result?.interrupted) return;
    window.CISSessionRecoveryUI.openRecoveryScreen(result);
  }

  function gatherHelpDiagnosticsReport() {
    if (!window.CISHelpDiagnostics) return {};
    const presenterActive = window.CISPresenterEngine ? window.CISPresenterEngine.getState().active : false;
    return window.CISHelpDiagnostics.gatherDiagnostics({
      desktopInfo: state.desktopInfo,
      obsStatus: window.CISObsConnectionService ? window.CISObsConnectionService.getStatus() : {},
      obsHeartbeat: state.obsHeartbeat,
      presenterActive,
      embeddedProjector: embeddedProjectorActive,
      displayMode: window.CISPresenterEngine ? window.CISPresenterEngine.getState().displayMode : "",
      languagePacks: data.languagePacks,
      autosaveCount: autoBackupList.length,
      lastAutosave: autoBackupList[0]?.id || "",
      lastNotice: state.notice,
    });
  }

  function resetHelpNav() {
    state.help.category = "";
    state.help.articleId = "";
    state.help.nav = "";
    state.help.contextKey = "";
  }

  function openHelpArticle(articleId) {
    state.view = "help";
    state.help.history.push({ category: state.help.category, articleId: state.help.articleId, nav: state.help.nav });
    state.help.articleId = articleId;
    state.help.category = "";
    state.help.nav = "";
    saveValue("view", state.view);
    render();
  }

  function openHelpCategory(categoryId) {
    state.view = "help";
    state.help.history.push({ category: state.help.category, articleId: state.help.articleId, nav: state.help.nav });
    state.help.category = categoryId;
    state.help.articleId = "";
    state.help.nav = "";
    saveValue("view", state.view);
    render();
  }

  function renderHelpCentre() {
    if (!window.CISHelpUI) return `<section class="section"><p>Help Centre is loading…</p></section>`;
    const report = state.help.nav === "diagnostics" ? gatherHelpDiagnosticsReport() : null;
    return window.CISHelpUI.render(state.help, {
      desktopInfo: state.desktopInfo,
      diagnosticsReport: report,
    });
  }

  function bindHelpCentre() {
    if (state.view !== "help") return;
    const root = els.content;
    if (!root) return;

    const searchInput = root.querySelector("#helpSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.help.searchQuery = searchInput.value;
        const articleList = root.querySelector(".help-search-results");
        if (articleList || !state.help.articleId) {
          const shell = renderHelpCentre();
          const notice = renderNotice();
          els.content.innerHTML = `${notice}${shell}`;
          bindHelpCentre();
          const refreshed = els.content.querySelector("#helpSearchInput");
          if (refreshed) {
            refreshed.focus();
            refreshed.selectionStart = refreshed.selectionEnd = refreshed.value.length;
          }
        }
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          state.help.searchQuery = "";
          render();
        }
      });
    }

    const roleSelect = root.querySelector("#helpRoleSelect");
    if (roleSelect && window.CISHelpStore) {
      roleSelect.value = window.CISHelpStore.getRole();
      roleSelect.addEventListener("change", () => {
        window.CISHelpStore.setRole(roleSelect.value);
        if (window.CISHelpSearch) window.CISHelpSearch.buildIndex();
        render();
      });
    }

    root.querySelectorAll("[data-help-checklist]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!window.CISHelpStore) return;
        window.CISHelpStore.toggleChecklistItem(input.dataset.helpChecklist, input.dataset.helpCheckKey, input.checked);
        render();
      });
    });

    root.querySelectorAll("[data-help-checklist-reset]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.CISHelpStore) return;
        if (window.confirm("Reset this checklist?")) {
          window.CISHelpStore.resetChecklist(button.dataset.helpChecklistReset);
          render();
        }
      });
    });
  }

  function helpTrigger(key, label) {
    return window.CISHelpContextual ? window.CISHelpContextual.renderTrigger(key, label) : "";
  }

  function isTrainingModeActive() {
    return Boolean(window.CISHelpStore && window.CISHelpStore.getTrainingProgress().trainingMode);
  }

  function confirmTrainingLiveAction(actionLabel) {
    if (!isTrainingModeActive()) return true;
    return window.confirm(`Training Mode is active. ${actionLabel} will send content to the live projector. Continue?`);
  }

  function renderHelpContextOverlay() {
    const root = els.helpContextRoot;
    if (!root) return;
    if (!state.help.contextKey || !window.CISHelpContextual) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
      return;
    }
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    root.innerHTML = `
      <div class="help-context-backdrop" data-command="help-close-context" aria-hidden="true"></div>
      ${window.CISHelpContextual.renderPanel(state.help.contextKey, escapeHtml)}
    `;
  }

  function setupHelpCentre() {
    if (window.CISHelpUI) window.CISHelpUI.configure({ escapeHtml });
    if (window.CISHelpSearch) window.CISHelpSearch.init();
  }

  function renderObsTopbar() {
    if (!window.CISObsSettingsUI || !window.CISObsConnectionService || !els.obsStatusRoot) return;
    window.CISObsSettingsUI.updateTopbar(
      els.obsStatusRoot,
      window.CISObsConnectionService.getStatus(),
    );
  }

  function readObsSettingsFromPage() {
    if (!window.CISObsSettingsUI) return null;
    const payload = window.CISObsSettingsUI.readSettingsFromDom(document);
    const password = payload._password;
    delete payload._password;
    return { settings: payload, password };
  }

  async function saveObsSettingsFromPage(options) {
    if (!window.CISObsConnectionService) return;
    const parsed = readObsSettingsFromPage();
    if (!parsed) return;
    await window.CISObsConnectionService.saveSettings(parsed.settings, {
      password: parsed.password,
      connect: options?.connect !== false,
    });
    renderObsTopbar();
    if (state.view === "settings") render();
  }

  async function testObsConnectionFromPage() {
    if (!window.CISObsConnectionService) return;
    const parsed = readObsSettingsFromPage();
    const overrides = parsed
      ? { host: parsed.settings.host, port: parsed.settings.port, password: parsed.password }
      : {};
    const result = await window.CISObsConnectionService.testConnection(overrides);
    if (result?.ok) {
      setNotice(`OBS test OK · ${result.obsVersion || "connected"} (WebSocket ${result.obsWebSocketVersion || "5.x"})`);
    } else {
      setNotice(result?.message || "OBS test connection failed.");
    }
  }

  async function connectObsFromPage() {
    if (!window.CISObsConnectionService) return;
    const parsed = readObsSettingsFromPage();
    if (parsed) {
      await window.CISObsConnectionService.saveSettings({ ...parsed.settings, enabled: true }, {
        password: parsed.password,
        connect: true,
      });
    } else {
      await window.CISObsConnectionService.connect();
    }
    renderObsTopbar();
    if (state.view === "settings") render();
    const status = window.CISObsConnectionService.getStatus();
    setNotice(status.connected ? t("notice.connectedObs") : (status.lastError || t("notice.obsConnectionFailed")));
  }

  async function disconnectObsFromPage() {
    if (!window.CISObsConnectionService) return;
    await window.CISObsConnectionService.disconnect();
    renderObsTopbar();
    if (state.view === "settings") render();
    setNotice(t("notice.disconnectedObs"));
  }

  async function refreshObsScenesFromPage() {
    if (!window.CISObsSceneService) return;
    try {
      const scenes = await window.CISObsSceneService.fetchSceneList();
      setNotice(`Loaded ${scenes.length} OBS scene${scenes.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error && error.message ? error.message : "Failed to load OBS scenes.");
    }
    if (state.view === "settings") render();
  }

  async function refreshObsSourcesFromPage() {
    if (!window.CISObsSourceService) return;
    try {
      const inputs = await window.CISObsSourceService.fetchInputs();
      setNotice(`Loaded ${inputs.length} OBS input${inputs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error?.message || "Failed to load OBS sources.");
    }
    if (state.view === "settings") render();
  }

  async function saveObsMappingsFromPage() {
    if (!window.CISObsSettingsStore) return;
    const settings = window.CISObsSettingsStore.loadSettings();
    const sceneMappings = window.CISObsMappingUI
      ? window.CISObsMappingUI.readSceneMappingsFromDom(document)
      : settings.sceneMappings;
    const sourceMappings = window.CISObsMappingUI
      ? window.CISObsMappingUI.readSourceMappingsFromDom(document)
      : settings.sourceMappings;
    window.CISObsSettingsStore.saveSettings({
      ...settings,
      sceneMappings,
      sourceMappings,
    });
    setNotice(t("notice.obsMappingsSaved"));
    if (state.view === "settings") render();
  }

  async function refreshObsBrowserUrls() {
    if (!window.CISObsOutputService) return;
    try {
      state.obsUrls = await window.CISObsOutputService.getBrowserSourceUrls();
      state.obsHeartbeat = await window.CISObsOutputService.getHeartbeatStatus();
    } catch (error) {}
  }

  function setupObsIntegration() {
    if (!window.CISObsConnectionService) return;
    if (window.CISObsSettingsUI) {
      window.CISObsSettingsUI.configure({ escapeHtml, helpTrigger });
    }
    if (window.CISObsMappingUI) {
      window.CISObsMappingUI.configure({ escapeHtml, helpTrigger });
    }
    if (window.CISObsControlUI) {
      window.CISObsControlUI.configure({ escapeHtml, helpTrigger });
    }
    setupObsProgramMonitor();
    if (window.CISObsEventService) {
      window.CISObsEventService.subscribe(() => {
        renderObsTopbar();
        refreshObsBrowserUrls().then(() => {
          if (state.view === "settings" || state.view === "presenter") render();
        });
        if (state.view === "presenter" || state.view === "settings") renderObsProgramMonitor();
      });
    }
    window.CISObsConnectionService.init().then(async () => {
      renderObsTopbar();
      await refreshObsBrowserUrls();
      if (window.CISObsConnectionService.getStatus().connected) {
        if (window.CISObsSceneService) {
          window.CISObsSceneService.fetchSceneList().catch(() => {});
        }
        if (window.CISObsSourceService) {
          window.CISObsSourceService.fetchInputs().catch(() => {});
        }
      }
    }).catch(() => {
      renderObsTopbar();
    });
  }

  function getObsMonitorWorshipContext() {
    const engineState = window.CISPresenterEngine ? window.CISPresenterEngine.getState() : {};
    const snapshot = window.CISPresenterEngine ? window.CISPresenterEngine.buildSnapshot() : null;
    if (!window.CISObsProgramMonitor) {
      return { worshipPreview: "—", worshipLive: "—", worshipLiveActive: false };
    }
    return window.CISObsProgramMonitor.getWorshipOutputLabels(engineState, snapshot);
  }

  function publishObsMonitorWorshipContext() {
    const context = getObsMonitorWorshipContext();
    if (desktopBridge && desktopBridge.obsMonitor && desktopBridge.obsMonitor.setWorshipContext) {
      desktopBridge.obsMonitor.setWorshipContext(context);
    }
    return context;
  }

  function renderObsProgramMonitor() {
    const mount = document.getElementById("obsProgramMonitorMount");
    if (!mount || !window.CISObsProgramMonitorUI || !window.CISObsProgramMonitor) return;
    const obsSettings = window.CISObsSettingsStore ? window.CISObsSettingsStore.loadSettings() : { enabled: false };
    if (!obsSettings.enabled) {
      mount.innerHTML = "";
      return;
    }
    window.CISObsProgramMonitorUI.configure({
      escapeHtml,
      getWorshipContext: getObsMonitorWorshipContext,
    });
    window.CISObsProgramMonitorUI.render(mount, window.CISObsProgramMonitor.getState());
  }

  function bindObsProgramMonitor() {
    renderObsProgramMonitor();
    const deviceSelect = document.getElementById("obsMonitorDeviceSelect");
    if (deviceSelect && !deviceSelect.dataset.bound) {
      deviceSelect.dataset.bound = "1";
      deviceSelect.addEventListener("change", () => {
        const option = deviceSelect.selectedOptions[0];
        window.CISObsProgramMonitor.setDevice(deviceSelect.value, option?.dataset?.label || option?.textContent || "");
      });
    }
    const layoutSelect = document.getElementById("obsMonitorLayoutSelect");
    if (layoutSelect && !layoutSelect.dataset.bound) {
      layoutSelect.dataset.bound = "1";
      layoutSelect.addEventListener("change", () => {
        window.CISObsProgramMonitor.setLayout(layoutSelect.value);
        render();
      });
    }
    const viewerUrl = document.getElementById("obsViewerReturnUrl");
    if (viewerUrl && !viewerUrl.dataset.bound) {
      viewerUrl.dataset.bound = "1";
      viewerUrl.addEventListener("change", () => {
        window.CISObsProgramMonitor.setViewerReturnUrl(viewerUrl.value);
        renderObsProgramMonitor();
      });
    }
  }

  function setupObsProgramMonitor() {
    if (!window.CISObsProgramMonitor) return;
    if (window.CISObsProgramMonitor._appBound) return;
    window.CISObsProgramMonitor._appBound = true;
    window.CISObsProgramMonitor.subscribe(() => {
      if (state.view === "presenter" || state.view === "settings") renderObsProgramMonitor();
    });
    if (desktopBridge && desktopBridge.obsMonitor && desktopBridge.obsMonitor.onClosed) {
      desktopBridge.obsMonitor.onClosed(() => {
        window.CISObsProgramMonitor.setDetached(false);
        if (state.view === "presenter" || state.view === "settings") render();
      });
    }
    if (desktopBridge && desktopBridge.obsMonitor && desktopBridge.obsMonitor.onStopped) {
      desktopBridge.obsMonitor.onStopped(() => {
        window.CISObsProgramMonitor.stopMonitor();
        if (state.view === "presenter" || state.view === "settings") render();
      });
    }
  }

  function renderCameraSources() {
    if (!window.CISCameraSourceUI || !window.CISCameraSourceService) {
      return `<section class="section"><p class="muted">Camera Sources module is not loaded.</p></section>`;
    }
    window.CISCameraSourceUI.configure({ escapeHtml, t });
    return window.CISCameraSourceUI.renderPage(window.CISCameraSourceService.getState());
  }

  function bindCameraSources() {
    if (!window.CISCameraSourceUI || !window.CISCameraSourceService) return;
    const root = state.view === "cameras" ? els.content : document;
    window.CISCameraSourceUI.bindPreviewVideos(root);
  }

  function openCameraEditor(cameraId) {
    if (!window.CISCameraSourceUI || !window.CISCameraSourceService) return;
    const cam = cameraId ? window.CISCameraSourceService.getSavedCamera(cameraId) : null;
    els.modalRoot.innerHTML = window.CISCameraSourceUI.renderAddEditModal(cam, cameraId ? "edit" : "add");
  }

  function saveCameraFromModal() {
    if (!window.CISCameraSourceService) return;
    const id = document.getElementById("cameraEditId")?.value || "";
    const name = plain(document.getElementById("cameraEditName")?.value) || "Camera";
    const role = document.getElementById("cameraEditRole")?.value || "main";
    const picker = document.getElementById("cameraDevicePicker");
    const option = picker?.selectedOptions?.[0];
    const deviceLabel = option?.dataset?.label || option?.textContent?.split(" (")[0]?.trim() || "";
    const preferredDeviceId = picker?.value || "";
    const layout = document.getElementById("cameraEditLayout")?.value || "fullscreen";
    const transition = document.getElementById("cameraEditTransition")?.value || "cut";
    const audioMode = document.getElementById("cameraEditAudio")?.value || "video-only";
    const destinations = [...document.querySelectorAll('input[name="cameraDest"]:checked')].map((el) => el.value);
    const payload = {
      name,
      role,
      deviceLabel,
      preferredDeviceId,
      layout,
      transition,
      audioMode,
      destinations: destinations.length ? destinations : ["main"],
    };
    if (id) window.CISCameraSourceService.updateCamera(id, payload);
    else window.CISCameraSourceService.addCamera(payload);
    closeModal();
    setNotice(id ? "Camera updated." : "Camera added.");
  }

  function saveCameraSettingsFromPanel() {
    if (!window.CISCameraSourceService) return;
    window.CISCameraSourceService.persistSettings({
      preferredWidth: Number(document.getElementById("cameraPrefWidth")?.value) || 1280,
      preferredFrameRate: Number(document.getElementById("cameraPrefFps")?.value) || 30,
      defaultLayout: document.getElementById("cameraDefaultLayout")?.value || "fullscreen",
      defaultTransition: document.getElementById("cameraDefaultTransition")?.value || "cut",
      audioDisabledByDefault: document.getElementById("cameraAudioOff")?.checked !== false,
      prepareNextCamera: document.getElementById("cameraPrepareNext")?.checked !== false,
      showLogoOnFailure: document.getElementById("cameraLogoOnFail")?.checked !== false,
      warnObsRecursion: document.getElementById("cameraWarnRecursion")?.checked !== false,
    });
    setNotice("Camera settings saved.");
  }

  function handleCameraSendLive(cameraId, force) {
    if (!window.CISCameraSourceService) return;
    const id = cameraId || window.CISCameraSourceService.getState().settings.defaultCameraId;
    const savedCam = window.CISCameraSourceService.getSavedCamera(id);
    const recursion = window.CISCameraSourceService.checkRecursion(savedCam);
    if (recursion.blocked && !force) {
      if (window.confirm(`${recursion.message}\n\nSend to local projectors only?`)) {
        window.CISCameraSourceService.acknowledgeRecursionWarning();
        return handleCameraSendLive(cameraId, true);
      }
      return;
    }
    if (!window.CISPresenterEngine?.getState?.().active) {
      startPresenterSession({ songKey: "", planIndex: null, slideIndex: 0 });
    }
    window.CISCameraSourceService.sendCameraLive({ cameraId: id })
      .then(() => {
        setNotice("Camera sent live to local outputs.");
        renderPresenterAV();
      })
      .catch((error) => setNotice(error?.message || "Failed to send camera live."))
      .finally(() => render());
  }

  function setupCameraSources() {
    if (!window.CISCameraSourceService) return;
    if (window.CISCameraSourceService._appBound) return;
    window.CISCameraSourceService._appBound = true;
    window.CISCameraSourceService.subscribe(() => {
      if (state.view === "cameras" || state.view === "presenter" || state.view === "settings") {
        if (state.view === "cameras") {
          const mount = els.content.querySelector(".camera-sources-page");
          if (mount && window.CISCameraSourceUI) {
            window.CISCameraSourceUI.configure({ escapeHtml, t });
            mount.outerHTML = window.CISCameraSourceUI.renderPage(window.CISCameraSourceService.getState());
            bindCameraSources();
          }
        }
        renderPresenterAV();
      }
    });
    if (window.CISCameraSourceUI) {
      window.CISCameraSourceUI.configure({ escapeHtml, t });
    }
    if (desktopBridge && desktopBridge.cameraPreview && desktopBridge.cameraPreview.onClosed) {
      desktopBridge.cameraPreview.onClosed(() => {
        if (state.view === "cameras") render();
      });
    }
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
      ${renderLiveHymnQueueMount(true)}
      <div class="operator-grid">
        <section class="section">
          <p class="eyebrow">Clock ${escapeHtml(time)}</p>
          <h2>${currentInfo
    ? escapeHtml(t("presenter.current", { title: slotTitle(currentInfo.slot) }))
    : currentSong
      ? escapeHtml(t("presenter.current", { title: `${t("notice.hymnPrefix", { number: currentSong.number })} · ${currentSong.title}` }))
      : escapeHtml(t("presenter.currentNone"))}</h2>
          <p class="muted">${nextInfo ? escapeHtml(t("presenter.next", { title: slotTitle(nextInfo.slot) })) : escapeHtml(t("presenter.nextNone"))}</p>
          <div class="button-row operator-primary-actions">
            <button class="action-button" type="button" data-command="present-current">${escapeHtml(t("presenter.presentCurrent"))}${helpTrigger("send-live", "Send Live")}</button>
          </div>
          <div class="button-row operator-secondary-actions">
            <button class="secondary-button service-touch-btn" type="button" data-command="service-mode-enter">Enter Service Mode</button>
            <button class="secondary-button" type="button" data-command="presenter-open-output">${escapeHtml(t("presenter.openProjector"))}</button>
            <button class="secondary-button" type="button" data-command="open-bible-live">Bible Live</button>
            <button class="secondary-button" type="button" data-command="help-open-emergency">${escapeHtml(t("presenter.emergencyHelp"))}</button>
          </div>
          <div class="button-row operator-safety-actions" role="group" aria-label="Safety controls">
            <button class="safety-button service-touch-btn" type="button" data-command="emergency-clear">${escapeHtml(t("common.clear"))}${helpTrigger("clear", "Clear")}</button>
            <button class="safety-button service-touch-btn" type="button" data-command="emergency-logo">${escapeHtml(t("presenter.logoScreen"))}${helpTrigger("logo", "Show Logo")}</button>
            <button class="safety-button service-touch-btn" type="button" data-command="emergency-black" data-confirm="true">${escapeHtml(t("presenter.blackScreen"))}${helpTrigger("blackout", "Blackout")}</button>
            <button class="safety-button service-touch-btn" type="button" data-command="hymn-restore-previous">Restore</button>
            <button class="safety-button service-touch-btn" type="button" data-command="emergency-white">${escapeHtml(t("presenter.whiteScreen"))}</button>
          </div>
          <div class="operator-preview-grid">
            <article class="preview-card">
              <span>${escapeHtml(t("presenter.currentPreview"))}</span>
              <strong>${currentInfo ? escapeHtml(slotTitle(currentInfo.slot)) : currentSong ? escapeHtml(t("notice.hymnPrefix", { number: currentSong.number })) : escapeHtml(t("presenter.noItem"))}</strong>
              <p>${escapeHtml(currentInfo ? plain(slotSlides(currentInfo.slot)[0]?.body).slice(0, 170) : currentSong ? plain(currentSong.slides[0]?.body).slice(0, 170) : t("presenter.buildQueue"))}</p>
            </article>
            <article class="preview-card next">
              <span>${escapeHtml(t("presenter.nextPreview"))}</span>
              <strong>${nextInfo ? escapeHtml(slotTitle(nextInfo.slot)) : escapeHtml(t("presenter.endOfQueue"))}</strong>
              <p>${escapeHtml(nextInfo ? plain(slotSlides(nextInfo.slot)[0]?.body).slice(0, 170) : t("presenter.noNext"))}</p>
            </article>
            <article class="timer-card">
              <span>${escapeHtml(t("presenter.countdown"))}</span>
              <strong>${formatDuration(remaining)}</strong>
              <div class="button-row">
                <button class="secondary-button" type="button" data-command="timer-minus">-5</button>
                <button class="secondary-button" type="button" data-command="timer-plus">+5</button>
                <button class="action-button" type="button" data-command="timer-toggle">${state.timerRunning ? escapeHtml(t("common.pause")) : escapeHtml(t("common.start"))}</button>
                <button class="secondary-button" type="button" data-command="timer-reset">${escapeHtml(t("common.reset"))}</button>
              </div>
            </article>
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="hymn-queue-from-plan" data-slot="${state.activeSlot || 0}">Queue remaining service hymns</button>
          </div>
          <hr>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          ${window.CISStageDisplayUI && window.CISStageDisplayService
    ? window.CISStageDisplayUI.renderPresenterMount(
      window.CISStageDisplayService.getState(),
      state.stageDisplayDisplays,
    )
    : ""}
          <h3>${escapeHtml(t("presenter.queue"))}</h3>
          ${window.CISObsControlUI && window.CISObsConnectionService
            ? window.CISObsControlUI.renderCompactStatus(
              window.CISObsConnectionService.getStatus(),
              window.CISObsOutputService ? window.CISObsOutputService.getLiveState() : null,
              state.obsHeartbeat,
            )
            : ""}
          ${window.CISObsControlUI && window.CISObsConnectionService
            ? window.CISObsControlUI.renderControlPanel(window.CISObsConnectionService.getStatus())
            : ""}
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
            }).join("") || `<div class="empty-state">${escapeHtml(t("presenter.buildQueue"))}</div>`}
          </div>
        </aside>
      </div>
      ${window.CISCameraSourceUI && window.CISCameraSourceService
        ? window.CISCameraSourceUI.renderLocalPresentationPanel(window.CISCameraSourceService.getLocalPresentationStatus())
        : ""}
      <div id="obsProgramMonitorMount" class="obs-program-monitor-mount"></div>
    `;
  }

  function renderFavorites() {
    const favoriteSongs = [...favorites].map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    const recentSongs = recents.map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    return `
      <div class="dashboard-grid">
        <section class="section">
          <h2>${escapeHtml(t("favorites.title"))}</h2>
          <div class="tile-grid">
            ${favoriteSongs.map((item) => renderStoredSongCard(item.key, item.song)).join("") || `<div class="empty-state">${escapeHtml(t("favorites.none"))}</div>`}
          </div>
        </section>
        <aside class="panel">
          <h3>${escapeHtml(t("favorites.recentlyUsed"))}</h3>
          <div class="result-list">
            ${recentSongs.map((item) => renderStoredResult(item.key, item.song)).join("") || `<div class="empty-state">${escapeHtml(t("favorites.noRecent"))}</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderStoredSongCard(key, song) {
    const parsed = parseSongKey(key);
    return `
      <div class="tile-wrap">
        <button class="tile song-tile" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}" data-edition-jump="${parsed.editionId}">
          <span class="star" aria-hidden="true">★</span>
          <span class="tnum">${escapeHtml(song.number)}</span>
          <span class="ttitle">${escapeHtml(song.title)}</span>
          <small class="tile-meta">${escapeHtml(getPack(parsed.code).name)}</small>
        </button>
        ${renderHymnQueueActions(key, true)}
      </div>
    `;
  }

  function renderStoredResult(key, song) {
    const parsed = parseSongKey(key);
    return `
      <div class="result-item search-result-with-actions">
        <button class="result-item-main" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}" data-edition-jump="${parsed.editionId}">
          <strong>${escapeHtml(getPack(parsed.code).name)} · Hymn ${escapeHtml(song.number)}</strong>
          <span>${escapeHtml(song.title)}</span>
        </button>
        ${renderHymnQueueActions(key, true)}
      </div>
    `;
  }

  function renderSettings() {
    const unclassifiedCount = hymnalBooks.find((book) => book.hymnBookId === "unclassified-hymn-books")
      ? ((hymnalBooks.find((book) => book.hymnBookId === "unclassified-hymn-books").editions || []).length)
      : 0;
    const hymnalPanel = window.CISHymnalLibraryUI
      ? window.CISHymnalLibraryUI.renderSettingsPanel({
        books: hymnalBooks,
        unclassifiedCount,
        pendingUndo: window.CISHymnalDeletionService ? window.CISHymnalDeletionService.getPendingUndo() : null,
      })
      : "";
    const quietPanel = window.CISQuietServiceModeUI
      ? window.CISQuietServiceModeUI.renderSettingsPanel(
        window.CISQuietServiceModeService?.getState?.().settings
          || (window.CISQuietServiceModeSettings
            ? window.CISQuietServiceModeSettings.load((key, fallback) => loadJson(key, fallback))
            : {}),
      )
      : "";
    const shortcutSettingsPanel = window.CISKeyboardShortcutsUI && window.CISKeyboardShortcutsService
      ? window.CISKeyboardShortcutsUI.renderSettingsPanel(window.CISKeyboardShortcutsService.getState())
      : "";
    const shortcutReferencePanel = window.CISKeyboardShortcutsUI && window.CISKeyboardShortcutsService
      ? window.CISKeyboardShortcutsUI.renderReferencePanel(
        window.CISKeyboardShortcutsService.getState(),
        state.shortcutReferenceQuery,
      )
      : "";
    const backupPanel = window.CISBackupRestore ? window.CISBackupRestore.renderSettingsPanel({
      favorites: favorites.size,
      builderItems: assignedSlots().length,
      importedPacks: importedPacks.length,
      templates: customTemplates.length,
      taggedHymns: Object.keys(songTagMap).length,
      autoBackups: autoBackupList,
    }) : `
      <section class="section">
        <h3>${escapeHtml(t("settings.localData"))}</h3>
        <div class="button-row">
          <button class="action-button" type="button" data-command="export-backup">${escapeHtml(t("settings.exportBackup"))}</button>
          <button class="secondary-button" type="button" data-command="restore-backup">${escapeHtml(t("settings.restoreBackup"))}</button>
        </div>
      </section>`;
    return `
      <div class="settings-page">
        ${hymnalPanel}
        <div class="dashboard-grid">
          <section class="section">
            <h2>${escapeHtml(t("settings.languagePacks"))}</h2>
            <div class="import-zone" data-command="import-language-pack">
              <strong>${escapeHtml(t("settings.importPack"))}</strong>
              <span>${escapeHtml(t("settings.importPackDesc"))}</span>
              <button class="action-button" type="button" data-command="import-language-pack">${escapeHtml(t("settings.importPack"))}</button>
              <span class="muted">Test pack: <code>app/data/sample-packs/ndebele-sample.json</code> (5 Ndebele hymns)</span>
            </div>
            <div class="import-zone tag-tools-zone">
              <strong>${escapeHtml(t("settings.tagHymns"))}</strong>
              <span>${escapeHtml(t("settings.tagHymnsDesc"))}</span>
              <button class="secondary-button" type="button" data-command="open-bulk-tag">${escapeHtml(t("settings.bulkTag"))}</button>
              <span class="muted">${escapeHtml(t("settings.taggedCount", { count: Object.keys(songTagMap).length }))}</span>
            </div>
            <div class="language-status">
              ${data.languagePacks.map((pack) => `
                <div class="language-row">
                  <strong>${escapeHtml(getBook(pack.hymnBookId)?.title || pack.name)} · ${escapeHtml(pack.name)}</strong>
                  <span class="status-pill ${pack.status === "ready" ? "ready" : "awaiting"}">${pack.status === "ready" ? t("topbar.hymns", { count: pack.songCount }) : escapeHtml(t("common.awaiting"))}</span>
                  <span class="muted">${escapeHtml(pack.editionId || pack.code)} · ${escapeHtml(compactSource(pack.source))}</span>
                </div>
              `).join("")}
            </div>
          </section>
          <aside class="panel">
            <h3>${escapeHtml(t("settings.installOffline"))}</h3>
            <p class="muted">${escapeHtml(t("settings.installOfflineDesc"))}</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="install-app">${escapeHtml(t("settings.installApp"))}</button>
            </div>
            ${desktopBridge ? `
              <hr>
              <h3>${escapeHtml(t("settings.desktopApp"))}</h3>
              <p class="muted">${escapeHtml(t("settings.desktopActive"))}${state.desktopInfo ? ` · Version ${escapeHtml(state.desktopInfo.version)} · ${escapeHtml(state.desktopInfo.platform)}` : ""}.</p>
              <div class="button-row">
                <button class="secondary-button" type="button" data-command="check-updates">${escapeHtml(t("settings.checkUpdates"))}</button>
              </div>
            ` : ""}
            <hr>
            <h3>Product Information</h3>
            <dl class="settings-product-info">
              <div><dt>Application</dt><dd>${escapeHtml(brandAppName())}</dd></div>
              <div><dt>Short name</dt><dd>${escapeHtml(brandShortName())}</dd></div>
              <div><dt>Version</dt><dd>${escapeHtml(state.desktopInfo?.version || "1.0.0")}</dd></div>
            </dl>
            <hr>
            <h3>${escapeHtml(t("nav.help"))}</h3>
            <p class="muted">${escapeHtml(t("home.helpCentreDetail"))}</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-view="help">${escapeHtml(t("nav.help"))}</button>
              <button class="secondary-button" type="button" data-command="help-open-emergency">${escapeHtml(t("presenter.emergencyHelp"))}</button>
              <button class="secondary-button" type="button" data-command="help-open-diagnostics">Diagnostics</button>
            </div>
            <hr>
            <h3>${escapeHtml(t("settings.sourceIntegration"))}</h3>
            <p class="muted">${escapeHtml((data.meta.generatedFrom || []).join(" + "))}</p>
          </aside>
        </div>
        ${backupPanel}
        ${window.CISStageDisplayUI && window.CISStageDisplayService
    ? window.CISStageDisplayUI.renderSettingsPanel(
      window.CISStageDisplayService.getState(),
      state.stageDisplayDisplays,
    )
    : ""}
        ${quietPanel}
        ${shortcutSettingsPanel}
        ${shortcutReferencePanel}
        ${renderBibleSettingsPanel()}
        ${renderObsSettingsPanel()}
        ${renderCameraSettingsMount()}
      </div>
    `;
  }

  function renderCameraSettingsMount() {
    if (!window.CISCameraSourceUI || !window.CISCameraSourceService) return "";
    window.CISCameraSourceUI.configure({ escapeHtml, t });
    return `<div id="cameraSettingsMount">${window.CISCameraSourceUI.renderSettingsPanel(window.CISCameraSourceService.getState())}</div>`;
  }

  function renderObsSettingsPanel() {
    if (!window.CISObsSettingsUI || !window.CISObsConnectionService || !window.CISObsSettingsStore) {
      return "";
    }
    const status = window.CISObsConnectionService.getStatus();
    const settings = window.CISObsSettingsStore.loadSettings();
    const scenePanel = window.CISObsMappingUI
      ? window.CISObsMappingUI.renderSceneMappingPanel(status, settings)
      : "";
    const sourcePanel = window.CISObsMappingUI
      ? window.CISObsMappingUI.renderSourceMappingPanel(status, settings)
      : "";
    const setupGuide = window.CISObsMappingUI
      ? window.CISObsMappingUI.renderSetupGuide(state.obsUrls)
      : "";
    const controlPanel = window.CISObsControlUI
      ? window.CISObsControlUI.renderControlPanel(status)
      : "";
    return `${window.CISObsSettingsUI.renderSettingsPanel(status, settings)}${scenePanel}${sourcePanel}${setupGuide}${controlPanel}<div id="obsProgramMonitorMount" class="obs-program-monitor-mount"></div>`;
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

  async function openSong(number, code, editionId) {
    const parsedEdition = editionId || (code && String(code).includes("-") ? code : state.editionId);
    const packCode = code && !String(code).includes("-") ? code : resolveEditionPackCode(parsedEdition);
    if (packCode && packCode !== state.languageCode) {
      if (!(await ensureLanguagePackLoaded(packCode))) return;
    }
    if (parsedEdition) {
      state.editionId = parsedEdition;
      const edition = getEdition(parsedEdition);
      if (edition) state.hymnBookId = edition.hymnBookId;
    }
    state.languageCode = packCode || state.languageCode;
    saveValue("language", state.languageCode);
    persistHymnalSelection();
    indexReadyPacks([state.languageCode]);
    const song = getSong(number, state.languageCode, state.editionId);
    if (!song) return;
    state.songNumber = song.number;
    state.slideIndex = 0;
    state.view = "song";
    saveValue("songNumber", state.songNumber);
    saveValue("view", state.view);
    addRecent(song, state.languageCode, state.editionId);
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
    if (window.CISFocusManager) {
      window.CISFocusManager.releaseTrap();
      window.CISFocusManager.restoreFocus();
    }
  }

  function assignSongToSlot(index, song) {
    if (!song || !worshipPlan[index]) return;
    worshipPlan[index] = createPlanSlot(worshipPlan[index].role, index, {
      type: "hymn",
      songKey: songKey(song),
    });
    state.activeSlot = index;
    saveValue("activeSlot", state.activeSlot);
    saveWorshipPlan();
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
    saveWorshipPlan();
    closeModal();
    render();
  }

  function addContentItem(contentType) {
    const meta = window.CISSlideContent ? window.CISSlideContent.getSlideType(contentType) : null;
    if (!meta) return;
    if (contentType === "camera") {
      const slot = createPlanSlot(meta.role, worshipPlan.length, {
        type: "camera",
        itemType: "camera",
        title: meta.label,
        cameraRole: "main",
        cameraLayout: "fullscreen",
        cameraDestinations: ["main", "secondary"],
      });
      worshipPlan.push(slot);
      state.activeSlot = worshipPlan.length - 1;
      state.showAddContent = false;
      saveValue("activeSlot", state.activeSlot);
      saveWorshipPlan();
      render();
      return;
    }
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
    saveWorshipPlan();
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
    saveWorshipPlan();
    closeModal();
    render();
  }

  function loadTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return;
    worshipPlan = normalizeWorshipPlan(template.slots);
    state.activeSlot = 0;
    saveValue("activeSlot", state.activeSlot);
    saveWorshipPlan();
    closeModal();
    setNotice(t("notice.templateLoaded", { name: template.name }));
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
    saveSongService();
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
    saveWorshipPlan();
    render();
  }

  function moveSlotToEdge(index, edge) {
    if (index < 0 || index >= worshipPlan.length) return;
    const [item] = worshipPlan.splice(index, 1);
    if (edge === "top") worshipPlan.unshift(item);
    else worshipPlan.push(item);
    state.activeSlot = edge === "top" ? 0 : worshipPlan.length - 1;
    saveValue("activeSlot", state.activeSlot);
    saveWorshipPlan();
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
    saveSongService();
    render();
  }

  function moveServiceSlotToEdge(index, edge) {
    if (index < 0 || index >= songService.length) return;
    const [item] = songService.splice(index, 1);
    if (edge === "top") songService.unshift(item);
    else songService.push(item);
    state.activeSongServiceSlot = edge === "top" ? 0 : songService.length - 1;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveSongService();
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
      if (type === "camera") {
        return {
          type: "custom",
          contentKind: "camera",
          title: slot.title || slot.role || "Camera",
          shortTitle: meta ? meta.label : "Camera",
          subtitle: slot.role || "",
          slides: slotSlides(slot),
          song: null,
          songKey: "",
          planIndex: index,
          cameraId: slot.cameraId || "",
          cameraRole: slot.cameraRole || slot.role || "",
        };
      }
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
    if (window.CISBibleProjectionService
      && state.presenter.songKey === window.CISBibleProjectionService.BIBLE_LIVE_KEY) {
      return window.CISBibleProjectionService.getPresenterItem();
    }
    if (state.presenter.songKey) {
      const song = getSongByKey(state.presenter.songKey);
      if (!song) return null;
      const parsed = parseSongKey(state.presenter.songKey);
      const slides = prepareSongSlides(song);
      return {
        type: "song",
        title: `Hymn ${song.number} · ${song.title}`,
        shortTitle: `Hymn ${song.number}`,
        subtitle: getPack(parsed.code).name,
        slides,
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
    if (item.contentKind === "camera" && window.CISCameraSourceService) {
      const slide = item.slides?.[0] || {};
      const cameraId = slide.cameraId || item.cameraId || "";
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
      window.CISCameraSourceService.sendCameraLive({
        cameraId,
        layout: slide.cameraLayout,
        destinations: slide.cameraDestinations,
        transition: slide.cameraTransition,
        audioMode: slide.cameraAudioMode,
      }).then(() => setNotice("Camera service item sent live."))
        .catch((error) => setNotice(error?.message || "Camera item failed."))
        .finally(() => render());
      return;
    }
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
    if (!confirmTrainingLiveAction("Present Current")) return;
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
    if (window.CISObsOutputService) {
      window.CISObsOutputService.clearWorshipOverlays().catch(() => {});
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
      ? `<div class="emergency-logo"><span class="emergency-logo-mark" aria-hidden="true">✦</span><strong>${escapeHtml(brandAppName().toUpperCase())}</strong><span>${escapeHtml(brandShortName())}</span></div><button class="emergency-return" type="button" data-command="emergency-clear">Return to lyrics</button>`
      : `<button class="emergency-return" type="button" data-command="emergency-clear">Return to lyrics</button>`;
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
      app: brandAppName(),
      applicationName: brandAppName(),
      exportedAt: new Date().toISOString(),
      languageCode: state.languageCode,
      worshipPlan,
      songService,
      favorites: [...favorites],
      recents,
      customTemplates,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`${brandExportPrefix()}_Worship_Builder_${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportBackup() {
    if (window.CISBackupRestore) return window.CISBackupRestore.exportFullBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      app: brandAppName(),
      applicationName: brandAppName(),
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

  function setupBulletinExport() {
    if (!window.CISBulletinExport) return;
    window.CISBulletinExport.configure({
      escapeHtml,
      modalRoot: els.modalRoot,
      setNotice,
      loadPrefs: () => loadJson("bulletinPrefs", window.CISBulletinExport.DEFAULT_PREFS || {}),
      savePrefs: (prefs) => saveJson("bulletinPrefs", prefs),
      gatherServiceData: () => ({
        worshipPlan,
        songService,
        helpers: {
          getSongForSlot: (slot) => slotSong(slot),
          slotHasContent,
          getPackName: (slot) => {
            const parsed = parseSongKey(slot.songKey || "");
            return getPack(parsed.code).name || "";
          },
        },
      }),
    });
  }

  function exportBulletin() {
    if (window.CISBulletinExport) return window.CISBulletinExport.openExportModal();
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
  <title>${escapeHtml(brandAppName())} Service Bulletin</title>
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
  <h1>${escapeHtml(brandAppName())} Worship Builder</h1>
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
        saveWorshipPlan(true);
        saveSongService(true);
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
        saveWorshipPlan(true);
        saveSongService(true);
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
    saveWorshipPlan(true);
    saveSongService(true);
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
      setNotice(version ? `${brandAppName()} · v${version}` : brandAppName());
      return;
    }
    if (command.startsWith("view:")) {
      const view = command.slice(5);
      if (navItems.some((item) => item.id === view) || view === "service") {
        if (isServiceModeActive() && !isServiceModeViewAllowed(view)) {
          setNotice("That screen is hidden during Service Mode.");
          return;
        }
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
    if (!event.target.closest(".locale-dropdown") && (uiLocaleMenuOpen || hymnBookMenuOpen || hymnEditionMenuOpen || indexBookMenuOpen || indexEditionMenuOpen)) {
      uiLocaleMenuOpen = false;
      hymnBookMenuOpen = false;
      hymnEditionMenuOpen = false;
      indexBookMenuOpen = false;
      indexEditionMenuOpen = false;
      renderLanguageSwitcher();
      if (state.view === "index") render();
    }

    const target = event.target.closest("[data-view], [data-command], [data-song], [data-lang], [data-edition], [data-hymn-book], [data-ui-locale], [data-slide], [data-help-article], [data-help-category], [data-help-nav], [data-help-bookmark], [data-help-context], [data-help-training-start], [data-help-training-complete]");
    if (!target) return;

    const backdrop = event.target.classList.contains("modal-backdrop");
    if (backdrop) {
      closeModal();
      return;
    }

    const uiLocale = target.dataset.uiLocale;
    if (uiLocale && window.CISI18n) {
      window.CISI18n.setLocale(uiLocale);
      state.uiLocale = window.CISI18n.getLocale();
      uiLocaleMenuOpen = false;
      uiLocaleMenuOpen = false;
      hymnBookMenuOpen = false;
      hymnEditionMenuOpen = false;
      indexBookMenuOpen = false;
      indexEditionMenuOpen = false;
      render();
      return;
    }

    const hymnBook = target.dataset.hymnBook;
    if (hymnBook) {
      hymnBookMenuOpen = false;
      indexBookMenuOpen = false;
      uiLocaleMenuOpen = false;
      void selectHymnBook(hymnBook);
      return;
    }

    const edition = target.dataset.edition;
    const lang = target.dataset.lang;
    if (edition || lang) {
      hymnEditionMenuOpen = false;
      indexEditionMenuOpen = false;
      hymnBookMenuOpen = false;
      indexBookMenuOpen = false;
      uiLocaleMenuOpen = false;
      void selectEdition(edition || state.editionId, lang);
      return;
    }

    const view = target.dataset.view;
    if (view) {
      if (isServiceModeActive() && !isServiceModeViewAllowed(view)) {
        setNotice("That screen is hidden during Service Mode. Exit Service Mode for administrative tasks.");
        return;
      }
      state.view = view;
      if (view === "help") resetHelpNav();
      saveValue("view", view);
      if (view === "search") {
        void ensureSearchIndexReady().then(() => render());
      } else {
        render();
      }
      return;
    }

    if (target.dataset.helpArticle) {
      openHelpArticle(target.dataset.helpArticle);
      return;
    }
    if (target.dataset.helpCategory) {
      openHelpCategory(target.dataset.helpCategory);
      return;
    }
    if (target.dataset.helpNav) {
      state.view = "help";
      state.help.history.push({ category: state.help.category, articleId: state.help.articleId, nav: state.help.nav });
      state.help.nav = target.dataset.helpNav;
      state.help.category = "";
      state.help.articleId = "";
      saveValue("view", state.view);
      render();
      return;
    }
    if (target.dataset.helpBookmark && window.CISHelpStore) {
      window.CISHelpStore.toggleBookmark(target.dataset.helpBookmark);
      render();
      return;
    }
    if (target.dataset.helpContext || target.dataset.helpTopic) {
      state.help.contextKey = target.dataset.helpContext || target.dataset.helpTopic;
      render();
      return;
    }
    if (target.dataset.helpSearch) {
      state.view = "help";
      state.help.searchQuery = target.dataset.helpSearch;
      resetHelpNav();
      saveValue("view", state.view);
      render();
      return;
    }
    if (target.dataset.helpTrainingStart && window.CISHelpStore) {
      const progress = window.CISHelpStore.getTrainingProgress();
      progress.trainingMode = true;
      progress.activeLesson = target.dataset.helpTrainingStart;
      window.CISHelpStore.saveTrainingProgress(progress);
      setNotice(t("notice.trainingStarted"));
      openHelpCategory("training");
      return;
    }
    if (target.dataset.helpTrainingComplete && window.CISHelpStore) {
      const progress = window.CISHelpStore.getTrainingProgress();
      progress.lessons = progress.lessons || {};
      progress.lessons[target.dataset.helpTrainingComplete] = true;
      window.CISHelpStore.saveTrainingProgress(progress);
      setNotice(t("notice.lessonComplete"));
      render();
      return;
    }

    const songNumber = target.dataset.song;
    const command = target.dataset.command;
    if (songNumber && !command) {
      openSong(songNumber, target.dataset.langJump, target.dataset.editionJump);
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
    if (target.id === "indexSearchInput") {
      state.query = target.value;
      scheduleIndexSearch(target);
      return;
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
    if (target.dataset?.command) {
      handleCommand(target.dataset.command, target);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (window.CISKeyboardShortcutsService?.handleEvent(event)) return;
    if (state.view === "song" && !window.CISKeyboardShortcutsService?.isTypingTarget?.(event.target)) {
      if (event.key === "ArrowRight") {
        moveSlide(1);
        event.preventDefault();
      }
      if (event.key === "ArrowLeft") {
        moveSlide(-1);
        event.preventDefault();
      }
    }
  });

  function handleCommand(command, target) {
    if (command && command !== "close-modal" && window.CISFocusManager) {
      window.CISFocusManager.rememberFocus(target);
    }
    if (command && window.CISQuietServiceModeService?.shouldBlockAdminPopup?.(command)) {
      setNotice("That administrative action is deferred while Quiet Service Mode is active.", { important: true });
      return;
    }
    if (command && window.CISLiveLockService) {
      if (window.CISLiveLockService.isCommandBlocked(command)) {
        setNotice("Live Lock is enabled. Unlock to perform this action.");
        return;
      }
      if (window.CISLiveLockService.isCommandBlocked(command, { confirmed: target?.dataset?.confirmed === "true" })) {
        if (window.confirm("Live Lock is enabled. Reassign outputs anyway?")) {
          target.dataset.confirmed = "true";
          handleCommand(command, target);
        }
        return;
      }
    }
    if (command && window.CISServiceModeService && !window.CISServiceModeService.isCommandAllowed(command)) {
      setNotice("That action is hidden during Service Mode. Exit Service Mode for administrative tasks.");
      return;
    }
    const slotIndex = Number(target.dataset.slot);
    const serviceSlotIndex = Number(target.dataset.serviceSlot);
    if (command && command.startsWith("hymn-")) {
      void handleHymnQueueCommand(command, target);
      return;
    }
    if (command === "toggle-ui-locale-menu") {
      uiLocaleMenuOpen = !uiLocaleMenuOpen;
      hymnBookMenuOpen = false;
      hymnEditionMenuOpen = false;
      renderLanguageSwitcher();
      return;
    }
    if (command === "toggle-hymn-book-menu") {
      hymnBookMenuOpen = !hymnBookMenuOpen;
      hymnEditionMenuOpen = false;
      indexBookMenuOpen = !indexBookMenuOpen;
      indexEditionMenuOpen = false;
      uiLocaleMenuOpen = false;
      renderLanguageSwitcher();
      if (state.view === "index") render();
      return;
    }
    if (command === "toggle-hymn-edition-menu") {
      hymnEditionMenuOpen = !hymnEditionMenuOpen;
      hymnBookMenuOpen = false;
      indexEditionMenuOpen = !indexEditionMenuOpen;
      indexBookMenuOpen = false;
      uiLocaleMenuOpen = false;
      renderLanguageSwitcher();
      if (state.view === "index") render();
      return;
    }
    if (command === "select-hymnal-edition") {
      void selectEdition(target.dataset.edition, target.dataset.lang);
      if (target.dataset.hymnBook) state.hymnBookId = target.dataset.hymnBook;
      return;
    }
    if (command === "select-hymn-book") {
      void selectHymnBook(target.dataset.hymnBook);
      return;
    }
    if (command === "delete-hymnal-edition") {
      if (window.CISHymnalDeletionService) window.CISHymnalDeletionService.openEditionDeletionModal(target.dataset.edition);
      return;
    }
    if (command === "delete-hymnal-book") {
      if (window.CISHymnalDeletionService) window.CISHymnalDeletionService.openBookDeletionModal(target.dataset.hymnBook);
      return;
    }
    if (command === "export-hymnal-edition") {
      void exportHymnalEdition(target.dataset.edition);
      return;
    }
    if (command === "export-hymnal-book") {
      void exportHymnalBook(target.dataset.hymnBook);
      return;
    }
    if (command === "replace-hymnal-source") {
      window.CISPackImport && window.CISPackImport.openModal({ replaceEditionId: target.dataset.edition });
      return;
    }
    if (command === "edit-hymnal-edition" || command === "edit-hymnal-book" || command === "edit-hymnal-metadata") {
      setNotice("Metadata editing opens from the next library update. Use Export to back up changes.");
      return;
    }
    if (command === "validate-hymnal-book" || command === "validate-hymnal-edition") {
      setNotice("Built-in hymnal validation passed.");
      return;
    }
    if (command === "hide-hymnal-book" || command === "hide-hymnal-edition") {
      setNotice("Hide is not enabled for built-in hymnals in this release.");
      return;
    }
    if (command === "confirm-delete-hymnal") {
      void confirmDeleteHymnal(target.dataset.targetType, target.dataset.targetId);
      return;
    }
    if (command === "export-and-delete-hymnal") {
      void exportAndDeleteHymnal(target.dataset.targetType, target.dataset.targetId);
      return;
    }
    if (command === "undo-hymnal-delete") {
      void undoHymnalDelete();
      return;
    }
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
    if (command === "set-index-layout") {
      const layout = target.dataset.layout || target.value;
      if (layout) persistIndexDisplay({ layout });
      render();
      return;
    }
    if (command === "toggle-index-categories" || command === "toggle-index-show-categories") {
      const next = target.type === "checkbox" ? target.checked : !state.indexDisplay.showCategories;
      persistIndexDisplay({ showCategories: next });
      render();
      return;
    }
    if (command === "toggle-index-show-titles") {
      persistIndexDisplay({ showTitles: target.checked });
      render();
      return;
    }
    if (command === "toggle-index-show-favorites") {
      persistIndexDisplay({ showFavorites: target.checked });
      render();
      return;
    }
    if (command === "set-index-density") {
      persistIndexDisplay({ density: target.dataset.density || target.value || "comfortable" });
      render();
      return;
    }
    if (command === "set-index-sort") {
      const sort = target.dataset.sort || target.value || "number-asc";
      persistIndexDisplay({ sort });
      render();
      return;
    }
    if (command === "index-all-hymns") {
      state.category = "all";
      state.tagFilters = [];
      saveValue("category", "all");
      saveJson("tagFilters", []);
      render();
      return;
    }
    if (command === "index-clear-filters") {
      state.query = "";
      state.category = "all";
      state.tagFilters = [];
      saveValue("category", "all");
      saveJson("tagFilters", []);
      render();
      return;
    }
    if (command === "toggle-practice-mode") {
      state.practiceMode = !state.practiceMode;
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
      if (state.searchScope === "current") state.searchScope = "edition";
      saveValue("searchScope", state.searchScope);
      render();
      if (state.view === "search" && getWorshipSearchUI()) getWorshipSearchUI().refresh();
      return;
    }
    if (command === "set-category") {
      state.category = target.dataset.category || "all";
      state.tagFilters = state.category === "all" ? [] : [state.category];
      saveValue("category", state.category);
      saveJson("tagFilters", state.tagFilters);
      render();
      if (state.view === "search" && getWorshipSearchUI()) getWorshipSearchUI().refresh();
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
      if (state.view === "search" && getWorshipSearchUI()) getWorshipSearchUI().refresh();
      return;
    }
    if (command === "clear-tag-filters") {
      state.tagFilters = [];
      state.category = "all";
      saveJson("tagFilters", []);
      saveValue("category", "all");
      render();
      if (state.view === "search" && getWorshipSearchUI()) getWorshipSearchUI().refresh();
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
      saveWorshipPlan();
      state.activeSlot = Math.max(0, Math.min(state.activeSlot, worshipPlan.length - 1));
      render();
      return;
    }
    if (command === "remove-service-song") {
      if (songService[serviceSlotIndex]) songService[serviceSlotIndex].songKey = "";
      saveSongService();
      render();
      return;
    }
    if (command === "move-slot-up") return moveSlot(slotIndex, -1);
    if (command === "move-slot-down") return moveSlot(slotIndex, 1);
    if (command === "move-slot-top") return moveSlotToEdge(slotIndex, "top");
    if (command === "move-slot-bottom") return moveSlotToEdge(slotIndex, "bottom");
    if (command === "move-service-up") return moveServiceSlot(serviceSlotIndex, -1);
    if (command === "move-service-down") return moveServiceSlot(serviceSlotIndex, 1);
    if (command === "move-service-top") return moveServiceSlotToEdge(serviceSlotIndex, "top");
    if (command === "move-service-bottom") return moveServiceSlotToEdge(serviceSlotIndex, "bottom");
    if (command === "show-chorus") return showChorusSlide();
    if (command === "shortcut-reset-defaults") {
      if (window.CISKeyboardShortcutsService && window.CISKeyboardShortcutsSettings) {
        window.CISKeyboardShortcutsService.resetBindings();
        window.CISKeyboardShortcutsSettings.reset(saveJson);
        setNotice("Keyboard shortcuts reset to defaults.");
        render();
      }
      return;
    }
    if (command === "shortcut-open-reference") {
      state.view = "settings";
      state.shortcutReferenceQuery = "";
      saveValue("view", state.view);
      render();
      window.setTimeout(() => document.getElementById("shortcutReferenceSearch")?.focus(), 0);
      return;
    }
    if (command === "open-plan-song") {
      const slot = worshipPlan[slotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code, parsed.editionId);
      }
      return;
    }
    if (command === "open-service-song") {
      const slot = songService[serviceSlotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code, parsed.editionId);
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
      saveWorshipPlan(true);
      render();
      return;
    }
    if (command === "clear-song-service") {
      songService = createDefaultSongService();
      saveSongService(true);
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
    if (command === "session-recovery-restore") {
      void window.CISSessionRecoveryService.restoreSession({
        openOutputs: false,
        restoreLive: false,
      }).then((result) => {
        window.CISSessionRecoveryUI?.closeRecoveryScreen?.();
        setNotice(result?.message || "Session restored. Outputs remain closed until you confirm.");
        render();
      });
      return;
    }
    if (command === "session-recovery-review") {
      void window.CISSessionRecoveryService.inspectAvailability().then((inspection) => {
        const offer = window.CISSessionRecoveryService.getRecoveryOffer();
        window.CISSessionRecoveryUI?.openReviewScreen?.(offer, inspection);
      });
      return;
    }
    if (command === "session-recovery-restore-reviewed") {
      const options = window.CISSessionRecoveryUI?.readReviewOptions?.() || {};
      if (options.restoreLive && !window.confirm("Restore previous Live content to outputs?")) return;
      if ((options.reopenProjector || options.reopenStageDisplay) && !window.confirm("Reopen selected output windows?")) return;
      void window.CISSessionRecoveryService.restoreSession(options).then((result) => {
        window.CISSessionRecoveryUI?.closeRecoveryScreen?.();
        setNotice(result?.message || "Recovery options applied.");
        render();
      });
      return;
    }
    if (command === "session-recovery-open-without") {
      window.CISSessionRecoveryUI?.closeRecoveryScreen?.();
      window.CISSessionRecoveryService.markCleanExit(true);
      setNotice("Opened without restoring the interrupted session.");
      return;
    }
    if (command === "session-recovery-discard") {
      void window.CISSessionRecoveryService.discardRecovery().then(() => {
        window.CISSessionRecoveryUI?.closeRecoveryScreen?.();
        setNotice("Recovery snapshot discarded.");
        render();
      });
      return;
    }
    if (command === "session-recovery-back") {
      const offer = window.CISSessionRecoveryService.getRecoveryOffer();
      if (offer) window.CISSessionRecoveryUI?.openRecoveryScreen?.(offer);
      return;
    }
    if (command === "stage-display-open") {
      void window.CISStageDisplayService?.openOutput?.().then(() => {
        publishStageDisplay();
        setNotice("Stage Display opened. Congregation outputs unchanged.");
        render();
      });
      return;
    }
    if (command === "stage-display-close") {
      void window.CISStageDisplayService?.closeOutput?.().then(() => render());
      return;
    }
    if (command === "stage-display-restart") {
      void window.CISStageDisplayService?.restartOutput?.().then(() => {
        setNotice("Stage Display restarted.");
        render();
      });
      return;
    }
    if (command === "stage-display-test") {
      void window.CISStageDisplayService?.openOutput?.({ test: true }).then(() => {
        window.CISStageDisplayService.publishTestPattern("Stage display test pattern");
        render();
      });
      return;
    }
    if (command === "stage-display-set-layout") {
      window.CISStageDisplayService?.setLayout?.(target.dataset.layout);
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-set-display") {
      const displayId = target.value || "auto";
      window.CISStageDisplayService?.setDisplayAssignment?.({ displayId });
      if (desktopBridge?.stageDisplay?.savePrefs) {
        desktopBridge.stageDisplay.savePrefs({ displayId });
      }
      render();
      return;
    }
    if (command === "stage-display-windowed-test") {
      const windowedTest = target.type === "checkbox" ? target.checked : !window.CISStageDisplayService.getState().settings?.windowedTest;
      window.CISStageDisplayService?.setDisplayAssignment?.({ windowedTest });
      if (desktopBridge?.stageDisplay?.savePrefs) {
        desktopBridge.stageDisplay.savePrefs({ windowedTest });
      }
      render();
      return;
    }
    if (command === "stage-display-set-scale") {
      const scaleMode = target.value || "fit";
      window.CISStageDisplayService?.setDisplayAssignment?.({ scaleMode });
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-countdown-start") {
      const current = window.CISStageDisplayService.getState();
      window.CISStageDisplayService.startCountdown(current.countdownRemaining || current.settings?.countdownSeconds || 300);
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-countdown-pause") {
      const current = window.CISStageDisplayService.getState();
      if (current.countdownRunning) window.CISStageDisplayService.pauseCountdown();
      else window.CISStageDisplayService.resumeCountdown();
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-countdown-reset") {
      window.CISStageDisplayService.resetCountdown();
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-countdown-adjust") {
      window.CISStageDisplayService.adjustCountdown(Number(target.dataset.delta || 0));
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-countdown-label") {
      if (target.matches(":focus")) return;
      window.CISStageDisplayService.setCountdownLabel(target.value);
      publishStageDisplay();
      return;
    }
    if (command === "stage-display-send-message") {
      window.CISStageDisplayService.sendPrivateMessage(target.dataset.message || "");
      publishStageDisplay();
      setNotice("Private message sent to Stage Display only.");
      return;
    }
    if (command === "stage-display-send-custom-message") {
      const input = document.getElementById("stageDisplayMessageInput");
      window.CISStageDisplayService.sendPrivateMessage(input?.value || "");
      if (input) input.value = "";
      publishStageDisplay();
      setNotice("Private message sent to Stage Display only.");
      return;
    }
    if (command === "stage-display-dismiss-message") {
      window.CISStageDisplayService.dismissPrivateMessage();
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-log-messages") {
      window.CISStageDisplayService.setDisplayAssignment({ logPrivateMessages: target.checked });
      render();
      return;
    }
    if (command === "stage-display-sermon-title") {
      if (target.matches(":focus")) return;
      window.CISStageDisplayService.saveSettings({ sermonTitle: target.value || "" });
      publishStageDisplay();
      return;
    }
    if (command === "stage-display-speaker-name") {
      if (target.matches(":focus")) return;
      window.CISStageDisplayService.saveSettings({ speakerName: target.value || "" });
      publishStageDisplay();
      return;
    }
    if (command === "stage-display-start-service-clock") {
      window.CISStageDisplayService.saveSettings({ serviceStartedAt: Date.now() });
      publishStageDisplay();
      render();
      return;
    }
    if (command === "stage-display-reset-service-clock") {
      window.CISStageDisplayService.saveSettings({ serviceStartedAt: 0 });
      publishStageDisplay();
      render();
      return;
    }
    if (command === "timer-plus") return adjustTimer(300);
    if (command === "timer-minus") return adjustTimer(-300);
    if (command === "timer-toggle") return toggleTimer();
    if (command === "timer-reset") return resetTimer();
    if (command === "install-app") return installApp();
    if (command === "check-updates") {
      if (isQuietServiceModeActive()) {
        setNotice("Update checks are deferred while Quiet Service Mode is active.", { important: true });
        return;
      }
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
    if (command === "service-mode-enter") return enterServiceMode();
    if (command === "quiet-service-mode-enter") return enterQuietServiceMode();
    if (command === "quiet-service-mode-exit") return exitQuietServiceMode();
    if (command === "live-lock-enable") {
      if (window.CISLiveLockService) setNotice(window.CISLiveLockService.enable().message);
      renderLiveLockStrip();
      return;
    }
    if (command === "live-lock-unlock" || command === "live-lock-disable") {
      if (!window.CISLiveLockService) return;
      const result = window.CISLiveLockService.disable();
      if (result.needsConfirm) {
        if (window.confirm(result.message)) {
          setNotice(window.CISLiveLockService.disable({ confirmed: true }).message);
        }
      } else {
        setNotice(result.message);
      }
      renderLiveLockStrip();
      return;
    }
    if (command === "live-lock-toggle") {
      if (!window.CISLiveLockService) return;
      const result = window.CISLiveLockService.toggle();
      if (result.needsConfirm && window.confirm(result.message)) {
        setNotice(window.CISLiveLockService.disable({ confirmed: true }).message);
      } else if (!result.needsConfirm) {
        setNotice(result.message);
      }
      renderLiveLockStrip();
      return;
    }
    if (command === "service-mode-exit") return exitServiceMode();
    if (command === "service-mode-confirm-restore") {
      if (window.CISServiceModeService) window.CISServiceModeService.confirmSessionRestore();
      state.view = "service";
      saveValue("view", state.view);
      setNotice("Service Mode resumed. Outputs were not restored automatically.");
      render();
      return;
    }
    if (command === "service-mode-dismiss-restore") {
      if (window.CISServiceModeService) window.CISServiceModeService.dismissSessionRestore();
      setNotice("Service Mode session cleared.");
      render();
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
    if (command === "open-obs-settings") {
      state.view = "settings";
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "help-back") {
      const prev = state.help.history.pop();
      if (prev) {
        state.help.category = prev.category || "";
        state.help.articleId = prev.articleId || "";
        state.help.nav = prev.nav || "";
      } else {
        resetHelpNav();
      }
      render();
      return;
    }
    if (command === "help-clear-search") {
      state.help.searchQuery = "";
      render();
      return;
    }
    if (command === "help-open-emergency") {
      state.view = "help";
      openHelpCategory("emergency");
      return;
    }
    if (command === "help-open-diagnostics") {
      state.view = "help";
      state.help.category = "";
      state.help.articleId = "";
      state.help.nav = "diagnostics";
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "help-refresh-diagnostics") {
      render();
      return;
    }
    if (command === "help-copy-diagnostics") {
      const report = window.CISHelpDiagnostics
        ? window.CISHelpDiagnostics.formatReportText(gatherHelpDiagnosticsReport())
        : "";
      if (report && navigator.clipboard) {
        navigator.clipboard.writeText(report).then(() => setNotice(t("notice.diagnosticCopied"))).catch(() => setNotice(t("notice.diagnosticCopyFailed")));
      }
      return;
    }
    if (command === "help-close-context") {
      state.help.contextKey = "";
      render();
      return;
    }
    if (command === "help-toggle-training") {
      if (!window.CISHelpStore) return;
      const progress = window.CISHelpStore.getTrainingProgress();
      progress.trainingMode = !progress.trainingMode;
      window.CISHelpStore.saveTrainingProgress(progress);
      setNotice(progress.trainingMode ? t("notice.trainingModeOn") : t("notice.trainingModeOff"));
      state.view = "help";
      openHelpCategory("training");
      return;
    }
    if (command === "help-dismiss-whats-new") {
      if (window.CISHelpStore && state.desktopInfo) {
        window.CISHelpStore.markWhatsNewSeen(state.desktopInfo.version || "1.0.0");
      }
      render();
      return;
    }
    if (command === "obs-save-settings") {
      saveObsSettingsFromPage().then(() => setNotice("OBS settings saved.")).catch((error) => {
        setNotice(error && error.message ? error.message : "Failed to save OBS settings.");
      });
      return;
    }
    if (command === "obs-test-connection") {
      testObsConnectionFromPage();
      return;
    }
    if (command === "obs-connect") {
      connectObsFromPage();
      return;
    }
    if (command === "obs-disconnect") {
      disconnectObsFromPage();
      return;
    }
    if (command === "obs-refresh-scenes") {
      refreshObsScenesFromPage();
      return;
    }
    if (command === "obs-refresh-sources") {
      refreshObsSourcesFromPage();
      return;
    }
    if (command === "obs-save-mappings") {
      saveObsMappingsFromPage();
      return;
    }
    if (command === "obs-copy-url") {
      const url = target.dataset.url || "";
      if (url && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => setNotice(t("notice.urlCopied"))).catch(() => {});
      }
      return;
    }
    if (command === "obs-set-program-scene" && window.CISObsControlService) {
      const select = document.getElementById("obsProgramSceneSelect");
      const sceneName = select ? select.value : "";
      window.CISObsControlService.setProgramScene(sceneName)
        .then(() => setNotice(`OBS program scene: ${sceneName}`))
        .catch((error) => setNotice(error?.message || "Failed to change OBS scene."));
      return;
    }
    if (command === "obs-studio-transition" && window.CISObsControlService) {
      window.CISObsControlService.triggerStudioTransition()
        .then(() => setNotice("OBS studio transition triggered."))
        .catch((error) => setNotice(error?.message || "Studio transition failed."));
      return;
    }
    if (command === "obs-toggle-studio" && window.CISObsControlService) {
      const runtime = window.CISObsConnectionService?.getStatus()?.obsRuntime || {};
      window.CISObsControlService.setStudioMode(!runtime.studioMode)
        .then(() => { render(); setNotice(runtime.studioMode ? "OBS Studio Mode disabled." : "OBS Studio Mode enabled."); })
        .catch((error) => setNotice(error?.message || "Failed to toggle Studio Mode."));
      return;
    }
    if (command === "obs-start-stream" && window.CISObsControlService) {
      window.CISObsControlService.startStream(true)
        .then((result) => setNotice(result?.cancelled ? "Stream start cancelled." : "OBS streaming started."))
        .catch((error) => setNotice(error?.message || "Failed to start streaming."));
      return;
    }
    if (command === "obs-stop-stream" && window.CISObsControlService) {
      window.CISObsControlService.stopStream(true)
        .then((result) => setNotice(result?.cancelled ? "Stream stop cancelled." : "OBS streaming stopped."))
        .catch((error) => setNotice(error?.message || "Failed to stop streaming."));
      return;
    }
    if (command === "obs-start-record" && window.CISObsControlService) {
      window.CISObsControlService.startRecording()
        .then(() => setNotice("OBS recording started."))
        .catch((error) => setNotice(error?.message || "Failed to start recording."));
      return;
    }
    if (command === "obs-stop-record" && window.CISObsControlService) {
      window.CISObsControlService.stopRecording(true)
        .then((result) => setNotice(result?.cancelled ? "Recording stop cancelled." : "OBS recording stopped."))
        .catch((error) => setNotice(error?.message || "Failed to stop recording."));
      return;
    }
    if (command === "obs-start-vcam" && window.CISObsControlService) {
      window.CISObsControlService.startVirtualCamera()
        .then(() => setNotice("OBS Virtual Camera started."))
        .catch((error) => setNotice(error?.message || "Virtual Camera unavailable or failed."));
      return;
    }
    if (command === "obs-stop-vcam" && window.CISObsControlService) {
      window.CISObsControlService.stopVirtualCamera()
        .then(() => setNotice("OBS Virtual Camera stopped."))
        .catch((error) => setNotice(error?.message || "Failed to stop Virtual Camera."));
      return;
    }
    if (command === "obs-clear-overlays" && window.CISObsOutputService) {
      if (target?.dataset?.confirm === "true" && !window.confirm("Clear all worship overlays on OBS? Streaming will continue.")) return;
      window.CISObsOutputService.clearWorshipOverlays()
        .then(() => setNotice("Worship overlays cleared on OBS."))
        .catch((error) => setNotice(error?.message || "Failed to clear overlays."));
      return;
    }
    if (command === "obs-monitor-start" && window.CISObsProgramMonitor) {
      const monitor = window.CISObsProgramMonitor.getState();
      window.CISObsProgramMonitor.startMonitor({
        deviceId: monitor.deviceId,
        allowSnapshotFallback: true,
      })
        .then((result) => setNotice(result.mode === "snapshot" ? "OBS Snapshot Preview started." : "OBS Program Monitor started."))
        .catch((error) => setNotice(error?.message || "Failed to start OBS Program Monitor."))
        .finally(() => render());
      return;
    }
    if (command === "obs-monitor-stop" && window.CISObsProgramMonitor) {
      window.CISObsProgramMonitor.stopMonitor()
        .then(() => setNotice("OBS Program Monitor stopped."))
        .catch((error) => setNotice(error?.message || "Failed to stop monitor."))
        .finally(() => render());
      return;
    }
    if (command === "obs-monitor-refresh-devices" && window.CISObsProgramMonitor) {
      window.CISObsProgramMonitor.refreshDevices()
        .then(() => setNotice("Video devices refreshed."))
        .catch((error) => setNotice(error?.message || "Failed to refresh devices."))
        .finally(() => render());
      return;
    }
    if (command === "obs-monitor-start-vcam" && window.CISObsControlService) {
      window.CISObsControlService.startVirtualCamera()
        .then(() => { setNotice("OBS Virtual Camera started."); render(); })
        .catch((error) => setNotice(error?.message || "Virtual Camera unavailable or failed."));
      return;
    }
    if (command === "obs-monitor-stop-vcam" && window.CISObsControlService) {
      window.CISObsControlService.stopVirtualCamera()
        .then(() => { setNotice("OBS Virtual Camera stopped."); render(); })
        .catch((error) => setNotice(error?.message || "Failed to stop Virtual Camera."));
      return;
    }
    if (command === "obs-monitor-fullscreen") {
      const viewport = document.getElementById("obsProgramMonitorViewport");
      if (viewport && viewport.requestFullscreen) {
        viewport.requestFullscreen().catch(() => setNotice("Fullscreen is not available."));
      }
      return;
    }
    if (command === "obs-monitor-detach" && window.CISObsProgramMonitor) {
      if (!desktopBridge || !desktopBridge.obsMonitor || !desktopBridge.obsMonitor.open) {
        setNotice("Detach Monitor requires the Electron desktop app.");
        return;
      }
      const monitor = window.CISObsProgramMonitor.getState();
      publishObsMonitorWorshipContext();
      window.CISObsProgramMonitor.stopMonitor().finally(() => {
        window.CISObsProgramMonitor.setDetached(true);
        desktopBridge.obsMonitor.open({
          deviceId: monitor.deviceId,
          deviceLabel: monitor.deviceLabel,
          worshipContext: getObsMonitorWorshipContext(),
        });
        render();
        setNotice("OBS Program Monitor detached to always-on-top window.");
      });
      return;
    }
    if (command === "obs-monitor-reconnect" && window.CISObsConnectionService) {
      window.CISObsConnectionService.connect()
        .then(() => setNotice("Reconnecting to OBS…"))
        .catch((error) => setNotice(error?.message || "OBS reconnect failed."))
        .finally(() => render());
      return;
    }
    if (command === "obs-monitor-open-settings") {
      state.view = "settings";
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "camera-add") {
      openCameraEditor();
      return;
    }
    if (command === "camera-edit") {
      openCameraEditor(target.dataset.cameraId);
      return;
    }
    if (command === "camera-save") {
      saveCameraFromModal();
      return;
    }
    if (command === "camera-save-settings") {
      saveCameraSettingsFromPanel();
      return;
    }
    if (command === "camera-refresh-devices" && window.CISCameraSourceService) {
      window.CISCameraSourceService.refreshDevices(true)
        .then(() => setNotice("Camera devices refreshed."))
        .catch((error) => setNotice(error?.message || "Failed to refresh devices."))
        .finally(() => render());
      return;
    }
    if (command === "camera-preview" && window.CISCameraSourceService) {
      const cameraId = target.dataset.cameraId || window.CISCameraSourceService.getState().settings.defaultCameraId;
      window.CISCameraSourceService.startPreview(cameraId)
        .then(() => setNotice("Camera preview started."))
        .catch((error) => setNotice(error?.message || "Camera preview failed."))
        .finally(() => render());
      return;
    }
    if (command === "camera-stop-preview" && window.CISCameraSourceService) {
      window.CISCameraSourceService.stopPreview()
        .then(() => setNotice("Camera preview stopped."))
        .finally(() => render());
      return;
    }
    if (command === "camera-send-live") {
      handleCameraSendLive(target.dataset.cameraId);
      return;
    }
    if (command === "camera-switch-backup" && window.CISCameraSourceService) {
      window.CISCameraSourceService.useBackupCamera()
        .then(() => { setNotice("Switched to backup camera."); renderPresenterAV(); })
        .catch((error) => setNotice(error?.message || "Backup camera unavailable."))
        .finally(() => render());
      return;
    }
    if (command === "camera-clear" && window.CISCameraSourceService) {
      window.CISCameraSourceService.clearCamera();
      setNotice("Camera cleared from live output.");
      renderPresenterAV();
      render();
      return;
    }
    if (command === "camera-freeze-toggle" && window.CISCameraSourceService) {
      const liveState = window.CISCameraSourceService.getState().live;
      window.CISCameraSourceService.freezeCamera(!liveState.frozen);
      renderPresenterAV();
      render();
      return;
    }
    if (command === "camera-freeze-off" && window.CISCameraSourceService) {
      window.CISCameraSourceService.freezeCamera(false);
      renderPresenterAV();
      render();
      return;
    }
    if (command === "camera-restart" && window.CISCameraSourceService) {
      window.CISCameraSourceService.restartCameraSource()
        .then(() => setNotice("Camera source restarted."))
        .catch((error) => setNotice(error?.message || "Camera restart failed."))
        .finally(() => { renderPresenterAV(); render(); });
      return;
    }
    if (command === "camera-return-previous" && window.CISCameraSourceService) {
      if (window.CISCameraSourceService.returnToPreviousLive()) {
        setNotice("Returned to previous live item.");
        renderPresenterAV();
      } else setNotice("No previous live camera item.");
      render();
      return;
    }
    if (command === "camera-set-default" && window.CISCameraSourceService) {
      window.CISCameraSourceService.setDefaultCamera(target.dataset.cameraId);
      setNotice("Default camera updated.");
      render();
      return;
    }
    if (command === "camera-set-backup" && window.CISCameraSourceService) {
      window.CISCameraSourceService.setBackupCamera(target.dataset.cameraId);
      setNotice("Backup camera updated.");
      render();
      return;
    }
    if (command === "camera-remove" && window.CISCameraSourceService) {
      if (target.dataset.confirm === "true" && !window.confirm("Remove this saved camera?")) return;
      window.CISCameraSourceService.removeCamera(target.dataset.cameraId);
      setNotice("Camera removed.");
      render();
      return;
    }
    if (command === "camera-detach-preview") {
      if (!desktopBridge || !desktopBridge.cameraPreview || !desktopBridge.cameraPreview.open) {
        setNotice("Detach preview requires the Electron desktop app.");
        return;
      }
      desktopBridge.cameraPreview.open();
      setNotice("Camera preview detached.");
      return;
    }
    if (command === "camera-obs-vcam-start" && window.CISObsControlService) {
      window.CISObsControlService.startVirtualCamera()
        .then(() => setNotice("OBS Virtual Camera started."))
        .catch((error) => setNotice(error?.message || "Failed to start Virtual Camera."))
        .finally(() => render());
      return;
    }
    if (command === "camera-obs-vcam-stop" && window.CISObsControlService) {
      window.CISObsControlService.stopVirtualCamera()
        .then(() => setNotice("OBS Virtual Camera stopped."))
        .catch((error) => setNotice(error?.message || "Failed to stop Virtual Camera."))
        .finally(() => render());
      return;
    }
    if (command === "camera-obs-vcam-refresh") {
      if (window.CISObsConnectionService) window.CISObsConnectionService.refreshRuntime?.();
      if (window.CISCameraSourceService) window.CISCameraSourceService.refreshDevices(false);
      setNotice("OBS Virtual Camera state refreshed.");
      render();
      return;
    }
    if (command === "open-camera-sources") {
      state.view = "cameras";
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "open-bible-live") {
      openBibleLive(target?.dataset?.reference || "");
      return;
    }
    if (command === "quiet-settings" && window.CISQuietServiceModeService) {
      const setting = target.dataset.setting;
      if (!setting) return;
      const current = window.CISQuietServiceModeService.getState().settings || {};
      let value;
      if (target.type === "checkbox") value = target.checked;
      else value = target.value;
      window.CISQuietServiceModeService.updateSettings({ ...current, [setting]: value });
      if (window.CISQuietServiceModeSettings) {
        window.CISQuietServiceModeSettings.save(
          window.CISQuietServiceModeService.getState().settings,
          saveJson,
        );
      }
      setNotice("Quiet Service Mode settings saved.");
      render();
      return;
    }
    if (command === "bible-settings" && window.CISBibleProjectionService) {
      const setting = target.dataset.setting;
      if (!setting) return;
      const current = window.CISBibleProjectionService.getSettings();
      let value;
      if (target.type === "checkbox") value = target.checked;
      else if (target.type === "number") value = Number(target.value);
      else value = target.value;
      const next = { ...current, [setting]: value };
      window.CISBibleProjectionService.updateSettings(next, true);
      if (setting === "defaultTranslation") {
        state.bibleTranslation = value;
        saveValue("bibleTranslation", value);
      }
      setNotice("Bible projection settings saved.");
      render();
      return;
    }
    if ((command === "obs-show-source" || command === "obs-hide-source") && window.CISObsSourceService) {
      const sourceKey = target.dataset.sourceKey || "";
      const action = command === "obs-show-source"
        ? window.CISObsSourceService.showSource(sourceKey)
        : window.CISObsSourceService.hideSource(sourceKey);
      action
        .then(() => setNotice(command === "obs-show-source" ? "OBS source shown." : "OBS source hidden."))
        .catch((error) => setNotice(error?.message || "OBS source action failed."));
      return;
    }
    if (command === "obs-test-source" && window.CISObsSourceService) {
      const sourceKey = target.dataset.sourceKey || "";
      window.CISObsSourceService.showSource(sourceKey)
        .then(() => setNotice("Source visibility test sent to OBS."))
        .catch((error) => setNotice(error?.message || "Source test failed."));
      return;
    }
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
          name: brandAppName(),
          shortName: brandShortName(),
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
        if (window.CISQuietServiceModeService?.shouldDeferUpdateStatus?.(payload.status)) return;
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

  setupI18n();
  setupBranding();
  setupDesktopBridge();
  setupTemplateSystem();
  setupBuilderSlides();
  setupBuilderSystems();
  setupPresenterSystem();
  setupStageDisplay();
  setupSessionRecovery();
  setupObsIntegration();
  setupCameraSources();
  setupHelpCentre();
  setupSongTags();
  setupBackupRestore();
  setupBulletinExport();
  setupSearchEngine();
  setupHymnAudio();
  setupBible();
  setupHymnalLibrary();
  setupLiveHymnQueue();
  setupServiceMode();
  setupQuietServiceMode();
  setupKeyboardShortcuts();
  setupLiveSwitch();
  setupLiveLock();
  setupPerformance();
  setupUx();

  Promise.all([loadCustomTemplates(), loadSongTags(), loadAutoBackupList()]).finally(async () => {
    migrateLegacySongKeys();
    await loadHymnalLibrary();
    if (window.CISLazyLoader && window.CISLazyLoader.isPackDeferred(state.languageCode)) {
      await ensureLanguagePackLoaded(state.languageCode);
      indexReadyPacks([state.languageCode]);
    }
    scheduleBackgroundWarmup();
    if (window.CISPerformanceMonitor) window.CISPerformanceMonitor.mark("data-ready");
    await maybeOfferSessionRecovery();
    render();
    if (window.CISPerformanceMonitor) {
      window.CISPerformanceMonitor.measure("startupToFirstRenderMs", "app-start");
      window.CISPerformanceMonitor.measure("startupToDataReadyMs", "data-ready");
    }
    if (!data.languagePacks.length) {
      setNotice(t("notice.libraryFailed"));
    }
    if (window.CISBackupRestore) {
      window.CISBackupRestore.maybeRunDailyBackup().then((result) => {
        if (result) {
          loadAutoBackupList().finally(() => {
            setNotice(t("notice.dailyBackup", { id: result.id }));
          });
        }
      }).catch(() => {});
    }
  });
  const presenterClockInterval = window.setInterval(() => {
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
    if ((state.view === "presenter" || state.presenter.open) && state.timerRunning) {
      render();
    }
  }, 1000);
  if (window.CISPerformanceMonitor) window.CISPerformanceMonitor.trackInterval(presenterClockInterval);
})();
