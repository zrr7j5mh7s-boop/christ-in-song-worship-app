(function () {
  "use strict";

  const PREFIX = "cis-va-chinoda:help:";
  const KEYS = {
    setupChecklist: "setupChecklist",
    preServiceChecklist: "preServiceChecklist",
    bookmarks: "bookmarks",
    recent: "recentArticles",
    searches: "recentSearches",
    training: "trainingProgress",
    analytics: "analytics",
    role: "role",
    whatsNewSeen: "whatsNewSeen",
  };

  function storage() {
    return typeof window !== "undefined" ? window.localStorage : null;
  }

  function read(key, fallback) {
    try {
      const ls = storage();
      if (!ls) return fallback;
      const raw = ls.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      const ls = storage();
      if (!ls) return false;
      ls.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getRole() {
    const role = read(KEYS.role, "operator");
    return ["operator", "admin", "editor", "remote"].includes(role) ? role : "operator";
  }

  function setRole(role) {
    write(KEYS.role, role);
  }

  function canSeeArticle(article) {
    if (!article || !article.roles || article.roles.includes("all")) return true;
    const role = getRole();
    if (role === "admin") return true;
    return article.roles.includes(role);
  }

  function todayServiceDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensurePreServiceDate(data) {
    const today = todayServiceDate();
    if (!data.serviceDate || data.serviceDate !== today) {
      return { items: {}, serviceDate: today, updatedAt: Date.now() };
    }
    return data;
  }

  function getChecklist(id) {
    const key = id === "pre-service" ? KEYS.preServiceChecklist : KEYS.setupChecklist;
    const raw = read(key, { items: {}, serviceDate: "", updatedAt: 0 });
    if (id !== "pre-service") return raw;
    const ensured = ensurePreServiceDate(raw);
    if (ensured.serviceDate !== raw.serviceDate || ensured.updatedAt !== raw.updatedAt) {
      saveChecklist(id, ensured);
    }
    return ensured;
  }

  function saveChecklist(id, payload) {
    const key = id === "pre-service" ? KEYS.preServiceChecklist : KEYS.setupChecklist;
    return write(key, { ...payload, updatedAt: Date.now() });
  }

  function toggleChecklistItem(id, itemKey, done) {
    const current = getChecklist(id);
    current.items = current.items || {};
    current.items[itemKey] = Boolean(done);
    saveChecklist(id, current);
    return current;
  }

  function resetChecklist(id) {
    const current = getChecklist(id);
    current.items = {};
    if (id === "pre-service") current.serviceDate = new Date().toISOString().slice(0, 10);
    saveChecklist(id, current);
    return current;
  }

  function checklistProgress(id, totalItems) {
    const current = getChecklist(id);
    const done = Object.values(current.items || {}).filter(Boolean).length;
    const total = totalItems || 0;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function addRecentArticle(articleId) {
    const list = read(KEYS.recent, []);
    const next = [articleId, ...list.filter((id) => id !== articleId)].slice(0, 12);
    write(KEYS.recent, next);
    return next;
  }

  function getRecentArticles() {
    return read(KEYS.recent, []);
  }

  function addRecentSearch(query) {
    const q = String(query || "").trim();
    if (!q) return [];
    const list = read(KEYS.searches, []);
    const next = [q, ...list.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 10);
    write(KEYS.searches, next);
    return next;
  }

  function getRecentSearches() {
    return read(KEYS.searches, []);
  }

  function clearRecentSearches() {
    write(KEYS.searches, []);
  }

  function toggleBookmark(articleId) {
    const set = new Set(read(KEYS.bookmarks, []));
    if (set.has(articleId)) set.delete(articleId);
    else set.add(articleId);
    const next = [...set];
    write(KEYS.bookmarks, next);
    return next;
  }

  function getBookmarks() {
    return read(KEYS.bookmarks, []);
  }

  function isBookmarked(articleId) {
    return getBookmarks().includes(articleId);
  }

  function recordAnalytics(event, payload) {
    const log = read(KEYS.analytics, []);
    log.push({ event, payload: payload || null, at: Date.now() });
    write(KEYS.analytics, log.slice(-200));
  }

  function getTrainingProgress() {
    return read(KEYS.training, { lessons: {}, activeLesson: "", trainingMode: false });
  }

  function saveTrainingProgress(progress) {
    return write(KEYS.training, progress);
  }

  function markWhatsNewSeen(version) {
    write(KEYS.whatsNewSeen, version);
  }

  function getWhatsNewSeen() {
    return read(KEYS.whatsNewSeen, "");
  }

  window.CISHelpStore = {
    getRole,
    setRole,
    canSeeArticle,
    getChecklist,
    saveChecklist,
    toggleChecklistItem,
    resetChecklist,
    checklistProgress,
    addRecentArticle,
    getRecentArticles,
    addRecentSearch,
    getRecentSearches,
    clearRecentSearches,
    toggleBookmark,
    getBookmarks,
    isBookmarked,
    recordAnalytics,
    getTrainingProgress,
    saveTrainingProgress,
    markWhatsNewSeen,
    getWhatsNewSeen,
  };
})();
