(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderStatusBanner(active, deferredCount) {
    if (!active) return "";
    const deferred = deferredCount > 0
      ? `<span class="quiet-service-mode-deferred muted">${deferredCount} notice(s) deferred</span>`
      : "";
    return `
      <div class="quiet-service-mode-banner" role="status" aria-live="polite">
        <span class="quiet-service-mode-banner-label">QUIET SERVICE MODE ACTIVE</span>
        <span class="quiet-service-mode-banner-detail">Background work and nonessential notifications are paused.</span>
        ${deferred}
        <button class="quiet-service-mode-exit-btn" type="button" data-command="quiet-service-mode-exit">Exit Quiet Service Mode</button>
      </div>
    `;
  }

  function renderTopbarButton(active) {
    return `
      <button
        class="tool-button quiet-service-mode-btn ${active ? "is-active" : ""}"
        type="button"
        data-command="${active ? "quiet-service-mode-exit" : "quiet-service-mode-enter"}"
        id="topbarQuietServiceModeBtn"
        aria-pressed="${active ? "true" : "false"}"
        title="${active ? "Exit Quiet Service Mode" : "Enter Quiet Service Mode"}"
      >${active ? "Exit Quiet Service Mode" : "Enter Quiet Service Mode"}</button>
    `;
  }

  function renderSettingsPanel(settings) {
    const s = settings || {};
    const auto = s.autoEnterWithServiceMode || "never";
    return `
      <section class="section quiet-service-settings-panel">
        <h3>Quiet Service Mode</h3>
        <p class="muted">Reduces distractions and background activity during live worship. This is separate from Service Mode, which simplifies the operator interface.</p>
        <div class="settings-grid">
          <label>When Service Mode starts
            <select data-command="quiet-settings" data-setting="autoEnterWithServiceMode">
              <option value="never" ${auto === "never" ? "selected" : ""}>Never enter automatically</option>
              <option value="ask" ${auto === "ask" ? "selected" : ""}>Ask each time</option>
              <option value="always" ${auto === "always" ? "selected" : ""}>Enter Quiet Service Mode automatically</option>
            </select>
          </label>
          <label><input type="checkbox" data-command="quiet-settings" data-setting="preventDisplaySleep" ${s.preventDisplaySleep !== false ? "checked" : ""}> Prevent display sleep while outputs are active (desktop)</label>
          <label><input type="checkbox" data-command="quiet-settings" data-setting="deferUpdates" ${s.deferUpdates !== false ? "checked" : ""}> Defer update prompts and downloads</label>
          <label><input type="checkbox" data-command="quiet-settings" data-setting="pauseBackgroundIndexing" ${s.pauseBackgroundIndexing !== false ? "checked" : ""}> Pause nonessential background indexing</label>
          <label><input type="checkbox" data-command="quiet-settings" data-setting="reduceAnimations" ${s.reduceAnimations !== false ? "checked" : ""}> Reduce unnecessary animations</label>
        </div>
      </section>
    `;
  }

  window.CISQuietServiceModeUI = {
    configure,
    renderStatusBanner,
    renderTopbarButton,
    renderSettingsPanel,
  };
})();
