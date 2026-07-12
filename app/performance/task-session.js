(function () {
  "use strict";

  function createDebouncedSession(options) {
    const debounceMs = Math.max(0, Number(options?.debounceMs) || 180);
    let debounceTimer = null;
    let generation = 0;

    function bumpGeneration() {
      generation += 1;
      return generation;
    }

    function isCurrent(gen) {
      return gen === generation;
    }

    function cancelPending() {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      return bumpGeneration();
    }

    function scheduleDebounced(run) {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        const gen = bumpGeneration();
        Promise.resolve(run(gen, isCurrent)).catch(() => {});
      }, debounceMs);
    }

    function runImmediate(run) {
      const gen = bumpGeneration();
      return Promise.resolve(run(gen, isCurrent));
    }

    return {
      getGeneration: () => generation,
      isCurrent,
      cancelPending,
      scheduleDebounced,
      runImmediate,
    };
  }

  window.CISTaskSession = {
    createDebouncedSession,
  };
})();
