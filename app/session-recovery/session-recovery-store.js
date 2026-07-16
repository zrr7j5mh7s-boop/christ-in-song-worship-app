(function () {
  "use strict";

  const DB_NAME = "cis-session-recovery";
  const DB_VERSION = 1;
  const STORE_NAME = "snapshots";
  const LATEST_ID = "latest";
  const PREVIOUS_ID = "previous";

  let dbPromise = null;

  function supportsIndexedDb() {
    return typeof indexedDB !== "undefined" && typeof indexedDB?.open === "function";
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
        request.onerror = () => {
          dbPromise = null;
          reject(request.error || new Error("Could not open session recovery database."));
        };
      });
    }
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let settled = false;
      let callbackDone = false;
      let transactionDone = false;
      let callbackValue;
      const maybeFinish = () => {
        if (callbackDone && transactionDone && !settled) {
          settled = true;
          resolve(callbackValue);
        }
      };
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      const abort = () => {
        try {
          if (mode === "readwrite" && typeof tx.abort === "function") tx.abort();
        } catch (_error) {}
      };
      tx.oncomplete = () => {
        transactionDone = true;
        maybeFinish();
      };
      tx.onerror = () => fail(tx.error || new Error("Session recovery transaction failed."));
      tx.onabort = () => fail(tx.error || new Error("Session recovery transaction aborted."));
      try {
        const result = fn(store, tx);
        Promise.resolve(result).then((value) => {
          callbackValue = value;
          callbackDone = true;
          maybeFinish();
        }).catch((error) => {
          abort();
          fail(error);
        });
      } catch (error) {
        abort();
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

    const record = {
      id: LATEST_ID,
      snapshot,
      writtenAt: new Date().toISOString(),
      size: JSON.stringify(snapshot).length,
    };

    return withStore("readwrite", (store) => new Promise((resolve, reject) => {
      const latestRequest = store.get(LATEST_ID);
      latestRequest.onerror = () => reject(latestRequest.error || new Error("Could not read latest recovery snapshot."));
      latestRequest.onsuccess = () => {
        const existingLatest = latestRequest.result;
        const writeLatest = () => {
          const writeRequest = store.put(record);
          writeRequest.onerror = () => reject(writeRequest.error || new Error("Could not write latest recovery snapshot."));
          writeRequest.onsuccess = () => {
            resolve({ ok: true, id: record.id, writtenAt: record.writtenAt });
          };
        };

        if (existingLatest?.snapshot) {
          const previousRequest = store.put({
            id: PREVIOUS_ID,
            snapshot: existingLatest.snapshot,
            writtenAt: existingLatest.writtenAt,
            size: existingLatest.size || 0,
            promotedFrom: LATEST_ID,
          });
          previousRequest.onerror = () => reject(previousRequest.error || new Error("Could not preserve previous recovery snapshot."));
          previousRequest.onsuccess = writeLatest;
          return;
        }

        writeLatest();
      };
    }));
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
