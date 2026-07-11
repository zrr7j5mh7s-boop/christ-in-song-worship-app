(function () {
  "use strict";

  const catalog = window.CIS_BIBLE_CATALOG || { translations: [], books: [] };
  const bookCache = new Map();

  function getCatalog() {
    return catalog;
  }

  function getTranslations() {
    return catalog.translations || [];
  }

  function getBooks() {
    return catalog.books || [];
  }

  function getBookMeta(bookOrder) {
    const order = Number(bookOrder);
    return getBooks().find((book) => book.order === order) || null;
  }

  function getTranslationMeta(code) {
    return getTranslations().find((item) => item.code === code) || null;
  }

  function bookPath(translation, fileName) {
    return `./data/bibles/json_by_book/${translation}/${fileName}`;
  }

  async function loadBook(translation, bookOrder) {
    const code = String(translation || "KJV").toUpperCase();
    const order = Number(bookOrder);
    const cacheKey = `${code}:${order}`;
    if (bookCache.has(cacheKey)) return bookCache.get(cacheKey);

    const meta = getBookMeta(order);
    if (!meta) throw new Error("Bible book not found.");

    const response = await fetch(bookPath(code, meta.file));
    if (!response.ok) throw new Error(`Could not load ${meta.name} (${code}).`);
    const payload = await response.json();
    bookCache.set(cacheKey, payload);
    return payload;
  }

  function getChapter(bookPayload, chapterNumber) {
    if (!bookPayload || !bookPayload.book) return null;
    const chapter = Number(chapterNumber);
    return (bookPayload.book.chapters || []).find((item) => item.chapter === chapter) || null;
  }

  function chapterCount(bookOrder) {
    const meta = getBookMeta(bookOrder);
    return meta ? meta.chapters : 0;
  }

  function parseReference(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;

    const match = text.match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
    if (!match) return null;

    const bookQuery = match[1].replace(/\s+/g, " ").trim().toLowerCase();
    const chapter = Number(match[2]);
    const verse = match[3] ? Number(match[3]) : null;

    const book = getBooks().find((item) => {
      const name = item.name.toLowerCase();
      const osis = item.osis.toLowerCase();
      return name === bookQuery
        || osis === bookQuery
        || name.startsWith(bookQuery)
        || bookQuery.startsWith(name.split(" ")[0]);
    });

    if (!book || !chapter) return null;
    return { bookOrder: book.order, chapter, verse };
  }

  function formatReference(bookOrder, chapter, verse) {
    const meta = getBookMeta(bookOrder);
    if (!meta) return "";
    if (verse) return `${meta.name} ${chapter}:${verse}`;
    return `${meta.name} ${chapter}`;
  }

  function clearCache() {
    bookCache.clear();
  }

  window.CISBibleStore = {
    getCatalog,
    getTranslations,
    getBooks,
    getBookMeta,
    getTranslationMeta,
    loadBook,
    getChapter,
    chapterCount,
    parseReference,
    formatReference,
    clearCache,
  };
})();
