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

  function renderFromBus(message) {
    if (!message || !message.snapshot) return;
    output.render(root, message.snapshot);
  }

  let bus = null;
  if (typeof BroadcastChannel !== "undefined") {
    bus = new BroadcastChannel(engine.CHANNEL_NAME);
    bus.onmessage = (event) => renderFromBus(event.data);
  }

  if (window.electronAPI && window.electronAPI.onPresenterState) {
    window.electronAPI.onPresenterState((payload) => renderFromBus(payload));
  }

  // Commands are always forwarded to the controller window, where licence,
  // Live Lock, and confirmation guards run. Nothing executes locally: this
  // window's own engine state is inert and must never be broadcast.
  function forwardCommand(command) {
    if (window.electronAPI && window.electronAPI.sendPresenterCommand) {
      window.electronAPI.sendPresenterCommand(command);
      return;
    }
    if (bus) bus.postMessage({ type: "presenter:command", command, sentAt: Date.now() });
  }

  // Escape must never end the live session from a single accidental press.
  // In fullscreen it only exits fullscreen (browser default). Outside
  // fullscreen it requires a second press within the confirmation window,
  // and the close command is still subject to Live Lock on the controller.
  const CLOSE_CONFIRM_WINDOW_MS = 2000;
  let closeArmedAt = 0;

  function handleEscape() {
    if (document.fullscreenElement) {
      closeArmedAt = 0;
      return;
    }
    const now = Date.now();
    if (closeArmedAt && now - closeArmedAt <= CLOSE_CONFIRM_WINDOW_MS) {
      closeArmedAt = 0;
      forwardCommand("close-presenter");
      return;
    }
    closeArmedAt = now;
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      forwardCommand("presenter-next");
    }
    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      forwardCommand("presenter-prev");
    }
    if (event.key === "Escape") {
      handleEscape();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "b") forwardCommand("emergency-black");
    if (key === "w") forwardCommand("emergency-white");
    if (key === "l") forwardCommand("emergency-logo");
    if (key === "c") forwardCommand("emergency-clear");
    if (key === "p") forwardCommand("presenter-pause");
    if (key === "f") output.requestFullscreen(root);
  });

  // Ask the controller to replay the current presentation state so a newly
  // opened or reloaded projector window renders immediately. In the desktop
  // app the main process replays the last payload after did-finish-load.
  if (!window.electronAPI && bus) {
    bus.postMessage({ type: "presenter:request-state", sentAt: Date.now() });
  }

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
