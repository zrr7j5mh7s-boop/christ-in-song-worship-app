(function () {
  "use strict";

  const DB_NAME = "christ-in-song-worship-data";
  const DB_VERSION = 1;
  const TEMPLATE_STORE = "serviceTemplates";
  const LEGACY_KEY = "cis-va-chinoda:customTemplates";

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
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
            db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
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
      const tx = db.transaction(TEMPLATE_STORE, mode);
      const store = tx.objectStore(TEMPLATE_STORE);
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

  function slugId(value) {
    return String(value || "template")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `custom-${Date.now()}`;
  }

  function normalizeTemplate(template) {
    if (!template || !template.name || !Array.isArray(template.slots)) return null;
    const id = template.id || `custom-${slugId(template.name)}-${Date.now()}`;
    return {
      id,
      name: String(template.name).trim(),
      detail: String(template.detail || `${template.slots.length} service items`).trim(),
      icon: template.icon || "★",
      category: template.category || "custom",
      builtin: false,
      slots: template.slots.map((slot, index) => ({
        role: slot.role || `Item ${index + 1}`,
        type: slot.type || "song",
        itemType: slot.itemType || "",
        title: slot.title || "",
        body: slot.body || "",
        notes: slot.notes || "",
        songKey: slot.songKey || "",
      })),
      updatedAt: template.updatedAt || Date.now(),
    };
  }

  function readLegacyTemplates() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_error) {
      return [];
    }
  }

  function writeLegacyTemplates(templates) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(templates));
    } catch (_error) {
      return false;
    }
    return true;
  }

  async function getAllTemplates() {
    if (!supportsIndexedDb()) {
      return readLegacyTemplates().map(normalizeTemplate).filter(Boolean);
    }
    const rows = await withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows.map(normalizeTemplate).filter(Boolean);
  }

  async function saveTemplate(template) {
    const normalized = normalizeTemplate(template);
    if (!normalized) throw new Error("Invalid service template.");
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => store.put(normalized));
    }
    const all = await getAllTemplates();
    writeLegacyTemplates(all);
    return normalized;
  }

  async function saveTemplates(templates) {
    const normalized = (templates || []).map(normalizeTemplate).filter(Boolean);
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => {
        store.clear();
        for (const template of normalized) store.put(template);
      });
    }
    writeLegacyTemplates(normalized);
    return normalized;
  }

  async function deleteTemplate(id) {
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => store.delete(String(id)));
    }
    const all = await getAllTemplates();
    writeLegacyTemplates(all.filter((template) => template.id !== id));
  }

  async function migrateLegacyStorage() {
    const legacy = readLegacyTemplates().map(normalizeTemplate).filter(Boolean);
    if (!legacy.length || !supportsIndexedDb()) return legacy;
    const existing = await getAllTemplates();
    if (existing.length) return existing;
    await saveTemplates(legacy);
    return legacy;
  }

  window.CISTemplateStore = {
    supportsIndexedDb,
    normalizeTemplate,
    getAllTemplates,
    saveTemplate,
    saveTemplates,
    deleteTemplate,
    migrateLegacyStorage,
  };
})();
