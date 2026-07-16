(function () {
  "use strict";

  const CHANNEL_NAME = "cis-presenter-v1";
  const ENGINE_VERSION = 1;

  let channel = null;
  let adapters = {};
  let state = createDefaultState();
  let listeners = new Set();
  let outputWindow = null;

  function createDefaultState() {
    return {
      active: false,
      paused: false,
      displayMode: "lyrics",
      slideIndex: 0,
      songKey: "",
      planIndex: null,
      queueKeys: [],
      queueIndex: null,
      fontScale: 1,
      timerSeconds: 600,
      timerRunning: false,
      timerEndsAt: 0,
      outputTarget: "embedded",
    };
  }

  function getChannel() {
    if (channel) return channel;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => handleRemoteMessage(event.data);
    }
    return channel;
  }

  function handleRemoteMessage(message) {
    if (!message) return;
    if (message.type === "presenter:command") {
      if (adapters.onRemoteCommand) adapters.onRemoteCommand(message.command);
      return;
    }
    if (message.type === "presenter:request-state") {
      // An output surface (projector window) booted or reloaded and needs the
      // current presentation state. Only the active controller replies.
      if (state.active) publishState();
      return;
    }
    if (message.type !== "presenter:state") return;
    if (message.source === "control") return;
    notify();
  }

  function publishState() {
    const snapshot = buildSnapshot();
    const message = {
      type: "presenter:state",
      version: ENGINE_VERSION,
      source: "control",
      state: serializeState(),
      snapshot,
      sentAt: Date.now(),
    };
    const bus = getChannel();
    if (bus) bus.postMessage(message);
    if (adapters.electronPublish) adapters.electronPublish(message);
    listeners.forEach((listener) => listener(snapshot, state));
    return snapshot;
  }

  function serializeState() {
    return { ...state };
  }

  function applyState(patch) {
    state = { ...state, ...patch };
    publishState();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify() {
    const snapshot = buildSnapshot();
    listeners.forEach((listener) => listener(snapshot, state));
    return snapshot;
  }

  function timerRemaining() {
    if (!state.timerRunning) return Math.max(0, state.timerSeconds);
    return Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  }

  function formatClock(date) {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date || new Date());
  }

  function currentItem() {
    if (!adapters.currentPresenterItem) return null;
    return adapters.currentPresenterItem(state);
  }

  function nextContext(item) {
    if (!item || !adapters.nextContext) return { nextSlide: null, nextHymn: null };
    return adapters.nextContext(state, item);
  }

  function buildSnapshot() {
    const item = currentItem();
    const index = item ? Math.max(0, Math.min(item.slides.length - 1, state.slideIndex)) : 0;
    const slide = item && item.slides[index] ? item.slides[index] : null;
    const context = item ? nextContext(item) : { nextSlide: null, nextHymn: null };
    const clock = formatClock();

    const hymnTitle = item && item.title && item.title.includes(" · ")
      ? item.title.slice(item.title.indexOf(" · ") + 3)
      : item && item.type === "song" ? (item.song && item.song.title ? item.song.title : "") : "";

    const projection = adapters.getProjectionContext
      ? adapters.getProjectionContext(state, item, slide)
      : {};

    return {
      active: state.active,
      paused: state.paused,
      displayMode: state.displayMode,
      fontScale: state.fontScale,
      slideIndex: index,
      slideCount: item ? item.slides.length : 0,
      title: item ? item.title : "",
      shortTitle: item ? item.shortTitle : "",
      hymnTitle,
      hymnNumber: item && item.song ? String(item.song.number || "") : "",
      language: item && item.subtitle ? item.subtitle : "",
      contentKind: item
        ? (item.contentKind || (item.type === "song" ? "hymn" : item.type) || "hymn")
        : "hymn",
      subtitle: item ? item.subtitle : "",
      themeId: projection.themeId || "classic_dark",
      projectionTheme: projection.projectionTheme || projection.themeId || "classic_dark",
      outputProfile: projection.outputProfile || "projector",
      transition: projection.transition || "fade",
      hideTitleAfterFirst: projection.hideTitleAfterFirst !== false,
      showTranslationOnOutput: projection.showTranslationOnOutput !== false,
      reducedMotion: Boolean(projection.reducedMotion),
      layout: slide?.layout || projection.layout || "fullscreen",
      obsLayout: slide?.obsLayout || projection.obsLayout || "lower_third",
      stageShowNextVerse: projection.stageShowNextVerse !== false,
      fitWarnings: slide?.fitWarning || [],
      slide: slide
        ? {
            label: slide.label || "",
            body: slide.body || "",
            kind: slide.kind || "verse",
            reference: slide.reference || slide.label || "",
            translation: slide.translation || "",
            layout: slide.layout || projection.layout || "fullscreen",
            chorusClass: slide.chorusClass || "",
            fitFontPx: slide.fitFontPx || null,
          }
        : null,
      nextSlide: context.nextSlide,
      nextHymn: context.nextHymn,
      canPrev: adapters.canGoPrev ? adapters.canGoPrev(state, item) : false,
      canNext: adapters.canGoNext ? adapters.canGoNext(state, item) : false,
      clock,
      timerRemaining: timerRemaining(),
      timerRunning: state.timerRunning,
      transitionKey: item ? `${state.songKey || "plan"}-${state.planIndex}-${index}-${state.displayMode}` : "idle",
    };
  }

  function openSession(patch) {
    state = {
      ...createDefaultState(),
      ...patch,
      active: true,
      paused: false,
      displayMode: "lyrics",
      slideIndex: 0,
    };
    openOutputSurface();
    publishState();
  }

  function closeSession() {
    state = createDefaultState();
    closeOutputSurface();
    publishState();
  }

  function openOutputSurface() {
    if (adapters.electronOpenProjector) {
      adapters.electronOpenProjector().catch(() => openPopupOutput());
      state.outputTarget = "electron";
      return;
    }
    openPopupOutput();
  }

  function openPopupOutput() {
    if (outputWindow && !outputWindow.closed) {
      outputWindow.focus();
      state.outputTarget = "popup";
      return;
    }
    const features = "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no";
    outputWindow = window.open("./presenter-screen.html", "cis-projector", features);
    state.outputTarget = outputWindow ? "popup" : "embedded";
    if (!outputWindow) {
      if (adapters.onEmbeddedOutput) adapters.onEmbeddedOutput(true);
    }
  }

  function closeOutputSurface() {
    if (adapters.electronCloseProjector) adapters.electronCloseProjector().catch(() => {});
    if (outputWindow && !outputWindow.closed) outputWindow.close();
    outputWindow = null;
    if (adapters.onEmbeddedOutput) adapters.onEmbeddedOutput(false);
  }

  function setDisplayMode(mode) {
    applyState({ displayMode: mode || "lyrics" });
  }

  function clearDisplay() {
    applyState({ displayMode: "clear" });
  }

  function togglePause() {
    applyState({ paused: !state.paused });
  }

  function moveSlide(delta) {
    if (!adapters.movePresenter) return false;
    const changed = adapters.movePresenter(state, delta);
    if (changed) publishState();
    return changed;
  }

  function configure(nextAdapters) {
    adapters = { ...adapters, ...nextAdapters };
  }

  function getState() {
    return { ...state };
  }

  function patchState(patch) {
    applyState(patch);
  }

  function handleCommand(command) {
    switch (command) {
      case "presenter-next":
        return moveSlide(1);
      case "presenter-prev":
        return moveSlide(-1);
      case "emergency-black":
        setDisplayMode("black");
        return true;
      case "emergency-white":
        setDisplayMode("white");
        return true;
      case "emergency-logo":
        setDisplayMode("logo");
        return true;
      case "emergency-clear":
        setDisplayMode("lyrics");
        return true;
      case "presenter-pause":
        togglePause();
        return true;
      case "close-presenter":
        closeSession();
        return true;
      case "presenter-fullscreen":
        if (adapters.toggleOutputFullscreen) adapters.toggleOutputFullscreen();
        return true;
      default:
        return false;
    }
  }

  function attachRemoteListener() {
    const bus = getChannel();
    if (!bus) return;
    bus.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === "presenter:command") {
        handleCommand(message.command);
      }
      if (message.type === "presenter:state" && message.source === "control") {
        notify();
      }
    };
  }

  function sendCommand(command) {
    const bus = getChannel();
    if (bus) bus.postMessage({ type: "presenter:command", command, sentAt: Date.now() });
    if (adapters.electronSendCommand) adapters.electronSendCommand(command);
    return handleCommand(command);
  }

  window.CISPresenterEngine = {
    CHANNEL_NAME,
    configure,
    subscribe,
    publishState,
    buildSnapshot,
    getState,
    patchState,
    applyState: patchState,
    openSession,
    closeSession,
    openOutputSurface,
    closeOutputSurface,
    setDisplayMode,
    clearDisplay,
    togglePause,
    moveSlide,
    handleCommand,
    sendCommand,
    attachRemoteListener,
    timerRemaining,
    formatClock,
  };
})();
