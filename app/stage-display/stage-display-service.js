(function () {
  "use strict";

  let popupWindow = null;
  let messageLog = [];

  function engine() {
    return window.CISStageDisplayEngine;
  }

  function settingsApi() {
    return window.CISStageDisplaySettings;
  }

  let bridges = {};

  function configure(options) {
    bridges = { ...(options || {}) };
    if (engine()) engine().configure(options);
  }

  function getState() {
    return engine() ? engine().getState() : null;
  }

  function publish() {
    return engine() ? engine().publishState() : null;
  }

  function openOutput(options) {
    const eng = engine();
    if (!eng) return { ok: false, message: "Stage display engine unavailable." };
    const test = Boolean(options?.test);
    const windowed = Boolean(options?.windowed ?? eng.loadSettings()?.windowedTest);
    if (bridges.electronOpen) {
      return Promise.resolve(bridges.electronOpen({ test, windowed })).then((result) => {
        eng.patchState({
          active: true,
          connected: true,
          outputTarget: "electron",
          disconnectedAt: 0,
        });
        eng.ensureTick();
        eng.publishState();
        return result || { ok: true, target: "electron" };
      }).catch(() => openPopupOutput({ test, windowed }));
    }
    return openPopupOutput({ test, windowed });
  }

  function openPopupOutput(options) {
    const eng = engine();
    const test = Boolean(options?.test);
    const windowed = Boolean(options?.windowed);
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus();
      eng.patchState({ active: true, connected: true, outputTarget: "popup" });
      eng.publishState();
      return { ok: true, target: "popup" };
    }
    const size = windowed ? "width=960,height=540" : "width=1280,height=720";
    const features = `popup=yes,${size},menubar=no,toolbar=no,location=no,status=no`;
    popupWindow = window.open("./stage-display/stage-display-screen.html", "cis-stage-display", features);
    eng.patchState({
      active: Boolean(popupWindow),
      connected: Boolean(popupWindow),
      outputTarget: popupWindow ? "popup" : "none",
    });
    if (popupWindow) eng.ensureTick();
    eng.publishState();
    if (test && popupWindow) {
      setTimeout(() => publishTestPattern("Windowed test active"), 120);
    }
    return { ok: Boolean(popupWindow), target: popupWindow ? "popup" : "none" };
  }

  function closeOutput() {
    const eng = engine();
    if (bridges.electronClose) {
      return Promise.resolve(bridges.electronClose()).then(() => {
        eng.patchState({ active: false, connected: false, outputTarget: "none" });
        eng.publishState();
        return { ok: true };
      });
    }
    if (popupWindow && !popupWindow.closed) popupWindow.close();
    popupWindow = null;
    eng.patchState({ active: false, connected: false, outputTarget: "none" });
    eng.publishState();
    return { ok: true };
  }

  function restartOutput() {
    if (bridges.electronRestart) {
      const eng = engine();
      const prefs = eng.loadSettings();
      return Promise.resolve(bridges.electronRestart({
        windowed: prefs.windowedTest,
        displayId: prefs.displayId,
      })).then((result) => {
        eng.patchState({ active: true, connected: true, outputTarget: "electron" });
        eng.ensureTick();
        eng.publishState();
        return result || { ok: true };
      });
    }
    return closeOutput().then(() => openOutput());
  }

  function publishTestPattern(label) {
    const bus = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(engine()?.CHANNEL_NAME || "cis-stage-display-v1")
      : null;
    const payload = {
      type: "stage-display:test",
      label: label || "Stage display test",
      sentAt: Date.now(),
    };
    if (bus) bus.postMessage(payload);
    if (bridges.electronPublish) bridges.electronPublish(payload);
    return payload;
  }

  function setLayout(layoutId) {
    const eng = engine();
    const saved = eng.saveSettings({ layoutId });
    eng.publishState();
    return saved;
  }

  function setDisplayAssignment(patch) {
    const eng = engine();
    const saved = eng.saveSettings(patch || {});
    eng.publishState();
    return saved;
  }

  function sendPrivateMessage(text, options) {
    const eng = engine();
    const trimmed = String(text || "").trim();
    if (!trimmed) return { ok: false, message: "Message is empty." };
    const ttlMs = Number(options?.ttlMs || 45000);
    const entry = {
      text: trimmed,
      sentAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    eng.patchState({
      privateMessage: trimmed,
      privateMessageAt: entry.sentAt,
      privateMessageExpiresAt: entry.expiresAt,
    });
    const settings = eng.loadSettings();
    if (settings.logPrivateMessages) {
      messageLog = [{ ...entry }, ...messageLog].slice(0, 40);
      if (typeof options?.saveMessageLog === "function") options.saveMessageLog(messageLog);
    }
    setTimeout(() => {
      const current = eng.getState();
      if (current.privateMessage === trimmed && Date.now() >= entry.expiresAt) {
        dismissPrivateMessage();
      }
    }, ttlMs + 50);
    return { ok: true, entry };
  }

  function dismissPrivateMessage() {
    const eng = engine();
    eng.patchState({ privateMessage: "", privateMessageAt: 0, privateMessageExpiresAt: 0 });
    return { ok: true };
  }

  function getMessageLog() {
    return messageLog.slice();
  }

  function startCountdown(seconds) {
    const eng = engine();
    const value = Number.isFinite(seconds) ? seconds : eng.countdownRemaining();
    eng.patchState({
      countdownSeconds: value,
      countdownPausedRemaining: value,
      countdownRunning: true,
      countdownEndsAt: Date.now() + value * 1000,
    });
    eng.saveSettings({ countdownSeconds: value });
    eng.ensureTick();
    eng.publishState();
    return getState();
  }

  function pauseCountdown() {
    const eng = engine();
    const remaining = eng.countdownRemaining();
    eng.patchState({
      countdownRunning: false,
      countdownPausedRemaining: remaining,
      countdownEndsAt: 0,
    });
    eng.publishState();
    return getState();
  }

  function resumeCountdown() {
    const eng = engine();
    const remaining = eng.countdownRemaining();
    eng.patchState({
      countdownRunning: true,
      countdownEndsAt: Date.now() + remaining * 1000,
    });
    eng.ensureTick();
    eng.publishState();
    return getState();
  }

  function resetCountdown(seconds) {
    const eng = engine();
    const value = Number.isFinite(seconds) ? seconds : (eng.loadSettings()?.countdownSeconds || 300);
    eng.patchState({
      countdownRunning: false,
      countdownSeconds: value,
      countdownPausedRemaining: value,
      countdownEndsAt: 0,
    });
    eng.saveSettings({ countdownSeconds: value });
    eng.publishState();
    return getState();
  }

  function adjustCountdown(deltaSeconds) {
    const eng = engine();
    const next = Math.max(0, eng.countdownRemaining() + Number(deltaSeconds || 0));
    if (eng.getState().countdownRunning) {
      eng.patchState({ countdownEndsAt: Date.now() + next * 1000, countdownPausedRemaining: next });
    } else {
      eng.patchState({ countdownPausedRemaining: next, countdownSeconds: next });
    }
    eng.saveSettings({ countdownSeconds: next });
    eng.publishState();
    return getState();
  }

  function setCountdownLabel(label) {
    const eng = engine();
    const text = String(label || "").trim() || "Remaining";
    eng.patchState({ countdownLabel: text });
    eng.saveSettings({ countdownLabel: text });
    eng.publishState();
    return getState();
  }

  function saveSettings(patch) {
    return engine().saveSettings(patch || {});
  }

  function markDisconnected() {
    const eng = engine();
    eng.setOutputHealth({ connected: false, disconnectedAt: Date.now() });
    return getState();
  }

  function markConnected(target) {
    const eng = engine();
    eng.setOutputHealth({ connected: true, disconnectedAt: 0, outputTarget: target || eng.getState().outputTarget });
    return getState();
  }

  function handleOutputClosed() {
    popupWindow = null;
    const eng = engine();
    eng.patchState({ active: false, connected: false, outputTarget: "none", disconnectedAt: Date.now() });
    eng.publishState();
  }

  window.CISStageDisplayService = {
    configure,
    getState,
    publish,
    openOutput,
    closeOutput,
    restartOutput,
    publishTestPattern,
    setLayout,
    setDisplayAssignment,
    saveSettings,
    sendPrivateMessage,
    dismissPrivateMessage,
    getMessageLog,
    startCountdown,
    pauseCountdown,
    resumeCountdown,
    resetCountdown,
    adjustCountdown,
    setCountdownLabel,
    markDisconnected,
    markConnected,
    handleOutputClosed,
  };
})();
