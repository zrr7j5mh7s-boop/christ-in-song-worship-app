// app/license/license-ui.js
// Controlled pilot activation UI (renderer).

(function initLicenseUi(global) {
  const STATUS_LABELS = {
    not_activated: 'Activation required',
    activating: 'Activating…',
    active_online: 'Active (online)',
    active_offline: 'Active (offline)',
    grace_warning: 'Offline grace warning',
    expired: 'Expired',
    revoked: 'Revoked',
    device_mismatch: 'Device mismatch',
    validation_unavailable: 'Validation unavailable',
    server_configuration_error: 'Configuration error',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderActivationOverlay(status, handlers) {
    const blocked = status?.canPresent === false && status?.status !== 'activating';
    const showForm = !status?.canPresent;
    return `
      <div class="license-overlay ${blocked ? 'license-overlay--blocked' : ''}" id="licenseOverlay" role="dialog" aria-modal="true" aria-labelledby="licenseOverlayTitle">
        <div class="license-card">
          <p class="license-eyebrow">VaChinoda Controlled Pilot</p>
          <h2 id="licenseOverlayTitle">Activate your pilot licence</h2>
          <p class="license-copy">Approved-email activation binds this installation to one device. Redistribution is prohibited.</p>
          <dl class="license-status-dl">
            <div><dt>Status</dt><dd>${escapeHtml(STATUS_LABELS[status?.status] || status?.status || 'Unknown')}</dd></div>
            <div><dt>Message</dt><dd>${escapeHtml(status?.message || '')}</dd></div>
          </dl>
          ${showForm ? `
            <form class="license-form" id="licenseActivationForm">
              <label>Approved email
                <input type="email" name="email" autocomplete="email" required placeholder="pilot@example.org">
              </label>
              <label>Activation code
                <input type="text" name="code" autocomplete="one-time-code" required placeholder="PILOT-XXXX-XXXX">
              </label>
              <label>Device name
                <input type="text" name="deviceName" maxlength="120" placeholder="Sanctuary Mac">
              </label>
              <div class="button-row">
                <button class="action-button" type="submit">Activate pilot licence</button>
                ${status?.licenceId ? '<button class="secondary-button" type="button" data-license-action="deactivate">Deactivate on this device</button>' : ''}
              </div>
            </form>
          ` : `
            <div class="button-row">
              <button class="secondary-button" type="button" data-license-action="continue">Continue to dashboard</button>
              <button class="secondary-button" type="button" data-license-action="deactivate">Deactivate on this device</button>
            </div>
          `}
          <p class="license-footnote">Need help? Contact your VaChinoda pilot administrator. Local hymn and Bible data are never deleted when a licence expires.</p>
        </div>
      </div>
    `;
  }

  function renderSettingsPanel(status) {
    if (!status) return '';
    const watermark = status.watermark || null;
    return `
      <section class="section license-settings-panel">
        <h3>Controlled Pilot Licence</h3>
        <dl class="meta-list">
          <div><dt>Status</dt><dd>${escapeHtml(STATUS_LABELS[status.status] || status.status)}</dd></div>
          <div><dt>Organisation</dt><dd>${escapeHtml(status.organisationName || '—')}</dd></div>
          <div><dt>Pilot ID</dt><dd><code>${escapeHtml(status.licenceId || '—')}</code></dd></div>
          <div><dt>Expires</dt><dd>${escapeHtml(status.expiresAt ? new Date(status.expiresAt).toLocaleString() : '—')}</dd></div>
          <div><dt>Offline grace ends</dt><dd>${escapeHtml(status.offlineGraceDeadline ? new Date(status.offlineGraceDeadline).toLocaleString() : '—')}</dd></div>
        </dl>
        ${watermark ? `
          <div class="license-watermark-panel" aria-label="Pilot licence watermark">
            ${watermark.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          </div>
        ` : ''}
        <div class="button-row">
          <button class="secondary-button" type="button" data-command="license-validate">Validate licence now</button>
          <button class="secondary-button" type="button" data-command="license-deactivate">Deactivate on this device</button>
        </div>
      </section>
    `;
  }

  function renderPresenterWatermark(status) {
    if (!status?.canPresent || !status?.organisationName) return '';
    return `
      <div class="license-presenter-watermark" aria-hidden="true">
        Controlled Pilot — ${escapeHtml(status.organisationName)}
      </div>
    `;
  }

  global.CISLicenseUI = {
    renderActivationOverlay,
    renderSettingsPanel,
    renderPresenterWatermark,
    STATUS_LABELS,
  };
})(window);
