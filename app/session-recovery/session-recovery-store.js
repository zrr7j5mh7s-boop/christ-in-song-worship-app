(function () {
  "use strict";

  const DB_NAME = "cis-session-recovery";
  const DB_VERSION = 1;
  const STORE_NAME = "snapshots";
  const LATEST_ID = "latest";
  const PREVIOUS_ID = "previous";

  let dbPromise = null;

  function supportsIndexedDb() {
    return typeof indexedDB !== "undefined";
  }

  function openDatabase() {
    if (!supportsIndexedDb()) {
      return Promise.reject(new Error("IndexedDB unavailable."));
    }
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open session recovery database."));
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
      tx.onerror = () => fail(tx.error || new Error("Session recovery transaction failed."));
      tx.onabort = () => fail(tx.error || new Error("Session recovery transaction aborted."));
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

  function getRecord(id) {
    return withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function readSnapshots() {
    const latest = await getRecord(LATEST_ID);
    const previous = await getRecord(PREVIOUS_ID);
    return {
      latest: latest?.snapshot || null,
      previous: previous?.snapshot || null,
      latestMeta: latest || null,
      previousMeta: previous || null,
    };
  }

  async function writeSnapshotTransactional(snapshot, validate) {
    const validation = typeof validate === "function" ? validate(snapshot) : { ok: true, errors: [] };
    if (!validation.ok) {
      return { ok: false, message: validation.errors?.join(" ") || "Snapshot validation failed.", preserved: true };
    }

    const existingLatest = await getRecord(LATEST_ID);
    const record = {
      id: LATEST_ID,
      snapshot,
      writtenAt: new Date().toISOString(),
      size: JSON.stringify(snapshot).length,
    };

    return withStore("readwrite", async (store) => {
      if (existingLatest?.snapshot) {
        await new Promise((resolve, reject) => {
          const request = store.put({
            id: PREVIOUS_ID,
            snapshot: existingLatest.snapshot,
            writtenAt: existingLatest.writtenAt,
            size: existingLatest.size || 0,
            promotedFrom: LATEST_ID,
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      await new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return { ok: true, id: record.id, writtenAt: record.writtenAt };
    });
  }

  async function clearSnapshots() {
    await withStore("readwrite", (store) => {
      store.delete(LATEST_ID);
      store.delete(PREVIOUS_ID);
    });
    return { ok: true };
  }

  window.CISSessionRecoveryStore = {
    supportsIndexedDb,
    readSnapshots,
    writeSnapshotTransactional,
    clearSnapshots,
    LATEST_ID,
    PREVIOUS_ID,
  };
})();
