(function () {
  "use strict";

  let lastSceneList = [];
  let loading = false;
  let lastError = "";

  function getSceneFunctions() {
    return window.CISObsConstants ? window.CISObsConstants.SCENE_FUNCTIONS : [];
  }

  function getSettings() {
    return window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { sceneMappings: {} };
  }

  function saveSceneMapping(functionKey, sceneName) {
    const store = window.CISObsSettingsStore;
    if (!store) return null;
    const settings = store.loadSettings();
    const nextMappings = { ...settings.sceneMappings };
    if (!sceneName) delete nextMappings[functionKey];
    else nextMappings[functionKey] = sceneName;
    return store.saveSettings({ ...settings, sceneMappings: nextMappings });
  }

  function getMappedScene(functionKey) {
    const settings = getSettings();
    return settings.sceneMappings[functionKey] || "";
  }

  function validateMappings() {
    const settings = getSettings();
    const sceneNames = new Set(lastSceneList.map((scene) => scene.name));
    const warnings = [];
    Object.entries(settings.sceneMappings || {}).forEach(([key, sceneName]) => {
      if (!sceneName) return;
      if (!sceneNames.has(sceneName)) {
        const label = getSceneFunctions().find((item) => item.key === key)?.label || key;
        warnings.push({ key, label, sceneName, message: `Mapped scene "${sceneName}" for ${label} was not found in OBS.` });
      }
    });
    return warnings;
  }

  function getMissingMappings() {
    const settings = getSettings();
    return getSceneFunctions()
      .filter((fn) => !settings.sceneMappings[fn.key])
      .map((fn) => fn.label);
  }

  async function fetchSceneList() {
    if (!window.CISObsConnectionService) {
      throw new Error("OBS connection service unavailable");
    }
    const status = window.CISObsConnectionService.getStatus();
    if (!status.connected) {
      throw new Error("OBS is not connected");
    }
    loading = true;
    lastError = "";
    try {
      const response = await window.CISObsConnectionService.call("GetSceneList");
      lastSceneList = Array.isArray(response?.scenes)
        ? response.scenes.map((scene) => ({
          name: scene.sceneName || scene.name || "",
          index: scene.sceneIndex,
        })).filter((scene) => scene.name)
        : [];
      if (window.CISObsEventService) {
        window.CISObsEventService.emit("sceneListRefreshed", { count: lastSceneList.length });
      }
      return lastSceneList;
    } catch (error) {
      lastError = error && error.message ? error.message : "Failed to load OBS scenes";
      throw error;
    } finally {
      loading = false;
    }
  }

  async function setProgramScene(sceneName, options) {
    if (!sceneName) return null;
    const connection = window.CISObsConnectionService;
    if (!connection || !connection.getStatus().connected) {
      throw new Error("OBS is not connected");
    }
    const settings = getSettings();
    const runtime = connection.getStatus().obsRuntime || {};
    if (settings.sceneChangePerContent === false && !options?.force) return null;

    if (runtime.studioMode) {
      await connection.call("SetCurrentPreviewScene", { sceneName });
      if (options?.transitionNow) {
        await connection.call("TriggerStudioModeTransition");
      }
      if (window.CISObsEventService) {
        window.CISObsEventService.emit("obsPreviewSceneSet", { sceneName });
      }
      return { mode: "studio_preview", sceneName };
    }

    await connection.call("SetCurrentProgramScene", { sceneName });
    if (window.CISObsEventService) {
      window.CISObsEventService.emit("obsProgramSceneSet", { sceneName });
    }
    return { mode: "program", sceneName };
  }

  async function applySceneForContent(contentType, options) {
    const constants = window.CISObsConstants;
    if (!constants) return null;
    const sceneKey = constants.CONTENT_TO_SCENE_KEY[contentType];
    if (!sceneKey) return null;
    const settings = getSettings();
    if (settings.autoSceneOnLive && settings.autoSceneOnLive[contentType] === false) return null;
    const sceneName = settings.sceneMappings[sceneKey];
    if (!sceneName) return null;
    return setProgramScene(sceneName, options);
  }

  async function transitionToScene(sceneName, transitionName, durationMs) {
    const connection = window.CISObsConnectionService;
    if (!connection || !connection.getStatus().connected) throw new Error("OBS is not connected");
    if (transitionName) {
      await connection.call("SetCurrentSceneTransition", { transitionName });
    }
    if (durationMs) {
      await connection.call("SetCurrentSceneTransitionDuration", { transitionDuration: durationMs });
    }
    return setProgramScene(sceneName, { transitionNow: true });
  }

  function getSceneList() {
    return lastSceneList.slice();
  }

  function isLoading() {
    return loading;
  }

  function getLastError() {
    return lastError;
  }

  window.CISObsSceneService = {
    fetchSceneList,
    getSceneList,
    isLoading,
    getLastError,
    saveSceneMapping,
    getMappedScene,
    validateMappings,
    getMissingMappings,
    setProgramScene,
    applySceneForContent,
    transitionToScene,
    getSceneFunctions,
  };
})();
