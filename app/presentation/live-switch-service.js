(function () {
  "use strict";

  const PHASE = window.CISPresentationStateModel?.PHASE || {
    BROWSE: "browse",
    PREVIEW: "preview",
    PREPARING: "preparing",
    READY: "ready",
    LIVE: "live",
    ERROR: "error",
    LOGO: "logo",
    BLACKOUT: "blackout",
    CLEARED: "cleared",
  };

  const listeners = new Set();
  let adapters = {};
  let settings = {};

  const state = {
    phase: PHASE.BROWSE,
    switching: false,
    lastError: "",
    staging: null,
    previousLive: null,
    outputs: {
      main: { status: "unknown", detail: "" },
      secondary: { status: "unknown", detail: "" },
      stage: { status: "unknown", detail: "" },
      obs: { status: "unknown", detail: "" },
    },
  };

  function notify() {
    listeners.forEach((fn) => fn(getState()));
  }

  function getState() {
    return {
      phase: state.phase,
      switching: state.switching,
      lastError: state.lastError,
      staging: state.staging ? { ...state.staging } : null,
      previousLive: state.previousLive ? { ...state.previousLive } : null,
      outputs: {
        main: { ...state.outputs.main },
        secondary: { ...state.outputs.secondary },
        stage: { ...state.outputs.stage },
        obs: { ...state.outputs.obs },
      },
      settings: { ...settings },
    };
  }

  function isSwitching() {
    return Boolean(state.switching);
  }

  function setPhase(phase, error) {
    state.phase = phase || PHASE.BROWSE;
    if (error) state.lastError = error;
    notify();
  }

  function setOutputHealth(id, status, detail) {
    if (!state.outputs[id]) return;
    state.outputs[id] = { status: status || "unknown", detail: detail || "" };
    notify();
  }

  function capturePreviousLive() {
    if (typeof adapters.captureLiveSnapshot === "function") {
      state.previousLive = adapters.captureLiveSnapshot();
      notify();
    }
    return state.previousLive;
  }

  async function prepare(descriptor) {
    const item = descriptor || {};
    state.staging = {
      type: item.type || "unknown",
      status: "loading",
      error: "",
      payload: { ...item },
      ready: false,
    };
    state.lastError = "";
    setPhase(PHASE.PREPARING);

    if (typeof adapters.prepareContent !== "function") {
      state.staging.status = "ready";
      state.staging.ready = true;
      setPhase(PHASE.READY);
      return { ok: true, staging: state.staging };
    }

    try {
      const result = await adapters.prepareContent(item);
      if (!result || result.ok === false) {
        const message = result?.message || "Content could not be prepared.";
        state.staging.status = "error";
        state.staging.error = message;
        state.staging.ready = false;
        state.lastError = message;
        setPhase(PHASE.ERROR, message);
        return { ok: false, message, staging: state.staging };
      }
      state.staging = {
        ...state.staging,
        ...(result.staging || {}),
        status: "ready",
        ready: true,
        error: "",
      };
      setPhase(PHASE.READY);
      return { ok: true, staging: state.staging };
    } catch (error) {
      const message = error?.message || "Preparation failed.";
      state.staging.status = "error";
      state.staging.error = message;
      state.staging.ready = false;
      state.lastError = message;
      setPhase(PHASE.ERROR, message);
      return { ok: false, message, staging: state.staging };
    }
  }

  async function commit(descriptor, options) {
    if (settings.blockConcurrentSwitches !== false && state.switching) {
      return { ok: false, message: "A Live switch is already in progress." };
    }

    state.switching = true;
    state.lastError = "";
    notify();

    try {
      const needsPrepare = !state.staging?.ready
        || state.staging?.type !== (descriptor?.type || state.staging?.type);
      if (needsPrepare) {
        const prep = await prepare(descriptor);
        if (!prep.ok) {
          return prep;
        }
      }

      if (!state.staging?.ready) {
        const message = "Prepared content is not ready. Current Live output is unchanged.";
        state.lastError = message;
        setPhase(PHASE.ERROR, message);
        return { ok: false, message };
      }

      capturePreviousLive();

      if (typeof adapters.applyLive !== "function") {
        return { ok: false, message: "Live output bridge unavailable." };
      }

      const result = await adapters.applyLive({
        ...(descriptor || {}),
        staging: state.staging,
      }, options);

      if (!result || result.ok === false) {
        const message = result?.message || "Live switch cancelled. Current output is unchanged.";
        state.lastError = message;
        setPhase(PHASE.ERROR, message);
        return { ok: false, message };
      }

      const displayMode = result.displayMode || "lyrics";
      if (displayMode === "logo") setPhase(PHASE.LOGO);
      else if (displayMode === "black") setPhase(PHASE.BLACKOUT);
      else if (displayMode === "clear") setPhase(PHASE.CLEARED);
      else setPhase(PHASE.LIVE);

      state.staging = null;
      return { ok: true, message: result.message || "Live output updated.", previousLive: state.previousLive };
    } finally {
      state.switching = false;
      notify();
    }
  }

  async function commitHymnLive(payload, options) {
    return commit({
      type: "hymn",
      songKey: payload?.songKey,
      slideIndex: payload?.slideIndex,
      transition: payload?.transition,
      destinations: payload?.destinations,
      hymnBookId: payload?.hymnBookId,
      editionId: payload?.editionId,
    }, options);
  }

  function markPreview(descriptor) {
    state.staging = {
      type: descriptor?.type || "preview",
      status: "preview",
      ready: false,
      error: "",
      payload: { ...descriptor },
    };
    setPhase(PHASE.PREVIEW);
  }

  function clearStaging() {
    state.staging = null;
    if (state.phase === PHASE.PREPARING || state.phase === PHASE.READY || state.phase === PHASE.ERROR) {
      setPhase(PHASE.BROWSE);
    }
  }

  function configure(options) {
    adapters = {
      prepareContent: options?.prepareContent || null,
      applyLive: options?.applyLive || null,
      captureLiveSnapshot: options?.captureLiveSnapshot || null,
      saveSettings: options?.saveSettings || null,
    };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISLiveSwitchSettings) {
      settings = window.CISLiveSwitchSettings.load();
    }
    notify();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.CISLiveSwitchService = {
    configure,
    subscribe,
    getState,
    isSwitching,
    prepare,
    commit,
    commitHymnLive,
    markPreview,
    clearStaging,
    capturePreviousLive,
    setOutputHealth,
    setPhase,
  };
})();
