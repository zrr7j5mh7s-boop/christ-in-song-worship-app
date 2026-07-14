(function () {
  "use strict";

  const root = document.getElementById("stageDisplayRoot");
  const output = window.CISStageDisplayOutput;
  const CHANNEL_NAME = "cis-stage-display-v1";

  document.documentElement.style.cursor = "none";
  document.body.style.cursor = "none";

  function renderSnapshot(snapshot) {
    if (!root || !output) return;
    root.innerHTML = output.render(snapshot);
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    applyScale(snapshot);
  }

  function renderTest(label) {
    if (!root || !output) return;
    root.innerHTML = output.renderTestPattern(label);
    root.classList.remove("hidden");
  }

  function applyScale(snapshot) {
    const mode = snapshot?.settings?.scaleMode || "fit";
    document.body.dataset.scaleMode = mode;
  }

  function handleMessage(message) {
    if (!message) return;
    if (message.type === "stage-display:state" && message.snapshot) {
      renderSnapshot(message.snapshot);
      return;
    }
    if (message.type === "stage-display:test") {
      renderTest(message.label || "Stage display test");
    }
  }

  if (typeof BroadcastChannel !== "undefined") {
    const bus = new BroadcastChannel(CHANNEL_NAME);
    bus.onmessage = (event) => handleMessage(event.data);
  }

  if (window.electronAPI?.stageDisplay?.onState) {
    window.electronAPI.stageDisplay.onState((payload) => handleMessage(payload));
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "f") output.requestFullscreen(document.documentElement);
    if (event.key === "Escape" && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });

  window.addEventListener("load", () => {
    if (window.electronAPI?.stageDisplay?.getStartPrefs) {
      window.electronAPI.stageDisplay.getStartPrefs().then((prefs) => {
        if (!prefs?.windowed) {
          setTimeout(() => output.requestFullscreen(document.documentElement), 300);
        }
      }).catch(() => {});
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.has("windowed")) {
      setTimeout(() => output.requestFullscreen(document.documentElement), 300);
    }
  });

  window.addEventListener("beforeunload", () => {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "cis-stage-display:closed" }, window.location.origin);
      } catch (_error) {
        return;
      }
    }
    if (window.electronAPI?.stageDisplay?.notifyClosed) {
      window.electronAPI.stageDisplay.notifyClosed();
    }
  });
})();
