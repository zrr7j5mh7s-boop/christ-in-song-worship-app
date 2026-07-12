(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function statusBadge(status) {
    const map = {
      ready: "Ready",
      loading: "Loading",
      missing: "Missing",
      invalid: "Invalid",
    };
    return map[status] || status || "";
  }

  function renderQueueActions(songKey, compact) {
    if (!songKey) return "";
    const cls = compact ? "hymn-queue-actions compact" : "hymn-queue-actions";
    return `
      <div class="${cls}" role="group" aria-label="Hymn queue actions">
        <button class="secondary-button" type="button" data-command="hymn-preview" data-song-key="${escapeHtml(songKey)}">Preview</button>
        <button class="secondary-button" type="button" data-command="hymn-set-next" data-song-key="${escapeHtml(songKey)}">Set as Next</button>
        <button class="secondary-button" type="button" data-command="hymn-add-queue" data-song-key="${escapeHtml(songKey)}">Add to Queue</button>
              <button class="secondary-button" type="button" data-command="hymn-send-live" data-song-key="${escapeHtml(songKey)}">Send Live</button>
      </div>
    `;
  }

  function renderItemRow(item, role) {
    if (!item) return `<p class="muted">None prepared.</p>`;
    return `
      <div class="hymn-queue-item ${item.status === "missing" ? "is-missing" : ""}" data-queue-id="${escapeHtml(item.id)}" data-role="${escapeHtml(role)}">
        <div class="hymn-queue-item-head">
          <strong>${escapeHtml(item.shortLabel || item.title || "Hymn")}</strong>
          <span class="hymn-queue-status" aria-label="Readiness">${escapeHtml(statusBadge(item.status))}</span>
        </div>
        <p class="muted hymn-queue-meta">Hymn ${escapeHtml(item.hymnNumber || "")}${item.startSlideIndex ? ` · Stanza ${item.startSlideIndex + 1}` : ""}</p>
        ${item.error ? `<p class="hymn-queue-error" role="alert">${escapeHtml(item.error)}</p>` : ""}
      </div>
    `;
  }

  function renderWorkspace(options) {
    const {
      queueState,
      liveMeta,
      showQuickSearch,
    } = options || {};
    const preview = queueState?.preview;
    const next = queueState?.next;
    const queue = queueState?.queue || [];
    const history = queueState?.history || [];
    const live = liveMeta || {};

    return `
      <section class="live-hymn-workspace" aria-label="Live hymn queue workspace">
        <header class="live-hymn-workspace-head">
          <div>
            <p class="eyebrow">Live Hymn Control</p>
            <h3>Hymn Queue</h3>
          </div>
          ${queueState?.lastError ? `<p class="hymn-queue-error" role="alert">${escapeHtml(queueState.lastError)}</p>` : ""}
        </header>

        <article class="live-hymn-panel live-hymn-panel-live" aria-live="polite">
          <h4>Currently Live</h4>
          ${live.songKey
    ? `
            <p><strong>${escapeHtml(live.shortLabel || live.title || "Hymn")}</strong></p>
            <p class="muted">${escapeHtml(live.stanzaLabel || "")}</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="presenter-prev">Previous Stanza</button>
              <button class="secondary-button" type="button" data-command="presenter-next">Next Stanza</button>
              <button class="secondary-button" type="button" data-command="emergency-clear">Clear</button>
            </div>
          `
    : `<p class="muted">No hymn is currently Live.</p>`}
        </article>

        <article class="live-hymn-panel" aria-label="Preview hymn">
          <h4>Preview</h4>
          ${renderItemRow(preview, "preview")}
          ${preview?.songKey ? `
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="hymn-preview-open" data-song-key="${escapeHtml(preview.songKey)}">Open</button>
              <button class="secondary-button" type="button" data-command="hymn-preview-clear">Clear Preview</button>
            </div>
          ` : ""}
        </article>

        <article class="live-hymn-panel live-hymn-panel-next" aria-label="Next hymn">
          <h4>Next Hymn</h4>
          ${renderItemRow(next, "next")}
          <div class="button-row">
            ${next?.songKey ? `
              <button class="secondary-button" type="button" data-command="hymn-preview" data-song-key="${escapeHtml(next.songKey)}">Preview</button>
              <button class="secondary-button" type="button" data-command="hymn-remove-next">Remove</button>
              <button class="action-button" type="button" data-command="hymn-take-next" ${next.status !== "ready" ? "disabled" : ""}>Take Next Live</button>
            ` : `<span class="muted">Set a hymn as Next from search or the hymn page.</span>`}
          </div>
        </article>

        <article class="live-hymn-panel" aria-label="Upcoming queue">
          <h4>Upcoming Queue <span class="muted">(${queue.length})</span></h4>
          <div class="hymn-queue-list">
            ${queue.length
    ? queue.map((item, index) => `
                <div class="hymn-queue-list-row" data-queue-id="${escapeHtml(item.id)}">
                  <span class="hymn-queue-index">${index + 1}.</span>
                  ${renderItemRow(item, "queue")}
                  <div class="button-row">
                    <button class="secondary-button" type="button" data-command="hymn-queue-up" data-queue-id="${escapeHtml(item.id)}" ${index === 0 ? "disabled" : ""}>Up</button>
                    <button class="secondary-button" type="button" data-command="hymn-queue-down" data-queue-id="${escapeHtml(item.id)}" ${index >= queue.length - 1 ? "disabled" : ""}>Down</button>
                    <button class="secondary-button" type="button" data-command="hymn-queue-set-next" data-queue-id="${escapeHtml(item.id)}">Set as Next</button>
                    <button class="secondary-button" type="button" data-command="hymn-queue-duplicate" data-queue-id="${escapeHtml(item.id)}">Duplicate</button>
                    <button class="secondary-button" type="button" data-command="hymn-queue-send-live" data-queue-id="${escapeHtml(item.id)}">Send Live</button>
                    <button class="secondary-button" type="button" data-command="hymn-queue-remove" data-queue-id="${escapeHtml(item.id)}">Remove</button>
                  </div>
                </div>
              `).join("")
    : `<p class="muted">Queue is empty.</p>`}
          </div>
          ${queue.length ? `<button class="secondary-button" type="button" data-command="hymn-clear-queue">Clear Queue</button>` : ""}
        </article>

        ${history.length ? `
          <details class="live-hymn-history">
            <summary>Live hymn history (${history.length})</summary>
            <div class="hymn-queue-list">
              ${history.slice(0, 8).map((item) => `
                <div class="hymn-queue-list-row">
                  ${renderItemRow(item, "history")}
                  <div class="button-row">
                    <button class="secondary-button" type="button" data-command="hymn-restore-previous" data-song-key="${escapeHtml(item.songKey)}">Restore</button>
                    <button class="secondary-button" type="button" data-command="hymn-set-next" data-song-key="${escapeHtml(item.songKey)}">Set as Next</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </details>
        ` : ""}

        ${showQuickSearch ? `
          <article class="live-hymn-quick-search">
            <h4>Quick Hymn Search</h4>
            <p class="muted">Use global search or the Hymn Index while a hymn remains Live. Preview and queue actions do not change Live output.</p>
          </article>
        ` : ""}
      </section>
    `;
  }

  function renderCompactNextPanel(queueState) {
    const next = queueState?.next;
    if (!next) {
      return `
        <article class="av-preview-card hymn-queue-compact">
          <span>Next hymn</span>
          <strong>None prepared</strong>
          <p class="muted">Set a hymn as Next without changing Live output.</p>
        </article>
      `;
    }
    return `
      <article class="av-preview-card hymn-queue-compact">
        <span>Next hymn</span>
        <strong>${escapeHtml(next.shortLabel || next.title)}</strong>
        <p>${escapeHtml(statusBadge(next.status))} · Hymn ${escapeHtml(next.hymnNumber || "")}</p>
        <div class="button-row">
          <button class="secondary-button" type="button" data-command="hymn-take-next" ${next.status !== "ready" ? "disabled" : ""}>Take Next Live</button>
          <button class="secondary-button" type="button" data-command="hymn-remove-next">Remove</button>
        </div>
      </article>
    `;
  }

  window.CISLiveHymnQueueUI = {
    configure,
    renderWorkspace,
    renderCompactNextPanel,
    renderQueueActions,
  };
})();
