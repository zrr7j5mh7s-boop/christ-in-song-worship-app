(function () {
  "use strict";

  const CONTEXT_MAP = {
    "send-live": { title: "Send Live", body: "Starts or advances the active Presenter session. Audience and OBS overlays update when Presenter is Live.", articleId: "preview-live" },
    clear: { title: "Clear", body: "Returns from emergency screens to lyrics. Does not stop OBS streaming or recording.", articleId: "clear-vs-blackout" },
    blackout: { title: "Blackout", body: "Shows black on worship outputs. Streaming and recording continue.", articleId: "clear-vs-blackout" },
    logo: { title: "Show Logo", body: "Displays the church holding logo screen. Press C or Clear to return.", articleId: "clear-vs-blackout" },
    "obs-mapping": { title: "OBS Scene Mapping", body: "Assign worship functions to existing OBS scenes. Unassigned mappings are skipped safely.", articleId: "obs-scene-mapping" },
    "obs-source": { title: "OBS Source Mapping", body: "Pick the Browser Source and scene containing each overlay.", articleId: "obs-scene-mapping" },
    "obs-url": { title: "Browser Source URL", body: "Localhost URL served by the desktop app. Set OBS Browser Source to 1920×1080 with transparency.", articleId: "obs-browser-sources" },
    backup: { title: "Backup", body: "Export worship plans, favorites, tags, settings, and OBS mappings. Password is not exported.", articleId: "backup-restore-guide" },
    restore: { title: "Restore", body: "Import a .csbackup archive. Choose merge or replace per component.", articleId: "backup-restore-guide" },
  };

  function renderTrigger(key, label) {
    const safeLabel = label || key;
    return `<button type="button" class="help-context-trigger" data-help-context="${key}" data-help-topic="${key}" aria-label="Help: ${safeLabel}" title="Help: ${safeLabel}">?</button>`;
  }

  function renderPanel(key, escapeHtml) {
    const item = CONTEXT_MAP[key];
    if (!item) return "";
    return `
      <div class="help-context-panel" role="dialog" aria-label="Contextual help">
        <header><strong>${escapeHtml(item.title)}</strong><button type="button" data-command="help-close-context" aria-label="Close">×</button></header>
        <p>${escapeHtml(item.body)}</p>
        <button type="button" class="secondary-button" data-help-article="${escapeHtml(item.articleId)}">Read full article</button>
      </div>
    `;
  }

  window.CISHelpContextual = { CONTEXT_MAP, renderTrigger, renderPanel };
})();
