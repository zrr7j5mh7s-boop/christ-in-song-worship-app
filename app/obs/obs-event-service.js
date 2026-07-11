(function () {
  "use strict";

  const listeners = new Set();
  let lastStatus = null;

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

  window.CISObsEventService = {
    subscribe,
    emit,
    getLastStatus,
    setLastStatus,
  };
})();
