(function () {
  "use strict";

  const indexCache = new Map();

  function normalizeQuery(query) {
    return String(query || "").trim().toLowerCase();
  }

  function highlightText(text, query) {
    const safe = String(text || "");
    const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return safe;
    let html = safe;
    terms.forEach((term) => {
      const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  async function buildIndex(translation, onProgress) {
    const code = String(translation || "KJV").toUpperCase();
    if (indexCache.has(code)) return indexCache.get(code);

    const store = window.CISBibleStore;
    if (!store) return [];

    const records = [];
    const books = store.getBooks();
    for (let i = 0; i < books.length; i += 1) {
      const book = books[i];
      try {
        const payload = await store.loadBook(code, book.order);
        (payload.book?.chapters || []).forEach((chapter) => {
          (chapter.verses || []).forEach((verse) => {
            records.push({
              bookOrder: book.order,
              bookName: book.name,
              testament: book.testament,
              chapter: chapter.chapter,
              verse: verse.verse,
              text: verse.text,
              reference: `${book.name} ${chapter.chapter}:${verse.verse}`,
              translation: code,
            });
          });
        });
      } catch (_error) {}
      if (typeof onProgress === "function") onProgress(i + 1, books.length);
    }
    indexCache.set(code, records);
    return records;
  }

  function matchesRecord(record, query, options) {
    const text = normalizeQuery(record.text);
    const q = normalizeQuery(query);
    if (!q) return false;
    if (options?.testament && record.testament !== options.testament) return false;
    if (options?.bookOrder && record.bookOrder !== options.bookOrder) return false;

    if (options?.exactPhrase) return text.includes(q);
    const terms = q.split(/\s+/).filter(Boolean);
    if (options?.allWords) return terms.every((term) => text.includes(term));
    return terms.some((term) => text.includes(term));
  }

  async function searchText(query, options) {
    const translations = options?.translations || [options?.translation || "KJV"];
    const limit = options?.limit || 40;
    const results = [];

    for (let t = 0; t < translations.length; t += 1) {
      const translation = translations[t];
      const index = await buildIndex(translation, options?.onProgress);
      for (let i = 0; i < index.length; i += 1) {
        const record = index[i];
        if (!matchesRecord(record, query, options)) continue;
        results.push({
          ...record,
          highlighted: highlightText(record.text, query),
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  function clearIndex(translation) {
    if (translation) indexCache.delete(String(translation).toUpperCase());
    else indexCache.clear();
  }

  window.CISBibleSearchService = {
    buildIndex,
    searchText,
    highlightText,
    clearIndex,
    matchesRecord,
  };
})();
