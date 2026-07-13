(function () {
  "use strict";

  const CHANNEL_NAME = "cis-stage-display-v1";
  const ENGINE_VERSION = 1;

  let channel = null;
  let adapters = {};
  let settings = {};
  let state = createDefaultState();
  let listeners = new Set();
  let tickTimer = null;

  function createDefaultState() {
    return {
      active: false,
      outputTarget: "none",
      connected: false,
      disconnectedAt: 0,
      privateMessage: "",
      privateMessageAt: 0,
      privateMessageExpiresAt: 0,
      countdownSeconds: 300,
      countdownLabel: "Remaining",
      countdownRunning: false,
      countdownEndsAt: 0,
      countdownPausedRemaining: 300,
      sermonTitle: "",
      speakerName: "",
      serviceStartedAt: 0,
    };
  }

  function getChannel() {
    if (channel) return channel;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === "stage-display:ping") publishState();
      };
    }
    return channel;
  }

  function configure(options) {
    adapters = { ...adapters, ...(options || {}) };
    if (typeof options?.loadSettings === "function") {
      settings = options.loadSettings();
    } else if (window.CISStageDisplaySettings) {
      settings = window.CISStageDisplaySettings.load();
    }
    state.countdownSeconds = settings.countdownSeconds || 300;
    state.countdownLabel = settings.countdownLabel || "Remaining";
    state.sermonTitle = settings.sermonTitle || "";
    state.speakerName = settings.speakerName || "";
    state.serviceStartedAt = settings.serviceStartedAt || 0;
  }

  function loadSettings() {
    if (typeof adapters.loadSettings === "function") {
      settings = adapters.loadSettings();
    }
    return settings;
  }

  function saveSettings(patch) {
    settings = { ...settings, ...(patch || {}) };
    if (typeof adapters.saveSettings === "function") adapters.saveSettings(settings);
    if (patch?.countdownSeconds !== undefined) state.countdownSeconds = patch.countdownSeconds;
    if (patch?.countdownLabel !== undefined) state.countdownLabel = patch.countdownLabel;
    if (patch?.sermonTitle !== undefined) state.sermonTitle = patch.sermonTitle;
    if (patch?.speakerName !== undefined) state.speakerName = patch.speakerName;
    if (patch?.serviceStartedAt !== undefined) state.serviceStartedAt = patch.serviceStartedAt;
    publishState();
    return settings;
  }

  function countdownRemaining() {
    if (!state.countdownRunning) return Math.max(0, state.countdownPausedRemaining);
    return Math.max(0, Math.ceil((state.countdownEndsAt - Date.now()) / 1000));
  }

  function formatClock(date) {
    return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(date || new Date());
  }

  function formatElapsed(startedAt) {
    if (!startedAt) return "—";
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const remSecs = seconds % 60;
    if (hrs > 0) return `${hrs}:${String(remMins).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`;
    return `${remMins}:${String(remSecs).padStart(2, "0")}`;
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function truncateText(text, max) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max - 1)}…`;
  }

  function buildModuleData(context, modules) {
    const blocks = {};
    const hymn = context.currentHymn || {};
    const stanza = context.currentStanza || {};
    const nextStanza = context.nextStanza || {};
    const bible = context.currentBible || {};
    const nextBible = context.nextBible || {};
    const service = context.currentServiceItem || {};
    const nextService = context.nextServiceItem || {};
    const status = context.status || {};

    if (modules.includes("currentHymnStanza")) {
      blocks.currentHymnStanza = {
        label: "Current",
        title: hymn.number ? `Hymn ${hymn.number}${hymn.title ? ` · ${hymn.title}` : ""}` : (hymn.title || "—"),
        body: truncateText(stanza.body || stanza.label, 220),
        meta: stanza.label || "",
      };
    }
    if (modules.includes("nextHymnStanza")) {
      blocks.nextHymnStanza = {
        label: "Next",
        title: nextStanza.label || context.nextHymnTitle || "—",
        body: truncateText(nextStanza.body, 180),
        meta: "",
      };
    }
    if (modules.includes("currentBibleVerse")) {
      blocks.currentBibleVerse = {
        label: "Current",
        title: bible.reference || "—",
        body: truncateText(bible.text, 240),
        meta: bible.translation || "",
      };
    }
    if (modules.includes("nextBibleVerse")) {
      blocks.nextBibleVerse = {
        label: "Next",
        title: nextBible.reference || "—",
        body: truncateText(nextBible.text, 180),
        meta: nextBible.translation || "",
      };
    }
    if (modules.includes("currentServiceItem")) {
      blocks.currentServiceItem = {
        label: "Service",
        title: service.title || service.role || "—",
        body: service.meta || "",
        meta: service.role || "",
      };
    }
    if (modules.includes("nextServiceItem")) {
      blocks.nextServiceItem = {
        label: "Service next",
        title: nextService.title || nextService.role || "—",
        body: nextService.meta || "",
        meta: nextService.role || "",
      };
    }
    if (modules.includes("clock")) {
      blocks.clock = { label: "Time", title: formatClock(), body: "", meta: "" };
    }
    if (modules.includes("serviceElapsed")) {
      blocks.serviceElapsed = {
        label: "Elapsed",
        title: formatElapsed(state.serviceStartedAt),
        body: "",
        meta: state.serviceStartedAt ? "Service running" : "Not started",
      };
    }
    if (modules.includes("countdown")) {
      const remaining = countdownRemaining();
      const warning = remaining > 0 && remaining <= (settings.countdownWarningSeconds || 60);
      blocks.countdown = {
        label: state.countdownLabel || "Remaining",
        title: formatDuration(remaining),
        body: state.countdownRunning ? "Running" : "Paused",
        meta: warning ? "warning" : "normal",
        warning,
      };
    }
    if (modules.includes("sermonTitle")) {
      blocks.sermonTitle = { label: "Sermon", title: state.sermonTitle || "—", body: "", meta: "" };
    }
    if (modules.includes("speakerName")) {
      blocks.speakerName = { label: "Speaker", title: state.speakerName || "—", body: "", meta: "" };
    }
    if (modules.includes("cameraStatus")) {
      blocks.cameraStatus = {
        label: "Camera",
        title: status.camera?.label || "—",
        body: status.camera?.detail || "",
        meta: status.camera?.status || "unknown",
        statusIcon: status.camera?.status === "live" ? "●" : "○",
      };
    }
    if (modules.includes("micStatus")) {
      blocks.micStatus = {
        label: "Microphone",
        title: status.mic?.label || "—",
        body: status.mic?.detail || "",
        meta: status.mic?.status || "unknown",
        statusIcon: status.mic?.status === "muted" ? "⊘" : "●",
      };
    }
    if (modules.includes("recordingStatus")) {
      blocks.recordingStatus = {
        label: "Recording",
        title: status.recording?.label || "—",
        body: status.recording?.detail || "",
        meta: status.recording?.status || "unknown",
        statusIcon: status.recording?.status === "active" ? "●" : "○",
      };
    }
    if (modules.includes("streamingStatus")) {
      blocks.streamingStatus = {
        label: "Streaming",
        title: status.streaming?.label || "—",
        body: status.streaming?.detail || "",
        meta: status.streaming?.status || "unknown",
        statusIcon: status.streaming?.status === "live" ? "●" : "○",
      };
    }
    return blocks;
  }

  function activePrivateMessage() {
    if (!state.privateMessage) return null;
    if (state.privateMessageExpiresAt && Date.now() > state.privateMessageExpiresAt) {
      state.privateMessage = "";
      state.privateMessageAt = 0;
      state.privateMessageExpiresAt = 0;
      return null;
    }
    return {
      text: state.privateMessage,
      sentAt: state.privateMessageAt,
      expiresAt: state.privateMessageExpiresAt,
    };
  }

  function buildSnapshot() {
    loadSettings();
    const context = typeof adapters.getWorshipContext === "function"
      ? (adapters.getWorshipContext() || {})
      : {};
    const modules = window.CISStageDisplaySettings
      ? window.CISStageDisplaySettings.activeModules(settings)
      : [];
    const layout = settings.layoutId || "current-and-next";
    const message = activePrivateMessage();

    return {
      version: ENGINE_VERSION,
      active: state.active,
      connected: state.connected,
      outputTarget: state.outputTarget,
      layout,
      layoutLabel: window.CISStageDisplaySettings?.LAYOUTS?.[layout]?.label || layout,
      modules,
      blocks: buildModuleData(context, modules),
      privateMessage: message,
      countdown: {
        remaining: countdownRemaining(),
        running: state.countdownRunning,
        label: state.countdownLabel,
        warning: countdownRemaining() > 0 && countdownRemaining() <= (settings.countdownWarningSeconds || 60),
      },
      clock: formatClock(),
      settings: {
        displayId: settings.displayId || "auto",
        windowedTest: Boolean(settings.windowedTest),
        scaleMode: settings.scaleMode || "fit",
      },
      sentAt: Date.now(),
    };
  }

  function publishState() {
    const snapshot = buildSnapshot();
    const message = { type: "stage-display:state", snapshot, sentAt: Date.now() };
    const bus = getChannel();
    if (bus) bus.postMessage(message);
    if (adapters.electronPublish) adapters.electronPublish(message);
    listeners.forEach((listener) => listener(snapshot, state));
    return snapshot;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return {
      ...state,
      settings: { ...settings },
      countdownRemaining: countdownRemaining(),
    };
  }

  function ensureTick() {
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
      if (!state.active) return;
      if (state.countdownRunning || settings.layoutId) publishState();
    }, 1000);
  }

  function setOutputHealth(patch) {
    state = { ...state, ...(patch || {}) };
    publishState();
  }

  function patchState(patch) {
    state = { ...state, ...(patch || {}) };
    publishState();
  }

  window.CISStageDisplayEngine = {
    CHANNEL_NAME,
    configure,
    subscribe,
    publishState,
    buildSnapshot,
    getState,
    patchState,
    setOutputHealth,
    saveSettings,
    loadSettings,
    countdownRemaining,
    ensureTick,
    activePrivateMessage,
  };
})();
