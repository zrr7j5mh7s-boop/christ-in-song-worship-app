(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function stateClass(state) {
    if (state === "connected") return "ready";
    if (state === "error") return "error";
    if (state === "connecting" || state === "reconnecting" || state === "disconnecting") return "pending";
    return "awaiting";
  }

  function stateLabel(status) {
    const labels = window.CISObsConstants ? window.CISObsConstants.STATE_LABELS : {};
    return labels[status.state] || "OBS";
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
        </div>
        <div class="button-row obs-settings-actions">
          <button class="action-button" type="button" data-command="obs-save-settings">Save Settings</button>
          <button class="secondary-button" type="button" data-command="obs-test-connection">Test Connection</button>
          <button class="secondary-button" type="button" data-command="obs-connect" ${status?.connected ? "disabled" : ""}>Connect</button>
          <button class="secondary-button" type="button" data-command="obs-disconnect" ${status?.connected ? "" : "disabled"}>Disconnect</button>
        </div>
        <p class="muted obs-settings-hint">Default endpoint: <code>ws://127.0.0.1:4455</code>. Password is encrypted in the desktop app; browser mode uses local encrypted storage.</p>
      </section>
    `;
  }

  function readSettingsFromDom(root) {
    const scope = root || document;
    const enabled = Boolean(scope.querySelector("#obsEnabled")?.checked);
    const host = scope.querySelector("#obsHost")?.value || "127.0.0.1";
    const port = Number(scope.querySelector("#obsPort")?.value) || 4455;
    const autoReconnect = Boolean(scope.querySelector("#obsAutoReconnect")?.checked);
    const reconnectSeconds = Number(scope.querySelector("#obsReconnectInterval")?.value) || 5;
    const passwordField = scope.querySelector("#obsPassword");
    const password = passwordField ? passwordField.value : undefined;
    const payload = {
      enabled,
      host,
      port,
      autoReconnect,
      reconnectIntervalMs: Math.max(2000, reconnectSeconds * 1000),
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
    readSettingsFromDom,
    updateTopbar,
    stateLabel,
    stateClass,
  };
})();
