(function () {
  "use strict";

  const pending = new Set();
  let lastRecordPath = "";

  function getConnection() {
    return window.CISObsConnectionService || null;
  }

  function getSettings() {
    return window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { confirmations: {} };
  }

  function isConnected() {
    const connection = getConnection();
    return Boolean(connection && connection.getStatus().connected);
  }

  async function guarded(actionKey, fn) {
    if (pending.has(actionKey)) throw new Error("Previous OBS command is still processing");
    pending.add(actionKey);
    try {
      return await fn();
    } finally {
      pending.delete(actionKey);
    }
  }

  function needsConfirmation(action) {
    const confirmations = getSettings().confirmations || {};
    return confirmations[action] !== false;
  }

  async function call(requestType, requestData) {
    const connection = getConnection();
    if (!connection || !connection.getStatus().connected) {
      throw new Error("OBS is not connected");
    }
    return connection.call(requestType, requestData);
  }

  async function setProgramScene(sceneName) {
    if (!sceneName) return null;
    return guarded(`scene:${sceneName}`, () => {
      if (window.CISObsSceneService) return window.CISObsSceneService.setProgramScene(sceneName, { force: true });
      return call("SetCurrentProgramScene", { sceneName });
    });
  }

  async function setPreviewScene(sceneName) {
    if (!sceneName) return null;
    return guarded(`preview:${sceneName}`, () => call("SetCurrentPreviewScene", { sceneName }));
  }

  async function triggerStudioTransition() {
    return guarded("studio-transition", () => call("TriggerStudioModeTransition"));
  }

  async function setStudioMode(enabled) {
    return guarded("studio-mode", () => call(enabled ? "EnableStudioMode" : "DisableStudioMode"));
  }

  async function startStream(confirm) {
    if (confirm && needsConfirmation("streamStart")) {
      const ok = window.confirm("Start OBS streaming?");
      if (!ok) return { cancelled: true };
    }
    return guarded("stream-start", async () => {
      await call("StartStream");
      const status = await call("GetStreamStatus");
      if (window.CISObsEventService) window.CISObsEventService.emit("streamStarted", status);
      return status;
    });
  }

  async function stopStream(confirm) {
    if (confirm && needsConfirmation("streamStop")) {
      const ok = window.confirm("Stop OBS streaming?");
      if (!ok) return { cancelled: true };
    }
    return guarded("stream-stop", async () => {
      await call("StopStream");
      const status = await call("GetStreamStatus");
      if (window.CISObsEventService) window.CISObsEventService.emit("streamStopped", status);
      return status;
    });
  }

  async function startRecording() {
    return guarded("record-start", async () => {
      await call("StartRecord");
      const status = await call("GetRecordStatus");
      if (window.CISObsEventService) window.CISObsEventService.emit("recordingStarted", status);
      return status;
    });
  }

  async function stopRecording(confirm) {
    if (confirm && needsConfirmation("recordStop")) {
      const ok = window.confirm("Stop OBS recording?");
      if (!ok) return { cancelled: true };
    }
    return guarded("record-stop", async () => {
      await call("StopRecord");
      const status = await call("GetRecordStatus");
      lastRecordPath = status?.outputPath || lastRecordPath;
      if (window.CISObsEventService) window.CISObsEventService.emit("recordingStopped", status);
      return status;
    });
  }

  async function pauseRecording() {
    return guarded("record-pause", () => call("PauseRecord"));
  }

  async function resumeRecording() {
    return guarded("record-resume", () => call("ResumeRecord"));
  }

  async function startVirtualCamera() {
    return guarded("vcam-start", async () => {
      await call("StartVirtualCam");
      return call("GetVirtualCamStatus");
    });
  }

  async function stopVirtualCamera() {
    return guarded("vcam-stop", async () => {
      await call("StopVirtualCam");
      return call("GetVirtualCamStatus");
    });
  }

  async function setSceneItemEnabled(sceneName, sourceName, enabled, sceneItemId) {
    const request = { sceneName, sceneItemEnabled: Boolean(enabled) };
    if (sceneItemId != null) request.sceneItemId = sceneItemId;
    else request.sourceName = sourceName;
    return guarded(`source:${sceneName}:${sourceName}`, () => call("SetSceneItemEnabled", request));
  }

  async function mediaAction(sourceName, action, value) {
    if (!sourceName) throw new Error("Media source name required");
    const key = `media:${sourceName}:${action}`;
    return guarded(key, async () => {
      if (action === "play") return call("TriggerMediaInputAction", { inputName: sourceName, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY" });
      if (action === "pause") return call("TriggerMediaInputAction", { inputName: sourceName, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE" });
      if (action === "restart") return call("TriggerMediaInputAction", { inputName: sourceName, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
      if (action === "stop") return call("TriggerMediaInputAction", { inputName: sourceName, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" });
      if (action === "seek" && value != null) {
        return call("SetMediaInputCursor", { inputName: sourceName, mediaCursor: Number(value) });
      }
      if (action === "mute") return call("SetInputMute", { inputName: sourceName, inputMuted: true });
      if (action === "unmute") return call("SetInputMute", { inputName: sourceName, inputMuted: false });
      if (action === "volume" && value != null) {
        return call("SetInputVolume", { inputName: sourceName, inputVolumeDb: Number(value) });
      }
      throw new Error(`Unsupported media action: ${action}`);
    });
  }

  function getLastRecordPath() {
    return lastRecordPath;
  }

  function isPending(actionKey) {
    return pending.has(actionKey);
  }

  window.CISObsControlService = {
    isConnected,
    setProgramScene,
    setPreviewScene,
    triggerStudioTransition,
    setStudioMode,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    startVirtualCamera,
    stopVirtualCamera,
    setSceneItemEnabled,
    mediaAction,
    getLastRecordPath,
    isPending,
    needsConfirmation,
  };
})();
