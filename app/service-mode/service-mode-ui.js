(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function statusPill(label, status, detail) {
    const statusClass = status === "ready" || status === "active" || status === "connected"
      ? "is-ready"
      : status === "warning" || status === "loading"
        ? "is-warning"
        : status === "off" || status === "inactive"
          ? "is-off"
          : "is-unknown";
    return `
      <div class="service-status-pill ${statusClass}" role="status" aria-label="${escapeHtml(label)}: ${escapeHtml(detail || status)}">
        <span class="service-status-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(detail || status)}</strong>
      </div>
    `;
  }

  function renderEmergencyStrip() {
    return `
      <nav class="service-emergency-strip" aria-label="Emergency controls">
        <button class="service-emergency-btn live-touch-btn" type="button" data-command="emergency-clear" aria-label="Clear congregation output">Clear</button>
        <button class="service-emergency-btn live-touch-btn" type="button" data-command="emergency-logo" aria-label="Show logo screen">Show Logo</button>
        <button class="service-emergency-btn live-touch-btn" type="button" data-command="emergency-black" data-confirm="true" aria-label="Blackout congregation outputs">Blackout</button>
        <button class="service-emergency-btn live-touch-btn" type="button" data-command="hymn-restore-previous" aria-label="Restore previous hymn">Restore</button>
        <button class="service-emergency-btn live-touch-btn" type="button" data-command="presenter-open-output" aria-label="Restart congregation output">Restart Output</button>
        <button class="service-emergency-btn service-emergency-help live-touch-btn" type="button" data-command="help-open-emergency" aria-label="Open Emergency Help">Emergency Help</button>
      </nav>
    `;
  }

  function renderLivePanel(live) {
    const item = live || { type: "none", title: "Nothing Live", position: "", destinations: "—", status: "inactive" };
    return `
      <article class="service-mode-panel service-mode-panel-live" aria-labelledby="serviceLiveHeading">
        <header class="service-mode-panel-head">
          <h3 id="serviceLiveHeading">Currently Live</h3>
          <span class="service-mode-type-badge" aria-label="Content type">${escapeHtml(item.typeLabel || item.type || "None")}</span>
        </header>
        <p class="service-mode-primary"><strong>${escapeHtml(item.title || "Nothing Live")}</strong></p>
        <p class="service-mode-meta">${escapeHtml(item.position || "No active stanza or verse")}</p>
        <p class="service-mode-meta">Outputs: ${escapeHtml(item.destinations || "—")}</p>
        <div class="service-mode-transport button-row live-touch-row">
          <button class="secondary-button service-touch-btn" type="button" data-command="presenter-prev" aria-label="Previous stanza or verse">Previous</button>
          <button class="secondary-button service-touch-btn" type="button" data-command="presenter-next" aria-label="Next stanza or verse">Next</button>
          <button class="secondary-button service-touch-btn" type="button" data-command="show-chorus" aria-label="Show chorus">Chorus</button>
          <button class="secondary-button service-touch-btn" type="button" data-command="emergency-clear" aria-label="Clear live output">Clear Live</button>
        </div>
      </article>
    `;
  }

  function renderPreviewPanel(preview) {
    const item = preview || null;
    return `
      <article class="service-mode-panel" aria-labelledby="servicePreviewHeading">
        <header class="service-mode-panel-head">
          <h3 id="servicePreviewHeading">Preview</h3>
          ${item?.status ? `<span class="service-readiness" aria-label="Readiness">${escapeHtml(item.status)}</span>` : ""}
        </header>
        ${item
    ? `
          <p class="service-mode-primary"><strong>${escapeHtml(item.title || "Prepared content")}</strong></p>
          <p class="service-mode-meta">${escapeHtml(item.meta || "")}</p>
          <p class="service-mode-meta">Layout: ${escapeHtml(item.layout || "Default")}</p>
          <p class="service-mode-meta">Outputs: ${escapeHtml(item.destinations || "Preview only")}</p>
          <div class="button-row">
            ${item.openCommand ? `<button class="secondary-button service-touch-btn" type="button" data-command="${escapeHtml(item.openCommand)}">Open</button>` : ""}
            ${item.clearCommand ? `<button class="secondary-button service-touch-btn" type="button" data-command="${escapeHtml(item.clearCommand)}">Clear Preview</button>` : ""}
          </div>
        `
    : `<p class="muted">No content in Preview. Search for a hymn or Bible passage to prepare.</p>`}
      </article>
    `;
  }

  function renderNextPanel(next) {
    const item = next || null;
    return `
      <article class="service-mode-panel service-mode-panel-next" aria-labelledby="serviceNextHeading">
        <header class="service-mode-panel-head">
          <h3 id="serviceNextHeading">Next</h3>
          ${item?.status ? `<span class="service-readiness" aria-label="Readiness">${escapeHtml(item.status)}</span>` : ""}
        </header>
        ${item
    ? `
          <p class="service-mode-primary"><strong>${escapeHtml(item.title || "Next item")}</strong></p>
          <p class="service-mode-meta">${escapeHtml(item.meta || "")}</p>
          <div class="button-row">
            ${item.previewCommand ? `<button class="secondary-button service-touch-btn" type="button" data-command="${escapeHtml(item.previewCommand)}" ${item.previewData ? `data-song-key="${escapeHtml(item.previewData)}"` : ""} ${item.previewDataSlot != null ? `data-slot="${escapeHtml(String(item.previewDataSlot))}"` : ""}>Preview</button>` : ""}
            ${item.changeCommand ? `<button class="secondary-button service-touch-btn" type="button" data-command="${escapeHtml(item.changeCommand)}" ${item.changeDataSlot != null ? `data-slot="${escapeHtml(String(item.changeDataSlot))}"` : ""}>Change</button>` : ""}
            ${item.removeCommand ? `<button class="secondary-button service-touch-btn" type="button" data-command="${escapeHtml(item.removeCommand)}">Remove</button>` : ""}
            ${item.takeCommand ? `<button class="action-button service-touch-btn" type="button" data-command="${escapeHtml(item.takeCommand)}" ${item.takeDataSlot != null ? `data-slot="${escapeHtml(String(item.takeDataSlot))}"` : ""} ${item.takeDisabled ? "disabled" : ""}>Take Next Live</button>` : ""}
          </div>
        `
    : `<p class="muted">Set a hymn or service item as Next without changing Live output.</p>`}
      </article>
    `;
  }

  function renderQuickSearch() {
    return `
      <section class="service-quick-search" aria-label="Quick search">
        <h4>Quick Search</h4>
        <div class="service-quick-search-row">
          <button class="secondary-button service-touch-btn" type="button" data-view="search">Hymn Search</button>
          <button class="secondary-button service-touch-btn" type="button" data-command="open-bible-live">Bible Search</button>
          <button class="secondary-button service-touch-btn" type="button" data-view="index">Hymn Index</button>
        </div>
        <p class="muted">Search and preview without changing what is currently Live.</p>
      </section>
    `;
  }

  function renderQueuePanel(queue) {
    const items = Array.isArray(queue) ? queue : [];
    return `
      <section class="service-queue-panel" aria-label="Service queue">
        <h4>Service Queue <span class="muted">(${items.length})</span></h4>
        <div class="service-queue-list" role="list">
          ${items.length
    ? items.map((item, index) => `
              <div class="service-queue-row" role="listitem">
                <span class="service-queue-index" aria-hidden="true">${index + 1}</span>
                <div class="service-queue-copy">
                  <strong>${escapeHtml(item.title || "Queue item")}</strong>
                  <p class="muted">${escapeHtml(item.meta || "")}</p>
                </div>
                <div class="button-row service-queue-actions" role="group" aria-label="Queue item actions for ${escapeHtml(item.title || "item")}">
                  <button class="secondary-button service-touch-btn" type="button" data-command="hymn-queue-top" data-queue-id="${escapeHtml(item.id || "")}" ${index === 0 ? "disabled" : ""} aria-label="Move to top">Top</button>
                  <button class="secondary-button service-touch-btn" type="button" data-command="hymn-queue-up" data-queue-id="${escapeHtml(item.id || "")}" ${index === 0 ? "disabled" : ""} aria-label="Move up">Up</button>
                  <button class="secondary-button service-touch-btn" type="button" data-command="hymn-queue-down" data-queue-id="${escapeHtml(item.id || "")}" ${index >= items.length - 1 ? "disabled" : ""} aria-label="Move down">Down</button>
                  <button class="secondary-button service-touch-btn" type="button" data-command="hymn-queue-bottom" data-queue-id="${escapeHtml(item.id || "")}" ${index >= items.length - 1 ? "disabled" : ""} aria-label="Move to bottom">Bottom</button>
                  <button class="secondary-button service-touch-btn" type="button" data-command="hymn-queue-set-next" data-queue-id="${escapeHtml(item.id || "")}" aria-label="Set as Next">Next</button>
                  <button class="secondary-button service-touch-btn warn-touch-btn" type="button" data-command="hymn-queue-remove" data-queue-id="${escapeHtml(item.id || "")}" aria-label="Remove">Remove</button>
                </div>
              </div>
            `).join("")
    : `<p class="muted">Queue is empty. Add hymns from search or the worship plan.</p>`}
        </div>
      </section>
    `;
  }

  function renderStatusBar(status) {
    const s = status || {};
    return `
      <div class="service-status-bar" role="group" aria-label="Output status">
        ${statusPill("Local Outputs", s.projectorStatus || "unknown", s.projectorDetail || "—")}
        ${statusPill("Stage Display", s.stageStatus || "unknown", s.stageDetail || "—")}
        ${s.obsEnabled ? statusPill("OBS", s.obsStatus || "unknown", s.obsDetail || "—") : ""}
        ${s.streaming ? statusPill("Internet Streaming", s.streamingStatus || "off", s.streamingDetail || "Off") : ""}
      </div>
    `;
  }

  function renderWorkspace(ctx) {
    const context = ctx || {};
    return `
      <section class="service-mode-workspace" aria-label="Service Mode workspace">
        <header class="service-mode-header">
          <div>
            <p class="eyebrow">${escapeHtml(context.appName || "VaChinoda Worship App")} — SERVICE MODE</p>
            <h2>Live Worship Control</h2>
            <p class="muted">Current Live, Preview and Next stay separate. Emergency controls are always available.</p>
            ${context.quietServiceModeActive ? `<p class="quiet-service-mode-inline-note" role="status">QUIET SERVICE MODE ACTIVE — background interruptions suppressed.</p>` : ""}
          </div>
          <div class="service-mode-header-actions">
            <button class="secondary-button service-touch-btn" type="button" data-command="${context.quietServiceModeActive ? "quiet-service-mode-exit" : "quiet-service-mode-enter"}">${context.quietServiceModeActive ? "Exit Quiet Service Mode" : "Enter Quiet Service Mode"}</button>
            <button class="secondary-button service-touch-btn" type="button" data-command="service-mode-exit">Exit Service Mode</button>
          </div>
        </header>

        ${context.pendingRestoreConfirm ? `
          <div class="service-restore-banner" role="alert">
            <p>Service Mode was active before the last session ended. Outputs were not restored automatically.</p>
            <div class="button-row">
              <button class="action-button" type="button" data-command="service-mode-confirm-restore">Resume Service Mode</button>
              <button class="secondary-button" type="button" data-command="service-mode-dismiss-restore">Start Fresh</button>
            </div>
          </div>
        ` : ""}

        ${renderStatusBar(context.status)}

        <div class="service-mode-trio">
          ${renderLivePanel(context.live)}
          ${renderPreviewPanel(context.preview)}
          ${renderNextPanel(context.next)}
        </div>

        ${renderEmergencyStrip()}

        <div class="service-mode-secondary-grid">
          ${renderQuickSearch()}
          ${renderQueuePanel(context.queue)}
          ${context.mediaControls || ""}
          ${context.localPresentation || ""}
        </div>
      </section>
    `;
  }

  window.CISServiceModeUI = {
    configure,
    renderWorkspace,
    renderEmergencyStrip,
    renderStatusBar,
  };
})();
