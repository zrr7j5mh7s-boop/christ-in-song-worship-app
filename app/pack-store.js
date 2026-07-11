(function () {
  "use strict";

  const DB_NAME = "christ-in-song-packs";
  const DB_VERSION = 1;
  const PACK_STORE = "languagePacks";
  const META_STORE = "meta";
  const LEGACY_KEY = "cis-va-chinoda:importedLanguagePacks";

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
          if (!db.objectStoreNames.contains(PACK_STORE)) {
            db.createObjectStore(PACK_STORE, { keyPath: "code" });
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
      });
    }
    return dbPromise;
  }

  function withStore(storeName, mode, fn) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
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

  function readLegacyPacks() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_error) {
      return [];
    }
  }

  function writeLegacyPacks(packs) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(packs));
    } catch (_error) {
      return false;
    }
    return true;
  }

  function normalizePack(pack) {
    if (!pack || !pack.code || !pack.name || !Array.isArray(pack.songs)) return null;
    const songs = pack.songs
      .map(normalizeSong)
      .filter(Boolean)
      .sort((a, b) => Number(a.number) - Number(b.number));
    return {
      code: String(pack.code).trim().toLowerCase(),
      name: String(pack.name).trim(),
      status: "ready",
      songCount: songs.length,
      source: pack.source || "Imported pack",
      importedAt: pack.importedAt || Date.now(),
      songs,
    };
  }

  function normalizeSong(song) {
    if (!song || !song.number || !song.title) return null;
    const number = String(song.number).padStart(3, "0");
    const slides = Array.isArray(song.slides) && song.slides.length
      ? song.slides.map(normalizeSlide)
      : buildSlidesFromSections(song.sections || []);
    const sections = Array.isArray(song.sections) && song.sections.length
      ? song.sections.map(normalizeSection)
      : slidesToSections(slides);
    return {
      number,
      title: String(song.title).trim(),
      language: song.language || "",
      languageCode: song.languageCode || "",
      slides,
      sections,
      hasChorus: sections.some((section) => section.kind === "chorus"),
    };
  }

  function normalizeSlide(slide, index) {
    const body = plainText(slide && (slide.body || slide.text || ""));
    const label = String((slide && slide.label) || `Slide ${index + 1}`).trim();
    const kind = slide && slide.kind ? slide.kind : /chorus/i.test(label) ? "chorus" : "verse";
    return {
      kind,
      label,
      marker: slide && slide.marker ? String(slide.marker) : "",
      body,
      sourceSlide: slide && slide.sourceSlide ? String(slide.sourceSlide) : "Imported",
      slideInHymn: index + 1,
      totalSlides: 0,
    };
  }

  function normalizeSection(section) {
    const label = String((section && section.label) || "Verse").trim();
    const kind = section && section.kind
      ? section.kind
      : /chorus/i.test(label) ? "chorus" : "verse";
    return {
      kind,
      label,
      marker: section && section.marker ? String(section.marker) : "",
      body: plainText(section && (section.body || section.text || "")),
    };
  }

  function buildSlidesFromSections(sections) {
    return sections.map((section, index) => ({
      kind: /chorus/i.test(section.label || "") ? "chorus" : "verse",
      label: section.label || `Section ${index + 1}`,
      marker: section.marker || "",
      body: plainText(section.body || ""),
      sourceSlide: "Imported",
      slideInHymn: index + 1,
      totalSlides: sections.length,
    }));
  }

  function slidesToSections(slides) {
    const unique = [];
    const seen = new Set();
    for (const slide of slides) {
      const key = `${slide.label}::${slide.body}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({
        kind: slide.kind || "verse",
        label: slide.label || "Verse",
        marker: slide.marker || "",
        body: slide.body || "",
      });
    }
    return unique;
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r/g, "")
      .trim();
  }

  async function getAllPacks() {
    if (!supportsIndexedDb()) return readLegacyPacks().map(normalizePack).filter(Boolean);
    const rows = await withStore(PACK_STORE, "readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows.map(normalizePack).filter(Boolean);
  }

  async function savePack(pack) {
    const normalized = normalizePack(pack);
    if (!normalized) throw new Error("Invalid language pack.");
    if (supportsIndexedDb()) {
      await withStore(PACK_STORE, "readwrite", (store) => store.put(normalized));
    }
    const packs = await getAllPacks();
    writeLegacyPacks(packs);
    return normalized;
  }

  async function savePacks(packs) {
    const normalized = (packs || []).map(normalizePack).filter(Boolean);
    if (supportsIndexedDb()) {
      await withStore(PACK_STORE, "readwrite", (store) => {
        store.clear();
        for (const pack of normalized) store.put(pack);
      });
    }
    writeLegacyPacks(normalized);
    return normalized;
  }

  async function deletePack(code) {
    if (supportsIndexedDb()) {
      await withStore(PACK_STORE, "readwrite", (store) => store.delete(String(code)));
    }
    const packs = await getAllPacks();
    writeLegacyPacks(packs.filter((pack) => pack.code !== code));
  }

  async function migrateLegacyStorage() {
    const legacy = readLegacyPacks().map(normalizePack).filter(Boolean);
    if (!legacy.length || !supportsIndexedDb()) return legacy;
    const existing = await getAllPacks();
    if (existing.length) return existing;
    await savePacks(legacy);
    return legacy;
  }

  async function recordImportSummary(summary) {
    if (!supportsIndexedDb()) return summary;
    return withStore(META_STORE, "readwrite", (store) => {
      store.put({ key: "lastImportSummary", ...summary, savedAt: Date.now() });
      return summary;
    });
  }

  window.CISPackStore = {
    supportsIndexedDb,
    normalizePack,
    normalizeSong,
    getAllPacks,
    savePack,
    savePacks,
    deletePack,
    migrateLegacyStorage,
    recordImportSummary,
  };
})();
