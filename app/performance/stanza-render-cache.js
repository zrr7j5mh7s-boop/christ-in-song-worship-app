(function () {
  "use strict";

  const MAX_ENTRIES = 256;
  const cache = new Map();

  function get(key) {
    if (!cache.has(key)) return null;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }

  function set(key, html) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, html);
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

  window.CISStanzaRenderCache = {
    get,
    set,
    clear,
    size,
    MAX_ENTRIES,
  };
})();
