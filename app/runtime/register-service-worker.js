(function () {
  "use strict";

  if (!("serviceWorker" in navigator) || window.electronAPI) return;

  const swPath = window.CIS_BUILD_PREFIX === "./dist/" ? "./dist/sw.js" : "./sw.js";

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swPath).catch((error) => {
      console.warn("[Startup] Service worker registration failed:", error);
    });
  });
})();
