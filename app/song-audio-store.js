(function () {
  "use strict";

  const DB_NAME = "christ-in-song-worship-data";
  const DB_VERSION = 4;
  const STORE_NAME = "songAudio";
  const LEGACY_META_KEY = "cis-va-chinoda:songAudioMeta";
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

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
          if (!db.objectStoreNames.contains("serviceTemplates")) {
            db.createObjectStore("serviceTemplates", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("songTags")) {
            db.createObjectStore("songTags", { keyPath: "songKey" });
          }
          if (!db.objectStoreNames.contains("autoBackups")) {
            db.createObjectStore("autoBackups", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "songKey" });
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

  function readLegacyMeta() {
    try {
      const raw = localStorage.getItem(LEGACY_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return {};
    }
  }

  function writeLegacyMeta(map) {
    try {
      localStorage.setItem(LEGACY_META_KEY, JSON.stringify(map));
    } catch (_error) {
      return false;
    }
    return true;
  }

  function toMeta(entry) {
    if (!entry) return null;
    return {
      songKey: entry.songKey,
      kind: entry.kind,
      mimeType: entry.mimeType,
      fileName: entry.fileName,
      size: entry.size,
      duration: entry.duration || 0,
      updatedAt: entry.updatedAt,
    };
  }

  function detectKind(file) {
    const name = String(file && file.name || "").toLowerCase();
    const type = String(file && file.type || "").toLowerCase();
    if (name.endsWith(".mid") || name.endsWith(".midi") || type.includes("midi")) return "midi";
    return "mp3";
  }

  function validateFile(file) {
    if (!file) return { ok: false, errors: ["No audio file was selected."] };
    const errors = [];
    if (file.size === 0) errors.push("The selected file is empty.");
    if (file.size > MAX_FILE_BYTES) errors.push("Audio files must be 25 MB or smaller.");
    const kind = detectKind(file);
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/aac", "audio/ogg", "audio/midi", "audio/x-midi", ""];
    if (file.type && !allowed.includes(file.type) && kind !== "midi" && !file.type.startsWith("audio/")) {
      errors.push("Please choose an MP3, WAV, M4A, or MIDI file.");
    }
    return { ok: errors.length === 0, errors, kind };
  }

  async function getEntry(songKey) {
    if (!supportsIndexedDb()) return null;
    return withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(String(songKey));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function getAudioMeta(songKey) {
    const entry = await getEntry(songKey);
    return toMeta(entry);
  }

  async function getAudioBlob(songKey) {
    const entry = await getEntry(songKey);
    if (!entry || !entry.blob) return null;
    return new Blob([entry.blob], { type: entry.mimeType || "application/octet-stream" });
  }

  async function listAllMeta() {
    if (!supportsIndexedDb()) {
      return Object.values(readLegacyMeta());
    }
    const rows = await withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows.map(toMeta).filter(Boolean);
  }

  async function hasAudio(songKey) {
    const meta = await getAudioMeta(songKey);
    return !!meta;
  }

  async function saveAudio(songKey, file, duration = 0) {
    const checked = validateFile(file);
    if (!checked.ok) throw new Error(checked.errors.join(" "));
    const buffer = await file.arrayBuffer();
    const entry = {
      songKey: String(songKey),
      kind: checked.kind,
      mimeType: file.type || (checked.kind === "midi" ? "audio/midi" : "audio/mpeg"),
      fileName: file.name,
      size: file.size,
      duration: Number(duration) || 0,
      blob: buffer,
      updatedAt: Date.now(),
    };
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => store.put(entry));
    }
    const metaMap = readLegacyMeta();
    metaMap[entry.songKey] = toMeta(entry);
    writeLegacyMeta(metaMap);
    return toMeta(entry);
  }

  async function deleteAudio(songKey) {
    if (supportsIndexedDb()) {
      await withStore("readwrite", (store) => store.delete(String(songKey)));
    }
    const metaMap = readLegacyMeta();
    delete metaMap[String(songKey)];
    writeLegacyMeta(metaMap);
  }

  async function migrateLegacyStorage() {
    return readLegacyMeta();
  }

  window.CISSongAudioStore = {
    supportsIndexedDb,
    validateFile,
    detectKind,
    getAudioMeta,
    getAudioBlob,
    saveAudio,
    deleteAudio,
    hasAudio,
    listAllMeta,
    migrateLegacyStorage,
    MAX_FILE_BYTES,
  };
})();
