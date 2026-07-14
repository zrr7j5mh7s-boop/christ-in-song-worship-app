(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let t = (key) => key;

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.t) t = options.t;
  }

  function getService() {
    return window.CISCameraSourceService || null;
  }

  function getConstants() {
    return window.CISCameraConstants || {};
  }

  function statusPill(status) {
    const map = {
      connected: "Connected",
      unavailable: "Unavailable",
      loading: "Loading…",
      disconnected: "Disconnected",
      error: "Error",
      idle: "Available",
    };
    return map[status] || status;
  }

  function renderCameraCard(cam, isDefault, isBackup) {
    const status = cam.status || {};
    const aspect = status.connected && cam.status?.width
      ? `${cam.status.width}×${cam.status.height}`
      : "—";
    const roleLabel = getConstants().getRoleLabel?.(cam.role) || cam.role;
    const badges = [
      isDefault ? '<span class="camera-badge default">Default</span>' : "",
      isBackup ? '<span class="camera-badge backup">Backup</span>' : "",
    ].filter(Boolean).join("");
    return `
      <article class="camera-source-card" data-camera-id="${escapeHtml(cam.id)}" tabindex="0" role="group" aria-label="${escapeHtml(cam.name)} camera">
        <header class="camera-card-header">
          <h3>${escapeHtml(cam.name)}</h3>
          ${badges}
        </header>
        <dl class="camera-card-meta">
          <div><dt>Device</dt><dd>${escapeHtml(cam.deviceLabel || status.deviceLabel || "Not selected")}</dd></div>
          <div><dt>Role</dt><dd>${escapeHtml(roleLabel)}</dd></div>
          <div><dt>Status</dt><dd><span class="camera-status-pill status-${escapeHtml(status.status || "idle")}">${escapeHtml(statusPill(status.status))}</span></dd></div>
          <div><dt>Resolution</dt><dd>${escapeHtml(aspect)}</dd></div>
          <div><dt>Layout</dt><dd>${escapeHtml(getConstants().getLayoutLabel?.(cam.layout) || cam.layout)}</dd></div>
          <div><dt>Outputs</dt><dd>${escapeHtml((cam.destinations || []).join(", ") || "—")}</dd></div>
        </dl>
        ${status.guidance ? `<p class="camera-guidance muted" role="status">${escapeHtml(status.guidance)}</p>` : ""}
        <div class="button-row camera-card-actions">
          <button type="button" class="secondary-button" data-command="camera-preview" data-camera-id="${escapeHtml(cam.id)}" aria-label="Preview ${escapeHtml(cam.name)}">Preview</button>
          <button type="button" class="action-button" data-command="camera-send-live" data-camera-id="${escapeHtml(cam.id)}" aria-label="Send ${escapeHtml(cam.name)} live">Send Live</button>
          <button type="button" class="secondary-button" data-command="camera-edit" data-camera-id="${escapeHtml(cam.id)}">Edit</button>
          <button type="button" class="secondary-button" data-command="camera-set-default" data-camera-id="${escapeHtml(cam.id)}">Set Default</button>
          <button type="button" class="secondary-button" data-command="camera-set-backup" data-camera-id="${escapeHtml(cam.id)}">Set Backup</button>
          <button type="button" class="secondary-button warn" data-command="camera-remove" data-camera-id="${escapeHtml(cam.id)}" data-confirm="true">Remove</button>
        </div>
      </article>
    `;
  }

  function renderDevicePicker(selectedLabel) {
    const service = getService();
    const state = service ? service.getState() : { devices: [] };
    const devices = state.devices || [];
    if (!devices.length) {
      return `<p class="muted">No cameras detected. Click Refresh Devices after granting camera permission.</p>`;
    }
    return `
      <label>
        <span>Select device</span>
        <select id="cameraDevicePicker" aria-label="Select camera device">
          <option value="">— Choose a device —</option>
          ${devices.map((device) => {
            const hint = getConstants().classifyDevice?.(device.label) || {};
            const selected = device.label === selectedLabel ? "selected" : "";
            return `<option value="${escapeHtml(device.deviceId)}" data-label="${escapeHtml(device.label)}" ${selected}>${escapeHtml(device.label || "Camera")} (${escapeHtml(hint.label || "Camera")})</option>`;
          }).join("")}
        </select>
      </label>
    `;
  }

  function renderLocalPresentationPanel(status) {
    const s = status || {};
    return `
      <section class="camera-local-status panel" aria-label="Local presentation status">
        <p class="eyebrow">${escapeHtml(window.CISBrandConfig?.BRAND?.appName || "VaChinoda Worship App")}</p>
        <h3>LOCAL PRESENTATION ACTIVE</h3>
        <dl class="camera-local-status-grid">
          <div><dt>Main projector</dt><dd>${escapeHtml(s.mainProjector || "—")}</dd></div>
          <div><dt>Secondary projector</dt><dd>${escapeHtml(s.secondaryProjector || "—")}</dd></div>
          <div><dt>Stage display</dt><dd>${escapeHtml(s.stageDisplay || "—")}</dd></div>
          <div><dt>Camera</dt><dd>${escapeHtml(s.camera || "—")}</dd></div>
          <div><dt>OBS Virtual Camera</dt><dd>${escapeHtml(s.obsVirtualCamera || "—")}</dd></div>
          <div><dt>Internet streaming</dt><dd>${escapeHtml(s.internetStreaming || "Off")}</dd></div>
        </dl>
      </section>
    `;
  }

  function renderTerminologyNote() {
    return `
      <aside class="camera-terminology muted" aria-label="Camera terminology">
        <p><strong>Camera Input</strong> — A physical or virtual camera selected inside VaChinoda Worship App.</p>
        <p><strong>OBS Virtual Camera</strong> — A webcam-style output from OBS (not OBS WebSocket or streaming).</p>
        <p><strong>OBS Browser Source</strong> — VaChinoda output that OBS loads as an overlay.</p>
        <p><strong>Local Presentation Output</strong> — Projector or display controlled directly by VaChinoda Worship App.</p>
      </aside>
    `;
  }

  function renderControlsCompact(selectedId) {
    return `
      <div class="camera-controls-toolbar" role="toolbar" aria-label="Camera controls">
        <button type="button" class="secondary-button" data-command="camera-refresh-devices">Refresh Devices</button>
        <button type="button" class="secondary-button" data-command="camera-preview" data-camera-id="${escapeHtml(selectedId || "")}">Preview Camera</button>
        <button type="button" class="action-button" data-command="camera-send-live" data-camera-id="${escapeHtml(selectedId || "")}">Send Camera Live</button>
        <button type="button" class="secondary-button" data-command="camera-switch-backup">Backup Camera</button>
        <button type="button" class="secondary-button" data-command="camera-freeze-toggle">Freeze / Unfreeze</button>
        <button type="button" class="secondary-button" data-command="camera-clear">Clear Camera</button>
        <button type="button" class="secondary-button" data-command="camera-detach-preview">Detach Preview</button>
      </div>
    `;
  }

  function renderObsVcamControls() {
    const obsConnected = Boolean(window.CISObsConnectionService?.getStatus?.().connected);
    const runtime = window.CISObsConnectionService?.getStatus?.()?.obsRuntime || {};
    return `
      <section class="camera-obs-vcam panel">
        <h3>OBS Virtual Camera</h3>
        <p class="muted">OBS Virtual Camera target is configured in OBS. VaChinoda Worship App can start or stop Virtual Camera when OBS WebSocket is connected.</p>
        <p class="camera-vcam-state" role="status">Virtual Camera: <strong>${runtime.virtualCamera ? "Active" : "Inactive"}</strong>${obsConnected ? "" : " · OBS disconnected (device may still work as a system camera)"}</p>
        <div class="button-row">
          <button type="button" class="secondary-button" data-command="camera-obs-vcam-start" ${obsConnected ? "" : "disabled"}>Start Virtual Camera</button>
          <button type="button" class="secondary-button" data-command="camera-obs-vcam-stop" ${obsConnected ? "" : "disabled"}>Stop Virtual Camera</button>
          <button type="button" class="secondary-button" data-command="camera-obs-vcam-refresh">Refresh State</button>
        </div>
      </section>
    `;
  }

  function renderSettingsPanel(state) {
    const settings = state?.settings || {};
    const constants = getConstants();
    return `
      <section class="camera-settings panel">
        <h3>Camera Settings</h3>
        <div class="form-grid">
          <label>
            <span>Preferred resolution (width)</span>
            <input type="number" id="cameraPrefWidth" min="640" max="3840" value="${Number(settings.preferredWidth) || 1280}">
          </label>
          <label>
            <span>Preferred frame rate</span>
            <input type="number" id="cameraPrefFps" min="15" max="60" value="${Number(settings.preferredFrameRate) || 30}">
          </label>
          <label>
            <span>Default layout</span>
            <select id="cameraDefaultLayout">
              ${(constants.CAMERA_LAYOUTS || []).map((layout) => `
                <option value="${escapeHtml(layout.id)}" ${layout.id === settings.defaultLayout ? "selected" : ""}>${escapeHtml(layout.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Default transition</span>
            <select id="cameraDefaultTransition">
              ${(constants.TRANSITIONS || []).map((tr) => `
                <option value="${escapeHtml(tr.id)}" ${tr.id === settings.defaultTransition ? "selected" : ""}>${escapeHtml(tr.label)}</option>
              `).join("")}
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="cameraAudioOff" ${settings.audioDisabledByDefault !== false ? "checked" : ""}>
            <span>Camera audio disabled by default</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="cameraPrepareNext" ${settings.prepareNextCamera !== false ? "checked" : ""}>
            <span>Automatically prepare the next camera</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="cameraLogoOnFail" ${settings.showLogoOnFailure !== false ? "checked" : ""}>
            <span>Show logo when camera fails</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="cameraWarnRecursion" ${settings.warnObsRecursion !== false ? "checked" : ""}>
            <span>Warn about OBS recursion</span>
          </label>
        </div>
        <p class="muted" role="status">Camera permission: <strong>${escapeHtml(state.permission || "unknown")}</strong></p>
        <button type="button" class="action-button" data-command="camera-save-settings">Save Camera Settings</button>
      </section>
    `;
  }

  function renderPage(state) {
    const cameras = state?.savedCameras || [];
    const defaultId = state?.settings?.defaultCameraId || "";
    const backupId = state?.settings?.backupCameraId || "";
    const previewCam = cameras.find((c) => c.id === state.preview?.cameraId);
    const compositor = window.CISCameraCompositor;

    return `
      <div class="camera-sources-page">
        <header class="camera-page-header">
          <div>
            <p class="eyebrow">Local Presentation Mode</p>
            <h2>Camera Sources</h2>
            <p class="muted">Physical and virtual cameras for local projectors. Live means display on selected local screens — not internet streaming.</p>
          </div>
          <div class="button-row">
            <button type="button" class="action-button" data-command="camera-add">Add Camera</button>
            <button type="button" class="secondary-button" data-command="camera-refresh-devices">Refresh Devices</button>
          </div>
        </header>
        ${renderTerminologyNote()}
        ${state.permission === "denied" ? `<p class="camera-error-banner" role="alert">Camera access was denied. Allow camera access in system settings and try again.</p>` : ""}
        ${state.error ? `<p class="camera-error-banner" role="alert">${escapeHtml(state.error)}</p>` : ""}
        <div class="camera-page-grid">
          <section class="camera-list-section">
            <h3>Available Cameras</h3>
            ${cameras.length
              ? `<div class="camera-source-grid">${cameras.map((cam) => renderCameraCard(cam, cam.id === defaultId, cam.id === backupId)).join("")}</div>`
              : `<p class="muted camera-empty-state">No saved cameras yet. Click Add Camera to configure Main Camera, OBS Program, Camo, Iriun, or other devices.</p>`}
          </section>
          <aside class="camera-preview-aside">
            ${compositor ? compositor.renderOperatorPreview(previewCam?.name, state.preview?.status) : ""}
            ${renderControlsCompact(state.preview?.cameraId || defaultId)}
            ${renderLocalPresentationPanel(state.localPresentation)}
            ${renderObsVcamControls()}
          </aside>
        </div>
        ${renderSettingsPanel(state)}
      </div>
    `;
  }

  function renderPresenterPanel(state) {
    const live = state?.live || {};
    const defaultId = state?.settings?.defaultCameraId || "";
    return `
      <section class="camera-presenter-panel panel">
        <h3>Camera Control</h3>
        <p class="muted" role="status">${live.active ? `Live: ${escapeHtml(live.cameraName || live.deviceLabel)}` : "No camera live"}</p>
        ${renderControlsCompact(live.cameraId || defaultId)}
      </section>
    `;
  }

  function renderAddEditModal(camera, mode) {
    const constants = getConstants();
    const isEdit = mode === "edit";
    const cam = camera || { name: "", role: "main", deviceLabel: "", layout: "fullscreen", destinations: ["main", "secondary"], transition: "cut", audioMode: "video-only" };
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <form class="modal form-grid camera-editor-modal" role="dialog" aria-modal="true" aria-label="${isEdit ? "Edit camera" : "Add camera"}">
          <div class="song-header">
            <div>
              <h2>${isEdit ? "Edit Camera" : "Add Camera"}</h2>
              <p class="muted">Logical camera name is preserved even if the device identifier changes.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Camera name</span>
            <input id="cameraEditName" value="${escapeHtml(cam.name)}" placeholder="Main Camera">
          </label>
          <label>
            <span>Role</span>
            <select id="cameraEditRole">
              ${(constants.CAMERA_ROLES || []).map((role) => `
                <option value="${escapeHtml(role.id)}" ${role.id === cam.role ? "selected" : ""}>${escapeHtml(role.label)}</option>
              `).join("")}
            </select>
          </label>
          ${renderDevicePicker(cam.deviceLabel)}
          <label>
            <span>Layout</span>
            <select id="cameraEditLayout">
              ${(constants.CAMERA_LAYOUTS || []).map((layout) => `
                <option value="${escapeHtml(layout.id)}" ${layout.id === cam.layout ? "selected" : ""}>${escapeHtml(layout.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Transition</span>
            <select id="cameraEditTransition">
              ${(constants.TRANSITIONS || []).map((tr) => `
                <option value="${escapeHtml(tr.id)}" ${tr.id === cam.transition ? "selected" : ""}>${escapeHtml(tr.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Audio</span>
            <select id="cameraEditAudio">
              ${(constants.AUDIO_MODES || []).map((mode) => `
                <option value="${escapeHtml(mode.id)}" ${mode.id === cam.audioMode ? "selected" : ""}>${escapeHtml(mode.label)}</option>
              `).join("")}
            </select>
          </label>
          <fieldset class="full camera-destinations-fieldset">
            <legend>Output destinations</legend>
            ${(constants.OUTPUT_DESTINATIONS || []).filter((d) => d.id !== "operator").map((dest) => {
              const checked = (cam.destinations || []).includes(dest.id) ? "checked" : "";
              return `
                <label class="checkbox-row">
                  <input type="checkbox" name="cameraDest" value="${escapeHtml(dest.id)}" ${checked}>
                  <span>${escapeHtml(dest.label)}</span>
                </label>
              `;
            }).join("")}
          </fieldset>
          <input type="hidden" id="cameraEditId" value="${escapeHtml(cam.id || "")}">
          <div class="button-row">
            <button type="button" class="action-button" data-command="camera-save">${isEdit ? "Save Camera" : "Add Camera"}</button>
            <button type="button" class="secondary-button" data-command="close-modal">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  function bindPreviewVideos(root) {
    const service = getService();
    const compositor = window.CISCameraCompositor;
    if (service && compositor) compositor.bindCameraVideos(root, service);
  }

  window.CISCameraSourceUI = {
    configure,
    renderPage,
    renderPresenterPanel,
    renderSettingsPanel,
    renderAddEditModal,
    renderLocalPresentationPanel,
    bindPreviewVideos,
  };
})();
