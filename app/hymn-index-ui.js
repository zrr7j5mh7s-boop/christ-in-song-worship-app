(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  const ICONS = {
    grid: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/></svg>',
    compact: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="1" y="2" width="4" height="4" rx="1" fill="currentColor"/><rect x="6" y="2" width="4" height="4" rx="1" fill="currentColor"/><rect x="11" y="2" width="4" height="4" rx="1" fill="currentColor"/><rect x="16" y="2" width="3" height="4" rx="1" fill="currentColor"/><rect x="1" y="8" width="4" height="4" rx="1" fill="currentColor"/><rect x="6" y="8" width="4" height="4" rx="1" fill="currentColor"/><rect x="11" y="8" width="4" height="4" rx="1" fill="currentColor"/><rect x="16" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="1" y="14" width="4" height="4" rx="1" fill="currentColor"/><rect x="6" y="14" width="4" height="4" rx="1" fill="currentColor"/><rect x="11" y="14" width="4" height="4" rx="1" fill="currentColor"/><rect x="16" y="14" width="3" height="4" rx="1" fill="currentColor"/></svg>',
    list: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="16" height="3" rx="1" fill="currentColor"/><rect x="2" y="8.5" width="16" height="3" rx="1" fill="currentColor"/><rect x="2" y="14" width="16" height="3" rx="1" fill="currentColor"/></svg>',
    options: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="16" r="1.6" fill="currentColor"/></svg>',
    sort: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h8v2H6V4zm0 5h5v2H6V9zm0 5h3v2H6v-2z" fill="currentColor"/></svg>',
    search: '<svg class="hymn-index-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  const LAYOUT_LABELS = {
    grid: "Standard Grid",
    compact: "Compact Grid",
    list: "List",
  };

  const SORT_OPTIONS = [
    { id: "number-asc", label: "Hymn number" },
    { id: "number-desc", label: "Hymn number (desc)" },
    { id: "title-asc", label: "Title A–Z" },
    { id: "title-desc", label: "Title Z–A" },
    { id: "recent", label: "Recently opened" },
    { id: "favorites", label: "Favourites first" },
  ];

  const cardHtmlCache = new Map();
  const CARD_CACHE_MAX = 512;

  function cardCacheKey(song, ctx, layout) {
    const key = typeof ctx.songKey === "function" ? ctx.songKey(song) : String(song.number || "");
    const starred = ctx.favorites && ctx.favorites.has(key) ? 1 : 0;
    return [
      key,
      layout,
      ctx.showTitles !== false ? 1 : 0,
      ctx.showCategories !== false ? 1 : 0,
      ctx.showFavorites !== false ? 1 : 0,
      starred,
      ctx.langCode || "",
      ctx.editionId || "",
    ].join("|");
  }

  function getCachedCardHtml(song, ctx, layout, renderFn) {
    const cacheKey = cardCacheKey(song, ctx, layout);
    if (cardHtmlCache.has(cacheKey)) return cardHtmlCache.get(cacheKey);
    const html = renderFn();
    if (cardHtmlCache.size >= CARD_CACHE_MAX) {
      const oldest = cardHtmlCache.keys().next().value;
      cardHtmlCache.delete(oldest);
    }
    cardHtmlCache.set(cacheKey, html);
    return html;
  }

  function clearCardCache() {
    cardHtmlCache.clear();
  }

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
    if (options?.clearCardCache) clearCardCache();
  }

  function renderViewButton(layout, activeLayout, label) {
    const active = layout === activeLayout ? " active" : "";
    const pressed = layout === activeLayout ? "true" : "false";
    return `
      <button
        type="button"
        class="hymn-index-view-btn${active}"
        data-command="set-index-layout"
        data-layout="${escapeHtml(layout)}"
        aria-pressed="${pressed}"
        aria-label="${escapeHtml(label)}"
        title="${escapeHtml(label)}"
      >${ICONS[layout] || ""}<span class="hymn-index-view-label">${escapeHtml(label)}</span></button>
    `;
  }

  function renderToolbar(ctx) {
    const settings = ctx.settings || {};
    const layout = settings.layout || "grid";
    const selectorRow = typeof ctx.renderHymnalSelectors === "function" ? ctx.renderHymnalSelectors() : "";
    return `
      ${selectorRow}
      <div class="hymn-index-toolbar">
        <div class="hymn-index-toolbar-primary">
          <label class="search-box hymn-index-search">
            <span class="hymn-index-search-icon" aria-hidden="true">${ICONS.search}</span>
            <input
              id="indexSearchInput"
              type="search"
              value="${escapeHtml(ctx.query || "")}"
              placeholder="Search hymns"
              aria-label="Search hymns in this range"
            >
          </label>
          <div class="tab-row hymn-index-ranges" role="group" aria-label="Hymn number ranges">
            ${(ctx.ranges || []).map((range) => `
              <button
                class="range-button ${ctx.activeRange === range[0] ? "active" : ""}"
                type="button"
                data-command="set-range"
                data-range="${escapeHtml(range[0])}"
              >${escapeHtml(range[0])}</button>
            `).join("")}
          </div>
        </div>
        <div class="hymn-index-toolbar-secondary">
          <div class="hymn-index-control-group" role="group" aria-label="View layout">
            <span class="hymn-index-control-label">View</span>
            ${renderViewButton("grid", layout, "Grid")}
            ${renderViewButton("compact", layout, "Compact Grid")}
            ${renderViewButton("list", layout, "List")}
          </div>
          <label class="hymn-index-toggle">
            <input
              type="checkbox"
              id="indexShowCategories"
              data-command="toggle-index-categories"
              ${settings.showCategories !== false ? "checked" : ""}
            >
            <span>Show categories</span>
          </label>
          <label class="hymn-index-sort-wrap">
            <span class="hymn-index-control-label">Sort</span>
            <select id="indexSortSelect" data-command="set-index-sort" aria-label="Sort hymns">
              ${SORT_OPTIONS.map((opt) => `
                <option value="${escapeHtml(opt.id)}" ${settings.sort === opt.id ? "selected" : ""}>${escapeHtml(opt.label)}</option>
              `).join("")}
            </select>
          </label>
          <details class="hymn-index-display-menu">
            <summary class="secondary-button hymn-index-options-btn" aria-label="Display options">
              ${ICONS.options}
              <span>Display Options</span>
            </summary>
            <div class="hymn-index-display-panel" role="group" aria-label="Display options">
              <fieldset>
                <legend>Layout</legend>
                <label><input type="radio" name="indexLayoutMenu" value="grid" data-command="set-index-layout" data-layout="grid" ${layout === "grid" ? "checked" : ""}> Standard Grid</label>
                <label><input type="radio" name="indexLayoutMenu" value="compact" data-command="set-index-layout" data-layout="compact" ${layout === "compact" ? "checked" : ""}> Compact Grid</label>
                <label><input type="radio" name="indexLayoutMenu" value="list" data-command="set-index-layout" data-layout="list" ${layout === "list" ? "checked" : ""}> List</label>
              </fieldset>
              <fieldset>
                <legend>Content</legend>
                <label><input type="checkbox" data-command="toggle-index-show-titles" ${settings.showTitles !== false ? "checked" : ""}> Show hymn titles</label>
                <label><input type="checkbox" data-command="toggle-index-show-categories" ${settings.showCategories !== false ? "checked" : ""}> Show categories</label>
                <label><input type="checkbox" data-command="toggle-index-show-favorites" ${settings.showFavorites !== false ? "checked" : ""}> Show favourite indicator</label>
              </fieldset>
              <fieldset>
                <legend>Density</legend>
                <label><input type="radio" name="indexDensityMenu" value="comfortable" data-command="set-index-density" data-density="comfortable" ${settings.density !== "compact" ? "checked" : ""}> Comfortable</label>
                <label><input type="radio" name="indexDensityMenu" value="compact" data-command="set-index-density" data-density="compact" ${settings.density === "compact" ? "checked" : ""}> Compact</label>
              </fieldset>
            </div>
          </details>
        </div>
        ${ctx.filterRow || ""}
      </div>
    `;
  }

  function renderCategoryRow(ctx) {
    if (typeof ctx.renderFilterRow === "function") {
      const row = ctx.renderFilterRow();
      if (row) {
        return row.replace('data-command="clear-tag-filters">All<', 'data-command="clear-tag-filters">All Hymns<');
      }
    }
    const categories = ctx.categories || [];
    const activeCategory = ctx.activeCategory || "all";
    return `
      <div class="filter-row hymn-index-filters" aria-label="Category filters">
        <button type="button" class="filter-chip ${activeCategory === "all" && !(ctx.activeTagFilters || []).length ? "active" : ""}" data-command="index-all-hymns">All Hymns</button>
        ${categories.map((category) => `
          <button type="button" class="filter-chip ${activeCategory === category.id ? "active" : ""}" data-command="set-category" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>
        `).join("")}
      </div>
    `;
  }

  function hymnAriaLabel(song, showTitles) {
    const number = song.number || "";
    const title = song.title || "";
    return showTitles !== false ? `Hymn ${number}, ${title}` : `Hymn ${number}`;
  }

  function renderTags(tagsHtml, showCategories) {
    if (showCategories === false || !tagsHtml) return "";
    return `<div class="hymn-card-tags" aria-hidden="false">${tagsHtml}</div>`;
  }

  function renderGridCard(song, ctx) {
    const key = ctx.songKey(song);
    const starred = ctx.favorites && ctx.favorites.has(key);
    const tags = ctx.showCategories !== false ? ctx.renderSongTags(song) : "";
    const compact = ctx.layout === "compact";
    const showTitles = ctx.showTitles !== false;
    const showFav = ctx.showFavorites !== false && starred;
    const hymnKey = typeof ctx.songKey === "function" ? ctx.songKey(song) : String(song.number || "");
    const langAttr = ctx.langCode ? ` data-lang-jump="${escapeHtml(ctx.langCode)}" data-edition="${escapeHtml(ctx.editionId || "")}"` : "";
    return `
      <button
        class="hymn-index-card ${compact ? "is-compact" : "is-standard"}"
        type="button"
        data-hymn-key="${escapeHtml(hymnKey)}"
        data-song="${escapeHtml(song.number)}"${langAttr}
        aria-label="${escapeHtml(hymnAriaLabel(song, showTitles))}"
      >
        ${showFav ? '<span class="hymn-card-fav" aria-label="Favourite">★</span>' : ""}
        <span class="hymn-card-number">${escapeHtml(song.number)}</span>
        ${showTitles ? `<span class="hymn-card-title">${escapeHtml(song.title)}</span>` : ""}
        ${renderTags(tags, ctx.showCategories)}
      </button>
    `;
  }

  function renderListRow(song, ctx) {
    const key = ctx.songKey(song);
    const starred = ctx.favorites && ctx.favorites.has(key);
    const tags = ctx.showCategories !== false ? ctx.renderSongTags(song) : "";
    const showTitles = ctx.showTitles !== false;
    const showFav = ctx.showFavorites !== false;
    const hymnKey = typeof ctx.songKey === "function" ? ctx.songKey(song) : String(song.number || "");
    const langAttr = ctx.langCode ? ` data-lang-jump="${escapeHtml(ctx.langCode)}" data-edition="${escapeHtml(ctx.editionId || "")}"` : "";
    const actions = typeof ctx.renderHymnQueueActions === "function"
      ? ctx.renderHymnQueueActions(song, { code: ctx.langCode, editionId: ctx.editionId })
      : "";
    return `
      <div class="hymn-index-list-item" data-hymn-key="${escapeHtml(hymnKey)}">
      <button
        class="hymn-index-list-row"
        type="button"
        data-hymn-key="${escapeHtml(hymnKey)}"
        data-song="${escapeHtml(song.number)}"${langAttr}
        aria-label="${escapeHtml(hymnAriaLabel(song, showTitles))}"
      >
        <span class="hymn-list-number">${escapeHtml(song.number)}</span>
        ${showTitles ? `<span class="hymn-list-title">${escapeHtml(song.title)}</span>` : ""}
        ${ctx.showCategories !== false && tags ? `<span class="hymn-list-tags">${tags}</span>` : ""}
        ${showFav ? `<span class="hymn-list-fav" aria-label="${starred ? "Favourite" : "Not a favourite"}">${starred ? "★" : ""}</span>` : ""}
        <span class="hymn-list-action muted">Open</span>
      </button>
      ${actions}
      </div>
    `;
  }

  function renderCollection(songs, settings, ctx) {
    const layout = settings.layout || "grid";
    const density = settings.density || "comfortable";
    const renderCtx = {
      ...ctx,
      layout,
      showCategories: settings.showCategories,
      showTitles: settings.showTitles,
      showFavorites: settings.showFavorites,
    };

    if (!songs.length) {
      return renderEmptyState(ctx);
    }

    if (layout === "list") {
      return `
        <div id="hymnIndexCollection" class="hymn-index-list density-${escapeHtml(density)}" role="list" aria-label="Hymn list, ${LAYOUT_LABELS.list}">
          ${songs.map((song) => getCachedCardHtml(song, renderCtx, "list", () => renderListRow(song, renderCtx))).join("")}
        </div>
      `;
    }

    const layoutClass = layout === "compact" ? "layout-compact" : "layout-grid";
    return `
      <div
        id="hymnIndexCollection"
        class="hymn-index-grid ${layoutClass} density-${escapeHtml(density)}"
        role="list"
        aria-label="Hymn index, ${escapeHtml(LAYOUT_LABELS[layout] || "Grid")}"
        aria-live="polite"
      >
        ${songs.map((song) => getCachedCardHtml(song, renderCtx, layout, () => renderGridCard(song, renderCtx))).join("")}
      </div>
    `;
  }

  function paintCollection(root, songs, settings, ctx) {
    if (!root) return;
    const html = renderCollection(songs, settings, ctx);
    root.innerHTML = html;
    const collection = root.querySelector("#hymnIndexCollection, .hymn-index-list, .hymn-index-empty");
    if (collection) {
      collection.classList.remove("is-pending");
    }
  }

  function setCollectionPending(root) {
    if (!root) return;
    root.classList.add("is-pending");
  }

  function renderEmptyState(ctx) {
    const hasQuery = Boolean((ctx.query || "").trim());
    const hasCategory = (ctx.activeTagFilters || []).length > 0 || (ctx.activeCategory && ctx.activeCategory !== "all");
    let message = "No hymns in the selected range.";
    if (hasQuery && hasCategory) message = "No hymns match the current search and filters.";
    else if (hasQuery) message = "No hymns matching search.";
    else if (hasCategory) message = "No hymns match the active category filter.";
    else if (ctx.packNotReady) message = "Hymn pack failed to load.";

    return `
      <div class="empty-state hymn-index-empty">
        <p>${escapeHtml(message)}</p>
        ${hasQuery || hasCategory ? `<button type="button" class="secondary-button" data-command="index-clear-filters">Clear search and filters</button>` : ""}
      </div>
    `;
  }

  function renderPage(ctx) {
    const settings = ctx.settings || {};
    const filterRow = renderCategoryRow(ctx);
    return `
      <section class="section hymn-index-section">
        ${renderToolbar({ ...ctx, filterRow })}
        <div id="hymnIndexCollectionRoot">
          ${renderCollection(ctx.songs || [], settings, ctx)}
        </div>
      </section>
    `;
  }

  function sortSongs(songs, sortId, ctx) {
    const list = (songs || []).slice();
    const sort = sortId || "number-asc";
    const favorites = ctx.favorites;
    const recents = ctx.recents || [];
    const songKey = ctx.songKey;

    if (sort === "number-desc") {
      return list.sort((a, b) => Number(b.number) - Number(a.number));
    }
    if (sort === "title-asc") {
      return list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" }));
    }
    if (sort === "title-desc") {
      return list.sort((a, b) => String(b.title || "").localeCompare(String(a.title || ""), undefined, { sensitivity: "base" }));
    }
    if (sort === "recent" && songKey) {
      const rank = new Map(recents.map((key, index) => [key, index]));
      return list.sort((a, b) => {
        const ar = rank.has(songKey(a)) ? rank.get(songKey(a)) : 9999;
        const br = rank.has(songKey(b)) ? rank.get(songKey(b)) : 9999;
        if (ar !== br) return ar - br;
        return Number(a.number) - Number(b.number);
      });
    }
    if (sort === "favorites" && favorites && songKey) {
      return list.sort((a, b) => {
        const af = favorites.has(songKey(a)) ? 0 : 1;
        const bf = favorites.has(songKey(b)) ? 0 : 1;
        if (af !== bf) return af - bf;
        return Number(a.number) - Number(b.number);
      });
    }
    return list.sort((a, b) => Number(a.number) - Number(b.number));
  }

  window.CISHymnIndexUI = {
    ICONS,
    LAYOUT_LABELS,
    configure,
    renderPage,
    renderToolbar,
    renderCollection,
    paintCollection,
    setCollectionPending,
    clearCardCache,
    renderEmptyState,
    sortSongs,
  };
})();
