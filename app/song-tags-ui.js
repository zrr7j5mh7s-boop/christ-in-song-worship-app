(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let getTagMeta = (id) => ({ id, label: id, color: "#666" });

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.getTagMeta) getTagMeta = options.getTagMeta;
  }

  function renderTagChip(tagId, options = {}) {
    const meta = getTagMeta(tagId);
    if (!meta) return "";
    const removable = options.removable ? ` data-command="remove-song-tag" data-tag="${escapeHtml(tagId)}"` : "";
    const selectable = options.selectable
      ? ` data-command="toggle-tag-filter" data-tag="${escapeHtml(tagId)}"`
      : "";
    const active = options.active ? " active" : "";
    return `<button type="button" class="song-tag-chip${active}" style="--tag-color:${escapeHtml(meta.color)}"${removable}${selectable} title="${escapeHtml(meta.label)}">${escapeHtml(meta.label)}${options.removable ? " ×" : ""}</button>`;
  }

  function renderTagList(tagIds, options = {}) {
    const tags = tagIds || [];
    if (!tags.length && !options.emptyLabel) return "";
    if (!tags.length) return `<span class="muted">${escapeHtml(options.emptyLabel)}</span>`;
    return `<div class="song-tag-list">${tags.map((tagId) => renderTagChip(tagId, options)).join("")}</div>`;
  }

  function renderFilterRow(allTags, activeTags) {
    const active = new Set(activeTags || []);
    return `
      <div class="tag-filter-row" aria-label="Category filters">
        <button type="button" class="filter-chip ${active.size === 0 ? "active" : ""}" data-command="clear-tag-filters">All</button>
        ${allTags.map((tag) => renderTagChip(tag.id, { selectable: true, active: active.has(tag.id) })).join("")}
      </div>
    `;
  }

  function renderSongTagEditor(songKey, songTitle, currentTags, allTags) {
    const active = new Set(currentTags || []);
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <div class="modal song-tag-modal" role="dialog" aria-modal="true" aria-label="Edit hymn tags">
          <div class="song-header">
            <div>
              <h2>Edit Tags</h2>
              <p class="muted">${escapeHtml(songTitle || songKey)}</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <p class="muted">Choose one or more categories. Tags are saved with this hymn across sessions.</p>
          <div class="song-tag-picker" data-song-key="${escapeHtml(songKey)}">
            ${allTags.map((tag) => `
              <label class="song-tag-option ${active.has(tag.id) ? "active" : ""}">
                <input type="checkbox" value="${escapeHtml(tag.id)}" ${active.has(tag.id) ? "checked" : ""}>
                <span class="song-tag-chip" style="--tag-color:${escapeHtml(tag.color)}">${escapeHtml(tag.label)}</span>
              </label>
            `).join("")}
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="auto-tag-song" data-song-key="${escapeHtml(songKey)}">Suggest from lyrics</button>
            <button class="action-button" type="button" data-command="save-song-tags" data-song-key="${escapeHtml(songKey)}">Save Tags</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderBulkTagModal(packs, selectedPackCode, allTags) {
    const packOptions = (packs || []).map((pack) => `
      <option value="${escapeHtml(pack.code)}" ${pack.code === selectedPackCode ? "selected" : ""}>${escapeHtml(pack.name)} (${pack.songCount || (pack.songs || []).length} hymns)</option>
    `).join("");
    return `
      <div class="modal-backdrop" data-command="close-modal">
        <div class="modal song-tag-modal bulk-tag-modal" role="dialog" aria-modal="true" aria-label="Bulk tag hymns">
          <div class="song-header">
            <div>
              <h2>Bulk Tag Hymns</h2>
              <p class="muted">Apply categories to an entire imported language pack or refine tags in bulk.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Language pack</span>
            <select id="bulkTagPack">${packOptions}</select>
          </label>
          <label>
            <span>Apply mode</span>
            <select id="bulkTagMode">
              <option value="merge">Merge tags with existing</option>
              <option value="replace">Replace existing tags</option>
            </select>
          </label>
          <div class="song-tag-picker" id="bulkTagPicker">
            ${allTags.map((tag) => `
              <label class="song-tag-option">
                <input type="checkbox" value="${escapeHtml(tag.id)}">
                <span class="song-tag-chip" style="--tag-color:${escapeHtml(tag.color)}">${escapeHtml(tag.label)}</span>
              </label>
            `).join("")}
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="auto-bulk-tag">Auto-suggest from lyrics</button>
            <button class="action-button" type="button" data-command="apply-bulk-tags">Apply to Pack</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSuggestions(title, songs, renderSongButton) {
    if (!songs.length) return "";
    return `
      <section class="suggested-songs">
        <div class="suggested-songs-head">
          <strong>${escapeHtml(title)}</strong>
          <span class="muted">${songs.length} suggestion${songs.length === 1 ? "" : "s"}</span>
        </div>
        <div class="suggested-songs-list">
          ${songs.map(renderSongButton).join("")}
        </div>
      </section>
    `;
  }

  function readCheckedTags(root, selector) {
    return [...root.querySelectorAll(`${selector} input[type="checkbox"]:checked`)].map((input) => input.value);
  }

  window.CISSongTagsUI = {
    configure,
    renderTagChip,
    renderTagList,
    renderFilterRow,
    renderSongTagEditor,
    renderBulkTagModal,
    renderSuggestions,
    readCheckedTags,
  };
})();
