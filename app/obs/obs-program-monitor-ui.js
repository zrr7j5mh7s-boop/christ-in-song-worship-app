(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let getWorshipContext = () => ({ worshipPreview: "—", worshipLive: "—", worshipLiveActive: false });
  let onLayoutChange = () => {};

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.getWorshipContext) getWorshipContext = options.getWorshipContext;
    if (options.onLayoutChange) onLayoutChange = options.onLayoutChange;
  }

  function liveBadge(monitor) {
    if (!monitor.obsConnected) return "";
    if (monitor.streaming) return `<span class="obs-monitor-live-badge live">● LIVE</span>`;
    if (monitor.recording) return `<span class="obs-monitor-live-badge record">● REC</span>`;
    return `<span class="obs-monitor-live-badge idle">● PROGRAM</span>`;
  }

  function statusRow(label, value) {
    return `
      <div class="obs-monitor-status-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "—")}</strong>
      </div>
    `;
  }

  function renderStatusOverlay(monitor, worship) {
    const connectionLabel = monitor.reconnecting
      ? "Reconnecting…"
      : (monitor.obsConnected ? "Connected" : "Disconnected");
    return `
      <div class="obs-monitor-status-overlay" aria-live="polite">
        ${statusRow("OBS", connectionLabel)}
        ${statusRow("Program scene", monitor.programScene)}
        ${monitor.studioMode ? statusRow("Preview scene", monitor.previewScene) : ""}
        ${statusRow("Streaming", monitor.streaming ? "Active" : "Inactive")}
        ${statusRow("Recording", monitor.recording ? "Active" : "Inactive")}
        ${statusRow("Virtual Camera", monitor.virtualCamera ? "Active" : "Inactive")}
        ${statusRow("Stream duration", monitor.streamDuration)}
        ${statusRow("Monitor source", monitor.monitorSource)}
        ${statusRow("Resolution", monitor.monitorResolution)}
        ${statusRow("Worship Preview", worship.worshipPreview)}
        ${statusRow("Worship Live", worship.worshipLive)}
        ${monitor.error ? `<p class="obs-monitor-error">${escapeHtml(monitor.error)}</p>` : ""}
      </div>
    `;
  }

  function renderDeviceOptions(monitor) {
    const options = (monitor.devices || []).map((device) => {
      const selected = device.deviceId === monitor.deviceId ? "selected" : "";
      const obsTag = window.CISObsProgramMonitor && window.CISObsProgramMonitor.isObsVirtualCamera(device)
        ? " (OBS Virtual Camera)"
        : "";
      const label = device.label || `Camera ${device.deviceId.slice(0, 6)}`;
      return `<option value="${escapeHtml(device.deviceId)}" data-label="${escapeHtml(label)}" ${selected}>${escapeHtml(label)}${escapeHtml(obsTag)}</option>`;
    }).join("");
    return `<option value="">— Select monitor source —</option>${options}`;
  }

  function renderControls(monitor) {
    const running = monitor.active;
    return `
      <div class="obs-monitor-controls button-row">
        <button class="action-button" type="button" data-command="obs-monitor-start" ${running ? "disabled" : ""}>Start Monitor</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-stop" ${running ? "" : "disabled"}>Stop Monitor</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-refresh-devices">Refresh Devices</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-start-vcam" ${monitor.virtualCamera ? "disabled" : ""}>Start Virtual Camera</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-stop-vcam" ${monitor.virtualCamera ? "" : "disabled"}>Stop Virtual Camera</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-fullscreen">Full Screen</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-detach">Detach Monitor</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-reconnect">Reconnect OBS</button>
        <button class="secondary-button" type="button" data-command="obs-monitor-open-settings">Open OBS Settings</button>
      </div>
      <div class="obs-monitor-controls-grid">
        <label class="field compact">
          <span>Monitor source</span>
          <select id="obsMonitorDeviceSelect" data-command-target="obs-monitor-select-device">${renderDeviceOptions(monitor)}</select>
        </label>
        <label class="field compact">
          <span>Layout</span>
          <select id="obsMonitorLayoutSelect" data-command-target="obs-monitor-layout">
            <option value="compact" ${monitor.layout === "compact" ? "selected" : ""}>Compact card</option>
            <option value="large" ${monitor.layout === "large" ? "selected" : ""}>Large Program monitor</option>
            <option value="side-by-side" ${monitor.layout === "side-by-side" ? "selected" : ""}>Worship Preview + OBS Program</option>
          </select>
        </label>
        <label class="field compact">
          <span>Viewer Return URL (delayed)</span>
          <input id="obsViewerReturnUrl" type="url" placeholder="YouTube / Facebook viewer link" value="${escapeHtml(monitor.viewerReturnUrl || "")}">
        </label>
      </div>
    `;
  }

  function renderEmptyState(monitor) {
    if (!monitor.obsConnected) {
      return `
        <div class="obs-monitor-empty">
          <p>OBS is disconnected. Reconnect OBS to view Program status.</p>
        </div>
      `;
    }
    if (monitor.permission === "denied") {
      return `
        <div class="obs-monitor-empty">
          <p>Camera access was denied. Allow camera permission for this app, then click Start Monitor.</p>
        </div>
      `;
    }
    if (!monitor.virtualCamera && !monitor.deviceId) {
      return `
        <div class="obs-monitor-empty">
          <p>Start OBS Virtual Camera and select OBS Virtual Camera to view the final Program output here.</p>
          <p class="muted">OBS Virtual Camera was not found. Start Virtual Camera in OBS, refresh video devices, or use Snapshot Preview.</p>
        </div>
      `;
    }
    return `
      <div class="obs-monitor-empty">
        <p>Start OBS Virtual Camera and select OBS Virtual Camera to view the final Program output here.</p>
      </div>
    `;
  }

  function renderVideoSurface(monitor, worship, options) {
    const layout = options.layout || monitor.layout || "large";
    const showSideBySide = layout === "side-by-side";
    const videoClass = monitor.mode === "snapshot" ? "obs-monitor-snapshot" : "obs-monitor-video";
    const media = monitor.active
      ? (monitor.mode === "snapshot" && monitor.snapshotDataUrl
        ? `<img class="${videoClass}" src="${monitor.snapshotDataUrl}" alt="OBS Program Snapshot Preview">`
        : `<video class="${videoClass}" id="obsProgramMonitorVideo" autoplay muted playsinline></video>`)
      : renderEmptyState(monitor);

    const worshipPreviewCard = showSideBySide ? `
      <article class="obs-monitor-side-card">
        <header><span>Worship Preview</span><small>Prepared, not Live</small></header>
        <p>${escapeHtml(worship.worshipPreview)}</p>
      </article>
    ` : "";

    const worshipLiveCard = showSideBySide ? `
      <article class="obs-monitor-side-card ${worship.worshipLiveActive ? "live" : ""}">
        <header><span>Worship Live</span><small>Sent to outputs</small></header>
        <p>${escapeHtml(worship.worshipLive)}</p>
      </article>
    ` : "";

    const viewerReturn = monitor.viewerReturnUrl ? `
      <section class="obs-monitor-viewer-return">
        <header>
          <strong>Viewer Return Monitor</strong>
          <span class="muted">Delayed platform feed — not OBS Program</span>
        </header>
        <p class="muted">Open your delayed viewer link separately: <a href="${escapeHtml(monitor.viewerReturnUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(monitor.viewerReturnUrl)}</a></p>
      </section>
    ` : `
      <section class="obs-monitor-viewer-return placeholder">
        <header>
          <strong>Viewer Return Monitor</strong>
          <span class="muted">Delayed — separate from OBS Program</span>
        </header>
        <p class="muted">Optional: paste a YouTube, Facebook, or custom player URL above for operator reference.</p>
      </section>
    `;

    const snapshotLabel = monitor.mode === "snapshot"
      ? `<div class="obs-monitor-mode-tag">Snapshot Preview</div>`
      : "";

    return `
      <div class="obs-monitor-stage layout-${escapeHtml(layout)} ${monitor.active ? "active" : ""}">
        ${worshipPreviewCard}
        <div class="obs-monitor-program-wrap">
          <div class="obs-monitor-program-header">
            <span>OBS Program</span>
            ${monitor.studioMode ? `<small class="muted">Preview: ${escapeHtml(monitor.previewScene || "—")}</small>` : ""}
          </div>
          <div class="obs-monitor-viewport" id="obsProgramMonitorViewport">
            ${snapshotLabel}
            ${media}
            ${monitor.active ? renderStatusOverlay(monitor, worship) : ""}
          </div>
        </div>
        ${worshipLiveCard}
      </div>
      ${viewerReturn}
    `;
  }

  function render(root, monitorState, options) {
    if (!root || !monitorState) return;
    const worship = getWorshipContext();
    const opts = options || {};
    const layout = opts.forceLayout || monitorState.layout || "large";
    const detached = monitorState.detached;

    root.className = `obs-program-monitor-root layout-${escapeHtml(layout)}${detached ? " detached-host" : ""}`;
    root.innerHTML = `
      <section class="section obs-program-monitor">
        <div class="section-heading-row obs-monitor-heading">
          <div>
            <h3>OBS Program Monitor</h3>
            <p class="muted">Defaults to OBS Program — distinct from Worship Preview and Worship Live.</p>
          </div>
          ${liveBadge(monitorState)}
        </div>
        ${detached ? `<p class="obs-monitor-detached-note">Monitor is open in a detachable window.</p>` : renderVideoSurface(monitorState, worship, { layout })}
        ${detached ? "" : renderControls(monitorState)}
      </section>
    `;

    if (!detached && monitorState.active && monitorState.mode === "video" && window.CISObsProgramMonitor) {
      const video = root.querySelector("#obsProgramMonitorVideo");
      window.CISObsProgramMonitor.bindVideoElement(video);
    }
  }

  window.CISObsProgramMonitorUI = {
    configure,
    render,
    renderVideoSurface,
    renderStatusOverlay,
  };
})();
