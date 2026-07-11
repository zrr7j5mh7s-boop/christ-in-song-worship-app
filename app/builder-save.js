(function () {
  "use strict";

  const DEFAULT_DEBOUNCE_MS = 500;
  let saveJson = () => false;
  let debounceMs = DEFAULT_DEBOUNCE_MS;
  let onStatusChange = null;
  let timers = {};
  let pending = {};
  let status = "saved";
  let savedAt = 0;

  function configure(options) {
    if (options && typeof options.saveJson === "function") saveJson = options.saveJson;
    if (options && Number(options.debounceMs) > 0) debounceMs = Number(options.debounceMs);
    if (options && typeof options.onStatusChange === "function") onStatusChange = options.onStatusChange;
  }

  function setStatus(next) {
    status = next;
    if (typeof onStatusChange === "function") onStatusChange(status, getStatusLabel());
  }

  function getStatus() {
    return status;
  }

  function getStatusLabel() {
    if (status === "saving") return "Saving…";
    if (status === "saved") {
      if (!savedAt) return "Saved";
      const seconds = Math.floor((Date.now() - savedAt) / 1000);
      if (seconds < 5) return "Saved";
      if (seconds < 60) return `Saved ${seconds}s ago`;
      return "Saved";
    }
    return "";
  }

  function schedule(key, value) {
    pending[key] = value;
    if (timers[key]) clearTimeout(timers[key]);
    setStatus("saving");
    timers[key] = setTimeout(() => {
      delete timers[key];
      const payload = pending[key];
      delete pending[key];
      if (payload !== undefined) {
        saveJson(key, payload);
        savedAt = Date.now();
      }
      if (!Object.keys(pending).length && !Object.keys(timers).length) {
        setStatus("saved");
      }
    }, debounceMs);
  }

  function flush() {
    Object.keys(timers).forEach((key) => {
      clearTimeout(timers[key]);
      delete timers[key];
    });
    const keys = Object.keys(pending);
    if (!keys.length) return;
    keys.forEach((key) => {
      saveJson(key, pending[key]);
      delete pending[key];
    });
    savedAt = Date.now();
    setStatus("saved");
  }

  function hasPending() {
    return Object.keys(pending).length > 0 || Object.keys(timers).length > 0;
  }

  window.CISBuilderSave = {
    configure,
    schedule,
    flush,
    hasPending,
    getStatus,
    getStatusLabel,
  };
})();
