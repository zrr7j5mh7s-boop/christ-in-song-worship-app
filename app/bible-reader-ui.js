(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");

  function configure(options) {
    if (options && typeof options.escapeHtml === "function") escapeHtml = options.escapeHtml;
  }

  function renderVersionSwitcher(translations, activeCode) {
    return `
      <div class="bible-version-switcher" role="tablist" aria-label="Bible translation">
        ${(translations || []).map((item) => `
          <button
            class="secondary-button ${item.code === activeCode ? "active" : ""}"
            type="button"
            data-bible-command="set-translation"
            data-translation="${escapeHtml(item.code)}"
            title="${escapeHtml(item.edition || item.name)}"
          >${escapeHtml(item.abbreviation || item.code)}</button>
        `).join("")}
      </div>
    `;
  }

  function renderBookOptions(books, activeOrder) {
    const ot = (books || []).filter((book) => book.testament === "OT");
    const nt = (books || []).filter((book) => book.testament === "NT");
    const option = (book) => `
      <option value="${book.order}" ${Number(activeOrder) === book.order ? "selected" : ""}>${escapeHtml(book.name)}</option>
    `;
    return `
      <select data-bible-command="set-book" aria-label="Bible book">
        <optgroup label="Old Testament">${ot.map(option).join("")}</optgroup>
        <optgroup label="New Testament">${nt.map(option).join("")}</optgroup>
      </select>
    `;
  }

  function renderChapterPicker(chapterCount, activeChapter) {
    const count = Math.max(0, Number(chapterCount) || 0);
    if (!count) return "";
    const buttons = [];
    for (let chapter = 1; chapter <= count; chapter += 1) {
      buttons.push(`
        <button
          class="bible-chapter-chip ${Number(activeChapter) === chapter ? "active" : ""}"
          type="button"
          data-bible-command="set-chapter"
          data-chapter="${chapter}"
        >${chapter}</button>
      `);
    }
    return `<div class="bible-chapter-grid">${buttons.join("")}</div>`;
  }

  function renderVerses(chapter, highlightVerse) {
    if (!chapter || !chapter.verses || !chapter.verses.length) {
      return `<p class="muted bible-empty">No verses found for this chapter.</p>`;
    }
    const highlight = Number(highlightVerse) || 0;
    return `
      <div class="bible-verses">
        ${chapter.verses.map((item) => `
          <p class="bible-verse ${highlight === item.verse ? "highlight" : ""}" id="verse-${item.verse}">
            <sup class="bible-verse-num">${item.verse}</sup>
            <span>${escapeHtml(item.text)}</span>
          </p>
        `).join("")}
      </div>
    `;
  }

  function renderReader(options) {
    const {
      translations,
      books,
      translationCode,
      bookOrder,
      chapterNumber,
      bookPayload,
      chapterPayload,
      highlightVerse,
      loading,
      error,
      translationMeta,
      bookMeta,
    } = options || {};

    const title = bookMeta ? `${bookMeta.name} ${chapterNumber}` : "Bible";
    const subtitle = translationMeta
      ? `${translationMeta.name} · ${translationMeta.edition || "Public domain"}`
      : "";

    return `
      <div class="bible-reader">
        <div class="bible-reader-head">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p class="muted">${escapeHtml(subtitle)}</p>
          </div>
          ${renderVersionSwitcher(translations, translationCode)}
        </div>
        <div class="bible-controls panel">
          <label class="bible-control">
            <span>Book</span>
            ${renderBookOptions(books, bookOrder)}
          </label>
          <label class="bible-control bible-jump">
            <span>Go to</span>
            <input type="text" data-bible-command="jump-input" placeholder="John 3:16" value="">
            <button class="secondary-button" type="button" data-bible-command="jump">Go</button>
          </label>
        </div>
        ${bookMeta ? `
          <div class="bible-chapters panel">
            <h3>Chapters</h3>
            ${renderChapterPicker(bookMeta.chapters, chapterNumber)}
          </div>
        ` : ""}
        <section class="section bible-text-stage">
          ${loading ? `<p class="muted bible-status">Loading chapter…</p>` : ""}
          ${error ? `<p class="notice bible-status">${escapeHtml(error)}</p>` : ""}
          ${!loading && !error ? renderVerses(chapterPayload, highlightVerse) : ""}
        </section>
        <div class="button-row bible-nav-row">
          <button class="secondary-button" type="button" data-bible-command="prev-chapter">← Previous</button>
          <button class="secondary-button" type="button" data-bible-command="next-chapter">Next →</button>
          <button class="secondary-button" type="button" data-bible-command="copy-reference">Copy reference</button>
        </div>
      </div>
    `;
  }

  function bindReader(root, handlers) {
    if (!root || !handlers) return;
    root.querySelectorAll("[data-bible-command]").forEach((element) => {
      const command = element.dataset.bibleCommand;
      if (command === "set-book") {
        element.addEventListener("change", () => handlers.handleCommand(command, element));
        return;
      }
      if (command === "jump-input") {
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter") handlers.handleCommand("jump", element);
        });
        return;
      }
      element.addEventListener("click", () => handlers.handleCommand(command, element));
    });
  }

  window.CISBibleReaderUI = {
    configure,
    renderReader,
    bindReader,
  };
})();
