(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let t = (key, vars) => key;

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
    if (options?.t) t = options.t;
  }

  function renderLayoutOptions(state) {
    const layouts = window.CISStageDisplaySettings?.LAYOUTS || {};
    return Object.values(layouts).map((layout) => `
      <button
        class="chip-button ${state.settings?.layoutId === layout.id ? "active" : ""}"
        type="button"
        data-command="stage-display-set-layout"
        data-layout="${escapeHtml(layout.id)}"
        aria-pressed="${state.settings?.layoutId === layout.id ? "true" : "false"}"
      >${escapeHtml(layout.label)}</button>
    `).join("");
  }

  function renderDisplayOptions(displays, selectedId) {
    const rows = [
      `<option value="auto" ${selectedId === "auto" ? "selected" : ""}>Auto (external monitor)</option>`,
      `<option value="primary" ${selectedId === "primary" ? "selected" : ""}>Primary display</option>`,
    ];
    (displays || []).forEach((display) => {
      rows.push(`<option value="${escapeHtml(String(display.id))}" ${String(selectedId) === String(display.id) ? "selected" : ""}>${escapeHtml(display.label || `Display ${display.id}`)}</option>`);
    });
    return rows.join("");
  }

  function renderPresetMessages() {
    const presets = window.CISStageDisplaySettings?.PRESET_MESSAGES || [];
    return presets.map((message) => `
      <button class="secondary-button stage-display-preset-btn" type="button" data-command="stage-display-send-message" data-message="${escapeHtml(message)}">${escapeHtml(message)}</button>
    `).join("");
  }

  function renderSettingsPanel(state, displays) {
    const remaining = state.countdownRemaining ?? 0;
    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");
    const connected = state.connected ? "Connected" : "Disconnected";
    const target = state.outputTarget || "none";

    return `
      <section class="section stage-display-panel" aria-labelledby="stage-display-settings-title">
        <div class="section-head">
          <h2 id="stage-display-settings-title">Stage Display</h2>
          <p class="muted">Private confidence monitor for preachers, singers and worship teams. Does not affect congregation outputs.</p>
        </div>
        <div class="stage-display-status-row">
          <span class="status-pill ${state.connected ? "ready" : "awaiting"}">${escapeHtml(connected)}</span>
          <span class="muted">Output: ${escapeHtml(target)} · Layout: ${escapeHtml(state.settings?.layoutId || "current-and-next")}</span>
        </div>
        <div class="button-row stage-display-output-actions">
          <button class="action-button" type="button" data-command="stage-display-open">Open Stage Display</button>
          <button class="secondary-button" type="button" data-command="stage-display-test">Test Pattern</button>
          <button class="secondary-button" type="button" data-command="stage-display-restart">Restart Display</button>
          <button class="secondary-button" type="button" data-command="stage-display-close">Close</button>
        </div>
        <div class="settings-grid stage-display-assignment">
          <label>
            <span>Monitor</span>
            <select data-command="stage-display-set-display" aria-label="Stage display monitor">
              ${renderDisplayOptions(displays, state.settings?.displayId || "auto")}
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" data-command="stage-display-windowed-test" ${state.settings?.windowedTest ? "checked" : ""}>
            <span>Windowed testing before full-screen</span>
          </label>
          <label>
            <span>Scale handling</span>
            <select data-command="stage-display-set-scale" aria-label="Resolution handling">
              <option value="fit" ${state.settings?.scaleMode === "fit" ? "selected" : ""}>Fit to screen</option>
              <option value="native" ${state.settings?.scaleMode === "native" ? "selected" : ""}>Native resolution</option>
            </select>
          </label>
        </div>
        <div class="stage-display-layout-chips" role="group" aria-label="Stage display layout">
          ${renderLayoutOptions(state)}
        </div>
        <div class="dashboard-grid stage-display-controls-grid">
          <article class="panel">
            <h3>Countdown</h3>
            <p class="stage-display-countdown-readout" aria-live="polite">${escapeHtml(state.countdownLabel || "Remaining")}: <strong>${mins}:${secs}</strong></p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="stage-display-countdown-adjust" data-delta="-60">-1m</button>
              <button class="secondary-button" type="button" data-command="stage-display-countdown-adjust" data-delta="-300">-5m</button>
              <button class="secondary-button" type="button" data-command="stage-display-countdown-adjust" data-delta="60">+1m</button>
              <button class="secondary-button" type="button" data-command="stage-display-countdown-adjust" data-delta="300">+5m</button>
            </div>
            <div class="button-row">
              <button class="action-button" type="button" data-command="stage-display-countdown-start">${state.countdownRunning ? "Restart" : "Start"}</button>
              <button class="secondary-button" type="button" data-command="stage-display-countdown-pause">${state.countdownRunning ? "Pause" : "Resume"}</button>
              <button class="secondary-button" type="button" data-command="stage-display-countdown-reset">Reset</button>
            </div>
            <label>
              <span>Countdown label</span>
              <input type="text" data-command="stage-display-countdown-label" value="${escapeHtml(state.countdownLabel || "Remaining")}" maxlength="40">
            </label>
          </article>
          <article class="panel">
            <h3>Private messages</h3>
            <p class="muted">Visible only on Stage Display. Never sent to projector, OBS or congregation outputs.</p>
            <div class="button-row stage-display-preset-row">${renderPresetMessages()}</div>
            <label>
              <span>Custom message</span>
              <input type="text" id="stageDisplayMessageInput" maxlength="120" placeholder="Short operator note">
            </label>
            <div class="button-row">
              <button class="action-button" type="button" data-command="stage-display-send-custom-message">Send to Stage</button>
              <button class="secondary-button" type="button" data-command="stage-display-dismiss-message">Dismiss</button>
            </div>
            <label class="checkbox-row">
              <input type="checkbox" data-command="stage-display-log-messages" ${state.settings?.logPrivateMessages ? "checked" : ""}>
              <span>Log private messages locally</span>
            </label>
          </article>
          <article class="panel">
            <h3>Service metadata</h3>
            <label>
              <span>Sermon title</span>
              <input type="text" data-command="stage-display-sermon-title" value="${escapeHtml(state.sermonTitle || "")}" maxlength="80">
            </label>
            <label>
              <span>Speaker name</span>
              <input type="text" data-command="stage-display-speaker-name" value="${escapeHtml(state.speakerName || "")}" maxlength="60">
            </label>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="stage-display-start-service-clock">Start service clock</button>
              <button class="secondary-button" type="button" data-command="stage-display-reset-service-clock">Reset service clock</button>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderPresenterMount(state, displays) {
    return `
      <section class="panel stage-display-presenter-mount" aria-label="Stage display quick controls">
        <h3>Stage Display</h3>
        <p class="muted">${state.connected ? "Private monitor active" : "Private monitor off"}</p>
        <div class="button-row">
          <button class="secondary-button" type="button" data-command="stage-display-open">Open</button>
          <button class="secondary-button" type="button" data-command="stage-display-test">Test</button>
          <button class="secondary-button" type="button" data-command="stage-display-restart">Restart</button>
        </div>
        <div class="stage-display-layout-chips compact">${renderLayoutOptions(state)}</div>
      </section>
    `;
  }

  window.CISStageDisplayUI = {
    configure,
    renderSettingsPanel,
    renderPresenterMount,
  };
})();
