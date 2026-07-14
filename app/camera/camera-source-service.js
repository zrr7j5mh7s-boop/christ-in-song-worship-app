(function () {
  "use strict";

  const listeners = new Set();
  const streamRegistry = new Map();
  let devices = [];
  let permission = "unknown";
  let adapters = {};

  function hasLyricLiveContent() {
    if (typeof adapters.hasLyricLiveContent === "function") {
      return adapters.hasLyricLiveContent();
    }
    return false;
  }

  function shouldAutoLogoOnCameraFailure() {
    return settings.showLogoOnFailure && !hasLyricLiveContent();
  }
  let error = "";
  let savedCameras = [];
  let settings = {};
  let preview = { active: false, cameraId: "", status: "idle", error: "" };
  let live = {
    active: false,
    cameraId: "",
    cameraName: "",
    deviceLabel: "",
    layout: "fullscreen",
    destinations: ["main", "secondary"],
    outputScope: "mirrored-all",
    frozen: false,
    hidden: false,
    transition: "cut",
    status: "idle",
    error: "",
    width: 0,
    height: 0,
    frameRate: 0,
    audioMode: "video-only",
  };
  let previousLive = null;
  let preparingCameraId = "";
  let deviceMonitorBound = false;
  let recursionWarningAcknowledged = false;

  function notify() {
    const pub = getPublicState();
    listeners.forEach((fn) => {
      try { fn(pub); } catch (_error) {}
    });
    return pub;
  }

  function getConstants() {
    return window.CISCameraConstants || {};
  }

  function getStore() {
    return window.CISCameraSettingsStore || null;
  }

  function loadAll() {
    const store = getStore();
    if (store) {
      savedCameras = store.loadSavedCameras();
      settings = store.loadSettings();
    }
  }

  function persistCameras() {
    const store = getStore();
    if (store) store.saveSavedCameras(savedCameras);
  }

  function persistSettings(patch) {
    const store = getStore();
    if (store) {
      settings = { ...settings, ...patch };
      store.saveSettings(settings);
    }
  }

  function classifyLabel(label) {
    const constants = getConstants();
    return constants.classifyDevice ? constants.classifyDevice(label) : { id: "unknown", label: label || "Camera", type: "physical" };
  }

  function matchDevice(savedCam, deviceList) {
    const list = deviceList || devices;
    if (!savedCam) return null;
    const label = String(savedCam.deviceLabel || "").trim().toLowerCase();
    if (label) {
      const byLabel = list.find((device) => String(device.label || "").trim().toLowerCase() === label);
      if (byLabel) return byLabel;
      const fuzzy = list.find((device) => {
        const dl = String(device.label || "").trim().toLowerCase();
        return dl && (dl.includes(label) || label.includes(dl));
      });
      if (fuzzy) return fuzzy;
    }
    if (savedCam.preferredDeviceId) {
      const byId = list.find((device) => device.deviceId === savedCam.preferredDeviceId);
      if (byId) return byId;
    }
    return null;
  }

  function getSavedCamera(id) {
    return savedCameras.find((cam) => cam.id === id) || null;
  }

  function getDefaultCamera() {
    if (settings.defaultCameraId) {
      const cam = getSavedCamera(settings.defaultCameraId);
      if (cam) return cam;
    }
    return savedCameras[0] || null;
  }

  function getBackupCamera() {
    if (settings.backupCameraId) {
      return getSavedCamera(settings.backupCameraId);
    }
    return savedCameras.find((cam) => cam.role === "backup") || null;
  }

  function streamKey(deviceId, label) {
    return deviceId || `label:${String(label || "").toLowerCase()}`;
  }

  function acquireStream(device, options) {
    const opts = options || {};
    const key = streamKey(device.deviceId, device.label);
    const existing = streamRegistry.get(key);
    if (existing && existing.stream && existing.stream.active) {
      existing.refCount += 1;
      if (opts.purpose === "preview") existing.previewRef += 1;
      if (opts.purpose === "live") existing.liveRef += 1;
      return Promise.resolve(existing.stream);
    }
    if (existing && existing.promise) return existing.promise;

    const entry = { refCount: 0, previewRef: 0, liveRef: 0, stream: null, promise: null };
    streamRegistry.set(key, entry);

    const constraints = {
      video: {
        width: { ideal: settings.preferredWidth || 1280 },
        height: { ideal: settings.preferredHeight || 720 },
        frameRate: { ideal: settings.preferredFrameRate || 30 },
      },
      audio: opts.audio === true && settings.audioDisabledByDefault !== true,
    };
    if (device.deviceId) {
      constraints.video.deviceId = { exact: device.deviceId };
    }

    entry.promise = navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        entry.stream = stream;
        entry.refCount = 1;
        if (opts.purpose === "preview") entry.previewRef = 1;
        if (opts.purpose === "live") entry.liveRef = 1;
        entry.promise = null;
        const track = stream.getVideoTracks()[0];
        if (track) {
          track.addEventListener("ended", () => {
            handleTrackEnded(key, savedCameras.find((c) => matchDevice(c, devices)?.deviceId === device.deviceId));
          });
        }
        return stream;
      })
      .catch((err) => {
        streamRegistry.delete(key);
        throw err;
      });

    return entry.promise;
  }

  function releaseStream(deviceId, label, purpose) {
    const key = streamKey(deviceId, label);
    const entry = streamRegistry.get(key);
    if (!entry) return;
    if (purpose === "preview" && entry.previewRef > 0) entry.previewRef -= 1;
    if (purpose === "live" && entry.liveRef > 0) entry.liveRef -= 1;
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.previewRef <= 0 && entry.liveRef <= 0 && entry.refCount <= 0) {
      if (entry.stream) {
        entry.stream.getTracks().forEach((track) => {
          try { track.stop(); } catch (_error) {}
        });
      }
      streamRegistry.delete(key);
    }
  }

  function releaseAllStreams() {
    for (const [key, entry] of streamRegistry.entries()) {
      if (entry.stream) {
        entry.stream.getTracks().forEach((track) => {
          try { track.stop(); } catch (_error) {}
        });
      }
      streamRegistry.delete(key);
    }
  }

  function getActiveStreamCount() {
    let count = 0;
    for (const entry of streamRegistry.values()) {
      if (entry.stream && entry.stream.active) count += 1;
    }
    return count;
  }

  function shutdownCleanup() {
    stopPreview();
    if (live.active) clearCamera();
    releaseAllStreams();
  }

  function getLiveStream() {
    for (const entry of streamRegistry.values()) {
      if (entry.liveRef > 0 && entry.stream) return entry.stream;
    }
    return null;
  }

  function getPreviewStream() {
    for (const entry of streamRegistry.values()) {
      if (entry.previewRef > 0 && entry.stream) return entry.stream;
    }
    return null;
  }

  function mapPermissionError(err) {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      permission = "denied";
      return "Camera access was denied. Allow camera access in system settings and try again.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "The selected camera was not found. Refresh Devices or choose another source.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "This camera may already be in use by another application.";
    }
    return err?.message || "Video stream failed.";
  }

  function cameraStatusFor(savedCam) {
    const device = matchDevice(savedCam, devices);
    if (!device || !device.label) {
      const hint = classifyLabel(savedCam.deviceLabel);
      return {
        connected: false,
        available: devices.length > 0,
        status: "unavailable",
        deviceType: hint.type,
        guidance: hint.guidance || "Select Refresh Devices after connecting the camera.",
      };
    }
    const hint = classifyLabel(device.label);
    return {
      connected: true,
      available: true,
      status: "connected",
      deviceType: hint.type,
      deviceId: device.deviceId,
      deviceLabel: device.label,
      guidance: "",
    };
  }

  async function refreshDevices(requestPermission) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      error = "Camera enumeration is not supported in this environment.";
      notify();
      return [];
    }
    if (requestPermission && navigator.mediaDevices.getUserMedia) {
      try {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        temp.getTracks().forEach((track) => track.stop());
        permission = "granted";
      } catch (err) {
        permission = "denied";
        error = mapPermissionError(err);
        notify();
        return [];
      }
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      devices = all.filter((device) => device.kind === "videoinput");
      error = "";
      bindDeviceMonitor();
      notify();
      return devices;
    } catch (err) {
      error = err?.message || "Failed to list video devices";
      notify();
      return [];
    }
  }

  function bindDeviceMonitor() {
    if (deviceMonitorBound || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener("devicechange", () => {
      void refreshDevices(false);
    });
    deviceMonitorBound = true;
  }

  function addCamera(overrides) {
    const store = getStore();
    const cam = store ? store.defaultSavedCamera(overrides) : { id: `cam-${Date.now()}`, name: "Camera", role: "main" };
    savedCameras.push(cam);
    persistCameras();
    notify();
    return cam;
  }

  function updateCamera(id, patch) {
    const index = savedCameras.findIndex((cam) => cam.id === id);
    if (index < 0) return null;
    savedCameras[index] = { ...savedCameras[index], ...patch };
    persistCameras();
    notify();
    return savedCameras[index];
  }

  function removeCamera(id) {
    savedCameras = savedCameras.filter((cam) => cam.id !== id);
    if (settings.defaultCameraId === id) persistSettings({ defaultCameraId: "" });
    if (settings.backupCameraId === id) persistSettings({ backupCameraId: "" });
    persistCameras();
    notify();
  }

  function setDefaultCamera(id) {
    persistSettings({ defaultCameraId: id });
    notify();
  }

  function setBackupCamera(id) {
    persistSettings({ backupCameraId: id });
    notify();
  }

  async function startPreview(cameraId) {
    const savedCam = getSavedCamera(cameraId) || getDefaultCamera();
    if (!savedCam) throw new Error("No saved camera configuration. Add a camera first.");
    await refreshDevices(true);
    const device = matchDevice(savedCam, devices);
    if (!device) {
      const hint = classifyLabel(savedCam.deviceLabel);
      throw new Error(hint.guidance || "The selected virtual camera is not available. Open its desktop application, then refresh the camera list.");
    }
    if (preview.active && preview.cameraId === savedCam.id) return;
    await stopPreview();
    preview = { active: true, cameraId: savedCam.id, status: "loading", error: "" };
    notify();
    try {
      const stream = await acquireStream(device, { purpose: "preview", audio: false });
      const track = stream.getVideoTracks()[0];
      const trackSettings = track?.getSettings?.() || {};
      preview = {
        active: true,
        cameraId: savedCam.id,
        status: "connected",
        error: "",
        deviceLabel: device.label,
        width: trackSettings.width || 0,
        height: trackSettings.height || 0,
        frameRate: trackSettings.frameRate || 0,
      };
      savedCam.lastUsedAt = Date.now();
      savedCam.deviceLabel = device.label;
      savedCam.preferredDeviceId = device.deviceId;
      persistCameras();
      notify();
      return stream;
    } catch (err) {
      preview = { active: false, cameraId: "", status: "error", error: mapPermissionError(err) };
      notify();
      throw new Error(preview.error);
    }
  }

  async function stopPreview() {
    if (!preview.active) return;
    const savedCam = getSavedCamera(preview.cameraId);
    const device = savedCam ? matchDevice(savedCam, devices) : null;
    if (device) releaseStream(device.deviceId, device.label, "preview");
    preview = { active: false, cameraId: "", status: "idle", error: "" };
    notify();
  }

  function wouldCauseObsRecursion(savedCam, destinations) {
    if (!savedCam) return false;
    const hint = classifyLabel(savedCam.deviceLabel);
    const isObsVcam = hint.id === "obs-virtual";
    if (!isObsVcam) return false;
    const dests = destinations || live.destinations || [];
    const obsDest = dests.includes("obs") || live.outputScope === "obs";
    const obsSettings = window.CISObsSettingsStore?.loadSettings?.() || {};
    const obsTarget = obsSettings.outputTarget || "";
    const sendsToObs = obsDest || obsTarget === "obs" || obsTarget === "both";
    return sendsToObs;
  }

  function checkRecursion(savedCam, destinations) {
    if (!settings.warnObsRecursion) return { blocked: false };
    if (!wouldCauseObsRecursion(savedCam, destinations)) return { blocked: false };
    if (recursionWarningAcknowledged) return { blocked: false };
    return {
      blocked: true,
      message: "OBS Virtual Camera is already based on an OBS output. Sending it back to OBS may create a recursive video loop. Use it for local presentation only, or select a different camera source.",
    };
  }

  function acknowledgeRecursionWarning() {
    recursionWarningAcknowledged = true;
  }

  async function prepareCameraStream(savedCam) {
    const device = matchDevice(savedCam, devices);
    if (!device) return null;
    preparingCameraId = savedCam.id;
    try {
      return await acquireStream(device, { purpose: "live", audio: live.audioMode === "camera-mic" });
    } finally {
      preparingCameraId = "";
    }
  }

  async function sendCameraLive(options) {
    const opts = options || {};
    const savedCam = getSavedCamera(opts.cameraId) || getDefaultCamera();
    if (!savedCam) throw new Error("No camera configured. Add a camera in Camera Sources.");

    const recursion = checkRecursion(savedCam, opts.destinations);
    if (recursion.blocked && !opts.force) {
      const err = new Error(recursion.message);
      err.code = "RECURSION_WARNING";
      throw err;
    }

    await refreshDevices(!opts.skipPermission);
    const device = matchDevice(savedCam, devices);
    if (!device) {
      const hint = classifyLabel(savedCam.deviceLabel);
      if (settings.showLogoOnFailure && opts.allowFallback !== false && shouldAutoLogoOnCameraFailure()) {
        return fallbackToLogo(hint.guidance);
      }
      throw new Error(hint.guidance || "Camera not found.");
    }

    if (settings.prepareNextCamera && live.active && live.cameraId !== savedCam.id) {
      await prepareCameraStream(savedCam);
    }

    previousLive = live.active ? { ...live } : previousLive;

    live = {
      ...live,
      active: true,
      cameraId: savedCam.id,
      cameraName: savedCam.name,
      deviceLabel: device.label,
      layout: opts.layout || savedCam.layout || settings.defaultLayout,
      destinations: opts.destinations || savedCam.destinations || settings.defaultDestinations,
      outputScope: opts.outputScope || settings.defaultOutputGroup || "mirrored-all",
      transition: opts.transition || savedCam.transition || settings.defaultTransition,
      audioMode: opts.audioMode || savedCam.audioMode || "video-only",
      frozen: false,
      hidden: false,
      status: "loading",
      error: "",
    };
    notify();

    try {
      const stream = await acquireStream(device, {
        purpose: "live",
        audio: live.audioMode === "camera-mic",
      });
      const track = stream.getVideoTracks()[0];
      const trackSettings = track?.getSettings?.() || {};
      live.status = "connected";
      live.width = trackSettings.width || 0;
      live.height = trackSettings.height || 0;
      live.frameRate = trackSettings.frameRate || 0;
      savedCam.lastUsedAt = Date.now();
      savedCam.deviceLabel = device.label;
      savedCam.preferredDeviceId = device.deviceId;
      persistCameras();
      notify();
      return stream;
    } catch (err) {
      live.status = "error";
      live.error = mapPermissionError(err);
      notify();
      if (shouldAutoLogoOnCameraFailure()) return fallbackToLogo(live.error);
      live.active = false;
      throw new Error(live.error);
    }
  }

  function fallbackToLogo(reason) {
    live.error = reason || "";
    if (!shouldAutoLogoOnCameraFailure()) {
      return { fallback: "none", reason, preservedLive: true };
    }
    if (window.CISPresenterEngine) {
      window.CISPresenterEngine.setDisplayMode("logo");
    }
    return { fallback: "logo", reason };
  }

  async function switchCamera(cameraId, options) {
    return sendCameraLive({ ...options, cameraId, skipPermission: true });
  }

  async function useBackupCamera(options) {
    const backup = getBackupCamera();
    if (!backup) throw new Error("No backup camera configured.");
    return switchCamera(backup.id, options);
  }

  function returnToPreviousLive() {
    if (!previousLive || !previousLive.active) return false;
    live = { ...previousLive };
    notify();
    return true;
  }

  function clearCamera() {
    if (live.active) {
      const savedCam = getSavedCamera(live.cameraId);
      const device = savedCam ? matchDevice(savedCam, devices) : null;
      if (device) releaseStream(device.deviceId, device.label, "live");
    }
    live = {
      ...live,
      active: false,
      cameraId: "",
      cameraName: "",
      frozen: false,
      hidden: false,
      status: "idle",
      error: "",
    };
    notify();
  }

  function freezeCamera(frozen) {
    live.frozen = frozen !== false;
    notify();
  }

  function hideCamera(hidden) {
    live.hidden = hidden !== false;
    notify();
  }

  async function restartCameraSource() {
    if (!live.active) return startPreview(live.cameraId || settings.defaultCameraId);
    const id = live.cameraId;
    clearCamera();
    return sendCameraLive({ cameraId: id, skipPermission: true });
  }

  function handleTrackEnded(key, savedCam) {
    if (live.active && savedCam && live.cameraId === savedCam.id) {
      live.status = "disconnected";
      live.error = "The selected camera disconnected. Other outputs remain active.";
      setOutputDisconnected("main", live.error);
      notify();
    }
  }

  function setOutputDisconnected(outputId, detail) {
    if (window.CISLiveSwitchService?.setOutputHealth) {
      window.CISLiveSwitchService.setOutputHealth(outputId, "disconnected", detail);
    }
  }

  function getObsVirtualCameraAvailable() {
    return devices.some((device) => {
      const hint = classifyLabel(device.label);
      return hint.id === "obs-virtual";
    });
  }

  function getLocalPresentationStatus() {
    const obsRuntime = window.CISObsConnectionService?.getStatus?.()?.obsRuntime || {};
    const layoutLabel = getConstants().getLayoutLabel?.(live.layout) || live.layout;
    const destLabels = (live.destinations || []).map((id) => {
      const dest = getConstants().OUTPUT_DESTINATIONS?.find((d) => d.id === id);
      return dest ? dest.label : id;
    });
    return {
      active: live.active || preview.active,
      mainProjector: live.active ? `${layoutLabel}` : "—",
      secondaryProjector: live.active && live.destinations.includes("secondary") ? layoutLabel : "—",
      stageDisplay: live.destinations.includes("stage") ? "Stage layout" : "Presenter View",
      camera: live.active ? live.cameraName || live.deviceLabel : (preview.active ? "Preview" : "—"),
      obsVirtualCamera: getObsVirtualCameraAvailable() ? "Available" : "Unavailable",
      internetStreaming: settings.internetStreamingOff ? "Off" : "Off",
      destinations: destLabels.join(", ") || "—",
    };
  }

  function bindVideoElement(videoEl, purpose) {
    if (!videoEl) return;
    const stream = purpose === "live" ? getLiveStream() : getPreviewStream();
    if (stream && !live.hidden && !(purpose === "live" && live.frozen)) {
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      const playPromise = videoEl.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }

  function getPublicState() {
    return {
      devices: devices.slice(),
      permission,
      error,
      savedCameras: savedCameras.map((cam) => ({
        ...cam,
        status: cameraStatusFor(cam),
      })),
      settings: { ...settings },
      preview: { ...preview },
      live: { ...live },
      preparingCameraId,
      localPresentation: getLocalPresentationStatus(),
      obsVirtualCameraAvailable: getObsVirtualCameraAvailable(),
    };
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function init() {
    loadAll();
    bindDeviceMonitor();
    void refreshDevices(false);
  }

  function configure(options) {
    adapters = {
      hasLyricLiveContent: options?.hasLyricLiveContent || null,
    };
  }

  window.CISCameraSourceService = {
    refreshDevices,
    addCamera,
    updateCamera,
    removeCamera,
    setDefaultCamera,
    setBackupCamera,
    getSavedCamera,
    getDefaultCamera,
    getBackupCamera,
    matchDevice,
    classifyLabel,
    cameraStatusFor,
    startPreview,
    stopPreview,
    sendCameraLive,
    switchCamera,
    useBackupCamera,
    returnToPreviousLive,
    clearCamera,
    freezeCamera,
    hideCamera,
    restartCameraSource,
    checkRecursion,
    acknowledgeRecursionWarning,
    wouldCauseObsRecursion,
    bindVideoElement,
    getLiveStream,
    getPreviewStream,
    getActiveStreamCount,
    releaseAllStreams,
    shutdownCleanup,
    getLocalPresentationStatus,
    getState: getPublicState,
    persistSettings,
    subscribe,
    configure,
    init,
  };

  init();
})();
