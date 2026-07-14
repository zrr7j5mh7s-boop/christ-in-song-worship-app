(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderBindingChip(binding, platform) {
    const formatted = window.CISKeyboardShortcutsRegistry?.formatBinding(binding, platform) || binding;
    return `<kbd class="shortcut-chip">${escapeHtml(formatted)}</kbd>`;
  }

  function renderReferencePanel(state, query) {
    const reg = window.CISKeyboardShortcutsRegistry;
    const service = window.CISKeyboardShortcutsService;
    if (!reg || !service) return "";
    const platform = state?.platform || "web";
    const matches = service.searchActions(query);
    const grouped = {};
    matches.forEach((action) => {
      grouped[action.category] = grouped[action.category] || [];
      grouped[action.category].push(action);
    });

    const categories = Object.keys(reg.CATEGORIES);
    const sections = categories.map((categoryId) => {
      const items = grouped[categoryId] || [];
      if (!items.length) return "";
      return `
        <section class="shortcut-category" aria-labelledby="shortcutCat-${escapeHtml(categoryId)}">
          <h4 id="shortcutCat-${escapeHtml(categoryId)}">${escapeHtml(reg.CATEGORIES[categoryId])}</h4>
          <table class="shortcut-table">
            <thead><tr><th scope="col">Action</th><th scope="col">Shortcut</th></tr></thead>
            <tbody>
              ${items.map((action) => {
                const binding = state?.bindings?.[action.id] || action.defaultBinding;
                return `
                  <tr>
                    <td>
                      <strong>${escapeHtml(action.label)}</strong>
                      <p class="muted">${escapeHtml(action.description)}</p>
                    </td>
                    <td>${renderBindingChip(binding, platform)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </section>
      `;
    }).join("");

    const conflicts = state?.conflicts || [];
    const conflictBlock = conflicts.length
      ? `<div class="shortcut-conflicts" role="alert">
          <strong>Shortcut conflicts detected</strong>
          <ul>${conflicts.map((item) => `<li><code>${escapeHtml(item.binding)}</code> — ${escapeHtml(item.actionIds.join(", "))}</li>`).join("")}</ul>
        </div>`
      : "";

    return `
      <section class="section keyboard-shortcuts-reference" aria-label="Keyboard shortcuts reference">
        <h3>Keyboard Shortcuts</h3>
        <p class="muted">Shortcuts are disabled while typing in search fields, notes, dialogs, and settings forms unless noted below.</p>
        <label class="search-box shortcut-search-box">
          <span aria-hidden="true">⌕</span>
          <input id="shortcutReferenceSearch" type="search" placeholder="Search shortcuts..." value="${escapeHtml(query || "")}" aria-controls="shortcutReferenceResults">
        </label>
        ${conflictBlock}
        <div id="shortcutReferenceResults" class="shortcut-reference-results">
          ${sections || `<p class="muted">No shortcuts match that search.</p>`}
        </div>
      </section>
    `;
  }

  function renderSettingsPanel(state) {
    const reg = window.CISKeyboardShortcutsRegistry;
    const service = window.CISKeyboardShortcutsService;
    if (!reg || !service) return "";
    const platform = state?.platform || "web";
    const actions = reg.ACTIONS.filter((action) => !action.aliasOf);
    const conflicts = state?.conflicts || [];

    return `
      <section class="section keyboard-shortcuts-settings" aria-label="Keyboard shortcut settings">
        <h3>Keyboard Shortcut Settings</h3>
        <p class="muted">Customize operator shortcuts. Legacy presenter shortcuts are preserved by default.</p>
        ${conflicts.length ? `<div class="shortcut-conflicts" role="alert"><strong>${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}</strong> — resolve duplicate bindings below.</div>` : ""}
        <div class="shortcut-settings-list">
          ${actions.map((action) => {
            const binding = state?.bindings?.[action.id] || action.defaultBinding || "";
            return `
              <label class="shortcut-setting-row">
                <span>
                  <strong>${escapeHtml(action.label)}</strong>
                  <small class="muted">${escapeHtml(reg.CATEGORIES[action.category] || action.category)}</small>
                </span>
                <input
                  type="text"
                  data-shortcut-action="${escapeHtml(action.id)}"
                  value="${escapeHtml(binding)}"
                  aria-label="${escapeHtml(action.label)} shortcut"
                  spellcheck="false"
                  autocomplete="off"
                >
                <span class="shortcut-preview">${renderBindingChip(binding, platform)}</span>
              </label>
            `;
          }).join("")}
        </div>
        <div class="button-row">
          <button class="secondary-button" type="button" data-command="shortcut-reset-defaults">Reset to defaults</button>
          <button class="secondary-button" type="button" data-command="shortcut-open-reference">Open shortcut reference</button>
        </div>
      </section>
    `;
  }

  function bindReferenceInteractions(root, callbacks) {
    if (!root) return;
    const input = root.querySelector("#shortcutReferenceSearch");
    if (input && callbacks?.onSearch) {
      input.addEventListener("input", () => callbacks.onSearch(input.value));
    }
  }

  function bindSettingsInteractions(root, callbacks) {
    if (!root) return;
    root.querySelectorAll("[data-shortcut-action]").forEach((field) => {
      field.addEventListener("change", () => {
        if (callbacks?.onBindingChange) {
          callbacks.onBindingChange(field.dataset.shortcutAction, field.value);
        }
      });
    });
  }

  window.CISKeyboardShortcutsUI = {
    configure,
    renderReferencePanel,
    renderSettingsPanel,
    renderBindingChip,
    bindReferenceInteractions,
    bindSettingsInteractions,
  };
})();
