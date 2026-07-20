(function () {
  "use strict";

  let escapeHtml = (v) => String(v || "");
  const DESTINATIONS = [
    { id: "main", label: "Main Projector" },
    { id: "secondary", label: "Secondary Projector" },
    { id: "all", label: "All Congregation Projectors" },
    { id: "stage", label: "Stage Display" },
    { id: "foyer", label: "Foyer Display" },
    { id: "obs", label: "OBS Browser Source" },
  ];

  function configure(options) {
    if (options?.escapeHtml) escapeHtml = options.escapeHtml;
  }

  function renderTranslationOptions(translations, active, secondary) {
    return (translations || []).map((item) => `
      <option value="${escapeHtml(item.code)}" ${item.code === active ? "selected" : ""}>
        ${escapeHtml(item.abbreviation || item.code)} — ${escapeHtml(item.name)}
      </option>
    `).join("") + (secondary !== undefined ? `
      <optgroup label="Secondary (dual)">
        <option value="" ${!secondary ? "selected" : ""}>None</option>
        ${(translations || []).map((item) => `
          <option value="${escapeHtml(item.code)}" ${item.code === secondary ? "selected" : ""}>
            ${escapeHtml(item.abbreviation || item.code)}
          </option>
        `).join("")}
      </optgroup>
    ` : "");
  }

  function renderSuggestions(suggestions) {
    if (!suggestions?.length) return "";
    return `
      <div class="bible-live-suggestions" role="listbox" aria-label="Reference suggestions">
        ${suggestions.map((item) => `
          <button class="secondary-button bible-suggestion-chip" type="button" data-bible-command="apply-suggestion" data-reference="${escapeHtml(item.reference || item.label)}">
            ${escapeHtml(item.label || item.reference)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderPassage(slides, slideIndex, label) {
    if (!slides?.length) {
      return `<p class="muted bible-live-empty">Enter a reference or search phrase to load Preview.</p>`;
    }
    const slide = slides[Math.max(0, Math.min(slides.length - 1, slideIndex || 0))];
    return `
      <article class="bible-live-passage" aria-label="Prepared passage">
        <header class="bible-live-passage-head">
          <h3>${escapeHtml(slide.reference || label || "Passage")}</h3>
          ${slides.length > 1 ? `<span class="muted">${slide.slideInHymn} of ${slide.totalSlides}</span>` : ""}
          ${slide.translation ? `<span class="bible-live-translation-badge">${escapeHtml(slide.translation)}</span>` : ""}
        </header>
        <div class="bible-live-verse-text">${escapeHtml(slide.body || "").replace(/\n/g, "<br>")}</div>
      </article>
    `;
  }

  function renderSearchResults(results, preview = {}) {
    if (!results?.length) {
      if (preview.searchMode === "text" && String(preview.referenceInput || "").trim()) {
        return `<p class="muted bible-live-empty">No matching verses found for that phrase.</p>`;
      }
      return "";
    }
    return `
      <div class="bible-live-search-results">
        ${results.map((item, index) => `
          <article class="bible-search-result" data-result-index="${index}">
            <div class="bible-search-result-meta">
              <strong>${escapeHtml(item.reference)}</strong>
              <span class="muted">${escapeHtml(item.translation)}</span>
            </div>
            <p class="bible-search-result-text">${item.highlighted || escapeHtml(item.text)}</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-bible-command="preview-result" data-reference="${escapeHtml(item.reference)}">Preview</button>
              <button class="secondary-button" type="button" data-bible-command="send-result-live" data-reference="${escapeHtml(item.reference)}">Send Live</button>
              <button class="secondary-button" type="button" data-bible-command="add-result-service" data-reference="${escapeHtml(item.reference)}">Add to service</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderHistory(history) {
    if (!history?.length) return `<p class="muted">No scripture history this session.</p>`;
    return `
      <div class="bible-live-history">
        ${history.slice(0, 12).map((item) => `
          <div class="bible-history-row">
            <div>
              <strong>${escapeHtml(item.reference)}</strong>
              <span class="muted">${escapeHtml(item.translation)}</span>
            </div>
            <div class="button-row">
              <button class="secondary-button" type="button" data-bible-command="history-preview" data-reference="${escapeHtml(item.reference)}">Preview</button>
              <button class="secondary-button" type="button" data-bible-command="history-live" data-reference="${escapeHtml(item.reference)}">Send Live</button>
              <button class="secondary-button" type="button" data-bible-command="history-copy" data-reference="${escapeHtml(item.reference)}">Copy</button>
            </div>
          </div>
        `).join("")}
        <button class="secondary-button" type="button" data-bible-command="clear-history">Clear history</button>
      </div>
    `;
  }

  function renderSpeechSuggestion(suggestion) {
    if (!suggestion || suggestion.error) {
      return suggestion?.error ? `<p class="bible-live-error" role="alert">${escapeHtml(suggestion.error)}</p>` : "";
    }
    return `
      <div class="bible-speech-suggestion" role="status" aria-live="polite">
        <div class="bible-speech-head">
          <span>Detected reference: <strong>${escapeHtml(suggestion.reference)}</strong></span>
          <span>Confidence: ${escapeHtml(suggestion.confidenceLabel || "Medium")}</span>
        </div>
        <div class="button-row">
          <button class="secondary-button" type="button" data-bible-command="speech-preview">Preview</button>
          <button class="secondary-button" type="button" data-bible-command="speech-correct">Correct</button>
          <button class="secondary-button" type="button" data-bible-command="speech-dismiss">Dismiss</button>
        </div>
      </div>
    `;
  }

  function updateSearchModeTabs(root, searchMode) {
    const isText = searchMode === "text";
    root.querySelectorAll("[data-bible-mode-tab]").forEach((button) => {
      const active = (button.dataset.mode || "reference") === (isText ? "text" : "reference");
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
  }

  function updateWorkspace(root, options) {
    if (!root) return;
    const preview = options.projectionState?.preview || {};
    const live = options.projectionState?.live || {};
    const liveLabel = live.active && !live.cleared
      ? `${live.referenceLabel} — ${live.translation}`
      : live.cleared ? "Scripture cleared" : "Nothing Live";

    updateSearchModeTabs(root, preview.searchMode);

    const resultsHost = root.querySelector("[data-bible-results-host]");
    if (resultsHost) {
      resultsHost.innerHTML = preview.searchMode === "text"
        ? renderSearchResults(preview.searchResults, preview)
        : renderPassage(preview.slides, preview.slideIndex, preview.referenceLabel);
    }

    const errorEl = root.querySelector("[data-bible-error]");
    if (errorEl) {
      errorEl.innerHTML = preview.error ? `<p class="bible-live-error" role="alert">${escapeHtml(preview.error)}</p>` : "";
      errorEl.hidden = !preview.error;
    }

    const loadingEl = root.querySelector("[data-bible-loading]");
    if (loadingEl) {
      loadingEl.hidden = !preview.loading;
    }

    const suggestionsEl = root.querySelector("[data-bible-suggestions]");
    if (suggestionsEl) {
      suggestionsEl.innerHTML = renderSuggestions(preview.suggestions);
    }

    const speechEl = root.querySelector("[data-bible-speech]");
    if (speechEl) {
      speechEl.innerHTML = renderSpeechSuggestion(options.projectionState?.speechSuggestion);
    }

    const liveLabelEl = root.querySelector("[data-bible-live-label]");
    if (liveLabelEl) liveLabelEl.textContent = liveLabel;

    const preparingEl = root.querySelector("[data-bible-preparing]");
    if (preparingEl) {
      preparingEl.textContent = `${preview.referenceLabel || "—"}${preview.translation ? ` — ${preview.translation}` : ""}`;
    }

    root.querySelectorAll("[data-bible-command='prev-verse']").forEach((btn) => {
      btn.disabled = !preview.parsed;
    });
    root.querySelectorAll("[data-bible-command='next-verse']").forEach((btn) => {
      btn.disabled = !preview.parsed;
    });
    root.querySelectorAll("[data-bible-command='change-live-version']").forEach((btn) => {
      btn.disabled = !live.active || live.cleared;
    });
  }

  function renderLiveWorkspace(options) {
    const {
      translations,
      projectionState,
      settings,
      speechState,
      sermonMode,
    } = options;

    const preview = projectionState?.preview || {};
    const live = projectionState?.live || {};
    const liveLabel = live.active && !live.cleared
      ? `${live.referenceLabel} — ${live.translation}`
      : live.cleared ? "Scripture cleared" : "Nothing Live";

    return `
      <section class="bible-live-workspace ${sermonMode ? "sermon-mode" : ""}">
        <header class="bible-live-head">
          <div>
            <p class="eyebrow">Bible Live</p>
            <h2>${sermonMode ? "Live Sermon Mode" : "Live Bible Projection"}</h2>
          </div>
          <div class="button-row">
            <button class="secondary-button ${options.bibleMode === "read" ? "active" : ""}" type="button" data-bible-command="set-mode" data-mode="read">Read</button>
            <button class="secondary-button ${options.bibleMode === "live" ? "active" : ""}" type="button" data-bible-command="set-mode" data-mode="live">Bible Live</button>
            <button class="secondary-button ${sermonMode ? "active" : ""}" type="button" data-bible-command="toggle-sermon-mode">Sermon Mode</button>
          </div>
        </header>

        <div class="bible-live-controls">
          <label class="bible-live-field bible-live-field-wide">
            <span>Reference</span>
            <input
              id="bibleLiveReferenceInput"
              type="search"
              value="${escapeHtml(preview.referenceInput || "")}"
              placeholder="John 3:16, Rom 8:28, Ps 23"
              aria-label="Bible reference search"
              autocomplete="off"
            >
          </label>
          <button class="action-button" type="button" data-bible-command="search-reference">Search</button>

          <label class="bible-live-field">
            <span>Version</span>
            <select id="bibleLiveVersionSelect" data-bible-command="set-preview-version" aria-label="Bible translation">
              ${renderTranslationOptions(translations, preview.translation || settings?.defaultTranslation)}
            </select>
          </label>

          <label class="bible-live-field">
            <span>Output</span>
            <select id="bibleLiveOutputSelect" data-bible-command="set-destinations" aria-label="Output destinations" multiple size="1">
              ${DESTINATIONS.map((dest) => `
                <option value="${dest.id}" ${(live.destinations || settings?.defaultDestinations || ["main"]).includes(dest.id) ? "selected" : ""}>${escapeHtml(dest.label)}</option>
              `).join("")}
            </select>
          </label>
        </div>

        <div class="bible-live-mode-tabs" role="tablist" aria-label="Bible search mode" data-bible-mode-tabs>
          <button class="secondary-button ${preview.searchMode !== "text" ? "active" : ""}" type="button" role="tab" aria-selected="${preview.searchMode !== "text" ? "true" : "false"}" tabindex="${preview.searchMode !== "text" ? "0" : "-1"}" data-bible-command="set-search-mode" data-bible-mode-tab data-mode="reference">Reference</button>
          <button class="secondary-button ${preview.searchMode === "text" ? "active" : ""}" type="button" role="tab" aria-selected="${preview.searchMode === "text" ? "true" : "false"}" tabindex="${preview.searchMode === "text" ? "0" : "-1"}" data-bible-command="set-search-mode" data-bible-mode-tab data-mode="text">Word / phrase</button>
        </div>

        ${preview.error ? `<div data-bible-error><p class="bible-live-error" role="alert">${escapeHtml(preview.error)}</p></div>` : `<div data-bible-error hidden></div>`}
        <p class="muted" data-bible-loading role="status" ${preview.loading ? "" : "hidden"}>Loading passage…</p>
        <div data-bible-suggestions>${renderSuggestions(preview.suggestions)}</div>
        <div data-bible-results-host>
        ${preview.searchMode === "text" ? renderSearchResults(preview.searchResults, preview) : renderPassage(preview.slides, preview.slideIndex, preview.referenceLabel)}
        </div>

        <div class="bible-live-actions">
          <button class="secondary-button" type="button" data-bible-command="prev-verse" ${!preview.parsed ? "disabled" : ""}>Previous Verse</button>
          <button class="secondary-button" type="button" data-bible-command="preview-load">Preview</button>
          <button class="action-button" type="button" data-bible-command="send-live">Send Live</button>
          <button class="secondary-button" type="button" data-bible-command="next-verse" ${!preview.parsed ? "disabled" : ""}>Next Verse</button>
        </div>

        <div class="bible-live-secondary-actions">
          <button class="secondary-button" type="button" data-bible-command="change-live-version" ${!live.active || live.cleared ? "disabled" : ""}>Change Live Version</button>
          <button class="secondary-button" type="button" data-bible-command="clear-scripture">Clear Scripture</button>
          <button class="secondary-button" type="button" data-bible-command="restore-scripture">Restore Previous</button>
          <button class="secondary-button" type="button" data-bible-command="blackout">Blackout</button>
          <button class="secondary-button" type="button" data-bible-command="${speechState?.listening ? "speech-stop" : "speech-start"}">
            ${speechState?.listening ? "Stop listening" : "Speech detect"}
          </button>
        </div>

        ${renderSpeechSuggestion(projectionState?.speechSuggestion) ? `<div data-bible-speech>${renderSpeechSuggestion(projectionState?.speechSuggestion)}</div>` : `<div data-bible-speech></div>`}

        <footer class="bible-live-status" aria-live="polite">
          <div class="bible-live-status-row">
            <span class="bible-live-status-label">Currently Live:</span>
            <strong data-bible-live-label>${escapeHtml(liveLabel)}</strong>
          </div>
          <div class="bible-live-status-row">
            <span class="bible-live-status-label">Preparing:</span>
            <span data-bible-preparing>${escapeHtml(preview.referenceLabel || "—")}${preview.translation ? ` — ${escapeHtml(preview.translation)}` : ""}</span>
          </div>
          ${preview.nextVerseRef ? `<div class="bible-live-status-row"><span class="muted">Next: ${escapeHtml(preview.nextVerseRef)}</span></div>` : ""}
          ${preview.prevVerseRef ? `<div class="bible-live-status-row"><span class="muted">Previous: ${escapeHtml(preview.prevVerseRef)}</span></div>` : ""}
        </footer>

        <details class="bible-live-history-panel">
          <summary>Session scripture history</summary>
          ${renderHistory(projectionState?.history)}
        </details>
      </section>
    `;
  }

  function bindWorkspace(root, handlers) {
    if (!root) return;
    root.querySelectorAll("[data-bible-command]").forEach((element) => {
      const command = element.dataset.bibleCommand;
      if (!command) return;
      if (element.tagName === "SELECT" && command === "set-preview-version") {
        element.addEventListener("change", () => handlers(command, element));
        return;
      }
      if (element.tagName === "SELECT" && command === "set-destinations") {
        element.addEventListener("change", () => handlers(command, element));
        return;
      }
      if (command === "set-search-mode") {
        element.addEventListener("click", () => handlers(command, element));
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handlers(command, element);
          }
        });
        return;
      }
      element.addEventListener("click", () => handlers(command, element));
    });

    const input = root.querySelector("#bibleLiveReferenceInput");
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handlers("search-reference", input);
        }
      });
    }
  }

  window.CISBibleLiveUI = {
    configure,
    DESTINATIONS,
    renderLiveWorkspace,
    renderSearchResults,
    updateWorkspace,
    updateSearchModeTabs,
    bindWorkspace,
  };
})();
