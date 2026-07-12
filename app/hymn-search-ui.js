(function () {
  "use strict";

  const DEBOUNCE_MS = 180;

  let escapeHtml = (value) => String(value || "");
  let callbacks = {};
  let searchSession = null;
  let lastPayload = { groups: [], total: 0, flat: [] };
  let activeIndex = -1;
  let searchPending = false;

  function ensureSearchSession() {
    if (!searchSession && window.CISTaskSession) {
      searchSession = window.CISTaskSession.createDebouncedSession({ debounceMs: DEBOUNCE_MS });
    }
    return searchSession;
  }

  function configure(options) {
    callbacks = options || {};
    if (typeof callbacks.escapeHtml === "function") escapeHtml = callbacks.escapeHtml;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function renderScopeRow() {
    if (typeof callbacks.renderScopeRow === "function") return callbacks.renderScopeRow();
    return "";
  }

  function renderFilterRow() {
    const scope = renderScopeRow();
    const filters = typeof callbacks.renderFilterRow === "function" ? callbacks.renderFilterRow() : "";
    return `${scope}${filters}`;
  }

  function renderPage(query) {
    return `
      <section class="section global-search-page">
        <div class="global-search-hero">
          <div>
            <p class="eyebrow">All languages</p>
            <h2>Find a hymn fast</h2>
            <p class="muted">Search hymn numbers, titles, verses, and chorus lines across every language in your library.</p>
          </div>
          <div class="global-search-meta" id="globalSearchMeta">
            <span class="search-stat-pill">Searching ${escapeHtml(String(call("getIndexedCount") || 0))} hymns</span>
          </div>
        </div>
        <div class="global-search-toolbar">
          <label class="search-box global-search-input">
            <span aria-hidden="true">⌕</span>
            <input
              id="globalSearchInput"
              type="search"
              value="${escapeHtml(query || "")}"
              placeholder="Try a hymn number, title, or lyric line..."
              autocomplete="off"
              spellcheck="false"
              aria-controls="globalSearchResults"
              aria-expanded="true"
              role="combobox"
              aria-autocomplete="list"
            >
          </label>
          <span class="global-search-count muted" id="globalSearchCount" aria-live="polite"></span>
        </div>
        <div class="filter-row tag-filter-section global-search-filters">
          ${renderFilterRow()}
        </div>
        <div id="globalSearchResults" class="global-search-results" role="listbox" aria-label="Search results"></div>
      </section>
    `;
  }

  function renderGroup(group) {
    const indexCollection = call("renderIndexCollection");
    const sourceLabel = group.sourceLabel || group.packName;
    if (typeof indexCollection === "function") {
      const songs = (group.results || []).map((item) => item.song).filter(Boolean);
      return `
        <section class="search-language-group">
          <div class="search-language-head">
            <span class="language-badge">${escapeHtml(sourceLabel)}</span>
            <span class="muted">${group.results.length} match${group.results.length === 1 ? "" : "es"}</span>
          </div>
          ${indexCollection(songs, { code: group.code, editionId: group.editionId, query: call("getQuery") || "" })}
        </section>
      `;
    }
    return `
      <section class="search-language-group">
        <div class="search-language-head">
          <span class="language-badge">${escapeHtml(sourceLabel)}</span>
          <span class="muted">${group.results.length} match${group.results.length === 1 ? "" : "es"}</span>
        </div>
        <div class="search-result-grid">
          ${group.results.map((item, index) => renderResultCard(item, index)).join("")}
        </div>
      </section>
    `;
  }

  function renderResultCard(item, indexInFlat) {
    const flatIndex = typeof item.flatIndex === "number" ? item.flatIndex : indexInFlat;
    const active = flatIndex === activeIndex ? " active" : "";
    const tags = call("renderSongTags", item.song, item.code) || "";
    const songKey = typeof call("makeSongKey", item) === "string"
      ? call("makeSongKey", item)
      : "";
    const actions = songKey ? (call("renderHymnQueueActions", songKey) || "") : "";
    return `
      <div class="search-result-card-wrap${active}">
      <button
        type="button"
        class="search-result-card${active}"
        data-search-result
        data-flat-index="${flatIndex}"
        data-song="${escapeHtml(item.number)}"
        data-lang-jump="${escapeHtml(item.code)}"
        data-edition-jump="${escapeHtml(item.editionId || "")}"
        role="option"
        aria-selected="${flatIndex === activeIndex ? "true" : "false"}"
      >
        <div class="search-result-main">
          <span class="search-result-number">${escapeHtml(item.number)}</span>
          <div class="search-result-copy">
            <div class="search-result-source muted">${escapeHtml(item.sourceLabel || item.packName || "")}</div>
            <div class="search-result-title">${item.titleHtml || escapeHtml(item.title)}</div>
            ${item.snippetHtml ? `
              <div class="search-result-snippet">
                <span class="search-match-label">${escapeHtml(item.matchLabel || "Match")}</span>
                <p>${item.snippetHtml}</p>
              </div>
            ` : ""}
          </div>
        </div>
        ${tags ? `<div class="search-result-tags">${tags}</div>` : ""}
      </button>
      ${actions}
      </div>
    `;
  }

  function renderResults(payload) {
    if (!payload || !payload.total) {
      const query = call("getQuery") || "";
      return query
        ? `<div class="empty-state global-search-empty">No hymns matched <strong>${escapeHtml(query)}</strong>. Try another title, number, or lyric phrase.</div>`
        : `<div class="empty-state global-search-empty">Start typing to search every language at once — hymn numbers, titles, verses, and chorus lines.</div>`;
    }

    let flatIndex = 0;
    return payload.groups.map((group) => {
      const withIndexes = {
        ...group,
        results: group.results.map((item) => {
          const next = { ...item, flatIndex };
          flatIndex += 1;
          return next;
        }),
      };
      return renderGroup(withIndexes);
    }).join("");
  }

  function setSearchPending(pending) {
    searchPending = pending;
    const countEl = document.getElementById("globalSearchCount");
    if (!countEl) return;
    countEl.classList.toggle("is-pending", pending);
    if (pending) {
      const query = call("getQuery") || "";
      countEl.textContent = query ? "Searching…" : "Type to search all languages";
    }
  }

  function updateCount(total) {
    const countEl = document.getElementById("globalSearchCount");
    if (!countEl) return;
    countEl.classList.remove("is-pending");
    const query = call("getQuery") || "";
    if (!query) {
      countEl.textContent = "Type to search all languages";
      return;
    }
    countEl.textContent = `${total} result${total === 1 ? "" : "s"}`;
  }

  function paintResults(payload) {
    lastPayload = payload || { groups: [], total: 0, flat: [] };
    const root = document.getElementById("globalSearchResults");
    if (!root) return;
    if (activeIndex >= lastPayload.flat.length) activeIndex = lastPayload.flat.length - 1;
    root.innerHTML = renderResults(lastPayload);
    updateCount(lastPayload.total);
    scrollActiveIntoView();
  }

  function runSearchNow(gen, isCurrent) {
    const query = call("getQuery") || "";
    if (!window.CISSearchEngine) {
      if (isCurrent && !isCurrent(gen)) return;
      paintResults({ groups: [], total: 0, flat: [] });
      setSearchPending(false);
      return;
    }
    const scopeOptions = typeof callbacks.getSearchScopeOptions === "function"
      ? callbacks.getSearchScopeOptions()
      : {};
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const payload = window.CISSearchEngine.search(query, { limit: 120, ...scopeOptions });
    if (isCurrent && !isCurrent(gen)) return;
    paintResults(payload);
    setSearchPending(false);
    if (window.CISPerformanceMonitor) {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      window.CISPerformanceMonitor.record("hymnSearchMs", ended - started);
    }
  }

  function scheduleSearch() {
    const session = ensureSearchSession();
    setSearchPending(true);
    if (session) {
      session.scheduleDebounced(runSearchNow);
      return;
    }
    runSearchNow(0, () => true);
  }

  function scrollActiveIntoView() {
    const root = document.getElementById("globalSearchResults");
    if (!root || activeIndex < 0) return;
    const activeEl = root.querySelector(`[data-flat-index="${activeIndex}"]`);
    if (activeEl && activeEl.scrollIntoView) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }

  function setActiveIndex(nextIndex) {
    const total = lastPayload.flat.length;
    if (!total) {
      activeIndex = -1;
      paintResults(lastPayload);
      return;
    }
    if (nextIndex < 0) activeIndex = total - 1;
    else if (nextIndex >= total) activeIndex = 0;
    else activeIndex = nextIndex;
    paintResults(lastPayload);
  }

  function openActiveResult() {
    if (activeIndex < 0 || !lastPayload.flat[activeIndex]) return;
    const item = lastPayload.flat[activeIndex];
    call("onOpenSong", item.number, item.code, item.editionId);
  }

  function bind() {
    const input = document.getElementById("globalSearchInput");
    const root = document.getElementById("globalSearchResults");
    if (!input || !root) return;

    activeIndex = -1;
    input.addEventListener("input", () => {
      call("setQuery", input.value);
      activeIndex = -1;
      scheduleSearch();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex(activeIndex < 0 ? 0 : activeIndex + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(activeIndex < 0 ? lastPayload.flat.length - 1 : activeIndex - 1);
        return;
      }
      if (event.key === "Enter") {
        if (activeIndex >= 0) {
          event.preventDefault();
          openActiveResult();
        }
        return;
      }
      if (event.key === "Escape") {
        activeIndex = -1;
        paintResults(lastPayload);
      }
    });

    root.addEventListener("mousemove", (event) => {
      const card = event.target.closest("[data-flat-index]");
      if (!card) return;
      const index = Number(card.dataset.flatIndex);
      if (!Number.isNaN(index) && index !== activeIndex) {
        activeIndex = index;
        paintResults(lastPayload);
      }
    });

    root.addEventListener("click", (event) => {
      const card = event.target.closest("[data-search-result]");
      if (!card) return;
      event.stopPropagation();
      call("onOpenSong", card.dataset.song, card.dataset.langJump, card.dataset.editionJump);
    });

    runSearchNow();
    window.setTimeout(() => input.focus(), 0);
  }

  window.CISSearchUI = {
    configure,
    renderPage,
    bind,
    refresh: () => {
      const session = ensureSearchSession();
      if (session) return session.runImmediate(runSearchNow);
      return runSearchNow(0, () => true);
    },
    cancelPending: () => {
      if (searchSession) searchSession.cancelPending();
      setSearchPending(false);
    },
    isSearchPending: () => searchPending,
  };
})();
