(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options && options.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderPreviewRow(item, index, sectionOffset) {
    const number = sectionOffset + index + 1;
    const slideLabel = item.slideCount
      ? `${item.slideCount} slide${item.slideCount === 1 ? "" : "s"}`
      : "";
    const statusClass = item.ready ? "ready" : "pending";
    return `
      <li class="order-preview-item ${statusClass}">
        <span class="order-preview-number">${number}</span>
        <div class="order-preview-body">
          <div class="order-preview-head">
            <strong>${escapeHtml(item.role)}</strong>
            ${item.typeBadge ? `<span class="order-preview-type">${item.typeBadge}</span>` : ""}
          </div>
          <span class="order-preview-detail">${escapeHtml(item.detail)}</span>
          ${slideLabel ? `<span class="order-preview-slides">${escapeHtml(slideLabel)}</span>` : ""}
        </div>
      </li>
    `;
  }

  function renderOrderPreview(model) {
    const {
      expanded,
      songServiceItems,
      worshipItems,
      totalSlides,
      assignedCount,
      totalItems,
    } = model;
    const songRows = (songServiceItems || []).map((item, index) => renderPreviewRow(item, index, 0)).join("");
    const worshipRows = (worshipItems || []).map((item, index) => renderPreviewRow(item, index, songServiceItems.length)).join("");
    const body = expanded
      ? `
        <div class="order-preview-body-panel">
          ${songServiceItems.length ? `
            <div class="order-preview-section">
              <h4>Song Service <span class="muted">(${songServiceItems.length})</span></h4>
              <ol class="order-preview-list">${songRows}</ol>
            </div>
          ` : ""}
          <div class="order-preview-section">
            <h4>Order of Service <span class="muted">(${worshipItems.length})</span></h4>
            <ol class="order-preview-list" start="${songServiceItems.length + 1}">${worshipRows}</ol>
          </div>
          <div class="order-preview-summary">
            <span>${assignedCount} of ${totalItems} items ready</span>
            <span>${totalSlides} projector slide${totalSlides === 1 ? "" : "s"} total</span>
          </div>
        </div>
      `
      : `
        <p class="muted order-preview-teaser">${totalItems} service items · ${assignedCount} ready · ${totalSlides} slides — expand to review the full flow.</p>
      `;

    return `
      <section class="order-preview-panel ${expanded ? "expanded" : "collapsed"}">
        <div class="order-preview-header">
          <div>
            <p class="eyebrow">Full Order Preview</p>
            <h3>Service timeline</h3>
          </div>
          <button class="secondary-button" type="button" data-command="toggle-order-preview" aria-expanded="${expanded ? "true" : "false"}">
            ${expanded ? "Collapse" : "Expand preview"}
          </button>
        </div>
        ${body}
      </section>
    `;
  }

  function renderSaveIndicator(status, label) {
    const safeStatus = status || "saved";
    const safeLabel = label || (safeStatus === "saving" ? "Saving…" : "Saved");
    return `<span class="builder-save-status" data-status="${escapeHtml(safeStatus)}" role="status" aria-live="polite">${escapeHtml(safeLabel)}</span>`;
  }

  window.CISBuilderOrderPreview = {
    configure,
    renderOrderPreview,
    renderSaveIndicator,
  };
})();
