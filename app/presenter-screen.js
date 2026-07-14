(function () {
  "use strict";

  const root = document.getElementById("projectorRoot");
  const engine = window.CISPresenterEngine;
  const output = window.CISPresenterOutput;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function lyricHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  document.documentElement.style.cursor = "none";
  document.body.style.cursor = "none";

  output.configure({ escapeHtml, lyricHtml });
  engine.attachRemoteListener();

  function renderFromBus(message) {
    if (!message || !message.snapshot) return;
    output.render(root, message.snapshot);
  }

  if (typeof BroadcastChannel !== "undefined") {
    const bus = new BroadcastChannel(engine.CHANNEL_NAME);
    bus.onmessage = (event) => renderFromBus(event.data);
  }

  if (window.electronAPI && window.electronAPI.onPresenterState) {
    window.electronAPI.onPresenterState((payload) => renderFromBus(payload));
  }

  engine.subscribe((snapshot) => output.render(root, snapshot));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      engine.sendCommand("presenter-next");
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      engine.sendCommand("presenter-prev");
    }
    if (event.key === "Escape") engine.sendCommand("close-presenter");
    const key = event.key.toLowerCase();
    if (key === "b") engine.sendCommand("emergency-black");
    if (key === "w") engine.sendCommand("emergency-white");
    if (key === "l") engine.sendCommand("emergency-logo");
    if (key === "c") engine.sendCommand("emergency-clear");
    if (key === "p") engine.sendCommand("presenter-pause");
    if (key === "f") output.requestFullscreen(root);
  });

  window.addEventListener("load", () => {
    setTimeout(() => output.requestFullscreen(document.documentElement), 250);
  });

  window.addEventListener("beforeunload", () => {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "cis-presenter:closed" }, window.location.origin);
      } catch (_error) {
        return;
      }
    }
  });
})();
