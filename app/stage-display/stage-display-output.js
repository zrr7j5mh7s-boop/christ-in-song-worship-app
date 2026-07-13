(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function statusClass(meta) {
    const value = String(meta || "").toLowerCase();
    if (["live", "active", "ready", "connected"].includes(value)) return "is-live";
    if (["muted", "warning", "paused"].includes(value)) return "is-warning";
    if (["off", "unknown", "idle"].includes(value)) return "is-idle";
    return "is-neutral";
  }

  function renderBlock(id, block) {
    if (!block) return "";
    const statusIcon = block.statusIcon
      ? `<span class="stage-display-status-icon ${statusClass(block.meta)}" aria-hidden="true">${escapeHtml(block.statusIcon)}</span>`
      : "";
    return `
      <section class="stage-display-block stage-display-block-${escapeHtml(id)}" aria-labelledby="stage-block-${escapeHtml(id)}">
        <header class="stage-display-block-head">
          <span class="stage-display-block-label" id="stage-block-${escapeHtml(id)}">${escapeHtml(block.label || "")}</span>
          ${statusIcon}
        </header>
        <div class="stage-display-block-title">${escapeHtml(block.title || "—")}</div>
        ${block.body ? `<div class="stage-display-block-body">${escapeHtml(block.body)}</div>` : ""}
        ${block.meta && !block.statusIcon ? `<div class="stage-display-block-meta">${escapeHtml(block.meta)}</div>` : ""}
      </section>
    `;
  }

  function renderPrivateMessage(message) {
    if (!message?.text) return "";
    return `
      <aside class="stage-display-private-message" role="status" aria-live="polite">
        <span class="stage-display-private-label">Operator</span>
        <p>${escapeHtml(message.text)}</p>
      </aside>
    `;
  }

  function render(snapshot) {
    if (!snapshot) return "";
    const layout = snapshot.layout || "current-and-next";
    const blocks = snapshot.modules || [];
    const content = blocks.map((id) => renderBlock(id, snapshot.blocks?.[id])).join("");
    const warning = snapshot.countdown?.warning ? " is-countdown-warning" : "";
    const disconnected = snapshot.connected === false ? " is-disconnected" : "";
    const message = renderPrivateMessage(snapshot.privateMessage);

    return `
      <div class="stage-display-shell layout-${escapeHtml(layout)}${warning}${disconnected}" data-layout="${escapeHtml(layout)}">
        <div class="stage-display-safe-area">
          <header class="stage-display-header">
            <strong>Stage Display</strong>
            <span class="stage-display-layout-name">${escapeHtml(snapshot.layoutLabel || layout)}</span>
          </header>
          <div class="stage-display-grid" role="list">
            ${content || `<div class="stage-display-empty">No modules configured for this layout.</div>`}
          </div>
          ${message}
          ${snapshot.connected === false ? `<div class="stage-display-reconnect" role="status">Display disconnected — waiting to restore…</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderTestPattern(label) {
    return `
      <div class="stage-display-shell layout-test">
        <div class="stage-display-safe-area">
          <header class="stage-display-header"><strong>Stage Display Test</strong></header>
          <div class="stage-display-test-body">
            <p>${escapeHtml(label || "Test pattern")}</p>
            <p class="stage-display-test-hint">This output is private to the stage team.</p>
          </div>
        </div>
      </div>
    `;
  }

  function requestFullscreen(root) {
    const target = root || document.documentElement;
    if (!target) return;
    if (document.fullscreenElement === target && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
  }

  window.CISStageDisplayOutput = {
    configure,
    render,
    renderTestPattern,
    requestFullscreen,
  };
})();
