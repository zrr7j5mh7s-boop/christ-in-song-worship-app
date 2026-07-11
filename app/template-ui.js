(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let plain = (value) => String(value || "").trim();
  let itemTypeLabel = (value) => String(value || "Item");

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.plain) plain = options.plain;
    if (options.itemTypeLabel) itemTypeLabel = options.itemTypeLabel;
  }

  function slotSummary(slot) {
    if (!slot) return "Service item";
    if (slot.type === "custom") return slot.title || itemTypeLabel(slot.itemType) || slot.role;
    return slot.role || "Hymn slot";
  }

  function renderTemplateCard(template) {
    const custom = !template.builtin;
    return `
      <article class="template-card ${custom ? "custom" : "builtin"}" data-template-id="${escapeHtml(template.id)}">
        <button class="template-card-hit" type="button" data-command="preview-template" data-template="${escapeHtml(template.id)}">
          <span class="template-card-icon" aria-hidden="true">${escapeHtml(template.icon || "★")}</span>
          <strong>${escapeHtml(template.name)}</strong>
          <span>${escapeHtml(template.detail || `${template.slots.length} service items`)}</span>
          <em>${template.slots.length} items</em>
        </button>
        ${custom ? `
          <div class="template-card-actions">
            <button type="button" data-command="edit-template" data-template="${escapeHtml(template.id)}" title="Edit template">Edit</button>
            <button type="button" data-command="delete-template" data-template="${escapeHtml(template.id)}" title="Delete template">Delete</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderGallery(builtinTemplates, customTemplates) {
    const all = [...builtinTemplates, ...customTemplates];
    return `
      <section class="template-gallery">
        <div class="template-gallery-header">
          <div>
            <p class="eyebrow">Service Templates</p>
            <h2>Choose a worship flow</h2>
            <p class="muted">Preview any template, load it in one click, then drag items to reorder or save your own.</p>
          </div>
          <div class="button-row">
            <button class="action-button" type="button" data-command="save-template">Save Current as Template</button>
            <button class="secondary-button" type="button" data-command="open-template-editor">Template Editor</button>
          </div>
        </div>
        <div class="template-card-grid">
          ${all.map(renderTemplateCard).join("")}
          <article class="template-card template-card-new">
            <button class="template-card-hit" type="button" data-command="open-template-editor">
              <span class="template-card-icon" aria-hidden="true">+</span>
              <strong>Create Custom Template</strong>
              <span>Build a reusable order of service from scratch.</span>
            </button>
          </article>
        </div>
      </section>
    `;
  }

  function renderPreviewModal(template) {
    const slots = (template.slots || []).map((slot, index) => `
      <li>
        <span class="template-preview-index">${index + 1}</span>
        <div>
          <strong>${escapeHtml(slot.role || `Item ${index + 1}`)}</strong>
          <span>${escapeHtml(slotSummary(slot))}</span>
        </div>
      </li>
    `).join("");
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <div class="modal template-preview-modal" role="dialog" aria-modal="true" aria-label="Template preview">
          <div class="song-header">
            <div>
              <span class="template-preview-icon">${escapeHtml(template.icon || "★")}</span>
              <h2>${escapeHtml(template.name)}</h2>
              <p class="muted">${escapeHtml(template.detail || "")}</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <div class="template-preview-body">
            <h3>Order of Service (${template.slots.length} items)</h3>
            <ol class="template-preview-list">${slots}</ol>
          </div>
          <div class="template-preview-footer">
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
            <button class="action-button" type="button" data-command="load-template" data-template="${escapeHtml(template.id)}">Load Template</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEditorSlotRow(slot, index, itemTypes) {
    const isCustom = slot.type === "custom";
    return `
      <div class="template-editor-row" data-editor-row="${index}">
        <button class="drag-handle" type="button" draggable="true" data-drag-editor-row="${index}" aria-label="Drag to reorder">⋮⋮</button>
        <label>
          <span>Role</span>
          <input type="text" data-editor-field="role" data-editor-row="${index}" value="${escapeHtml(slot.role || "")}">
        </label>
        <label>
          <span>Type</span>
          <select data-editor-field="type" data-editor-row="${index}">
            <option value="song" ${!isCustom ? "selected" : ""}>Hymn slot</option>
            <option value="custom" ${isCustom ? "selected" : ""}>Custom item</option>
          </select>
        </label>
        <label class="${isCustom ? "" : "hidden"}">
          <span>Item kind</span>
          <select data-editor-field="itemType" data-editor-row="${index}">
            ${itemTypes.map(([value, label]) => `
              <option value="${escapeHtml(value)}" ${slot.itemType === value ? "selected" : ""}>${escapeHtml(label)}</option>
            `).join("")}
          </select>
        </label>
        <label class="${isCustom ? "" : "hidden"}">
          <span>Title</span>
          <input type="text" data-editor-field="title" data-editor-row="${index}" value="${escapeHtml(slot.title || "")}">
        </label>
        <button type="button" data-command="remove-editor-row" data-editor-row="${index}" title="Remove item">×</button>
      </div>
    `;
  }

  function renderEditorModal(template, itemTypes, mode) {
    const slots = template.slots || [];
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <form class="modal template-editor-modal form-grid" role="dialog" aria-modal="true" aria-label="Template editor" data-command="modal-form">
          <div class="song-header">
            <div>
              <h2>${mode === "edit" ? "Edit Template" : "Create Template"}</h2>
              <p class="muted">Define roles, custom items, and the order of service.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Template name</span>
            <input id="templateEditorName" type="text" value="${escapeHtml(template.name || "")}" placeholder="My Sabbath Flow">
          </label>
          <label>
            <span>Description</span>
            <input id="templateEditorDetail" type="text" value="${escapeHtml(template.detail || "")}" placeholder="Short description for the card">
          </label>
          <label>
            <span>Icon</span>
            <input id="templateEditorIcon" type="text" maxlength="2" value="${escapeHtml(template.icon || "★")}" placeholder="★">
          </label>
          <div class="template-editor-rows" id="templateEditorRows">
            ${slots.map((slot, index) => renderEditorSlotRow(slot, index, itemTypes)).join("")}
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="add-editor-row">Add Item</button>
          </div>
          <div class="template-preview-footer">
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
            <button class="action-button" type="button" data-command="save-template-editor">Save Template</button>
          </div>
        </form>
      </div>
    `;
  }

  function readEditorState(root, itemTypes) {
    const name = root.querySelector("#templateEditorName")?.value?.trim() || "";
    const detail = root.querySelector("#templateEditorDetail")?.value?.trim() || "";
    const icon = root.querySelector("#templateEditorIcon")?.value?.trim() || "★";
    const rows = [...root.querySelectorAll(".template-editor-row")];
    const slots = rows.map((row) => {
      const index = Number(row.dataset.editorRow);
      const role = row.querySelector('[data-editor-field="role"]')?.value?.trim() || `Item ${index + 1}`;
      const type = row.querySelector('[data-editor-field="type"]')?.value || "song";
      const itemType = row.querySelector('[data-editor-field="itemType"]')?.value || itemTypes[0][0];
      const title = row.querySelector('[data-editor-field="title"]')?.value?.trim() || role;
      if (type === "custom") {
        return { role, type: "custom", itemType, title, body: title };
      }
      return { role, type: "song" };
    });
    return { name, detail, icon, slots };
  }

  function bindSlotDragDrop(container, options) {
    if (!container || container.dataset.dragBound === "true") return;
    const config = options || {};
    const handleSelector = config.handleSelector || "[data-drag-slot]";
    const rowSelector = config.rowSelector || ".set-row";
    const indexAttr = config.indexAttr || "slot";
    const onReorder = config.onReorder;
    if (typeof onReorder !== "function") return;

    container.dataset.dragBound = "true";
    let dragIndex = null;

    const readIndex = (node) => Number(node.dataset[indexAttr]);
    const clearDragState = () => {
      dragIndex = null;
      container.querySelectorAll(`${rowSelector}.dragging, ${rowSelector}.drag-over`).forEach((row) => {
        row.classList.remove("dragging", "drag-over");
      });
    };

    container.addEventListener("dragstart", (event) => {
      const handle = event.target.closest(handleSelector);
      if (!handle) return;
      dragIndex = readIndex(handle);
      if (Number.isNaN(dragIndex)) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(dragIndex));
      const row = handle.closest(rowSelector);
      if (row) row.classList.add("dragging");
    });

    container.addEventListener("dragend", () => clearDragState());

    container.addEventListener("dragover", (event) => {
      const row = event.target.closest(rowSelector);
      if (!row) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      container.querySelectorAll(`${rowSelector}.drag-over`).forEach((item) => item.classList.remove("drag-over"));
      row.classList.add("drag-over");
    });

    container.addEventListener("drop", (event) => {
      event.preventDefault();
      const row = event.target.closest(rowSelector);
      if (!row || dragIndex === null) return;
      const dropIndex = readIndex(row);
      if (Number.isNaN(dropIndex) || dropIndex === dragIndex) return;
      onReorder(dragIndex, dropIndex);
      clearDragState();
    });

    container.querySelectorAll(handleSelector).forEach((handle) => {
      if (handle.dataset.keyboardDragBound === "true") return;
      handle.dataset.keyboardDragBound = "true";
      handle.setAttribute("tabindex", "0");
      handle.addEventListener("keydown", (event) => {
        const index = readIndex(handle);
        if (Number.isNaN(index)) return;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onReorder(index, index - 1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onReorder(index, index + 1);
        }
      });
    });
  }

  function bindPlanDragDrop(container, onReorder) {
    bindSlotDragDrop(container, {
      handleSelector: "[data-drag-slot]",
      rowSelector: ".set-row",
      indexAttr: "slot",
      onReorder,
    });
  }

  function bindServiceDragDrop(container, onReorder) {
    bindSlotDragDrop(container, {
      handleSelector: "[data-drag-service-slot]",
      rowSelector: ".song-service-row",
      indexAttr: "serviceSlot",
      onReorder,
    });
  }

  function bindEditorDragDrop(root, onReorder) {
    const container = root.querySelector("#templateEditorRows");
    if (!container || container.dataset.dragBound === "true") return;
    container.dataset.dragBound = "true";
    let dragIndex = null;

    container.addEventListener("dragstart", (event) => {
      const handle = event.target.closest("[data-drag-editor-row]");
      if (!handle) return;
      dragIndex = Number(handle.dataset.dragEditorRow);
      event.dataTransfer.effectAllowed = "move";
      const row = handle.closest(".template-editor-row");
      if (row) row.classList.add("dragging");
    });

    container.addEventListener("dragend", () => {
      dragIndex = null;
      container.querySelectorAll(".template-editor-row.dragging").forEach((row) => row.classList.remove("dragging"));
    });

    container.addEventListener("dragover", (event) => {
      const row = event.target.closest(".template-editor-row");
      if (!row) return;
      event.preventDefault();
    });

    container.addEventListener("drop", (event) => {
      event.preventDefault();
      const row = event.target.closest(".template-editor-row");
      if (!row || dragIndex === null) return;
      const dropIndex = Number(row.dataset.editorRow);
      if (Number.isNaN(dropIndex) || dropIndex === dragIndex) return;
      onReorder(dragIndex, dropIndex);
    });
  }

  window.CISTemplateUI = {
    configure,
    renderGallery,
    renderPreviewModal,
    renderEditorModal,
    renderEditorSlotRow,
    readEditorState,
    bindSlotDragDrop,
    bindPlanDragDrop,
    bindServiceDragDrop,
    bindEditorDragDrop,
    slotSummary,
  };
})();
