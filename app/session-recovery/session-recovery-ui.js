(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let modalRoot = null;
  let onAction = null;

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
    if (options?.modalRoot) modalRoot = options.modalRoot;
    if (options?.onAction) onAction = options.onAction;
  }

  function formatSavedAt(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat([], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch (_error) {
      return iso;
    }
  }

  function renderRecoveryScreen(offer) {
    const labels = offer?.labels || {};
    const corrupt = offer?.corruptReport
      ? `<p class="session-recovery-warning" role="alert">Latest snapshot was corrupt. Showing ${escapeHtml(offer.source)} snapshot instead.</p>`
      : "";
    return `
      <div class="modal-backdrop session-recovery-backdrop" data-command="close-modal">
        <section class="modal session-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="session-recovery-title">
          <header class="modal-head">
            <h2 id="session-recovery-title">A worship session was interrupted.</h2>
            <p class="muted">Last saved: <strong>${escapeHtml(formatSavedAt(offer?.savedAt))}</strong></p>
          </header>
          ${corrupt}
          <div class="session-recovery-summary">
            <div><span class="eyebrow">Previous Live</span><strong>${escapeHtml(labels.previousLive || "—")}</strong></div>
            <div><span class="eyebrow">Next</span><strong>${escapeHtml(labels.next || "—")}</strong></div>
            <div><span class="eyebrow">Preview</span><strong>${escapeHtml(labels.preview || "—")}</strong></div>
            <div><span class="eyebrow">Queue</span><strong>${escapeHtml(String(labels.queueCount || 0))} item(s)</strong></div>
          </div>
          <p class="muted">Restoration will not automatically send content to projectors. Confirm before reopening outputs or restoring Live.</p>
          <div class="button-row">
            <button class="action-button" type="button" data-command="session-recovery-restore">Restore Session</button>
            <button class="secondary-button" type="button" data-command="session-recovery-review">Review Before Restoring</button>
            <button class="secondary-button" type="button" data-command="session-recovery-open-without">Open Without Restoring</button>
            <button class="secondary-button" type="button" data-command="session-recovery-discard">Discard Recovery</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderReviewPanel(offer, inspection) {
    const labels = offer?.labels || {};
    const items = (inspection?.items || []).map((item) => `
      <li class="session-recovery-review-item ${item.available ? "available" : "missing"}">
        <strong>${escapeHtml(item.label || item.id)}</strong>
        <span>${escapeHtml(item.detail || "")}</span>
        ${item.available ? "" : `<span class="status-pill awaiting">Unavailable</span>`}
      </li>
    `).join("");
    const warnings = (inspection?.warnings || []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");

    return `
      <div class="modal-backdrop session-recovery-backdrop" data-command="close-modal">
        <section class="modal session-recovery-modal wide" role="dialog" aria-modal="true" aria-labelledby="session-recovery-review-title">
          <header class="modal-head">
            <h2 id="session-recovery-review-title">Review recovery snapshot</h2>
            <p class="muted">Saved ${escapeHtml(formatSavedAt(offer?.savedAt))}</p>
          </header>
          <div class="session-recovery-review-grid">
            <article class="panel">
              <h3>Live state</h3>
              <dl>
                <div><dt>Previous Live</dt><dd>${escapeHtml(labels.previousLive || "—")}</dd></div>
                <div><dt>Preview</dt><dd>${escapeHtml(labels.preview || "—")}</dd></div>
                <div><dt>Next</dt><dd>${escapeHtml(labels.next || "—")}</dd></div>
                <div><dt>Queue</dt><dd>${escapeHtml(String(labels.queueCount || 0))}</dd></div>
              </dl>
            </article>
            <article class="panel">
              <h3>Availability</h3>
              <ul class="session-recovery-review-list">${items || "<li>All referenced items appear available.</li>"}</ul>
              ${warnings ? `<ul class="session-recovery-warning-list">${warnings}</ul>` : ""}
            </article>
          </div>
          <fieldset class="session-recovery-output-options">
            <legend>Output recovery (requires confirmation)</legend>
            <label class="checkbox-row"><input type="checkbox" id="sessionRecoveryRestoreLive"> Restore previous Live item after confirmation</label>
            <label class="checkbox-row"><input type="checkbox" id="sessionRecoveryReopenProjector"> Reopen projector output</label>
            <label class="checkbox-row"><input type="checkbox" id="sessionRecoveryReopenStage"> Restore Stage Display separately</label>
            <label class="checkbox-row"><input type="checkbox" id="sessionRecoveryReconnectObs"> Reconnect OBS separately (no auto stream/record)</label>
          </fieldset>
          <div class="button-row">
            <button class="action-button" type="button" data-command="session-recovery-restore-reviewed">Restore Selected Options</button>
            <button class="secondary-button" type="button" data-command="session-recovery-back">Back</button>
            <button class="secondary-button" type="button" data-command="session-recovery-discard">Discard Recovery</button>
          </div>
        </section>
      </div>
    `;
  }

  function openRecoveryScreen(offer) {
    if (!modalRoot) return;
    modalRoot.innerHTML = renderRecoveryScreen(offer);
    modalRoot.classList.remove("hidden");
    modalRoot.setAttribute("aria-hidden", "false");
  }

  function openReviewScreen(offer, inspection) {
    if (!modalRoot) return;
    modalRoot.innerHTML = renderReviewPanel(offer, inspection);
    modalRoot.classList.remove("hidden");
    modalRoot.setAttribute("aria-hidden", "false");
  }

  function closeRecoveryScreen() {
    if (!modalRoot) return;
    modalRoot.innerHTML = "";
    modalRoot.classList.add("hidden");
    modalRoot.setAttribute("aria-hidden", "true");
  }

  function readReviewOptions() {
    return {
      restoreLive: Boolean(document.getElementById("sessionRecoveryRestoreLive")?.checked),
      reopenProjector: Boolean(document.getElementById("sessionRecoveryReopenProjector")?.checked),
      reopenStageDisplay: Boolean(document.getElementById("sessionRecoveryReopenStage")?.checked),
      reconnectObs: Boolean(document.getElementById("sessionRecoveryReconnectObs")?.checked),
      openOutputs: Boolean(document.getElementById("sessionRecoveryReopenProjector")?.checked
        || document.getElementById("sessionRecoveryReopenStage")?.checked),
    };
  }

  window.CISSessionRecoveryUI = {
    configure,
    renderRecoveryScreen,
    renderReviewPanel,
    openRecoveryScreen,
    openReviewScreen,
    closeRecoveryScreen,
    readReviewOptions,
    formatSavedAt,
  };
})();
