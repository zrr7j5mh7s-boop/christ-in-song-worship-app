(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function isFailureState(state) {
    if (window.CISObsConstants && window.CISObsConstants.FAILURE_STATES) {
      return window.CISObsConstants.FAILURE_STATES.has(state);
    }
    return state === "error"
      || state === "authentication_failed"
      || state === "connection_failed"
      || state === "obs_unavailable"
      || state === "version_unsupported";
  }

  function stateClass(state) {
    if (state === "connected") return "ready";
    if (isFailureState(state)) return "error";
    if (state === "connecting" || state === "reconnecting" || state === "disconnecting" || state === "authenticating") {
      return "pending";
    }
    return "awaiting";
  }

  function stateLabel(status) {
    const labels = window.CISObsConstants ? window.CISObsConstants.STATE_LABELS : {};
    return labels[status.state] || "OBS";
  }

  function formatBool(value) {
    return value ? "On" : "Off";
  }

  function renderRuntimeDashboard(status) {
    if (!status?.connected) return "";
    const runtime = status.obsRuntime || {};
    const info = status.obsInfo || {};
    const rows = [
      ["OBS version", info.obsVersion || "—"],
      ["WebSocket", info.obsWebSocketVersion || "5.x"],
      ["Scene collection", runtime.currentSceneCollection || "—"],
      ["Profile", runtime.currentProfile || "—"],
      ["Program scene", runtime.programScene || "—"],
      ["Studio Mode", formatBool(runtime.studioMode)],
      ["Streaming", formatBool(runtime.streaming)],
      ["Recording", formatBool(runtime.recording)],
      ["Virtual camera", formatBool(runtime.virtualCamera)],
    ];
    return `
      <div class="obs-runtime-dashboard">
        <h3>Live OBS Status</h3>
        <dl class="obs-runtime-grid">
          ${rows.map(([label, value]) => `
            <div class="obs-runtime-row">
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join("")}
        </dl>
      </div>
    `;
  }

  function renderTopbarBadge(status) {
    if (!status || !status.enabled) {
      return `<span class="obs-status-pill disabled" title="OBS integration disabled">OBS Off</span>`;
    }
    const label = stateLabel(status);
    const detail = status.connected && status.obsInfo?.obsVersion
      ? `OBS ${escapeHtml(status.obsInfo.obsVersion)}`
      : (status.lastError ? escapeHtml(status.lastError) : label);
    return `
      <button
        class="obs-status-pill ${stateClass(status.state)}"
        type="button"
        data-command="open-obs-settings"
        title="${detail}"
      >${escapeHtml(label)}</button>
    `;
  }

  function renderDashboardStatus(status) {
    if (!status || !status.enabled) {
      return `
        <article class="preview-card obs-dashboard-card">
          <span>OBS Studio</span>
          <strong>Disabled</strong>
          <p class="muted">Enable OBS in Settings to stream or record worship output.</p>
          <button class="secondary-button" type="button" data-command="open-obs-settings">OBS Settings</button>
        </article>
      `;
    }
    const label = stateLabel(status);
    const detail = status.connected
      ? `${status.obsRuntime?.programScene ? `Program: ${status.obsRuntime.programScene}` : "Ready"}`
      : (status.lastError || "Not connected");
    const flags = status.connected && status.obsRuntime
      ? [
        status.obsRuntime.streaming ? "Streaming" : null,
        status.obsRuntime.recording ? "Recording" : null,
        status.obsRuntime.virtualCamera ? "Virtual cam" : null,
        status.obsRuntime.studioMode ? "Studio Mode" : null,
      ].filter(Boolean).join(" · ")
      : "";
    return `
      <article class="preview-card obs-dashboard-card ${stateClass(status.state)}">
        <span>OBS Studio</span>
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(detail)}${flags ? `<br><small class="muted">${escapeHtml(flags)}</small>` : ""}</p>
        <button class="secondary-button" type="button" data-command="open-obs-settings">OBS Settings</button>
      </article>
    `;
  }

  function renderSettingsPanel(status, settings) {
    const hasPassword = Boolean(status?.hasPassword);
    const versionLine = status?.connected && status?.obsInfo?.obsVersion
      ? `<p class="muted obs-version-line">Connected to OBS ${escapeHtml(status.obsInfo.obsVersion)} · WebSocket ${escapeHtml(status.obsInfo.obsWebSocketVersion || "5.x")}</p>`
      : "";
    const errorLine = status?.lastError
      ? `<p class="obs-error-line" role="alert">${escapeHtml(status.lastError)}</p>`
      : "";

    return `
      <section class="section obs-settings-panel">
        <div class="section-heading-row">
          <div>
            <h2>OBS Studio</h2>
            <p class="muted">Connect to OBS WebSocket 5.x for live streaming and recording. Worship output continues normally when OBS is off.</p>
          </div>
          <span class="status-pill ${stateClass(status?.state || "disabled")}">${escapeHtml(stateLabel(status || { state: "disabled" }))}</span>
        </div>
        ${versionLine}
        ${errorLine}
        <div class="obs-settings-grid">
          <label class="field-check">
            <input type="checkbox" id="obsEnabled" ${settings.enabled ? "checked" : ""}>
            <span>Enable OBS integration</span>
          </label>
          <label class="field-check">
            <input type="checkbox" id="obsAutoConnectOnStart" ${settings.autoConnectOnStart ? "checked" : ""}>
            <span>Connect automatically on app start</span>
          </label>
          <label class="field">
            <span>Host</span>
            <input id="obsHost" type="text" value="${escapeHtml(settings.host)}" placeholder="127.0.0.1" autocomplete="off">
          </label>
          <label class="field">
            <span>Port</span>
            <input id="obsPort" type="number" min="1" max="65535" value="${escapeHtml(settings.port)}" autocomplete="off">
          </label>
          <label class="field">
            <span>WebSocket password</span>
            <input id="obsPassword" type="password" placeholder="${hasPassword ? "Saved — leave blank to keep" : "Optional"}" autocomplete="new-password">
          </label>
          <label class="field-check">
            <input type="checkbox" id="obsAutoReconnect" ${settings.autoReconnect ? "checked" : ""}>
            <span>Auto-reconnect</span>
          </label>
          <label class="field">
            <span>Reconnect interval (seconds)</span>
            <input id="obsReconnectInterval" type="number" min="2" max="120" value="${Math.round((settings.reconnectIntervalMs || 5000) / 1000)}" autocomplete="off">
          </label>
          <label class="field">
            <span>Connection timeout (seconds)</span>
            <input id="obsConnectionTimeout" type="number" min="3" max="60" value="${Math.round((settings.connectionTimeoutMs || 10000) / 1000)}" autocomplete="off">
          </label>
          <label class="field">
            <span>Browser Source port</span>
            <input id="obsBrowserSourcePort" type="number" min="1024" max="65535" value="${escapeHtml(settings.browserSourcePort || 47823)}" autocomplete="off">
          </label>
          <label class="field compact">
            <span>Default worship output</span>
            <select id="obsOutputTarget">
              <option value="projector" ${settings.outputTarget === "projector" ? "selected" : ""}>Projector only</option>
              <option value="obs" ${settings.outputTarget === "obs" ? "selected" : ""}>OBS only</option>
              <option value="both" ${settings.outputTarget === "both" ? "selected" : ""}>Projector + OBS</option>
              <option value="stage" ${settings.outputTarget === "stage" ? "selected" : ""}>Stage only</option>
              <option value="all" ${settings.outputTarget === "all" ? "selected" : ""}>All outputs</option>
            </select>
          </label>
        </div>
        <div class="button-row obs-settings-actions">
          <button class="action-button" type="button" data-command="obs-save-settings">Save Settings</button>
          <button class="secondary-button" type="button" data-command="obs-test-connection">Test Connection</button>
          <button class="secondary-button" type="button" data-command="obs-connect" ${status?.connected ? "disabled" : ""}>Connect</button>
          <button class="secondary-button" type="button" data-command="obs-disconnect" ${status?.connected ? "" : "disabled"}>Disconnect</button>
        </div>
        <p class="muted obs-settings-hint">Default endpoint: <code>ws://127.0.0.1:4455</code>. Password is encrypted in the desktop app; browser mode uses local encrypted storage.</p>
        ${renderRuntimeDashboard(status)}
      </section>
    `;
  }

  function readSettingsFromDom(root) {
    const scope = root || document;
    const enabled = Boolean(scope.querySelector("#obsEnabled")?.checked);
    const autoConnectOnStart = Boolean(scope.querySelector("#obsAutoConnectOnStart")?.checked);
    const host = scope.querySelector("#obsHost")?.value || "127.0.0.1";
    const port = Number(scope.querySelector("#obsPort")?.value) || 4455;
    const autoReconnect = Boolean(scope.querySelector("#obsAutoReconnect")?.checked);
    const reconnectSeconds = Number(scope.querySelector("#obsReconnectInterval")?.value) || 5;
    const timeoutSeconds = Number(scope.querySelector("#obsConnectionTimeout")?.value) || 10;
    const browserSourcePort = Number(scope.querySelector("#obsBrowserSourcePort")?.value) || 47823;
    const outputTarget = scope.querySelector("#obsOutputTarget")?.value || "projector";
    const passwordField = scope.querySelector("#obsPassword");
    const password = passwordField ? passwordField.value : undefined;
    const payload = {
      enabled,
      autoConnectOnStart,
      host,
      port,
      autoReconnect,
      reconnectIntervalMs: Math.max(2000, reconnectSeconds * 1000),
      connectionTimeoutMs: Math.max(3000, Math.min(60000, timeoutSeconds * 1000)),
      browserSourcePort: Math.max(1024, Math.min(65535, browserSourcePort)),
      outputTarget,
    };
    if (password !== undefined && password !== "") payload._password = password;
    return payload;
  }

  function updateTopbar(root, status) {
    if (!root) return;
    root.innerHTML = renderTopbarBadge(status);
  }

  window.CISObsSettingsUI = {
    configure,
    renderTopbarBadge,
    renderSettingsPanel,
    renderDashboardStatus,
    readSettingsFromDom,
    updateTopbar,
    stateLabel,
    stateClass,
  };
})();
