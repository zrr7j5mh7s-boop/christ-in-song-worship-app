(function () {
  "use strict";

  const DB_NAME = "christ-in-song-hymnal-library";
  const DB_VERSION = 1;
  const BOOK_STORE = "hymnBooks";
  const EDITION_STORE = "editions";
  const IMPORT_STORE = "importedEditions";
  const META_STORE = "meta";
  const MIGRATION_KEY = "hymnalLibraryMigratedV1";

  let dbPromise = null;
  let runtimeCache = {
    books: [],
    editions: [],
    importedPacks: [],
    initialized: false,
  };

  function supportsIndexedDb() {
    return typeof indexedDB !== "undefined";
  }

  function openDatabase() {
    if (!supportsIndexedDb()) {
      return Promise.reject(new Error("IndexedDB is not available."));
    }
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(BOOK_STORE)) {
            db.createObjectStore(BOOK_STORE, { keyPath: "hymnBookId" });
          }
          if (!db.objectStoreNames.contains(EDITION_STORE)) {
            const store = db.createObjectStore(EDITION_STORE, { keyPath: "editionId" });
            store.createIndex("hymnBookId", "hymnBookId", { unique: false });
          }
          if (!db.objectStoreNames.contains(IMPORT_STORE)) {
            db.createObjectStore(IMPORT_STORE, { keyPath: "editionId" });
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open hymnal library database."));
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

  function normalizeSong(song, editionId) {
    if (!song || !song.number || !song.title) return null;
    const number = String(song.number).padStart(3, "0");
    const hymnId = window.CISHymnalMigration
      ? window.CISHymnalMigration.buildHymnId(editionId, number, song.recordId)
      : `${editionId}:${number}`;
    return {
      ...song,
      hymnId,
      editionId,
      number,
    };
  }

  function normalizeImportedPack(pack, editionMeta) {
    if (!pack || !Array.isArray(pack.songs)) return null;
    const editionId = editionMeta.editionId;
    const songs = pack.songs.map((song) => normalizeSong(song, editionId)).filter(Boolean);
    return {
      editionId,
      hymnBookId: editionMeta.hymnBookId,
      code: editionMeta.packCode || pack.code,
      name: editionMeta.languageName || pack.name,
      status: "ready",
      songCount: songs.length,
      source: editionMeta.sourceFileName || pack.source || "Imported",
      importedAt: editionMeta.importedAt || Date.now(),
      songs,
      editionId,
      hymnBookId: editionMeta.hymnBookId,
      packCode: editionMeta.packCode || pack.code,
    };
  }

  async function getMeta(key) {
    if (!supportsIndexedDb()) return null;
    return withStore(META_STORE, "readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function setMeta(key, value) {
    if (!supportsIndexedDb()) return value;
    return withStore(META_STORE, "readwrite", (store) => {
      store.put({ key, ...value, savedAt: Date.now() });
      return value;
    });
  }

  async function getAllBooks() {
    if (!supportsIndexedDb()) return runtimeCache.books.slice();
    const rows = await withStore(BOOK_STORE, "readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows;
  }

  async function saveBook(book) {
    if (!book || !book.hymnBookId) throw new Error("Invalid hymn book.");
    const normalized = { ...book, updatedAt: Date.now() };
    if (supportsIndexedDb()) {
      await withStore(BOOK_STORE, "readwrite", (store) => store.put(normalized));
    }
    return normalized;
  }

  async function getAllEditions() {
    if (!supportsIndexedDb()) return runtimeCache.editions.slice();
    const rows = await withStore(EDITION_STORE, "readonly", (store) => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
    return rows;
  }

  async function saveEdition(edition) {
    if (!edition || !edition.editionId) throw new Error("Invalid edition.");
    const normalized = { ...edition, updatedAt: Date.now() };
    if (supportsIndexedDb()) {
      await withStore(EDITION_STORE, "readwrite", (store) => store.put(normalized));
    }
    return normalized;
  }

  async function deleteEdition(editionId) {
    if (supportsIndexedDb()) {
      await withStore(EDITION_STORE, "readwrite", (store) => store.delete(editionId));
      await withStore(IMPORT_STORE, "readwrite", (store) => store.delete(editionId));
    }
    runtimeCache.importedPacks = runtimeCache.importedPacks.filter((pack) => pack.editionId !== editionId);
    runtimeCache.editions = runtimeCache.editions.filter((edition) => edition.editionId !== editionId);
  }

  async function getImportedEditionData(editionId) {
    if (!supportsIndexedDb()) {
      return runtimeCache.importedPacks.find((pack) => pack.editionId === editionId) || null;
    }
    return withStore(IMPORT_STORE, "readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(editionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function saveImportedEditionData(data) {
    if (!data || !data.editionId) throw new Error("Invalid imported edition.");
    if (supportsIndexedDb()) {
      await withStore(IMPORT_STORE, "readwrite", (store) => store.put(data));
    }
    const pack = data.pack || data;
    const existingIndex = runtimeCache.importedPacks.findIndex((item) => item.editionId === data.editionId);
    if (existingIndex >= 0) runtimeCache.importedPacks[existingIndex] = pack;
    else runtimeCache.importedPacks.push(pack);
    return data;
  }

  function resolveBuiltinPack(packCode) {
    const baseData = window.CIS_DATA || { languagePacks: [] };
    const extra = window.CIS_EXTRA_LANGUAGE_PACKS || [];
    const fromBase = (baseData.languagePacks || []).find((pack) => pack.code === packCode);
    if (fromBase) return fromBase;
    return extra.find((pack) => pack.code === packCode) || null;
  }

  function editionToLanguagePack(edition) {
    const migration = window.CISHymnalMigration;
    const meta = migration ? migration.resolveEditionMeta(edition.editionId) : null;
    const packCode = edition.packCode || (meta && meta.packCode) || edition.languageCode;

    if (edition.sourceType === "builtin") {
      const builtin = resolveBuiltinPack(packCode);
      if (!builtin) {
        return {
          code: packCode,
          editionId: edition.editionId,
          hymnBookId: edition.hymnBookId,
          name: edition.languageName || edition.editionName,
          status: edition.status || "awaiting",
          songCount: edition.hymnCount || 0,
          source: edition.sourceFileName || "",
          songs: [],
        };
      }
      const source = edition.editionId === "christ-in-song-zulu" && String(builtin.source || "").includes("VaChinoda")
        ? migration.ZULU_SOURCE_FIX
        : (edition.sourceFileName || builtin.source);
      return {
        ...builtin,
        code: packCode,
        editionId: edition.editionId,
        hymnBookId: edition.hymnBookId,
        name: edition.languageName || builtin.name,
        source,
        packCode,
      };
    }

    const imported = runtimeCache.importedPacks.find((pack) => pack.editionId === edition.editionId);
    if (imported) {
      return {
        ...imported,
        code: packCode,
        editionId: edition.editionId,
        hymnBookId: edition.hymnBookId,
        name: edition.languageName || imported.name,
        packCode,
      };
    }
    return {
      code: packCode,
      editionId: edition.editionId,
      hymnBookId: edition.hymnBookId,
      name: edition.languageName || edition.editionName,
      status: edition.status || "ready",
      songCount: edition.hymnCount || 0,
      source: edition.sourceFileName || "",
      songs: [],
      packCode,
    };
  }

  async function buildLanguagePacks() {
    const editions = await getAllEditions();
    runtimeCache.editions = editions;
    const packs = [];
    for (const edition of editions) {
      if (edition.sourceType === "imported") {
        const stored = await getImportedEditionData(edition.editionId);
        if (stored && stored.pack) {
          const idx = runtimeCache.importedPacks.findIndex((item) => item.editionId === edition.editionId);
          if (idx >= 0) runtimeCache.importedPacks[idx] = stored.pack;
          else runtimeCache.importedPacks.push(stored.pack);
        }
      }
      packs.push(editionToLanguagePack(edition));
    }
    return packs;
  }

  async function getBooksWithEditions() {
    const books = await getAllBooks();
    const editions = await getAllEditions();
    runtimeCache.books = books;
    runtimeCache.editions = editions;
    return books.map((book) => ({
      ...book,
      editions: editions.filter((edition) => edition.hymnBookId === book.hymnBookId),
    }));
  }

  async function seedBuiltInLibrary(baseData, extraPacks) {
    const migration = window.CISHymnalMigration;
    if (!migration) return;
    const books = migration.builtInHymnBooks();
    for (const book of books) {
      await saveBook(book);
    }
    const editions = migration.builtInEditionsFromBaseData(baseData, extraPacks);
    for (const edition of editions) {
      await saveEdition(edition);
    }
  }

  async function migrateLegacyImportedPacks(legacyPacks) {
    const migration = window.CISHymnalMigration;
    if (!migration || !Array.isArray(legacyPacks)) return [];
    const imported = [];
    for (const pack of legacyPacks) {
      const classified = migration.classifyImportedPack(pack, pack.source);
      const isBuiltIn = migration.resolveEditionFromLegacyCode(pack.code);
      if (isBuiltIn) continue;

      const edition = {
        editionId: classified.editionId,
        hymnBookId: classified.hymnBookId,
        languageCode: classified.languageCode,
        languageName: classified.languageName,
        nativeLanguageName: classified.nativeLanguageName,
        editionName: classified.languageName,
        sourceFileName: pack.source || "",
        sourceType: "imported",
        packCode: pack.code,
        version: 1,
        hymnCount: (pack.songs || []).length,
        checksum: "",
        importedAt: pack.importedAt || Date.now(),
        updatedAt: Date.now(),
        validationStatus: "valid",
        status: "ready",
      };

      const existingEdition = (await getAllEditions()).find((item) => item.editionId === edition.editionId);
      if (!existingEdition) await saveEdition(edition);

      const normalized = normalizeImportedPack(pack, edition);
      if (normalized) {
        await saveImportedEditionData({ editionId: edition.editionId, pack: normalized, backup: null });
        imported.push(normalized);
      }

      if (classified.hymnBookId === migration.UNCLASSIFIED) {
        const bookExists = (await getAllBooks()).some((book) => book.hymnBookId === migration.UNCLASSIFIED);
        if (!bookExists) {
          await saveBook(migration.builtInHymnBooks().find((book) => book.hymnBookId === migration.UNCLASSIFIED));
        }
      }
    }
    return imported;
  }

  async function initializeLibrary(options = {}) {
    if (runtimeCache.initialized && !options.force) {
      return buildLanguagePacks();
    }

    const baseData = options.baseData || window.CIS_DATA || { languagePacks: [] };
    const extraPacks = options.extraPacks || window.CIS_EXTRA_LANGUAGE_PACKS || [];
    let legacyPacks = options.legacyImportedPacks;

    if (!supportsIndexedDb()) {
      runtimeCache.books = window.CISHymnalMigration.builtInHymnBooks();
      runtimeCache.editions = window.CISHymnalMigration.builtInEditionsFromBaseData(baseData, extraPacks);
      runtimeCache.importedPacks = legacyPacks || [];
      runtimeCache.initialized = true;
      return buildLanguagePacks();
    }

    const migrated = await getMeta(MIGRATION_KEY);
    if (!migrated) {
      await seedBuiltInLibrary(baseData, extraPacks);
      if (legacyPacks === undefined && window.CISPackStore) {
        try {
          legacyPacks = await window.CISPackStore.getAllPacks();
        } catch (_error) {
          legacyPacks = [];
        }
      }
      runtimeCache.importedPacks = await migrateLegacyImportedPacks(legacyPacks || []);
      await setMeta(MIGRATION_KEY, { migratedAt: Date.now(), version: 1 });
    } else if (legacyPacks && legacyPacks.length) {
      runtimeCache.importedPacks = await migrateLegacyImportedPacks(legacyPacks);
    }

    runtimeCache.initialized = true;
    return buildLanguagePacks();
  }

  async function importEdition(pack, options = {}) {
    const migration = window.CISHymnalMigration;
    if (!pack || !migration) throw new Error("Invalid import pack.");
    const sourceFileName = options.sourceFileName || pack.source || "";
    const classified = options.hymnBookId
      ? {
          hymnBookId: options.hymnBookId,
          editionId: options.editionId || migration.buildEditionId(options.hymnBookId, options.languageCode, options.languageName),
          languageCode: options.languageCode || pack.code,
          languageName: options.languageName || pack.name,
          nativeLanguageName: options.nativeLanguageName || options.languageName || pack.name,
        }
      : migration.classifyImportedPack(pack, sourceFileName);

    let book = (await getAllBooks()).find((item) => item.hymnBookId === classified.hymnBookId);
    if (!book) {
      const template = migration.builtInHymnBooks().find((item) => item.hymnBookId === classified.hymnBookId);
      book = template || {
        hymnBookId: classified.hymnBookId,
        title: options.hymnBookTitle || classified.detection?.title || classified.hymnBookId,
        shortTitle: (options.hymnBookTitle || classified.hymnBookId).slice(0, 12),
        publisher: "",
        denomination: "",
        edition: "",
        publicationYear: null,
        description: "",
        coverImage: "",
        copyrightNotice: "",
        licenceInformation: "",
        attribution: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isBuiltIn: false,
        isEditable: true,
      };
      await saveBook(book);
    }

    const editionId = options.editionId || classified.editionId;
    const existingEdition = (await getAllEditions()).find((item) => item.editionId === editionId);
    const existingData = existingEdition ? await getImportedEditionData(editionId) : null;

    const editionMeta = {
      editionId,
      hymnBookId: classified.hymnBookId,
      languageCode: classified.languageCode,
      languageName: classified.languageName,
      nativeLanguageName: classified.nativeLanguageName,
      editionName: classified.languageName,
      sourceFileName,
      sourceType: "imported",
      packCode: pack.code || classified.languageCode,
      version: (existingEdition && existingEdition.version ? existingEdition.version : 0) + 1,
      hymnCount: (pack.songs || []).length,
      checksum: options.checksum || "",
      importedAt: Date.now(),
      updatedAt: Date.now(),
      validationStatus: "valid",
      status: "ready",
    };

    let finalPack = normalizeImportedPack(pack, editionMeta);
    const strategy = options.duplicateStrategy || "skip";

    if (existingData && existingData.pack) {
      const backup = { savedAt: Date.now(), edition: existingEdition, pack: existingData.pack };
      if (strategy === "overwrite") {
        finalPack = normalizeImportedPack(pack, editionMeta);
      } else {
        const existingByNumber = new Map((existingData.pack.songs || []).map((song) => [song.number, song]));
        const incoming = (pack.songs || []).map((song) => normalizeSong(song, editionId)).filter(Boolean);
        if (strategy === "skip") {
          incoming.forEach((song) => {
            if (!existingByNumber.has(song.number)) existingByNumber.set(song.number, song);
          });
        } else {
          incoming.forEach((song) => existingByNumber.set(song.number, song));
        }
        const mergedSongs = [...existingByNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
        finalPack = {
          ...existingData.pack,
          ...finalPack,
          songs: mergedSongs,
          songCount: mergedSongs.length,
        };
      }
      editionMeta.hymnCount = finalPack.songs.length;
      await saveImportedEditionData({ editionId, pack: finalPack, backup });
    } else {
      await saveImportedEditionData({ editionId, pack: finalPack, backup: null });
    }

    await saveEdition(editionMeta);
    runtimeCache.initialized = false;
    return { edition: editionMeta, pack: finalPack, book, isNew: !existingEdition };
  }

  async function exportLibrarySnapshot() {
    const books = await getAllBooks();
    const editions = await getAllEditions();
    const imported = [];
    for (const edition of editions.filter((item) => item.sourceType === "imported")) {
      const data = await getImportedEditionData(edition.editionId);
      if (data) imported.push(data);
    }
    return { books, editions, importedEditions: imported };
  }

  async function restoreLibrarySnapshot(snapshot, mode = "merge") {
    if (!snapshot) return;
    if (mode === "replace") {
      const editions = await getAllEditions();
      for (const edition of editions.filter((item) => item.sourceType === "imported")) {
        await deleteEdition(edition.editionId);
      }
    }
    for (const book of snapshot.books || []) {
      if (book.isBuiltIn) continue;
      await saveBook(book);
    }
    for (const item of snapshot.importedEditions || []) {
      if (item.edition) await saveEdition(item.edition);
      if (item.pack) await saveImportedEditionData(item);
    }
    runtimeCache.initialized = false;
  }

  async function getImportedPacksForLegacyApi() {
    await buildLanguagePacks();
    return runtimeCache.importedPacks.slice();
  }

  function getCachedBooks() {
    return runtimeCache.books.slice();
  }

  function getCachedEditions(hymnBookId) {
    const editions = runtimeCache.editions.slice();
    return hymnBookId ? editions.filter((edition) => edition.hymnBookId === hymnBookId) : editions;
  }

  function getEditionById(editionId) {
    return runtimeCache.editions.find((edition) => edition.editionId === editionId) || null;
  }

  function getBookById(hymnBookId) {
    return runtimeCache.books.find((book) => book.hymnBookId === hymnBookId) || null;
  }

  window.CISHymnalLibraryStore = {
    supportsIndexedDb,
    initializeLibrary,
    getAllBooks,
    getAllEditions,
    getBooksWithEditions,
    buildLanguagePacks,
    saveBook,
    saveEdition,
    deleteEdition,
    importEdition,
    exportLibrarySnapshot,
    restoreLibrarySnapshot,
    getImportedPacksForLegacyApi,
    getCachedBooks,
    getCachedEditions,
    getEditionById,
    getBookById,
    editionToLanguagePack,
    normalizeImportedPack,
    normalizeSong,
  };
})();
