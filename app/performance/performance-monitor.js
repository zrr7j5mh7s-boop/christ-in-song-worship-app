(function () {
  "use strict";

  const marks = Object.create(null);
  const metrics = Object.create(null);
  const trackedTimers = new Set();
  const trackedIntervals = new Set();
  const trackedListeners = [];
  let startupMarked = false;

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function mark(name) {
    marks[name] = now();
    if (name === "app-start") startupMarked = true;
  }

  function measure(name, startMark) {
    const start = marks[startMark];
    if (typeof start !== "number") return null;
    const duration = now() - start;
    metrics[name] = duration;
    return duration;
  }

  function record(name, value) {
    metrics[name] = value;
  }

  function trackTimeout(id) {
    if (id != null) trackedTimers.add(id);
    return id;
  }

  function untrackTimeout(id) {
    trackedTimers.delete(id);
  }

  function trackInterval(id) {
    if (id != null) trackedIntervals.add(id);
    return id;
  }

  function untrackInterval(id) {
    trackedIntervals.delete(id);
  }

  function trackListener(target, type, handler, options) {
    trackedListeners.push({ target, type, handler, options });
  }

  function getResourceSnapshot() {
    const cameraStreams = window.CISCameraSourceService?.getActiveStreamCount
      ? window.CISCameraSourceService.getActiveStreamCount()
      : 0;
    const obsReconnect = window.CISObsConnectionService?.hasActiveReconnectTimer
      ? window.CISObsConnectionService.hasActiveReconnectTimer()
      : false;

    return {
      activeTimers: trackedTimers.size,
      activeIntervals: trackedIntervals.size,
      trackedListeners: trackedListeners.length,
      cameraStreams,
      obsReconnectTimers: obsReconnect ? 1 : 0,
    };
  }

  function getReport() {
    return {
      metrics: { ...metrics },
      resources: getResourceSnapshot(),
      startupMarked,
    };
  }

  function shutdown() {
    trackedTimers.forEach((id) => window.clearTimeout(id));
    trackedTimers.clear();
    trackedIntervals.forEach((id) => window.clearInterval(id));
    trackedIntervals.clear();
    trackedListeners.forEach((entry) => {
      try {
        entry.target.removeEventListener(entry.type, entry.handler, entry.options);
      } catch (_error) {}
    });
    trackedListeners.length = 0;
  }

  mark("app-start");

  window.CISPerformanceMonitor = {
    mark,
    measure,
    record,
    trackTimeout,
    untrackTimeout,
    trackInterval,
    untrackInterval,
    trackListener,
    getResourceSnapshot,
    getReport,
    shutdown,
  };
})();
