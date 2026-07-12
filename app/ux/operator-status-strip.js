(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function pill(item) {
    const tone = item.tone || "unknown";
    const icon = item.icon ? `<span class="operator-status-icon" aria-hidden="true">${item.icon}</span>` : "";
    return `
      <div class="operator-status-pill is-${escapeHtml(tone)}" role="status" aria-label="${escapeHtml(item.label)}: ${escapeHtml(item.detail || item.value || "")}">
        ${icon}
        <span class="operator-status-label">${escapeHtml(item.label)}</span>
        <strong class="operator-status-value">${escapeHtml(item.value || item.detail || "—")}</strong>
      </div>
    `;
  }

  function render(ctx) {
    const items = (ctx && ctx.items) || [];
    if (!items.length) {
      return `<div class="operator-status-strip is-empty" role="region" aria-label="Operator status"><span class="muted">Status unavailable</span></div>`;
    }
    return `
      <div class="operator-status-strip" role="region" aria-label="Operator status">
        ${items.map(pill).join("")}
      </div>
    `;
  }

  window.CISOperatorStatusStrip = {
    configure,
    render,
  };
})();
