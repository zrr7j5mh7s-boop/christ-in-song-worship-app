(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderStrip(lockState) {
    const active = lockState?.active || lockState?.enabled;
    if (!active) {
      return `
        <div class="live-lock-strip live-lock-off" role="region" aria-label="Live Lock">
          <span class="live-lock-label">Live Lock</span>
          <button class="secondary-button service-touch-btn" type="button" data-command="live-lock-enable" aria-pressed="false">Enable Live Lock</button>
        </div>
      `;
    }
    return `
      <div class="live-lock-strip live-lock-on" role="status" aria-live="polite">
        <span class="live-lock-badge" aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("lock") : ""}</span>
        <strong>LIVE LOCK ENABLED</strong>
        <span class="muted">Risky administrative actions are disabled during service.</span>
        <button class="secondary-button service-touch-btn" type="button" data-command="live-lock-unlock" aria-pressed="true">Unlock</button>
      </div>
    `;
  }

  window.CISLiveLockUI = {
    configure,
    renderStrip,
  };
})();
