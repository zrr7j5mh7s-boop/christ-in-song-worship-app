(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let callbacks = {};

  function configure(options) {
    callbacks = options || {};
    if (typeof options.escapeHtml === "function") escapeHtml = options.escapeHtml;
  }

  function renderLocaleDropdown(rootId, config) {
    const {
      open,
      ariaLabel,
      currentFlag,
      currentLabel,
      currentMeta,
      toggleCommand,
      triggerClass,
      items,
    } = config;
    return `
      <div id="${escapeHtml(rootId)}" class="locale-dropdown hymnal-selector ${open ? "open" : ""}" data-dropdown="${escapeHtml(rootId)}">
        <button
          class="locale-dropdown-trigger ${escapeHtml(triggerClass || "")}"
          type="button"
          aria-label="${escapeHtml(ariaLabel)}"
          aria-haspopup="menu"
          aria-expanded="${open ? "true" : "false"}"
          data-command="${escapeHtml(toggleCommand)}"
        >
          <span class="locale-flag" aria-hidden="true">${currentFlag || "📖"}</span>
          <span class="locale-label">${escapeHtml(currentLabel)}</span>
          ${currentMeta ? `<span class="locale-meta-inline muted">${escapeHtml(currentMeta)}</span>` : ""}
          <span class="locale-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="locale-dropdown-menu" role="menu">
          ${items}
        </div>
      </div>
    `;
  }

  function renderBookSwitcher(ctx) {
    const books = ctx.books || [];
    const activeBookId = ctx.hymnBookId;
    const items = books.map((book) => {
      const active = book.hymnBookId === activeBookId ? "active" : "";
      const editionCount = (book.editions || []).length;
      return `
        <button class="locale-dropdown-item ${active}" type="button" role="menuitem" data-hymn-book="${escapeHtml(book.hymnBookId)}">
          <span>
            ${escapeHtml(book.title)}
            <span class="locale-meta">${escapeHtml(book.shortTitle || book.hymnBookId)}</span>
          </span>
          <span class="locale-count ready">${editionCount} edition${editionCount === 1 ? "" : "s"}</span>
        </button>
      `;
    }).join("");
    const activeBook = books.find((book) => book.hymnBookId === activeBookId) || books[0] || { title: "Hymn Library" };
    return renderLocaleDropdown("hymnBookSwitcherInner", {
      open: ctx.bookMenuOpen,
      ariaLabel: "Hymn book",
      currentFlag: "📚",
      currentLabel: activeBook.title || "Hymn book",
      currentMeta: activeBook.shortTitle || "",
      toggleCommand: "toggle-hymn-book-menu",
      triggerClass: "ready",
      items,
    });
  }

  function renderEditionSwitcher(ctx) {
    const editions = (ctx.editions || []).filter((edition) => edition.hymnBookId === ctx.hymnBookId);
    const activeEditionId = ctx.editionId;
    const items = editions.map((edition) => {
      const active = edition.editionId === activeEditionId ? "active" : "";
      const status = edition.status === "ready" ? "ready" : "awaiting";
      const countLabel = edition.status === "ready"
        ? `${edition.hymnCount || 0} hymns`
        : "Awaiting";
      return `
        <button class="locale-dropdown-item ${active}" type="button" role="menuitem" data-edition="${escapeHtml(edition.editionId)}" data-lang="${escapeHtml(edition.packCode || edition.languageCode)}">
          <span>
            ${escapeHtml(edition.languageName || edition.editionName)}
            <span class="locale-meta">${escapeHtml(edition.nativeLanguageName || edition.languageCode || "")}</span>
          </span>
          <span class="locale-count ${status}">${escapeHtml(countLabel)}</span>
        </button>
      `;
    }).join("");
    const activeEdition = editions.find((edition) => edition.editionId === activeEditionId) || editions[0] || { languageName: "Edition" };
    return renderLocaleDropdown("hymnEditionSwitcherInner", {
      open: ctx.editionMenuOpen,
      ariaLabel: "Language edition",
      currentFlag: "🌐",
      currentLabel: activeEdition.languageName || activeEdition.editionName || "Edition",
      currentMeta: activeEdition.status === "ready" ? `${activeEdition.hymnCount || 0} hymns` : "Awaiting",
      toggleCommand: "toggle-hymn-edition-menu",
      triggerClass: activeEdition.status === "ready" ? "ready" : "awaiting",
      items,
    });
  }

  function renderTopbarSelectors(ctx) {
    return `
      <div class="hymnal-selector-group">
        ${renderBookSwitcher(ctx)}
        ${renderEditionSwitcher(ctx)}
      </div>
    `;
  }

  function renderIndexSelectors(ctx) {
    return `
      <div class="hymn-index-selectors hymnal-selector-group">
        ${renderBookSwitcher({ ...ctx, bookMenuOpen: ctx.indexBookMenuOpen, editionMenuOpen: ctx.indexEditionMenuOpen, togglePrefix: "index-" })}
        ${renderEditionSwitcher({ ...ctx, bookMenuOpen: ctx.indexBookMenuOpen, editionMenuOpen: ctx.indexEditionMenuOpen, togglePrefix: "index-" })}
      </div>
    `;
  }

  function originBadge(origin) {
    const migration = window.CISHymnalMigration;
    const label = migration ? migration.originLabel(origin) : "Imported";
    const safeOrigin = origin || "imported";
    return `<span class="origin-badge origin-${escapeHtml(safeOrigin)}">${escapeHtml(label)}</span>`;
  }

  function renderBuiltinBookActions(book) {
    return `
      <button class="secondary-button" type="button" data-command="select-hymn-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Open</button>
      <button class="secondary-button" type="button" data-command="edit-hymnal-metadata" data-hymn-book="${escapeHtml(book.hymnBookId)}">Edit Metadata</button>
      <button class="secondary-button" type="button" data-command="validate-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Validate</button>
      <button class="secondary-button" type="button" data-command="hide-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Hide</button>
    `;
  }

  function renderImportedBookActions(book) {
    return `
      <button class="secondary-button" type="button" data-command="select-hymn-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Open</button>
      <button class="secondary-button" type="button" data-command="edit-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Edit</button>
      <button class="secondary-button" type="button" data-command="export-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Export</button>
      <button class="danger-button" type="button" data-command="delete-hymnal-book" data-hymn-book="${escapeHtml(book.hymnBookId)}">Delete</button>
    `;
  }

  function renderBuiltinEditionActions(book, edition) {
    return `
      <button class="secondary-button" type="button" data-command="select-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}" data-hymn-book="${escapeHtml(book.hymnBookId)}" data-lang="${escapeHtml(edition.packCode || edition.languageCode)}">Open</button>
      <button class="secondary-button" type="button" data-command="edit-hymnal-metadata" data-edition="${escapeHtml(edition.editionId)}">Edit Metadata</button>
      <button class="secondary-button" type="button" data-command="validate-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}">Validate</button>
      <button class="secondary-button" type="button" data-command="hide-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}">Hide</button>
    `;
  }

  function renderImportedEditionActions(book, edition) {
    return `
      <button class="secondary-button" type="button" data-command="select-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}" data-hymn-book="${escapeHtml(book.hymnBookId)}" data-lang="${escapeHtml(edition.packCode || edition.languageCode)}">Open</button>
      <button class="secondary-button" type="button" data-command="edit-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}">Edit</button>
      <button class="secondary-button" type="button" data-command="replace-hymnal-source" data-edition="${escapeHtml(edition.editionId)}">Replace Source</button>
      <button class="secondary-button" type="button" data-command="export-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}">Export</button>
      <button class="danger-button" type="button" data-command="delete-hymnal-edition" data-edition="${escapeHtml(edition.editionId)}">Delete</button>
    `;
  }

  function renderBookActions(book) {
    const migration = window.CISHymnalMigration;
    const origin = migration ? migration.resolveBookOrigin(book) : (book.isBuiltIn ? "builtIn" : "imported");
    if (migration && migration.isDeletableOrigin(origin)) return renderImportedBookActions(book);
    return renderBuiltinBookActions(book);
  }

  function renderEditionActions(book, edition) {
    const migration = window.CISHymnalMigration;
    const origin = migration ? migration.resolveEditionOrigin(edition) : (edition.sourceType === "builtin" ? "builtIn" : "imported");
    if (migration && migration.isDeletableOrigin(origin)) return renderImportedEditionActions(book, edition);
    return renderBuiltinEditionActions(book, edition);
  }
  function renderSettingsPanel(ctx) {
    const books = ctx.books || [];
    const migration = window.CISHymnalMigration;
    return `
      <section class="section hymnal-library-settings">
        <div class="song-header">
          <div>
            <p class="eyebrow">Hymnal library</p>
            <h2>Hymnal Library Manager</h2>
            <p class="muted">Organise hymn books, language editions, and imports. Built-in hymnals are protected; imported and user-created collections can be edited or deleted.</p>
          </div>
          <button class="action-button" type="button" data-command="import-language-pack">Import Hymns</button>
        </div>
        <div class="hymnal-library-tree">
          ${books.map((book) => {
            const bookOrigin = migration ? migration.resolveBookOrigin(book) : (book.isBuiltIn ? "builtIn" : "imported");
            return `
            <article class="hymnal-book-card">
              <header class="hymnal-book-header">
                <div>
                  <strong>${escapeHtml(book.title)}</strong>
                  <span class="muted">${escapeHtml(book.shortTitle || book.hymnBookId)} · ${originBadge(bookOrigin)}${book.isEditable === false ? " · Read-only" : ""}</span>
                </div>
                <div class="hymnal-book-actions button-row">
                  ${renderBookActions(book)}
                </div>
              </header>
              ${book.description ? `<p class="muted hymnal-book-desc">${escapeHtml(book.description)}</p>` : ""}
              ${book.copyrightNotice ? `<p class="muted hymnal-book-legal"><strong>Copyright:</strong> ${escapeHtml(book.copyrightNotice)}</p>` : ""}
              <ul class="hymnal-edition-list">
                ${(book.editions || []).map((edition) => {
                  const editionOrigin = migration ? migration.resolveEditionOrigin(edition) : (edition.sourceType === "builtin" ? "builtIn" : "imported");
                  return `
                  <li class="hymnal-edition-row">
                    <div>
                      <strong>${escapeHtml(edition.languageName || edition.editionName)}</strong>
                      <span class="muted">${escapeHtml(edition.editionId)} · ${originBadge(editionOrigin)} · ${escapeHtml(edition.sourceFileName || edition.sourceType || "")}</span>
                    </div>
                    <div class="hymnal-edition-meta button-row">
                      <span class="status-pill ${edition.status === "ready" ? "ready" : "awaiting"}">${edition.hymnCount || 0} hymns</span>
                      ${renderEditionActions(book, edition)}
                    </div>
                  </li>
                `;
                }).join("") || `<li class="muted">No editions yet.</li>`}
              </ul>
            </article>
          `;
          }).join("") || `<div class="empty-state">No hymn books found.</div>`}
        </div>
        ${ctx.unclassifiedCount ? `<p class="muted">${ctx.unclassifiedCount} import(s) in Unclassified Hymn Books need manual classification.</p>` : ""}
        ${ctx.pendingUndo ? `<p class="notice-inline"><button class="text-button" type="button" data-command="undo-hymnal-delete">Undo delete of ${escapeHtml(ctx.pendingUndo.label)}</button> <span class="muted">(60s window)</span></p>` : ""}
      </section>
    `;
  }

  window.CISHymnalLibraryUI = {
    configure,
    renderTopbarSelectors,
    renderIndexSelectors,
    renderSettingsPanel,
    renderBookSwitcher,
    renderEditionSwitcher,
  };
})();
