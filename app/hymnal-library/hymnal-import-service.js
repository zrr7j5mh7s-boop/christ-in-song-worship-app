(function () {
  "use strict";

  let callbacks = {};

  function configure(options) {
    callbacks = options || {};
  }

  function getExistingImportedPacks() {
    return typeof callbacks.getImportedPacks === "function" ? callbacks.getImportedPacks() : [];
  }

  function getAllLibraryPacks() {
    return typeof callbacks.getAllPacks === "function" ? callbacks.getAllPacks() : [];
  }

  function getBooksWithEditions() {
    return typeof callbacks.getBooksWithEditions === "function" ? callbacks.getBooksWithEditions() : [];
  }

  function isBuiltinPack(code) {
    if (typeof callbacks.isBuiltinPack === "function") return callbacks.isBuiltinPack(code);
    return false;
  }

  function detectImportContext(file, pack) {
    const migration = window.CISHymnalMigration;
    if (!migration) return null;
    const filename = file && file.name ? file.name : (pack && pack.source) || "";
    const bookDetection = migration.detectHymnBookFromFilename(filename);
    const lang = migration.detectLanguageFromFilename(filename, pack);
    const classified = migration.classifyImportedPack(pack || { code: lang.languageCode, name: lang.languageName }, filename);
    return {
      filename,
      bookDetection,
      language: lang,
      classified,
      suggestedHymnBookId: classified.hymnBookId,
      suggestedEditionId: classified.editionId,
    };
  }

  function analyzeDuplicates(incomingPacks, targetMeta) {
    const all = getAllLibraryPacks();
    const editions = window.CISHymnalLibraryStore ? window.CISHymnalLibraryStore.getCachedEditions() : [];
    return incomingPacks.map((pack) => {
      const meta = targetMeta || window.CISHymnalMigration.classifyImportedPack(pack, pack.source);
      const editionId = meta.editionId;
      const existingEdition = editions.find((item) => item.editionId === editionId) || null;
      const existingPack = all.find((item) => item.editionId === editionId || item.code === pack.code) || null;
      const overlap = existingPack
        ? (pack.songs || []).filter((song) => (existingPack.songs || []).some((existingSong) => existingSong.number === song.number)).length
        : 0;
      return {
        pack,
        meta,
        existingEdition,
        existingPack,
        overlap,
        isBuiltin: isBuiltinPack(pack.code),
        isNew: !existingPack && !existingEdition,
      };
    });
  }

  async function commitImport(packs, options = {}) {
    const store = window.CISHymnalLibraryStore;
    if (!store) throw new Error("Hymnal library store is not available.");
    const duplicateStrategy = options.duplicateStrategy || "skip";
    const hymnBookId = options.hymnBookId;
    const createNewBook = options.createNewBook;
    const hymnBookTitle = options.hymnBookTitle;
    const summaryItems = [];

    for (const pack of packs) {
      const meta = options.meta || window.CISHymnalMigration.classifyImportedPack(pack, pack.source);
      const importOptions = {
        duplicateStrategy,
        sourceFileName: pack.source,
        hymnBookId: createNewBook ? (options.newHymnBookId || window.CISHymnalMigration.slug(hymnBookTitle || pack.name)) : (hymnBookId || meta.hymnBookId),
        hymnBookTitle: createNewBook ? hymnBookTitle : undefined,
        createNewBook,
        languageCode: meta.languageCode,
        languageName: meta.languageName,
        nativeLanguageName: meta.nativeLanguageName,
        editionId: meta.editionId,
      };

      const result = await store.importEdition(pack, importOptions);
      summaryItems.push({
        code: result.pack.code,
        editionId: result.edition.editionId,
        hymnBookId: result.edition.hymnBookId,
        name: result.pack.name,
        added: result.isNew ? result.pack.songs.length : result.pack.songs.length,
        updated: result.isNew ? 0 : result.pack.songs.length,
        skipped: 0,
        total: result.pack.songs.length,
        isNew: result.isNew,
      });
    }

    const importedPacks = await store.getImportedPacksForLegacyApi();
    if (window.CISPackStore && window.CISPackStore.savePacks) {
      await window.CISPackStore.savePacks(importedPacks);
    }
    if (typeof callbacks.onImported === "function") {
      await callbacks.onImported({ importedPacks, summaryItems, hymnBookId: summaryItems[0]?.hymnBookId, editionId: summaryItems[0]?.editionId });
    }
    if (window.CISPackStore && window.CISPackStore.recordImportSummary) {
      await window.CISPackStore.recordImportSummary({ items: summaryItems, importedAt: Date.now() });
    }
    return summaryItems;
  }

  function renderBookTargetFields(ctx, escapeHtml) {
    const books = getBooksWithEditions();
    const detection = ctx.detection || {};
    return `
      <div class="hymnal-import-target form-grid">
        <fieldset class="hymnal-import-target-mode">
          <legend>Hymn book</legend>
          <label><input type="radio" name="hymnalImportTarget" value="existing" ${ctx.targetMode !== "new" ? "checked" : ""}> Add to existing hymn book</label>
          <label><input type="radio" name="hymnalImportTarget" value="new" ${ctx.targetMode === "new" ? "checked" : ""}> Create new hymn book</label>
        </fieldset>
        <label id="hymnalImportExistingBookWrap">
          <span>Hymn book</span>
          <select id="hymnalImportBookSelect">
            ${books.map((book) => `
              <option value="${escapeHtml(book.hymnBookId)}" ${book.hymnBookId === (ctx.selectedHymnBookId || detection.suggestedHymnBookId) ? "selected" : ""}>
                ${escapeHtml(book.title)}${book.isBuiltIn ? " (built-in)" : ""}
              </option>
            `).join("")}
          </select>
          <small class="muted">Detected: ${escapeHtml(detection.bookDetection?.title || "Unclassified")} (${escapeHtml(detection.bookDetection?.confidence || "low")} confidence)</small>
        </label>
        <label id="hymnalImportNewBookWrap" class="${ctx.targetMode === "new" ? "" : "hidden"}">
          <span>New hymn book title</span>
          <input id="hymnalImportNewBookTitle" type="text" value="${escapeHtml(ctx.newHymnBookTitle || "")}" placeholder="Church Hymnal">
        </label>
      </div>
    `;
  }

  window.CISHymnalImportService = {
    configure,
    detectImportContext,
    analyzeDuplicates,
    commitImport,
    renderBookTargetFields,
  };
})();
