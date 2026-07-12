(function () {
  "use strict";

  const BIBLE_LIVE_KEY = "__bible_live__";
  const listeners = new Set();
  let adapters = {};
  let settings = {};
  let escapeHtml = (v) => String(v || "");
  let previewLoadGen = 0;

  const state = {
    preview: {
      referenceInput: "",
      parsed: null,
      translation: "KJV",
      secondaryTranslation: "",
      slides: [],
      slideIndex: 0,
      loading: false,
      error: "",
      suggestions: [],
      searchResults: [],
      searchMode: "reference",
      referenceLabel: "",
      nextVerseRef: "",
      prevVerseRef: "",
    },
    live: {
      active: false,
      cleared: false,
      referenceLabel: "",
      translation: "KJV",
      secondaryTranslation: "",
      slides: [],
      slideIndex: 0,
      layout: "fullscreen",
      obsLayout: "lower_third",
      destinations: ["main"],
      dualVersion: false,
      fontScale: 1,
      sentAt: null,
      referenceInput: "",
      parsed: null,
    },
    history: [],
    recentReferences: [],
    previousLive: null,
    referenceHistory: [],
    speechSuggestion: null,
  };

  function notify() {
    listeners.forEach((fn) => fn(getPublicState()));
  }

  function getSettings() {
    return settings;
  }

  function getPublicState() {
    return {
      preview: { ...state.preview, slides: [...state.preview.slides] },
      live: { ...state.live, slides: [...state.live.slides] },
      history: [...state.history],
      recentReferences: [...state.recentReferences],
      previousLive: state.previousLive ? { ...state.previousLive } : null,
      speechSuggestion: state.speechSuggestion ? { ...state.speechSuggestion } : null,
      settings: { ...settings },
    };
  }

  function pushRecentReference(label) {
    if (!label) return;
    state.recentReferences = [label, ...state.recentReferences.filter((item) => item !== label)].slice(0, 24);
    state.referenceHistory = [label, ...state.referenceHistory.filter((item) => item !== label)].slice(0, 48);
  }

  function verseRefLabel(parsed, verse) {
    const parser = window.CISBibleReferenceParser;
    const store = window.CISBibleStore;
    if (!parsed || !store) return "";
    const book = store.getBookMeta(parsed.bookOrder);
    return parser.formatReferenceLabel(book, parsed.chapter, verse, verse);
  }

  function buildVerseNavigation(parsed, verses) {
    if (!parsed || !verses.length) return { prevVerseRef: "", nextVerseRef: "" };
    const first = verses[0].verse;
    const last = verses[verses.length - 1].verse;
    const chapter = parsed.chapter;
    const bookOrder = parsed.bookOrder;
    const store = window.CISBibleStore;
    const chapterCount = store ? store.chapterCount(bookOrder) : 0;

    let prevVerseRef = "";
    if (first > 1) prevVerseRef = verseRefLabel(parsed, first - 1);
    else if (chapter > 1) {
      prevVerseRef = verseRefLabel({ bookOrder, chapter: chapter - 1, verseStart: null }, null) || `${store.getBookMeta(bookOrder).name} ${chapter - 1}`;
    }

    let nextVerseRef = "";
    if (last) nextVerseRef = verseRefLabel({ ...parsed, verseStart: last + 1, verseEnd: last + 1 }, last + 1);

    return { prevVerseRef, nextVerseRef };
  }

  async function loadVerses(parsed, translation) {
    const store = window.CISBibleStore;
    if (!store || !parsed) throw new Error("Bible store unavailable.");
    const book = await store.loadBook(translation, parsed.bookOrder);
    const chapter = store.getChapter(book, parsed.chapter);
    if (!chapter) throw new Error(`Chapter ${parsed.chapter} not found in ${translation}.`);

    let verses = chapter.verses || [];
    if (parsed.verseStart) {
      const end = parsed.verseEnd || parsed.verseStart;
      verses = verses.filter((item) => item.verse >= parsed.verseStart && item.verse <= end);
      if (!verses.length) throw new Error(`Verse not found in ${translation}.`);
    }
    return { verses, chapter, book };
  }

  function formatSlideBody(verses, secondaryVerses, opts) {
    const showNums = opts.showVerseNumbers !== false;
    const dual = opts.dualVersion && secondaryVerses && secondaryVerses.length;
    const primary = verses.map((item) => (showNums ? `${item.verse} ${item.text}` : item.text)).join("\n");
    if (!dual) return primary;
    const secondary = secondaryVerses.map((item) => (showNums ? `${item.verse} ${item.text}` : item.text)).join("\n");
    const primaryLabel = opts.primaryLabel || "";
    const secondaryLabel = opts.secondaryLabel || "";
    if (opts.dualLayout === "side_by_side") {
      return `${primaryLabel}\n${primary}\n\n---\n\n${secondaryLabel}\n${secondary}`;
    }
    return `${primaryLabel}\n${primary}\n\n${secondaryLabel}\n${secondary}`;
  }

  function buildSlides(verses, parsed, translationCode, secondaryVerses) {
    const store = window.CISBibleStore;
    const meta = store ? store.getTranslationMeta(translationCode) : null;
    const secondaryMeta = settings.secondaryTranslation && store
      ? store.getTranslationMeta(settings.secondaryTranslation)
      : null;
    const perSlide = Math.max(1, Number(settings.versesPerSlide) || 1);
    const slides = [];

    for (let index = 0; index < verses.length; index += perSlide) {
      const chunk = verses.slice(index, index + perSlide);
      const secChunk = secondaryVerses ? secondaryVerses.slice(index, index + perSlide) : null;
      const start = chunk[0].verse;
      const end = chunk[chunk.length - 1].verse;
      const book = store.getBookMeta(parsed.bookOrder);
      const reference = window.CISBibleReferenceParser.formatReferenceLabel(book, parsed.chapter, start, end !== start ? end : null);
      slides.push({
        kind: "scripture",
        label: reference,
        reference,
        body: formatSlideBody(chunk, secChunk, {
          showVerseNumbers: settings.showVerseNumbers,
          dualVersion: settings.dualVersion,
          dualLayout: settings.dualLayout,
          primaryLabel: settings.dualVersion ? (meta?.abbreviation || translationCode) : "",
          secondaryLabel: settings.dualVersion ? (secondaryMeta?.abbreviation || settings.secondaryTranslation) : "",
        }),
        translation: meta?.abbreviation || translationCode,
        secondaryTranslation: secondaryMeta?.abbreviation || settings.secondaryTranslation || "",
        slideInHymn: slides.length + 1,
        totalSlides: 0,
      });
    }
    slides.forEach((slide, idx) => {
      slide.slideInHymn = idx + 1;
      slide.totalSlides = slides.length;
    });
    return slides;
  }

  function passageCacheKey(parsed, translation, secondaryTranslation) {
    const perSlide = Math.max(1, Number(settings.versesPerSlide) || 1);
    return {
      translation,
      secondary: secondaryTranslation || "",
      book: parsed.bookOrder,
      chapter: parsed.chapter,
      start: parsed.verseStart || 0,
      end: parsed.verseEnd || 0,
      perSlide,
      dual: settings.dualVersion ? 1 : 0,
      showNums: settings.showVerseNumbers !== false ? 1 : 0,
    };
  }

  async function loadPreviewFromInput(input, options) {
    const parser = window.CISBibleReferenceParser;
    if (!parser) {
      state.preview.error = "Reference parser unavailable.";
      notify();
      return null;
    }

    const text = String(input || "").trim();
    const loadGen = ++previewLoadGen;
    state.preview.referenceInput = text;
    state.preview.loading = true;
    state.preview.error = "";
    state.preview.suggestions = [];
    notify();

    const result = parser.parseReference(text);
    if (!result.ok) {
      if (loadGen !== previewLoadGen) return null;
      state.preview.parsed = null;
      state.preview.slides = [];
      state.preview.suggestions = result.suggestions || [];
      state.preview.error = result.error || "Reference not found.";
      state.preview.loading = false;
      notify();
      return null;
    }

    const translation = options?.translation || state.preview.translation || settings.defaultTranslation || "KJV";
    state.preview.translation = translation;

    const cache = window.CISPassageCache;
    const cacheKey = passageCacheKey(result.parsed, translation, settings.secondaryTranslation);
    const cached = cache ? cache.get(cacheKey) : null;
    if (cached) {
      if (loadGen !== previewLoadGen) return null;
      state.preview.parsed = result.parsed;
      state.preview.slides = cached.slides;
      state.preview.slideIndex = 0;
      state.preview.referenceLabel = result.parsed.referenceLabel;
      state.preview.prevVerseRef = cached.prevVerseRef;
      state.preview.nextVerseRef = cached.nextVerseRef;
      state.preview.error = "";
      state.preview.loading = false;
      pushRecentReference(result.parsed.referenceLabel);
      notify();
      return state.preview;
    }

    try {
      const { verses } = await loadVerses(result.parsed, translation);
      if (loadGen !== previewLoadGen) return null;
      let secondaryVerses = null;
      if (settings.dualVersion && settings.secondaryTranslation) {
        try {
          const sec = await loadVerses(result.parsed, settings.secondaryTranslation);
          if (loadGen !== previewLoadGen) return null;
          secondaryVerses = sec.verses;
        } catch (_error) {
          secondaryVerses = null;
        }
      }
      const slides = buildSlides(verses, result.parsed, translation, secondaryVerses);
      const nav = buildVerseNavigation(result.parsed, verses);
      if (loadGen !== previewLoadGen) return null;
      state.preview.parsed = result.parsed;
      state.preview.slides = slides;
      state.preview.slideIndex = 0;
      state.preview.referenceLabel = result.parsed.referenceLabel;
      state.preview.prevVerseRef = nav.prevVerseRef;
      state.preview.nextVerseRef = nav.nextVerseRef;
      state.preview.error = "";
      pushRecentReference(result.parsed.referenceLabel);
      if (cache) {
        cache.set(cacheKey, {
          slides,
          prevVerseRef: nav.prevVerseRef,
          nextVerseRef: nav.nextVerseRef,
        });
      }
    } catch (error) {
      if (loadGen !== previewLoadGen) return null;
      state.preview.parsed = result.parsed;
      state.preview.slides = [];
      state.preview.error = error?.message || "Could not load passage.";
      if (settings.preserveLiveOnFailure !== false) {
        state.preview.error += " The currently Live scripture has not been changed.";
      }
    } finally {
      state.preview.loading = false;
      notify();
    }
    return state.preview;
  }

  async function setPreviewTranslation(translation) {
    if (!state.preview.parsed) {
      state.preview.translation = translation;
      notify();
      return;
    }
    await loadPreviewFromInput(state.preview.referenceInput || state.preview.parsed.referenceLabel, { translation });
  }

  async function movePreviewVerse(delta) {
    if (!state.preview.parsed) return;
    const parsed = { ...state.preview.parsed };
    const start = parsed.verseStart || 1;
    const end = parsed.verseEnd || start;
    const nextStart = start + delta;
    const nextEnd = end + delta;
    if (nextStart < 1) return;
    parsed.verseStart = nextStart;
    parsed.verseEnd = nextEnd;
    const label = window.CISBibleReferenceParser.formatReferenceLabel(
      window.CISBibleStore.getBookMeta(parsed.bookOrder),
      parsed.chapter,
      nextStart,
      nextEnd !== nextStart ? nextEnd : null,
    );
    parsed.referenceLabel = label;
    await loadPreviewFromInput(label);
  }

  function getPresenterItem() {
    if (!state.live.active || state.live.cleared || !state.live.slides.length) return null;
    const index = Math.max(0, Math.min(state.live.slides.length - 1, state.live.slideIndex));
    return {
      type: "custom",
      contentKind: "scripture",
      title: state.live.referenceLabel,
      shortTitle: "Scripture",
      subtitle: `${state.live.referenceLabel} · ${state.live.translation}`,
      slides: state.live.slides,
      song: null,
      songKey: BIBLE_LIVE_KEY,
      planIndex: null,
      bibleLive: true,
      translation: state.live.translation,
      layout: state.live.layout,
      obsLayout: state.live.obsLayout,
      destinations: [...state.live.destinations],
      slideIndex: index,
    };
  }

  function recordHistory(entry) {
    if (settings.enableHistory === false) return;
    state.history.unshift({
      id: `bh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      reference: entry.reference,
      translation: entry.translation,
      sentAt: entry.sentAt || Date.now(),
      destinations: entry.destinations || [],
      layout: entry.layout || "fullscreen",
      sentLive: Boolean(entry.sentLive),
      addedToService: Boolean(entry.addedToService),
    });
    state.history = state.history.slice(0, 80);
  }

  function sendLive() {
    if (state.preview.loading) {
      return { ok: false, message: "Passage is still loading. Current Live output is unchanged." };
    }
    if (state.preview.error && !state.preview.slides.length) {
      return { ok: false, message: state.preview.error || "Passage is not ready for Live output." };
    }
    if (!state.preview.slides.length) {
      return { ok: false, message: state.preview.error || "Load a passage in Preview before sending Live." };
    }
    if (window.CISLiveSwitchService?.isSwitching?.()) {
      return { ok: false, message: "A Live switch is already in progress." };
    }

    if (state.live.active && state.live.slides.length) {
      state.previousLive = { ...state.live, slides: [...state.live.slides] };
    }

    state.live = {
      active: true,
      cleared: false,
      referenceLabel: state.preview.referenceLabel,
      translation: state.preview.translation,
      secondaryTranslation: settings.secondaryTranslation || "",
      slides: state.preview.slides.map((slide) => ({ ...slide })),
      slideIndex: state.preview.slideIndex || 0,
      layout: settings.defaultLayout || "fullscreen",
      obsLayout: settings.obsLayout || "lower_third",
      destinations: [...(settings.defaultDestinations || ["main"])],
      dualVersion: Boolean(settings.dualVersion),
      fontScale: settings.fontScale || 1,
      sentAt: Date.now(),
      referenceInput: state.preview.referenceInput,
      parsed: state.preview.parsed ? { ...state.preview.parsed } : null,
    };

    recordHistory({
      reference: state.live.referenceLabel,
      translation: state.live.translation,
      sentAt: state.live.sentAt,
      destinations: state.live.destinations,
      layout: state.live.layout,
      sentLive: true,
    });

    if (typeof adapters.onSendLive === "function") {
      adapters.onSendLive({
        slideIndex: state.live.slideIndex,
        item: getPresenterItem(),
      });
    }
    notify();
    return { ok: true, message: `${state.live.referenceLabel} sent Live (${state.live.translation}).` };
  }

  async function changeLiveVersion(translation) {
    if (!state.live.active || !state.live.parsed) {
      return { ok: false, message: "No Live scripture to update." };
    }
    try {
      const { verses } = await loadVerses(state.live.parsed, translation);
      let secondaryVerses = null;
      if (state.live.dualVersion && state.live.secondaryTranslation) {
        const sec = await loadVerses(state.live.parsed, state.live.secondaryTranslation);
        secondaryVerses = sec.verses;
      }
      const slides = buildSlides(verses, state.live.parsed, translation, secondaryVerses);
      const slideIndex = Math.min(state.live.slideIndex, slides.length - 1);
      state.live.slides = slides;
      state.live.translation = translation;
      state.live.slideIndex = slideIndex;
      recordHistory({
        reference: state.live.referenceLabel,
        translation,
        sentLive: true,
        layout: state.live.layout,
        destinations: state.live.destinations,
      });
      if (typeof adapters.onSendLive === "function") {
        adapters.onSendLive({ slideIndex, item: getPresenterItem(), versionChange: true });
      }
      notify();
      return { ok: true, message: `Live scripture updated to ${translation}.` };
    } catch (error) {
      return {
        ok: false,
        message: `${state.live.referenceLabel} is not available in ${translation}. The currently Live scripture has not been changed.`,
      };
    }
  }

  function clearLive() {
    if (!state.live.active) return { ok: false, message: "No Live scripture to clear." };
    if (state.live.slides.length) {
      state.previousLive = { ...state.live, slides: [...state.live.slides] };
    }
    state.live.cleared = true;
    if (typeof adapters.onClearLive === "function") adapters.onClearLive();
    notify();
    return { ok: true, message: "Scripture cleared. Cameras, recording and streaming are unchanged." };
  }

  function restorePreviousLive() {
    if (!state.previousLive || !state.previousLive.slides?.length) {
      return { ok: false, message: "No previous scripture to restore." };
    }
    state.live = { ...state.previousLive, slides: [...state.previousLive.slides], cleared: false, active: true };
    if (typeof adapters.onSendLive === "function") {
      adapters.onSendLive({ slideIndex: state.live.slideIndex, item: getPresenterItem(), restored: true });
    }
    notify();
    return { ok: true, message: `Restored ${state.live.referenceLabel} (${state.live.translation}).` };
  }

  function setLiveSlideIndex(index) {
    if (!state.live.active || state.live.cleared) return;
    state.live.slideIndex = Math.max(0, Math.min(state.live.slides.length - 1, index));
    notify();
  }

  function setDestinations(destinations) {
    state.live.destinations = Array.isArray(destinations) ? [...destinations] : ["main"];
    notify();
  }

  function setSpeechSuggestion(suggestion) {
    state.speechSuggestion = suggestion;
    notify();
  }

  function dismissSpeechSuggestion() {
    state.speechSuggestion = null;
    notify();
  }

  function setPreviewField(field, value) {
    if (Object.prototype.hasOwnProperty.call(state.preview, field)) {
      state.preview[field] = value;
      notify();
    }
  }

  function clearHistory() {
    state.history = [];
    notify();
  }

  function updateSettings(patch, persist) {
    settings = { ...settings, ...patch };
    if (persist && typeof adapters.saveSettings === "function") {
      adapters.saveSettings(settings);
    }
    notify();
  }

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
    adapters = {
      onSendLive: options?.onSendLive || null,
      onClearLive: options?.onClearLive || null,
      saveSettings: options?.saveSettings || null,
      loadSettings: options?.loadSettings || null,
    };
    if (typeof adapters.loadSettings === "function") {
      settings = adapters.loadSettings();
    } else if (window.CISBibleProjectionSettings) {
      settings = window.CISBibleProjectionSettings.load();
    }
    state.preview.translation = settings.defaultTranslation || "KJV";
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function isBibleLiveKey(key) {
    return key === BIBLE_LIVE_KEY;
  }

  window.CISBibleProjectionService = {
    BIBLE_LIVE_KEY,
    configure,
    subscribe,
    getState: getPublicState,
    getSettings,
    updateSettings,
    loadPreviewFromInput,
    setPreviewTranslation,
    movePreviewVerse,
    sendLive,
    changeLiveVersion,
    clearLive,
    restorePreviousLive,
    setLiveSlideIndex,
    setDestinations,
    getPresenterItem,
    setSpeechSuggestion,
    dismissSpeechSuggestion,
    setPreviewField,
    clearHistory,
    buildSlides,
    loadVerses,
    isBibleLiveKey,
    recordHistory,
  };
})();
