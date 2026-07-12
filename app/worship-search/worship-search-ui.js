(function () {
  "use strict";

  const DEBOUNCE_MS = 200;
  const GROUP_ORDER = [
    "bible-references",
    "bible-text",
    "hymns",
    "service-items",
    "media",
    "recent",
    "favorites",
  ];

  let escapeHtml = (v) => String(v || "");
  let callbacks = {};
  let searchSession = null;
  let lastPayload = { groups: [], flat: [], total: 0, interpretation: null };
  let activeIndex = -1;
  let searchPending = false;
  let interpretationOverride = "";

  function configure(options) {
    callbacks = options || {};
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function ensureSearchSession() {
    if (!searchSession && window.CISTaskSession) {
      searchSession = window.CISTaskSession.createDebouncedSession({ debounceMs: DEBOUNCE_MS });
    }
    return searchSession;
  }

  function renderInterpretation(payload) {
    const interpretation = payload?.interpretation;
    const choices = window.CISWorshipSearchQueryDetector
      ? window.CISWorshipSearchQueryDetector.interpretationChoices(interpretation)
      : [];
    if (!interpretation?.query) return "";
    return `
      <div class="worship-search-interpretation" role="group" aria-label="Search interpretation">
        <span class="worship-search-interpretation-label">
          Searching as <strong>${escapeHtml(interpretation.label || "General search")}</strong>
        </span>
        <div class="worship-search-interpretation-choices">
          ${choices.map((choice) => `
            <button
              type="button"
              class="filter-chip ${choice.active ? "active" : ""}"
              data-worship-search-interpretation="${escapeHtml(choice.id)}"
              aria-pressed="${choice.active ? "true" : "false"}"
            >${escapeHtml(choice.label)}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderActionButtons(result) {
    const actions = result.actions || [];
    if (!actions.length) return "";
    const labels = {
      preview: "Preview",
      "set-next": "Set as Next",
      "add-queue": "Add to Queue",
      "add-service": "Add to Service",
      "send-live": "Send Live Now",
    };
    return `
      <div class="worship-search-actions" role="group" aria-label="Actions for ${escapeHtml(result.title)}">
        ${actions.map((action) => `
          <button
            type="button"
            class="secondary-button live-touch-btn ${action === "send-live" ? "warn-touch-btn" : ""}"
            data-worship-search-action="${escapeHtml(action)}"
            data-flat-index="${result.flatIndex}"
            aria-label="${escapeHtml(labels[action] || action)} ${escapeHtml(result.title)}"
          >${escapeHtml(labels[action] || action)}</button>
        `).join("")}
      </div>
    `;
  }

  function renderResultCard(result) {
    const active = result.flatIndex === activeIndex ? " active" : "";
    return `
      <div class="worship-search-result-wrap${active}">
        <button
          type="button"
          class="worship-search-result${active}"
          data-worship-search-result
          data-flat-index="${result.flatIndex}"
          role="option"
          aria-selected="${result.flatIndex === activeIndex ? "true" : "false"}"
        >
          <div class="worship-search-result-copy">
            <div class="worship-search-result-title">${escapeHtml(result.title)}</div>
            <div class="worship-search-result-subtitle muted">${escapeHtml(result.subtitle)}</div>
            ${result.snippetHtml ? `<div class="worship-search-result-snippet">${result.snippetHtml}</div>` : ""}
          </div>
        </button>
        ${renderActionButtons(result)}
      </div>
    `;
  }

  function renderGroup(group) {
    return `
      <section class="worship-search-group" role="group" aria-labelledby="worship-group-${escapeHtml(group.id)}">
        <h3 id="worship-group-${escapeHtml(group.id)}">${escapeHtml(group.label)} <span class="muted">(${group.results.length})</span></h3>
        <div class="worship-search-group-results" role="presentation">
          ${group.results.map((result) => renderResultCard(result)).join("")}
        </div>
      </section>
    `;
  }

  function renderRecentQueries(queries) {
    const items = Array.isArray(queries) ? queries : [];
    if (!items.length) return "";
    return `
      <section class="worship-search-recent-queries" aria-label="Recent searches">
        <h4>Recent searches</h4>
        <div class="button-row">
          ${items.slice(0, 8).map((item) => `
            <button type="button" class="secondary-button" data-worship-search-recent="${escapeHtml(item)}">${escapeHtml(item)}</button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderResults(payload) {
    const query = call("getQuery") || "";
    if (!query) {
      return `
        ${renderRecentQueries(payload?.recentQueries)}
        <div class="empty-state worship-search-empty">Search Bible references, hymn numbers, titles, lyrics, service items, and media across your installed library.</div>
      `;
    }
    if (!payload?.total) {
      return `<div class="empty-state worship-search-empty" role="status">No results for <strong>${escapeHtml(query)}</strong>. Try another reference, hymn number, title, or phrase.</div>`;
    }
    const ordered = [...(payload.groups || [])].sort((a, b) => {
      return GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id);
    });
    return ordered.map((group) => renderGroup(group)).join("");
  }

  function renderPage(query) {
    const indexed = call("getIndexedCount") || 0;
    return `
      <section class="section worship-search-page" aria-label="Worship Search">
        <div class="worship-search-hero">
          <div>
            <p class="eyebrow">Unified worship search</p>
            <h2>Worship Search</h2>
            <p class="muted">Search Bible references and phrases, hymn numbers, titles, lyrics, service items, and media. Preview stays separate from Live.</p>
          </div>
          <div class="worship-search-meta" id="worshipSearchMeta">
            <span class="search-stat-pill">${escapeHtml(String(indexed))} hymns indexed offline</span>
          </div>
        </div>
        <div class="worship-search-toolbar">
          <label class="search-box global-search-input">
            <span aria-hidden="true">${window.CISUiIcons ? window.CISUiIcons.get("search") : "⌕"}</span>
            <input
              id="globalSearchInput"
              type="search"
              value="${escapeHtml(query || "")}"
              placeholder="Try Jn 3:16, 51, Amazing Grace, or all things work together"
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
        <div id="worshipSearchInterpretation"></div>
        <div class="filter-row tag-filter-section global-search-filters">
          ${typeof callbacks.renderFilterRow === "function" ? callbacks.renderFilterRow() : ""}
          ${typeof callbacks.renderScopeRow === "function" ? callbacks.renderScopeRow() : ""}
        </div>
        <div id="globalSearchResults" class="worship-search-results" role="listbox" aria-label="Worship search results"></div>
      </section>
    `;
  }

  function setSearchPending(pending) {
    searchPending = pending;
    const countEl = document.getElementById("globalSearchCount");
    if (!countEl) return;
    countEl.classList.toggle("is-pending", pending);
    const query = call("getQuery") || "";
    if (pending) countEl.textContent = query ? "Searching…" : "Type to search worship content";
  }

  function updateCount(total) {
    const countEl = document.getElementById("globalSearchCount");
    if (!countEl) return;
    countEl.classList.remove("is-pending");
    const query = call("getQuery") || "";
    if (!query) {
      countEl.textContent = "Type to search worship content";
      return;
    }
    countEl.textContent = `${total} result${total === 1 ? "" : "s"}`;
  }

  function paintResults(payload) {
    lastPayload = payload || { groups: [], flat: [], total: 0, interpretation: null };
    const root = document.getElementById("globalSearchResults");
    const interpretationRoot = document.getElementById("worshipSearchInterpretation");
    if (!root) return;
    if (activeIndex >= lastPayload.flat.length) activeIndex = lastPayload.flat.length - 1;
    if (interpretationRoot) interpretationRoot.innerHTML = renderInterpretation(lastPayload);
    root.innerHTML = renderResults(lastPayload);
    updateCount(lastPayload.total || 0);
    scrollActiveIntoView();
  }

  async function runSearchNow(gen, isCurrent) {
    const query = call("getQuery") || "";
    if (!window.CISWorshipSearchEngine) {
      paintResults({ groups: [], flat: [], total: 0, interpretation: null });
      setSearchPending(false);
      return;
    }
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const context = typeof callbacks.getSearchContext === "function" ? callbacks.getSearchContext() : {};
    const payload = await window.CISWorshipSearchEngine.search(query, {
      context,
      interpretationOverride,
      totalLimit: 140,
    });
    if (isCurrent && !isCurrent(gen)) return;
    if (payload === null) return;
    paintResults(payload);
    setSearchPending(false);
    if (window.CISPerformanceMonitor) {
      const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
      window.CISPerformanceMonitor.record("worshipSearchMs", ended - started);
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
    if (activeEl?.scrollIntoView) activeEl.scrollIntoView({ block: "nearest" });
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

  function getActiveResult() {
    if (activeIndex < 0 || !lastPayload.flat[activeIndex]) return null;
    return lastPayload.flat[activeIndex];
  }

  function previewActiveResult() {
    const result = getActiveResult();
    if (!result) return false;
    if (typeof callbacks.onPreviewResult === "function") {
      callbacks.onPreviewResult(result);
      return true;
    }
    return false;
  }

  function handleAction(action, result) {
    if (!result || !action) return;
    if (typeof callbacks.onSearchAction === "function") {
      callbacks.onSearchAction(action, result);
    }
  }

  function bind() {
    const input = document.getElementById("globalSearchInput");
    const root = document.getElementById("globalSearchResults");
    const interpretationRoot = document.getElementById("worshipSearchInterpretation");
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
          previewActiveResult();
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (activeIndex >= 0) {
          event.preventDefault();
          handleAction("send-live", getActiveResult());
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (typeof callbacks.onCloseSearch === "function") callbacks.onCloseSearch();
      }
    });

    root.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-worship-search-action]");
      if (actionBtn) {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(actionBtn.dataset.flatIndex);
        const result = lastPayload.flat[index];
        handleAction(actionBtn.dataset.worshipSearchAction, result);
        return;
      }
      const card = event.target.closest("[data-worship-search-result]");
      if (!card) return;
      const index = Number(card.dataset.flatIndex);
      if (!Number.isNaN(index)) {
        activeIndex = index;
        paintResults(lastPayload);
      }
    });

    if (interpretationRoot) {
      interpretationRoot.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-worship-search-interpretation]");
        if (!chip) return;
        interpretationOverride = chip.dataset.worshipSearchInterpretation || "";
        scheduleSearch();
      });
    }

    root.addEventListener("click", (event) => {
      const recent = event.target.closest("[data-worship-search-recent]");
      if (!recent) return;
      input.value = recent.dataset.worshipSearchRecent || "";
      call("setQuery", input.value);
      scheduleSearch();
      input.focus();
    });

    runSearchNow(0, () => true);
    window.setTimeout(() => input.focus(), 0);
  }

  window.CISWorshipSearchUI = {
    configure,
    renderPage,
    bind,
    getActiveResult,
    previewActiveResult,
    refresh: () => {
      const session = ensureSearchSession();
      if (session) return session.runImmediate(runSearchNow);
      return runSearchNow(0, () => true);
    },
    cancelPending: () => {
      if (searchSession) searchSession.cancelPending();
      if (window.CISWorshipSearchEngine) window.CISWorshipSearchEngine.cancelSearch();
      setSearchPending(false);
    },
    isSearchPending: () => searchPending,
    setInterpretationOverride: (value) => {
      interpretationOverride = value || "";
    },
  };
})();
