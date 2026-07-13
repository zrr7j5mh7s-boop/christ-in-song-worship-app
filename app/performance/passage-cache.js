(function () {
  "use strict";

  const MAX_ENTRIES = 48;
  const cache = new Map();

  function buildKey(parts) {
    return Object.keys(parts).sort().map((key) => `${key}=${parts[key]}`).join("|");
  }

  function get(keyParts) {
    const key = buildKey(keyParts);
    if (!cache.has(key)) return null;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }

  function set(keyParts, value) {
    const key = buildKey(keyParts);
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }

  function clear() {
    cache.clear();
  }

  function size() {
    return cache.size;
  }

  window.CISPassageCache = {
    get,
    set,
    clear,
    size,
    MAX_ENTRIES,
  };
})();
