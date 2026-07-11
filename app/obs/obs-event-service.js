(function () {
  "use strict";

  const MAX_LOG_ENTRIES = 50;
  const listeners = new Set();
  let lastStatus = null;
  let eventLog = [];

  function pushLog(entry) {
    eventLog.push(entry);
    if (eventLog.length > MAX_LOG_ENTRIES) {
      eventLog = eventLog.slice(-MAX_LOG_ENTRIES);
    }
  }

  function notify(payload) {
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn("[CISObsEventService] listener error", error);
      }
    });
  }

  function emit(eventName, data, status) {
    const payload = {
      event: eventName,
      data: data || null,
      status: status || lastStatus,
      sentAt: Date.now(),
    };
    if (status) lastStatus = status;
    pushLog({
      event: eventName,
      sentAt: payload.sentAt,
      state: payload.status?.state || "",
      message: data?.message || "",
    });
    notify(payload);
    return payload;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    if (lastStatus) listener({ event: "status", data: null, status: lastStatus, sentAt: Date.now() });
    return () => listeners.delete(listener);
  }

  function getLastStatus() {
    return lastStatus;
  }

  function setLastStatus(status) {
    lastStatus = status;
    emit("status", null, status);
  }

  function getEventLog() {
    return eventLog.slice();
  }

  function clearEventLog() {
    eventLog = [];
  }

  window.CISObsEventService = {
    subscribe,
    emit,
    getLastStatus,
    setLastStatus,
    getEventLog,
    clearEventLog,
  };
})();
