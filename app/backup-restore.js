(function () {
  "use strict";

  const FORMAT = "christ-in-song-backup";
  const FORMAT_VERSION = 1;
  const APP_NAME = "Christ in Song Worship App";

  const COMPONENTS = [
    { id: "worship-plans", label: "Worship Builders & Service Plans", file: "worship-plans.json", description: "Your worship builder order and opening song service." },
    { id: "favorites", label: "Favorites & Recent Hymns", file: "favorites.json", description: "Saved hymns and your recent hymn history." },
    { id: "language-packs", label: "Imported Language Packs", file: "language-packs.json", description: "Custom languages and imported hymns added to this device." },
    { id: "templates", label: "Custom Templates", file: "templates.json", description: "Service templates you created or saved." },
    { id: "tags", label: "Tags & Categories", file: "tags.json", description: "Hymn categories and tag filters." },
    { id: "settings", label: "Settings", file: "settings.json", description: "Display, timer, and reader preferences." },
  ];

  const COMPONENT_MAP = Object.fromEntries(COMPONENTS.map((item) => [item.id, item]));
  const LEGACY_TYPES = new Set(["full-backup", "worship-builder", "builder"]);

  let escapeHtml = (value) => String(value || "");
  let modalRoot = null;
  let callbacks = {};
  let uiState = null;
  let fileInput = null;

  function configure(options) {
    callbacks = options || {};
    if (typeof callbacks.escapeHtml === "function") escapeHtml = callbacks.escapeHtml;
    if (callbacks.modalRoot) modalRoot = callbacks.modalRoot;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function todayFileStamp() {
    const now = new Date();
    return `${now.toISOString().slice(0, 10)}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function defaultConflictMap() {
    return {
      "worship-plans": "replace",
      "favorites": "merge",
      "language-packs": "merge",
      "templates": "merge",
      "tags": "merge",
      "settings": "replace",
    };
  }

  function buildReadme(manifest) {
    const lines = [
      "Christ in Song Worship Backup",
      "==============================",
      "",
      `Created: ${manifest.exportedAt}`,
      `Backup type: ${manifest.exportKind || "full"}`,
      "",
      "This .csbackup file is a zip archive containing your worship data.",
      "To restore, open Christ in Song → Settings → Backup & Restore → Restore Backup.",
      "",
      "Included in this backup:",
    ];
    (manifest.components || []).forEach((id) => {
      const item = COMPONENT_MAP[id];
      if (!item) return;
      const count = manifest.summary && manifest.summary[id];
      lines.push(`- ${item.label}${count !== undefined ? ` (${count})` : ""}`);
    });
    lines.push("", "Keep this file in a safe place (USB drive, cloud folder, or email to yourself).");
    return `${lines.join("\n")}\n`;
  }

  async function gatherComponentData(componentIds) {
    const snapshot = await call("gatherSnapshot");
    if (!snapshot) throw new Error("Backup data could not be collected.");
    const selected = new Set(componentIds || COMPONENTS.map((item) => item.id));
    const data = {};

    if (selected.has("worship-plans")) {
      data["worship-plans"] = {
        worshipPlan: snapshot.worshipPlan || [],
        songService: snapshot.songService || [],
      };
    }
    if (selected.has("favorites")) {
      data.favorites = {
        favorites: snapshot.favorites || [],
        recents: snapshot.recents || [],
      };
    }
    if (selected.has("language-packs")) {
      data["language-packs"] = {
        importedLanguagePacks: snapshot.importedLanguagePacks || [],
        hymnalLibrary: snapshot.hymnalLibrary || null,
      };
    }
    if (selected.has("templates")) {
      data.templates = {
        customTemplates: snapshot.customTemplates || [],
      };
    }
    if (selected.has("tags")) {
      data.tags = {
        songTags: snapshot.songTags || {},
        tagFilters: snapshot.tagFilters || [],
      };
    }
    if (selected.has("settings")) {
      data.settings = {
        languageCode: snapshot.languageCode || "zu",
        hymnBookId: snapshot.hymnBookId || "christ-in-song",
        editionId: snapshot.editionId || "christ-in-song-zulu",
        settings: snapshot.settings || {},
        ui: snapshot.ui || {},
      };
    }
    return data;
  }

  function summarizeComponentData(data, componentIds) {
    const summary = {};
    const ids = componentIds || Object.keys(data);
    ids.forEach((id) => {
      const payload = data[id];
      if (!payload) return;
      if (id === "worship-plans") {
        summary[id] = `${(payload.worshipPlan || []).length} builder items · ${(payload.songService || []).length} opening songs`;
      } else if (id === "favorites") {
        summary[id] = `${(payload.favorites || []).length} favorites · ${(payload.recents || []).length} recent hymns`;
      } else if (id === "language-packs") {
        const packs = payload.importedLanguagePacks || [];
        const hymns = packs.reduce((sum, pack) => sum + ((pack.songs || []).length || pack.songCount || 0), 0);
        summary[id] = `${packs.length} packs · ${hymns} hymns`;
      } else if (id === "templates") {
        summary[id] = `${(payload.customTemplates || []).length} templates`;
      } else if (id === "tags") {
        summary[id] = `${Object.keys(payload.songTags || {}).length} tagged hymns`;
      } else if (id === "settings") {
        summary[id] = "display, timer, and reader preferences";
      }
    });
    return summary;
  }

  async function buildArchive(componentIds, options = {}) {
    const ids = componentIds || COMPONENTS.map((item) => item.id);
    const data = await gatherComponentData(ids);
    const manifest = {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      app: APP_NAME,
      exportedAt: new Date().toISOString(),
      exportKind: options.kind || (ids.length === COMPONENTS.length ? "full" : "component"),
      components: ids,
      summary: summarizeComponentData(data, ids),
    };
    const entries = [
      { name: "README.txt", data: buildReadme(manifest) },
      { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    ];
    ids.forEach((id) => {
      const item = COMPONENT_MAP[id];
      if (!item || !data[id]) return;
      entries.push({ name: item.file, data: JSON.stringify(data[id], null, 2) });
    });
    if (!window.CISBackupZip) throw new Error("Backup zip tools failed to load.");
    const blob = await window.CISBackupZip.createZip(entries);
    return { blob, manifest, data };
  }

  function componentFilename(componentId) {
    const stamp = todayFileStamp();
    if (componentId === "worship-plans") return `christ-in-song-worship-plans-${stamp}.csbackup`;
    if (componentId === "language-packs") return `christ-in-song-language-packs-${stamp}.csbackup`;
    if (componentId === "templates") return `christ-in-song-templates-${stamp}.csbackup`;
    if (componentId === "tags") return `christ-in-song-tags-${stamp}.csbackup`;
    if (componentId === "favorites") return `christ-in-song-favorites-${stamp}.csbackup`;
    if (componentId === "settings") return `christ-in-song-settings-${stamp}.csbackup`;
    return `christ-in-song-backup-${stamp}.csbackup`;
  }

  async function exportArchive(componentIds, options = {}) {
    const ids = componentIds || COMPONENTS.map((item) => item.id);
    const { blob, manifest } = await buildArchive(ids, options);
    const filename = options.filename
      || (ids.length === 1 ? componentFilename(ids[0]) : `christ-in-song-backup-${todayFileStamp()}.csbackup`);
    if (options.kind !== "auto") downloadBlob(filename, blob);
    return { blob, manifest, filename };
  }

  async function parseBackupFile(file) {
    if (!file) throw new Error("No backup file was selected.");
    const name = String(file.name || "").toLowerCase();
    if (name.endsWith(".json")) {
      const text = await file.text();
      const payload = JSON.parse(text || "{}");
      return normalizeLegacyPayload(payload);
    }
    const buffer = await file.arrayBuffer();
    if (!window.CISBackupZip) throw new Error("Backup zip tools failed to load.");
    const entries = await window.CISBackupZip.readZipEntries(buffer);
    const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry]));
    const manifestEntry = byName["manifest.json"];
    if (!manifestEntry) throw new Error("This backup file is missing its manifest.");
    const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(manifestEntry.content)));
    if (manifest.format !== FORMAT) throw new Error("This file is not a Christ in Song backup.");
    const data = {};
    (manifest.components || []).forEach((id) => {
      const item = COMPONENT_MAP[id];
      const entry = item ? byName[item.file] : null;
      if (!entry) return;
      data[id] = JSON.parse(new TextDecoder().decode(new Uint8Array(entry.content)));
    });
    return { manifest, data, fileName: file.name };
  }

  function normalizeLegacyPayload(payload) {
    const manifest = {
      format: FORMAT,
      formatVersion: 0,
      app: payload.app || APP_NAME,
      exportedAt: payload.exportedAt || new Date().toISOString(),
      exportKind: payload.type || "legacy-json",
      components: [],
      summary: {},
      legacy: true,
    };
    const data = {};
    if (Array.isArray(payload.worshipPlan) || Array.isArray(payload.songService)) {
      manifest.components.push("worship-plans");
      data["worship-plans"] = {
        worshipPlan: payload.worshipPlan || [],
        songService: payload.songService || [],
      };
    }
    if (Array.isArray(payload.favorites) || Array.isArray(payload.recents)) {
      manifest.components.push("favorites");
      data.favorites = {
        favorites: payload.favorites || [],
        recents: payload.recents || [],
      };
    }
    if (Array.isArray(payload.importedLanguagePacks)) {
      manifest.components.push("language-packs");
      data["language-packs"] = { importedLanguagePacks: payload.importedLanguagePacks };
    }
    if (Array.isArray(payload.customTemplates)) {
      manifest.components.push("templates");
      data.templates = { customTemplates: payload.customTemplates };
    }
    if (payload.songTags || payload.tagFilters) {
      manifest.components.push("tags");
      data.tags = {
        songTags: payload.songTags || {},
        tagFilters: payload.tagFilters || [],
      };
    }
    if (payload.settings || payload.languageCode) {
      manifest.components.push("settings");
      data.settings = {
        languageCode: payload.languageCode,
        settings: payload.settings || {},
        ui: {},
      };
    }
    if (!manifest.components.length && LEGACY_TYPES.has(payload.type)) {
      throw new Error("This backup file does not contain recognizable worship data.");
    }
    manifest.summary = summarizeComponentData(data, manifest.components);
    return { manifest, data, fileName: "legacy-backup.json" };
  }

  function describeRestoreConflicts(parsed, currentSnapshot) {
    const rows = [];
    (parsed.manifest.components || []).forEach((id) => {
      const item = COMPONENT_MAP[id];
      const incoming = parsed.data[id];
      const current = currentSnapshot && currentSnapshot.components ? currentSnapshot.components[id] : null;
      if (!item || !incoming) return;
      rows.push({
        id,
        label: item.label,
        incomingSummary: parsed.manifest.summary[id] || "Included",
        currentSummary: current || "None saved on this device",
        recommended: defaultConflictMap()[id] || "merge",
      });
    });
    return rows;
  }

  async function applyRestore(parsed, conflictMap) {
    return call("applyRestore", parsed, conflictMap || defaultConflictMap());
  }

  function renderProgress(label, percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    return `
      <div class="backup-progress" role="status" aria-live="polite">
        <div class="backup-progress-label">
          <strong>${escapeHtml(label || "Working…")}</strong>
          <span>${safePercent}%</span>
        </div>
        <div class="backup-progress-track" aria-hidden="true">
          <div class="backup-progress-bar" style="width:${safePercent}%"></div>
        </div>
      </div>
    `;
  }

  function renderSettingsPanel(stats) {
    const autoEnabled = window.CISBackupStore ? window.CISBackupStore.isAutoBackupEnabled() : false;
    const autoBackups = stats && stats.autoBackups ? stats.autoBackups : [];
    return `
      <section class="section backup-center">
        <div class="backup-hero">
          <div>
            <p class="eyebrow">Safe & simple</p>
            <h2>Backup & Restore</h2>
            <p class="muted">Save everything in one dated file, or export just the part you need. Restoring always asks before replacing your current data.</p>
          </div>
          <div class="backup-hero-actions">
            <button class="action-button" type="button" data-backup-action="export-full">Export All Data</button>
            <button class="secondary-button" type="button" data-backup-action="open-restore">Restore Backup</button>
          </div>
        </div>
        <div class="backup-stats">
          <div><strong>${escapeHtml(String(stats.favorites || 0))}</strong><span>Favorites</span></div>
          <div><strong>${escapeHtml(String(stats.builderItems || 0))}</strong><span>Builder items</span></div>
          <div><strong>${escapeHtml(String(stats.importedPacks || 0))}</strong><span>Imported packs</span></div>
          <div><strong>${escapeHtml(String(stats.templates || 0))}</strong><span>Templates</span></div>
          <div><strong>${escapeHtml(String(stats.taggedHymns || 0))}</strong><span>Tagged hymns</span></div>
        </div>
        <div class="backup-component-grid">
          ${COMPONENTS.map((item) => `
            <article class="backup-component-card">
              <strong>${escapeHtml(item.label)}</strong>
              <p class="muted">${escapeHtml(item.description)}</p>
              <div class="button-row">
                <button class="secondary-button" type="button" data-backup-action="export-component" data-component="${escapeHtml(item.id)}">Export</button>
                <button class="secondary-button" type="button" data-backup-action="import-component" data-component="${escapeHtml(item.id)}">Import</button>
              </div>
            </article>
          `).join("")}
        </div>
        <div class="backup-auto-panel">
          <div class="backup-auto-head">
            <div>
              <strong>Daily backup on this device</strong>
              <p class="muted">Keeps up to ${window.CISBackupStore ? window.CISBackupStore.MAX_BACKUPS : 7} automatic backups on this computer or tablet. Helpful if you forget to export manually.</p>
            </div>
            <label class="backup-toggle">
              <input type="checkbox" data-backup-action="toggle-auto" ${autoEnabled ? "checked" : ""}>
              <span>Enabled</span>
            </label>
          </div>
          ${autoBackups.length ? `
            <div class="backup-auto-list">
              ${autoBackups.map((item) => `
                <div class="backup-auto-row">
                  <div>
                    <strong>${escapeHtml(item.label || item.id)}</strong>
                    <span class="muted">${escapeHtml(new Date(item.createdAt || item.id).toLocaleString())} · ${escapeHtml(formatBytes(item.size || 0))}</span>
                  </div>
                  <div class="mini-actions">
                    <button type="button" data-backup-action="restore-auto" data-backup-id="${escapeHtml(item.id)}">Restore</button>
                    <button type="button" data-backup-action="delete-auto" data-backup-id="${escapeHtml(item.id)}">Delete</button>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `<p class="muted">No daily backups saved yet.</p>`}
        </div>
        <div class="button-row backup-danger-row">
          <button class="danger-button" type="button" data-command="reset-local-data">Reset All Local Data</button>
        </div>
      </section>
    `;
  }

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderModal() {
    if (!modalRoot || !uiState) return;
    const step = uiState.step;
    let body = "";
    let footer = "";

    if (step === "exporting") {
      body = `
        <h2>Creating Backup</h2>
        <p class="muted">Please wait while your worship data is packaged into a .csbackup file.</p>
        ${renderProgress(uiState.progressLabel, uiState.progress)}
      `;
    } else if (step === "export-success") {
      body = `
        <h2>Backup Ready</h2>
        <p class="muted">${escapeHtml(uiState.message || "Your backup was created successfully.")}</p>
        <div class="backup-success-card">
          <strong>${escapeHtml(uiState.filename || "backup.csbackup")}</strong>
          <span class="muted">${escapeHtml((uiState.summaryLines || []).join(" · "))}</span>
        </div>
      `;
      footer = `<button class="action-button" type="button" data-backup-action="close">Done</button>`;
    } else if (step === "restore-preview") {
      body = `
        <h2>Review Backup</h2>
        <p class="muted">Choose what to bring back and how to handle items that already exist on this device.</p>
        <div class="backup-review-card">
          <strong>${escapeHtml(uiState.fileName || "Backup file")}</strong>
          <span class="muted">Created ${escapeHtml(new Date(uiState.manifest.exportedAt || Date.now()).toLocaleString())}</span>
        </div>
        <div class="backup-conflict-list">
          ${(uiState.conflicts || []).map((row) => `
            <div class="backup-conflict-row">
              <div>
                <strong>${escapeHtml(row.label)}</strong>
                <small class="muted">In backup: ${escapeHtml(row.incomingSummary)} · On device: ${escapeHtml(row.currentSummary)}</small>
              </div>
              <select data-conflict-component="${escapeHtml(row.id)}">
                <option value="replace" ${row.strategy === "replace" ? "selected" : ""}>Replace with backup</option>
                <option value="merge" ${row.strategy === "merge" ? "selected" : ""}>Merge with existing</option>
                <option value="skip" ${row.strategy === "skip" ? "selected" : ""}>Keep current (skip)</option>
              </select>
            </div>
          `).join("")}
        </div>
      `;
      footer = `
        <button class="secondary-button" type="button" data-backup-action="close">Cancel</button>
        <button class="action-button" type="button" data-backup-action="confirm-restore">Restore Selected Items</button>
      `;
    } else if (step === "restoring") {
      body = `
        <h2>Restoring Backup</h2>
        <p class="muted">Your worship data is being restored. Please keep this window open.</p>
        ${renderProgress(uiState.progressLabel, uiState.progress)}
      `;
    } else if (step === "restore-success") {
      body = `
        <h2>Restore Complete</h2>
        <p class="muted">${escapeHtml(uiState.message || "Your backup was restored successfully.")}</p>
        <ul class="backup-result-list">
          ${(uiState.resultLines || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      `;
      footer = `<button class="action-button" type="button" data-backup-action="close">Done</button>`;
    } else if (step === "error") {
      body = `
        <h2>Backup Problem</h2>
        <p class="muted">${escapeHtml(uiState.message || "Something went wrong.")}</p>
      `;
      footer = `<button class="secondary-button" type="button" data-backup-action="close">Close</button>`;
    }

    modalRoot.innerHTML = `
      <div class="modal-backdrop backup-modal-backdrop" data-backup-action="close">
        <div class="modal backup-modal" role="dialog" aria-modal="true" aria-label="Backup and restore">
          <div class="song-header">
            <div>
              <p class="eyebrow">Backup & Restore</p>
            </div>
            <button class="secondary-button" type="button" data-backup-action="close">Close</button>
          </div>
          <div class="backup-modal-body">${body}</div>
          ${footer ? `<div class="backup-modal-footer">${footer}</div>` : ""}
        </div>
      </div>
    `;
    bindModalEvents();
  }

  function bindModalEvents() {
    if (!modalRoot) return;
    const backdrop = modalRoot.querySelector(".backup-modal-backdrop");
    const modal = modalRoot.querySelector(".backup-modal");
    modalRoot.querySelectorAll("[data-backup-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleAction(button.dataset.backupAction, button);
      });
    });
    if (backdrop) {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop && uiState && !["exporting", "restoring"].includes(uiState.step)) closeModal();
      });
    }
    if (modal) modal.addEventListener("click", (event) => event.stopPropagation());
  }

  function bindSettingsEvents(root) {
    if (!root) return;
    root.querySelectorAll("[data-backup-action]").forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.backupAction, button));
    });
    const toggle = root.querySelector('[data-backup-action="toggle-auto"]');
    if (toggle) {
      toggle.addEventListener("change", () => {
        if (window.CISBackupStore) window.CISBackupStore.setAutoBackupEnabled(toggle.checked);
        call("setNotice", toggle.checked ? "Daily backups enabled on this device." : "Daily backups turned off.");
        call("render");
      });
    }
  }

  function ensureFileInput(accept) {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.className = "hidden";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        const mode = fileInput.dataset.backupMode || "full";
        const component = fileInput.dataset.backupComponent || "";
        fileInput.value = "";
        if (!file) return;
        if (mode === "component") startRestoreFromFile(file, { componentScope: component });
        else startRestoreFromFile(file);
      });
      document.body.appendChild(fileInput);
    }
    fileInput.accept = accept || ".csbackup,.json,application/zip,application/json";
    return fileInput;
  }

  function closeModal() {
    uiState = null;
    if (modalRoot) modalRoot.innerHTML = "";
  }

  async function runExport(componentIds) {
    uiState = {
      step: "exporting",
      progress: 12,
      progressLabel: "Collecting your worship data…",
    };
    renderModal();
    await pause(60);
    uiState.progress = 38;
    uiState.progressLabel = "Packaging backup files…";
    renderModal();
    const result = await exportArchive(componentIds);
    uiState.progress = 76;
    uiState.progressLabel = "Creating .csbackup archive…";
    renderModal();
    await pause(60);
    uiState.progress = 100;
    uiState.progressLabel = "Finishing download…";
    renderModal();
    await pause(80);
    uiState = {
      step: "export-success",
      filename: result.filename,
      message: componentIds && componentIds.length === 1
        ? "Your selected worship data was exported successfully."
        : "Your full worship backup was exported successfully.",
      summaryLines: Object.values(result.manifest.summary || {}),
    };
    renderModal();
    call("setNotice", `Backup saved as ${result.filename}.`);
  }

  async function startRestoreFromFile(file, options = {}) {
    try {
      uiState = {
        step: "restoring",
        progress: 10,
        progressLabel: "Reading backup file…",
      };
      renderModal();
      const parsed = await parseBackupFile(file);
      if (options.componentScope) {
        parsed.manifest.components = parsed.manifest.components.filter((id) => id === options.componentScope);
        Object.keys(parsed.data).forEach((key) => {
          if (key !== options.componentScope) delete parsed.data[key];
        });
      }
      const currentSnapshot = await call("describeCurrentData");
      const conflicts = describeRestoreConflicts(parsed, currentSnapshot).map((row) => ({
        ...row,
        strategy: defaultConflictMap()[row.id] || "merge",
      }));
      uiState = {
        step: "restore-preview",
        parsed,
        conflicts,
        fileName: file.name,
        manifest: parsed.manifest,
      };
      renderModal();
    } catch (error) {
      uiState = {
        step: "error",
        message: error && error.message ? error.message : "That backup file could not be opened.",
      };
      renderModal();
    }
  }

  async function confirmRestore() {
    if (!uiState || !uiState.parsed || !modalRoot) return;
    const conflictMap = {};
    modalRoot.querySelectorAll("[data-conflict-component]").forEach((select) => {
      conflictMap[select.dataset.conflictComponent] = select.value || "merge";
    });
    uiState = {
      step: "restoring",
      progress: 24,
      progressLabel: "Applying your backup…",
    };
    renderModal();
    try {
      const result = await applyRestore(uiState.parsed, conflictMap);
      uiState = {
        step: "restore-success",
        message: "Your selected worship data has been restored.",
        resultLines: result && result.lines ? result.lines : ["Restore completed."],
      };
      renderModal();
      call("setNotice", "Backup restored successfully.");
      call("render");
    } catch (error) {
      uiState = {
        step: "error",
        message: error && error.message ? error.message : "The backup could not be restored.",
      };
      renderModal();
    }
  }

  async function restoreAutoBackup(id) {
    if (!window.CISBackupStore) return;
    const record = await window.CISBackupStore.getAutoBackup(id);
    if (!record || !record.blob) {
      call("setNotice", "That daily backup could not be found.");
      return;
    }
    const file = new File([record.blob], `${id}.csbackup`, { type: "application/zip" });
    await startRestoreFromFile(file);
  }

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function handleAction(action, target) {
    if (action === "close") {
      closeModal();
      return;
    }
    if (action === "export-full") {
      try {
        await runExport(COMPONENTS.map((item) => item.id));
      } catch (error) {
        uiState = { step: "error", message: error && error.message ? error.message : "Export failed." };
        renderModal();
      }
      return;
    }
    if (action === "export-component") {
      const component = target.dataset.component;
      try {
        await runExport([component]);
      } catch (error) {
        uiState = { step: "error", message: error && error.message ? error.message : "Export failed." };
        renderModal();
      }
      return;
    }
    if (action === "open-restore" || action === "import-component") {
      const input = ensureFileInput();
      input.dataset.backupMode = action === "import-component" ? "component" : "full";
      input.dataset.backupComponent = target.dataset.component || "";
      input.click();
      return;
    }
    if (action === "confirm-restore") {
      await confirmRestore();
      return;
    }
    if (action === "restore-auto") {
      await restoreAutoBackup(target.dataset.backupId);
      return;
    }
    if (action === "delete-auto" && window.CISBackupStore) {
      await window.CISBackupStore.deleteAutoBackup(target.dataset.backupId);
      call("setNotice", "Daily backup deleted.");
      call("render");
      return;
    }
  }

  async function maybeRunDailyBackup() {
    if (!window.CISBackupStore) return null;
    return window.CISBackupStore.maybeRunDailyBackup(async () => {
      const result = await buildArchive(COMPONENTS.map((item) => item.id), { kind: "auto" });
      return { blob: result.blob, summary: result.manifest.summary };
    });
  }

  window.CISBackupRestore = {
    FORMAT,
    FORMAT_VERSION,
    COMPONENTS,
    configure,
    renderSettingsPanel,
    bindSettingsEvents,
    exportArchive,
    parseBackupFile,
    applyRestore,
    maybeRunDailyBackup,
    restoreFromFile: (file, options) => startRestoreFromFile(file, options),
    openRestoreDialog: () => handleAction("open-restore", {}),
    exportFullBackup: () => handleAction("export-full", {}),
  };
})();
