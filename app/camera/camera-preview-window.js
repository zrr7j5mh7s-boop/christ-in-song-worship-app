(function () {
  "use strict";

  const root = document.getElementById("cameraPreviewRoot");

  function render() {
    if (!root || !window.CISCameraSourceService || !window.CISCameraCompositor) return;
    const state = window.CISCameraSourceService.getState();
    const cam = state.savedCameras.find((item) => item.id === state.preview.cameraId);
    root.innerHTML = window.CISCameraCompositor.renderOperatorPreview(cam?.name, state.preview.status);
    window.CISCameraCompositor.bindCameraVideos(root, window.CISCameraSourceService);
  }

  if (window.CISCameraSourceService) {
    window.CISCameraSourceService.subscribe(render);
    const defaultId = window.CISCameraSourceService.getState().settings.defaultCameraId;
    if (defaultId && !window.CISCameraSourceService.getState().preview.active) {
      window.CISCameraSourceService.startPreview(defaultId).catch(() => {}).finally(render);
    } else {
      render();
    }
  }

  window.addEventListener("beforeunload", () => {
    if (window.CISCameraSourceService) window.CISCameraSourceService.stopPreview();
  });
})();
