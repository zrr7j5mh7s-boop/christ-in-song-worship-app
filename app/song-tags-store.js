(function () {
  "use strict";

  const DB_NAME = "christ-in-song-worship-data";
  const DB_VERSION = 2;
  const TAG_STORE = "songTags";
  const LEGACY_KEY = "cis-va-chinoda:songTags";

  let dbPromise = null;

  function supportsIndexedDb() {
    return typeof indexedDB !== "undefined";
  }

  function openDatabase() {
    if (!supportsIndexedDb()) {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = request.result;
          if (!db.objectStoreNames.contains("serviceTemplates")) {
            db.createObjectStore("serviceTemplates", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(TAG_STORE)) {
            db.createObjectStore(TAG_STORE, { keyPath: "songKey" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
      });
    }
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(TAG_STORE, mode);
      const store = tx.objectStore(TAG_STORE);
      let settled = false;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      tx.oncomplete = () => finish(undefined);
      tx.onerror = () => fail(tx.error || new Error("IndexedDB transaction failed."));
      tx.onabort = () => fail(tx.error || new Error("IndexedDB transaction aborted."));
      try {
        const result = fn(store, tx);
        Promise.resolve(result).then((value) => {
          if (value !== undefined) finish(value);
        }).catch(fail);
      } catch (error) {
        fail(error);
      }
    }));
  }

  function readLegacyTags() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLegacyTags(map) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(map));
    } catch (_error) {
      return false;
    }
    return true;
  }

  function normalizeEntry(songKey, tags) {
    const catalog = window.CISTagCatalog;
    const normalized = catalog ? catalog.normalizeTags(tags) : (tags || []);
    return {
      songKey: String(songKey),
      tags: normalized,
      updatedAt: Date.now(),
    };
  }

  async function getAllTagMap() {
    if (!supportsIndexedDb()) return readLegacyTags();
    const rows = await withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    const map = {};
    rows.forEach((row) => {
      if (row && row.songKey) map[row.songKey] = row.tags || [];
    });
    return map;
  }

  async function getTagsForSong(songKey) {
    const map = await getAllTagMap();
    return map[songKey] || [];
  }

  async function saveSongTags(songKey, tags) {
    const entry = normalizeEntry(songKey, tags);
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => store.put(entry));
    }
    const map = await getAllTagMap();
    map[songKey] = entry.tags;
    writeLegacyTags(map);
    return entry;
  }

  async function saveTagMap(map) {
    const normalizedEntries = Object.entries(map || {}).map(([songKey, tags]) => normalizeEntry(songKey, tags));
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => {
        store.clear();
        for (const entry of normalizedEntries) store.put(entry);
      });
    }
    const nextMap = {};
    normalizedEntries.forEach((entry) => { nextMap[entry.songKey] = entry.tags; });
    writeLegacyTags(nextMap);
    return nextMap;
  }

  async function bulkApplyTags(songKeys, tags, mode = "merge") {
    const map = await getAllTagMap();
    const catalog = window.CISTagCatalog;
    const normalized = catalog ? catalog.normalizeTags(tags) : tags;
    for (const songKey of songKeys) {
      const existing = map[songKey] || [];
      map[songKey] = mode === "replace" ? normalized : catalog
        ? catalog.normalizeTags([...existing, ...normalized])
        : [...new Set([...existing, ...normalized])];
    }
    await saveTagMap(map);
    return map;
  }

  async function migrateLegacyStorage() {
    const legacy = readLegacyTags();
    if (!Object.keys(legacy).length || !supportsIndexedDb()) return legacy;
    const existing = await getAllTagMap();
    if (Object.keys(existing).length) return existing;
    await saveTagMap(legacy);
    return legacy;
  }

  window.CISSongTagsStore = {
    supportsIndexedDb,
    getAllTagMap,
    getTagsForSong,
    saveSongTags,
    saveTagMap,
    bulkApplyTags,
    migrateLegacyStorage,
  };
})();
