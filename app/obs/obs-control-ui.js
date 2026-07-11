(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let helpTrigger = () => "";

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.helpTrigger) helpTrigger = options.helpTrigger;
  }

  function formatBool(value) {
    return value ? "On" : "Off";
  }

  function renderCompactStatus(status, liveState, heartbeat) {
    const connection = status?.connected ? "Connected" : (status?.enabled ? "Disconnected" : "Off");
    const runtime = status?.obsRuntime || {};
    const overlays = liveState?.activeOverlays || {};
    const active = [
      overlays.scripture ? "Scripture" : null,
      overlays.hymn ? "Hymn" : null,
      overlays.lowerThird ? "Lower third" : null,
      overlays.sermonTitle ? "Sermon title" : null,
      overlays.announcement ? "Announcement" : null,
    ].filter(Boolean).join(" · ") || "None";

    const browserHealth = heartbeat
      ? Object.entries(heartbeat)
        .filter(([key]) => !["serverAt", "port"].includes(key))
        .filter(([, ts]) => ts && Date.now() - ts < 15000)
        .length
      : 0;

    return `
      <article class="obs-compact-status" aria-label="OBS status">
        <div class="obs-compact-row">
          <span class="obs-compact-label">OBS</span>
          <strong>${escapeHtml(connection)}</strong>
        </div>
        <div class="obs-compact-row" title="OBS Program Scene">
          <span class="obs-compact-label">Program</span>
          <strong>${escapeHtml(runtime.programScene || "—")}</strong>
        </div>
        ${runtime.studioMode ? `
          <div class="obs-compact-row" title="OBS Preview Scene">
            <span class="obs-compact-label">Preview</span>
            <strong>${escapeHtml(runtime.previewScene || "—")}</strong>
          </div>
        ` : ""}
        <div class="obs-compact-row">
          <span class="obs-compact-label">Stream</span>
          <strong>${formatBool(runtime.streaming)}</strong>
        </div>
        <div class="obs-compact-row">
          <span class="obs-compact-label">Record</span>
          <strong>${formatBool(runtime.recording)}</strong>
        </div>
        <div class="obs-compact-row">
          <span class="obs-compact-label">Overlays</span>
          <strong>${escapeHtml(active)}</strong>
        </div>
        <div class="obs-compact-row" title="Browser sources connected in last 15s">
          <span class="obs-compact-label">Browser</span>
          <strong>${browserHealth} live</strong>
        </div>
      </article>
    `;
  }

  function renderControlPanel(status) {
    if (!status?.enabled) return "";
    const runtime = status.obsRuntime || {};
    const scenes = window.CISObsSceneService ? window.CISObsSceneService.getSceneList() : [];
    const sceneOptions = scenes.map((scene) => {
      const selected = scene.name === runtime.programScene ? "selected" : "";
      return `<option value="${escapeHtml(scene.name)}" ${selected}>${escapeHtml(scene.name)}</option>`;
    }).join("");

    return `
      <section class="section obs-control-panel">
        <div class="section-heading-row">
          <h3>OBS Controls</h3>
          <span class="muted">Worship Preview/Live stays separate from OBS Studio Mode.</span>
        </div>
        <div class="obs-control-grid">
          <label class="field compact">
            <span>OBS Program Scene</span>
            <select id="obsProgramSceneSelect">${sceneOptions}</select>
          </label>
          ${runtime.studioMode ? `
            <label class="field compact">
              <span>OBS Preview Scene</span>
              <select id="obsPreviewSceneSelect">${sceneOptions}</select>
            </label>
            <button class="secondary-button" type="button" data-command="obs-studio-transition">Transition</button>
          ` : `
            <button class="secondary-button" type="button" data-command="obs-set-program-scene">Go to Scene</button>
          `}
          <button class="secondary-button" type="button" data-command="obs-toggle-studio">${runtime.studioMode ? "Disable" : "Enable"} Studio Mode</button>
        </div>
        <div class="button-row obs-output-actions">
          <button class="secondary-button" type="button" data-command="obs-start-stream" ${runtime.streaming ? "disabled" : ""}>Start Stream</button>
          <button class="secondary-button" type="button" data-command="obs-stop-stream" ${runtime.streaming ? "" : "disabled"}>Stop Stream</button>
          <button class="secondary-button" type="button" data-command="obs-start-record" ${runtime.recording ? "disabled" : ""}>Start Record</button>
          <button class="secondary-button" type="button" data-command="obs-stop-record" ${runtime.recording ? "" : "disabled"}>Stop Record</button>
          <button class="secondary-button" type="button" data-command="obs-start-vcam" ${runtime.virtualCamera ? "disabled" : ""}>Start Virtual Cam</button>
          <button class="secondary-button" type="button" data-command="obs-stop-vcam" ${runtime.virtualCamera ? "" : "disabled"}>Stop Virtual Cam</button>
          <button class="secondary-button" type="button" data-command="obs-clear-overlays">Clear Worship Overlays${helpTrigger("clear", "Clear overlays")}</button>
        </div>
        <div class="obs-source-toggles">
          <span class="muted">Source visibility</span>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="obs-show-source" data-source-key="scripture_browser">Scripture</button>
            <button class="secondary-button" type="button" data-command="obs-hide-source" data-source-key="scripture_browser">Hide Scripture</button>
            <button class="secondary-button" type="button" data-command="obs-show-source" data-source-key="hymn_browser">Hymn</button>
            <button class="secondary-button" type="button" data-command="obs-hide-source" data-source-key="hymn_browser">Hide Hymn</button>
            <button class="secondary-button" type="button" data-command="obs-show-source" data-source-key="lower_third_browser">Lower Third</button>
            <button class="secondary-button" type="button" data-command="obs-hide-source" data-source-key="lower_third_browser">Hide Lower Third</button>
          </div>
        </div>
      </section>
    `;
  }

  function renderOutputTargetSelector(settings) {
    const targets = [
      { key: "projector", label: "Projector only" },
      { key: "obs", label: "OBS only" },
      { key: "both", label: "Projector + OBS" },
      { key: "stage", label: "Stage only" },
      { key: "all", label: "All outputs" },
    ];
    const current = settings.outputTarget || "projector";
    const options = targets.map((target) => {
      const selected = target.key === current ? "selected" : "";
      return `<option value="${escapeHtml(target.key)}" ${selected}>${escapeHtml(target.label)}</option>`;
    }).join("");
    return `
      <label class="field compact obs-output-target">
        <span>Default worship output</span>
        <select id="obsOutputTarget">${options}</select>
      </label>
    `;
  }

  window.CISObsControlUI = {
    configure,
    renderCompactStatus,
    renderControlPanel,
    renderOutputTargetSelector,
  };
})();
