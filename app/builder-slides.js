(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let plain = (value) => String(value || "").trim();
  let getSlideTypes = () => [];

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.plain) plain = options.plain;
    if (options.getSlideTypes) getSlideTypes = options.getSlideTypes;
  }

  function renderRichToolbar() {
    return `
      <div class="rich-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" data-rich-command="bold" title="Bold"><strong>B</strong></button>
        <button type="button" data-rich-command="italic" title="Italic"><em>I</em></button>
        <button type="button" data-rich-command="insertLineBreak" title="Line break">↵</button>
        <button type="button" data-rich-command="insertRule" title="New slide (---)">—</button>
      </div>
    `;
  }

  function renderAddContentMenu() {
    const types = getSlideTypes();
    return `
      <div class="add-content-menu">
        ${types.filter((type) => type.id !== "hymn").map((type) => `
          <button type="button" data-command="add-content-item" data-content-type="${escapeHtml(type.id)}">
            <span class="content-type-icon" aria-hidden="true">${escapeHtml(type.icon)}</span>
            <span>${escapeHtml(type.label)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderSlotTypeBadge(slot, resolveType, getTypeMeta) {
    const type = resolveType(slot);
    const meta = getTypeMeta(type);
    return `<span class="content-type-badge ${escapeHtml(meta.projectorClass || "")}" title="${escapeHtml(meta.label)}">${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</span>`;
  }

  function renderEditorModal(slot, index, types, scriptureSuggestions) {
    const type = slot.type || "announcement";
    const isScripture = type === "scripture";
    const datalist = (scriptureSuggestions || []).map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <form class="modal slide-editor-modal form-grid" role="dialog" aria-modal="true" aria-label="Edit service content">
          <div class="song-header">
            <div>
              <h2>${index === null ? "Add Service Content" : "Edit Service Content"}</h2>
              <p class="muted">Use the toolbar for emphasis. Type <code>---</code> on its own line to split into multiple projector slides. Scripture can also auto-split by verse number.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Content type</span>
            <select id="slideEditorType">
              ${types.filter((item) => item.id !== "hymn").map((item) => `
                <option value="${escapeHtml(item.id)}" ${item.id === type ? "selected" : ""}>${escapeHtml(item.icon)} ${escapeHtml(item.label)}</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Role in service</span>
            <input id="slideEditorRole" value="${escapeHtml(slot.role || "")}" placeholder="Scripture Reading">
          </label>
          <label class="${isScripture ? "" : "hidden"}" id="slideEditorRefWrap">
            <span>Scripture reference</span>
            <input id="slideEditorReference" list="scriptureSuggestions" value="${escapeHtml(slot.scriptureRef || slot.title || "")}" placeholder="John 3:16">
            <datalist id="scriptureSuggestions">${datalist}</datalist>
          </label>
          <label class="${isScripture ? "hidden" : ""}" id="slideEditorTitleWrap">
            <span>Display title</span>
            <input id="slideEditorTitle" value="${escapeHtml(slot.title || "")}" placeholder="Sermon title or topic">
          </label>
          <div class="full">
            <span>Projector text</span>
            ${renderRichToolbar()}
            <div id="slideEditorBody" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true">${slot.body && slot.body.includes("<") ? slot.body : escapeHtml(slot.body || "").replace(/\n/g, "<br>")}</div>
          </div>
          <label class="full">
            <span>Private notes (not projected)</span>
            <textarea id="slideEditorNotes" rows="3" placeholder="Notes for the worship team">${escapeHtml(slot.notes || "")}</textarea>
          </label>
          <div class="button-row">
            <button class="action-button" type="button" data-command="save-slide-item">Save Content</button>
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  function bindRichEditor(root) {
    const editor = root.querySelector("#slideEditorBody");
    if (!editor) return;
    root.querySelectorAll("[data-rich-command]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        editor.focus();
        const command = button.dataset.richCommand;
        if (command === "insertRule") {
          document.execCommand("insertText", false, "\n---\n");
          return;
        }
        if (command === "insertLineBreak") {
          document.execCommand("insertLineBreak");
          return;
        }
        document.execCommand(command);
      });
    });
  }

  function bindEditorTypeToggle(root, types) {
    const select = root.querySelector("#slideEditorType");
    if (!select) return;
    select.addEventListener("change", () => {
      const type = select.value;
      const meta = types.find((item) => item.id === type);
      const role = root.querySelector("#slideEditorRole");
      const refWrap = root.querySelector("#slideEditorRefWrap");
      const titleWrap = root.querySelector("#slideEditorTitleWrap");
      if (role && meta && !role.value) role.value = meta.role;
      if (refWrap) refWrap.classList.toggle("hidden", type !== "scripture");
      if (titleWrap) titleWrap.classList.toggle("hidden", type === "scripture");
    });
  }

  function readEditorState(root, sanitizeRichHtml) {
    const type = root.querySelector("#slideEditorType")?.value || "announcement";
    const role = plain(root.querySelector("#slideEditorRole")?.value) || "";
    const scriptureRef = plain(root.querySelector("#slideEditorReference")?.value) || "";
    const title = type === "scripture"
      ? scriptureRef
      : plain(root.querySelector("#slideEditorTitle")?.value) || role;
    const editor = root.querySelector("#slideEditorBody");
    const rawBody = editor ? editor.innerHTML : "";
    const body = sanitizeRichHtml ? sanitizeRichHtml(rawBody) : plain(rawBody);
    const notes = root.querySelector("#slideEditorNotes")?.value?.trim() || "";
    return { type, role, title, body, notes, scriptureRef, contentFormat: "rich" };
  }

  function renderInlineEditor(slot, index, resolveType, getTypeMeta, richTextHtmlFn) {
    const type = resolveType(slot);
    const bodyHtml = slot.body && slot.body.includes("<")
      ? richTextHtmlFn(slot.body)
      : escapeHtml(plain(slot.body || "").slice(0, 220)).replace(/\n/g, "<br>");
    return `
      <div class="inline-slot-editor">
        <div class="inline-slot-head">
          ${renderSlotTypeBadge(slot, resolveType, getTypeMeta)}
          <button type="button" data-command="edit-slide-item" data-slot="${index}">Full editor</button>
        </div>
        <div class="inline-slot-preview">${bodyHtml || `<span class="muted">No projector text yet.</span>`}</div>
        ${type === "scripture" && slot.scriptureRef ? `<div class="inline-slot-ref">${escapeHtml(slot.scriptureRef)}</div>` : ""}
      </div>
    `;
  }

  window.CISBuilderSlides = {
    configure,
    renderAddContentMenu,
    renderSlotTypeBadge,
    renderEditorModal,
    bindRichEditor,
    bindEditorTypeToggle,
    readEditorState,
    renderInlineEditor,
    renderRichToolbar,
  };
})();
