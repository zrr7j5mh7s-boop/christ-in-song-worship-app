(function () {
  "use strict";

  const SESSION_KEY = "cis-live-hymn-queue-session";
  const listeners = new Set();
  let adapters = {};
  let settings = {};
  let takingLive = false;

  const state = {
    preview: null,
    next: null,
    queue: [],
    history: [],
    lastError: "",
  };

  function notify() {
    persistSession();
    listeners.forEach((fn) => fn(getState()));
  }

  function persistSession() {
    if (settings.autosave === false || typeof adapters.saveSession !== "function") return;
    adapters.saveSession({
      next: state.next,
      queue: state.queue,
      history: state.history.slice(0, 40),
    });
  }

  function restoreSession(saved) {
    if (!saved || typeof saved !== "object") return;
    state.next = saved.next || null;
    state.queue = Array.isArray(saved.queue) ? saved.queue : [];
    state.history = Array.isArray(saved.history) ? saved.history : [];
  }

  function createItem(input) {
    const songKey = input.songKey || "";
    return {
      id: input.id || `hq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      hymnBookId: input.hymnBookId || "",
      editionId: input.editionId || "",
      hymnId: input.hymnId || songKey,
      songKey,
      hymnNumber: input.hymnNumber || "",
      title: input.title || "",
      shortLabel: input.shortLabel || "",
      startSlideIndex: Math.max(0, Number(input.startSlideIndex) || 0),
      startAtChorus: Boolean(input.startAtChorus),
      destinations: Array.isArray(input.destinations) ? [...input.destinations] : [],
      transition: input.transition || settings.defaultTransition || "fade",
      status: "loading",
      error: "",
      chorusLabel: input.chorusLabel || "",
    };
  }

  async function preloadItem(item) {
    if (!item || !adapters.resolveSong) return item;
    item.status = "loading";
    item.error = "";
    try {
      const song = await adapters.resolveSong(item.songKey);
      if (!song || !song.slides || !song.slides.length) {
        item.status = "missing";
        item.error = "Hymn content unavailable.";
        return item;
      }
      let slideIndex = item.startSlideIndex;
      if (item.startAtChorus && adapters.findChorusSlide) {
        const chorusIndex = adapters.findChorusSlide(song);
        if (chorusIndex >= 0) slideIndex = chorusIndex;
      }
      item.startSlideIndex = Math.max(0, Math.min(song.slides.length - 1, slideIndex));
      item.status = "ready";
      item.title = item.title || song.title;
      item.hymnNumber = item.hymnNumber || song.number;
      item._song = song;
    } catch (error) {
      item.status = "missing";
      item.error = error?.message || "Failed to load hymn.";
    }
    return item;
  }

  function buildItemFromSongKey(songKey, options) {
    if (!adapters.describeSongKey) return null;
    const meta = adapters.describeSongKey(songKey);
    if (!meta) return null;
    return createItem({
      songKey,
      hymnBookId: meta.hymnBookId,
      editionId: meta.editionId,
      hymnId: meta.hymnId,
      hymnNumber: meta.hymnNumber,
      title: meta.title,
      shortLabel: meta.shortLabel,
      startSlideIndex: options?.startSlideIndex,
      startAtChorus: options?.startAtChorus,
      destinations: options?.destinations,
      transition: options?.transition,
      chorusLabel: meta.chorusLabel,
    });
  }

  function setPreview(songKey, options) {
    if (!songKey) {
      state.preview = null;
      notify();
      return null;
    }
    const item = buildItemFromSongKey(songKey, options);
    if (!item) {
      state.lastError = "Could not preview hymn.";
      notify();
      return null;
    }
    state.preview = item;
    state.lastError = "";
    preloadItem(item).then(() => notify());
    return item;
  }

  function setAsNext(songKey, options) {
    const item = buildItemFromSongKey(songKey, options);
    if (!item) {
      state.lastError = "Could not set next hymn.";
      notify();
      return null;
    }
    state.next = item;
    state.lastError = "";
    preloadItem(item).then(() => notify());
    return item;
  }

  function replaceNext(songKey, options) {
    return setAsNext(songKey, options);
  }

  function addToQueue(songKey, options) {
    const item = buildItemFromSongKey(songKey, options);
    if (!item) {
      state.lastError = "Could not queue hymn.";
      notify();
      return null;
    }
    if (!state.next) {
      state.next = item;
      preloadItem(item).then(() => notify());
      return item;
    }
    state.queue.push(item);
    preloadItem(item).then(() => notify());
    return item;
  }

  function removeNext() {
    if (state.queue.length) {
      state.next = state.queue.shift();
      preloadItem(state.next).then(() => notify());
      return;
    }
    state.next = null;
    notify();
  }

  function clearQueue() {
    state.queue = [];
    notify();
  }

  function moveQueueItem(id, delta) {
    const index = state.queue.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const target = index + delta;
    if (target < 0 || target >= state.queue.length) return false;
    const [item] = state.queue.splice(index, 1);
    state.queue.splice(target, 0, item);
    notify();
    return true;
  }

  function promoteQueueItem(id) {
    const index = state.queue.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const [item] = state.queue.splice(index, 1);
    if (state.next) state.queue.unshift(state.next);
    state.next = item;
    preloadItem(item).then(() => notify());
    return true;
  }

  function removeQueueItem(id) {
    if (state.next && state.next.id === id) {
      removeNext();
      return true;
    }
    const before = state.queue.length;
    state.queue = state.queue.filter((item) => item.id !== id);
    if (state.queue.length !== before) {
      notify();
      return true;
    }
    return false;
  }

  function duplicateQueueItem(id) {
    const source = state.queue.find((item) => item.id === id);
    if (!source) return null;
    const copy = createItem({
      ...source,
      id: undefined,
      status: "loading",
      error: "",
      _song: undefined,
    });
    state.queue.push(copy);
    preloadItem(copy).then(() => notify());
    return copy;
  }

  async function sendQueueItemLive(id, options) {
    const index = state.queue.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "Queue item not found." };
    const [item] = state.queue.splice(index, 1);
    state.next = item;
    await preloadItem(item);
    return takeNextLive({ force: true, skipConfirm: options?.skipConfirm });
  }

  function pushLiveHistory(liveMeta) {
    if (!liveMeta || !liveMeta.songKey) return;
    state.history.unshift({
      id: `hh-${Date.now()}`,
      songKey: liveMeta.songKey,
      hymnBookId: liveMeta.hymnBookId,
      editionId: liveMeta.editionId,
      hymnId: liveMeta.hymnId,
      hymnNumber: liveMeta.hymnNumber,
      title: liveMeta.title,
      shortLabel: liveMeta.shortLabel,
      slideIndex: liveMeta.slideIndex || 0,
      sentAt: Date.now(),
      destinations: liveMeta.destinations || [],
    });
    state.history = state.history.slice(0, 50);
  }

  async function takeNextLive(options) {
    if (takingLive || window.CISLiveSwitchService?.isSwitching?.()) {
      return { ok: false, message: "A Live switch is already in progress." };
    }
    if (!state.next) return { ok: false, message: "No next hymn is prepared." };
    takingLive = true;
    state.lastError = "";
    try {
      await preloadItem(state.next);
      if (state.next.status !== "ready") {
        state.lastError = state.next.error || "The next hymn could not be prepared. The current hymn remains Live.";
        notify();
        return { ok: false, message: state.lastError };
      }
      const item = state.next;
      const liveMeta = typeof adapters.getLiveMeta === "function" ? adapters.getLiveMeta() : null;
      if (liveMeta && liveMeta.songKey) pushLiveHistory(liveMeta);

      if (typeof adapters.goLive !== "function") {
        return { ok: false, message: "Presenter unavailable." };
      }
      const result = await adapters.goLive({
        songKey: item.songKey,
        slideIndex: item.startSlideIndex,
        transition: item.transition || settings.defaultTransition,
        destinations: item.destinations,
        hymnBookId: item.hymnBookId,
        editionId: item.editionId,
      }, options);

      if (!result || result.ok === false) {
        state.lastError = result?.message || "Transition failed. The current hymn remains Live.";
        notify();
        return { ok: false, message: state.lastError };
      }

      if (settings.autoAdvanceQueue !== false && state.queue.length) {
        state.next = state.queue.shift();
        preloadItem(state.next);
      } else {
        state.next = null;
      }
      notify();
      return { ok: true, message: `${item.shortLabel || item.title} is now Live.` };
    } finally {
      takingLive = false;
    }
  }

  async function sendLiveNow(songKey, options) {
    const item = buildItemFromSongKey(songKey, options);
    if (!item) return { ok: false, message: "Hymn unavailable." };
    state.next = item;
    await preloadItem(item);
    return takeNextLive({ force: true, skipConfirm: options?.skipConfirm });
  }

  async function restorePrevious() {
    const prev = state.history[0];
    if (!prev) return { ok: false, message: "No previous hymn to restore." };
    state.next = createItem(prev);
    await preloadItem(state.next);
    return takeNextLive({ force: true, skipConfirm: true });
  }

  function getState() {
    return {
      preview: state.preview ? { ...state.preview, _song: undefined } : null,
      next: state.next ? { ...state.next, _song: undefined } : null,
      queue: state.queue.map((item) => ({ ...item, _song: undefined })),
      history: [...state.history],
      lastError: state.lastError,
      takingLive,
      settings: { ...settings },
    };
  }

  function updateSettings(patch, persist) {
    settings = { ...settings, ...patch };
    if (persist && typeof adapters.saveSettings === "function") {
      adapters.saveSettings(settings);
    }
    notify();
  }

  function configure(options) {
    adapters = {
      resolveSong: options?.resolveSong || null,
      describeSongKey: options?.describeSongKey || null,
      getLiveMeta: options?.getLiveMeta || null,
      goLive: options?.goLive || null,
      findChorusSlide: options?.findChorusSlide || null,
      saveSession: options?.saveSession || null,
      loadSession: options?.loadSession || null,
      saveSettings: options?.saveSettings || null,
    };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISLiveHymnQueueSettings) {
      settings = window.CISLiveHymnQueueSettings.load();
    }
    if (typeof adapters.loadSession === "function") {
      restoreSession(adapters.loadSession());
    }
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function markItemUnavailable(songKey) {
    let changed = false;
    if (state.next && state.next.songKey === songKey) {
      state.next.status = "missing";
      state.next.error = "This hymn edition is no longer available.";
      changed = true;
    }
    state.queue = state.queue.map((item) => {
      if (item.songKey !== songKey) return item;
      changed = true;
      return { ...item, status: "missing", error: "This hymn edition is no longer available." };
    });
    if (changed) notify();
  }

  window.CISLiveHymnQueueService = {
    configure,
    subscribe,
    getState,
    updateSettings,
    setPreview,
    clearPreview: () => setPreview(""),
    setAsNext,
    replaceNext,
    addToQueue,
    removeNext,
    clearQueue,
    moveQueueItem,
    promoteQueueItem,
    removeQueueItem,
    duplicateQueueItem,
    sendQueueItemLive,
    takeNextLive,
    sendLiveNow,
    restorePrevious,
    pushLiveHistory,
    markItemUnavailable,
    preloadItem,
    buildItemFromSongKey,
  };
})();
