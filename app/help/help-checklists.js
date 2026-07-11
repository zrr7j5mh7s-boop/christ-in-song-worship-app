(function () {
  "use strict";

  function renderChecklist(id, items, escapeHtml) {
    const store = window.CISHelpStore;
    const data = store ? store.getChecklist(id) : { items: {} };
    const progress = store ? store.checklistProgress(id, items.length) : { done: 0, total: items.length, percent: 0 };
    const rows = items.map((item) => {
      const checked = data.items && data.items[item.key] ? "checked" : "";
      const critical = item.critical ? `<span class="help-check-critical" title="Critical item">!</span>` : "";
      const action = item.command
        ? `data-command="${escapeHtml(item.command)}"`
        : (item.article ? `data-help-article="${escapeHtml(item.article)}"` : `data-view="${escapeHtml(item.route || "home")}"`);
      return `
        <label class="help-check-row">
          <input type="checkbox" data-help-checklist="${escapeHtml(id)}" data-help-check-key="${escapeHtml(item.key)}" ${checked}>
          <span>${escapeHtml(item.label)} ${critical}</span>
          <button type="button" class="help-check-link secondary-button" ${action}>Open</button>
        </label>
      `;
    }).join("");

    const dateLine = id === "pre-service" && data.serviceDate
      ? `<p class="muted help-checklist-date">Service date: ${escapeHtml(data.serviceDate)} — progress resets each day.</p>`
      : "";

    return `
      <section class="help-checklist-panel">
        ${dateLine}
        <div class="help-checklist-head">
          <strong>${progress.done} of ${progress.total} complete (${progress.percent}%)</strong>
          <button type="button" class="secondary-button" data-help-checklist-reset="${escapeHtml(id)}">Reset checklist</button>
        </div>
        <div class="help-checklist-progress" aria-hidden="true"><span style="width:${progress.percent}%"></span></div>
        <div class="help-checklist-rows">${rows}</div>
      </section>
    `;
  }

  window.CISHelpChecklists = { renderChecklist };
})();
