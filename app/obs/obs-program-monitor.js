(function () {
  "use strict";

  const STORAGE_KEY = "cis-va-chinoda:obsMonitor";
  const VCAM_PATTERNS = [/obs virtual/i, /obs-camera/i, /obs virtual camera/i];
  const SNAPSHOT_INTERVAL_MS = 4500;
  const SNAPSHOT_MAX_WIDTH = 960;

  const listeners = new Set();
  let mediaStream = null;
  let snapshotTimer = null;
  let snapshotInFlight = false;
  let streamStartedAt = null;
  let lastSnapshotDataUrl = "";

  let state = {
    active: false,
    mode: "stopped",
    layout: "large",
    deviceId: "",
    deviceLabel: "",
    devices: [],
    error: "",
    permission: "unknown",
    videoWidth: 0,
    videoHeight: 0,
    detached: false,
    viewerReturnUrl: "",
  };

  function notify() {
    listeners.forEach((fn) => {
      try { fn(getPublicState()); } catch (_error) {}
    });
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.deviceId) state.deviceId = String(parsed.deviceId);
      if (parsed.deviceLabel) state.deviceLabel = String(parsed.deviceLabel);
      if (["compact", "large", "side-by-side"].includes(parsed.layout)) state.layout = parsed.layout;
      if (parsed.viewerReturnUrl) state.viewerReturnUrl = String(parsed.viewerReturnUrl).slice(0, 500);
    } catch (_error) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        deviceId: state.deviceId || "",
        deviceLabel: state.deviceLabel || "",
        layout: state.layout,
        viewerReturnUrl: state.viewerReturnUrl || "",
      }));
    } catch (_error) {}
  }

  function isObsVirtualCamera(device) {
    if (!device || device.kind !== "videoinput") return false;
    const label = String(device.label || "");
    return VCAM_PATTERNS.some((pattern) => pattern.test(label));
  }

  function findObsVirtualCamera(devices) {
    return (devices || []).find((device) => isObsVirtualCamera(device)) || null;
  }

  function releaseStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_error) {}
      });
      mediaStream = null;
    }
    state.videoWidth = 0;
    state.videoHeight = 0;
  }

  function stopSnapshotPolling() {
    if (snapshotTimer) {
      window.clearInterval(snapshotTimer);
      snapshotTimer = null;
    }
    snapshotInFlight = false;
  }

  function getConnection() {
    return window.CISObsConnectionService || null;
  }

  function getObsRuntime() {
    const connection = getConnection();
    if (!connection) return {};
    const status = connection.getStatus();
    return status.obsRuntime || {};
  }

  function isObsConnected() {
    const connection = getConnection();
    return Boolean(connection && connection.getStatus().connected);
  }

  function isReconnecting() {
    const connection = getConnection();
    if (!connection) return false;
    const connState = connection.getStatus().state || "";
    return connState === "connecting" || connState === "reconnecting" || connState === "authenticating";
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function getStreamDurationLabel() {
    const runtime = getObsRuntime();
    if (!runtime.streaming) {
      streamStartedAt = null;
      return "—";
    }
    if (!streamStartedAt) streamStartedAt = Date.now();
    return formatDuration(Date.now() - streamStartedAt);
  }

  function getWorshipOutputLabels(engineState, presenterSnapshot) {
    const active = Boolean(engineState?.active);
    const paused = Boolean(engineState?.paused);
    const displayMode = engineState?.displayMode || "lyrics";
    const live = active && !paused && displayMode === "lyrics";
    const previewTitle = presenterSnapshot?.title || "—";
    const liveTitle = live ? previewTitle : "—";
    const previewLabel = active
      ? (paused || displayMode !== "lyrics" ? `Prepared (${displayMode})` : "Staging (not Live)")
      : previewTitle;
    return {
      worshipPreview: previewLabel,
      worshipLive: live ? liveTitle : "Not Live",
      worshipLiveActive: live,
    };
  }

  async function obsCall(requestType, requestData) {
    const connection = getConnection();
    if (!connection || !connection.getStatus().connected) {
      throw new Error("OBS is not connected");
    }
    return connection.call(requestType, requestData);
  }

  async function captureProgramScreenshot() {
    const runtime = getObsRuntime();
    const sceneName = runtime.programScene;
    if (!sceneName) throw new Error("No OBS Program scene available");
    const response = await obsCall("GetSourceScreenshot", {
      sourceName: sceneName,
      imageFormat: "jpg",
      imageWidth: SNAPSHOT_MAX_WIDTH,
      imageHeight: Math.round(SNAPSHOT_MAX_WIDTH * 9 / 16),
      imageCompressionQuality: 75,
    });
    const data = response?.imageData || "";
    if (!data) throw new Error("OBS returned an empty Program screenshot");
    return data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;
  }

  async function pollSnapshotOnce() {
    if (snapshotInFlight || !state.active || state.mode !== "snapshot") return;
    snapshotInFlight = true;
    try {
      lastSnapshotDataUrl = await captureProgramScreenshot();
      state.error = "";
      notify();
    } catch (error) {
      state.error = error?.message || "Snapshot Preview failed";
      notify();
    } finally {
      snapshotInFlight = false;
    }
  }

  function startSnapshotPolling() {
    stopSnapshotPolling();
    if (!state.active || state.mode !== "snapshot") return;
    void pollSnapshotOnce();
    snapshotTimer = window.setInterval(() => {
      void pollSnapshotOnce();
    }, SNAPSHOT_INTERVAL_MS);
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      state.devices = [];
      state.error = "Camera enumeration is not supported in this environment.";
      notify();
      return state.devices;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.devices = devices.filter((device) => device.kind === "videoinput");
      if (!state.deviceId) {
        const obsCam = findObsVirtualCamera(state.devices);
        if (obsCam) {
          state.deviceId = obsCam.deviceId;
          state.deviceLabel = obsCam.label || "OBS Virtual Camera";
          savePrefs();
        }
      }
      notify();
      return state.devices;
    } catch (error) {
      state.error = error?.message || "Failed to list video devices";
      notify();
      return [];
    }
  }

  function buildVideoConstraints(deviceId) {
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }
    return constraints;
  }

  function attachStreamToVideo(videoEl) {
    if (!videoEl || !mediaStream) return;
    videoEl.srcObject = mediaStream;
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "");
    const playPromise = videoEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
    const track = mediaStream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings ? track.getSettings() : {};
      state.videoWidth = settings.width || videoEl.videoWidth || 0;
      state.videoHeight = settings.height || videoEl.videoHeight || 0;
    }
  }

  async function startVideoMonitor(deviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera access is not supported in this browser.");
    }
    stopSnapshotPolling();
    releaseStream();
    const constraints = buildVideoConstraints(deviceId);
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      state.permission = "granted";
      state.mode = "video";
      state.active = true;
      state.error = "";
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings ? track.getSettings() : {};
        state.videoWidth = settings.width || 0;
        state.videoHeight = settings.height || 0;
        const match = state.devices.find((device) => device.deviceId === track.getSettings?.().deviceId);
        if (match) {
          state.deviceId = match.deviceId;
          state.deviceLabel = match.label || state.deviceLabel;
          savePrefs();
        }
      }
      notify();
      return mediaStream;
    } catch (error) {
      releaseStream();
      const name = error?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        state.permission = "denied";
        throw new Error("Camera permission denied. Allow camera access in system settings, then click Start Monitor again.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Error("Selected monitor source was not found. Refresh devices or choose another source.");
      }
      throw new Error(error?.message || "Failed to start monitor video");
    }
  }

  async function startSnapshotMonitor() {
    releaseStream();
    state.mode = "snapshot";
    state.active = true;
    state.error = "";
    notify();
    startSnapshotPolling();
  }

  async function startMonitor(options) {
    if (state.active) await stopMonitor();
    const opts = options || {};
    if (opts.layout) {
      state.layout = opts.layout;
      savePrefs();
    }
    await refreshDevices();
    const deviceId = opts.deviceId || state.deviceId;
    const obsCam = findObsVirtualCamera(state.devices);
    const runtime = getObsRuntime();
    const tryVideo = opts.forceSnapshot !== true;

    if (tryVideo && deviceId) {
      try {
        await startVideoMonitor(deviceId);
        return { mode: "video" };
      } catch (error) {
        if (!opts.allowSnapshotFallback) throw error;
        state.error = `${error.message} Falling back to Snapshot Preview.`;
      }
    } else if (tryVideo && obsCam && runtime.virtualCamera) {
      try {
        await startVideoMonitor(obsCam.deviceId);
        return { mode: "video" };
      } catch (error) {
        if (!opts.allowSnapshotFallback) throw error;
        state.error = `${error.message} Falling back to Snapshot Preview.`;
      }
    } else if (tryVideo && !deviceId && !obsCam) {
      if (isObsConnected() && runtime.virtualCamera) {
        state.error = "OBS Virtual Camera was not found. Start Virtual Camera in OBS, refresh video devices, or use Snapshot Preview.";
      } else if (isObsConnected()) {
        state.error = "OBS Virtual Camera is not running. Click Start Virtual Camera or use Snapshot Preview.";
      }
      if (!opts.allowSnapshotFallback) {
        notify();
        throw new Error(state.error || "No monitor source available");
      }
    }

    if (!isObsConnected()) {
      throw new Error("OBS is disconnected. Reconnect OBS to use Snapshot Preview.");
    }
    await startSnapshotMonitor();
    return { mode: "snapshot" };
  }

  async function stopMonitor() {
    stopSnapshotPolling();
    releaseStream();
    state.active = false;
    state.mode = "stopped";
    state.error = "";
    lastSnapshotDataUrl = "";
    notify();
  }

  function setLayout(layout) {
    if (!["compact", "large", "side-by-side"].includes(layout)) return;
    state.layout = layout;
    savePrefs();
    notify();
  }

  function setDevice(deviceId, deviceLabel) {
    state.deviceId = String(deviceId || "");
    state.deviceLabel = String(deviceLabel || "");
    savePrefs();
    notify();
  }

  function setViewerReturnUrl(url) {
    state.viewerReturnUrl = String(url || "").slice(0, 500);
    savePrefs();
    notify();
  }

  function setDetached(detached) {
    state.detached = Boolean(detached);
    notify();
  }

  function getPublicState() {
    const connection = getConnection();
    const status = connection ? connection.getStatus() : {};
    const runtime = status.obsRuntime || {};
    return {
      ...state,
      obsConnected: Boolean(status.connected),
      obsState: status.state || "disabled",
      reconnecting: isReconnecting(),
      programScene: runtime.programScene || "",
      previewScene: runtime.previewScene || "",
      streaming: Boolean(runtime.streaming),
      recording: Boolean(runtime.recording),
      virtualCamera: Boolean(runtime.virtualCamera),
      studioMode: Boolean(runtime.studioMode),
      streamDuration: getStreamDurationLabel(),
      snapshotDataUrl: state.mode === "snapshot" ? lastSnapshotDataUrl : "",
      monitorSource: state.mode === "video"
        ? (state.deviceLabel || "Video device")
        : (state.mode === "snapshot" ? "Snapshot Preview" : "—"),
      monitorResolution: state.videoWidth && state.videoHeight
        ? `${state.videoWidth}×${state.videoHeight}`
        : (state.mode === "snapshot" ? `${SNAPSHOT_MAX_WIDTH}×${Math.round(SNAPSHOT_MAX_WIDTH * 9 / 16)}` : "—"),
    };
  }

  function bindVideoElement(videoEl) {
    if (!videoEl) return;
    if (state.mode === "video" && mediaStream) {
      attachStreamToVideo(videoEl);
    } else {
      videoEl.srcObject = null;
    }
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function onObsRuntimeEvent() {
    const runtime = getObsRuntime();
    if (!runtime.streaming) streamStartedAt = null;
    if (state.active && state.mode === "snapshot" && !snapshotTimer) {
      startSnapshotPolling();
    }
    notify();
  }

  function init() {
    loadPrefs();
    if (window.CISObsEventService) {
      window.CISObsEventService.subscribe(onObsRuntimeEvent);
    }
  }

  window.CISObsProgramMonitor = {
    VCAM_PATTERNS,
    SNAPSHOT_INTERVAL_MS,
    isObsVirtualCamera,
    findObsVirtualCamera,
    getWorshipOutputLabels,
    refreshDevices,
    startMonitor,
    stopMonitor,
    setLayout,
    setDevice,
    setViewerReturnUrl,
    setDetached,
    getState: getPublicState,
    bindVideoElement,
    subscribe,
    init,
  };

  init();
})();
