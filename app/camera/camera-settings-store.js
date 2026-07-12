(function () {
  "use strict";

  const STORAGE_KEY = "cis-va-chinoda:cameraSources";
  const SETTINGS_KEY = "cis-va-chinoda:cameraSettings";

  function defaultSavedCamera(overrides) {
    const now = Date.now();
    return {
      id: overrides?.id || `cam-${now}`,
      name: overrides?.name || "New Camera",
      role: overrides?.role || "main",
      deviceLabel: overrides?.deviceLabel || "",
      preferredDeviceId: overrides?.preferredDeviceId || "",
      backupCameraId: overrides?.backupCameraId || "",
      layout: overrides?.layout || "fullscreen",
      destinations: Array.isArray(overrides?.destinations) ? overrides.destinations.slice() : ["main", "secondary"],
      transition: overrides?.transition || "cut",
      audioMode: overrides?.audioMode || "video-only",
      fallbackAction: overrides?.fallbackAction || "logo",
      lastUsedAt: overrides?.lastUsedAt || 0,
      createdAt: overrides?.createdAt || now,
    };
  }

  function loadSavedCameras() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => defaultSavedCamera(item));
    } catch (_error) {
      return [];
    }
  }

  function saveSavedCameras(cameras) {
    try {
      const minimal = (cameras || []).map((cam) => ({
        id: cam.id,
        name: cam.name,
        role: cam.role,
        deviceLabel: cam.deviceLabel || "",
        preferredDeviceId: cam.preferredDeviceId || "",
        backupCameraId: cam.backupCameraId || "",
        layout: cam.layout || "fullscreen",
        destinations: cam.destinations || ["main"],
        transition: cam.transition || "cut",
        audioMode: cam.audioMode || "video-only",
        fallbackAction: cam.fallbackAction || "logo",
        lastUsedAt: cam.lastUsedAt || 0,
        createdAt: cam.createdAt || Date.now(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function loadSettings() {
    const defaults = window.CISCameraConstants
      ? { ...window.CISCameraConstants.DEFAULT_SETTINGS }
      : {};
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch (_error) {
      return defaults;
    }
  }

  function saveSettings(settings) {
    try {
      const current = loadSettings();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
      return true;
    } catch (_error) {
      return false;
    }
  }

  window.CISCameraSettingsStore = {
    STORAGE_KEY,
    SETTINGS_KEY,
    defaultSavedCamera,
    loadSavedCameras,
    saveSavedCameras,
    loadSettings,
    saveSettings,
  };
})();
