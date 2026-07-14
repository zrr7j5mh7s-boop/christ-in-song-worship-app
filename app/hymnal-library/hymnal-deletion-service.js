(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let callbacks = {};
  let pendingUndo = null;

  function configure(options) {
    callbacks = options || {};
    if (typeof options.escapeHtml === "function") escapeHtml = options.escapeHtml;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function matchesEditionKey(key, editionId) {
    if (!key || !editionId) return false;
    const text = String(key);
    if (text.startsWith(`${editionId}:`)) return true;
    const migration = window.CISHymnalMigration;
    if (migration) {
      const legacy = migration.resolveLegacyCodeFromEdition(editionId);
      if (legacy && text.startsWith(`${legacy}:`)) return true;
    }
    return false;
  }

  function matchesBookKey(key, hymnBookId, editionIds) {
    if (!key || !hymnBookId) return false;
    return (editionIds || []).some((editionId) => matchesEditionKey(key, editionId));
  }

  function collectEditionIds(hymnBookId) {
    const store = window.CISHymnalLibraryStore;
    if (!store) return [];
    return store.getCachedEditions(hymnBookId).map((edition) => edition.editionId);
  }

  function analyzeEditionReferences(editionId, refs) {
    const data = refs || call("getReferenceData") || {};
    const impact = {
      favorites: [],
      recents: [],
      worshipPlan: [],
      songService: [],
      templates: [],
      songTags: [],
      presenter: null,
      total: 0,
    };

    (data.favorites || []).forEach((key) => {
      if (matchesEditionKey(key, editionId)) {
        impact.favorites.push(key);
      }
    });
    (data.recents || []).forEach((key) => {
      if (matchesEditionKey(key, editionId)) {
        impact.recents.push(key);
      }
    });
    (data.worshipPlan || []).forEach((slot, index) => {
      if (slot && slot.songKey && matchesEditionKey(slot.songKey, editionId)) {
        impact.worshipPlan.push({ index, role: slot.role, songKey: slot.songKey });
      }
    });
    (data.songService || []).forEach((slot, index) => {
      if (slot && slot.songKey && matchesEditionKey(slot.songKey, editionId)) {
        impact.songService.push({ index, role: slot.role, songKey: slot.songKey });
      }
    });
    (data.customTemplates || []).forEach((template) => {
      const slots = (template.slots || []).filter((slot) => slot && slot.songKey && matchesEditionKey(slot.songKey, editionId));
      if (slots.length) {
        impact.templates.push({ id: template.id, name: template.name, slots });
      }
    });
    Object.keys(data.songTagMap || {}).forEach((key) => {
      if (matchesEditionKey(key, editionId)) impact.songTags.push(key);
    });
    if (data.presenter && data.presenter.songKey && matchesEditionKey(data.presenter.songKey, editionId)) {
      impact.presenter = data.presenter.songKey;
    }

    impact.total = impact.favorites.length
      + impact.recents.length
      + impact.worshipPlan.length
      + impact.songService.length
      + impact.templates.length
      + impact.songTags.length
      + (impact.presenter ? 1 : 0);
    return impact;
  }

  function analyzeBookReferences(hymnBookId, refs) {
    const editionIds = collectEditionIds(hymnBookId);
    const combined = {
      favorites: [],
      recents: [],
      worshipPlan: [],
      songService: [],
      templates: [],
      songTags: [],
      presenter: null,
      total: 0,
      editionIds,
    };
    editionIds.forEach((editionId) => {
      const impact = analyzeEditionReferences(editionId, refs);
      combined.favorites.push(...impact.favorites);
      combined.recents.push(...impact.recents);
      combined.worshipPlan.push(...impact.worshipPlan);
      combined.songService.push(...impact.songService);
      combined.templates.push(...impact.templates);
      combined.songTags.push(...impact.songTags);
      if (impact.presenter) combined.presenter = impact.presenter;
      combined.total += impact.total;
    });
    return combined;
  }

  function renderImpactSummary(impact) {
    const rows = [];
    if (impact.favorites.length) rows.push(`<li><strong>${impact.favorites.length}</strong> favourite${impact.favorites.length === 1 ? "" : "s"}</li>`);
    if (impact.recents.length) rows.push(`<li><strong>${impact.recents.length}</strong> recent hymn${impact.recents.length === 1 ? "" : "s"}</li>`);
    if (impact.worshipPlan.length) rows.push(`<li><strong>${impact.worshipPlan.length}</strong> worship builder slot${impact.worshipPlan.length === 1 ? "" : "s"}</li>`);
    if (impact.songService.length) rows.push(`<li><strong>${impact.songService.length}</strong> song service slot${impact.songService.length === 1 ? "" : "s"}</li>`);
    if (impact.templates.length) rows.push(`<li><strong>${impact.templates.length}</strong> template${impact.templates.length === 1 ? "" : "s"}</li>`);
    if (impact.songTags.length) rows.push(`<li><strong>${impact.songTags.length}</strong> tagged hymn${impact.songTags.length === 1 ? "" : "s"}</li>`);
    if (impact.presenter) rows.push("<li><strong>1</strong> active presenter session</li>");
    if (!rows.length) return "<p class=\"muted\">No references found in favourites, builders, templates, or history.</p>";
    return `<ul class="hymnal-delete-impact-list">${rows.join("")}</ul>`;
  }

  function renderReplacementOptions(editionIds, selectedEditionId) {
    const store = window.CISHymnalLibraryStore;
    if (!store) return "";
    const editions = store.getCachedEditions().filter((edition) => {
      const migration = window.CISHymnalMigration;
      return migration && migration.isDeletableOrigin(migration.resolveEditionOrigin(edition))
        ? false
        : edition.editionId !== selectedEditionId && !editionIds.includes(edition.editionId);
    });
    const allEditions = store.getCachedEditions().filter((edition) => (
      edition.editionId !== selectedEditionId && !editionIds.includes(edition.editionId)
    ));
    const options = (allEditions.length ? allEditions : editions).map((edition) => {
      const book = store.getBookById(edition.hymnBookId);
      return `<option value="${escapeHtml(edition.editionId)}">${escapeHtml(book ? book.title : edition.hymnBookId)} · ${escapeHtml(edition.languageName || edition.editionName)}</option>`;
    }).join("");
    if (!options) return "";
    return `
      <label class="hymnal-delete-replace">
        <span>Replace references with</span>
        <select id="hymnalDeleteReplaceEdition">${options}</select>
      </label>
    `;
  }

  function renderDeletionModal(ctx) {
    const {
      targetType,
      targetId,
      targetName,
      confirmName,
      impact,
      editionIds = [],
    } = ctx;
    const migration = window.CISHymnalMigration;
    const originLabel = migration ? migration.originLabel(ctx.origin || "imported") : "Imported";
    return `
      <div class="modal hymnal-delete-modal" role="dialog" aria-modal="true" aria-labelledby="hymnalDeleteTitle">
        <div class="modal-card hymnal-delete-card">
          <header class="modal-header">
            <div>
              <p class="eyebrow">Delete ${escapeHtml(targetType)}</p>
              <h2 id="hymnalDeleteTitle">${escapeHtml(targetName)}</h2>
              <p class="muted"><span class="origin-badge origin-${escapeHtml(ctx.origin || "imported")}">${escapeHtml(originLabel)}</span> · ${impact.total} reference${impact.total === 1 ? "" : "s"} affected</p>
            </div>
            <button class="icon-button" type="button" data-command="close-modal" aria-label="Close">×</button>
          </header>
          <section class="modal-body">
            <h3>Reference impact</h3>
            ${renderImpactSummary(impact)}
            <fieldset class="hymnal-delete-options">
              <legend>Deletion options</legend>
              <label><input type="radio" name="hymnalDeleteMode" value="remove" checked> Remove references and delete</label>
              <label><input type="radio" name="hymnalDeleteMode" value="keep-snapshots"> Keep service-item snapshots (clear live links)</label>
              ${renderReplacementOptions(editionIds, targetType === "edition" ? targetId : "")}
              <label><input type="radio" name="hymnalDeleteMode" value="replace"> Replace references with another edition</label>
            </fieldset>
            <label class="hymnal-delete-confirm">
              <span>Type <strong>${escapeHtml(confirmName)}</strong> to confirm</span>
              <input id="hymnalDeleteConfirmInput" type="text" autocomplete="off" placeholder="${escapeHtml(confirmName)}">
            </label>
            <p class="muted hymnal-delete-backup-note">A backup snapshot is created automatically before deletion.</p>
          </section>
          <footer class="modal-footer button-row">
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
            <button class="secondary-button" type="button" data-command="export-and-delete-hymnal" data-target-type="${escapeHtml(targetType)}" data-target-id="${escapeHtml(targetId)}">Export and delete</button>
            <button class="danger-button" type="button" data-command="confirm-delete-hymnal" data-target-type="${escapeHtml(targetType)}" data-target-id="${escapeHtml(targetId)}">Delete</button>
          </footer>
        </div>
      </div>
    `;
  }

  function readDeletionMode(root) {
    const selected = root.querySelector("input[name='hymnalDeleteMode']:checked");
    return selected ? selected.value : "remove";
  }

  function buildReferencePatch(impact, mode, replaceEditionId, sourceEditionId) {
    const patch = {
      removeFavorites: [],
      removeRecents: [],
      clearWorshipPlanSlots: [],
      clearSongServiceSlots: [],
      clearTemplateSlots: [],
      removeSongTags: [],
      clearPresenter: false,
      replaceMap: null,
    };

    const fromEditionId = sourceEditionId || (impact.editionIds && impact.editionIds[0]) || null;
    if (mode === "replace" && replaceEditionId && fromEditionId) {
      patch.replaceMap = { fromEditionId, toEditionId: replaceEditionId };
    }

    if (mode === "keep-snapshots") {
      patch.clearWorshipPlanSlots = impact.worshipPlan.map((item) => item.index);
      patch.clearSongServiceSlots = impact.songService.map((item) => item.index);
      patch.clearTemplateSlots = impact.templates.map((item) => item.id);
      patch.removeFavorites = impact.favorites;
      patch.removeRecents = impact.recents;
      patch.removeSongTags = impact.songTags;
      patch.clearPresenter = Boolean(impact.presenter);
      return patch;
    }

    patch.removeFavorites = impact.favorites;
    patch.removeRecents = impact.recents;
    patch.clearWorshipPlanSlots = impact.worshipPlan.map((item) => item.index);
    patch.clearSongServiceSlots = impact.songService.map((item) => item.index);
    patch.clearTemplateSlots = impact.templates.map((item) => item.id);
    patch.removeSongTags = impact.songTags;
    patch.clearPresenter = Boolean(impact.presenter);
    return patch;
  }

  async function createPreDeleteBackup(targetName) {
    if (typeof callbacks.createBackup === "function") {
      return callbacks.createBackup(`Before deleting ${targetName}`);
    }
    return null;
  }

  async function executeEditionDeletion(editionId, options = {}) {
    const store = window.CISHymnalLibraryStore;
    if (!store) throw new Error("Hymnal library store is not available.");
    const edition = store.getEditionById(editionId);
    if (!edition) throw new Error("Edition not found.");

    const impact = analyzeEditionReferences(editionId);
    const patch = buildReferencePatch({ ...impact, editionIds: [editionId] }, options.mode, options.replaceEditionId, editionId);

    await createPreDeleteBackup(edition.languageName || editionId);
    if (typeof callbacks.applyReferencePatch === "function") {
      await callbacks.applyReferencePatch(patch);
    }

    const result = await store.deleteEditionTransactional(editionId, {
      deleteEmptyBook: options.deleteEmptyBook !== false,
    });

    if (window.CISSearchEngine) {
      window.CISSearchEngine.invalidatePack(editionId);
      window.CISSearchEngine.invalidatePack(edition.packCode || edition.languageCode);
    }

    pendingUndo = {
      expiresAt: Date.now() + 60000,
      snapshot: result.rollback,
      label: edition.languageName || editionId,
    };

    return { ...result, impact, patch };
  }

  async function executeBookDeletion(hymnBookId, options = {}) {
    const store = window.CISHymnalLibraryStore;
    if (!store) throw new Error("Hymnal library store is not available.");
    const book = store.getBookById(hymnBookId);
    if (!book) throw new Error("Hymn book not found.");

    const impact = analyzeBookReferences(hymnBookId);
    const patch = buildReferencePatch(impact, options.mode, options.replaceEditionId, impact.editionIds && impact.editionIds[0]);

    await createPreDeleteBackup(book.title || hymnBookId);
    if (typeof callbacks.applyReferencePatch === "function") {
      await callbacks.applyReferencePatch(patch);
    }

    const result = await store.deleteBookTransactional(hymnBookId);

    if (window.CISSearchEngine) {
      (impact.editionIds || []).forEach((editionId) => {
        window.CISSearchEngine.invalidatePack(editionId);
      });
    }

    pendingUndo = {
      expiresAt: Date.now() + 60000,
      snapshot: result.rollback,
      label: book.title || hymnBookId,
    };

    return { ...result, impact, patch };
  }

  async function undoLastDeletion() {
    if (!pendingUndo || pendingUndo.expiresAt < Date.now()) {
      pendingUndo = null;
      throw new Error("Undo window has expired.");
    }
    const store = window.CISHymnalLibraryStore;
    if (!store) throw new Error("Hymnal library store is not available.");
    await store.restoreRollbackSnapshot(pendingUndo.snapshot);
    const label = pendingUndo.label;
    pendingUndo = null;
    return label;
  }

  function getPendingUndo() {
    if (!pendingUndo || pendingUndo.expiresAt < Date.now()) {
      pendingUndo = null;
      return null;
    }
    return pendingUndo;
  }

  function openEditionDeletionModal(editionId) {
    const store = window.CISHymnalLibraryStore;
    const edition = store ? store.getEditionById(editionId) : null;
    if (!edition) return;
    const migration = window.CISHymnalMigration;
    const origin = migration ? migration.resolveEditionOrigin(edition) : "imported";
    if (migration && !migration.isDeletableOrigin(origin)) {
      call("setNotice", "Built-in editions cannot be deleted.");
      return;
    }
    const book = store.getBookById(edition.hymnBookId);
    const impact = analyzeEditionReferences(editionId);
    const html = renderDeletionModal({
      targetType: "edition",
      targetId: editionId,
      targetName: `${book ? book.title : edition.hymnBookId} · ${edition.languageName || edition.editionName}`,
      confirmName: edition.languageName || edition.editionName,
      impact,
      origin,
      editionIds: [editionId],
    });
    call("openModal", html);
  }

  function openBookDeletionModal(hymnBookId) {
    const store = window.CISHymnalLibraryStore;
    const book = store ? store.getBookById(hymnBookId) : null;
    if (!book) return;
    const migration = window.CISHymnalMigration;
    const origin = migration ? migration.resolveBookOrigin(book) : "imported";
    if (migration && !migration.isDeletableOrigin(origin)) {
      call("setNotice", "Built-in hymn books cannot be deleted.");
      return;
    }
    const impact = analyzeBookReferences(hymnBookId);
    const html = renderDeletionModal({
      targetType: "book",
      targetId: hymnBookId,
      targetName: book.title || hymnBookId,
      confirmName: book.title || hymnBookId,
      impact,
      origin,
      editionIds: impact.editionIds,
    });
    call("openModal", html);
  }

  function validateConfirmInput(root, expectedName) {
    const input = root.querySelector("#hymnalDeleteConfirmInput");
    if (!input) return false;
    return String(input.value || "").trim() === String(expectedName || "").trim();
  }

  window.CISHymnalDeletionService = {
    configure,
    matchesEditionKey,
    analyzeEditionReferences,
    analyzeBookReferences,
    renderDeletionModal,
    readDeletionMode,
    executeEditionDeletion,
    executeBookDeletion,
    undoLastDeletion,
    getPendingUndo,
    openEditionDeletionModal,
    openBookDeletionModal,
    validateConfirmInput,
    buildReferencePatch,
  };
})();
