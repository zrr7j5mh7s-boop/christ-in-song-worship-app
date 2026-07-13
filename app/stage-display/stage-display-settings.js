(function () {
  "use strict";

  const STORAGE_KEY = "stageDisplaySettings";

  const MODULES = {
    currentHymnStanza: { id: "currentHymnStanza", label: "Current hymn stanza" },
    nextHymnStanza: { id: "nextHymnStanza", label: "Next hymn stanza" },
    currentBibleVerse: { id: "currentBibleVerse", label: "Current Bible verse" },
    nextBibleVerse: { id: "nextBibleVerse", label: "Next Bible verse" },
    currentServiceItem: { id: "currentServiceItem", label: "Current service item" },
    nextServiceItem: { id: "nextServiceItem", label: "Next service item" },
    clock: { id: "clock", label: "Current time" },
    serviceElapsed: { id: "serviceElapsed", label: "Service elapsed time" },
    countdown: { id: "countdown", label: "Countdown" },
    sermonTitle: { id: "sermonTitle", label: "Sermon title" },
    speakerName: { id: "speakerName", label: "Speaker name" },
    privateMessage: { id: "privateMessage", label: "Private operator message" },
    cameraStatus: { id: "cameraStatus", label: "Camera status" },
    micStatus: { id: "micStatus", label: "Microphone status" },
    recordingStatus: { id: "recordingStatus", label: "Recording status" },
    streamingStatus: { id: "streamingStatus", label: "Streaming status" },
  };

  const LAYOUTS = {
    "worship-team": {
      id: "worship-team",
      label: "Worship Team",
      modules: ["currentHymnStanza", "nextHymnStanza", "currentServiceItem", "nextServiceItem", "clock", "privateMessage"],
    },
    preacher: {
      id: "preacher",
      label: "Preacher",
      modules: ["currentBibleVerse", "nextBibleVerse", "sermonTitle", "speakerName", "countdown", "clock", "privateMessage"],
    },
    "programme-director": {
      id: "programme-director",
      label: "Programme Director",
      modules: ["currentServiceItem", "nextServiceItem", "serviceElapsed", "countdown", "clock", "streamingStatus", "recordingStatus", "privateMessage"],
    },
    musician: {
      id: "musician",
      label: "Musician",
      modules: ["currentHymnStanza", "nextHymnStanza", "currentServiceItem", "nextServiceItem", "clock", "privateMessage"],
    },
    countdown: {
      id: "countdown",
      label: "Countdown",
      modules: ["countdown", "clock", "privateMessage"],
    },
    "current-and-next": {
      id: "current-and-next",
      label: "Current and Next",
      modules: ["currentHymnStanza", "nextHymnStanza", "currentBibleVerse", "nextBibleVerse", "currentServiceItem", "nextServiceItem", "clock"],
    },
    "minimal-clock": {
      id: "minimal-clock",
      label: "Minimal Clock",
      modules: ["clock", "serviceElapsed"],
    },
    custom: {
      id: "custom",
      label: "Custom Layout",
      modules: Object.keys(MODULES),
    },
  };

  const PRESET_MESSAGES = [
    "Please conclude",
    "Five minutes remaining",
    "Repeat the chorus",
    "Move to closing hymn",
    "Microphone muted",
  ];

  const DEFAULTS = {
    layoutId: "current-and-next",
    customModules: LAYOUTS["current-and-next"].modules.slice(),
    displayId: "auto",
    windowedTest: false,
    scaleMode: "fit",
    logPrivateMessages: false,
    countdownSeconds: 300,
    countdownLabel: "Remaining",
    countdownWarningSeconds: 60,
    sermonTitle: "",
    speakerName: "",
    serviceStartedAt: 0,
  };

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS, customModules: DEFAULTS.customModules.slice() };
      const merged = { ...DEFAULTS, ...raw };
      if (!LAYOUTS[merged.layoutId]) merged.layoutId = DEFAULTS.layoutId;
      if (!Array.isArray(merged.customModules)) merged.customModules = DEFAULTS.customModules.slice();
      return merged;
    } catch (_error) {
      return { ...DEFAULTS, customModules: DEFAULTS.customModules.slice() };
    }
  }

  function save(settings, saveJson) {
    const merged = { ...DEFAULTS, ...settings };
    if (!LAYOUTS[merged.layoutId]) merged.layoutId = DEFAULTS.layoutId;
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, merged);
    return merged;
  }

  function activeModules(settings) {
    const layout = LAYOUTS[settings.layoutId] || LAYOUTS["current-and-next"];
    if (settings.layoutId === "custom") {
      return (settings.customModules || []).filter((id) => MODULES[id]);
    }
    return layout.modules.slice();
  }

  window.CISStageDisplaySettings = {
    STORAGE_KEY,
    MODULES,
    LAYOUTS,
    PRESET_MESSAGES,
    DEFAULTS,
    load,
    save,
    activeModules,
  };
})();
