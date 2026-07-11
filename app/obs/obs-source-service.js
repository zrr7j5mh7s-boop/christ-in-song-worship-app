(function () {
  "use strict";

  let lastInputs = [];
  let lastSceneItems = [];
  let loading = false;
  let lastError = "";

  function getSourceFunctions() {
    return window.CISObsConstants ? window.CISObsConstants.SOURCE_FUNCTIONS : [];
  }

  function getSettings() {
    return window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { sourceMappings: {} };
  }

  function saveSourceMapping(functionKey, mapping) {
    const store = window.CISObsSettingsStore;
    if (!store) return null;
    const settings = store.loadSettings();
    const nextMappings = { ...settings.sourceMappings };
    if (!mapping || (!mapping.sourceName && !mapping.sceneItemId)) {
      delete nextMappings[functionKey];
    } else {
      nextMappings[functionKey] = {
        sourceName: String(mapping.sourceName || "").trim(),
        sceneName: String(mapping.sceneName || "").trim(),
        sceneItemId: mapping.sceneItemId != null ? Number(mapping.sceneItemId) : null,
        inputUuid: mapping.inputUuid ? String(mapping.inputUuid) : "",
      };
    }
    return store.saveSettings({ ...settings, sourceMappings: nextMappings });
  }

  function getSourceMapping(functionKey) {
    const settings = getSettings();
    return settings.sourceMappings[functionKey] || null;
  }

  async function fetchInputs() {
    const connection = window.CISObsConnectionService;
    if (!connection || !connection.getStatus().connected) {
      throw new Error("OBS is not connected");
    }
    loading = true;
    lastError = "";
    try {
      const response = await connection.call("GetInputList");
      lastInputs = Array.isArray(response?.inputs)
        ? response.inputs.map((input) => ({
          name: input.inputName || "",
          kind: input.inputKind || input.unversionedInputKind || "",
          uuid: input.inputUuid || "",
        })).filter((input) => input.name)
        : [];
      return lastInputs;
    } catch (error) {
      lastError = error?.message || "Failed to load OBS inputs";
      throw error;
    } finally {
      loading = false;
    }
  }

  async function fetchSceneItems(sceneName) {
    const connection = window.CISObsConnectionService;
    if (!connection || !connection.getStatus().connected) {
      throw new Error("OBS is not connected");
    }
    if (!sceneName) return [];
    loading = true;
    lastError = "";
    try {
      const response = await connection.call("GetSceneItemList", { sceneName });
      lastSceneItems = Array.isArray(response?.sceneItems)
        ? response.sceneItems.map((item) => ({
          id: item.sceneItemId,
          sourceName: item.sourceName || "",
          sceneName,
          enabled: item.sceneItemEnabled !== false,
        }))
        : [];
      return lastSceneItems;
    } catch (error) {
      lastError = error?.message || "Failed to load scene items";
      throw error;
    } finally {
      loading = false;
    }
  }

  function validateMappings() {
    const settings = getSettings();
    const inputNames = new Set(lastInputs.map((input) => input.name));
    const warnings = [];
    Object.entries(settings.sourceMappings || {}).forEach(([key, mapping]) => {
      if (!mapping || !mapping.sourceName) return;
      if (!inputNames.has(mapping.sourceName)) {
        const label = getSourceFunctions().find((item) => item.key === key)?.label || key;
        warnings.push({
          key,
          label,
          sourceName: mapping.sourceName,
          message: `Mapped source "${mapping.sourceName}" for ${label} was not found in OBS.`,
        });
      }
    });
    return warnings;
  }

  async function setSourceVisibility(functionKey, visible) {
    const mapping = getSourceMapping(functionKey);
    if (!mapping || !mapping.sceneName) return null;
    const connection = window.CISObsConnectionService;
    if (!connection || !connection.getStatus().connected) return null;

    const request = {
      sceneName: mapping.sceneName,
      sceneItemEnabled: Boolean(visible),
    };
    if (mapping.sceneItemId != null) request.sceneItemId = mapping.sceneItemId;
    else if (mapping.sourceName) request.sourceName = mapping.sourceName;
    else return null;

    await connection.call("SetSceneItemEnabled", request);
    if (window.CISObsEventService) {
      window.CISObsEventService.emit(visible ? "sourceShown" : "sourceHidden", {
        functionKey,
        ...mapping,
      });
    }
    return mapping;
  }

  async function showSource(functionKey) {
    return setSourceVisibility(functionKey, true);
  }

  async function hideSource(functionKey) {
    return setSourceVisibility(functionKey, false);
  }

  async function clearWorshipOverlays() {
    const constants = window.CISObsConstants;
    const overlayKeys = constants
      ? ["scripture_browser", "hymn_browser", "lower_third_browser", "sermon_title_browser", "announcement_browser"]
      : [];
    const results = [];
    for (let i = 0; i < overlayKeys.length; i += 1) {
      try {
        const result = await hideSource(overlayKeys[i]);
        if (result) results.push(overlayKeys[i]);
      } catch (error) {}
    }
    return results;
  }

  function getInputs() {
    return lastInputs.slice();
  }

  function getSceneItems() {
    return lastSceneItems.slice();
  }

  function isLoading() {
    return loading;
  }

  function getLastError() {
    return lastError;
  }

  window.CISObsSourceService = {
    fetchInputs,
    fetchSceneItems,
    getInputs,
    getSceneItems,
    isLoading,
    getLastError,
    saveSourceMapping,
    getSourceMapping,
    validateMappings,
    setSourceVisibility,
    showSource,
    hideSource,
    clearWorshipOverlays,
    getSourceFunctions,
  };
})();
