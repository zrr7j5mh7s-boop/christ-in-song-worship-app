(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function sceneOptions(scenes, selected) {
    const list = Array.isArray(scenes) ? scenes : [];
    const options = ['<option value="">— Unassigned —</option>'];
    list.forEach((scene) => {
      const name = scene.name || scene;
      const active = name === selected ? "selected" : "";
      options.push(`<option value="${escapeHtml(name)}" ${active}>${escapeHtml(name)}</option>`);
    });
    return options.join("");
  }

  function renderSceneMappingPanel(status, settings) {
    const sceneService = window.CISObsSceneService;
    const scenes = sceneService ? sceneService.getSceneList() : [];
    const functions = sceneService ? sceneService.getSceneFunctions() : [];
    const warnings = sceneService && status?.connected ? sceneService.validateMappings() : [];
    const missing = sceneService ? sceneService.getMissingMappings() : [];

    const rows = functions.map((fn) => {
      const mapped = settings.sceneMappings?.[fn.key] || "";
      return `
        <label class="obs-mapping-row">
          <span>${escapeHtml(fn.icon || "")} ${escapeHtml(fn.label)}</span>
          <select data-obs-scene-map="${escapeHtml(fn.key)}">${sceneOptions(scenes, mapped)}</select>
        </label>
      `;
    }).join("");

    const warningHtml = warnings.length
      ? `<div class="obs-warning-list" role="alert">${warnings.map((w) => `<p>${escapeHtml(w.message)}</p>`).join("")}</div>`
      : "";
    const missingHtml = missing.length
      ? `<p class="muted">Unmapped worship functions: ${escapeHtml(missing.slice(0, 6).join(", "))}${missing.length > 6 ? "…" : ""}</p>`
      : "";

    return `
      <section class="section obs-scene-panel">
        <div class="section-heading-row">
          <h3>Scene Mapping</h3>
          <button class="secondary-button" type="button" data-command="obs-refresh-scenes" ${status?.connected ? "" : "disabled"}>Refresh Scenes</button>
        </div>
        <p class="muted">Map worship functions to existing OBS scenes. Mappings are preserved when OBS disconnects.</p>
        ${warningHtml}
        ${missingHtml}
        <div class="obs-mapping-grid">${rows || `<p class="muted">Connect to OBS to load scenes.</p>`}</div>
        <button class="secondary-button" type="button" data-command="obs-save-mappings">Save Mappings</button>
      </section>
    `;
  }

  function sourceOptions(inputs, selected) {
    const list = Array.isArray(inputs) ? inputs : [];
    const options = ['<option value="">— Unassigned —</option>'];
    list.forEach((input) => {
      const active = input.name === selected ? "selected" : "";
      options.push(`<option value="${escapeHtml(input.name)}" ${active}>${escapeHtml(input.name)} (${escapeHtml(input.kind || "source")})</option>`);
    });
    return options.join("");
  }

  function renderSourceMappingPanel(status, settings) {
    const sourceService = window.CISObsSourceService;
    const inputs = sourceService ? sourceService.getInputs() : [];
    const functions = sourceService ? sourceService.getSourceFunctions() : [];
    const warnings = sourceService && status?.connected ? sourceService.validateMappings() : [];
    const scenes = window.CISObsSceneService ? window.CISObsSceneService.getSceneList() : [];

    const rows = functions.map((fn) => {
      const mapping = settings.sourceMappings?.[fn.key] || {};
      const sourceName = mapping.sourceName || "";
      const sceneName = mapping.sceneName || "";
      return `
        <div class="obs-source-row">
          <strong>${escapeHtml(fn.label)}</strong>
          <label class="field compact">
            <span>Source</span>
            <select data-obs-source-name="${escapeHtml(fn.key)}">${sourceOptions(inputs, sourceName)}</select>
          </label>
          <label class="field compact">
            <span>Scene</span>
            <select data-obs-source-scene="${escapeHtml(fn.key)}">${sceneOptions(scenes, sceneName)}</select>
          </label>
          <button class="secondary-button" type="button" data-command="obs-test-source" data-source-key="${escapeHtml(fn.key)}">Test</button>
        </div>
      `;
    }).join("");

    const warningHtml = warnings.length
      ? `<div class="obs-warning-list" role="alert">${warnings.map((w) => `<p>${escapeHtml(w.message)}</p>`).join("")}</div>`
      : "";

    return `
      <section class="section obs-source-panel">
        <div class="section-heading-row">
          <h3>Source Mapping</h3>
          <button class="secondary-button" type="button" data-command="obs-refresh-sources" ${status?.connected ? "" : "disabled"}>Refresh Sources</button>
        </div>
        <p class="muted">Map overlay browser sources and media inputs. Select the scene containing each source.</p>
        ${warningHtml}
        <div class="obs-source-list">${rows || `<p class="muted">Connect to OBS to load inputs.</p>`}</div>
        <button class="secondary-button" type="button" data-command="obs-save-mappings">Save Mappings</button>
      </section>
    `;
  }

  function renderSetupGuide(urls) {
    const routes = window.CISObsConstants?.OVERLAY_ROUTES || [];
    const urlMap = urls || {};
    const rows = routes.map((route) => {
      const url = urlMap[route.key] || `http://127.0.0.1:47823${route.path}`;
      return `
        <div class="obs-url-row">
          <div>
            <strong>${escapeHtml(route.label)}</strong>
            <code class="obs-url">${escapeHtml(url)}</code>
          </div>
          <button class="secondary-button" type="button" data-command="obs-copy-url" data-url="${escapeHtml(url)}">Copy</button>
        </div>
      `;
    }).join("");

    return `
      <section class="section obs-setup-guide">
        <h3>OBS Browser Source URLs</h3>
        <p class="muted">Add Browser Sources in OBS at 1920×1080 with transparency enabled. Desktop app serves these on localhost only.</p>
        <div class="obs-url-list">${rows}</div>
        <details class="obs-guide-details">
          <summary>Recommended OBS scene collection</summary>
          <ol class="obs-scene-guide">
            <li>01 – Live Camera</li>
            <li>02 – Camera + Scripture</li>
            <li>03 – Full-Screen Scripture</li>
            <li>04 – Camera + Hymn Lyrics</li>
            <li>05 – Full-Screen Hymn</li>
            <li>06 – Sermon Title</li>
            <li>07 – Speaker Lower Third</li>
            <li>08 – Video Playback</li>
            <li>09 – Announcements</li>
            <li>10 – Picture-in-Picture</li>
            <li>11 – Offering</li>
            <li>12 – Special Music</li>
            <li>13 – Church Logo</li>
            <li>14 – Holding Screen</li>
            <li>15 – Blank</li>
          </ol>
          <p class="muted">This guide does not modify your OBS scene collection automatically.</p>
        </details>
      </section>
    `;
  }

  function readSceneMappingsFromDom(root) {
    const scope = root || document;
    const mappings = {};
    scope.querySelectorAll("[data-obs-scene-map]").forEach((select) => {
      const key = select.dataset.obsSceneMap;
      if (!key) return;
      const value = select.value || "";
      if (value) mappings[key] = value;
    });
    return mappings;
  }

  function readSourceMappingsFromDom(root) {
    const scope = root || document;
    const mappings = {};
    scope.querySelectorAll("[data-obs-source-name]").forEach((select) => {
      const key = select.dataset.obsSourceName;
      if (!key) return;
      const sourceName = select.value || "";
      const sceneSelect = scope.querySelector(`[data-obs-source-scene="${key}"]`);
      const sceneName = sceneSelect ? sceneSelect.value : "";
      if (sourceName) {
        mappings[key] = { sourceName, sceneName };
      }
    });
    return mappings;
  }

  window.CISObsMappingUI = {
    configure,
    renderSceneMappingPanel,
    renderSourceMappingPanel,
    renderSetupGuide,
    readSceneMappingsFromDom,
    readSourceMappingsFromDom,
  };
})();
