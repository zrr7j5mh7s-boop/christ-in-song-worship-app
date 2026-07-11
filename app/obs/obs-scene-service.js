(function () {
  "use strict";

  let lastSceneList = [];
  let loading = false;
  let lastError = "";

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
      return lastSceneList;
    } catch (error) {
      lastError = error && error.message ? error.message : "Failed to load OBS scenes";
      throw error;
    } finally {
      loading = false;
    }
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

  function renderMappingSkeleton() {
    const scenes = getSceneList();
    const rows = scenes.length
      ? scenes.map((scene) => `
          <div class="obs-scene-row">
            <strong>${scene.name}</strong>
            <span class="muted">Unmapped (Phase 2)</span>
          </div>
        `).join("")
      : `<p class="muted">Connect to OBS and refresh to load scenes for worship mapping.</p>`;

    return `
      <section class="section obs-scene-panel">
        <div class="section-heading-row">
          <h3>Scene Mapping</h3>
          <button class="secondary-button" type="button" data-command="obs-refresh-scenes">Refresh Scenes</button>
        </div>
        <p class="muted">Map worship outputs (Live Camera, Scripture, Hymn, Lower Third) to OBS scenes in Phase 2.</p>
        <div class="obs-scene-list">${rows}</div>
      </section>
    `;
  }

  window.CISObsSceneService = {
    fetchSceneList,
    getSceneList,
    isLoading,
    getLastError,
    renderMappingSkeleton,
  };
})();
