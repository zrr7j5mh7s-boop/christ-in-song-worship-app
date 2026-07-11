(function () {
  "use strict";

  const DB_NAME = "christ-in-song-worship-data";
  const DB_VERSION = 3;
  const STORE_NAME = "autoBackups";
  const SETTINGS_KEY = "cis-va-chinoda:autoBackupEnabled";
  const LAST_RUN_KEY = "cis-va-chinoda:lastAutoBackupDate";
  const MAX_BACKUPS = 7;

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
          if (!db.objectStoreNames.contains("songTags")) {
            db.createObjectStore("songTags", { keyPath: "songKey" });
          }
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
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
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
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

  function isAutoBackupEnabled() {
    try {
      return localStorage.getItem(SETTINGS_KEY) === "true";
    } catch (_error) {
      return false;
    }
  }

  function setAutoBackupEnabled(enabled) {
    try {
      localStorage.setItem(SETTINGS_KEY, enabled ? "true" : "false");
    } catch (_error) {
      return false;
    }
    return true;
  }

  function getLastAutoBackupDate() {
    try {
      return localStorage.getItem(LAST_RUN_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function setLastAutoBackupDate(value) {
    try {
      localStorage.setItem(LAST_RUN_KEY, value);
    } catch (_error) {
      return false;
    }
    return true;
  }

  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  async function listAutoBackups() {
    if (!supportsIndexedDb()) return [];
    const rows = await withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        label: row.label,
        size: row.size || 0,
        summary: row.summary || {},
      }))
      .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  }

  async function getAutoBackup(id) {
    if (!supportsIndexedDb()) return null;
    return withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function saveAutoBackup(record) {
    if (!supportsIndexedDb()) return null;
    await withStore("readwrite", (store) => store.put(record));
    const all = await listAutoBackups();
    if (all.length > MAX_BACKUPS) {
      const stale = all.slice(MAX_BACKUPS);
      await withStore("readwrite", (store) => {
        stale.forEach((item) => store.delete(item.id));
      });
    }
    setLastAutoBackupDate(todayStamp());
    return record;
  }

  async function deleteAutoBackup(id) {
    if (!supportsIndexedDb()) return;
    await withStore("readwrite", (store) => store.delete(id));
  }

  async function maybeRunDailyBackup(createBackupBlob) {
    if (!isAutoBackupEnabled() || typeof createBackupBlob !== "function") return null;
    const stamp = todayStamp();
    if (getLastAutoBackupDate() === stamp) return null;
    const existing = await getAutoBackup(stamp);
    if (existing) {
      setLastAutoBackupDate(stamp);
      return null;
    }
    const result = await createBackupBlob({ kind: "auto" });
    if (!result || !result.blob) return null;
    const buffer = await result.blob.arrayBuffer();
    await saveAutoBackup({
      id: stamp,
      createdAt: new Date().toISOString(),
      label: `Daily backup · ${stamp}`,
      size: buffer.byteLength,
      summary: result.summary || {},
      blob: buffer,
    });
    return { id: stamp, summary: result.summary || {} };
  }

  window.CISBackupStore = {
    supportsIndexedDb,
    isAutoBackupEnabled,
    setAutoBackupEnabled,
    getLastAutoBackupDate,
    listAutoBackups,
    getAutoBackup,
    saveAutoBackup,
    deleteAutoBackup,
    maybeRunDailyBackup,
    MAX_BACKUPS,
  };
})();
