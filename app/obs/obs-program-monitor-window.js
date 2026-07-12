(function () {
  "use strict";

  const root = document.getElementById("obsMonitorWindowRoot");
  const badge = document.getElementById("obsMonitorWindowBadge");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getWorshipContext() {
    if (window.electronAPI && window.electronAPI.obsMonitor && window.electronAPI.obsMonitor.getWorshipContext) {
      return window.electronAPI.obsMonitor.getWorshipContext();
    }
    return { worshipPreview: "—", worshipLive: "—", worshipLiveActive: false };
  }

  function render() {
    if (!window.CISObsProgramMonitor || !window.CISObsProgramMonitorUI) return;
    const monitor = window.CISObsProgramMonitor.getState();
    window.CISObsProgramMonitorUI.configure({ escapeHtml, getWorshipContext });
    window.CISObsProgramMonitorUI.render(root, monitor, { forceLayout: "large" });
    if (badge) {
      if (monitor.streaming) {
        badge.className = "obs-monitor-live-badge live";
        badge.textContent = "● LIVE";
      } else if (monitor.recording) {
        badge.className = "obs-monitor-live-badge record";
        badge.textContent = "● REC";
      } else {
        badge.className = "obs-monitor-live-badge idle";
        badge.textContent = "● PROGRAM";
      }
    }
  }

  async function bootstrap() {
    if (window.CISObsConnectionService) {
      await window.CISObsConnectionService.init().catch(() => {});
    }
    if (window.CISObsProgramMonitor) {
      window.CISObsProgramMonitor.subscribe(render);
    }
    if (window.CISObsEventService) {
      window.CISObsEventService.subscribe(render);
    }
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-command]");
      if (!target) return;
      const command = target.getAttribute("data-command");
      if (command === "obs-monitor-stop" && window.CISObsProgramMonitor) {
        window.CISObsProgramMonitor.stopMonitor().then(() => {
          if (window.electronAPI && window.electronAPI.obsMonitor) {
            window.electronAPI.obsMonitor.notifyStopped();
          }
        });
      }
    });
    render();
    if (window.electronAPI && window.electronAPI.obsMonitor && window.electronAPI.obsMonitor.getStartPrefs) {
      window.electronAPI.obsMonitor.getStartPrefs().then((prefs) => {
        if (prefs && window.CISObsProgramMonitor) {
          window.CISObsProgramMonitor.startMonitor({
            deviceId: prefs.deviceId,
            allowSnapshotFallback: true,
          }).then(render).catch(render);
        }
      });
    }
  }

  bootstrap();
})();
